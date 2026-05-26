import React, { useState, useEffect } from "react";
import { Headphones, RefreshCw, Minimize2, Brain, Undo2, Redo2, Timer, Play, Pause } from "lucide-react";

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
    <aside className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 md:flex-col md:overflow-visible md:pb-0 md:sticky md:top-6 -mx-6 px-6 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
      
      <PomodoroTimer />

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

function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: any;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      alert("Tempo de foco encerrado! Descanse 5 minutinhos.");
      setTimeLeft(25 * 60);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const toggle = () => setIsRunning(!isRunning);
  
  const m = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const s = (timeLeft % 60).toString().padStart(2, "0");

  const className =
    "flex-shrink-0 snap-start w-[140px] md:w-auto flex h-[96px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-accent/60 bg-card px-3 py-3 text-center font-extrabold text-accent shadow-[0_4px_0_0_var(--accent-shadow)] transition-transform hover:scale-[1.02] hover:border-accent active:translate-y-1 active:shadow-none";

  return (
    <button type="button" className={className} onClick={toggle}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {isRunning ? "Pausar" : "Focar"}
      </div>
      <div className="text-2xl tabular-nums tracking-wider leading-none">{m}:{s}</div>
    </button>
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
    "flex-shrink-0 snap-start w-[140px] md:w-auto flex h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-accent/60 bg-card px-3 py-3 text-center text-xs font-extrabold leading-tight text-accent shadow-[0_4px_0_0_var(--accent-shadow)] transition-transform hover:scale-[1.02] hover:border-accent active:translate-y-1 active:shadow-none";
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
