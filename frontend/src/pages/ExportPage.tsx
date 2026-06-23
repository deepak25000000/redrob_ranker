import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Download, AlertTriangle, Loader } from 'lucide-react';
import { apiUrl } from '../lib/api';

interface ValidationCheck {
  passed: boolean;
  name: string;
  detail: string;
}

export default function ExportPage() {
  const [checks, setChecks] = useState<ValidationCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleChecks, setVisibleChecks] = useState(0);

  useEffect(() => {
    fetch(apiUrl('/api/validate'), { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error('Validation pipeline failed to run.');
        return res.json();
      })
      .then(d => {
        const chks = d.checks || [];
        setChecks(chks);
        setLoading(false);
        chks.forEach((_: unknown, i: number) => {
          setTimeout(() => setVisibleChecks(i + 1), i * 200);
        });
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const allPassed = checks.length > 0 && checks.every(c => c.passed);
  const passedCount = checks.filter(c => c.passed).length;

  return (
    <div className="max-w-3xl mx-auto py-12 md:py-16 px-5 md:px-8 w-full animate-fade-in">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8 pb-4 border-b-2 border-rule">
        <div>
          <h1 className="text-4xl font-display mb-1">Export & Validate</h1>
          <p className="text-sm text-ink/60 font-mono">RUNNING VALIDATE_SUBMISSION.PY RULES DIRECTLY</p>
        </div>
        <Link to="/results" className="text-sm font-medium text-ink/60 hover:text-evidence underline decoration-rule hover:decoration-evidence transition-all flex items-center gap-1.5">
          <ArrowLeft size={14} /> Return to Ledger
        </Link>
      </div>

      <div className="mb-10 relative">
        {loading ? (
          <div className="p-12 text-center bg-card border-2 border-rule shadow-sm font-mono text-sm text-ink/50 flex flex-col items-center gap-3">
            <Loader size={20} className="text-evidence animate-spin" />
            Executing validation sequence...
          </div>
        ) : error ? (
          <div className="p-6 bg-caution/10 border-l-4 border-caution flex flex-col items-start gap-3 animate-slide-up">
            <span className="font-bold text-caution font-mono uppercase tracking-wider text-xs flex items-center gap-2">
              <AlertTriangle size={14} /> Validation Error
            </span>
            <span className="text-ink/90 leading-relaxed text-sm">{error}</span>
          </div>
        ) : (
          <div className="bg-card border-2 border-rule shadow-sm">
            {checks.length > 0 && (
              <div className="p-5 border-b border-rule/50 bg-paper/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink/50">Validation Progress</span>
                  <span className="text-xs font-mono text-ink/50">{passedCount}/{checks.length} passed</span>
                </div>
                <div className="h-2 bg-rule/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${allPassed ? 'bg-trust' : 'bg-caution'}`}
                    style={{ width: `${(passedCount / checks.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {checks.map((check, i) => (
              <div
                key={i}
                className={`flex p-5 md:p-6 items-start gap-4 transition-all ${i < checks.length - 1 ? 'border-b border-rule/30' : ''} ${i < visibleChecks ? 'opacity-100' : 'opacity-0'}`}
                style={{ transform: `translateY(${i < visibleChecks ? '0' : '10'}px)`, transition: 'all 0.3s ease-out' }}
              >
                <div className={`mt-0.5 ${check.passed ? 'text-trust' : 'text-caution'}`}>
                  {check.passed ? <CheckCircle size={18} /> : <XCircle size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-medium text-base mb-0.5">{check.name}</h3>
                  <p className={`text-sm leading-relaxed ${check.passed ? 'text-ink/60 font-mono text-[11px] tracking-wide' : 'text-caution font-medium'}`}>
                    {check.detail}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${check.passed ? 'bg-trust/10 text-trust' : 'bg-caution/10 text-caution'}`}>
                    {check.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {allPassed ? (
          <a
            href={apiUrl('/api/export.csv')}
            download="submission.csv"
            className="btn-ink flex items-center gap-2 px-8 py-4 text-base group"
          >
            <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
            Download Spec-Compliant CSV
          </a>
        ) : (
          <div className="p-5 bg-caution/10 border-l-4 border-caution text-sm w-full animate-slide-up">
            <strong className="text-caution uppercase tracking-wide text-xs mb-2 block flex items-center gap-1.5">
              <AlertTriangle size={12} /> Export Disabled
            </strong>
            <p className="text-ink/80 leading-relaxed">
              Validation failed. If you are running the bundled sample (50 candidates), this is expected because the spec requires exactly 100 rows. Upload a valid run file to proceed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
