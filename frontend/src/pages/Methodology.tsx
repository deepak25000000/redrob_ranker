import { useEffect, useState } from 'react';
import LivePipelineGraph, { type PipelineSnapshot } from '../components/LivePipelineGraph';
import { apiUrl } from '../lib/api';

export default function Methodology() {
  const [data, setData] = useState<any>(null);
  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/methodology.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load methodology config.');
        return res.json();
      })
      .then(setData)
      .catch(e => setError(e.message));

    fetch(apiUrl('/api/pipeline'))
      .then(res => (res.ok ? res.json() : null))
      .then(snapshot => snapshot && setPipeline(snapshot))
      .catch(() => undefined);
  }, []);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-8 w-full">
        <div className="p-6 bg-caution/10 border-l-4 border-caution flex flex-col items-start gap-3">
          <span className="font-bold text-caution font-mono uppercase tracking-wider text-xs flex items-center gap-2">
            <span aria-hidden="true">#</span> Data Load Failure
          </span>
          <span className="text-ink/90 leading-relaxed text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-8 w-full">
        <div className="font-mono text-sm text-ink/50 animate-pulse">Reading static methodology parameters...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-16 px-8 w-full">
      <h1 className="text-4xl font-display mb-10 pb-4 border-b-2 border-rule">Methodology</h1>

      <div className="mb-16">
        <LivePipelineGraph snapshot={pipeline} compact />
      </div>

      <div className="grid md:grid-cols-2 gap-10 mb-16">
        <div>
          <h2 className="text-xl font-display mb-6">Current Weights</h2>
          <div className="bg-card border border-rule shadow-sm">
            {Object.entries(data.weights).map(([k, v], idx, arr) => (
              <div key={k} className={`flex justify-between items-center p-4 font-mono text-[11px] ${idx !== arr.length - 1 ? 'border-b border-rule/50' : ''}`}>
                <span className="text-ink/80">{k}</span>
                <span className="font-bold">{Number(v).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-display mb-6">Disqualifier Rules</h2>
          <div className="bg-card border-t-4 border-caution border-l border-r border-b border-rule shadow-sm p-6">
            <div className="font-mono text-[10px] text-caution uppercase tracking-widest font-bold mb-4">CRITICAL FIT RISKS</div>
            <ul className="space-y-4 text-sm text-ink/90">
              {data.disqualifier_rules.map((rule: string) => (
                <li key={rule} className="flex gap-3 items-start">
                  <span className="text-caution mt-0.5" aria-hidden="true">#</span>
                  <span className="leading-snug">{rule.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
