import React from "react";

type Quiz = { questions: { q: string; options: string[]; answer: number; why: string }[] };

export function DiagnosticQuiz({
  title,
  quiz,
  answers,
  setAnswers,
  onSubmit,
  busy,
  ctaLabel,
}: {
  title: string;
  quiz: Quiz;
  answers: number[];
  setAnswers: (a: number[]) => void;
  onSubmit: () => void;
  busy: boolean;
  ctaLabel: string;
}) {
  const allAnswered = answers.every((a) => a >= 0);
  return (
    <section className="mt-6">
      <h2 className="text-2xl font-extrabold text-accent text-center">{title}</h2>
      <div className="mt-6 space-y-6">
        {quiz.questions.map((q, qi) => (
          <div key={qi} className="rounded-3xl border-2 border-border bg-card p-6 shadow-[0_4px_0_0_var(--border)]">
            <p className="font-extrabold text-foreground">
              {qi + 1}. {q.q}
            </p>
            <div className="mt-4 space-y-3">
              {q.options.map((opt, oi) => {
                const selected = answers[qi] === oi;
                return (
                  <button
                    key={oi}
                    onClick={() => {
                      const next = [...answers];
                      next[qi] = oi;
                      setAnswers(next);
                    }}
                    className={
                      "w-full rounded-2xl border-2 px-5 py-3 text-left font-bold transition-all active:translate-y-1 active:shadow-none " +
                      (selected
                        ? "border-primary bg-primary/10 text-primary shadow-[0_4px_0_0_var(--primary-shadow)]"
                        : "border-border bg-white text-foreground shadow-[0_4px_0_0_var(--border)] hover:bg-secondary")
                    }
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button
        disabled={!allAnswered || busy}
        onClick={onSubmit}
        className="btn-3d btn-3d-primary mt-8 w-full"
      >
        {busy ? ctaLabel + "..." : ctaLabel}
      </button>
    </section>
  );
}
