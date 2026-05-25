import { supabase } from "@/integrations/supabase/client";
import { upsertProfile } from "@/lib/sessions.functions";
import type { QuizProfile } from "@/lib/profile-quiz";
import type { Profile } from "@/lib/profiles";

const KEY = "sincronia:pending-profile";

// QuizProfile usa "concreto", o enum do banco usa "concreto_guiado".
export function quizToDbProfile(p: QuizProfile): Profile {
  return (p === "concreto" ? "concreto_guiado" : p) as Profile;
}

export type PendingProfile = {
  cognitive_profile: Profile;
  profile_scores: Record<string, number>;
};

export function savePendingProfile(data: PendingProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export function getPendingProfile(): PendingProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingProfile) : null;
  } catch {
    return null;
  }
}

export function clearPendingProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** Persiste imediatamente se houver sessão; caso contrário guarda pendente. */
export async function persistOrQueueProfile(data: PendingProfile): Promise<"saved" | "queued"> {
  savePendingProfile(data);
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return "queued";
  try {
    await upsertProfile({ data });
    clearPendingProfile();
    return "saved";
  } catch {
    return "queued";
  }
}

/** Após login: envia perfil pendente para o banco. */
export async function syncPendingProfile(): Promise<boolean> {
  const pending = getPendingProfile();
  if (!pending) return false;
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return false;
  try {
    await upsertProfile({ data: pending });
    clearPendingProfile();
    return true;
  } catch {
    return false;
  }
}