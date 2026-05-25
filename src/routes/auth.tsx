import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { syncPendingProfile } from "@/lib/pending-profile";
import logo from "@/assets/logo-sincronia.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — SincronIA" },
      { name: "description", content: "Entre ou crie sua conta na SincronIA." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        syncPendingProfile().finally(() => nav({ to: "/inicio" }));
      }
    });
    supabase.auth.getSession().then(({ data: d }) => {
      if (d.session) {
        syncPendingProfile().finally(() => nav({ to: "/inicio" }));
      }
    });
    return () => data.subscription.unsubscribe();
  }, [nav]);

  function formatPhone(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function phoneDigits(v: string) {
    return v.replace(/\D/g, "");
  }

  function phoneToLoginEmail(v: string) {
    return `${phoneDigits(v)}@sinc.login`;
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    const digits = phoneDigits(phone);
    if (digits.length !== 11) {
      toast.error("Telefone inválido. Use (99) 99999-9999");
      return;
    }
    if (!email.includes("@")) {
      toast.error("E-mail inválido");
      return;
    }
    setLoading(true);
    try {
      const loginEmail = phoneToLoginEmail(phone);
      const password = email.trim().toLowerCase();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: loginEmail,
          password,
          options: {
          emailRedirectTo: window.location.origin + "/inicio",
            data: {
              display_name: name || email.split("@")[0],
              phone: digits,
              contact_email: email,
            },
          },
        });
        if (error) throw error;
        toast.success("Conta criada!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border-2 border-border bg-card p-8 shadow-[0_6px_0_0_var(--border)]">
        <Link to="/home" className="flex items-center gap-2">
          <img src={logo} alt="SincronIA" className="h-16 w-auto" />
        </Link>
        <h1 className="mt-6 text-2xl font-extrabold">
          {mode === "signin" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "signin"
            ? "Bem-vindo de volta!"
            : "Vamos descobrir como você aprende."}
        </p>

        <form onSubmit={handleEmail} className="mt-6 space-y-3">
          {mode === "signup" && (
            <input
              className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 font-semibold"
              placeholder="Como podemos te chamar?"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            type="tel"
            inputMode="numeric"
            required
            autoComplete="tel"
            className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 font-semibold"
            placeholder="(99) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
          />
          <input
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 font-semibold"
            placeholder="E-mail (sua senha)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button disabled={loading} className="btn-3d btn-3d-primary w-full">
            {loading ? "..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-sm font-bold text-accent"
        >
          {mode === "signin"
            ? "Não tenho conta — criar agora"
            : "Já tenho conta — entrar"}
        </button>
      </div>
    </div>
  );
}
