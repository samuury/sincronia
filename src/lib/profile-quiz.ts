// Quiz rápido de perfil cognitivo (6 perfis, 8 perguntas, modal)
// Independente do fluxo /onboarding. Pontuação por matriz fixa.

export type QuizProfile =
  | "sistematico"
  | "pragmatico"
  | "explorador"
  | "associativo"
  | "investigativo"
  | "concreto";

export const QUIZ_PROFILE_ORDER: QuizProfile[] = [
  "sistematico",
  "pragmatico",
  "explorador",
  "associativo",
  "investigativo",
  "concreto",
];

export const QUIZ_PROFILE_META: Record<
  QuizProfile,
  { emoji: string; name: string; description: string }
> = {
  sistematico: {
    emoji: "📐",
    name: "O Sistemático",
    description:
      "Processa o conhecimento de forma linear e ordenada. Precisa entender o conceito antes de qualquer aplicação, avança passo a passo, para tudo quando encontra um termo desconhecido. Consolida reescrevendo com suas próprias palavras.",
  },
  pragmatico: {
    emoji: "⚙️",
    name: "O Pragmático",
    description:
      "Aprende fazendo. Prefere ver como algo funciona antes de entender por quê. Absorve grandes volumes de uma vez e aprende melhor errando, recebendo dicas e tentando de novo. Consolida resolvendo exercícios práticos.",
  },
  explorador: {
    emoji: "🧭",
    name: "O Explorador",
    description:
      "Precisa do mapa antes de entrar no território. Quer visão geral do tema e navega por conta própria, aprofundando o que julga relevante. Tolera bem ambiguidade. Consolida quando consegue ensinar o tema para outra pessoa.",
  },
  associativo: {
    emoji: "🔗",
    name: "O Associativo",
    description:
      "Aprende conectando o novo ao que já sabe. Metáforas e analogias são suas ferramentas mais poderosas. Avança progressivamente mas com liberdade para fazer suas próprias conexões. Consolida reescrevendo e reformulando.",
  },
  investigativo: {
    emoji: "🔬",
    name: "O Investigativo",
    description:
      "Quer entender o porquê em profundidade. Começa pelo conceito, tolera avançar com dúvidas abertas e volta para resolvê-las. Prefere descobrir a resposta com uma dica a recebê-la pronta. Consolida verbalizando o tema com clareza.",
  },
  concreto: {
    emoji: "🪜",
    name: "O Concreto Guiado",
    description:
      "Aprende melhor com exemplos concretos e condução clara a cada passo. Começa pelo mais simples e avança gradualmente. Baixa tolerância à ambiguidade. Consolida pela prática repetida.",
  },
};

export type QuizQuestion = {
  id: string;
  scenario: string;
  options: { letter: "A" | "B" | "C"; label: string; weights: number[] }[];
};

