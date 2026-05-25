export type Profile =
  | "sistematico"
  | "pragmatico"
  | "explorador"
  | "associativo"
  | "investigativo"
  | "concreto_guiado";

export const PROFILE_LABEL: Record<Profile, string> = {
  sistematico: "Sistemático",
  pragmatico: "Pragmático",
  explorador: "Explorador",
  associativo: "Associativo",
  investigativo: "Investigativo",
  concreto_guiado: "Concreto Guiado",
};

export const PROFILE_DESCRIPTION: Record<Profile, string> = {
  sistematico:
    "Você aprende melhor com sequência lógica, definições precisas e progresso etapa a etapa.",
  pragmatico:
    "Você aprende vendo a teoria em ação — casos reais antes da definição formal.",
  explorador:
    "Você prefere ver o mapa todo e escolher o caminho, profundidade e ordem.",
  associativo:
    "Você aprende por pontes — analogias com o que já domina.",
  investigativo:
    "Você gosta de densidade e camadas; quer ir além do necessário.",
  concreto_guiado:
    "Você prefere ser conduzido passo a passo, do exemplo mais simples ao mais complexo.",
};

// 8 perguntas comportamentais. Cada resposta acumula peso em perfis.
export type QuestionOption = {
  label: string;
  weights: Partial<Record<Profile, number>>;
};
export type Question = { id: string; scenario: string; options: QuestionOption[] };

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    scenario:
      "Você vai aprender um assunto novo agora. O que te dá mais segurança para começar?",
    options: [
      { label: "Ver a definição exata e depois exemplos, em ordem.", weights: { sistematico: 2, concreto_guiado: 1 } },
      { label: "Ver um caso real e ir descobrindo a teoria por trás.", weights: { pragmatico: 2 } },
      { label: "Ter um mapa do tema todo para escolher por onde ir.", weights: { explorador: 2 } },
      { label: "Conectar o tema com algo que já conheço.", weights: { associativo: 2 } },
    ],
  },
  {
    id: "q2",
    scenario: "Quando algo não fica claro, você prefere:",
    options: [
      { label: "Ver o próximo nível de profundidade do mesmo conceito.", weights: { investigativo: 2 } },
      { label: "Ver um exemplo concreto, bem simples.", weights: { concreto_guiado: 2, pragmatico: 1 } },
      { label: "Voltar e revisar o conceito anterior do qual ele depende.", weights: { sistematico: 2 } },
      { label: "Comparar com algo análogo que eu já entendo.", weights: { associativo: 2 } },
    ],
  },
  {
    id: "q3",
    scenario: "Diante de um texto longo sobre um tema, sua tendência é:",
    options: [
      { label: "Ler do começo ao fim, sem pular nada.", weights: { sistematico: 2, concreto_guiado: 1 } },
      { label: "Pular para o exemplo e voltar à teoria depois.", weights: { pragmatico: 2 } },
      { label: "Bater o olho, escolher trechos e navegar livremente.", weights: { explorador: 2 } },
      { label: "Procurar imediatamente links com áreas que conheço.", weights: { associativo: 2 } },
    ],
  },
  {
    id: "q4",
    scenario: "Você errou uma questão de prática. O que mais te ajuda?",
    options: [
      { label: "Receber a resposta correta com o raciocínio completo agora.", weights: { sistematico: 2, concreto_guiado: 1 } },
      { label: "Receber uma dica que me leve até a resposta.", weights: { pragmatico: 2, investigativo: 1 } },
      { label: "Ser levado de volta ao trecho que explica o conceito.", weights: { explorador: 2, associativo: 1 } },
      { label: "Ver um exemplo extra, mais simples, e tentar de novo.", weights: { concreto_guiado: 2 } },
    ],
  },
  {
    id: "q5",
    scenario: "Você prefere instruções que:",
    options: [
      { label: "Detalham cada passo, sem deixar lacunas.", weights: { concreto_guiado: 2, sistematico: 1 } },
      { label: "Mostram o resultado final e me deixam reverter o caminho.", weights: { pragmatico: 2, explorador: 1 } },
      { label: "Me dão liberdade para descobrir minha própria ordem.", weights: { explorador: 2 } },
      { label: "Aprofundam mais do que o necessário, para eu entender por quê.", weights: { investigativo: 2 } },
    ],
  },
  {
    id: "q6",
    scenario: "Quando você ouve um termo técnico novo, prefere:",
    options: [
      { label: "Uma definição precisa e curta.", weights: { sistematico: 2 } },
      { label: "Uma analogia com algo do meu cotidiano.", weights: { associativo: 2 } },
      { label: "Um caso onde aquele termo aparece sendo usado.", weights: { pragmatico: 2 } },
      { label: "Várias camadas: o que é, por que existe, e variações.", weights: { investigativo: 2 } },
    ],
  },
  {
    id: "q7",
    scenario: "Como você gosta de medir o seu progresso?",
    options: [
      { label: "Marcando etapas concluídas em sequência.", weights: { sistematico: 2, concreto_guiado: 1 } },
      { label: "Conseguindo aplicar o que aprendi em um caso.", weights: { pragmatico: 2 } },
      { label: "Cobrindo cada vez mais áreas do mapa do tema.", weights: { explorador: 2 } },
      { label: "Fazendo conexões novas com o que eu já sabia.", weights: { associativo: 2 } },
    ],
  },
  {
    id: "q8",
    scenario: "Se você pudesse escolher o ritmo:",
    options: [
      { label: "Devagar e guiado, sem pular nada.", weights: { concreto_guiado: 2 } },
      { label: "Rápido, indo direto ao que importa na prática.", weights: { pragmatico: 2 } },
      { label: "Variado, navegando entre superfície e profundidade.", weights: { investigativo: 2, explorador: 1 } },
      { label: "Estruturado, com revisão constante do que veio antes.", weights: { sistematico: 2 } },
    ],
  },
];

