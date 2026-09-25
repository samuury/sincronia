import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader2, FastForward } from "lucide-react";
import { RichText } from "./RichText";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export function SocraticDialogue({
  sessionId,
  chapterIndex,
  chapterHeading,
  topic,
  onComplete,
}: {
  sessionId: string;
  chapterIndex: number;
  chapterHeading: string;
  topic: string;
  onComplete: () => void;
}) {
  const storageKey = `sincronia:socratic-dialog:${sessionId}:${chapterIndex}`;

  const sanitizeStoredMessages = (messages: unknown): Message[] => {
    if (!Array.isArray(messages)) return [];
    return messages.filter((msg): msg is Message => {
      return !!msg && typeof msg === "object" && typeof (msg as Message).role === "string" && typeof (msg as Message).content === "string" && (msg as Message).content.trim().length > 0;
    });
  };

  const readStoredState = (): { started: boolean; messages: Message[] } => {
    if (typeof window === "undefined") return { started: false, messages: [] };
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return { started: false, messages: [] };
      const parsed = JSON.parse(raw);
      return {
        started: Boolean(parsed?.started),
        messages: sanitizeStoredMessages(parsed?.messages),
      };
    } catch {
      return { started: false, messages: [] };
    }
  };

  const persistState = (nextMessages: Message[], started = true) => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(storageKey, JSON.stringify({ started, messages: nextMessages }));
  };

  const [messages, setMessages] = useState<Message[]>(() => readStoredState().messages);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(readStoredState().started);

  useEffect(() => {
    if (messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const storedState = readStoredState();

    if (hasStartedRef.current) {
      if (messages.length === 0 && storedState.messages.length > 0) {
        setMessages(storedState.messages);
      }
      return;
    }

    if (storedState.started) {
      hasStartedRef.current = true;
      if (storedState.messages.length > 0) {
        setMessages(storedState.messages);
      } else {
        setMessages([{ role: "assistant", content: "Pensando..." }]);
      }
      return;
    }

    hasStartedRef.current = true;
    const loadingMessage = [{ role: "assistant", content: "Pensando..." }];
    setMessages(loadingMessage);
    persistState(loadingMessage, true);
    triggerSocratic([
      { role: "user", content: "Inicie o diálogo socrático sobre este capítulo com uma pergunta provocativa." }
    ]);
  }, [chapterHeading, storageKey]);

  const triggerSocratic = async (msgs: Message[]) => {
    setIsGenerating(true);
    setMessages((prev) => {
      const next = [...prev, { role: "assistant", content: "" }];
      persistState(next, true);
      return next;
    });

    try {
      const response = await fetch("/api/stream-socratic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          chapterHeading,
          messages: msgs,
          systemPrompt: `Você é um Tutor Socrático. O aluno acabou de ler o capítulo "${chapterHeading}" sobre o tema "${topic}".\nFaça UMA única pergunta provocativa e aberta que o faça pensar criticamente sobre o que acabou de ler.\nQuando ele responder, avalie a resposta. Se for rasa, provoque com um "Mas e se...?". Se for boa, valide o raciocínio e parabenize-o.\nMantenha suas falas curtas e diretas. Não dê a resposta pronta, guie o aluno.`
        }),
      });

      if (!response.body) throw new Error("Sem corpo na resposta");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let text = "";
      let buffer = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }
        
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || ""; // mantém o último pedaço incompleto
        
        for (const ev of parts) {
          if (ev.trim() === '') continue;
          
          if (ev.includes('event: content_block_delta')) {
            const dataLine = ev.split('\n').find(l => l.startsWith('data: '));
            if (dataLine) {
              try {
                const data = JSON.parse(dataLine.replace('data: ', ''));
                if (data.delta && data.delta.text) {
                  text += data.delta.text;
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1].content = text;
                    persistState(newMsgs, true);
                    return newMsgs;
                  });
                }
              } catch (e) {
                console.error("Erro no parse do chunk JSON:", dataLine);
              }
            }
          } else if (ev.includes('event: error')) {
             console.error("Erro da API:", ev);
          }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => {
        const newMsgs = [...prev];
        const message = "Ocorreu um erro ao gerar a reflexão. Você pode tentar novamente ou avançar.";
        newMsgs[newMsgs.length - 1].content = message;
        persistState(newMsgs, true);
        return newMsgs;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    
    const newMsgs: Message[] = [...messages, { role: "user", content: input }];
    setMessages(newMsgs);
    persistState(newMsgs, true);
    setInput("");
    triggerSocratic(newMsgs);
  };

  return (
    <div className="mt-8 rounded-3xl border-2 border-accent/30 bg-accent/5 p-6 shadow-sm mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h3 className="font-extrabold text-accent">Reflexão Socrática</h3>
        </div>
        <button
          onClick={onComplete}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          Pular <FastForward className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 mb-4 max-h-[300px] overflow-y-auto pr-2 estudos-scroll">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-card border-2 border-border text-foreground"
              }`}
            >
              {msg.role === "assistant" ? (
                <RichText content={msg.content} />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {isGenerating && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-card border-2 border-border rounded-2xl p-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Sua resposta para a reflexão..."
          className="flex-1 rounded-xl border-2 border-border bg-card px-4 py-3 text-sm font-medium outline-none transition-colors focus:border-accent"
          disabled={isGenerating}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isGenerating}
          className="flex items-center justify-center rounded-xl bg-accent px-4 text-accent-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      
      {messages.length > 2 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onComplete}
            className="rounded-xl bg-primary px-6 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
          >
            Avançar para o Próximo Capítulo
          </button>
        </div>
      )}
    </div>
  );
}
