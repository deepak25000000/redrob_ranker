import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Menu, X, Sparkles, BarChart3, Shield, Download, LayoutDashboard } from 'lucide-react';
import RunPage from './pages/RunPage';
import ResultsPage from './pages/ResultsPage';
import CandidateDetail from './pages/CandidateDetail';
import Methodology from './pages/Methodology';
import Honeypots from './pages/Honeypots';
import ExportPage from './pages/ExportPage';
import DashboardPage from './pages/DashboardPage';
import LivePipelineGraph, { type PipelineSnapshot } from './components/LivePipelineGraph';
import { apiUrl } from './lib/api';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col font-body bg-ink text-[#E2E8F0] selection:bg-evidence/30">
        <Header />
        <main className="flex-1 flex flex-col relative">
          <Routes>
            <Route path="/" element={<PageTransition><Overview /></PageTransition>} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/run" element={<PageTransition><RunPage /></PageTransition>} />
            <Route path="/results" element={<PageTransition><ResultsPage /></PageTransition>} />
            <Route path="/results/:id" element={<PageTransition><CandidateDetail /></PageTransition>} />
            <Route path="/methodology" element={<PageTransition><Methodology /></PageTransition>} />
            <Route path="/honeypots" element={<PageTransition><Honeypots /></PageTransition>} />
            <Route path="/export" element={<PageTransition><ExportPage /></PageTransition>} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLink = (path: string, label: string, icon: React.ReactNode) => {
    const isActive = location.pathname.startsWith(path);
    return (
      <Link
        to={path}
        className={`relative flex items-center gap-1.5 text-xs md:text-sm font-medium transition-all px-3 py-1.5 rounded-lg ${isActive ? 'text-evidence bg-evidence/10' : 'text-[#94A3B8] hover:text-white hover:bg-white/5'}`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <header className="glass sticky top-0 z-50 px-5 md:px-8 py-3 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 rounded-lg bg-evidence/15 border border-evidence/30 flex items-center justify-center group-hover:bg-evidence/25 transition-all">
          <Sparkles size={16} className="text-evidence" />
        </div>
        <span className="text-lg md:text-xl font-display font-semibold tracking-tight text-white">
          Redrob <span className="text-evidence">Ranker</span>
        </span>
      </Link>

      <nav className="hidden md:flex gap-1 items-center">
        {navLink('/dashboard', 'Dashboard', <LayoutDashboard size={14} />)}
        {navLink('/run', 'Run', <BarChart3 size={14} />)}
        {navLink('/results', 'Results', <Shield size={14} />)}
        {navLink('/methodology', 'Methodology', <Download size={14} />)}
      </nav>

      <button
        type="button"
        className="md:hidden p-2 text-[#94A3B8] hover:text-white transition-colors"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 glass-dark border-b border-rule/30 p-5 flex flex-col gap-3 md:hidden animate-slide-up-sm">
          <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm font-medium text-[#94A3B8] hover:text-evidence transition-colors px-3 py-2 rounded-lg hover:bg-white/5">
            <LayoutDashboard size={14} /> Dashboard
          </Link>
          <Link to="/run" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm font-medium text-[#94A3B8] hover:text-evidence transition-colors px-3 py-2 rounded-lg hover:bg-white/5">
            <BarChart3 size={14} /> Run Ranking
          </Link>
          <Link to="/results" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm font-medium text-[#94A3B8] hover:text-evidence transition-colors px-3 py-2 rounded-lg hover:bg-white/5">
            <Shield size={14} /> Results Ledger
          </Link>
          <Link to="/methodology" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm font-medium text-[#94A3B8] hover:text-evidence transition-colors px-3 py-2 rounded-lg hover:bg-white/5">
            <Download size={14} /> Methodology
          </Link>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-rule/30 px-5 md:px-8 py-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-[#64748B] font-mono">
          <Sparkles size={12} className="text-evidence/60" />
          Redrob Ranker — Evidence-first candidate ranking
        </div>
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-xs text-[#64748B] hover:text-evidence transition-colors font-mono">Dashboard</Link>
          <Link to="/methodology" className="text-xs text-[#64748B] hover:text-evidence transition-colors font-mono">Methodology</Link>
          <Link to="/honeypots" className="text-xs text-[#64748B] hover:text-evidence transition-colors font-mono">Honeypots</Link>
          <Link to="/export" className="text-xs text-[#64748B] hover:text-evidence transition-colors font-mono">Export</Link>
        </div>
      </div>
    </footer>
  );
}

function Overview() {
  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [demoState, setDemoState] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/pipeline'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setPipeline(data))
      .catch(() => undefined);
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const runMiniDemo = async () => {
    setDemoState('running');
    const stageIds = ['raw', 'honeypot', 'hybrid', 'cross_encoder', 'judge', 'output'];
    const timers = stageIds.map((id, index) =>
      window.setTimeout(() => { setActiveStage(id); }, index * 700)
    );

    try {
      const res = await fetch(apiUrl('/api/rank'), { method: 'POST', body: new FormData() });
      if (!res.ok) {
        let msg = `Ranking server returned ${res.status}.`;
        try { const d = await res.json(); if (d.detail) msg = d.detail; } catch { /* noop */ }
        throw new Error(msg);
      }
      const data = await res.json();
      setPipeline(data.pipeline);
      setActiveStage('output');
      setDemoState('complete');
    } catch {
      setDemoState('error');
      setActiveStage(null);
    } finally {
      timers.forEach(window.clearTimeout);
    }
  };

  return (
    <div className="w-full">
      <section className={`home-hero transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="home-hero__copy">
          <div className="eyebrow">Evidence-first candidate ranking</div>
          <h1>
            Evidence and reasoning <span className="text-gradient">you can audit.</span>
          </h1>
          <p>
            Redrob Ranker is built for the hidden-gem problem: candidates whose career histories prove the work,
            even when their resumes do not repeat the job description word for word.
          </p>
          <div className="home-hero__actions">
            <button
              type="button"
              onClick={runMiniDemo}
              disabled={demoState === 'running'}
              className="primary-action"
            >
              {demoState === 'running' ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-ink rounded-full animate-pulse" />
                  Running sample...
                </span>
              ) : 'Run bundled sample'}
            </button>
            <Link to="/run" className="secondary-action">Upload candidate file</Link>
          </div>
          {demoState === 'error' && (
            <div className="demo-error rounded-lg">
              <span className="font-bold block mb-1"># Diagnostic Alert</span>
              Could not reach the ranking server. Start the backend or use the bundled sample link below.
              <button
                type="button"
                onClick={runMiniDemo}
                className="block mt-3 text-evidence underline decoration-evidence/30 hover:text-white transition-colors text-xs font-mono"
              >
                Retry
              </button>
            </div>
          )}
          {demoState === 'complete' && pipeline?.top_candidate_id && (
            <Link to={`/results/${pipeline.top_candidate_id}#evidence`} className="demo-complete">
              Open {pipeline.top_candidate_id} evidence view
            </Link>
          )}
        </div>
        <LivePipelineGraph snapshot={pipeline} activeStage={activeStage} />
      </section>

      <section className={`work-section transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} aria-labelledby="how-it-works">
        <div className="work-section__intro">
          <div className="eyebrow">How Redrob Ranker Works</div>
          <h2 id="how-it-works">A skeptical pipeline for a noisy hiring pool.</h2>
          <p>
            Basic ATS matching rewards candidates who repeat the JD. Basic RAG can make the same mistake with a
            single cosine-similarity pass. Redrob Ranker separates contradiction checks, hybrid retrieval,
            deterministic reranking, and evidence generation so surface phrasing cannot do all the work.
          </p>
        </div>
        <div className="work-grid">
          <article>
            <span className="font-mono">01</span>
            <h3>The problem</h3>
            <p>
              Keyword tools miss people who describe the same skill in different words, and they overrate profiles
              that stuff AI terms into a skills list without production history behind them.
            </p>
          </article>
          <article>
            <span className="font-mono">02</span>
            <h3>What is different</h3>
            <p>
              The ranker reads career history like a recruiter would: tenure, project depth, production context,
              skill duration, behavior signals, and whether claimed skills are corroborated by the actual work.
            </p>
          </article>
          <article>
            <span className="font-mono">03</span>
            <h3>The real stages</h3>
            <p>
              It loads candidates, filters honeypots, combines dense semantic similarity with sparse evidence checks,
              applies a weighted rerank, then generates a fact-grounded justification for the ranked candidates.
            </p>
          </article>
          <article>
            <span className="font-mono">04</span>
            <h3>What recruiters get</h3>
            <p>
              A ranked ledger plus a candidate evidence file. You can inspect score components and highlighted
              career-history passages instead of trusting an opaque AI verdict.
            </p>
          </article>
        </div>
      </section>

      <section className={`comparison-section transition-all duration-700 delay-400 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} aria-label="Ranking contrast">
        <div className="comparison-card comparison-card--risk">
          <div className="comparison-card__dot" aria-hidden="true"></div>
          <h2>The Keyword Stuffer</h2>
          <div className="comparison-card__sample font-mono">
            SKILLS: RAG, Pinecone, FAISS, LLMs, Transformer, LangChain, VectorDB
          </div>
          <p>
            Unsupported claims are discounted when title, tenure, and career-history evidence do not line up.
          </p>
        </div>
        <div className="comparison-card comparison-card--trust">
          <div className="comparison-card__dot" aria-hidden="true"></div>
          <h2>The True Builder</h2>
          <div className="comparison-card__sample font-mono">
            EXPERIENCE: Owned ranking work combining dense retrieval with exact-match signals.
          </div>
          <p>
            Plain-language evidence can rank well because the semantic and structured checks look beyond exact JD wording.
          </p>
        </div>
      </section>
    </div>
  );
}

export default App;
