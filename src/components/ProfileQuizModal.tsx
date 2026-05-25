import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  QUIZ_QUESTIONS,
  QUIZ_PROFILE_META,
  computeQuizProfile,
  type QuizProfile,
} from "@/lib/profile-quiz";
import {
  persistOrQueueProfile,
  quizToDbProfile,
} from "@/lib/pending-profile";

import iconeEngrenagem from "@/assets/icone-engrenagem.png";
import iconeLupa from "@/assets/icone-lupa.png";
import iconeDuasLampadas from "@/assets/icone-duas-lampadas.png";
import iconeBussola from "@/assets/icone-bussola.png";
import iconeLivro from "@/assets/icone-livro.png";
import iconeLampada from "@/assets/icone-lampada.png";

const PROFILE_ICONS: Record<QuizProfile, string> = {
  sistematico: iconeEngrenagem,
  investigativo: iconeLupa,
  associativo: iconeDuasLampadas,
  explorador: iconeBussola,
  concreto: iconeLivro,
  pragmatico: iconeLampada,
};

type Step = "questions" | "result";

export function ProfileQuizModal({
  open,
  onOpenChange,
  onStartNow,
  onFinished,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStartNow?: () => void;
  onFinished?: (p: QuizProfile) => void;
}) {
  const [step, setStep] = useState<Step>("questions");
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<number | null>(null);

  const result = useMemo(
    () => (step === "result" ? computeQuizProfile(answers) : null),
    [step, answers],
  );

  function reset() {
    setStep("questions");
    setQIdx(0);
    setAnswers({});
    setSelected(null);
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function pick(i: number) {
    setSelected(i);
  }

  function next() {
    if (selected == null) return;
    const q = QUIZ_QUESTIONS[qIdx];
    const nextAnswers = { ...answers, [q.id]: selected };
    setAnswers(nextAnswers);
    setSelected(null);
    if (qIdx < QUIZ_QUESTIONS.length - 1) {
      setQIdx(qIdx + 1);
    } else {
      setStep("result");
      const computed = computeQuizProfile(nextAnswers);
      if (onFinished) {
        onFinished(computed.profile);
      }
    }
  }

  function back() {
    if (qIdx === 0) {
      return;
    }
    const prev = qIdx - 1;
    setQIdx(prev);
    setSelected(answers[QUIZ_QUESTIONS[prev].id] ?? null);
  }

  const q = QUIZ_QUESTIONS[qIdx];
  const progress =
    step === "result"
      ? 1
      : (qIdx + 1) / QUIZ_QUESTIONS.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl gap-0 overflow-hidden border-2 border-border bg-white p-0 sm:rounded-3xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Identifique seu Perfil</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          {step === "questions" && qIdx > 0 ? (
            <button
              onClick={back}
              className="text-sm font-bold text-muted-foreground hover:text-foreground"
            >
              ← Voltar
            </button>
          ) : (
            <span />
          )}
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {step === "questions" && `Pergunta ${qIdx + 1} de ${QUIZ_QUESTIONS.length}`}
            {step === "result" && "Seu perfil"}
          </p>
          <button
            onClick={() => handleOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="h-2 w-full bg-secondary">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-8 sm:px-10">

          {step === "questions" && q && (
            <div>
              <h2 className="text-xl font-extrabold leading-snug text-foreground sm:text-2xl">
                {q.scenario}
              </h2>
              <div className="mt-6 space-y-3">
                {q.options.map((opt, i) => (
                  <button
                    key={opt.letter}
                    type="button"
                    onClick={() => pick(i)}
                    data-selected={selected === i}
                    className="opt-card flex items-start gap-3"
                  >
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg font-extrabold"
                      style={{
                        background:
                          selected === i
                            ? "var(--accent)"
                            : "color-mix(in oklab, var(--accent) 12%, white)",
                        color: selected === i ? "white" : "var(--accent)",
                      }}
                    >
                      {opt.letter}
                    </span>
                    <span className="pt-1 text-base font-bold leading-snug">
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  onClick={next}
                  disabled={selected == null}
                  className="btn-3d btn-3d-accent px-8"
                >
                  {qIdx === QUIZ_QUESTIONS.length - 1 ? "Ver perfil" : "Continuar"}
                </button>
              </div>
            </div>
          )}

          {step === "result" && result && (
            <ResultView
              profile={result.profile}
              scores={result.scores}
              onRestart={reset}
              onClose={() => handleOpenChange(false)}
              onStartNow={onStartNow}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultView({
  profile,
  scores,
  onRestart,
  onClose,
  onStartNow,
}: {
  profile: QuizProfile;
  scores: Record<QuizProfile, number>;
  onRestart: () => void;
  onClose: () => void;
  onStartNow?: () => void;
}) {
  const meta = QUIZ_PROFILE_META[profile];
  const max = Math.max(...Object.values(scores));
  const nav = useNavigate();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "queued">("idle");

  // Salva automaticamente: persiste no banco se logado, senão enfileira em localStorage.
  useEffect(() => {
    let cancelled = false;
    setSaveState("saving");
    const payload = {
      cognitive_profile: quizToDbProfile(profile),
      profile_scores: Object.fromEntries(
        Object.entries(scores).map(([k, v]) => [quizToDbProfile(k as QuizProfile), v]),
      ),
    };
    persistOrQueueProfile(payload).then((r) => {
      if (cancelled) return;
      setSaveState(r);
    });
    return () => {
      cancelled = true;
    };
  }, [profile, scores]);





  return (
    <div>
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/15">
          <img src={PROFILE_ICONS[profile]} alt={meta.name} className="w-12 h-12 object-contain" />
        </div>
        <p className="mt-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Seu perfil é
        </p>
        <h2 className="mt-1 text-3xl font-extrabold text-accent sm:text-4xl">
          {meta.name}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-foreground">
          {meta.description}
        </p>
      </div>

      <div className="mt-8 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Como você se distribui
        </p>
        {Object.entries(scores)
          .sort((a, b) => b[1] - a[1])
          .map(([p, s]) => {
            const m = QUIZ_PROFILE_META[p as QuizProfile];
            const pct = max > 0 ? (s / max) * 100 : 0;
            const isTop = p === profile;
            return (
              <div key={p} className="flex items-center gap-3">
                <span className="w-44 flex-shrink-0 flex items-center gap-2 text-sm font-bold">
                  <img src={PROFILE_ICONS[p as QuizProfile]} alt={m.name} className="w-5 h-5 object-contain flex-shrink-0" />
                  {m.name.replace("O ", "")}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isTop ? "var(--accent)" : "var(--primary)",
                      opacity: isTop ? 1 : 0.5,
                    }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-extrabold tabular-nums">
                  {s}
                </span>
              </div>
            );
          })}
      </div>

      <div className="mt-8 flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">
        <button onClick={onRestart} className="btn-3d-ghost">
          Refazer
        </button>
        <button
          onClick={() => {
            onClose();
            if (onStartNow) onStartNow();
            else nav({ to: "/home" });
          }}
          className="btn-3d btn-3d-accent"
        >
          Ir para a Home →
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {saveState === "saved"
          ? "✓ Perfil salvo no seu painel."
          : saveState === "queued"
            ? "Seu perfil ficará salvo após o login."
            : "Guardando seu resultado…"}
      </p>
    </div>
  );
}

// Silence unused import warning for DialogDescription if dropped later
void DialogDescription;

function LeadField({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  maxLength,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-extrabold text-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className="h-12 w-full rounded-full border-2 border-border bg-white px-5 text-base font-semibold text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
      />
      {error && (
        <p className="mt-1 text-xs font-bold text-destructive">{error}</p>
      )}
    </div>
  );
}