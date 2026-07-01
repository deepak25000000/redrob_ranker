import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, AlertTriangle, Ban, ArrowLeft, Flag } from 'lucide-react';
import { apiUrl } from '../lib/api';

interface HoneypotEntry {
  candidate_id: string;
  flags: string[];
}

export default function Honeypots() {
  const [data, setData] = useState<HoneypotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(apiUrl('/api/honeypots'))
      .then(res => {
        if (!res.ok) throw new Error('Failed to load honeypot registry.');
        return res.json();
      })
      .then(d => {
        setData(d.excluded || []);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(h =>
      h.candidate_id?.toLowerCase().includes(q) ||
      h.flags?.some((f: string) => f.toLowerCase().includes(q))
    );
  }, [data, search]);

  const flagStats = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach(h => h.flags?.forEach((f: string) => { counts[f] = (counts[f] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-8 w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="skeleton h-8 w-64 rounded-lg" />
          <div className="skeleton h-4 w-48 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-8 w-full animate-fade-in">
        <div className="p-6 bg-caution/10 border-l-4 border-caution flex flex-col items-start gap-3 rounded-lg">
          <span className="font-bold text-caution font-mono uppercase tracking-wider text-xs flex items-center gap-2">
            <AlertTriangle size={14} /> Registry Load Failure
          </span>
          <span className="text-[#FCA5A5] leading-relaxed text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 md:py-16 px-5 md:px-8 w-full animate-fade-in">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8 pb-4 border-b border-rule/30">
        <div>
          <h1 className="text-4xl font-display mb-1 text-white">Exclusion Registry</h1>
          <p className="text-sm text-[#94A3B8] font-mono">{data.length} CANDIDATES FLAGGED AS HONEYPOTS</p>
        </div>
        <Link to="/results" className="text-sm font-medium text-[#94A3B8] hover:text-evidence underline decoration-rule/50 hover:decoration-evidence transition-all flex items-center gap-1.5">
          <ArrowLeft size={14} /> Return to Ledger
        </Link>
      </div>

      {flagStats.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#475569] mb-3 flex items-center gap-1.5">
            <Flag size={12} /> Flag Distribution
          </h3>
          <div className="flex flex-wrap gap-2">
            {flagStats.map(([flag, count]) => (
              <div key={flag} className="bg-card border border-caution/20 px-3 py-2 text-xs font-mono flex items-center gap-2 card-hover rounded-lg">
                <span className="text-caution font-bold">{count}</span>
                <span className="text-[#94A3B8]">{flag.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative w-full sm:w-72 mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by ID or flag..."
          className="input-field w-full pl-9"
        />
      </div>

      {data.length === 0 ? (
        <div className="p-12 text-center bg-card border border-rule/30 shadow-sm flex flex-col items-center gap-3 card-hover rounded-xl">
          <Ban size={24} className="text-trust/50" />
          <span className="font-mono text-sm text-[#64748B]">NO HONEYPOTS DETECTED IN CURRENT RUN.</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-card border border-rule/30 shadow-sm rounded-xl">
          <span className="font-mono text-sm text-[#64748B]">No results match your search.</span>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filtered.map((h, i) => (
            <div
              key={h.candidate_id || i}
              className="bg-card border border-rule/30 p-6 shadow-sm flex flex-col justify-between card-hover animate-fade-in-fast rounded-xl"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div>
                <div className="font-mono text-[10px] text-[#475569] mb-1 uppercase tracking-wider">Candidate ID</div>
                <h2 className="font-mono text-lg font-bold mb-4 text-white">{h.candidate_id}</h2>
              </div>
              <div className="bg-caution/5 border border-caution/20 p-4 rounded-lg">
                <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3 text-caution flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Critical Flags Fired
                </h3>
                <ul className="space-y-2">
                  {h.flags.map((f: string, j: number) => (
                    <li key={j} className="flex gap-3 items-start text-sm">
                      <span className="text-caution mt-0.5 font-mono text-xs" aria-hidden="true">#</span>
                      <span className="leading-snug text-[#CBD5E1]">{f.replace(/_/g, ' ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
