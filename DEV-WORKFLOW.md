# Fluxo de Desenvolvimento — Sincronia

Guia prático para devs do time. Mostra a estrutura de branches, o passo a passo de uma task (do `git clone` ao merge) e o que cada campo do Pull Request significa.

---

## Estrutura de branches

```
main         ─────●────────●───────●──────  (produção, sincroniahub.tech)
                  ▲        ▲       ▲
develop      ──●──┴──●──●──┴───●───┴──────  (integração — onde os PRs entram)
               ▲     ▲  ▲      ▲
catharina_dev  ●─────●──┘      │
samuel_dev     ●────────┘      │
werbert_dev    ●───────────────┘
ariel_dev      ●──────────────────────────
```

- **`main`** → código que está em produção. **Ninguém faz push direto aqui.** Só recebe merge vindo de `develop` quando o time decide fazer um release.
- **`develop`** → branch de integração. Onde todas as tasks são juntadas e testadas antes de ir pra produção. Recebe Pull Requests vindos das branches pessoais.
- **`catharina_dev`, `samuel_dev`, `werbert_dev`, `ariel_dev`** → branch pessoal de cada dev. Cada um trabalha na sua. Quando uma task termina, abre PR da sua branch pessoal pra `develop`.

---

## Pré-requisitos

- [Git](https://git-scm.com/) instalado.
- Conta no GitHub com acesso ao repositório do projeto.
- (Opcional, mas recomendado) configurar uma chave SSH no GitHub — evita digitar usuário/senha toda hora.

Confirme que seu Git tem nome e email configurados:

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"
```

---

## Criação das branches (uma vez só, pelo team lead)

Estes comandos criam a estrutura inicial de branches do projeto. **Geralmente quem faz é o team lead**, no início do projeto. Se as branches já existem no GitHub (você consegue ver em [https://github.com/samuury/sincronia/branches](https://github.com/samuury/sincronia/branches)), pule para a próxima seção.

### 1. Clonar o repositório e ir para `main`

```bash
git clone https://github.com/samuury/sincronia.git
cd sincronia
git checkout main
git pull origin main
```

### 2. Criar `develop` a partir de `main`

```bash
git checkout -b develop
git push -u origin develop
```

A flag `-u origin develop` define o tracking — `git push` e `git pull` futuros nessa branch já entendem o remote sem precisar repetir o nome.

### 3. Criar as 4 branches dos devs a partir de `develop`

```bash
git checkout -b catharina_dev develop && git push -u origin catharina_dev
git checkout -b samuel_dev     develop && git push -u origin samuel_dev
git checkout -b werbert_dev    develop && git push -u origin werbert_dev
git checkout -b ariel_dev      develop && git push -u origin ariel_dev
```

Cada linha faz duas coisas: cria a branch local a partir de `develop` **e** faz push pro remote.

### 4. Voltar para `develop`

```bash
git checkout develop
```

### 5. (Recomendado) Proteger `main` e `develop` no GitHub

Isso impede push direto nessas branches — todo mundo é forçado a passar por Pull Request.

1. No GitHub, abra o repositório → **Settings** → **Branches**.
2. Clique em **Add branch protection rule**.
3. Em **Branch name pattern**, digite `main`.
4. Marque:
   - **Require a pull request before merging** ✅
   - **Require approvals** ✅ → pelo menos `1`
   - **Allow force pushes** ❌ (deixe DESmarcado)
5. Clique em **Create**.
6. Repita os passos 2–5 trocando o pattern para `develop`.

Pronto. A estrutura está criada. Agora cada dev pode partir para a próxima seção.

---

## Setup inicial (faça uma vez só)

### 1. Clonar o repositório

```bash
git clone https://github.com/samuury/sincronia.git
cd sincronia
```

### 2. Conferir as branches que existem

```bash
git fetch --all
git branch -a
```

Você deve ver, entre outras:

```
  remotes/origin/main
  remotes/origin/develop
  remotes/origin/catharina_dev
  remotes/origin/samuel_dev
  remotes/origin/werbert_dev
  remotes/origin/ariel_dev
```

### 3. Trocar para a sua branch pessoal

Substitua `<sua_branch>` pelo nome da sua (`catharina_dev`, `samuel_dev`, `werbert_dev` ou `ariel_dev`):

```bash
git checkout <sua_branch>
```

A partir daqui, **você só trabalha na sua branch.** Nunca faça commit direto em `main` ou `develop`.

### 4. Instalar dependências e rodar

Veja o [README.md](README.md) para os comandos de instalação e execução (`npm install`, `npm run dev`, etc).

---

## Fluxo de uma task (ciclo que se repete)

Sempre que receber uma nova task (card do Trello / issue do GitHub / etc.), siga este ciclo:

### Passo 1 — Sincronizar sua branch com `develop`

Antes de começar qualquer task, traz as mudanças mais recentes do `develop` pra sua branch. Isso evita conflitos depois.

```bash
git checkout <sua_branch>          # garante que você está na sua branch
git fetch origin                   # baixa as últimas refs do remote
git merge origin/develop           # traz as novidades do develop pra sua branch
```

Se aparecer conflito aqui (raro mas acontece), resolva (ver seção "Lidando com conflitos") e commita.

### Passo 2 — Trabalhar na task

Edita os arquivos, testa local, repete. Pode fazer quantos arquivos quiser.

### Passo 3 — Verificar o que mudou

```bash
git status        # mostra arquivos modificados, removidos, criados
git diff          # mostra o conteúdo das mudanças
```

### Passo 4 — Adicionar e commitar

Adiciona os arquivos que você quer incluir no commit. Prefira nomear os arquivos em vez de usar `git add .` para não levar lixo por engano:

```bash
git add caminho/do/arquivo1.tsx caminho/do/arquivo2.ts
```

Ou, se você confere com `git status` e tudo está OK:

```bash
git add .
```

Commita com uma mensagem clara:

```bash
git commit -m "feat: adiciona tela de login com validação de email"
```

**Convenção de mensagens** (recomendado):

| Prefixo | Quando usar | Exemplo |
|---|---|---|
| `feat:` | Nova funcionalidade | `feat: adiciona filtro por categoria` |
| `fix:` | Correção de bug | `fix: corrige modal não fechando ao clicar fora` |
| `refactor:` | Refatoração sem mudar comportamento | `refactor: extrai lógica de quiz para hook` |
| `docs:` | Documentação | `docs: atualiza README` |
| `style:` | Mudança visual (CSS, espaçamento, etc) | `style: ajusta espaçamento do card de perfil` |
| `chore:` | Tarefa de manutenção | `chore: atualiza dependências` |

Escreva a mensagem **no infinitivo / imperativo**, descrevendo o **quê** foi feito. Evite "atualizei o X" — prefira "atualiza o X".

### Passo 5 — Push para o remote

Manda sua branch pro GitHub:

```bash
git push origin <sua_branch>
```

> Na primeira vez que push uma branch nova, o Git pede `-u origin <sua_branch>` pra criar o tracking. Depois disso, só `git push` resolve.

### Passo 6 — Abrir Pull Request (PR) no GitHub

1. Abre `https://github.com/samuury/sincronia` no navegador.
2. O GitHub vai sugerir no topo "Compare & pull request" para a branch que você acabou de fazer push. Clica.
3. Preenche o PR (próxima seção explica cada campo).

### Passo 7 — Code review

Outro dev vai revisar seu código:
- Pode aprovar (✅ "Approve")
- Pode pedir mudanças (❌ "Request changes") — você corrige os apontamentos, commita, push de novo na mesma branch, o PR atualiza sozinho.
- Pode comentar sem bloquear (💬 "Comment")

### Passo 8 — Merge

Quando o PR estiver aprovado, alguém com permissão faz o merge para `develop`. Sua task acabou.

Para começar a próxima task, **volta para o Passo 1** (sincronizar com `develop`).

---

## Anatomia de um Pull Request

Quando você abre um PR no GitHub, vai ver vários campos. O que significa cada um:

### Title (Título)

Resumo curto do que o PR faz. Mesma convenção do commit:

> `feat: adiciona tela de login com validação de email`

**Boas práticas:**
- Curto (até 70 caracteres).
- No infinitivo / imperativo.
- Sem ponto final.

### Description (Descrição) — o corpo do PR

Texto longo explicando o **porquê** e o **o que** do PR. Não precisa explicar **como** — o código já está ali para isso.

Template sugerido:

```markdown
## O que muda
Breve resumo (1-3 frases) do que esse PR entrega.

## Por quê
Motivo da mudança. Qual problema resolve, qual feature implementa, qual issue fecha.

## Como testar
1. Roda `npm run dev`
2. Abre http://localhost:5173/auth
3. Tenta logar com email inválido — deve aparecer mensagem de erro
4. Tenta logar com email válido — deve redirecionar pra /home

## Screenshots (se aplicável)
[print da tela / vídeo curto]

## Checklist
- [ ] Testei local
- [ ] Não tem `console.log` esquecido
- [ ] Atualizei a documentação se precisava
```

### Base branch / Compare branch

- **Base**: `develop` (sempre, para PRs do time).
- **Compare**: sua branch (`samuel_dev`, etc.).

> Se aparecer `main` como base, **troca para `develop`** antes de criar o PR.

### Reviewers

Os devs que você quer que revisem seu código. Selecione pelo menos um colega do time.

### Assignees

Quem é o responsável pelo PR — normalmente você (autor).

### Labels (Etiquetas)

Marcadores opcionais para classificar:
- `bug`, `feature`, `documentation`, `refactor`
- `priority:high`, `priority:low`
- `wip` (work in progress — ainda não tá pronto para review)

### Linked issues (Issues vinculadas)

Se a task veio de uma issue no GitHub, você liga ela aqui. Pode também escrever no corpo do PR:

```markdown
Closes #42
```

Quando o PR for merged, a issue #42 fecha automaticamente.

### Draft

Se você quer ABRIR o PR mas ainda não está pronto para review (quer só mostrar progresso), abre como **Draft**. Quando ficar pronto, clica em "Ready for review".

---

## Lidando com conflitos

Conflito acontece quando duas branches mudaram a mesma linha de código. O Git não sabe qual versão manter e pede sua ajuda.

### Quando você faz `git merge origin/develop` e dá conflito:

1. O Git vai listar os arquivos com conflito. Roda `git status` para ver quais são.
2. Abre cada arquivo no editor. Você vai ver blocos assim:
   ```
   <<<<<<< HEAD
   código que está na sua branch
   =======
   código que veio do develop
   >>>>>>> origin/develop
   ```
3. Edita o arquivo deixando só a versão correta (pode ser uma das duas, ou uma mistura). **Apaga os marcadores `<<<<<<<`, `=======`, `>>>>>>>`.**
4. Salva o arquivo.
5. Marca o conflito como resolvido:
   ```bash
   git add caminho/do/arquivo
   ```
6. Quando tiver resolvido todos:
   ```bash
   git commit       # vai abrir editor com mensagem de merge automática — só salvar
   ```

### Conflito no PR (no GitHub)

Se o GitHub avisa "This branch has conflicts that must be resolved" no PR:

```bash
git checkout <sua_branch>
git fetch origin
git merge origin/develop
# resolve conflitos como acima
git push origin <sua_branch>
```

O PR atualiza sozinho.

---

## Referência rápida (cheatsheet)

```bash
# Ver em que branch você está
git branch

# Trocar de branch
git checkout <nome_da_branch>

# Atualizar com develop (faça isso ANTES de começar cada task)
git fetch origin
git merge origin/develop

# Ver o que mudou
git status
git diff

# Salvar mudanças
git add <arquivos>
git commit -m "feat: descrição curta"

# Mandar pro GitHub
git push origin <sua_branch>

# Desfazer última mudança ainda NÃO commitada num arquivo
git restore <arquivo>

# Descommitar (mantendo as mudanças)
git reset --soft HEAD~1

# Ver últimos commits
git log --oneline -10

# Ver remotes configurados
git remote -v
```

---

## Regras de ouro

1. **Nunca faça push direto em `main` ou `develop`.** Só por PR.
2. **Sempre sincronize com `develop` antes de começar uma task.** Evita 80% dos conflitos.
3. **Um PR = uma task.** Não junta 5 features num PR só — deixa o review impossível.
4. **Commits pequenos e frequentes** valem mais que um commitão gigante.
5. **Se tiver dúvida, pergunta no grupo do time antes de fazer algo destrutivo** (force push, reset, rebase em branch compartilhada).

---

## Em caso de emergência

- **"Apaguei sem querer um arquivo que estava commitado"** → `git checkout HEAD -- caminho/do/arquivo`
- **"Commitei na branch errada"** → pergunta no grupo, não tenta resolver sozinho.
- **"Quero descartar TODAS as minhas mudanças locais e voltar ao estado da branch no remote"** → `git fetch origin && git reset --hard origin/<sua_branch>` (cuidado, apaga tudo que não foi commitado).
