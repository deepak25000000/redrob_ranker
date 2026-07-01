import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, X, Play, AlertCircle, Loader } from 'lucide-react';
import { apiUrl } from '../lib/api';

const ALLOWED_EXTENSIONS = ['.json', '.jsonl', '.gz', '.csv', '.xlsx', '.xls'];

export default function RunPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing'>('idle');
  const [processingStatus, setProcessingStatus] = useState('');
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

  const pollJobStatus = (jobId: string) => {
    const poll = () => {
      fetch(apiUrl(`/api/rank/status/${jobId}`))
        .then(res => res.json())
        .then(data => {
          if (data.status === 'done') {
            setLoading(false);
            setPhase('idle');
            navigate('/dashboard');
          } else if (data.status === 'error') {
            setError(data.error || 'Processing failed.');
            setLoading(false);
            setPhase('idle');
          } else {
            // Still processing — update status text and poll again
            setProcessingStatus(data.progress || 'Processing...');
            setTimeout(poll, 2000);
          }
        })
        .catch(() => {
          // Network hiccup — retry polling, don't fail
          setTimeout(poll, 3000);
        });
    };
    poll();
  };

  const handleRun = () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setUploadProgress(0);
    setPhase('uploading');

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl('/api/rank'), true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(pct);
        if (pct >= 100) {
          setPhase('processing');
          setProcessingStatus('Upload complete. Starting pipeline...');
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.job_id) {
            // Async mode — poll for completion
            setPhase('processing');
            setProcessingStatus('Pipeline started. Scoring candidates...');
            pollJobStatus(data.job_id);
          } else {
            // Legacy sync response (shouldn't happen but handle gracefully)
            setLoading(false);
            setPhase('idle');
            navigate('/dashboard');
          }
        } catch {
          setLoading(false);
          setPhase('idle');
          navigate('/dashboard');
        }
      } else {
        let msg = `Server error: ${xhr.status}`;
        try { const d = JSON.parse(xhr.responseText); if (d.detail) msg = d.detail; } catch {}
        setError(msg);
        setLoading(false);
        setPhase('idle');
      }
    };

    xhr.onerror = () => {
      setError("Couldn't reach the ranking server. Is the backend running?");
      setLoading(false);
      setPhase('idle');
    };

    xhr.ontimeout = () => {
      setError('Request timed out. The file may be too large for your connection speed.');
      setLoading(false);
      setPhase('idle');
    };

    xhr.timeout = 3600000;
    xhr.send(formData);
  };

  return (
    <div className="max-w-5xl mx-auto py-12 md:py-16 px-5 md:px-8 w-full animate-fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-display mb-2 text-white">Pipeline Execution</h1>
        <p className="text-[#94A3B8] text-sm">Upload candidate data and run the ranking pipeline.</p>
      </div>

      <div className="bg-card border border-rule/30 p-6 md:p-10 mb-10 shadow-sm relative overflow-hidden card-hover rounded-xl">
        {loading && (
          <div className="absolute inset-0 bg-card/95 backdrop-blur-sm z-10 p-6 md:p-10 flex flex-col border border-rule/30 animate-fade-in rounded-xl">
            {phase === 'uploading' ? (
              <>
                <h3 className="font-display text-2xl mb-6 flex items-center gap-3 text-white">
                  <Loader size={20} className="text-evidence animate-spin" />
                  Uploading {file?.name}
                </h3>
                <div className="space-y-3">
                  <div className="h-2 bg-rule/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-evidence rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="font-mono text-sm text-evidence text-right">{uploadProgress}%</div>
                  <div className="flex justify-between text-xs font-mono text-[#64748B]">
                    <span>{file ? (file.size / 1024 / 1024).toFixed(1) : 0} MB</span>
                    <span>{uploadProgress < 100 ? 'Uploading...' : 'Starting pipeline...'}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-display text-2xl mb-8 flex items-center gap-3 text-white">
                  <Loader size={20} className="text-evidence animate-spin" />
                  Processing Data
                </h3>
                <div className="space-y-3 font-mono text-sm">
                  <div className="h-1.5 bg-rule/30 rounded-full mb-6 overflow-hidden">
                    <div className="h-full bg-evidence rounded-full animate-progress" />
                  </div>
                  <div className="flex items-center gap-3 py-2 text-evidence opacity-100">
                    <Loader size={14} className="animate-spin" />
                    <span>{processingStatus || 'Loading candidates & computing scores...'}</span>
                  </div>
                  <div className="text-[11px] text-[#64748B] py-2">
                    {file && file.size > 100 * 1024 * 1024
                      ? `Large file (${(file.size / 1024 / 1024).toFixed(0)} MB) — this may take 1-3 minutes. Please wait.`
                      : 'Ranking candidates...'}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display mb-1 text-white">Target Data</h2>
            <p className="text-sm text-[#94A3B8]">Drop your candidates file to rank it</p>
          </div>
        </div>

        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed transition-all p-10 md:p-14 text-center cursor-pointer flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-evidence focus:ring-offset-2 focus:ring-offset-card rounded-xl group ${dragOver ? 'border-evidence bg-evidence/10' : 'border-rule/40 hover:border-evidence/60 hover:bg-card/80'}`}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <Upload size={32} className={`mb-4 transition-colors ${dragOver ? 'text-evidence' : 'text-[#475569] group-hover:text-evidence/60'}`} />
            <span className={`font-mono text-sm transition-colors ${dragOver ? 'text-evidence' : 'text-[#64748B] group-hover:text-white'}`}>
              {dragOver ? 'Drop file here' : 'Drag candidate file here, or click to browse'}
            </span>
            <span className="text-[10px] font-mono text-[#475569] mt-2">JSON, JSONL, GZ, CSV, XLSX, XLS — any size</span>
          </div>
        ) : (
          <div className="border border-rule/30 p-5 md:p-6 flex flex-col md:flex-row gap-5 md:justify-between md:items-center bg-card/80 card-hover rounded-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-evidence/10 rounded-lg">
                <FileText size={24} className="text-evidence" />
              </div>
              <div>
                <p className="font-mono text-base font-bold mb-0.5 text-white">{file.name}</p>
                <p className="text-xs text-[#64748B] font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setFile(null); setError(null); }}
                className="btn-outline flex items-center gap-1.5 text-[#94A3B8]"
                disabled={loading}
              >
                <X size={14} />
                Clear
              </button>
              <button
                onClick={handleRun}
                disabled={loading}
                className="btn-ink flex items-center gap-2 text-sm"
              >
                <Play size={14} />
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
        <div className="p-5 md:p-6 bg-caution/10 border-l-4 border-caution flex flex-col items-start gap-3 animate-slide-up rounded-lg">
          <span className="font-bold text-caution flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            Diagnostic Alert
          </span>
          <span className="text-[#FCA5A5] leading-relaxed text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="mt-1 text-xs font-medium text-caution hover:text-white underline decoration-caution/30 hover:decoration-white transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
