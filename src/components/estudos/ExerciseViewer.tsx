import React from "react";
import { ArrowLeft, ArrowRight, Trophy, CheckCircle2, XCircle } from "lucide-react";
import { RichText } from "./RichText";

export type Exercise = {
  q: string;
  options: string[];
  answer: number;
  why: string;
};

export function ExerciseViewer({
  exercises,
  exIndex,
  setExIndex,
  selected,
  setSelected,
  answered,
  onConfirm,
  onNext,
  onFinish,
  finished,
  correctCount,
}: {
  exercises: Exercise[];
  exIndex: number;
  setExIndex: React.Dispatch<React.SetStateAction<number>>;
  selected: number | null;
  setSelected: (s: number | null) => void;
  answered: boolean[];
  onConfirm: () => void;
  onNext: () => void;
  onFinish: () => void;
  finished: boolean;
  correctCount: number;
}) {
  const ex = exercises[exIndex];
  if (!ex) return null;

  const isAnswered = answered[exIndex];
  const isCorrect = isAnswered && selected === ex.answer;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-accent">
          Prática ({exIndex + 1}/{exercises.length})
        </h2>
      </div>
      <article className="rounded-3xl border-2 border-border bg-card p-6 shadow-[0_4px_0_0_var(--border)] animate-in fade-in slide-in-from-right-4 duration-300">
        <p className="font-extrabold text-foreground">
          <RichText content={ex.q} />
        </p>
        <div className="mt-4 space-y-3">
          {ex.options.map((opt, oi) => {
            let className =
              "w-full rounded-2xl border-2 px-5 py-3 text-left font-bold transition-all ";
            
            if (!isAnswered) {
              const isSelected = selected === oi;
              className += isSelected
                ? "border-primary bg-primary/10 text-primary shadow-[0_4px_0_0_var(--primary-shadow)] active:translate-y-1 active:shadow-none"
                : "border-border bg-white text-foreground shadow-[0_4px_0_0_var(--border)] hover:bg-secondary active:translate-y-1 active:shadow-none";
            } else {
              const isRightOption = oi === ex.answer;
              const isWrongSelected = selected === oi && !isRightOption;
              if (isRightOption) {
                className += "border-success bg-success/10 text-success shadow-[0_4px_0_0_var(--success-shadow)]";
              } else if (isWrongSelected) {
                className += "border-destructive bg-destructive/10 text-destructive shadow-[0_4px_0_0_var(--destructive-shadow)]";
              } else {
                className += "border-border/50 bg-secondary/50 text-muted-foreground opacity-60";
              }
            }

            return (
              <button
                key={oi}
                disabled={isAnswered}
                onClick={() => setSelected(oi)}
                className={className}
              >
                <div className="flex items-center justify-between">
                  <span>{opt}</span>
                  {isAnswered && oi === ex.answer && (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  )}
                  {isAnswered && selected === oi && oi !== ex.answer && (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div
            className={
              "mt-6 rounded-2xl border-2 p-5 animate-in slide-in-from-top-2 " +
              (isCorrect
                ? "border-success/40 bg-success/10"
                : "border-destructive/40 bg-destructive/10")
            }
          >
            <p className="text-sm font-extrabold uppercase tracking-wide">
              {isCorrect ? "Correto!" : "Quase lá"}
            </p>
            <p className="mt-1 text-sm text-foreground/85">
              <RichText content={ex.why} />
            </p>
          </div>
        )}
      </article>

      <div className="mt-6 grid grid-cols-[1fr_1.6fr] gap-4">
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setExIndex((i) => Math.max(0, i - 1));
          }}
          disabled={exIndex === 0}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card font-extrabold shadow-[0_4px_0_0_var(--border)] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Anterior
        </button>
        
        {!isAnswered ? (
          <button
            type="button"
            onClick={onConfirm}
            disabled={selected === null}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary font-extrabold text-primary-foreground shadow-[0_4px_0_0_var(--primary-shadow)] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-40"
          >
            Confirmar resposta
          </button>
        ) : exIndex < exercises.length - 1 ? (
          <button
            type="button"
            onClick={onNext}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-accent bg-accent font-extrabold text-accent-foreground shadow-[0_4px_0_0_var(--accent-shadow)] transition-transform active:translate-y-1 active:shadow-none"
          >
            Próximo exercício <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onFinish}
            disabled={!finished}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-accent bg-accent font-extrabold text-accent-foreground shadow-[0_4px_0_0_var(--accent-shadow)] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-40"
          >
            <Trophy className="h-4 w-4" /> Concluir ({correctCount}/
            {exercises.length})
          </button>
        )}
      </div>
    </>
  );
}
