import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

export function Mermaid({ chart }: { chart: string }) {
  const [svgStr, setSvgStr] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const renderMermaid = async () => {
      try {
        let cleanChart = chart.replace(/```/g, '').trim();
        // Protege contra erros de sintaxe (parênteses soltos gerados pela IA sem aspas)
        cleanChart = cleanChart
          .replace(/([A-Za-z0-9_]+)\[([^"\]]+)\]/g, '$1["$2"]')
          .replace(/([A-Za-z0-9_]+)\(([^"\)]+)\)/g, '$1("$2")')
          .replace(/([A-Za-z0-9_]+)\{([^"\}]+)\}/g, '$1{"$2"}');
          
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, cleanChart);
        if (isMounted) {
          setSvgStr(svg);
        }
      } catch (err: any) {
        console.error("Mermaid rendering failed", err);
        if (isMounted) {
          setError(chart.replace(/```/g, '').trim());
        }
      }
    };
    
    renderMermaid();
    return () => { isMounted = false; };
  }, [chart]);

  if (error) {
    return (
      <div className="my-6 rounded-2xl border-2 border-red-500/50 bg-red-500/10 p-4 overflow-x-auto text-left text-sm text-foreground/80 font-mono">
        <div className="text-red-500 font-bold mb-2">Erro ao renderizar diagrama:</div>
        <pre>{error}</pre>
      </div>
    );
  }

  if (!svgStr) {
    return <div className="animate-pulse bg-secondary h-32 rounded-2xl my-4 flex items-center justify-center text-muted-foreground font-medium">Carregando diagrama...</div>;
  }

  return (
    <div 
      className="mermaid-container my-6 rounded-2xl border-2 border-border bg-card p-4 shadow-[0_4px_0_0_var(--border)] overflow-x-auto flex justify-center"
      dangerouslySetInnerHTML={{ __html: svgStr }}
    />
  );
}
