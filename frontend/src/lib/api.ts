let API_BASE = import.meta.env.VITE_API_URL || '';

if (!API_BASE) {
  if (import.meta.env.DEV) {
    API_BASE = 'http://localhost:8000';
  } else if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (window.location.port !== '8000') {
        API_BASE = 'http://localhost:8000';
      }
    } else if (!window.location.hostname.includes('hf.space')) {
      // Bulletproof fallback: If deployed on Vercel or Netlify without VITE_API_URL,
      // route requests to the known Hugging Face backend instead of failing with index.html
      API_BASE = 'https://deepak2525-redrob-ranker.hf.space';
    }
  }
}

API_BASE = API_BASE.replace(/\/$/, '');

export function apiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}
