import React from "react";
import { RichText } from "./RichText";

export type Chapter = { title: string; subtitle?: string; body: string };

export function ChapterViewer({
  current,
  chapterIndex,
  totalChapters,
  summary,
}: {
  current: Chapter;
  chapterIndex: number;
  totalChapters: number;
  summary?: string;
}) {
  return (
    <article
      key={chapterIndex}
      className="estudos-scroll mt-6 h-[640px] overflow-y-auto rounded-3xl border-2 border-border bg-card p-8 shadow-[0_6px_0_0_var(--border)]"
    >
      <div className="sticky -top-8 -mx-8 -mt-8 mb-6 border-b border-border bg-card/95 px-8 pb-4 pt-6 backdrop-blur z-10">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Capítulo {chapterIndex + 1} de {totalChapters}
        </p>
        <h2 className="mt-1 text-2xl font-extrabold md:text-3xl">
          {current?.title}
        </h2>
        {current?.subtitle && (
          <p className="mt-1 text-sm font-bold text-muted-foreground">
            {current.subtitle}
          </p>
        )}
      </div>
      <div className="mt-6 whitespace-pre-wrap leading-relaxed text-foreground/85">
        <RichText content={current?.body ?? ""} />
      </div>
      {chapterIndex === totalChapters - 1 && summary && (
        <div className="mt-8 rounded-2xl border-2 border-accent/40 bg-accent/5 p-5">
          <p className="text-xs font-extrabold uppercase tracking-wider text-accent">
            Em resumo
          </p>
          <p className="mt-2 leading-relaxed text-foreground/85">
            <RichText content={summary} />
          </p>
        </div>
      )}
    </article>
  );
}
