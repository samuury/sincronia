import React from "react";

export function RichText({ content }: { content: string }) {
  // Regex para encontrar blocos mermaid, negrito, marca-texto ou tabelas markdown
  const regex = /```\s*[mM]ermaid\s*([\s\S]*?)(?:```|$)|\*\*(.*?)\*\*|\[\[(.*?)\]\]|((?:(?:^|\n)[ \t]*\|.*?\|[ \t]*(?=\n|$))+)/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Texto normal antes do match
    if (match.index > lastIndex) {
      elements.push(content.substring(lastIndex, match.index));
    }

    if (match[1]) {
      // Bloco Mermaid
      // Para evitar erro de hidratação no servidor (TanStack Start), renderiza dinamicamente se quisermos,
      // mas vamos renderizar via cliente no useEffect dentro do componente Mermaid.
      const MermaidComponent = React.lazy(() => import("./Mermaid").then(m => ({ default: m.Mermaid })));
      elements.push(
        <React.Suspense fallback={<div className="animate-pulse bg-secondary h-32 rounded-2xl my-4"></div>} key={match.index}>
          <MermaidComponent chart={match[1].trim()} />
        </React.Suspense>
      );
    } else if (match[2]) {
      // É negrito
      elements.push(<strong key={match.index} className="font-extrabold text-foreground">{match[2]}</strong>);
    } else if (match[3]) {
      // É marca-texto
      elements.push(
        <span 
          key={match.index} 
          className="text-primary font-bold cursor-pointer hover:underline"
        >
          {match[3]}
        </span>
      );
    } else if (match[4]) {
      // Tabela Markdown
      const rawTable = match[4].trim();
      const lines = rawTable.split('\n').map(l => l.trim());
      const extractCells = (line: string) => {
        const cleaned = line.replace(/^\||\|$/g, '');
        return cleaned.split('|').map(c => c.trim());
      };
      
      const headers = extractCells(lines[0]);
      const hasSeparator = lines[1] && (lines[1].includes('---') || lines[1].includes(':-'));
      const bodyStart = hasSeparator ? 2 : 1;
      const bodyLines = lines.slice(bodyStart).map(extractCells);

      elements.push(
        <div className="overflow-x-auto my-6" key={match.index}>
          <table className="w-full border-collapse text-sm text-left rounded-xl overflow-hidden shadow-sm border border-border">
            <thead className="bg-secondary/60 text-foreground font-bold">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-4 py-3 border-b border-border">
                    <RichText content={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyLines.map((row, i) => (
                <tr key={i} className="hover:bg-secondary/20 transition-colors border-b border-border last:border-0">
                  {row.map((cell, j) => (
                     <td key={j} className="px-4 py-3">
                      <RichText content={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    lastIndex = regex.lastIndex;
  }

  // Restante do texto
  if (lastIndex < content.length) {
    elements.push(content.substring(lastIndex));
  }

  return <>{elements}</>;
}
