import https from "node:https";

const profileGuideline = (profile, topic, level, tempo) => {
  const p = profile || "sistematico";
  
  if (p === "sistematico") return `Você é um professor Sistemático. Ensine o tópico ${topic} de forma lógica, passo-a-passo. Use listas claras e explique os fundamentos antes das aplicações avançadas. Mantenha um tom acadêmico mas acessível.`;
  if (p === "pragmatico") return `Você é um professor Pragmático. Ensine o tópico ${topic} indo direto ao ponto. Foque estritamente em como isso é usado na prática, exemplos reais e resultados. Corte introduções teóricas desnecessárias.`;
  if (p === "explorador") return `Você é um professor Explorador. Ensine o tópico ${topic} de forma criativa, conectando ideias de diferentes áreas. Faça analogias inusitadas e instigue a curiosidade e o pensamento "fora da caixa".`;
  if (p === "associativo") return `Você é um professor Associativo. Ensine o tópico ${topic} contando uma história fluida, conectando os fatos de forma que um leve naturalmente ao próximo. Use metáforas do dia a dia e evite jargões isolados.`;
  if (p === "investigativo") return `Você é um professor Investigativo. Ensine o tópico ${topic} no formato de perguntas e respostas (Sócrates). Levante problemas e mostre como a solução foi descoberta. Foque no "porquê" as coisas funcionam assim.`;
  if (p === "concreto_guiado") return `Você é um professor Concreto e Guiado. Ensine o tópico ${topic} com linguagem extremamente simples. Dê exemplos palpáveis e físicos. Avance bem devagar, com bastante repetição dos conceitos principais.`;

  return `Ensine o tópico ${topic} de forma clara.`;
};

export async function handleStreamChapter(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      
      const rawKey = process.env.CLAUDE_API_KEY?.trim();
      if (!rawKey) throw new Error("CLAUDE_API_KEY not configured");
      const keys = rawKey.split(",").map(k => k.trim()).filter(Boolean);
      const CLAUDE_MODEL = process.env.CLAUDE_MODEL?.trim() || "claude-3-5-sonnet-20241022";
      const key = keys[Math.floor(Math.random() * keys.length)];

      const score = data.diagScore ?? 0.5;
      const level = score < 0.34 ? "iniciante" : score > 0.66 ? "avançado" : "intermediário";

      const targetChars = data.targetChars || 3000;
      const targetWords = Math.floor(targetChars / 6);
      
      let densityRule = "Escreva parágrafos diretos e claros.";
      let diagramRule = "NÃO use diagramas Mermaid nesta seção curta.";
      
      if (targetChars > 3000) {
        densityRule = "Você tem muito espaço. Desenvolva as ideias com extrema profundidade, múltiplos exemplos concretos, analogias e casos de uso.";
        diagramRule = "VOCÊ DEVE INCLUIR PELO MENOS UM DIAGRAMA (Tabela Markdown ou Mermaid estrito \\`\\`\\`mermaid ... \\`\\`\\`) para enriquecer essa seção longa.";
      }

      const guideline = profileGuideline(data.profile, data.topic, level, "focado neste capítulo específico");

      const systemPrompt = `${guideline}

Sua tarefa é escrever OBRIGATORIAMENTE em Markdown puro APENAS o conteúdo do capítulo "${data.chapterHeading}".

ESTRUTURA DESTE CAPÍTULO:
- Você DEVE escrever um volume de texto contínuo de NO MÁXIMO ${targetChars} caracteres (${targetWords} palavras). IMPORTANTE: Seja preciso e NÃO ultrapasse essa meta. 
- ${densityRule}
- OBRIGATÓRIO: Separe o texto em parágrafos longos com DUAS quebras de linha (\\n\\n).
- ${diagramRule}
- Marque entre [[ ]] de 1 a 4 termos importantes ao longo do texto.
- No final do texto, crie uma seção "## Referências Bibliográficas" com 1 a 3 fontes (isso não entra na contagem principal).
- REGRAS DE PENALIDADE: Se você escrever muito mais que ${targetChars + 500} caracteres, sua resposta será REJEITADA.

Responda APENAS com o Markdown do capítulo. Não mande JSON. Português do Brasil.`;

      const messages = [
        {
          role: "user",
          content: `Escreva APENAS o capítulo "${data.chapterHeading}" do tema ${data.topic}.\n\nMaterial base para pesquisa:\n${(data.materialText || "").slice(0, 16_000)}`,
        },
      ];

      const payload = JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: Math.ceil((targetChars * 1.5) / 4),
        system: systemPrompt,
        messages: messages,
        stream: true
      });

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const anthropicReq = https.request(options, (anthropicRes) => {
        anthropicRes.on('data', (chunk) => {
          res.write(chunk);
        });
        anthropicRes.on('end', () => {
          res.end();
        });
      });

      anthropicReq.on('error', (e) => {
        console.error("[stream-handler] API Error:", e);
        res.end();
      });

      anthropicReq.write(payload);
      anthropicReq.end();
      
    } catch (err) {
      console.error("[stream-handler] Error:", err);
      res.statusCode = 500;
      res.end();
    }
  });
}
