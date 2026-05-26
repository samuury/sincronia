import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { adminSupabase } from "@/integrations/supabase/client";
import { ArrowLeft, Users, BookOpen, Activity } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Painel Admin — SincronIA" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [averageScore, setAverageScore] = useState<number>(0);

  useEffect(() => {
    if (authenticated) {
      const fetchData = async () => {
        setLoading(true);
        
        // Buscar usuários
        const { data: usersData, error: usersError } = await adminSupabase.auth.admin.listUsers();
        if (usersError) {
          toast.error("Erro ao buscar usuários: " + usersError.message);
        } else {
          setUsers(usersData.users || []);
        }

        // Buscar perfis
        const { data: profilesData, error: profilesError } = await adminSupabase
          .from("profiles")
          .select("id, unlimited_sessions, cognitive_profile, display_name");
        if (profilesError) {
          toast.error("Erro ao buscar perfis: " + profilesError.message);
        } else {
          setProfiles(profilesData || []);
        }

        // Buscar todas as sessões para calcular estatísticas reais e precisas
        const { data: sessionsData, error: sessionsError } = await adminSupabase
          .from("sessions")
          .select("id, user_id, final_score");
        
        if (sessionsError) {
          toast.error("Erro ao buscar sessões: " + sessionsError.message);
        } else if (sessionsData) {
          const counts: Record<string, number> = {};
          let sum = 0;
          let countWithScore = 0;
          
          sessionsData.forEach(s => {
            counts[s.user_id] = (counts[s.user_id] || 0) + 1;
            if (s.final_score !== null) {
              sum += Number(s.final_score);
              countWithScore++;
            }
          });
          
          setSessionCounts(counts);
          setAverageScore(countWithScore > 0 ? sum / countWithScore : 0);
        }

        setLoading(false);
      };
      fetchData();
    }
  }, [authenticated]);

  const toggleUnlimited = async (userId: string, currentVal: boolean) => {
    try {
      const newVal = !currentVal;
      const { error } = await adminSupabase
        .from("profiles")
        .update({ unlimited_sessions: newVal })
        .eq("id", userId);

      if (error) throw error;
      
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, unlimited_sessions: newVal } : p));
      toast.success(newVal ? "Acesso ilimitado concedido!" : "Acesso ilimitado removido.");
    } catch (err: any) {
      toast.error("Erro ao atualizar permissão: " + err.message);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "Admin1234") {
      setAuthenticated(true);
      toast.success("Acesso autorizado");
    } else {
      toast.error("Senha incorreta");
      setPassword("");
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Link to="/home" className="absolute top-8 left-8 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao início
        </Link>
        <div className="w-full max-w-sm rounded-3xl border-2 border-border bg-card p-8 shadow-[0_8px_0_0_var(--border)]">
          <h2 className="text-2xl font-extrabold text-accent text-center mb-6">Acesso Restrito</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-1">Senha de Administrador</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full rounded-xl border-2 border-border bg-transparent p-3 text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
                autoFocus
              />
            </div>
            <button type="submit" className="mt-6 w-full btn-3d btn-3d-primary">
              Acessar Painel
            </button>
          </form>
        </div>
      </div>
    );
  }

  const totalStudies = Object.values(sessionCounts).reduce((acc, curr) => acc + curr, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <span className="text-xl font-extrabold tracking-tight text-accent">Admin SincronIA</span>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">Gerenciamento</span>
          </div>
          <Link to="/home" className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Sair
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-foreground">Visão Geral</h1>
          <p className="text-muted-foreground mt-1">Estatísticas e gerenciamento do sistema.</p>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-6 md:grid-cols-3 mb-10">
          <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-[0_4px_0_0_var(--border)]">
            <div className="flex items-center gap-3 text-primary mb-2">
              <Users className="h-5 w-5" />
              <h3 className="font-extrabold text-sm uppercase tracking-wide">Total de Usuários</h3>
            </div>
            <p className="text-4xl font-extrabold text-foreground">{loading ? "..." : users.length}</p>
            <p className="text-xs font-bold text-muted-foreground mt-2">Registrados no Supabase</p>
          </div>
          
          <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-[0_4px_0_0_var(--border)]">
            <div className="flex items-center gap-3 text-accent mb-2">
              <BookOpen className="h-5 w-5" />
              <h3 className="font-extrabold text-sm uppercase tracking-wide">Estudos Gerados</h3>
            </div>
            <p className="text-4xl font-extrabold text-foreground">{loading ? "..." : totalStudies}</p>
            <p className="text-xs font-bold text-muted-foreground mt-2">Total no Supabase</p>
          </div>

          <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-[0_4px_0_0_var(--border)]">
            <div className="flex items-center gap-3 text-success mb-2">
              <Activity className="h-5 w-5" />
              <h3 className="font-extrabold text-sm uppercase tracking-wide">Média de Acertos</h3>
            </div>
            <p className="text-4xl font-extrabold text-foreground">{loading ? "..." : `${Math.round(averageScore * 100)}%`}</p>
            <p className="text-xs font-bold text-muted-foreground mt-2">Média global das sessões</p>
          </div>
        </div>

        {/* Tabela de Usuários */}
        <section>
          <h2 className="text-xl font-extrabold text-foreground mb-4">Usuários Recentes</h2>
          <div className="rounded-3xl border-2 border-border bg-card overflow-hidden shadow-[0_4px_0_0_var(--border)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b-2 border-border bg-secondary/50">
                  <tr>
                    <th className="px-6 py-4 font-extrabold text-muted-foreground">ID</th>
                    <th className="px-6 py-4 font-extrabold text-muted-foreground">Nome</th>
                    <th className="px-6 py-4 font-extrabold text-muted-foreground">E-mail</th>
                    <th className="px-6 py-4 font-extrabold text-muted-foreground">Estudos</th>
                    <th className="px-6 py-4 font-extrabold text-muted-foreground">Perfil de Aprendizado</th>
                    <th className="px-6 py-4 font-extrabold text-muted-foreground text-center">Permissão</th>
                    <th className="px-6 py-4 font-extrabold text-muted-foreground">Data Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground font-bold">
                        Carregando usuários...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground font-bold">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  ) : (
                    users.map(user => {
                      const profile = profiles.find(p => p.id === user.id);
                      const count = sessionCounts[user.id] || 0;
                      const hasUnlimited = profile?.unlimited_sessions || false;
                      const cogProfile = profile?.cognitive_profile || user.user_metadata?.cognitive_profile;
                      const dispName = profile?.display_name || user.user_metadata?.full_name || "-";

                      return (
                        <tr key={user.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20">
                          <td className="px-6 py-4 text-xs font-mono text-muted-foreground">{user.id.slice(0, 8)}...</td>
                          <td className="px-6 py-4 font-bold">{dispName}</td>
                          <td className="px-6 py-4">{user.email}</td>
                          <td className="px-6 py-4 font-bold text-accent">{count}</td>
                          <td className="px-6 py-4">
                            {cogProfile ? (
                              <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-bold text-accent capitalize">
                                {cogProfile}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => toggleUnlimited(user.id, hasUnlimited)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                                hasUnlimited 
                                  ? "bg-success/20 text-success border-success/30 hover:bg-success/30" 
                                  : "bg-streak/20 text-streak border-streak/30 hover:bg-streak/30"
                              }`}
                            >
                              {hasUnlimited ? "Ilimitado" : "Limitar (3)"}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm">{new Date(user.created_at).toLocaleDateString("pt-BR")}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
