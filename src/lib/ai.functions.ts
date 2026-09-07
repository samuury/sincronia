import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { profileGuideline, type Profile } from "./profiles";

type ChatMsg = { role: "system" | "user" | "assistant"; content: any };

async function callGateway(messages: ChatMsg[], opts: { json?: boolean; tier?: "fast" | "smart"; maxTokens?: number } = {}) {
  const tier = opts.tier || "fast";

  const rawKey = process.env.CLAUDE_API_KEY?.trim();
  if (!rawKey) throw new Error("CLAUDE_API_KEY not configured");
  const keys = rawKey.split(",").map((k) => k.trim()).filter(Boolean);

  const model =
    tier === "smart"
      ? process.env.CLAUDE_MODEL?.trim() || "claude-3-5-sonnet-20241022"
      : process.env.CLAUDE_FAST_MODEL?.trim() || "claude-haiku-4-5-20251001";

  console.log(`[callGateway/Claude/${tier.toUpperCase()}] Iniciando chamada para o modelo ${model}...`);
  const systemMsg = messages.find((m) => m.role === "system");
  let systemContent = systemMsg ? String(systemMsg.content) : "";
  if (opts.json && !systemContent.includes("JSON")) {
    systemContent = systemContent
      ? `${systemContent}\n\nResponda ESTRITAMENTE em formato JSON válido, sem texto adicional.`
      : "Responda ESTRITAMENTE em formato JSON válido, sem texto adicional.";
  }

  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: Array.isArray(m.content)
        ? m.content.map((p: any) => {
            if (p.type === "image_url") {
              const url = p.image_url?.url || "";
              const mediaType = url.split(";")[0].replace("data:", "") || "image/jpeg";
              const data = url.split(",")[1] || "";
              const isPdf = mediaType === "application/pdf";
              return isPdf
                ? {
                    type: "document",
                    source: {
                      type: "base64",
                      media_type: "application/pdf",
                      data,
                    },
                  }
                : {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mediaType,
                      data,
                    },
                  };
            }
            return { type: "text", text: p.text ?? "" };
          })
        : [{ type: "text", text: String(m.content) }],
    }));

  const defaultMaxTokens = tier === "smart" ? 8192 : 4096;
  const body: any = {
    model,
    max_tokens: opts.maxTokens || defaultMaxTokens,
    messages: contents,
  };
  if (systemContent) body.system = systemContent;

  const MAX_RETRIES = 3;
  let delay = 1500;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const key = keys[Math.floor(Math.random() * keys.length)];
    try {
      console.log(`[callGateway/Claude] Aguardando fetch... (Tentativa ${attempt}/${MAX_RETRIES}) modelo=${model} usando chave terminada em ...${key.slice(-4)}`);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error(`[callGateway/Claude] Erro da API na tentativa ${attempt}:`, t);
        if (res.status === 429 || res.status >= 500) {
          if (attempt === MAX_RETRIES) throw new Error("Limite de uso atingido ou servidor instável. Tente novamente em instantes.");
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        throw new Error(`Claude API ${res.status}: ${t}`);
      }

      const data = await res.json();
      const text = data?.content?.[0]?.text as string;
      console.log(`[callGateway/Claude] Tamanho do texto gerado: ${text?.length || 0} caracteres`);
      return text;
    } catch (error: any) {
      if (attempt === MAX_RETRIES) throw error;
      console.error(`[callGateway/Claude] Falha na tentativa ${attempt}:`, error.message);
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error("Não foi possível conectar com a IA após múltiplas tentativas.");
}

function sanitizeJSON(str: string): string {
  let res = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (inStr) {
      if (esc) { res += char; esc = false; }
      else if (char === "\\") { res += char; esc = true; }
      else if (char === '"') { res += char; inStr = false; }
      else if (char === '\n') { res += '\\n'; }
      else if (char === '\r') { res += '\\r'; }
      else if (char === '\t') { res += '\\t'; }
      else { res += char; }
    } else {
      if (char === '"') inStr = true;
      res += char;
    }
  }
  return res;
}

