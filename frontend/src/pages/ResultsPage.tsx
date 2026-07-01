import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ExternalLink, Users, Trophy, TrendingUp } from 'lucide-react';
import { apiUrl } from '../lib/api';

type SortKey = 'rank' | 'score' | 'candidate_id';
type SortDir = 'asc' | 'desc';

interface RankedEntry {
  candidate_id: string;
  rank: number;
  score: number;
  reasoning: string;
}

export default function ResultsPage() {
  const [ranked, setRanked] = useState<RankedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const perPage = 25;

  useEffect(() => {
    fetch(apiUrl('/api/export.csv'))
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n').filter(l => l.trim());
        const data = lines.slice(1).map(line => {
          const vals = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
          return {
            candidate_id: vals[0].replace(/"/g, ''),
            rank: parseInt(vals[1].replace(/"/g, '')),
            score: parseFloat(vals[2].replace(/"/g, '')),
            reasoning: vals.slice(3).join(',').replace(/"/g, '')
          };
        });
        setRanked(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let items = ranked;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(c => c.candidate_id.toLowerCase().includes(q));
    }
    return items.sort((a, b) => {
      let cmp;
      if (sortKey === 'rank') cmp = a.rank - b.rank;
      else if (sortKey === 'score') cmp = a.score - b.score;
      else cmp = a.candidate_id.localeCompare(b.candidate_id);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [ranked, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'rank' ? 'asc' : 'desc'); }
    setPage(1);
  };

  const maxScore = useMemo(() => ranked.reduce((m, c) => Math.max(m, c.score), 0), [ranked]);

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span className="ml-1 text-evidence">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col p-8 max-w-7xl mx-auto w-full">
        <div className="skeleton h-10 w-64 mb-8" />
        <div className="bg-card border border-rule/30 shadow-sm flex-1 p-8 space-y-4 rounded-xl">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-12 w-full rounded-lg" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-5 md:p-8 max-w-7xl mx-auto w-full animate-fade-in">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6 border-b border-rule/30 pb-4">
        <div>
          <h1 className="text-4xl font-display mb-1 text-white">Results Ledger</h1>
          <p className="text-[#94A3B8] text-sm flex items-center gap-4">
            <span className="flex items-center gap-1"><Users size={14} /> {ranked.length} candidates</span>
            <span className="flex items-center gap-1"><TrendingUp size={14} /> scores up to {maxScore.toFixed(3)}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/honeypots" className="px-5 py-2 border-2 border-caution/50 text-caution hover:bg-caution/10 font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-caution focus:ring-offset-2 focus:ring-offset-ink rounded-lg flex items-center gap-1.5">
            <Trophy size={14} />
            Honeypots
          </Link>
          <Link to="/export" className="btn-ink text-sm flex items-center gap-1.5">
            <ExternalLink size={14} />
            Export
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by candidate ID..."
            className="input-field w-full pl-9"
          />
        </div>
        <div className="text-xs font-mono text-[#475569]">
          {filtered.length === ranked.length
            ? `${ranked.length} total`
            : `${filtered.length} of ${ranked.length} matching`}
        </div>
      </div>

      <div className="bg-card border border-rule/30 shadow-sm overflow-hidden flex-1 flex flex-col rounded-xl">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-ink z-10">
              <tr>
                <th className="p-4 text-[11px] font-mono font-bold uppercase tracking-widest text-[#64748B] border-b border-rule/30 w-16">
                  <button onClick={() => toggleSort('rank')} className="flex items-center hover:text-white transition-colors">
                    Rank {sortIndicator('rank')}
                  </button>
                </th>
                <th className="p-4 text-[11px] font-mono font-bold uppercase tracking-widest text-[#64748B] border-b border-rule/30 w-44">
                  <button onClick={() => toggleSort('candidate_id')} className="flex items-center hover:text-white transition-colors">
                    Candidate ID {sortIndicator('candidate_id')}
                  </button>
                </th>
                <th className="p-4 text-[11px] font-mono font-bold uppercase tracking-widest text-[#64748B] border-b border-rule/30 w-32">
                  <button onClick={() => toggleSort('score')} className="flex items-center hover:text-white transition-colors">
                    Score {sortIndicator('score')}
                  </button>
                </th>
                <th className="p-4 text-[11px] font-mono font-bold uppercase tracking-widest text-[#64748B] border-b border-rule/30">Reasoning Overview</th>
                <th className="p-4 text-[11px] font-mono font-bold uppercase tracking-widest text-[#64748B] border-b border-rule/30 text-right w-32">Evidence</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paginated.map((c, i) => {
                const isTop5 = c.rank <= 5;
                const pct = maxScore > 0 ? (c.score / maxScore) * 100 : 0;
                return (
                  <tr
                    key={c.candidate_id}
                    className="border-b border-rule/20 hover:bg-white/[0.02] transition-all group animate-fade-in-fast"
                    style={{ animationDelay: `${(i % perPage) * 20}ms` }}
                  >
                    <td className={`p-4 font-mono ${isTop5 ? 'font-bold text-white' : 'text-[#64748B]'}`}>
                      <div className="flex items-center gap-2">
                        {isTop5 && <Trophy size={12} className="text-evidence" />}
                        {c.rank.toString().padStart(3, '0')}
                      </div>
                    </td>
                    <td className={`p-4 font-mono ${isTop5 ? 'font-bold text-white' : 'text-[#E2E8F0]'}`}>
                      {c.candidate_id}
                    </td>
                    <td className="p-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span className={isTop5 ? 'text-trust font-bold' : 'text-[#E2E8F0]'}>{c.score.toFixed(3)}</span>
                        <div className="hidden sm:block w-16 h-1.5 bg-rule/30 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${isTop5 ? 'bg-trust' : 'bg-evidence/40'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 pr-12">
                      <div className="truncate max-w-2xl opacity-60 group-hover:opacity-100 transition-opacity text-xs leading-relaxed text-[#94A3B8]">
                        {c.reasoning}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        to={`/results/${c.candidate_id}`}
                        className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-evidence hover:text-white transition-colors focus:outline-none focus:underline"
                      >
                        OPEN <span aria-hidden="true">→</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-16 text-center font-mono text-sm text-[#64748B]">
                    {search ? 'No candidates match your search.' : (
                      <>
                        NO RESULTS LEDGER FOUND.<br /><br />
                        <Link to="/run" className="text-evidence underline hover:text-white">Execute pipeline</Link> first.
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-rule/20">
          <div className="text-xs font-mono text-[#475569]">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-outline flex items-center gap-1 text-xs disabled:opacity-30 text-[#94A3B8]"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 text-xs font-mono rounded-lg transition-all ${p === page ? 'bg-evidence text-ink font-bold' : 'border border-rule/30 text-[#94A3B8] hover:bg-white/5'}`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-outline flex items-center gap-1 text-xs disabled:opacity-30 text-[#94A3B8]"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
