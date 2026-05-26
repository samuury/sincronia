import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROFILE = z.enum([
  "sistematico",
  "pragmatico",
  "explorador",
  "associativo",
  "investigativo",
  "concreto_guiado",
]);

export const upsertProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        cognitive_profile: PROFILE,
        profile_scores: z.record(z.string(), z.number()),
        display_name: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        cognitive_profile: data.cognitive_profile,
        profile_scores: data.profile_scores,
        ...(data.display_name ? { display_name: data.display_name } : {}),
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        topic: z.string().min(1).max(120),
        material_text: z.string().min(2),
        profile_used: PROFILE,
        status: z.string().optional(),
        route_data: z.any().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Check session limit (max 3 sessions per user unless unlimited_sessions is true)
    const { data: prof, error: profError } = await supabase
      .from("profiles")
      .select("unlimited_sessions")
      .eq("id", userId)
      .maybeSingle();

    if (profError) throw new Error(profError.message);

    if (!prof?.unlimited_sessions) {
      const { count, error: countError } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (countError) throw new Error(countError.message);
      if (count !== null && count >= 3) {
        throw new Error("Você atingiu o limite de 3 estudos. Solicite permissão ao administrador para continuar.");
      }
    }

    const { data: row, error } = await supabase
      .from("sessions")
      .insert({
        user_id: userId,
        topic: data.topic,
        material_text: data.material_text,
        profile_used: data.profile_used,
        status: data.status ?? "created",
        // @ts-ignore
        route_data: data.route_data ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateSessionRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        session_id: z.string().uuid(),
        topic: z.string().min(1).max(120),
        route_data: z.any(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("sessions")
      .update({
        topic: data.topic,
        // @ts-ignore
        route_data: data.route_data,
        status: "planning",
      })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const confirmSessionCreation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        session_id: z.string().uuid(),
        topic: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("sessions")
      .update({
        topic: data.topic,
        status: "created",
      })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: session, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Sessão não encontrada.");

    const [{ data: explanations }, { data: quizzes }] = await Promise.all([
      supabase
        .from("explanations")
        .select("*")
        .eq("session_id", data.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("quizzes")
        .select("*")
        .eq("session_id", data.id)
        .order("created_at", { ascending: true }),
    ]);
    return {
      session,
      explanation: explanations?.[0] ?? null,
      quizzes: quizzes ?? [],
    };
  });

export const saveExplanation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        session_id: z.string().uuid(),
        content: z.any(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    // Remove a explicação existente para sobrescrever na mesma sessão sem duplicação
    await supabase.from("explanations").delete().eq("session_id", data.session_id);
    const { error } = await supabase.from("explanations").insert({
      session_id: data.session_id,
      content: data.content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        session_id: z.string().uuid(),
        kind: z.enum(["diagnostic", "verification"]),
        questions: z.any(),
        answers: z.any().optional(),
        score: z.number().min(0).max(1).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    
    // Remove o quiz existente do mesmo tipo para sobrescrever
    await supabase.from("quizzes").delete().eq("session_id", data.session_id).eq("kind", data.kind);
    
    const { error } = await supabase.from("quizzes").insert({
      session_id: data.session_id,
      kind: data.kind,
      questions: data.questions,
      answers: data.answers ?? null,
      score: data.score ?? null,
    });
    if (error) throw new Error(error.message);

    if (data.kind === "diagnostic" && typeof data.score === "number") {
      await supabase
        .from("sessions")
        .update({ diag_score: data.score, status: "diag_done" })
        .eq("id", data.session_id);
    }
    if (data.kind === "verification" && typeof data.score === "number") {
      await supabase
        .from("sessions")
        .update({ final_score: data.score, status: "completed" })
        .eq("id", data.session_id);
    }
    return { ok: true };
  });

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("sessions")
      .select("id, topic, status, diag_score, final_score, created_at, profile_used, report")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveSessionReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        session_id: z.string().uuid(),
        report: z.string(),
      })
      .parse(input)
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("sessions")
      .update({ report: data.report })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