function parseJSON<T = any>(raw: string): T {
  let cleanedRaw = raw.trim();
  
  // Remove markdown code block markers even if incomplete
  if (cleanedRaw.startsWith("```json")) {
    cleanedRaw = cleanedRaw.substring(7).trim();
  } else if (cleanedRaw.startsWith("```")) {
    cleanedRaw = cleanedRaw.substring(3).trim();
  }
  if (cleanedRaw.endsWith("```")) {
    cleanedRaw = cleanedRaw.substring(0, cleanedRaw.length - 3).trim();
  }

  // 1. Tenta extrair de um bloco markdown ```json ... ``` (caso tenha texto antes)
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) {
    try {
      return JSON.parse(sanitizeJSON(match[1].trim())) as T;
    } catch (e) {
      // Falhou, continua para a extração agressiva
    }
  }

  // 2. Extração agressiva testando blocos
  const str = sanitizeJSON(match ? match[1] : cleanedRaw);
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
    return JSON.parse(sanitizeJSON(cleanedRaw)) as T;
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
      minutes: z.number().optional(),
      numQuestions: z.number().min(1).max(20).optional()
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const timeText = data.minutes ? `O aluno pretende estudar por ${data.minutes} minutos.` : "";
    const chaptersText = data.chapters?.length ? `O roteiro do aluno tem ${data.chapters.length} capítulos:\n${data.chapters.map(c => `- ${c}`).join('\n')}` : "";
    
    const chaptersContext = `Crie uma quantidade de perguntas ADEQUADA ao tempo de estudo e ao tamanho do roteiro, sendo no MÁXIMO 8 perguntas.\n${timeText}\n${chaptersText}\n\nAs perguntas devem testar o conhecimento prévio do aluno sobre os tópicos.\n\n`;

    const raw = await callGateway(
      [
        {
          role: "system",
          content:
            `Você cria um MICRO-DIAGNÓSTICO para medir o nível inicial do aluno sobre o assunto.\n\n${chaptersContext}IMPORTANTE: As perguntas devem ser ALTAMENTE DESAFIADORAS (nível avançado a especialista) para realmente testar se o aluno já domina o tema profundamente. Exija pensamento crítico, resolução de problemas complexos ou conhecimento avançado. Evite perguntas óbvias ou fáceis. Se o material for muito curto, gere perguntas conceituais difíceis sobre o tema. NUNCA faça perguntas de interpretação textual do próprio título. Responda APENAS JSON: {"questions":[{"q":"...","options":["A","B","C","D"],"answer":0,"why":"explicação curta"}]}`,
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

export const generateExplanationOutline = createServerFn({ method: "POST" })
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
        tier: z.enum(["fast", "smart"]).optional(),
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
    
    // We only need basic target calculation for the outline, mostly to decide how many chapters
    const tempoMinutes = data.plan?.minutes ?? (score < 0.34 ? 60 : score > 0.66 ? 30 : 45);
    const tempo = `${tempoMinutes} minutos`;
    
    // Teto e piso estritos de capítulos com base no tempo total de estudo
    let minAllowedChapters = 1;
    let maxAllowedChapters = 3;
    if (tempoMinutes <= 10) {
      minAllowedChapters = 1;
      maxAllowedChapters = 1;
    } else if (tempoMinutes <= 20) {
      minAllowedChapters = 1;
      maxAllowedChapters = 2;
    } else if (tempoMinutes <= 35) {
      minAllowedChapters = 2;
      maxAllowedChapters = 3;
    } else if (tempoMinutes <= 60) {
      minAllowedChapters = 3;
      maxAllowedChapters = 4;
    } else if (tempoMinutes <= 90) {
      minAllowedChapters = 4;
      maxAllowedChapters = 6;
    } else {
      minAllowedChapters = 5;
      maxAllowedChapters = Math.min(10, Math.max(5, Math.round(tempoMinutes / 15)));
    }

    const guideline = profileGuideline(
      data.profile as Profile,
      data.topic,
      level,
      tempo
    );
    
    const motivoText = data.plan?.motivo ? `\nMotivo do estudo: ${data.plan.motivo}.` : "";
    const extraContext = data.plan?.chatNote ? `\nObservação do aluno: "${data.plan.chatNote}".` : "";

    const hasSpecificChapters = Array.isArray(data.plan?.chapters) && (data.plan?.chapters?.length ?? 0) > 0;
    const safePlanChapters = data.plan?.chapters ?? [];
    const chaptersText = hasSpecificChapters
      ? `\nESTRUTURA DE CAPÍTULOS OBRIGATÓRIA (SEGUIDA À RISCA):\nVocê DEVE gerar exatamente as seguintes ${safePlanChapters.length} seções (sections), com estes títulos exatos e NENHUMA A MAIS:\n${safePlanChapters.map((c: string) => `- ${c}`).join('\n')}`
      : `\nREQUISITO ESTRITO DE QUANTIDADE DE CAPÍTULOS:\nO aluno tem apenas ${tempo} para estudar. Portanto, você DEVE gerar entre ${minAllowedChapters} e NO MÁXIMO ${maxAllowedChapters} capítulos no total.\nSe o assunto tiver múltiplos fatos ou períodos históricos, você DEVE AGRUPÁ-LOS em blocos conceituais consolidados (ex: "Origens e Período Inicial", "Desenvolvimento e Consolidação", etc.). É ESTRITAMENTE PROIBIDO gerar mais de ${maxAllowedChapters} seções no JSON.`;

    const raw = await callGateway(
      [
        {
          role: "system",
          content: `${guideline}${motivoText}${extraContext}${chaptersText}

Sua tarefa é gerar APENAS O ESQUELETO (Outline) do material didático OBRIGATORIAMENTE em JSON exato.
NÃO ESCREVA O CORPO (body) DOS CAPÍTULOS. Deixe todos os campos "body" como strings vazias ("").
NÃO COLOQUE REFERÊNCIAS AINDA. Deixe "references" como um array vazio ([]).

REGRAS DE QUANTIDADE DE SEÇÕES:
${hasSpecificChapters ? `- Siga RIGOROSAMENTE a lista de capítulos obrigatória fornecida (${safePlanChapters.length} capítulos).` : `- O array "sections" DEVE conter no máximo ${maxAllowedChapters} elementos. NÃO crie capítulos curtos fragmentados. Prefira poucos capítulos consolidados e bem estruturados.`}

Responda APENAS JSON no formato exato:
{
  "title": "Título do Material",
  "intro": "1-2 parágrafos de introdução aplicando estritamente a regra do perfil escolhido.",
  "sections": [
    { 
       "id": "chap-1",
       "heading": "Título da Seção", 
       "body": "",
       "references": []
    }
  ],
  "summary": "Fechamento curto e índice remissivo.",
  "concepts": ["lista única de TODOS os conceitos principais que serão abordados na aula, sem duplicatas"]
}
`,
        },
        {
          role: "user",
          content: `Tópico: ${data.topic}\n\nMaterial:\n${data.materialText.slice(0, 16_000)}`,
        },
      ],
      { json: true, tier: "fast" } // Outline is always fast to save time and money
    );
    const result = parseJSON<{
      title: string;
      intro: string;
      sections: { id?: string; heading: string; body: string; references?: string[] }[];
      summary: string;
      concepts: string[];
    }>(raw);

    if (!result || !result.sections) {
      throw new Error("Falha ao gerar a estrutura do material.");
    }
    
    // Se a IA gerou mais capítulos do que o limite permitido para o tempo (e não havia roteiro fixo), limitamos ao teto
    if (!hasSpecificChapters && result.sections.length > maxAllowedChapters) {
      result.sections = result.sections.slice(0, maxAllowedChapters);
    }

    // Ensure every section has an ID
    result.sections = result.sections.map((s, idx) => ({
      ...s,
      id: s.id || `chap-${idx + 1}`,
      body: "",
      references: []
    }));

    return result;
  });

export const generateChapterBody = createServerFn({ method: "POST" })
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
        chapterHeading: z.string().min(1),
        targetChars: z.number().min(100),
        tier: z.enum(["fast", "smart"]).optional(),
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

    const targetWords = Math.floor(data.targetChars / 6);
    
    let densityRule = "DETALHADO. Explore o conceito com profundidade e contexto.";
    let bodyExampleRule = "Conteúdo detalhado com exemplos e marcação de [[conceitos]].";
    let diagramRule = "NÃO substitua texto por diagrama. Mas inclua diagramas Markdown ou Mermaid se ajudarem na compreensão visual.";

    if (data.targetChars <= 3500) {
      densityRule = "ESTRITAMENTE CONCISO E DIRETO. O alvo deste capítulo é curto. Vá direto ao ponto, evite enrolação e sumarize os conceitos.";
      bodyExampleRule = "Texto conciso, indo direto à essência, com 1 exemplo claro.";
    }

    if (data.targetChars <= 1500) {
      densityRule = "RESUMIDO. O alvo deste capítulo é curto. Seja objetivo e não enrole.";
      bodyExampleRule = "Resuma as principais ideias com 1 exemplo claro.";
    } else if (data.targetChars >= 5000) {
      densityRule = "DENSO E PROFUNDO. O alvo deste capítulo é bem longo. Você deve gerar múltiplos exemplos, contrapontos e contexto histórico.";
      bodyExampleRule = "Aprofunde a teoria ABSURDAMENTE e ofereça no mínimo 2 a 3 exemplos diferentes.";
      diagramRule = "VOCÊ DEVE INCLUIR PELO MENOS UM DIAGRAMA (Tabela Markdown ou Mermaid estrito \\`\\`\\`mermaid ... \\`\\`\\`) para enriquecer essa seção longa.";
    }

    const guideline = profileGuideline(
      data.profile as Profile,
      data.topic,
      level,
      "focado neste capítulo específico"
    );
    
    const raw = await callGateway(
      [
        {
          role: "system",
          content: `${guideline}

Sua tarefa é escrever OBRIGATORIAMENTE em JSON exato APENAS o conteúdo do capítulo "${data.chapterHeading}".

ESTRUTURA DESTE CAPÍTULO:
- Você DEVE escrever um volume de texto contínuo de NO MÁXIMO ${data.targetChars.toLocaleString('pt-BR')} caracteres (${targetWords.toLocaleString('pt-BR')} palavras). IMPORTANTE: Seja preciso e NÃO ultrapasse essa meta. 
- ${densityRule}
- OBRIGATÓRIO: Dentro do campo "body", separe o texto em parágrafos longos com DUAS quebras de linha (\\n\\n).
- ${diagramRule}
- Marque entre [[ ]] de 1 a 4 termos importantes ao longo do texto.
- Inclua de 1 a 3 fontes bibliográficas em "references" (não entram na contagem de caracteres).
- Conclua SEMPRE o seu raciocínio com ponto final. NUNCA termine com frases incompletas ou cortadas.
- REGRAS DE PENALIDADE: Se você escrever mais que ${data.targetChars + 500} caracteres, sua resposta será REJEITADA.

Responda APENAS JSON no formato exato:
{
  "body": "${bodyExampleRule}",
  "references": ["Autor, A. Obra.", "Outra fonte."]
}

Regras JSON: Escape TODAS as quebras de linha como \\n dentro do "body" e "references".
Português do Brasil.`,
        },
        {
          role: "user",
          content: `Escreva APENAS o capítulo "${data.chapterHeading}" do tema ${data.topic}.\n\nMaterial base para pesquisa:\n${data.materialText.slice(0, 16_000)}`,
        },
      ],
      { json: true, tier: data.tier ?? "smart", maxTokens: Math.min(4096, Math.max(1500, Math.ceil((data.targetChars * 2.5) / 4))) }
    );
    
    const result = parseJSON<{
      body: string;
      references: string[];
    }>(raw);

    if (!result || !result.body) {
      throw new Error("Falha ao gerar o corpo do capítulo.");
    }
    
    return result;
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

export const suggestStudyTime = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        materialText: z.string().min(2),
        topic: z.string().min(1),
        motivo: z.string().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const motivoText = data.motivo && data.motivo !== "outros" ? `\nMotivo para estudar: ${data.motivo}.` : "";

    const raw = await callGateway(
      [
        {
          role: "system",
          content: `Você é um analista de estudos.
O aluno quer estudar o material fornecido.${motivoText}
Seu único objetivo é ler o texto e calcular realisticamente quanto tempo (em minutos) um humano demoraria para estudar e aprender isso nesta sessão.
- Seja EXTREMAMENTE REALISTA com a complexidade.
- Sugira o tempo de uma sessão de estudos contínua (ex: 15, 60, 120, 180, no máximo 300 minutos).
- EXEMPLOS DE CALIBRAGEM: Se o tema for denso e complexo como "Cálculo 1", sugira cerca de 300 minutos (5 horas). Se for um tema simples ou trivial como "Por que gatos são fofos?", sugira no máximo 15 minutos.
Responda APENAS JSON no formato exato:
{
  "suggestedTime": 30
}`,
        },
        {
          role: "user",
          content: `Material:\n${data.materialText.slice(0, 16_000)}`,
        },
      ],
      { json: true } // Tier "fast" by default (Claude Haiku)
    );
    return parseJSON<{
      suggestedTime: number;
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
        targetMinutes: z.number().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const motivoText = data.motivo && data.motivo !== "outros" ? `\nMotivo para estudar: ${data.motivo}.` : "";
    const extraContext = data.chatNote ? `\nRestrição/Comentário do aluno: "${data.chatNote}".` : "";
    const targetText = data.targetMinutes ? `\nATENÇÃO: O aluno definiu o tempo de estudo para EXATAMENTE ${data.targetMinutes} minutos. Você DEVE retornar a propriedade "suggestedTime" com o valor exato de ${data.targetMinutes}. Dimensione o número de capítulos e a densidade de forma extremamente realista para caber nesse tempo selecionado.` : "";

    const raw = await callGateway(
      [
        {
          role: "system",
          content: `Você é o Mestre de Planejamento da SincronIA.
O aluno tem o perfil cognitivo: ${data.profile}.
Seu objetivo é analisar o material fornecido e propor um Roteiro de Estudo inicial (tempo sugerido e capítulos) focado em maximizar o aprendizado desse perfil.
${motivoText}${extraContext}${targetText}

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
  * 30-59 minutos: gere 3 a 6 capítulos.
  * 1-2 horas: gere 5 a 10 capítulos.
  * 2-3 horas: gere 8 a 15 capítulos.
  * Mais de 3 horas: gere 12 a 20 ou mais capítulos. (Isso é CRUCIAL para forçar um fracionamento massivo).`,
        },
        {
          role: "user",
          content: `Tópico: ${data.topic}\n\nMaterial:\n${data.materialText.slice(0, 16_000)}`,
        },
      ],
      { json: true, tier: "smart" }
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

export const generateExplanation = createServerFn({ method: "POST" })
  .handler(async () => {
    throw new Error("Essa rota foi descontinuada. Use a nova arquitetura de streaming no SincronIA.");
  });