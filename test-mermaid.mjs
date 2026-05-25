import mermaid from 'mermaid';

const chart = `graph TD
    A[Antigo Regime (Monarquia Absoluta, Três Estados, Privilégios)] --> B(Crise Financeira e Econômica)
    A --> C(Desigualdade Social e Fiscal)
    D[Ideias Iluministas (Liberdade, Igualdade, Soberania Popular)] --> E(Descontentamento Burguês e Popular)
    B --> F(Convocação dos Estados Gerais)
    C --> E
    E --> F
    F --> G{Impasse nos Estados Gerais}
    G --> H[Formação da Assembleia Nacional]
    H --> I(Juramento do Jogo da Pela)
    I --> J(Queda da Bastilha - 14/07/1789)
    J --> K[Declaração dos Direitos do Homem e do Cidadão]
    K --> L(Monarquia Constitucional - Fase 1)
    L --> M(Abolição da Monarquia e Proclamação da República - Fase 2)
    M --> N(Período do Terror)
    N --> O(Instabilidade Política)
    O --> P(Golpe de 18 de Brumário)
    P --> Q(Diretório e Consulado - Fase 3)
    Q --> R(Ascensão de Napoleão Bonaparte)`;

async function test() {
  mermaid.initialize({ startOnLoad: false });
  try {
    let cleanChart = chart.replace(/```/g, '').trim();
    // Adiciona aspas em rótulos de colchetes e parênteses para evitar erros de sintaxe
    cleanChart = cleanChart
      .replace(/([A-Za-z0-9_]+)\[([^"\]]+)\]/g, '$1["$2"]')
      .replace(/([A-Za-z0-9_]+)\(([^"\)]+)\)/g, '$1("$2")')
      .replace(/([A-Za-z0-9_]+)\{([^"\}]+)\}/g, '$1{"$2"}');
    await mermaid.parse(cleanChart);
    console.log("PARSED OK");
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}

test();