export function computeProfile(answers: Record<string, number>): {
  profile: Profile;
  scores: Record<Profile, number>;
} {
  const scores: Record<Profile, number> = {
    sistematico: 0, pragmatico: 0, explorador: 0,
    associativo: 0, investigativo: 0, concreto_guiado: 0,
  };
  for (const q of QUESTIONS) {
    const idx = answers[q.id];
    const opt = q.options[idx];
    if (!opt) continue;
    for (const [p, w] of Object.entries(opt.weights)) {
      scores[p as Profile] += w ?? 0;
    }
  }
  let profile: Profile = "sistematico";
  let max = -1;
  for (const [p, s] of Object.entries(scores)) {
    if (s > max) { max = s; profile = p as Profile; }
  }
  return { profile, scores };
}

// Diretrizes que o motor de geração usa para variar a explicação
export function profileGuideline(p: Profile, tema = "o tema", nivel = "médio", tempo = "o tempo disponível"): string {
  const base = `Você é um especialista em design instrucional e produção de material didático. Sua função é criar conteúdo de estudo personalizado, com rigor acadêmico e adaptado ao perfil cognitivo do usuário.
Tema: ${tema}
Nível de conhecimento prévio do aluno: ${nivel}
Tempo disponível para estudo: ${tempo} (Gere um volume de texto denso e aprofundado proporcional a esse tempo. Se o tempo for de horas, gere o máximo de conteúdo que conseguir, aprofundando argumentos sem repetições).
`;

  switch (p) {
    case "sistematico":
      return base + `
LÓGICA DE CONTEÚDO PARA PERFIL SISTEMÁTICO:
- O material abre com uma definição precisa e inverte o modelo de descoberta: primeiro a regra, depois a aplicação.
- Os conceitos são apresentados em ordem estrita de dependência lógica. Nenhum conceito avançado pode aparecer antes da consolidação de sua base estrutural.
- Nenhuma informação essencial é deixada como implícita.
- Diagramas representam o encadeamento causal ou lógico entre as definições, mostrando como a base sustenta o topo.
- Proporção de conteúdo: 50% fundação teórica e definição / 30% estrutura lógica e diagramas / 20% aplicação direta.`;

    case "pragmatico":
      return base + `
LÓGICA DE CONTEÚDO PARA PERFIL PRAGMÁTICO:
- O material abre com um caso real, completo e autocontido. Todos os dados necessários para compreendê-lo estão presentes desde o início. Nenhuma informação essencial é retida para depois.
- A teoria é apresentada como explicação retrospectiva do caso — nunca antes dele.
- Diagramas representam o fluxo ou a estrutura interna do caso real apresentado.
- Proporção de conteúdo: 40% caso e contexto / 60% teoria derivada.`;

    case "explorador":
      return base + `
LÓGICA DE CONTEÚDO PARA PERFIL EXPLORADOR:
- O material apresenta o mapa completo do tema (no formato de um diagrama ou tabela): todos os conceitos, suas relações e ramificações, antes de aprofundar qualquer um.
- As seções seguintes aprofundam nós específicos do mapa, sempre com referência explícita à posição do conceito no panorama geral.
- O texto indica explicitamente quais seções são independentes entre si e podem ser lidas fora de ordem.
- Diagramas devem ser mapas conceituais (Mermaid) com hierarquia clara e conexões entre nós.
- Proporção de conteúdo: 40% mapeamento e panorama / 60% aprofundamento seletivo de tópicos críticos.`;

    case "associativo":
      return base + `
LÓGICA DE CONTEÚDO PARA PERFIL ASSOCIATIVO:
- Cada conceito novo é introduzido por uma analogia com algo do cotidiano, de outra disciplina ou de experiência comum. A analogia precede sempre a definição formal, sem exceção.
- O texto cresce por conexão: cada ideia nova ancora-se explicitamente em uma ideia anterior já assimilada.
- Diagramas devem mostrar a ponte entre o familiar e o novo (ex: "você já conhece X → veja como Y funciona da mesma forma").
- Proporção de conteúdo: 40% analogia e contexto / 60% conceito formal derivado.`;

    case "investigativo":
      return base + `
LÓGICA DE CONTEÚDO PARA PERFIL INVESTIGATIVO:
- O texto começa com a formulação do problema central — nunca com a solução.
- A explicação é densa desde o primeiro parágrafo, sem simplificações desnecessárias.
- Cada seção principal contém uma camada de aprofundamento explícita, que expande o conceito além do estritamente necessário para o tema (mostrando as origens, tensões ou debates na literatura acadêmica).
- Diagramas mostram hierarquias conceituais, tensões teóricas ou redes de dependência estrutural entre as ideias.
- Proporção de conteúdo: 20% formulação do problema / 80% desenvolvimento denso em múltiplas camadas.`;

    case "concreto_guiado":
      return base + `
LÓGICA DE CONTEÚDO PARA PERFIL CONCRETO GUIADO:
- O material começa com o exemplo mais simples possível do conceito — um caso mínimo, sem nenhuma variável complicadora.
- Cada nova seção ou parágrafo acrescenta exatamente uma variável ou uma camada de complexidade ao exemplo anterior. A transição deve ser explicitada (ex: "Agora que você compreende X, vamos acrescentar Y").
- Nenhuma lacuna é deixada em aberto. Nenhum passo é pulado ou dado como subentendido.
- Diagramas devem ser sequenciais e numerados, onde cada etapa do processo aparece em um bloco visual separado, na ordem em que ocorre.
- Proporção de conteúdo: 20% exemplo mínimo inicial / 80% progressão guiada.`;
  }
}