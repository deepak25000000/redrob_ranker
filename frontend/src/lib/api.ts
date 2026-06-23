const API_BASE = (import.meta.env.VITE_API_URL || 'https://deepak2525-redrob-ranker.hf.space').replace(/\/$/, '');

export function apiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}