// Ordem dos pesos: [Sistemático, Pragmático, Explorador, Associativo, Investigativo, Concreto]
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    scenario:
      "Você vai aprender como funciona um motor de carro. O que prefere ver primeiro?",
    options: [
      { letter: "A", label: "Explicação do princípio de combustão interna", weights: [2, 0, 0, 0, 2, 0] },
      { letter: "B", label: "Um mecânico mostrando o que acontece na prática", weights: [0, 2, 0, 0, 0, 2] },
      { letter: "C", label: "Uma comparação/metáfora (\"funciona como seu pulmão\")", weights: [0, 0, 2, 2, 0, 0] },
    ],
  },
  {
    id: "q2",
    scenario:
      "Você está estudando um tema complexo com muitos conceitos novos. O que prefere?",
    options: [
      { letter: "A", label: "Explicação completa de uma vez, você organiza sozinho", weights: [0, 2, 0, 0, 1, 0] },
      { letter: "B", label: "Conceito principal primeiro, avança um de cada vez", weights: [2, 0, 0, 1, 0, 2] },
      { letter: "C", label: "Visão geral rápida do todo, você escolhe o que aprofundar", weights: [0, 0, 2, 0, 1, 0] },
    ],
  },
  {
    id: "q3",
    scenario: "Você travou em um conceito difícil. O que mais te ajuda a destravar?",
    options: [
      { letter: "A", label: "Comparação com algo que já conhece (\"isso funciona igual a...\")", weights: [0, 0, 1, 2, 0, 0] },
      { letter: "B", label: "Ver um exemplo real de uso na prática", weights: [0, 2, 0, 0, 0, 2] },
      { letter: "C", label: "Entender o que o conceito não é, para delimitar o que é", weights: [2, 0, 0, 0, 2, 0] },
    ],
  },
  {
    id: "q4",
    scenario:
      "Você encontra um termo desconhecido no meio de uma explicação. O que faz?",
    options: [
      { letter: "A", label: "Para tudo e busca entender antes de continuar", weights: [2, 0, 0, 0, 0, 2] },
      { letter: "B", label: "Continua e espera o contexto esclarecer", weights: [0, 1, 0, 0, 2, 0] },
      { letter: "C", label: "Anota, termina a explicação e volta depois", weights: [0, 0, 1, 1, 0, 0] },
    ],
  },
  {
    id: "q5",
    scenario:
      "Você precisa entender a diferença entre três conceitos relacionados. O que prefere?",
    options: [
      { letter: "A", label: "Texto explicando cada um com características e diferenças", weights: [2, 0, 0, 1, 1, 0] },
      { letter: "B", label: "Diagrama ou tabela visual comparando os três", weights: [0, 0, 2, 0, 0, 0] },
      { letter: "C", label: "Caso prático onde os três aparecem juntos", weights: [0, 2, 0, 0, 0, 2] },
    ],
  },
  {
    id: "q6",
    scenario: "Como sabe se aprendeu de verdade?",
    options: [
      { letter: "A", label: "Quando consigo explicar com minhas próprias palavras", weights: [2, 0, 0, 2, 0, 0] },
      { letter: "B", label: "Quando acerto as questões do exercício", weights: [0, 2, 0, 0, 0, 2] },
      { letter: "C", label: "Quando consigo aplicar o conceito em um problema novo", weights: [0, 0, 2, 0, 2, 0] },
    ],
  },
  {
    id: "q7",
    scenario: "Você erra uma questão. O que prefere que aconteça?",
    options: [
      { letter: "A", label: "Ver a resposta correta com explicação detalhada do raciocínio", weights: [2, 0, 0, 0, 0, 2] },
      { letter: "B", label: "Receber uma dica para chegar à resposta sozinho", weights: [0, 2, 0, 0, 2, 0] },
      { letter: "C", label: "Voltar ao trecho da explicação onde aquele conceito foi abordado", weights: [0, 0, 2, 2, 0, 0] },
    ],
  },
  {
    id: "q8",
    scenario:
      "Você aprendeu algo novo e quer garantir que vai lembrar. O que faz?",
    options: [
      { letter: "A", label: "Reescrevo com minhas próprias palavras (resumo ou mapa)", weights: [2, 0, 0, 2, 0, 0] },
      { letter: "B", label: "Resolvo exercícios e problemas práticos", weights: [0, 2, 0, 0, 0, 2] },
      { letter: "C", label: "Explico em voz alta para mim mesmo ou para alguém", weights: [0, 0, 2, 0, 2, 0] },
    ],
  },
];

export function computeQuizProfile(
  answers: Record<string, number>,
): { profile: QuizProfile; scores: Record<QuizProfile, number> } {
  const totals = [0, 0, 0, 0, 0, 0];
  for (const q of QUIZ_QUESTIONS) {
    const idx = answers[q.id];
    const opt = q.options[idx];
    if (!opt) continue;
    for (let i = 0; i < 6; i++) totals[i] += opt.weights[i];
  }
  const scores = {} as Record<QuizProfile, number>;
  QUIZ_PROFILE_ORDER.forEach((p, i) => (scores[p] = totals[i]));
  let best: QuizProfile = "sistematico";
  let max = -1;
  for (const p of QUIZ_PROFILE_ORDER) {
    if (scores[p] > max) {
      max = scores[p];
      best = p;
    }
  }
  return { profile: best, scores };
}