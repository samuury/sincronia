import React from "react";
import { Headphones, RefreshCw, Minimize2, Brain, Undo2, Redo2 } from "lucide-react";

export function StudySidebar({
  onRegenerate,
  onReduce,
  onChangeProfile,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
}: {
  onRegenerate: () => void;
  onReduce?: () => void;
  onChangeProfile: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
}) {
  return (
    <aside className="flex flex-col gap-3 md:sticky md:top-6">
      <SideButton
        icon={<RefreshCw className="h-5 w-5" />}
        label="Me explica de novo"
        onClick={onRegenerate}
      />
      <SideButton
        icon={<Minimize2 className="h-5 w-5" />}
        label="Reduza o conteúdo"
        onClick={onReduce}
      />
      <SideButton
        as="a"
        href="https://open.spotify.com/genre/0JQ5DAqbMKFCbimwdOYlsl"
        icon={<Headphones className="h-5 w-5" />}
        label="Evite distração"
      />
      <SideButton
        icon={<Brain className="h-5 w-5" />}
        label="Mudar forma de aprender"
        onClick={onChangeProfile}
      />
      {canUndo && onUndo && (
        <SideButton
          icon={<Undo2 className="h-5 w-5" />}
          label="Desfazer alteração"
          onClick={onUndo}
        />
      )}
      {canRedo && onRedo && (
        <SideButton
          icon={<Redo2 className="h-5 w-5" />}
          label="Refazer alteração"
          onClick={onRedo}
        />
      )}
    </aside>
  );
}

function SideButton({
  icon,
  label,
  as,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  as?: "a";
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "flex h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-accent/60 bg-card px-3 py-3 text-center text-xs font-extrabold leading-tight text-accent shadow-[0_4px_0_0_var(--accent-shadow)] transition-transform hover:scale-[1.02] hover:border-accent active:translate-y-1 active:shadow-none";
  if (as === "a") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {icon}
        {label}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}
