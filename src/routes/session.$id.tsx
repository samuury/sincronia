import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, PencilRuler, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getSession, saveExplanation, saveQuiz, saveSessionReport } from "@/lib/sessions.functions";
import {
  generateDiagnostic,
  generateExplanation,
  generateSubExplanation,
  generateVerificationQuiz,
  generateSessionReport,
} from "@/lib/ai.functions";
import {
  PROFILE_LABEL,
  PROFILE_DESCRIPTION,
  type Profile,
} from "@/lib/profiles";

import logo from "@/assets/logo-sincronia-nova.png";
import iconeEngrenagem from "@/assets/icone-engrenagem.png";
import iconeLupa from "@/assets/icone-lupa.png";
import iconeDuasLampadas from "@/assets/icone-duas-lampadas.png";
import iconeBussola from "@/assets/icone-bussola.png";
import iconeLivro from "@/assets/icone-livro.png";
import iconeLampada from "@/assets/icone-lampada.png";

const PROFILE_ICONS: Record<Profile, string> = {
  sistematico: iconeEngrenagem,
  investigativo: iconeLupa,
  associativo: iconeDuasLampadas,
  explorador: iconeBussola,
  concreto_guiado: iconeLivro,
  pragmatico: iconeLampada,
};

import { StudySidebar } from "@/components/estudos/StudySidebar";
import { ChapterViewer, type Chapter } from "@/components/estudos/ChapterViewer";
import { ExerciseViewer, type Exercise } from "@/components/estudos/ExerciseViewer";
import { DiagnosticQuiz } from "@/components/estudos/DiagnosticQuiz";

export const Route = createFileRoute("/session/$id")({
  head: () => ({ meta: [{ title: "Sessão — SincronIA" }] }),
  component: SessionPage,
});

type Quiz = {
  questions: { q: string; options: string[]; answer: number; why: string }[];
};
type Explanation = {
  title: string;
  intro: string;
  sections: { heading: string; body: string; references?: string[] }[];
  summary: string;
  concepts: string[];
};

type Stage = "loading" | "diag" | "learn" | "done";

function SessionPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) nav({ to: "/auth" });
      else setReady(true);
    });
  }, [nav]);

  const getS = useServerFn(getSession);
  const genDiag = useServerFn(generateDiagnostic);
  const genExp = useServerFn(generateExplanation);
  const genSub = useServerFn(generateSubExplanation);
  const genVer = useServerFn(generateVerificationQuiz);
  const saveExp = useServerFn(saveExplanation);
  const saveQ = useServerFn(saveQuiz);
  const genReport = useServerFn(generateSessionReport);
  const saveReportFn = useServerFn(saveSessionReport);

  const [stage, setStage] = useState<Stage>("loading");
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState<{title: string, desc: string} | null>(null);
  const [material, setMaterial] = useState("");
  const [topic, setTopic] = useState("");
  const [profile, setProfile] = useState<Profile>("sistematico");

  const [diag, setDiag] = useState<Quiz | null>(null);
  const [diagAnswers, setDiagAnswers] = useState<number[]>([]);
  const [diagScore, setDiagScore] = useState<number | null>(null);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [showReduceModal, setShowReduceModal] = useState(false);
  const [showDeepenModal, setShowDeepenModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile>("sistematico");
  const [regenNote, setRegenNote] = useState("");

  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [previousExplanation, setPreviousExplanation] = useState<Explanation | null>(null);
  const [previousProfile, setPreviousProfile] = useState<Profile | null>(null);
  const [nextExplanation, setNextExplanation] = useState<Explanation | null>(null);
  const [nextProfile, setNextProfile] = useState<Profile | null>(null);

  const [verify, setVerify] = useState<Quiz | null>(null);
  const [verAnswers, setVerAnswers] = useState<number[]>([]);
  const [verScore, setVerScore] = useState<number | null>(null);

  // Estados da interface baseada em capítulos
  const [mode, setMode] = useState<"aula" | "exercicios">("aula");
  const [chapter, setChapter] = useState(0);
  const [exIndex, setExIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState<boolean[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionReport, setSessionReport] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const r = await getS({ data: { id } });
        setMaterial(r.session.material_text ?? "");
        setTopic(r.session.topic);
        setProfile((r.session.profile_used ?? "sistematico") as Profile);
        
        if (r.session.status === "completed" && r.explanation) {
          setExplanation(r.explanation.content as Explanation);
          const vq = r.quizzes.find((q: any) => q.kind === "verification");
          if (vq) {
            setVerify({ questions: vq.questions as any });
            setVerScore(Number(vq.score ?? 0));
            if (vq.answers) {
              setVerAnswers(vq.answers as number[]);
              setAnswered(new Array((vq.questions as any[])?.length || 0).fill(true));
              let c = 0;
              (vq.questions as any[]).forEach((q, i) => {
                if (q.answer === (vq.answers as number[])[i]) c++;
              });
              setCorrectCount(c);
            }
          }
          if (r.session.report) {
            setSessionReport(r.session.report);
          }
          setStage("learn");
          return;
        }

        if (r.explanation) {
          setExplanation(r.explanation.content as Explanation);
          setStage("learn");
          return;
        }

        const existingDiag = r.quizzes?.find((q: any) => q.kind === "diagnostic");
        if (existingDiag) {
          setDiag({ questions: existingDiag.questions as any });
          setDiagAnswers((existingDiag.answers as number[]) || new Array((existingDiag.questions as any[])?.length || 0).fill(-1));
          setStage("diag");
          return;
        }

        const routeData = (r.session as any).route_data as any;
        const chapters = routeData?.chapters || [];

        const d = await genDiag({
          data: { materialText: r.session.material_text!, topic: r.session.topic, chapters },
        });
        
        await saveQ({
          data: {
            session_id: id,
            kind: "diagnostic",
            questions: d.questions as any,
          }
        });

        setDiag(d);
        setDiagAnswers(new Array(d.questions.length).fill(-1));
        setStage("diag");
      } catch (e: any) {
        toast.error(e.message);
      }
    })();
  }, [ready, id]);

  const chapters = useMemo(() => {
    if (!explanation) return [];
    return [
      { title: explanation.title, subtitle: "Introdução", body: explanation.intro },
      ...explanation.sections.map((s) => ({ title: s.heading, body: s.body, references: s.references })),
    ].map(c => ({...c, title: c.title.replace(/^(Capítulo|Cap)\s*\d+[\:\-\.]\s*/i, "").trim()}));
  }, [explanation]);

  const totalChapters = chapters.length;
  const current = chapters[chapter];
  const finished = answered.length > 0 && answered.every((a) => a);

  async function regenerateExplanation(options?: { newProfile?: Profile; reduce?: boolean; deepen?: boolean; note?: string }) {
    setShowProfileModal(false);
    setShowRegenModal(false);
    setShowReduceModal(false);
    setShowDeepenModal(false);
    setBusyText({ title: "Adaptando sua aula...", desc: "A Inteligência Artificial está reescrevendo o material conforme o seu pedido." });
    setBusy(true);
    try {
      const rawPlan = sessionStorage.getItem("sincronia:plan");
      let plan = rawPlan ? JSON.parse(rawPlan) : { minutes: 30 };

      if (options?.reduce && plan.minutes) {
        plan.minutes = Math.max(1, Math.floor(plan.minutes / 2));
      }

      if (options?.deepen && plan.minutes) {
        plan.minutes = plan.minutes * 2;
        plan.chatNote = "O aluno pediu para aprofundar muito mais este assunto. Vá além do básico, traga conceitos avançados, ramificações complexas e explore os detalhes com máxima densidade.";
      }

      if (options?.note) {
        plan.chatNote = options.note;
      }

      const activeProfile = options?.newProfile || profile;

      const exp = await genExp({
        data: {
          materialText: material,
          topic,
          profile: activeProfile,
          diagScore: diagScore ?? 0.5,
          plan,
        },
      });

      if (explanation) setPreviousExplanation(explanation);
      if (profile) setPreviousProfile(profile);
      setNextExplanation(null);
      setNextProfile(null);

      setExplanation(exp as any);
      setChapter(0);
      setProfile(activeProfile);
      
      await saveExp({
        data: { session_id: id, content: exp as any },
      });
      
      toast.success(options?.reduce ? "Conteúdo reduzido!" : "Conteúdo recriado com sucesso!");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao recriar explicação.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUndo() {
    if (!previousExplanation || !previousProfile) return;
    setBusyText({ title: "Restaurando aula...", desc: "Voltando para a versão anterior do seu material." });
    setBusy(true);
    try {
      if (explanation) setNextExplanation(explanation);
      if (profile) setNextProfile(profile);

      setExplanation(previousExplanation);
      setProfile(previousProfile);
      setPreviousExplanation(null);
      setPreviousProfile(null);
      setChapter(0);
      
      await saveExp({
        data: { session_id: id, content: previousExplanation as any },
      });
      toast.success("Aula restaurada com sucesso!");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao restaurar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRedo() {
    if (!nextExplanation || !nextProfile) return;
    setBusyText({ title: "Refazendo aula...", desc: "Avançando para a versão mais recente do seu material." });
    setBusy(true);
    try {
      if (explanation) setPreviousExplanation(explanation);
      if (profile) setPreviousProfile(profile);

      setExplanation(nextExplanation);
      setProfile(nextProfile);
      setNextExplanation(null);
      setNextProfile(null);
      setChapter(0);
      
      await saveExp({
        data: { session_id: id, content: nextExplanation as any },
      });
      toast.success("Alteração refeita com sucesso!");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao refazer.");
    } finally {
      setBusy(false);
    }
  }

  async function submitDiagnostic() {
    if (!diag) return;
    const correct = diag.questions.reduce(
      (acc, q, i) => acc + (diagAnswers[i] === q.answer ? 1 : 0),
      0,
    );
    const score = correct / diag.questions.length;
    setDiagScore(score);
    setBusy(true);
    try {
      await saveQ({
        data: {
          session_id: id,
          kind: "diagnostic",
          questions: diag.questions as any,
          answers: diagAnswers,
          score,
        },
      });
      setStage("loading");
      const rawPlan = sessionStorage.getItem("sincronia:plan");
      const plan = rawPlan ? JSON.parse(rawPlan) : undefined;

      const exp = await genExp({
        data: {
          materialText: material,
          topic,
          profile,
          diagScore: score,
          plan,
        },
      });
      setExplanation(exp as any);
      await saveExp({
        data: { session_id: id, content: exp as any },
      });
      setStage("learn");
    } catch (e: any) {
      toast.error(e.message);
      setStage("diag");
    } finally {
      setBusy(false);
    }
  }

  async function goToExercises() {
    if (verify) {
      setMode("exercicios");
      return;
    }
    if (!explanation) return;
    setBusyText({ title: "Criando seus exercícios...", desc: "A IA está gerando perguntas desafiadoras baseadas no que você acabou de ler." });
    setBusy(true);
    try {
      const v = await genVer({
        data: {
          materialText: material,
          explanationJson: JSON.stringify(explanation),
        },
      });
      setVerify(v as any);
      setVerAnswers(new Array(v.questions.length).fill(-1));
      setAnswered(new Array(v.questions.length).fill(false));
      setMode("exercicios");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function confirmEx() {
    if (selected === null || !verify) return;
    const ans = [...answered];
    ans[exIndex] = true;
    setAnswered(ans);

    const vAns = [...verAnswers];
    vAns[exIndex] = selected;
    setVerAnswers(vAns);

    if (selected === verify.questions[exIndex].answer) {
      setCorrectCount((c) => c + 1);
    }
  }

  function nextExercise() {
    setSelected(null);
    if (verify) setExIndex((i) => Math.min(verify.questions.length - 1, i + 1));
  }

  async function finishSession() {
    if (!verify) return;

    if (sessionReport) {
      setStage("done");
      return;
    }

    setBusyText({ title: "Avaliando suas respostas...", desc: "Corrigindo o teste e gerando o seu relatório de desempenho final." });
    setBusy(true);
    toast.info("Avaliando suas respostas e gerando o relatório...");
    const score = correctCount / verify.questions.length;
    setVerScore(score);
    try {
      await saveQ({
        data: {
          session_id: id,
          kind: "verification",
          questions: verify.questions as any,
          answers: verAnswers,
          score,
        },
      });

      const quizData = verify.questions.map((q, i) => ({
        question: q.q,
        correctAnswer: q.options[q.answer],
        userAnswer: verAnswers[i] === -1 ? "Não respondeu" : q.options[verAnswers[i]],
      }));

      const reportText = await genReport({
        data: {
          topic,
          profile,
          score,
          quizData
        }
      });

      await saveReportFn({
        data: { session_id: id, report: reportText }
      });

      setSessionReport(reportText);
      setStage("done");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleStudyMistakes() {
    sessionStorage.setItem(
      "sincronia:pending",
      JSON.stringify({
        text: material,
        topic: `Revisão: ${topic}`,
        profile,
        scores: {},
      })
    );
    
    sessionStorage.setItem(
      "sincronia:plan",
      JSON.stringify({
        motivo: "reforco",
        minutes: 30,
        chatNote: `Quero focar em revisar os meus erros do teste anterior. O meu relatório de desempenho diz o seguinte: "${sessionReport}". Por favor, crie um roteiro focado em corrigir esses erros.`,
      })
    );
    
    nav({ to: "/refinement" });
  }

  if (!ready) return null;

  if (stage === "done") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-6 left-6">
          <Link to="/home" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar ao início
          </Link>
        </div>
        <section className="rounded-3xl border-2 border-border bg-card p-10 text-center shadow-[0_8px_0_0_var(--border)] max-w-xl w-full">
          <img src={logo} alt="SincronIA" className="mx-auto h-48 w-full object-contain drop-shadow-xl" />
          <h2 className="mt-4 text-5xl font-extrabold text-primary">
            {verScore !== null ? Math.round(verScore * 100) : 0}%
          </h2>
          <p className="mt-4 text-lg font-bold text-muted-foreground">
            {verScore !== null && verScore >= 0.75
              ? "Mandou bem! Você dominou esse material."
              : "Bom começo. Que tal revisar o material mais uma vez?"}
          </p>
          <div className="mt-6 rounded-2xl bg-primary/10 p-4 border border-primary/20">
            <p className="text-sm font-bold text-primary">
              Seu relatório de desempenho já está disponível no seu Painel!
            </p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button onClick={handleStudyMistakes} className="btn-3d btn-3d-accent w-full sm:w-auto">
              Reforçar erros
            </button>
            <Link to="/dashboard" className="btn-3d-ghost w-full sm:w-auto">
              Ver relatório
            </Link>
            <Link to="/home" className="btn-3d btn-3d-primary w-full sm:w-auto">
              Novo material
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
          <h1 className="mt-6 text-2xl font-extrabold text-accent">
            {diag ? "Gerando seu material..." : "Analisando seu conhecimento…"}
          </h1>
          <p className="mt-2 text-sm font-bold text-muted-foreground">
            {diag 
              ? "Isso pode levar alguns segundos..." 
              : "A IA está lendo seu material e preparando um quiz rápido para ver o que você já sabe."}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      {stage === "diag" && diag ? (
        <>
          <div className="absolute top-6 left-6">
            <Link to="/home" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Voltar ao início
            </Link>
          </div>
          <main className="mx-auto max-w-3xl px-6 py-24">
          <DiagnosticQuiz
            title="Antes de começarmos: o que você já sabe sobre isso?"
            quiz={diag as any}
            answers={diagAnswers}
            setAnswers={setDiagAnswers}
            onSubmit={submitDiagnostic}
            busy={busy}
            ctaLabel="Gerar minha aula"
          />
          </main>
        </>
      ) : stage === "learn" && explanation ? (
        <main className="mx-auto max-w-6xl px-6 py-10">
          <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <Link to="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Voltar ao painel
              </Link>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Trilha de estudos
              </p>
              <h1 className="mt-1 text-3xl font-extrabold text-accent md:text-4xl">
                {topic || "Material"}
              </h1>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border-2 border-accent/30 bg-accent/10 px-4 py-1">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Perfil
                </span>
                <span className="text-sm font-extrabold text-accent">
                  {PROFILE_LABEL[profile]}
                </span>
              </div>
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
                onClick={goToExercises}
                className={
                  "flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-extrabold transition-colors disabled:opacity-40 " +
                  (mode === "exercicios"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {busy && mode !== "exercicios" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilRuler className="h-4 w-4" />} 
                Exercícios
              </button>
            </div>
          </header>

          <div className="grid gap-8 md:grid-cols-[180px_1fr] md:items-start">
            <StudySidebar
              onRegenerate={() => setShowRegenModal(true)}
              onReduce={() => setShowReduceModal(true)}
              onDeepen={() => setShowDeepenModal(true)}
              onChangeProfile={() => setShowProfileModal(true)}
              onUndo={handleUndo}
              canUndo={!!previousExplanation}
              onRedo={handleRedo}
              canRedo={!!nextExplanation}
            />

            <section>
              {busy ? (
                <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in zoom-in-95 duration-300">
                  <Loader2 className="h-10 w-10 animate-spin text-accent" />
                  <h2 className="mt-6 text-2xl font-extrabold text-accent">{busyText?.title || "Carregando..."}</h2>
                  <p className="mt-2 text-sm font-bold text-muted-foreground">
                    {busyText?.desc || "Aguarde um instante."}
                  </p>
                </div>
              ) : mode === "aula" ? (
                totalChapters === 0 ? (
                  <p className="text-muted-foreground">Sem capítulos disponíveis.</p>
                ) : (
                  <>
                    <div className="flex overflow-x-auto snap-x snap-mandatory gap-2 pb-4 -mx-6 px-6 md:mx-0 md:px-0 md:flex-wrap md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {chapters.map((c, i) => {
                        const active = chapter === i;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setChapter(i)}
                            aria-current={active ? "step" : undefined}
                            className={
                              "flex-shrink-0 snap-start rounded-xl border-2 px-4 py-2.5 text-sm font-extrabold transition-transform active:translate-y-1 active:shadow-none " +
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
                      summary={explanation.summary}
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
                          onClick={goToExercises}
                          disabled={busy}
                          className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary font-extrabold text-primary-foreground shadow-[0_4px_0_0_var(--primary-shadow)] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Ir para exercícios" }
                          {!busy && <ArrowRight className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </>
                )
              ) : verify && (
                <ExerciseViewer
                  exercises={verify.questions as any}
                  exIndex={exIndex}
                  setExIndex={setExIndex}
                  selected={selected}
                  setSelected={setSelected}
                  answered={answered}
                  onConfirm={confirmEx}
                  onNext={nextExercise}
                  onFinish={finishSession}
                  finished={finished}
                  correctCount={correctCount}
                />
              )}
            </section>
          </div>
        </main>
      ) : null}

      {/* Modal: Me Explica de Novo */}
      {showRegenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border-2 border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-extrabold text-accent text-center">Refazer aula?</h2>
            <p className="mt-2 text-sm font-semibold text-muted-foreground text-center">
              Tem certeza que deseja descartar a aula atual e gerar uma nova explicação?
            </p>
            <div className="mt-4">
              <label className="block text-sm font-bold text-foreground mb-1">O que você quer mudar?</label>
              <textarea
                value={regenNote}
                onChange={(e) => setRegenNote(e.target.value)}
                placeholder="Ex: Focar mais no uso prático, usar exemplos do cotidiano..."
                rows={3}
                className="w-full resize-none rounded-xl border-2 border-border bg-transparent p-3 text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => regenerateExplanation({ note: regenNote })}
                disabled={busy}
                className="btn-3d btn-3d-primary w-full"
              >
                {busy ? "Gerando..." : "Sim, me explica de novo"}
              </button>
              <button
                onClick={() => { setShowRegenModal(false); setRegenNote(""); }}
                disabled={busy}
                className="btn-3d-ghost w-full"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reduza o Conteúdo */}
      {showReduceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border-2 border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-extrabold text-accent text-center">Reduzir conteúdo?</h2>
            <p className="mt-2 text-sm font-semibold text-muted-foreground text-center">
              Deseja reescrever esta aula com o mesmo formato, mas cortando o tempo pela metade?
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => regenerateExplanation({ reduce: true })}
                disabled={busy}
                className="btn-3d btn-3d-primary w-full"
              >
                {busy ? "Gerando..." : "Sim, reduza o conteúdo"}
              </button>
              <button
                onClick={() => setShowReduceModal(false)}
                disabled={busy}
                className="btn-3d-ghost w-full"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Aprofundar Conteúdo */}
      {showDeepenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border-2 border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-extrabold text-accent text-center">Aprofundar conteúdo?</h2>
            <p className="mt-2 text-sm font-semibold text-muted-foreground text-center">
              Deseja reescrever esta aula expandindo drasticamente o conteúdo com conceitos avançados e mais detalhes?
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => regenerateExplanation({ deepen: true })}
                disabled={busy}
                className="btn-3d btn-3d-primary w-full"
              >
                {busy ? "Gerando..." : "Sim, aprofundar"}
              </button>
              <button
                onClick={() => setShowDeepenModal(false)}
                disabled={busy}
                className="btn-3d-ghost w-full"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mudar Forma de Aprender */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border-2 border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-extrabold text-accent">Mudar forma de aprender</h2>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Escolha um novo perfil. A aula será reescrita na hora usando essa nova ótica, substituindo a atual.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {Object.entries(PROFILE_LABEL).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedProfile(key as Profile)}
                  className={`rounded-2xl border-2 p-4 text-left transition-colors flex items-center gap-4 ${
                    selectedProfile === key
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  <img src={PROFILE_ICONS[key as Profile]} alt={label} className="w-12 h-12 object-contain flex-shrink-0" />
                  <div>
                    <div className="font-extrabold text-foreground">{label}</div>
                    <div className="mt-1 text-xs font-semibold text-muted-foreground">
                      {PROFILE_DESCRIPTION[key as Profile]}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-8 flex gap-4">
              <button
                onClick={() => setShowProfileModal(false)}
                disabled={busy}
                className="btn-3d-ghost w-full"
              >
                Cancelar
              </button>
              <button
                onClick={() => regenerateExplanation({ newProfile: selectedProfile })}
                disabled={busy}
                className="btn-3d btn-3d-primary w-full"
              >
                {busy ? "Gerando..." : "Adaptar Aula"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
