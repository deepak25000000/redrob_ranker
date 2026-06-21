import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../lib/api';

export default function ExportPage() {
  const [checks, setChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/validate'), { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error("Validation pipeline failed to run.");
        return res.json();
      })
      .then(d => {
        setChecks(d.checks || []);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const allPassed = checks.length > 0 && checks.every(c => c.passed);

  return (
    <div className="max-w-3xl mx-auto py-16 px-8 w-full">
      <div className="flex justify-between items-end mb-10 pb-4 border-b-2 border-rule">
        <div>
          <h1 className="text-4xl font-display mb-2">Export & Validate</h1>
          <p className="text-sm text-ink/60 font-mono tracking-wide">RUNNING VALIDATE_SUBMISSION.PY RULES DIRECTLY</p>
        </div>
        <Link to="/results" className="text-sm font-medium text-ink underline decoration-rule hover:decoration-ink hover:text-evidence transition-colors focus:outline-none focus:ring-2 focus:ring-evidence">
          Return to Ledger
        </Link>
      </div>

      <div className="mb-12 relative">
        {loading ? (
          <div className="p-12 text-center bg-card border-2 border-rule shadow-sm font-mono text-sm text-ink/50 animate-pulse">
            Executing validation sequence...
          </div>
        ) : error ? (
          <div className="p-6 bg-caution/10 border-l-4 border-caution flex flex-col items-start gap-3">
            <span className="font-bold text-caution font-mono uppercase tracking-wider text-xs flex items-center gap-2">
              <span aria-hidden="true">■</span> Validation Error
            </span>
            <span className="text-ink/90 leading-relaxed text-sm">{error}</span>
          </div>
        ) : (
          <div className="bg-card border-2 border-rule shadow-sm">
            {checks.map((check, i, arr) => (
              <div key={i} className={`flex p-6 items-start gap-5 ${i !== arr.length - 1 ? 'border-b border-rule/50' : ''}`}>
                <div className={`mt-0.5 text-lg ${check.passed ? 'text-trust' : 'text-caution font-bold'}`}>
                  {check.passed ? '✓' : '✕'}
                </div>
                <div>
                  <h3 className="font-display font-medium text-lg mb-1">{check.name}</h3>
                  <p className={`text-sm leading-relaxed ${check.passed ? 'text-ink/60 font-mono text-[11px] tracking-wide' : 'text-caution font-medium'}`}>
                    {check.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-start">
        {allPassed ? (
          <a 
            href={apiUrl('/api/export.csv')}
            download="submission.csv"
            className="group flex items-center gap-3 px-8 py-4 bg-ink text-paper font-medium hover:bg-ink/90 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-evidence focus:ring-offset-2 focus:ring-offset-paper"
          >
            Download Spec-Compliant CSV
            <span className="group-hover:translate-y-1 transition-transform">↓</span>
          </a>
        ) : (
          <div className="p-6 bg-caution/10 border-l-4 border-caution text-sm w-full">
            <strong className="text-caution uppercase tracking-wide text-xs mb-2 block">Export Disabled</strong>
            <p className="text-ink/80 leading-relaxed">
              Validation failed. If you are running the bundled sample (50 candidates), this is expected because the spec requires exactly 100 rows. Upload a valid run file to proceed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
