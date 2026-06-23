// In dev mode, Vite proxy forwards /api to the backend (see vite.config.ts).
// In production (Docker / HF Spaces), the API is served from the same origin.
// Only use an explicit external URL if VITE_API_URL is set.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}
