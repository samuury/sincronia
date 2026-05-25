import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, PencilRuler, Loader2, ArrowRight } from "lucide-react";
import {
  generateExplanation,
  generateVerificationQuiz,
  generateDiagnostic,
} from "@/lib/ai.functions";
import { PROFILE_LABEL, type Profile } from "@/lib/profiles";
import { saveToHistory } from "@/lib/history";
import { DiagnosticQuiz } from "@/components/estudos/DiagnosticQuiz";
import { StudySidebar } from "@/components/estudos/StudySidebar";
import { ChapterViewer, type Chapter } from "@/components/estudos/ChapterViewer";
import { ExerciseViewer, type Exercise } from "@/components/estudos/ExerciseViewer";

export const Route = createFileRoute("/estudos")({
  head: () => ({ meta: [{ title: "Estudos — SincronIA" }] }),
  component: Estudos,
});

type Pending = {
  text?: string;
  topic?: string;
  profile?: Profile;
  scores?: Record<string, number>;
  diagScore?: number;
};

type Quiz = { questions: { q: string; options: string[]; answer: number; why: string }[] };

const CACHE_KEY = "sincronia:estudos:cache";

function Estudos() {
  const nav = useNavigate();
  const genExp = useServerFn(generateExplanation);
  const genVer = useServerFn(generateVerificationQuiz);
  const genDiag = useServerFn(generateDiagnostic);

  const [pending, setPending] = useState<Pending | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [diag, setDiag] = useState<Quiz | null>(null);
  const [diagAnswers, setDiagAnswers] = useState<number[]>([]);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const [mode, setMode] = useState<"aula" | "exercicios">("aula");
  const [chapter, setChapter] = useState(0);

  const [exIndex, setExIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState<boolean[]>([]);
  const [correctCount, setCorrectCount] = useState(0);

  const [showProfileBox, setShowProfileBox] = useState(false);

  function changeProfile(p: Profile) {
    if (pending) {
      const newPending = { ...pending, profile: p };
      sessionStorage.setItem("sincronia:pending", JSON.stringify(newPending));
      setPending(newPending);
      setShowProfileBox(false);
      setLoading(true);
      regenerate();
    }
  }

  async function loadExplanation(pToUse: Pending) {
    try {
      setLoading(true);
      const rawPlan = sessionStorage.getItem("sincronia:plan");
      const plan = rawPlan ? JSON.parse(rawPlan) : undefined;

      const exp = await genExp({
        data: {
          materialText: pToUse.text ?? "",
          topic: pToUse.topic ?? "Material",
          profile: (pToUse.profile ?? "sistematico") as Profile,
          diagScore: pToUse.diagScore ?? 0.5,
          plan,
        },
      });
      const chs: Chapter[] = [
        { title: exp.title, subtitle: "Introdução", body: exp.intro },
        ...exp.sections.map((s) => ({ title: s.heading, body: s.body })),
      ];
      chs.forEach(c => {
         c.title = c.title.replace(/^(Capítulo|Cap)\s*\d+[\:\-\.]\s*/i, "").trim();
      });

      setChapters(chs);
      setSummary(exp.summary);

      const v = await genVer({
        data: {
          materialText: pToUse.text ?? "",
          explanationJson: JSON.stringify(exp),
        },
      });
      setExercises(v.questions);
      setAnswered(new Array(v.questions.length).fill(false));

      const finalCacheData = {
        text: pToUse.text,
        chapters: chs,
        summary: exp.summary,
        exercises: v.questions,
      };
      
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(finalCacheData));
      saveToHistory(pToUse.topic || "Material sem título", pToUse, finalCacheData);
    } catch (e: any) {
      setError(e?.message ?? "Não consegui gerar o conteúdo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const raw = sessionStorage.getItem("sincronia:pending");
    if (!raw) {
      setLoading(false);
      nav({ to: "/home" });
      return;
    }

    let p: Pending;
    try {
      p = JSON.parse(raw) as Pending;
    } catch {
      setLoading(false);
      nav({ to: "/home" });
      return;
    }
    setPending(p);

    const cacheRaw = sessionStorage.getItem(CACHE_KEY);
    if (cacheRaw) {
      try {
        const c = JSON.parse(cacheRaw);
        if (c.text === p.text) {
          setChapters(c.chapters ?? []);
          setSummary(c.summary ?? "");
          setExercises(c.exercises ?? []);
          setAnswered(new Array((c.exercises ?? []).length).fill(false));
          setLoading(false);
          return;
        }
      } catch {}
    }

    (async () => {
      if (p.diagScore === undefined) {
         try {
           const d = await genDiag({ data: { materialText: p.text ?? "" } });
           setDiag(d);
           setDiagAnswers(new Array(d.questions.length).fill(-1));
           setLoading(false);
         } catch (e: any) {
           setError("Erro ao gerar diagnóstico: " + e.message);
           setLoading(false);
         }
         return;
      }
      await loadExplanation(p);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitDiagnostic() {
    if (!diag || !pending) return;
    const correct = diag.questions.reduce(
      (acc, q, i) => acc + (diagAnswers[i] === q.answer ? 1 : 0),
      0
    );
    const score = correct / diag.questions.length;
    const nextP = { ...pending, diagScore: score };
    sessionStorage.setItem("sincronia:pending", JSON.stringify(nextP));
    setPending(nextP);
    setDiag(null);
    await loadExplanation(nextP);
  }

  function regenerate() {
    if (!pending) return;
    setLoading(true);
    setError(null);
    setMode("aula");
    setChapter(0);
    setExIndex(0);
    setSelected(null);
    setAnswered([]);
    setCorrectCount(0);
    sessionStorage.removeItem(CACHE_KEY);
    loadExplanation(pending);
  }

  if (loading && !diag) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
          <h1 className="mt-6 text-2xl font-extrabold text-accent">
            Preparando sua trilha…
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A IA está lendo seu material e montando a aula no seu perfil.
          </p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyShell
        title="Não consegui gerar a aula"
        description={error}
        cta={{ label: "Tentar de novo", onClick: regenerate }}
      />
    );
  }

  if (diag) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-3xl px-6 py-24">
          <DiagnosticQuiz
            title="Antes de começarmos: o que você já sabe sobre isso?"
            quiz={diag}
            answers={diagAnswers}
            setAnswers={setDiagAnswers}
            onSubmit={submitDiagnostic}
            busy={loading}
            ctaLabel="Gerar minha aula"
          />
        </main>
      </div>
    );
  }

  if (!pending && !loading) {
    return (
      <EmptyShell
        title="Nenhum material carregado"
        description="Volte para o início e cole um conteúdo, anexe um PDF ou foto pra estudar."
        cta={{ label: "Voltar ao início", to: "/home" }}
      />
    );
  }

  const totalChapters = chapters.length;
  const current = chapters[chapter];
  const finished = answered.every((a) => a);

  function confirmEx() {
    if (selected === null) return;
    const ans = [...answered];
    ans[exIndex] = true;
    setAnswered(ans);
    if (selected === exercises[exIndex].answer) {
      setCorrectCount((c) => c + 1);
    }
  }

  function nextExercise() {
    setSelected(null);
    setExIndex((i) => Math.min(exercises.length - 1, i + 1));
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link to="/home" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Voltar ao início
            </Link>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Trilha de estudos
            </p>
            <h1 className="mt-1 text-3xl font-extrabold text-accent md:text-4xl">
              {pending?.topic || "Material"}
            </h1>
            {pending?.profile && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border-2 border-accent/30 bg-accent/10 px-4 py-1">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Perfil
                </span>
                <span className="text-sm font-extrabold text-accent">
                  {PROFILE_LABEL[pending.profile as Profile]}
                </span>
              </div>
            )}
          </div>
          <div
            role="tablist"
            aria-label="Modo de estudo"
            className="inline-flex rounded-2xl border-2 border-border bg-card p-1 shadow-[0_4px_0_0_var(--border)]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "aula"}
              onClick={() => setMode("aula")}
              className={
                "flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-extrabold transition-colors " +
                (mode === "aula"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <BookOpen className="h-4 w-4" /> Aula
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "exercicios"}
              onClick={() => setMode("exercicios")}
              disabled={exercises.length === 0}
              className={
                "flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-extrabold transition-colors disabled:opacity-40 " +
                (mode === "exercicios"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <PencilRuler className="h-4 w-4" /> Exercícios
            </button>
          </div>
        </header>

        <div className="grid gap-8 md:grid-cols-[180px_1fr] md:items-start">
          <StudySidebar
            onRegenerate={regenerate}
            onChangeProfile={() => setShowProfileBox(true)}
          />

          <section>
            {mode === "aula" ? (
              totalChapters === 0 ? (
                <p className="text-muted-foreground">Sem capítulos disponíveis.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {chapters.map((c, i) => {
                      const active = chapter === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setChapter(i)}
                          aria-current={active ? "step" : undefined}
                          className={
                            "rounded-xl border-2 px-3 py-2 text-xs font-extrabold transition-transform active:translate-y-1 active:shadow-none " +
                            (active
                              ? "border-primary bg-primary text-primary-foreground shadow-[0_4px_0_0_var(--primary-shadow)]"
                              : "border-border bg-card text-foreground shadow-[0_4px_0_0_var(--border)] hover:bg-secondary")
                          }
                        >
                          Cap {i + 1} · {c.title.slice(0, 32)}
                        </button>
                      );
                    })}
                  </div>

                  <ChapterViewer
                    current={current}
                    chapterIndex={chapter}
                    totalChapters={totalChapters}
                    summary={summary}
                  />

                  <div className="mt-6 grid grid-cols-[1fr_1.4fr] gap-4">
                    <button
                      type="button"
                      onClick={() => setChapter((c) => Math.max(0, c - 1))}
                      disabled={chapter === 0}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card font-extrabold shadow-[0_4px_0_0_var(--border)] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-40"
                    >
                      <ArrowLeft className="h-4 w-4" /> Anterior
                    </button>
                    {chapter < totalChapters - 1 ? (
                      <button
                        type="button"
                        onClick={() => setChapter((c) => Math.min(totalChapters - 1, c + 1))}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-accent bg-accent font-extrabold text-accent-foreground shadow-[0_4px_0_0_var(--accent-shadow)] transition-transform active:translate-y-1 active:shadow-none"
                      >
                        Próximo <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMode("exercicios")}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary font-extrabold text-primary-foreground shadow-[0_4px_0_0_var(--primary-shadow)] transition-transform active:translate-y-1 active:shadow-none"
                      >
                        Ir para exercícios <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </>
              )
            ) : (
              <ExerciseViewer
                exercises={exercises}
                exIndex={exIndex}
                setExIndex={setExIndex}
                selected={selected}
                setSelected={setSelected}
                answered={answered}
                onConfirm={confirmEx}
                onNext={nextExercise}
                onFinish={() => nav({ to: "/home" })}
                finished={finished}
                correctCount={correctCount}
              />
            )}
          </section>
        </div>
      </main>

      {showProfileBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border-2 border-border bg-card p-6 shadow-[0_8px_0_0_var(--border)] animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-extrabold text-accent mb-4 text-center">Mudar forma de aprender</h2>
            <div className="flex flex-col gap-3">
               {Object.entries(PROFILE_LABEL).map(([p, label]) => (
                  <button
                    key={p}
                    onClick={() => changeProfile(p as Profile)}
                    className="flex w-full items-center justify-between rounded-xl border-2 border-border bg-white px-4 py-3 text-left font-bold transition-colors hover:bg-secondary"
                  >
                    <span>{label}</span>
                    {pending?.profile === p && <span className="text-xs font-extrabold uppercase tracking-wide text-primary">Atual</span>}
                  </button>
               ))}
            </div>
            <button onClick={() => setShowProfileBox(false)} className="mt-6 w-full btn-3d-ghost">
               Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyShell({
  title,
  description,
  cta,
}: {
  title: string;
  description: string;
  cta: { label: string; to?: string; onClick?: () => void };
}) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-3xl font-extrabold text-accent">{title}</h1>
        <p className="mt-3 text-muted-foreground">{description}</p>
        {cta.to ? (
          <Link to={cta.to} className="btn-3d btn-3d-primary mt-8">
            {cta.label}
          </Link>
        ) : (
          <button onClick={cta.onClick} className="btn-3d btn-3d-primary mt-8">
            {cta.label}
          </button>
        )}
      </main>
    </div>
  );
}