import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic } from "lucide-react";
import { extractMaterial } from "@/lib/ai.functions";
import { getPendingProfile } from "@/lib/pending-profile";
import logo from "@/assets/logo-sincronia.png";
import perfilCard from "@/assets/perfil-card.png";
import { ProfileQuizModal } from "@/components/ProfileQuizModal";
import { PROFILE_LABEL, type Profile } from "@/lib/profiles";
import { getHistory, type StudyHistoryItem } from "@/lib/history";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "SincronIA — aprenda do seu jeito" },
      { name: "description", content: "A SincronIA lê seu material e devolve a explicação no seu ritmo." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const nav = useNavigate();
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  
  const [session, setSession] = useState<any>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authName, setAuthName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [quizConcluido, setQuizConcluido] = useState(false);
  const [history, setHistory] = useState<StudyHistoryItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractMaterial);

  // Lê perfil do localStorage sempre que a página abre
  useEffect(() => {
    const pp = getPendingProfile();
    if (pp?.cognitive_profile) {
      setPerfil(pp.cognitive_profile);
      setQuizConcluido(true);
    }
    setHistory(getHistory());

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.user_metadata?.cognitive_profile) {
        const p = session.user.user_metadata.cognitive_profile;
        setPerfil(p === "concreto" ? "concreto_guiado" : p);
        setQuizConcluido(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.user_metadata?.cognitive_profile) {
        const p = session.user.user_metadata.cognitive_profile;
        setPerfil(p === "concreto" ? "concreto_guiado" : p);
        setQuizConcluido(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [quizOpen]);

  function loadHistoryItem(item: StudyHistoryItem) {
    sessionStorage.setItem("sincronia:pending", JSON.stringify(item.pending));
    sessionStorage.setItem("sincronia:estudos:cache", JSON.stringify(item.cache));
    nav({ to: "/estudos" });
  }

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
      setTopic((prev) => prev ? prev + " " + transcript : transcript);
    };

    recognition.onerror = (event: any) => {
      toast.error("Erro no reconhecimento de voz.");
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  }

  async function goContinue() {
    if (!topic.trim() && !file) {
      toast.error("Cole um conteúdo ou anexe um arquivo.");
      return;
    }
    setBusy(true);
    try {
      let r: { text: string; topic: string };
      if (file) {
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
      } else {
        r = await extract({ data: { text: topic } });
      }

      // Pega perfil do state ou do localStorage
      const pp = getPendingProfile();
      const profileToUse = perfil ?? pp?.cognitive_profile ?? "sistematico";
      const scoresToUse = pp?.profile_scores ?? {};

      sessionStorage.setItem(
        "sincronia:pending",
        JSON.stringify({
          text: r.text,
          topic: r.topic,
          profile: profileToUse,
          scores: scoresToUse,
        }),
      );

      if (session) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const currentCount = user.user_metadata?.studies_generated || 0;
          await supabase.auth.updateUser({
            data: { studies_generated: currentCount + 1 }
          });
        }
      }

      nav({ to: "/refinement" });
    } catch (e: any) {
      toast.error(e.message ?? "Não consegui processar o material.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <img src={logo} alt="SincronIA" className="h-20 w-auto" />
        </div>
        <div className="flex items-center gap-4">
          {perfil && (
            <div className="hidden md:block rounded-full border-2 border-accent/40 bg-accent/10 px-4 py-1 text-sm font-bold text-accent">
              {PROFILE_LABEL[perfil]}
            </div>
          )}
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-foreground">
                Olá, {session.user.user_metadata?.full_name || "Estudante"}
              </span>
              <Link to="/dashboard" className="btn-3d btn-3d-primary px-4 py-2 text-sm">
                Meu Painel
              </Link>
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  setSession(null);
                }}
                className="text-xs font-bold text-muted-foreground hover:text-destructive transition-colors"
              >
                Sair
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setLoginOpen(true)}
              className="btn-3d btn-3d-primary px-4 py-2 text-sm"
            >
              Entrar
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16 pt-6">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-accent md:text-5xl">
            Aprender é melhor quando o conteúdo se adapta a você.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Cole um material, mande um PDF ou uma foto da apostila. A SincronIA entende como você aprende e devolve uma explicação no seu ritmo.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border-2 border-border bg-card p-6 shadow-[0_6px_0_0_var(--border)]">
            <h2 className="text-xl font-extrabold text-foreground">
              O que você quer aprender hoje?
            </h2>

            {perfil && (
              <div className="mt-3 rounded-xl bg-accent/10 px-4 py-2 text-sm font-bold text-accent">
                ✓ Perfil {PROFILE_LABEL[perfil]} ativo — a explicação será adaptada para você
              </div>
            )}

            <div className="mt-4 rounded-2xl border-2 border-border bg-white p-3">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Cole aqui o conteúdo que você quer estudar..."
                rows={5}
                className="w-full resize-none rounded-xl bg-transparent p-2 text-base font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-sm font-bold text-muted-foreground hover:text-foreground"
                  >
                    {file ? `📎 ${file.name}` : "📎 Anexar arquivo"}
                  </button>
                  <button
                    type="button"
                    onClick={handleMic}
                    aria-label="Ditar"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${isRecording ? 'bg-destructive text-white animate-pulse' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.txt,.md,image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              <button
                type="button"
                onClick={() => {
                  if (!session) {
                    toast.error("Crie uma conta ou faça login para continuar!");
                    setLoginOpen(true);
                    return;
                  }
                  if (!quizConcluido) {
                    toast.error("Faça o teste de perfil primeiro!");
                    setQuizOpen(true);
                    return;
                  }
                  goContinue();
                }}
                disabled={busy}
                className="btn-3d btn-3d-primary px-5 py-2 text-sm disabled:opacity-60"
              >
                {busy ? "Processando…" : "Continuar"}
              </button>
              </div>
            </div>
            
            <p className="mt-3 text-center text-sm font-bold text-primary">
              ✨ Novidade: Claude integrado
            </p>
          </section>

          <section className="flex flex-col items-center justify-between rounded-3xl border-2 border-border p-8 text-center shadow-[0_6px_0_0_var(--border)] bg-[#f1efea]">
            <img src={perfilCard} alt="Descubra seu perfil" className="h-64 w-64 object-contain" />
            <h2 className="mt-4 text-2xl font-extrabold leading-tight text-accent">
              {perfil ? "Seu perfil está ativo" : "Descubra seu perfil"}
            </h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              {perfil
                ? `Você é ${PROFILE_LABEL[perfil]}. Refaça o teste quando quiser atualizar seu perfil.`
                : "Faça o teste rápido e descubra como você aprende melhor."}
            </p>
            <button
              type="button"
              onClick={() => {
                if (!session) {
                  toast.info("Crie uma conta para descobrir seu perfil!");
                  setAuthMode("signup");
                  setLoginOpen(true);
                } else {
                  setQuizOpen(true);
                }
              }}
              className="btn-3d btn-3d-accent mt-5 px-6"
            >
              {perfil ? "Refazer teste" : "Identificar meu Perfil"}
            </button>
          </section>
        </div>

        <div className="mx-auto mt-12 max-w-2xl space-y-3 text-center">
          <p className="text-foreground">
            <span className="text-accent">✦</span> Sem turmas. Sem ritmo médio. Só o seu jeito.
          </p>
          <p className="text-foreground">
            <span className="text-accent">✦</span> 6 perfis cognitivos diferentes — você é único.
          </p>
          <p className="text-foreground">
            <span className="text-accent">✦</span> Concentra revisão onde você de fato erra.
          </p>
        </div>

        {history.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-2xl font-extrabold tracking-tight text-foreground text-center">
              Seus últimos estudos
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadHistoryItem(item)}
                  className="flex flex-col text-left rounded-3xl border-2 border-border bg-white p-5 shadow-[0_4px_0_0_var(--border)] transition-transform hover:-translate-y-1 hover:shadow-[0_6px_0_0_var(--border)]"
                >
                  <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                    {new Date(item.date).toLocaleDateString()}
                  </span>
                  <span className="mt-2 text-lg font-extrabold leading-tight text-accent line-clamp-2">
                    {item.topic}
                  </span>
                  <span className="mt-auto pt-4 text-xs font-bold text-primary">
                    Retomar estudo →
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-6 py-10 text-center text-xs text-muted-foreground">
        SincronIA — feito com pesquisa em metacognição e muita conversa real.
      </footer>

      <ProfileQuizModal 
        open={quizOpen} 
        onOpenChange={setQuizOpen} 
        onFinished={async (p) => {
          const dbProfile = (p === "concreto" ? "concreto_guiado" : p) as Profile;
          setPerfil(dbProfile);
          setQuizConcluido(true);
          if (session) {
            await supabase.auth.updateUser({
              data: { cognitive_profile: dbProfile }
            });
            toast.success("Perfil cognitivo salvo na sua conta!");
          }
        }}
      />

      {loginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border-2 border-border bg-card p-8 shadow-[0_8px_0_0_var(--border)] animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-extrabold text-accent text-center mb-6">
              {authMode === "signin" ? "Acesse sua conta" : "Criar conta"}
            </h2>

            <div className="flex gap-2 mb-6 bg-secondary/50 p-1 rounded-xl">
               <button 
                 className={`flex-1 text-sm font-bold py-2 rounded-lg transition-colors ${authMode === "signin" ? "bg-white shadow-[0_2px_0_0_var(--border)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                 onClick={() => setAuthMode("signin")}
               >Entrar</button>
               <button 
                 className={`flex-1 text-sm font-bold py-2 rounded-lg transition-colors ${authMode === "signup" ? "bg-white shadow-[0_2px_0_0_var(--border)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                 onClick={() => setAuthMode("signup")}
               >Cadastrar</button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setAuthLoading(true);

              try {
                if (authMode === "signup") {
                  const cleanedPhone = authPhone.replace(/\D/g, "");
                  if (cleanedPhone.length < 8) {
                    toast.error("Celular inválido");
                    setAuthLoading(false);
                    return;
                  }

                  const { data, error } = await supabase.auth.signUp({
                    email: authEmail,
                    password: "Sincronia-MVP-2026!",
                    options: { data: { full_name: authName, phone: cleanedPhone } }
                  });
                  if (error) throw error;
                  if (data?.session) {
                    setSession(data.session);
                    setLoginOpen(false);
                    setQuizOpen(true);
                    toast.success("Conta criada! Vamos descobrir seu perfil de aprendizado.");
                  } else {
                    toast.success("Conta criada! Faça o login.");
                    setAuthMode("signin");
                  }
                } else {
                  const { data, error } = await supabase.auth.signInWithPassword({
                    email: authEmail,
                    password: "Sincronia-MVP-2026!",
                  });
                  if (error) throw error;
                  if (data.session) {
                    setSession(data.session);
                    setLoginOpen(false);
                    toast.success("Login realizado com sucesso!");
                  }
                }
              } catch (err: any) {
                toast.error(err.message || "Erro de autenticação");
              } finally {
                setAuthLoading(false);
              }
            }} className="space-y-4">
              
              {authMode === "signup" && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-muted-foreground mb-1">Nome</label>
                    <input 
                      type="text" 
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="João Silva" 
                      className="w-full rounded-xl border-2 border-border bg-transparent p-3 text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-muted-foreground mb-1">Celular</label>
                    <input 
                      type="tel" 
                      required
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="(11) 99999-9999" 
                      className="w-full rounded-xl border-2 border-border bg-transparent p-3 text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-1">E-mail</label>
                <input 
                  type="email" 
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="seu@email.com" 
                  className="w-full rounded-xl border-2 border-border bg-transparent p-3 text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <button disabled={authLoading} type="submit" className="mt-6 w-full btn-3d btn-3d-primary disabled:opacity-60">
                {authLoading ? "Aguarde..." : authMode === "signin" ? "ENTRAR" : "CADASTRAR"}
              </button>
            </form>

            <button 
              type="button"
              className="mt-4 w-full btn-3d-ghost text-sm"
              onClick={() => setLoginOpen(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}