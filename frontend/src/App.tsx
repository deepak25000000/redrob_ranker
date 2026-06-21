import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import RunPage from './pages/RunPage';
import ResultsPage from './pages/ResultsPage';
import CandidateDetail from './pages/CandidateDetail';
import Methodology from './pages/Methodology';
import Honeypots from './pages/Honeypots';
import ExportPage from './pages/ExportPage';
import LivePipelineGraph, { type PipelineSnapshot } from './components/LivePipelineGraph';
import { apiUrl } from './lib/api';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col font-body bg-paper text-ink selection:bg-evidence/30">
        <header className="border-b border-rule bg-card/95 backdrop-blur px-5 md:px-8 py-5 flex items-center justify-between sticky top-0 z-50">
          <Link to="/" className="text-xl md:text-2xl font-display font-semibold tracking-tight">
            Redrob Ranker
          </Link>
          <Navigation />
        </header>

        <main className="flex-1 flex flex-col relative">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/run" element={<RunPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/results/:id" element={<CandidateDetail />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/honeypots" element={<Honeypots />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function Navigation() {
  const location = useLocation();
  const navLink = (path: string, label: string) => {
    const isActive = location.pathname.startsWith(path);
    return (
      <Link
        to={path}
        className={`text-xs md:text-sm font-medium transition-colors ${isActive ? 'text-evidence border-b-2 border-evidence pb-1' : 'text-ink/70 hover:text-ink hover:border-b-2 hover:border-rule pb-1'}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="flex gap-4 md:gap-8">
      {navLink('/run', 'Run Ranking')}
      {navLink('/results', 'Results Ledger')}
      {navLink('/methodology', 'Methodology')}
    </nav>
  );
}

function Overview() {
  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [demoState, setDemoState] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/pipeline'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setPipeline(data))
      .catch(() => undefined);
  }, []);

  const runMiniDemo = async () => {
    setDemoState('running');
    setError(null);
    const stageIds = ['raw', 'honeypot', 'hybrid', 'cross_encoder', 'judge', 'output'];
    const timers = stageIds.map((id, index) =>
      window.setTimeout(() => setActiveStage(id), index * 650)
    );

    try {
      const res = await fetch(apiUrl('/api/rank'), { method: 'POST', body: new FormData() });
      if (!res.ok) throw new Error(`Ranking server returned ${res.status}.`);
      const data = await res.json();
      setPipeline(data.pipeline);
      setActiveStage('output');
      setDemoState('complete');
    } catch (err: any) {
      setError(err.message || 'Could not run the bundled sample.');
      setDemoState('error');
      setActiveStage(null);
    } finally {
      timers.forEach(window.clearTimeout);
    }
  };

  return (
    <div className="w-full">
      <section className="home-hero">
        <div className="home-hero__copy">
          <div className="eyebrow">Evidence-first candidate ranking</div>
          <h1>Evidence and reasoning you can audit.</h1>
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
              {demoState === 'running' ? 'Running sample...' : 'Run bundled sample'}
            </button>
            <Link to="/run" className="secondary-action">Upload candidate file</Link>
          </div>
          {error && <div className="demo-error">{error}</div>}
          {demoState === 'complete' && pipeline?.top_candidate_id && (
            <Link to={`/results/${pipeline.top_candidate_id}#evidence`} className="demo-complete">
              Open {pipeline.top_candidate_id} evidence view
            </Link>
          )}
        </div>
        <LivePipelineGraph snapshot={pipeline} activeStage={activeStage} />
      </section>

      <section className="work-section" aria-labelledby="how-it-works">
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

      <section className="comparison-section" aria-label="Ranking contrast">
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
