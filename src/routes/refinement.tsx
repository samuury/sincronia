import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Minus, Plus, Play, Mic, AudioLines, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createSession, upsertProfile, getSession, updateSessionRoute, confirmSessionCreation } from "@/lib/sessions.functions";
import { generateStudyRoute, extractMaterial, suggestStudyTime } from "@/lib/ai.functions";
import { PROFILE_LABEL, type Profile } from "@/lib/profiles";
import logo from "@/assets/logo-sincronia.png";

import { z } from "zod";

export const Route = createFileRoute("/refinement")({
  validateSearch: z.object({
    sessionId: z.string().optional(),
  }),
  head: () => ({ meta: [{ title: "Refinamento do Plano de Estudo — SincronIA" }] }),
  component: Refinement,
});

type Pending = {
  text: string;
  topic: string;
  profile: Profile;
  scores: Record<string, number>;
};

const MOTIVOS = [
  { value: "prova", label: "Prova" },
  { value: "curiosidade", label: "Curiosidade" },
  { value: "trabalho", label: "Trabalho" },
  { value: "reforco", label: "Reforço de conteúdo" },
  { value: "outros", label: "Outros" },
] as const;

function Refinement() {
  const nav = useNavigate();
  const [pending, setPending] = useState<Pending | null>(null);
  const [topic, setTopic] = useState("");
  const [motivo, setMotivo] = useState<string>("prova");
  const [motivoOutro, setMotivoOutro] = useState("");
  const [days, setDays] = useState<number | "">(30);
  const [saving, setSaving] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const [routeData, setRouteData] = useState<{ suggestedTime: number; summary: string; chapters: string[] } | null>(null);
  const [initialSuggestedTime, setInitialSuggestedTime] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [generatingRoute, setGeneratingRoute] = useState(false);
  const [didInitialGen, setDidInitialGen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { sessionId } = Route.useSearch();
  const getSess = useServerFn(getSession);
  const createS = useServerFn(createSession);
  const updateRoute = useServerFn(updateSessionRoute);
  const confirmSess = useServerFn(confirmSessionCreation);
  const upsert = useServerFn(upsertProfile);
  const genRoute = useServerFn(generateStudyRoute);
  const suggestTime = useServerFn(suggestStudyTime);
  const extract = useServerFn(extractMaterial);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Faça login para continuar.");
        nav({ to: "/home" });
        return;
      }
      
      if (sessionId) {
        try {
          const res = await getSess({ data: { id: sessionId } });
          if (res.session) {
            setTopic(res.session.topic);
            if ((res.session as any).route_data) {
              setRouteData((res.session as any).route_data as any);
              setDays(((res.session as any).route_data as any).suggestedTime || 30);
              setInitialSuggestedTime(((res.session as any).route_data as any).suggestedTime || null);
              setDidInitialGen(true);
            }
            setPending({
              topic: res.session.topic,
              text: res.session.material_text || "",
              profile: res.session.profile_used as Profile,
              scores: {},
            });
          }
        } catch (err) {
          toast.error("Erro ao carregar sessão");
          nav({ to: "/home" });
        }
        return;
      }

      const raw = sessionStorage.getItem("sincronia:pending");
      if (!raw) {
        nav({ to: "/home" });
        return;
      }
      try {
        const p = JSON.parse(raw) as Pending;
        setPending(p);
        setTopic(p.topic ?? "");
      } catch {
        nav({ to: "/home" });
      }
    };
    checkSession();
  }, [nav, sessionId]);

  async function suggestInitialTime() {
    if (!pending) return;
    setGeneratingRoute(true);
    try {
      const finalMotivo = motivo === "outros" ? motivoOutro.trim() || "outros" : motivo;
      const r = await suggestTime({
        data: {
          materialText: pending.text ?? "",
          topic: topic.trim() || pending.topic || "Material",
          motivo: finalMotivo,
        }
      });
      setDays(r.suggestedTime);
      setInitialSuggestedTime(r.suggestedTime);
    } catch (e: any) {
      console.error(e);
    } finally {
      setGeneratingRoute(false);
    }
  }

  useEffect(() => {
    if (pending && !didInitialGen) {
      setDidInitialGen(true);
      suggestInitialTime(); // Chama a nova função ultra-rápida no Claude Haiku
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  async function readFile(f: File): Promise<{ b64: string; mime: string }> {
    const buf = await f.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { b64: btoa(bin), mime: f.type || "application/octet-stream" };
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.info("Extraindo texto do arquivo...");
    try {
      let r: { text: string; topic: string };
      if (
        file.type.startsWith("text/") ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".txt")
      ) {
        const raw = await file.text();
        r = await extract({ data: { text: raw } });
      } else {
        const { b64, mime } = await readFile(file);
        r = await extract({ data: { fileBase64: b64, mimeType: mime } });
      }
      
      if (pending) {
        setPending({ ...pending, text: pending.text + "\n\n--- Conteúdo Adicional ---\n\n" + r.text });
      }
      setRouteData(null); // Force regenerate
      toast.success("Arquivo adicionado com sucesso! Um novo roteiro será gerado.");
    } catch (err: any) {
      toast.error("Erro ao extrair arquivo.");
    }
  }

  function handleMic() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Seu navegador não suporta reconhecimento de voz.");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
      toast.info("Ouvindo...");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setChatInput((prev) => prev ? prev + " " + transcript : transcript);
      setRouteData(null);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error", event.error);
      toast.error("Erro na voz: " + event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  }

  async function generateRoute(silent = false, overrideMotivo?: string, forceSuggest = false) {
    if (!pending) return;
    setGeneratingRoute(true);
    try {
      const currentMotivo = overrideMotivo ?? motivo;
      const finalMotivo = currentMotivo === "outros" ? motivoOutro.trim() || "outros" : currentMotivo;
      const r = await genRoute({
        data: {
          materialText: pending.text ?? "",
          topic: topic.trim() || pending.topic || "Material",
          profile: pending.profile,
          motivo: finalMotivo,
          chatNote: chatInput.trim() || null,
          targetMinutes: forceSuggest ? undefined : (typeof days === "number" ? days : undefined),
        }
      });
      setRouteData(r);
      if (forceSuggest) setDays(r.suggestedTime); // Só altera o tempo da tela se for a sugestão inicial
      
      if (sessionId) {
        await updateRoute({ data: { session_id: sessionId, topic: topic.trim() || pending.topic, route_data: r } });
      } else {
        const sessData = await createS({
          data: {
            topic: (topic.trim() || pending.topic).slice(0, 120),
            material_text: pending.text,
            profile_used: pending.profile,
            status: "planning",
            route_data: r,
          }
        });
        nav({ search: { sessionId: sessData.id } as any, replace: true });
      }

      if (!silent) setShowModal(true);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar roteiro.");
    } finally {
      setGeneratingRoute(false);
    }
  }

  async function startGo() {
    if (!pending) return;
    if (!topic.trim()) {
      toast.error("Informe o tema.");
      return;
    }
    if (days === "" || Number(days) <= 0) {
      toast.error("O tempo de estudo deve ser maior que zero.");
      return;
    }
    setSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      
      const finalMotivo =
        motivo === "outros" ? motivoOutro.trim() || "outros" : motivo;
      sessionStorage.setItem(
        "sincronia:plan",
        JSON.stringify({
          motivo: finalMotivo,
          minutes: days, // pode ter sido alterado pelo aluno após a sugestão da IA
          chatNote: chatInput.trim() || null,
          chapters: routeData?.chapters,
        }),
      );
      sessionStorage.setItem(
        "sincronia:pending",
        JSON.stringify({ ...pending, topic }),
      );

      if (!sess.session) {
        nav({ to: "/estudos" });
        return;
      }

      if (sessionId) {
        await confirmSess({ data: { session_id: sessionId, topic: topic.trim().slice(0, 120) } });
        nav({ to: "/session/$id", params: { id: sessionId } });
      } else {
        const sessData = await createS({
          data: {
            topic: topic.trim().slice(0, 120),
            material_text: pending.text,
            profile_used: pending.profile,
            status: "created",
            route_data: routeData,
          },
        });
        nav({ to: "/session/$id", params: { id: sessData.id } });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao iniciar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/home" className="flex items-center gap-2">
          <img src={logo} alt="SincronIA" className="h-16 w-auto" />
        </Link>
        <Link to="/home" className="text-sm font-bold text-muted-foreground hover:text-primary">
          Início
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-6">
        <h1 className="text-center text-3xl font-extrabold text-accent md:text-4xl">
          Refinamento do Plano de Estudo
        </h1>

        {pending && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Perfil detectado:{" "}
            <strong className="text-foreground">
              {PROFILE_LABEL[pending.profile]}
            </strong>
          </p>
        )}

        <div className="mt-10 space-y-8 rounded-3xl border-2 border-border bg-card p-6 shadow-[0_6px_0_0_var(--border)] md:p-8">
          {/* Tema */}
          <div className="grid items-start gap-4 md:grid-cols-[180px_1fr]">
            <label className="text-xl font-extrabold">Vamos estudar</label>
            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Tema
              </p>
              <input
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setRouteData(null);
                }}
                placeholder="Ex.: Equação do 2º grau"
                className="w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="grid items-start gap-4 md:grid-cols-[180px_1fr]">
            <label className="text-xl font-extrabold">Motivo</label>
            <div>
              <p className="mb-2 text-sm font-bold text-foreground">
                Escolha apenas 1 motivo
              </p>
              <select
                value={motivo}
                onChange={(e) => {
                  const val = e.target.value;
                  setMotivo(val);
                  setRouteData(null);
                }}
                className="w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {MOTIVOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {motivo === "outros" && (
                <input
                  value={motivoOutro}
                  onChange={(e) => {
                    setMotivoOutro(e.target.value);
                    setRouteData(null);
                  }}
                  onBlur={() => {
                    // Removido auto-generateRoute no onBlur
                  }}
                  placeholder="Escreva seu motivo"
                  className="mt-3 w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
            </div>
          </div>

          {/* Sugestão de tempo */}
          <div className="grid items-start gap-4 md:grid-cols-[180px_1fr]">
            <label className="text-xl font-extrabold">Sugestão de tempo</label>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                {/* Horas */}
                <div className="flex items-baseline gap-1 rounded-xl border-2 border-border bg-white px-4 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={days === "" ? "" : Math.floor(Number(days) / 60)}
                    onChange={(e) => {
                      const h = Number(e.target.value) || 0;
                      const m = days === "" ? 0 : Number(days) % 60;
                      setDays(h * 60 + m);
                      setRouteData(null);
                    }}
                    className="w-12 text-center text-xl font-extrabold bg-transparent focus:outline-none"
                  />
                  <span className="text-sm font-extrabold text-muted-foreground">h</span>
                </div>
                
                {/* Minutos */}
                <div className="flex items-baseline gap-1 rounded-xl border-2 border-border bg-white px-4 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={days === "" ? "" : Number(days) % 60}
                    onChange={(e) => {
                      const h = days === "" ? 0 : Math.floor(Number(days) / 60);
                      const m = Number(e.target.value) || 0;
                      setDays(h * 60 + m);
                      setRouteData(null);
                    }}
                    className="w-12 text-center text-xl font-extrabold bg-transparent focus:outline-none"
                  />
                  <span className="text-sm font-extrabold text-muted-foreground">min</span>
                </div>

                {/* Botão de escolher (Select) */}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setDays(Number(e.target.value));
                      setRouteData(null);
                    }
                  }}
                  className="h-[52px] cursor-pointer rounded-xl border-2 border-border bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-secondary focus:border-primary focus:outline-none"
                >
                  <option value="" disabled>Escolher rápido...</option>
                  <option value="2">2 minutos</option>
                  <option value="5">5 minutos</option>
                  <option value="15">15 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="45">45 minutos</option>
                  <option value="60">1 hora</option>
                  <option value="90">1h 30min</option>
                  <option value="120">2 horas</option>
                  <option value="180">3 horas</option>
                </select>
              </div>
              {days === 0 && (
                <p className="mt-2 text-xs font-bold text-destructive">
                  O tempo deve ser maior que zero para iniciar.
                </p>
              )}
              {generatingRoute ? (
                <div className="mt-3 flex w-fit items-center gap-2 rounded-xl border-2 border-muted bg-muted/20 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"></div>
                  Recalculando tempo...
                </div>
              ) : initialSuggestedTime ? (
                <div className="mt-3 flex w-fit items-center gap-2 rounded-xl border-2 border-accent/20 bg-accent/5 px-3 py-1.5 text-xs font-bold text-accent">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-white">✨</span>
                  A IA sugeriu {(() => {
                    const h = Math.floor(initialSuggestedTime / 60);
                    const m = initialSuggestedTime % 60;
                    if (h > 0 && m > 0) return `${h} h e ${m} min`;
                    if (h > 0) return `${h} h`;
                    return `${m} min`;
                  })()}
                </div>
              ) : null}
            </div>
          </div>

          {/* Conversar com a IA (opcional) */}
          <div className="grid items-start gap-4 md:grid-cols-[180px_1fr]">
            <label className="text-xl font-extrabold">Sua Sincronia (opcional)</label>
            <div>
              <div className="flex flex-col gap-3 rounded-3xl border border-border bg-white px-5 py-4 shadow-sm focus-within:ring-2 focus-within:ring-primary">
                <textarea
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    setRouteData(null);
                  }}
                  placeholder={`Entendi que você quer estudar ${topic || 'este tema'}. Especifique o que você quer estudar para melhorar o roteiro (opcional)`}
                  rows={2}
                  className="w-full resize-none bg-transparent px-1 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    aria-label="Adicionar"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-secondary"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.txt,.md,image/*"
                    className="hidden"
                    onChange={handleFile}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleMic}
                      aria-label="Ditar"
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${isRecording ? 'bg-destructive text-white animate-pulse' : 'text-foreground hover:bg-secondary'}`}
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Voz"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-secondary opacity-50 cursor-not-allowed"
                    >
                      <AudioLines className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-end">
          <button
            type="button"
            onClick={() => routeData ? setShowModal(true) : generateRoute(false)}
            disabled={generatingRoute || saving}
            aria-label="Gerar Roteiro"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_0_0_var(--border)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none disabled:opacity-60"
          >
            {generatingRoute ? <Loader2 className="h-10 w-10 animate-spin" /> : <Play className="h-10 w-10 fill-current ml-2" />}
          </button>
          <span className="mt-2 text-lg font-extrabold">
            {generatingRoute ? "Planejando…" : "Ver Roteiro"}
          </span>
        </div>
      </main>

      {/* Modal Resumo Roteiro */}
      {showModal && routeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border-2 border-border bg-card p-6 shadow-[0_8px_0_0_var(--border)] animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {generatingRoute ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="font-extrabold text-accent">Recalculando seu roteiro...</p>
                <p className="text-sm text-muted-foreground mt-2">Aplicando seus ajustes.</p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-extrabold text-accent">Resumo do Roteiro</h2>
                <p className="mt-3 text-sm text-foreground/85 leading-relaxed font-semibold">
                  {routeData.summary}
                </p>
                
                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Tópicos que veremos</p>
                  <ul className="space-y-3">
                    {routeData.chapters.map((ch, i) => (
                      <li key={i} className="text-sm font-bold flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs">
                          {i + 1}
                        </span>
                        <span className="mt-0.5">{ch}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-sm font-bold text-foreground mb-2">
                    Este roteiro está adequado para o que você precisa? Deseja alguma alteração na ordem, ênfase ou tópicos?
                  </p>
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ex: Focar mais no tópico 2, alterar a ordem..."
                    className="w-full resize-none rounded-xl border-2 border-border bg-transparent p-3 text-sm font-semibold focus:outline-none focus:border-primary"
                    rows={2}
                  />
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setShowModal(false)}
                      className="btn-3d-ghost w-full"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={() => generateRoute(true)}
                      disabled={!chatInput.trim()}
                      className="btn-3d btn-3d-accent w-full"
                    >
                      Ajustar roteiro
                    </button>
                  </div>
                  <button
                    onClick={startGo}
                    disabled={saving}
                    className="btn-3d btn-3d-primary w-full"
                  >
                    {saving ? "Gerando..." : "Está ótimo, pode começar!"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}