export type StudyHistoryItem = {
  id: string;
  topic: string;
  date: string;
  pending: any;
  cache: any;
};

export function saveToHistory(topic: string, pending: any, cache: any) {
  const history = getHistory();
  const id = Date.now().toString();
  const item: StudyHistoryItem = {
    id,
    topic: topic || "Estudo sem título",
    date: new Date().toISOString(),
    pending,
    cache,
  };
  
  // Mantemos apenas os 6 estudos mais recentes para evitar estourar o limite de 5MB do localStorage
  const newHistory = [item, ...history.filter(h => h.topic !== item.topic)].slice(0, 6);
  
  try {
    localStorage.setItem("sincronia:history", JSON.stringify(newHistory));
  } catch (e) {
    console.warn("Não foi possível salvar o histórico localmente (Quota excedida?)", e);
  }
}

export function getHistory(): StudyHistoryItem[] {
  try {
    const raw = localStorage.getItem("sincronia:history");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}
