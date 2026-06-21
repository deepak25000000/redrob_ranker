import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LivePipelineGraph, { type PipelineSnapshot } from '../components/LivePipelineGraph';
import { apiUrl } from '../lib/api';

const stages = [
  { id: 'raw', label: 'Loading candidates...' },
  { id: 'honeypot', label: 'Detecting honeypots...' },
  { id: 'hybrid', label: 'Computing hybrid retrieval signals...' },
  { id: 'cross_encoder', label: 'Reranking shortlist...' },
  { id: 'judge', label: 'Generating reasoning...' },
  { id: 'output', label: 'Writing ranked ledger...' }
];

export default function RunPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState<number>(-1);
  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleRun = async (useSample: boolean = false) => {
    setLoading(true);
    setError(null);
    setStageIndex(0);

    const timers = stages.map((_, index) => window.setTimeout(() => setStageIndex(index), index * 650));

    try {
      const formData = new FormData();
      if (!useSample && file) {
        if (file.name === 'candidates.jsonl' || file.name === 'candidates.jsonl.gz') {
          formData.append('local_filename', file.name);
        } else {
          formData.append('file', file);
        }
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 600000);

      const res = await fetch(apiUrl('/api/rank'), {
        method: 'POST',
        body: formData,
        signal: controller.signal
      }).catch(err => {
        if (err.name === 'AbortError') throw new Error('Request timed out after 10 minutes.');
        throw new Error("Couldn't reach the ranking server. Is `npm run dev` running?");
      });

      window.clearTimeout(timeoutId);

      if (!res.ok) {
        let serverError = `Server error: ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.detail) serverError = errData.detail;
        } catch (e) {}
        throw new Error(serverError);
      }

      const data = await res.json();
      setPipeline(data.pipeline);
      setStageIndex(stages.length - 1);
      navigate('/results');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
      setStageIndex(-1);
    } finally {
      timers.forEach(window.clearTimeout);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-16 px-8 w-full">
      <h1 className="text-4xl font-display mb-10 pb-4 border-b-2 border-rule">Pipeline Execution</h1>

      <div className="mb-10">
        <LivePipelineGraph
          snapshot={pipeline}
          activeStage={stageIndex >= 0 ? stages[stageIndex]?.id : null}
          compact
        />
      </div>

      <div className="bg-card border border-rule p-10 mb-10 shadow-sm relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-card/90 backdrop-blur-sm z-10 p-10 flex flex-col justify-center border border-rule">
            <h3 className="font-display text-2xl mb-8 flex items-center gap-3">
              <span className="w-2 h-2 bg-evidence rounded-full animate-pulse"></span>
              Processing Evidence
            </h3>
            <div className="space-y-4 font-mono text-sm">
              {stages.map((stage, i) => {
                const isActive = i === stageIndex;
                const isPast = i < stageIndex;
                return (
                  <div key={stage.id} className={`flex items-center gap-4 transition-opacity duration-300 ${isPast ? 'opacity-50' : isActive ? 'opacity-100 text-evidence' : 'opacity-20'}`}>
                    <span className="w-5 text-center">{isPast ? 'OK' : isActive ? '...' : ''}</span>
                    <span>{stage.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-5 mb-6">
          <div>
            <h2 className="text-2xl font-display mb-2">Target Data</h2>
            <p className="text-base text-ink/70">Provide a candidate file matching the schema.</p>
          </div>
          <button
            onClick={() => handleRun(true)}
            disabled={loading}
            className="text-sm font-medium text-ink underline decoration-rule hover:decoration-ink hover:text-evidence transition-colors focus:outline-none focus:ring-2 focus:ring-evidence focus:ring-offset-2 focus:ring-offset-card"
          >
            Use bundled 50-candidate sample
          </button>
        </div>

        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-rule/60 hover:border-ink hover:bg-paper/50 transition-all p-12 text-center cursor-pointer flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-evidence focus:ring-offset-2 focus:ring-offset-card group"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <span className="font-mono text-sm text-ink/60 group-hover:text-ink transition-colors">
              Drag a file here, or click to browse.
            </span>
          </div>
        ) : (
          <div className="border border-rule p-8 flex flex-col md:flex-row gap-5 md:justify-between md:items-center bg-paper">
            <div>
              <p className="font-mono text-base font-bold mb-1">{file.name}</p>
              <p className="text-sm text-ink/60 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setFile(null)}
                className="px-4 py-2 border border-rule text-sm font-medium hover:bg-card focus:outline-none focus:ring-2 focus:ring-evidence"
              >
                Clear
              </button>
              <button
                onClick={() => handleRun(false)}
                disabled={loading}
                className="px-8 py-2 bg-ink text-paper font-medium hover:bg-ink/90 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-evidence focus:ring-offset-2 focus:ring-offset-paper"
              >
                Run ranking
              </button>
            </div>
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json,.jsonl,.gz,.csv,.xlsx,.xls"
          className="sr-only"
        />
      </div>

      {error && (
        <div className="p-6 bg-caution/10 border-l-4 border-caution flex flex-col items-start gap-3">
          <span className="font-bold text-caution flex items-center gap-2">
            <span aria-hidden="true">#</span> Diagnostic Alert
          </span>
          <span className="text-ink/90 leading-relaxed">{error}</span>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm font-medium text-caution hover:text-ink underline decoration-caution/30 hover:decoration-ink focus:outline-none focus:ring-2 focus:ring-caution"
          >
            Acknowledge and clear
          </button>
        </div>
      )}
    </div>
  );
}
