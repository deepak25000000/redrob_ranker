import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../lib/api';

export default function ResultsPage() {
  const [ranked, setRanked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/export.csv'))
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n').filter(l => l.trim());
        const data = lines.slice(1).map(line => {
          // Robust split keeping commas in quotes intact
          const vals = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
          return {
            candidate_id: vals[0].replace(/"/g, ''),
            rank: parseInt(vals[1].replace(/"/g, '')),
            score: parseFloat(vals[2].replace(/"/g, '')).toFixed(3),
            reasoning: vals.slice(3).join(',').replace(/"/g, '')
          };
        });
        setRanked(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex-1 flex flex-col p-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-end mb-8 border-b-2 border-rule pb-4">
        <div>
          <h1 className="text-4xl font-display mb-2">Results Ledger</h1>
          <p className="text-ink/60 text-sm">Sorted by final computed hybrid score.</p>
        </div>
        <div className="flex gap-4">
          <Link to="/honeypots" className="px-6 py-2 border-2 border-caution text-caution hover:bg-caution hover:text-paper font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-caution focus:ring-offset-2 focus:ring-offset-paper">
            View Honeypots
          </Link>
          <Link to="/export" className="px-6 py-2 bg-ink text-paper hover:bg-ink/90 font-medium text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-paper">
            Export & Validate
          </Link>
        </div>
      </div>

      <div className="bg-card border-2 border-rule shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-paper z-10 shadow-sm">
              <tr>
                <th className="p-4 text-[11px] font-mono font-bold uppercase tracking-widest text-ink/50 border-b border-rule w-16">Rank</th>
                <th className="p-4 text-[11px] font-mono font-bold uppercase tracking-widest text-ink/50 border-b border-rule w-40">Candidate ID</th>
                <th className="p-4 text-[11px] font-mono font-bold uppercase tracking-widest text-ink/50 border-b border-rule w-24">Score</th>
                <th className="p-4 text-[11px] font-mono font-bold uppercase tracking-widest text-ink/50 border-b border-rule">Reasoning Overview</th>
                <th className="p-4 text-[11px] font-mono font-bold uppercase tracking-widest text-ink/50 border-b border-rule text-right w-32">Evidence</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {ranked.map((c, i) => {
                const isTop5 = c.rank <= 5;
                return (
                  <tr key={i} className={`border-b border-rule hover:bg-paper transition-colors group ${isTop5 ? 'bg-paper/50' : ''}`}>
                    <td className={`p-4 font-mono ${isTop5 ? 'font-bold text-ink' : 'text-ink/60'}`}>
                      {c.rank.toString().padStart(3, '0')}
                    </td>
                    <td className={`p-4 font-mono ${isTop5 ? 'font-bold' : ''}`}>
                      {c.candidate_id}
                    </td>
                    <td className={`p-4 font-mono ${isTop5 ? 'text-trust font-bold' : 'text-ink'}`}>
                      {c.score}
                    </td>
                    <td className="p-4 pr-12">
                      <div className="truncate max-w-2xl opacity-80 group-hover:opacity-100 transition-opacity">
                        {c.reasoning}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <Link 
                        to={`/results/${c.candidate_id}`} 
                        className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-evidence hover:text-ink transition-colors focus:outline-none focus:underline"
                      >
                        OPEN FILE <span aria-hidden="true">→</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {ranked.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-16 text-center font-mono text-sm opacity-50">
                    NO RESULTS LEDGER FOUND.<br/><br/>
                    <Link to="/run" className="text-ink underline hover:text-evidence">Execute pipeline</Link> first.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="p-16 text-center font-mono text-sm opacity-50 animate-pulse">
                    READING LEDGER...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
