import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listSessions, getMyProfile, getSession } from "@/lib/sessions.functions";
import {
  PROFILE_LABEL,
  PROFILE_DESCRIPTION,
  type Profile,
} from "@/lib/profiles";
import { syncPendingProfile } from "@/lib/pending-profile";
import logo from "@/assets/logo-sincronia.png";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Meu painel — SincronIA" }] }),
  component: Dashboard,
});

function Dashboard() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        nav({ to: "/auth" });
        return;
      }
      setSession(data.session);
      const synced = await syncPendingProfile();
      setReady(true);
      if (synced) qc.invalidateQueries({ queryKey: ["my-profile"] });
    });
    const sub = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) nav({ to: "/auth" });
      else setSession(s);
    });
    return () => sub.data.subscription.unsubscribe();
  }, [nav, qc]);

  const list = useServerFn(listSessions);
  const prof = useServerFn(getMyProfile);
  const getSess = useServerFn(getSession);

  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => list(),
    enabled: ready,
  });
  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => prof(),
    enabled: ready,
  });

  if (!ready) return null;

  async function handleStudyMistakes(s: any) {
    try {
      const res = await getSess({ data: { id: s.id } });
      const pendingText = res.session.material_text || "";
      
      sessionStorage.setItem(
        "sincronia:pending",
        JSON.stringify({
          text: pendingText,
          topic: `Revisão: ${s.topic}`,
          profile: s.profile_used,
          scores: {},
        })
      );
      
      sessionStorage.setItem(
        "sincronia:plan",
        JSON.stringify({
          motivo: "reforco",
          minutes: 30,
          chatNote: `Quero focar em revisar os meus erros do teste anterior. O meu relatório de desempenho diz o seguinte: "${s.report}". Por favor, crie um roteiro focado em corrigir esses erros.`,
        })
      );
      
      nav({ to: "/refinement" });
    } catch (e: any) {
    }
  }

  const pRaw = profile.data?.cognitive_profile ?? session?.user?.user_metadata?.cognitive_profile ?? null;
  const p = (pRaw === "concreto" ? "concreto_guiado" : pRaw) as Profile | null;
  const sessionList = sessions.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Link to="/home" className="flex items-center gap-2">
          <img src={logo} alt="SincronIA" className="h-16 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/home" className="text-sm font-bold text-muted-foreground hover:text-primary">
            Início
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              nav({ to: "/home" });
            }}
            className="text-sm font-bold text-muted-foreground hover:text-destructive transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-[0_4px_0_0_var(--border)]">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Seu perfil
            </p>
            {p ? (
              <>
                <h2 className="mt-1 text-2xl font-extrabold text-primary">
                  {PROFILE_LABEL[p]}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {PROFILE_DESCRIPTION[p]}
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-2xl font-extrabold">
                  Ainda não conhecemos você
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Faça o teste rápido de perfil pra gente entender como você
                  aprende.
                </p>
                <Link
                  to="/home"
                  className="btn-3d btn-3d-primary mt-4 inline-flex"
                >
                  Começar
                </Link>
              </>
            )}
          </div>

          <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-[0_4px_0_0_var(--border)] flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
              Seu Desempenho (Média Geral)
            </p>
            {(() => {
              const completed = sessionList.filter((s: any) => s.status === 'completed' && s.diag_score !== null && s.final_score !== null);
              if (completed.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground">Conclua sua primeira sessão de estudo para ver as estatísticas de evolução.</p>
                );
              }
              const avgDiag = completed.reduce((acc: number, s: any) => acc + (s.diag_score || 0), 0) / completed.length;
              const avgFinal = completed.reduce((acc: number, s: any) => acc + (s.final_score || 0), 0) / completed.length;
              
              return (
                <div className="flex flex-col gap-5">
                  <div>
                    <div className="flex justify-between text-sm font-bold mb-1.5">
                      <span className="text-muted-foreground">Diagnóstico Inicial</span>
                      <span>{Math.round(avgDiag * 100)}%</span>
                    </div>
                    <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-muted-foreground transition-all duration-1000" style={{ width: `${avgDiag * 100}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-bold mb-1.5">
                      <span className="text-primary">Verificação Final</span>
                      <span className="text-primary">{Math.round(avgFinal * 100)}%</span>
                    </div>
                    <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${avgFinal * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h3 className="text-xl font-extrabold">Suas sessões</h3>
          <Link to="/home" className="btn-3d btn-3d-accent text-sm">
            + Novo material
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {sessions.isLoading && (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          )}
          {!sessions.isLoading && sessionList.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhuma sessão ainda. Envie seu primeiro material!
            </div>
          )}
          {sessionList.map((s: any) => {
            const isPlanning = s.status === "planning";
            const linkProps: any = isPlanning
              ? { to: "/refinement", search: { sessionId: s.id } }
              : { to: "/session/$id", params: { id: s.id } };

            return (
              <Link
                key={s.id}
                {...linkProps}
                className="block rounded-2xl border-2 border-border bg-card p-4 transition hover:bg-secondary"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-extrabold">{s.topic}</p>
                    <p className="text-xs font-bold text-muted-foreground">
                      {s.status === "completed"
                        ? `Concluído · ${Math.round((s.final_score ?? 0) * 100)}%`
                        : s.status === "diag_done"
                          ? "Em andamento"
                          : s.status === "planning"
                            ? "Em planejamento"
                            : "Pronto para iniciar"}
                    </p>
                  </div>
                  <span className="text-2xl">→</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Meus Relatórios */}
        <div className="mt-12 flex items-center justify-between">
          <h3 className="text-xl font-extrabold">Meus relatórios</h3>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.isLoading && (
            <p className="text-sm text-muted-foreground">Carregando relatórios…</p>
          )}
          {!sessions.isLoading && sessionList.filter((s: any) => s.status === 'completed' && s.report).length === 0 && (
            <div className="md:col-span-2 rounded-2xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Você ainda não concluiu nenhum estudo para ver seus relatórios.
            </div>
          )}
          {sessionList
            .filter((s: any) => s.status === 'completed' && s.report)
            .map((s: any) => (
              <div key={`report-${s.id}`} className="rounded-3xl border-2 border-border bg-card p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-primary mb-2">Relatório de Desempenho</div>
                  <h4 className="font-extrabold text-lg text-foreground mb-3">{s.topic}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{s.report}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                  <span className="text-xs font-bold text-muted-foreground">Acertos: {Math.round((s.final_score ?? 0) * 100)}%</span>
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleStudyMistakes(s)} className="text-sm font-bold text-accent hover:underline">
                      Reforçar meus erros
                    </button>
                    <Link to="/session/$id" params={{ id: s.id }} className="text-sm font-bold text-primary hover:underline">
                      Ver aula
                    </Link>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </main>
    </div>
  );
}
