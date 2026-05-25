# Sincronia

Plataforma de estudo personalizado por perfil cognitivo. O usuário envia um material (texto, PDF, imagem), faz um quiz de perfil, e a IA gera uma trilha de estudo adaptada.

**Em produção:** https://sincroniahub.tech

## Stack

- **TanStack Start** (SSR + Server Functions) + **React 19** + **Vite 7**
- **Tailwind CSS 4** + **shadcn/ui** (Radix)
- **Supabase** (Postgres + Auth + RLS)
- **Google Gemini** (geração de conteúdo)
- **Node 22** (runtime) — deploy via Docker (Coolify VPS)

## Pré-requisitos

- **Node 22** (https://nodejs.org) — só para rodar via npm
- **Docker Desktop** — só para rodar via Docker
- Conta no [Supabase](https://supabase.com) (URLs/keys do projeto)
- Chave da API do [Google AI Studio](https://aistudio.google.com/apikey) (Gemini)

## Setup do `.env`

Copie o exemplo e preencha:

```bash
cp .env.example .env
```

Edite o `.env` com seus valores reais. Variáveis necessárias:

| Nome | Onde usar |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anon do Supabase |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Service role (necessária para `/admin`) |
| `SUPABASE_URL` | Mesmo valor de `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Mesmo valor da service role |
| `GEMINI_API_KEY` | Chave da API do Gemini |
| `GEMINI_MODEL` | Ex: `gemini-2.5-flash` |

O `.env` está no `.gitignore` — nunca comite chaves de verdade.

## Rodar localmente com npm

```bash
npm install
npm run dev
```

Abre em http://localhost:5173 com hot reload.

## Rodar localmente com Docker

```bash
docker compose up
```

Primeira execução faz build da imagem (~1 min). Próximas iniciam em segundos.

Abre em http://localhost:5173 — mesmo hot reload do npm (o código é montado via volume).

Para parar: `Ctrl+C` no terminal, ou em outra janela:

```bash
docker compose down
```

## Build de produção (testar local)

Reproduz exatamente o que roda na VPS:

```bash
npm run build
node server.mjs
```

Abre em http://localhost:3000.

Ou via Docker (replica 1:1 a imagem do Coolify):

```bash
docker build -t sincronia .
docker run --rm -p 3000:3000 --env-file .env sincronia
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de dev (Vite, porta 5173, HMR) |
| `npm run build` | Build de produção → `dist/` |
| `npm start` | Roda o build de produção (`node server.mjs`) |
| `npm run lint` | ESLint em todo o projeto |
| `npm run format` | Prettier em todo o projeto |

## Estrutura de pastas

```
.
├── src/
│   ├── routes/          # Rotas TanStack Router (file-based)
│   ├── components/      # UI (shadcn) e domínio (estudos)
│   ├── lib/             # Server functions, helpers
│   ├── integrations/    # Clients Supabase e Lovable Auth
│   ├── router.tsx       # Config do router
│   └── start.ts         # Middlewares globais (auth, errors)
├── supabase/migrations/ # Schema + RLS policies
├── server.mjs           # HTTP listener Node para produção
├── Dockerfile           # Imagem de produção (multi-stage)
├── Dockerfile.dev       # Imagem de desenvolvimento
└── docker-compose.yml   # Orquestração local (apenas dev)
```

