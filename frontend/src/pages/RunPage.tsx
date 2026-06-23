import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, X, Play, AlertCircle, CheckCircle, Loader } from 'lucide-react';
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

const ALLOWED_EXTENSIONS = ['.json', '.jsonl', '.gz', '.csv', '.xlsx', '.xls'];

export default function RunPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState<number>(-1);
  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPath, setLocalPath] = useState<string>('candidates.jsonl');
  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  const validateAndSetFile = (f: File) => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type "${ext}". Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleRun = async (useSample: boolean = false, runLocalFile: boolean = false) => {
    setLoading(true);
    setError(null);
    setStageIndex(0);

    const timers = stages.map((_, index) => window.setTimeout(() => setStageIndex(index), (index + 1) * 700));

    try {
      const formData = new FormData();
      if (runLocalFile && localPath) {
        formData.append('local_filename', localPath);
      } else if (!useSample && file) {
        formData.append('file', file);
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 1800000);

      const res = await fetch(apiUrl('/api/rank'), {
        method: 'POST',
        body: formData,
        signal: controller.signal
      }).catch(err => {
        if (err.name === 'AbortError') throw new Error('Request timed out. For very large uploads, consider running the app locally and specifying a server-side local path.');
        throw new Error("Couldn't reach the ranking server. Is the backend server running?");
      });

      window.clearTimeout(timeoutId);

      if (!res.ok) {
        let serverError = `Server error: ${res.status}`;
        try { const errData = await res.json(); if (errData.detail) serverError = errData.detail; } catch { /* noop */ }
        throw new Error(serverError);
      }

      const data = await res.json();
      setPipeline(data.pipeline);
      setStageIndex(stages.length - 1);
      navigate('/results');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
      setStageIndex(-1);
    } finally {
      timers.forEach(window.clearTimeout);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-12 md:py-16 px-5 md:px-8 w-full animate-fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-display mb-2">Pipeline Execution</h1>
        <p className="text-ink/60 text-sm">Upload candidate data and run the ranking pipeline.</p>
      </div>

      <div className="mb-10">
        <LivePipelineGraph
          snapshot={pipeline}
          activeStage={stageIndex >= 0 ? stages[stageIndex]?.id : null}
          compact
        />
      </div>

      <div className="bg-card border border-rule p-6 md:p-10 mb-10 shadow-sm relative overflow-hidden card-hover">
        {loading && (
          <div className="absolute inset-0 bg-card/95 backdrop-blur-sm z-10 p-6 md:p-10 flex flex-col border border-rule animate-fade-in">
            <h3 className="font-display text-2xl mb-8 flex items-center gap-3">
              <Loader size={20} className="text-evidence animate-spin" />
              Processing Evidence
            </h3>
            <div className="space-y-1 font-mono text-sm">
              <div className="h-1.5 bg-rule/30 rounded-full mb-6 overflow-hidden">
                <div
                  className="h-full bg-evidence rounded-full transition-all duration-500"
                  style={{ width: `${stageIndex >= 0 ? ((stageIndex + 1) / stages.length) * 100 : 0}%` }}
                />
              </div>
              {stages.map((stage, i) => {
                const isActive = i === stageIndex;
                const isPast = i < stageIndex;
                return (
                  <div
                    key={stage.id}
                    className={`flex items-center gap-3 py-2 transition-all duration-500 ${isPast ? 'opacity-50' : isActive ? 'opacity-100 text-evidence' : 'opacity-15'}`}
                  >
                    <span className="w-5 flex justify-center">
                      {isPast ? <CheckCircle size={14} className="text-trust" /> : isActive ? <Loader size={14} className="animate-spin" /> : <div className="w-2 h-2 rounded-full border border-current" />}
                    </span>
                    <span className={isPast ? 'line-through decoration-1' : ''}>{stage.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-5 mb-6">
          <div>
            <h2 className="text-2xl font-display mb-1">Target Data</h2>
            <p className="text-sm text-ink/70">Provide a candidate file matching the schema.</p>
          </div>
          <button
            onClick={() => handleRun(true)}
            disabled={loading}
            className="text-sm font-medium text-ink/60 hover:text-evidence underline decoration-rule hover:decoration-evidence transition-all flex items-center gap-1.5"
          >
            <Play size={12} />
            Use bundled 50-candidate sample
          </button>
        </div>

        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed transition-all p-10 md:p-14 text-center cursor-pointer flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-evidence focus:ring-offset-2 focus:ring-offset-card group ${dragOver ? 'border-evidence bg-evidence/10' : 'border-rule/60 hover:border-ink hover:bg-paper/50'}`}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <Upload size={32} className={`mb-4 transition-colors ${dragOver ? 'text-evidence' : 'text-ink/30 group-hover:text-ink/60'}`} />
            <span className={`font-mono text-sm transition-colors ${dragOver ? 'text-evidence' : 'text-ink/60 group-hover:text-ink'}`}>
              {dragOver ? 'Drop file here' : 'Drag a file here, or click to browse'}
            </span>
            <span className="text-[10px] font-mono text-ink/40 mt-2">JSON, JSONL, CSV, XLSX, GZ</span>
          </div>
        ) : (
          <div className="border border-rule p-5 md:p-6 flex flex-col md:flex-row gap-5 md:justify-between md:items-center bg-paper/80 card-hover">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-evidence/10 rounded-lg">
                <FileText size={24} className="text-evidence" />
              </div>
              <div>
                <p className="font-mono text-base font-bold mb-0.5">{file.name}</p>
                <p className="text-xs text-ink/60 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setFile(null); setError(null); }}
                className="btn-outline flex items-center gap-1.5"
              >
                <X size={14} />
                Clear
              </button>
              <button
                onClick={() => handleRun(false)}
                disabled={loading}
                className="btn-ink flex items-center gap-2"
              >
                <Play size={14} />
                Run ranking
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-rule/30">
          <label className="block text-xs font-mono text-ink/50 mb-2 uppercase tracking-wider">
            Or: Run a file on the backend server's disk
          </label>
          <div className="flex gap-3 max-w-lg">
            <input
              type="text"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="e.g. candidates.jsonl"
              className="input-field flex-1"
            />
            <button
              onClick={() => handleRun(false, true)}
              disabled={loading || !localPath.trim()}
              className="btn-ink text-sm"
            >
              Run server file
            </button>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json,.jsonl,.gz,.csv,.xlsx,.xls"
          className="sr-only"
        />
      </div>

      {error && (
        <div className="p-5 md:p-6 bg-caution/10 border-l-4 border-caution flex flex-col items-start gap-3 animate-slide-up">
          <span className="font-bold text-caution flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            Diagnostic Alert
          </span>
          <span className="text-ink/90 leading-relaxed text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="mt-1 text-xs font-medium text-caution hover:text-ink underline decoration-caution/30 hover:decoration-ink transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
