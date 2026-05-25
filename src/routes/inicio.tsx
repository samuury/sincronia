import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  PROFILE_LABEL,
  PROFILE_DESCRIPTION,
  type Profile,
} from "@/lib/profiles";
import { getMyProfile, listSessions } from "@/lib/sessions.functions";
import { ProfileQuizModal } from "@/components/ProfileQuizModal";
import { RefreshCw } from "lucide-react";
import logo from "@/assets/logo-sincronia.png";
import perfilCard from "@/assets/perfil-card.png";

export const Route = createFileRoute("/inicio")({
  head: () => ({ meta: [{ title: "Início — SincronIA" }] }),
  component: HomeLogada,
});

function HomeLogada() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        nav({ to: "/auth" });
        return;
      }
      setReady(true);
    });
    const sub = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) nav({ to: "/auth" });
    });
    return () => sub.data.subscription.unsubscribe();
  }, [nav]);

  const prof = useServerFn(getMyProfile);
  const list = useServerFn(listSessions);

  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => prof(),
    enabled: ready,
  });
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => list(),
    enabled: ready,
  });

  if (!ready) return null;

  const p = (profile.data?.cognitive_profile ?? null) as Profile | null;
  const displayName = profile.data?.display_name?.trim() || "você";
  const firstName = displayName.split(" ")[0];

  const sessionList = sessions.data ?? [];
  const lastInProgress = sessionList.find(
    (s: any) => s.status !== "completed",
  );

  async function sair() {
    await supabase.auth.signOut();
    nav({ to: "/home" });
  }

  function continuar() {
  if (lastInProgress) {
    nav({ to: "/session/$id", params: { id: lastInProgress.id } });
  } else {
    nav({ to: "/home" });
  }
}

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/inicio" className="flex items-center gap-2">
          <img
            src={logo}
            alt="SincronIA"
            className="h-20 w-auto"
          />
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm font-bold text-muted-foreground md:inline">
            Olá, {firstName} 👋
          </span>
          <button
            onClick={sair}
            className="text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16">
        <div className="mt-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-accent md:text-4xl">
            Bom te ver de novo, {firstName}.
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            {p
              ? "Vamos continuar de onde você parou."
              : "Faça o teste rápido pra mapearmos seu perfil de aprendizado."}
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {/* Card do perfil */}
          <section className="rounded-3xl border-2 border-border bg-[#f1efea] p-6 shadow-[0_6px_0_0_var(--border)]">
            <div className="flex items-start gap-4">
              <img
                src={perfilCard}
                alt=""
                className="h-32 w-32 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Seu perfil
                </p>
                <h2 className="mt-1 text-2xl font-extrabold leading-tight text-accent">
                  {displayName}
                </h2>
                <p className="mt-1 text-sm font-extrabold text-primary">
                  {p ? `Perfil: ${PROFILE_LABEL[p]}` : "Perfil não definido"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-foreground">
              {p
                ? PROFILE_DESCRIPTION[p]
                : "Identifique seu perfil pra a IA adaptar as explicações ao seu jeito."}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <Stat label="Sessões" value={String(sessionList.length)} />
              <Stat
                label="Concluídas"
                value={String(
                  sessionList.filter((s: any) => s.status === "completed")
                    .length,
                )}
              />
              <Stat
                label="Em andamento"
                value={String(
                  sessionList.filter((s: any) => s.status !== "completed")
                    .length,
                )}
              />
            </div>

            <button
              type="button"
              onClick={() => setQuizOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border-2 border-border bg-white px-4 py-2 text-sm font-bold text-foreground transition hover:bg-secondary"
            >
              <RefreshCw className="h-4 w-4" />
              {p ? "Refazer teste de perfil" : "Fazer teste de perfil"}
            </button>
          </section>

          {/* Card continuar */}
          <section className="flex flex-col justify-between rounded-3xl border-2 border-border bg-card p-6 shadow-[0_6px_0_0_var(--border)]">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {lastInProgress ? "Continue sua jornada" : "Comece agora"}
              </p>
              <h2 className="mt-1 text-2xl font-extrabold text-foreground">
                {lastInProgress ? lastInProgress.topic : "Novo material"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {lastInProgress
                  ? "Você tem uma sessão em andamento. Vamos retomar?"
                  : "Cole um conteúdo, envie um PDF ou foto e a SincronIA monta a aula."}
              </p>
            </div>

            <button
              type="button"
              onClick={continuar}
              className="btn-3d btn-3d-primary mt-6 w-full"
            >
              {lastInProgress ? "Retomar" : "Adicionar material"}
            </button>
          </section>
        </div>

        <div className="mt-12">
          <h3 className="text-xl font-extrabold">Suas sessões recentes</h3>
          <div className="mt-4 space-y-3">
            {sessions.isLoading && (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            )}
            {!sessions.isLoading && sessionList.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhuma sessão ainda. Envie seu primeiro material!
              </div>
            )}
            {sessionList.map((s: any) => (
              <Link
                key={s.id}
                to="/session/$id"
                params={{ id: s.id }}
                className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-4 transition hover:bg-secondary"
              >
                <div>
                  <p className="font-extrabold">{s.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.status === "completed"
                      ? `Concluído · ${Math.round((s.final_score ?? 0) * 100)}%`
                      : s.status === "diag_done"
                        ? "Em andamento"
                        : "Criado"}
                  </p>
                </div>
                <span className="text-2xl text-muted-foreground">→</span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <ProfileQuizModal open={quizOpen} onOpenChange={setQuizOpen} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-border bg-white px-3 py-2 text-center">
      <p className="text-lg font-extrabold text-foreground">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
