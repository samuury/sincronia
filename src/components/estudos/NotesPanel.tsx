import React, { useRef, useCallback, useState, useEffect } from "react";
import { X, PanelRightClose, PanelRightOpen, Save, Loader2, PenLine } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { saveUserNotes } from "@/lib/sessions.functions";

interface NotesPanelProps {
  sessionId: string;
  content: string;
  onContentChange: (val: string) => void;
  mode: "popup" | "docked";
  onModeChange: (mode: "popup" | "docked" | "closed") => void;
}

export function NotesPanel({ sessionId, content, onContentChange, mode, onModeChange }: NotesPanelProps) {
  const [saving, setSaving] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 280, y: 120 });
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    if (mode !== "popup") return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragRef.current) return;

      const deltaX = event.clientX - dragRef.current.startX;
      const deltaY = event.clientY - dragRef.current.startY;

      setPopupPosition({
        x: Math.min(Math.max(dragRef.current.originX + deltaX, 16), window.innerWidth - 420),
        y: Math.min(Math.max(dragRef.current.originY + deltaY, 16), window.innerHeight - 320),
      });
    };

    const handlePointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [mode]);

  const saveUN = useServerFn(saveUserNotes);

  const saveContent = useCallback(async (textToSave: string) => {
    try {
      setSaving(true);
      await saveUN({ data: { session_id: sessionId, content: textToSave } });
    } catch (err) {
      console.error("Erro ao salvar anotações:", err);
    } finally {
      setSaving(false);
    }
  }, [sessionId, saveUN]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onContentChange(val);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveContent(val);
    }, 1500); // Autosave 1.5 seconds after typing stops
  };

  const handleForceSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveContent(content);
  };

  const handleHeaderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "popup") return;

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: popupPosition.x,
      originY: popupPosition.y,
    };
  };

  const header = (
    <div
      className="flex cursor-grab items-center justify-between border-b-2 border-border p-4 bg-secondary/30 rounded-t-2xl active:cursor-grabbing"
      onPointerDown={handleHeaderPointerDown}
    >
      <div className="flex items-center gap-2 text-accent">
        <PenLine className="h-5 w-5" />
        <h3 className="font-extrabold text-foreground">Anotações</h3>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-2" />}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={handleForceSave}
          title="Salvar"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
        >
          <Save className="h-4 w-4" />
        </button>
        <button
          onClick={() => onModeChange(mode === "docked" ? "popup" : "docked")}
          title={mode === "docked" ? "Desacoplar (Flutuante)" : "Acoplar na lateral"}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
        >
          {mode === "docked" ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
        <button
          onClick={() => onModeChange("closed")}
          title="Fechar"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const body = (
    <div className="flex-1 p-4 flex flex-col bg-card rounded-b-2xl">
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Escreva suas anotações aqui... Tudo será salvo automaticamente."
        className="flex-1 w-full resize-none border-0 bg-transparent text-foreground p-0 focus:outline-none focus:ring-0 leading-relaxed font-medium placeholder:text-muted-foreground/50"
      />
    </div>
  );

  if (mode === "docked") {
    return (
      <div className="sticky top-6 flex flex-col h-[calc(100vh-6rem)] border-2 border-border rounded-2xl shadow-[0_4px_0_0_var(--border)] overflow-hidden">
        {header}
        {body}
      </div>
    );
  }

  // Popup Mode
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: popupPosition.x, top: popupPosition.y, width: "min(42rem, calc(100vw - 2rem))" }}
    >
      <div className="pointer-events-auto h-[600px] flex flex-col rounded-3xl border-2 border-border bg-card shadow-[0_8px_0_0_var(--border)] overflow-hidden animate-in zoom-in-95 duration-200">
        {header}
        {body}
      </div>
    </div>
  );
}
