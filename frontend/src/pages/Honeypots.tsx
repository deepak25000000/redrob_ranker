import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../lib/api';

export default function Honeypots() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/honeypots'))
      .then(res => {
        if (!res.ok) throw new Error("Failed to load honeypot registry.");
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-8 w-full">
        <div className="font-mono text-sm text-ink/50 animate-pulse text-center">Reading exclusion registry...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-8 w-full">
        <div className="p-6 bg-caution/10 border-l-4 border-caution flex flex-col items-start gap-3">
          <span className="font-bold text-caution font-mono uppercase tracking-wider text-xs flex items-center gap-2">
            <span aria-hidden="true">■</span> Registry Load Failure
          </span>
          <span className="text-ink/90 leading-relaxed text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-16 px-8 w-full">
      <div className="flex justify-between items-end mb-10 pb-4 border-b-2 border-rule">
        <div>
          <h1 className="text-4xl font-display mb-2">Exclusion Registry</h1>
          <p className="text-sm text-ink/60 font-mono tracking-wide">CANDIDATES FLAGGED AS HONEYPOTS</p>
        </div>
        <Link to="/results" className="text-sm font-medium text-ink underline decoration-rule hover:decoration-ink hover:text-evidence transition-colors focus:outline-none focus:ring-2 focus:ring-evidence">
          Return to Ledger
        </Link>
      </div>

      {data.length === 0 ? (
        <div className="p-12 text-center bg-card border-2 border-rule shadow-sm">
          <span className="font-mono text-sm text-ink/50">NO HONEYPOTS DETECTED IN CURRENT RUN.</span>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {data.map((h, i) => (
            <div key={i} className="bg-card border-2 border-rule p-8 shadow-sm flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs text-ink/40 mb-2">CANDIDATE ID</div>
                <h2 className="font-mono text-xl font-bold mb-6 text-ink">{h.candidate_id}</h2>
              </div>
              <div className="bg-caution/5 border border-caution/20 p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3 text-caution">Critical Flags Fired</h3>
                <ul className="space-y-3">
                  {h.flags.map((f: string, j: number) => (
                    <li key={j} className="flex gap-3 items-start text-sm">
                      <span className="text-caution mt-0.5" aria-hidden="true">■</span>
                      <span className="leading-snug text-ink/90">{f}</span>
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
