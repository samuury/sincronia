
-- Enum de papéis (segurança)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Enum de perfis cognitivos
CREATE TYPE public.cognitive_profile AS ENUM (
  'sistematico','pragmatico','explorador','associativo','investigativo','concreto_guiado'
);

-- Função para timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  cognitive_profile public.cognitive_profile,
  profile_scores JSONB DEFAULT '{}'::jsonb,
  sessions_count INT NOT NULL DEFAULT 0,
  audio_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own_profile_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own_profile_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- trigger: cria profile no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;
CREATE POLICY "own_roles_select" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  material_text TEXT,
  material_path TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  diag_score NUMERIC,
  final_score NUMERIC,
  profile_used public.cognitive_profile,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sessions_all" ON public.sessions FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER sessions_updated BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_sessions_user ON public.sessions(user_id, created_at DESC);

-- explanations
CREATE TABLE public.explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.explanations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_explanations_all" ON public.explanations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.user_id=auth.uid()));
CREATE INDEX idx_explanations_session ON public.explanations(session_id);

-- sub_explanations
CREATE TABLE public.sub_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sub_explanations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_subexp_all" ON public.sub_explanations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.user_id=auth.uid()));
CREATE INDEX idx_subexp_session ON public.sub_explanations(session_id);

-- quizzes
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('diagnostico','verificacao')),
  questions JSONB NOT NULL,
  answers JSONB,
  score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_quizzes_all" ON public.quizzes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.user_id=auth.uid()));
CREATE INDEX idx_quizzes_session ON public.quizzes(session_id);

-- interactions
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_interactions_all" ON public.interactions FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE INDEX idx_interactions_user ON public.interactions(user_id, created_at DESC);

-- Storage bucket privado para materiais
INSERT INTO storage.buckets (id, name, public) VALUES ('materials','materials', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "materials_select_own" ON storage.objects FOR SELECT
  USING (bucket_id='materials' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "materials_insert_own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='materials' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "materials_delete_own" ON storage.objects FOR DELETE
  USING (bucket_id='materials' AND auth.uid()::text = (storage.foldername(name))[1]);
