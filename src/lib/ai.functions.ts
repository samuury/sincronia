import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { profileGuideline, type Profile } from "./profiles";

const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";

type ChatMsg = { role: "system" | "user" | "assistant"; content: any };

async function callGateway(messages: ChatMsg[], opts: { json?: boolean } = {}) {
  const rawKey = process.env.GEMINI_API_KEY?.trim();
  if (!rawKey) throw new Error("GEMINI_API_KEY not configured");
  
  // Suporta múltiplas chaves separadas por vírgula para balanceamento de carga
  const keys = rawKey.split(",").map(k => k.trim()).filter(Boolean);

  console.log(`[callGateway] Iniciando chamada para o modelo ${MODEL}...`);
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: Array.isArray(m.content)
        ? m.content.map((p: any) =>
            p.type === "image_url"
              ? {
                  inline_data: {
                    mime_type: p.image_url.url.split(";")[0].replace("data:", ""),
                    data: p.image_url.url.split(",")[1],
                  },
                }
              : { text: p.text ?? "" }
          )
        : [{ text: m.content }],
    }));

  const systemMsg = messages.find((m) => m.role === "system");

  const body: any = {
    contents,
    ...(systemMsg
      ? { system_instruction: { parts: [{ text: systemMsg.content }] } }
      : {}),
    ...(opts.json
      ? { generationConfig: { response_mime_type: "application/json" } }
      : {}),
  };

  const MAX_RETRIES = 3;
  let delay = 1500;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Sorteia a chave a cada tentativa. Se uma falhar por limite, a próxima tentativa pode pegar outra chave livre.
    const key = keys[Math.floor(Math.random() * keys.length)];
    
    try {
      console.log(`[callGateway] Aguardando fetch... (Tentativa ${attempt}/${MAX_RETRIES}) usando chave terminada em ...${key.slice(-4)}`);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      console.log(`[callGateway] Status da resposta: ${res.status}`);

      if (!res.ok) {
        const t = await res.text();
        console.error(`[callGateway] Erro da API na tentativa ${attempt}:`, t);
        
        // Se for erro 429 (Too Many Requests) ou erro de servidor 5xx, tentamos de novo
        if (res.status === 429 || res.status >= 500) {
          if (attempt === MAX_RETRIES) throw new Error("Limite de uso atingido ou servidor instável. Tente novamente em instantes.");
          // Exponential backoff
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        
        throw new Error(`Gemini API ${res.status}: ${t}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string;
      console.log(`[callGateway] Tamanho do texto gerado: ${text?.length || 0} caracteres`);
      return text;

    } catch (error: any) {
      if (attempt === MAX_RETRIES) throw error;
      console.error(`[callGateway] Falha de rede na tentativa ${attempt}:`, error.message);
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  
  throw new Error("Não foi possível conectar com a IA após múltiplas tentativas.");
}

function parseJSON<T = any>(raw: string): T {
  // 1. Tenta extrair de um bloco markdown ```json ... ```
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) {
    try {
      return JSON.parse(match[1].trim()) as T;
    } catch (e) {
      // Falhou, continua para a extração agressiva
    }
  }

  // 2. Extração agressiva testando blocos
  const str = match ? match[1] : raw;
  let searchIdx = 0;

  while (true) {
    const startObj = str.indexOf("{", searchIdx);
    const startArr = str.indexOf("[", searchIdx);
    
    let start = -1;
    if (startObj !== -1 && startArr !== -1) start = Math.min(startObj, startArr);
    else if (startObj !== -1) start = startObj;
    else if (startArr !== -1) start = startArr;

    if (start === -1) break;
    
    const isObj = str[start] === "{";
    const openChar = isObj ? "{" : "[";
    const closeChar = isObj ? "}" : "]";
    
    let depth = 0;
    let inString = false;
    let escape = false;
    
    for (let i = start; i < str.length; i++) {
      const char = str[i];
      
      if (inString) {
        if (escape) escape = false;
        else if (char === "\\") escape = true;
        else if (char === '"') inString = false;
      } else {
        if (char === '"') inString = true;
        else if (char === openChar) depth++;
        else if (char === closeChar) {
          depth--;
          if (depth === 0) {
            const jsonCandidate = str.substring(start, i + 1);
            try {
              return JSON.parse(jsonCandidate) as T;
            } catch (e2) {
              // Falso positivo (ex: "[Objeto A]" no texto). Quebra o for, continua o while.
              break;
            }
          }
        }
      }
    }
    
    searchIdx = start + 1;
  }

  // Fallback final
  try {
    return JSON.parse(raw.trim()) as T;
  } catch (e) {
    throw new Error(`Nenhum JSON válido encontrado na resposta da IA: ${(e as Error).message}`);
  }
}

export const extractMaterial = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        text: z.string().max(200_000).optional(),
        fileBase64: z.string().optional(),
        mimeType: z.string().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    let extracted = (data.text ?? "").trim();

    if (data.fileBase64 && data.mimeType) {
      const url = `data:${data.mimeType};base64,${data.fileBase64}`;
      const raw = await callGateway([
        {
          role: "system",
          content:
            "Você extrai conteúdo de estudo. Devolva APENAS o texto bruto, limpo, sem comentários. Mantenha definições, exemplos e listas. Se for imagem manuscrita ou PDF, transcreva fielmente.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia o conteúdo deste material:" },
            { type: "image_url", image_url: { url } },
          ],
        },
      ]);
      extracted = (raw ?? "").trim();
    }

    if (!extracted) throw new Error("Material vazio.");

    const topicRaw = await callGateway(
      [
        {
          role: "system",
          content:
            'Resuma em um título curto de no máximo 6 palavras o TEMA do material. Responda em JSON: {"topic":"..."}',
        },
        { role: "user", content: extracted.slice(0, 4000) },
      ],
      { json: true }
    );
    const { topic } = parseJSON<{ topic: string }>(topicRaw);

    return {
      text: extracted.slice(0, 60_000),
      topic: topic?.slice(0, 80) || "Material",
    };
  });

export const generateDiagnostic = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ 
      materialText: z.string().min(2), 
      topic: z.string().optional(),
      chapters: z.array(z.string()).optional(),
      numQuestions: z.number().min(1).max(20).optional()
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const num = data.chapters?.length || data.numQuestions || 3;
    
    const chaptersContext = data.chapters && data.chapters.length > 0 
      ? `Você deve criar exatamente 1 pergunta para cada um dos seguintes ${data.chapters.length} capítulos que serão estudados (na mesma ordem):\n${data.chapters.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nA pergunta de cada capítulo deve testar o conhecimento prévio do aluno ESPECIFICAMENTE sobre aquele tópico do roteiro.\n\n`
      : `Gere EXATAMENTE ${num} perguntas de múltipla escolha (4 opções cada), do mais simples ao mais avançado.\n\n`;

    const raw = await callGateway(
      [
        {
          role: "system",
          content:
            `Você cria um MICRO-DIAGNÓSTICO para medir o nível inicial do aluno sobre o assunto.\n\n${chaptersContext}IMPORTANTE: Se o material for muito curto (ex: "gatos fofinhos", "Segunda Guerra"), gere perguntas CONCEITUAIS sobre esse tema para testar o conhecimento de mundo do aluno. NUNCA faça perguntas de gramática, português ou interpretação textual do próprio título, a menos que o tema seja gramática. Responda APENAS JSON: {"questions":[{"q":"...","options":["A","B","C","D"],"answer":0,"why":"explicação curta"}]}`,
        },
        {
          role: "user",
          content: `Tema: ${data.topic || 'Não informado'}\n\nMaterial:\n\n${data.materialText.slice(0, 12_000)}`,
        },
      ],
      { json: true }
    );
    return parseJSON<{
      questions: { q: string; options: string[]; answer: number; why: string }[];
    }>(raw);
  });

export const generateExplanation = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        materialText: z.string().min(2),
        topic: z.string().min(1),
        profile: z.enum([
          "sistematico",
          "pragmatico",
          "explorador",
          "associativo",
          "investigativo",
          "concreto_guiado",
        ]),
        diagScore: z.number().min(0).max(1).optional(),
        plan: z
          .object({
            minutes: z.number().optional(),
            motivo: z.string().optional(),
            chatNote: z.string().nullable().optional(),
            chapters: z.array(z.string()).optional(),
          })
          .optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const score = data.diagScore ?? 0.5;
    const level =
      score < 0.34
        ? "iniciante"
        : score > 0.66
          ? "avançado"
          : "intermediário";
    const tempoMinutes = data.plan?.minutes ?? (score < 0.34 ? 60 : score > 0.66 ? 30 : 45);
    const tempo = `${tempoMinutes} minutos`;

    // Escala proporcional: pessoa lê ~200 palavras/min, mas estudo envolve pensar/reler → ~100 palavras/min efetivas
    let targetWords: number;
    let minParagraphs: number;
    let densityRule: string;
    let expandRule: string;
    let bodyExampleRule: string;
    let exploreRule: string;
    let diagramRule: string;

    if (tempoMinutes <= 5) {
      // Ultra-curto (1-5 min): pílula expressa
      targetWords = 150;
      minParagraphs = 1;
      densityRule = "ULTRA-RESUMIDO. O aluno tem menos de 5 minutos. Escreva o MÍNIMO ABSOLUTO necessário para transmitir o conceito central.";
      expandRule = `SEJA EXTREMAMENTE BREVE. O aluno escolheu apenas ${tempo}. Dê APENAS a definição central e 1 exemplo rápido. Nada mais. Corte tudo que não for essencial.`;
      bodyExampleRule = "Texto ultra-curto com apenas a essência do conceito e marcação de [[conceitos]].";
      exploreRule = "Vá DIRETO ao conceito principal em poucas frases. Não explore exceções, nuances ou contexto histórico.";
      diagramRule = "NÃO inclua diagramas. O tempo é muito curto para isso.";
    } else if (tempoMinutes <= 15) {
      // Curto (6-15 min): resumo objetivo
      targetWords = 400;
      minParagraphs = 2;
      densityRule = "DIRETO, RESUMIDO E SUCINTO. O aluno tem pouco tempo. Vá direto ao ponto, sem enrolação.";
      expandRule = `SEJA OBJETIVO. O aluno escolheu um tempo de estudo CURTO (${tempo}). Sintetize as informações mais vitais, forneça apenas 1 exemplo claro por conceito e vá direto ao ponto.`;
      bodyExampleRule = "Conteúdo resumido, direto ao ponto e objetivo, com marcação de [[conceitos]] essenciais.";
      exploreRule = "Vá direto aos conceitos principais. RESUMA o máximo que puder, focando no núcleo do assunto.";
      diagramRule = "Se possível, inclua 1 diagrama simples (Mermaid \\`\\`\\`mermaid ... \\`\\`\\` ou tabela Markdown) para sintetizar visualmente o conteúdo.";
    } else if (tempoMinutes <= 29) {
      // Médio-curto (16-29 min): explicação moderada
      targetWords = 800;
      minParagraphs = 3;
      densityRule = "MODERADO. Explique os conceitos com clareza, incluindo exemplos, mas sem se estender demais.";
      expandRule = `Mantenha um equilíbrio entre profundidade e objetividade. O aluno tem ${tempo}, então cubra os pontos principais com bons exemplos, mas não se perca em detalhes secundários.`;
      bodyExampleRule = "Conteúdo moderado com explicações claras, exemplos e marcação de [[conceitos]].";
      exploreRule = "Explique os conceitos principais com profundidade razoável. Inclua 1 exemplo por conceito, mas não se estenda em exceções ou debates.";
      diagramRule = "Em pelo menos 1 seção, inclua um DIAGRAMA (em sintaxe Mermaid \\`\\`\\`mermaid ... \\`\\`\\` ou Tabela Markdown estruturada). Nunca substitua o diagrama por texto.";
    } else if (tempoMinutes <= 59) {
      // Médio (30-59 min): explicação detalhada
      targetWords = 1500;
      minParagraphs = 4;
      densityRule = "DETALHADO. Explore os conceitos com profundidade, incluindo múltiplos exemplos e contexto.";
      expandRule = `O aluno tem ${tempo}. Aprofunde os argumentos, ofereça 2 exemplos por conceito e inclua contexto relevante.`;
      bodyExampleRule = "Conteúdo detalhado com múltiplos exemplos, contexto e marcação de [[conceitos]] para aprofundamento.";
      exploreRule = "Explore os conceitos com boa profundidade. Inclua variações e contexto, mas mantenha o foco no essencial.";
      diagramRule = "Em pelo menos 1 seção, inclua um DIAGRAMA OBRIGATÓRIO (em sintaxe Mermaid \\`\\`\\`mermaid ... \\`\\`\\` ou Tabela Markdown estruturada). O diagrama deve refletir a lógica do perfil do usuário. Nunca substitua o diagrama por texto.";
    } else if (tempoMinutes <= 119) {
      // Longo (60-119 min): explicação profunda
      targetWords = 2500;
      minParagraphs = 6;
      densityRule = "DENSO E PROFUNDO. Explore cada conceito exaustivamente com múltiplos exemplos, contrapontos e contexto histórico.";
      expandRule = `O tempo estimado é longo (${tempo}). Aprofunde argumentos, mostre contrapontos, ofereça 2 a 3 exemplos diferentes para o mesmo conceito.`;
      bodyExampleRule = "Conteúdo denso e profundo com marcação de [[conceitos]] para aprofundamento. Múltiplos parágrafos extensos por seção.";
      exploreRule = "Explore minuciosamente as exceções, nuances, contextos históricos e variações.";
      diagramRule = "Em pelo menos 1 seção, inclua um DIAGRAMA OBRIGATÓRIO (em sintaxe Mermaid \\`\\`\\`mermaid ... \\`\\`\\` ou Tabela Markdown estruturada). O diagrama deve refletir a lógica do perfil do usuário. Nunca substitua o diagrama por texto.";
    } else {
      // Muito longo (120+ min): enciclopédia
      targetWords = 4000;
      minParagraphs = 8;
      densityRule = "EXTREMAMENTE DENSO, PROFUNDO E LONGO. Você DEVE gerar um MÍNIMO ABSOLUTO DE 3.000 CARACTERES por seção/capítulo.";
      expandRule = `EXPANDA DRASTICAMENTE O TAMANHO DO TEXTO. Não produza capítulos superficiais. Aprofunde argumentos, mostre contrapontos, ofereça 2 a 3 exemplos diferentes para o mesmo conceito, detalhe a lógica interna. O tempo estimado é muito longo (${tempo}), portanto justifique isso com volume substancial de conhecimento útil.`;
      bodyExampleRule = "Conteúdo extremamente longo e denso com marcação de [[conceitos]] para aprofundamento. Múltiplos parágrafos grandes por seção.";
      exploreRule = "Explore minuciosamente as exceções, nuances, contextos históricos, debates acadêmicos ou variações. NÃO RESUMA.";
      diagramRule = "Em pelo menos 1 seção, inclua um DIAGRAMA OBRIGATÓRIO (em sintaxe Mermaid \\`\\`\\`mermaid ... \\`\\`\\` ou Tabela Markdown estruturada). O diagrama deve refletir a lógica do perfil do usuário. Nunca substitua o diagrama por texto.";
    }

    const guideline = profileGuideline(
      data.profile as Profile,
      data.topic,
      level,
      tempo
    );
    
    const motivoText = data.plan?.motivo ? `\nMotivo do estudo: ${data.plan.motivo}. Adapte o tom e o foco da explicação para este contexto.` : "";
    const extraContext = data.plan?.chatNote ? `\nObservação do aluno: "${data.plan.chatNote}". Leve isso estritamente em consideração.` : "";
    const chaptersText = data.plan?.chapters?.length ? `\nESTRUTURA DE CAPÍTULOS OBRIGATÓRIA:\nVocê DEVE gerar exatamente as seguintes seções (sections), com estes títulos:\n${data.plan.chapters.map(c => `- ${c}`).join('\n')}` : "";

    const raw = await callGateway(
      [
        {
          role: "system",
          content: `${guideline}${motivoText}${extraContext}${chaptersText}

Sua tarefa é gerar o material didático OBRIGATORIAMENTE em JSON exato.
ESTRUTURA DE CADA SEÇÃO (sections):
- Cada "body" (capítulo) deve conter texto contínuo, ${densityRule} O usuário solicitou um estudo de ${tempo}. Para suprir isso, você deve gerar aproximadamente ${targetWords} palavras no total, e cada seção deve ter pelo menos ${minParagraphs} parágrafos.
- ${exploreRule}
- ${diagramRule}


Responda APENAS JSON no formato exato:
{
  "title": "Título do Material",
  "intro": "1-2 parágrafos de abertura aplicando estritamente a regra do perfil escolhido.",
  "sections": [
    { 
       "heading": "Título da Seção", 
       "body": "${bodyExampleRule}"
    }
  ],
  "summary": "Fechamento curto e índice remissivo (explicando onde cada conceito foi introduzido).",
  "concepts": ["lista única de TODOS os conceitos com marcação [[ ]] encontrados no texto, sem duplicatas"]
}

Regras:
- Marque entre [[ ]] de 4 a 10 termos importantes ao longo do texto.
- Não invente fatos fora do material.
- ${expandRule}
- OBRIGATÓRIO: Como a resposta é JSON, você DEVE escapar TODAS as quebras de linha dentro das strings usando \\n. Ao gerar diagramas Mermaid, não quebre a linha literalmente; utilize \\n para separar as linhas do diagrama dentro da string. Também escape aspas duplas (\\") se necessário.
- Português do Brasil.`,
        },
        {
          role: "user",
          content: `Tópico: ${data.topic}\n\nMaterial:\n${data.materialText.slice(0, 16_000)}`,
        },
      ],
      { json: true }
    );
    return parseJSON<{
      title: string;
      intro: string;
      sections: { heading: string; body: string }[];
      summary: string;
      concepts: string[];
    }>(raw);
  });

export const generateSubExplanation = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        concept: z.string().min(1).max(120),
        materialText: z.string().min(2),
        profile: z.enum([
          "sistematico",
          "pragmatico",
          "explorador",
          "associativo",
          "investigativo",
          "concreto_guiado",
        ]),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const guideline = profileGuideline(data.profile as Profile);
    const raw = await callGateway([
      {
        role: "system",
        content: `Explique de forma SUCINTA (máx. 4 parágrafos) o conceito pedido, sempre dentro do contexto do material e no estilo do perfil. Diretriz: ${guideline}`,
      },
      {
        role: "user",
        content: `Conceito: "${data.concept}"\n\nContexto/material:\n${data.materialText.slice(0, 8000)}`,
      },
    ]);
    return { content: raw ?? "" };
  });

export const generateVerificationQuiz = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        materialText: z.string().min(2),
        explanationJson: z.string().min(2),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const raw = await callGateway(
      [
        {
          role: "system",
          content:
            'Gere EXATAMENTE 4 perguntas de múltipla escolha (4 opções) que verifiquem se o aluno compreendeu. Misture níveis (lembrar, aplicar, analisar). Responda APENAS JSON: {"questions":[{"q":"...","options":["..","..","..",".."],"answer":0,"why":"..."}]}',
        },
        {
          role: "user",
          content: `Material:\n${data.materialText.slice(0, 8000)}\n\nExplicação dada ao aluno:\n${data.explanationJson.slice(0, 8000)}`,
        },
      ],
      { json: true }
    );
    return parseJSON<{
      questions: { q: string; options: string[]; answer: number; why: string }[];
    }>(raw);
  });

export const generateStudyRoute = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        materialText: z.string().min(2),
        topic: z.string().min(1),
        profile: z.enum([
          "sistematico",
          "pragmatico",
          "explorador",
          "associativo",
          "investigativo",
          "concreto_guiado",
        ]),
        motivo: z.string().optional(),
        chatNote: z.string().nullable().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const motivoText = data.motivo && data.motivo !== "outros" ? `\nMotivo para estudar: ${data.motivo}.` : "";
    const extraContext = data.chatNote ? `\nRestrição/Comentário do aluno: "${data.chatNote}".` : "";

    const raw = await callGateway(
      [
        {
          role: "system",
          content: `Você é o Mestre de Planejamento da SincronIA.
O aluno tem o perfil cognitivo: ${data.profile}.
Seu objetivo é analisar o material fornecido e propor um Roteiro de Estudo inicial (tempo sugerido e capítulos) focado em maximizar o aprendizado desse perfil.
${motivoText}${extraContext}

Responda APENAS JSON no formato exato:
{
  "suggestedTime": 30,
  "summary": "Resumo de 1 a 2 linhas do que será ensinado e a estratégia.",
  "chapters": [
    "Título do capítulo 1",
    "Título do capítulo 2"
  ]
}

Regras:
- 'suggestedTime' deve ser um número inteiro (em minutos). Seja EXTREMAMENTE REALISTA com a complexidade do tema. Se for um assunto denso (ex: Cálculo 1, Física, Direito) e o motivo for "prova" ou "reforço", sugira o tempo total real que um ser humano levaria para estudar isso (pode ser 120, 180, 300 minutos ou mais). Não subestime o tempo. Temas simples ou "curiosidade" devem gerar tempos curtos (5 a 15 min).
- 'summary' deve explicar brevemente a abordagem.
- Os capítulos devem refletir a divisão do material para o perfil especificado.
- O número de tópicos em 'chapters' deve ser dinâmico e estritamente proporcional à complexidade do material e ao tempo. Siga esta escala OBRIGATÓRIA:
  * Até 5 minutos: gere EXATAMENTE 1 capítulo (pílula expressa).
  * 6-15 minutos: gere no máximo 2 capítulos.
  * 16-29 minutos: gere 2 a 3 capítulos.
  * 30-59 minutos: gere 3 a 5 capítulos.
  * 1-2 horas: gere 4 a 8 capítulos.
  * Mais de 2 horas: gere 6 a 12 ou mais capítulos para permitir um fracionamento real.`,
        },
        {
          role: "user",
          content: `Tópico: ${data.topic}\n\nMaterial:\n${data.materialText.slice(0, 16_000)}`,
        },
      ],
      { json: true }
    );
    return parseJSON<{
      suggestedTime: number;
      summary: string;
      chapters: string[];
    }>(raw);
  });

export const generateSessionReport = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        topic: z.string().min(1),
        profile: z.string(),
        score: z.number(),
        quizData: z.array(z.any()),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const raw = await callGateway([
      {
        role: "system",
        content: `Você é o tutor da SincronIA. Gere um RELATÓRIO SIMPLES E CURTO (1 a 2 parágrafos no máximo) sobre o desempenho do aluno no teste de verificação.
Perfil do aluno: ${data.profile}. Adapte o tom da mensagem para o estilo de aprendizado desse perfil.
Se o aluno tiver um desempenho ruim (abaixo de 60%), seja DIRETO e HONESTO ao dizer que o desempenho não foi bom e que ele precisa revisar o conteúdo. Não diga que ele "entendeu bem" se a nota for baixa. Se o desempenho for bom, parabenize-o de forma clara.
Use o tópico estudado e os erros/acertos fornecidos para dar um feedback personalizado e construtivo, mostrando exatamente o que ele errou.
Não crie listas, apenas texto corrido e amigável em Português do Brasil. Devolva apenas o texto do relatório, sem formatação JSON.`,
      },
      {
        role: "user",
        content: `Tópico: ${data.topic}\nNota: ${Math.round(data.score * 100)}%\n\nResumo do Teste (Pergunta, Resposta Certa, Resposta do Aluno):\n${JSON.stringify(data.quizData, null, 2)}`,
      },
    ]);
    return raw?.trim() || "Você concluiu este estudo. Parabéns pela dedicação!";
  });