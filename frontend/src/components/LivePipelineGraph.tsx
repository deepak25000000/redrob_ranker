import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileSearch, Filter, Gauge, GitBranch, ListChecks, Scale, Activity } from 'lucide-react';

export type PipelineStage = {
  id: string;
  label: string;
  count_in?: number;
  count_out?: number;
  excluded?: number;
  why: string;
};

export type PipelineSnapshot = {
  has_run: boolean;
  source?: string | null;
  runtime_seconds?: number | null;
  top_candidate_id?: string | null;
  top_candidate_score?: number | null;
  stages: PipelineStage[];
};

const fallbackStages: PipelineStage[] = [
  {
    id: 'raw',
    label: 'Raw Candidates',
    why: 'Loads the candidate pool exactly as supplied, preserving the profile, skills, signals, and career-history text used later for evidence.'
  },
  {
    id: 'honeypot',
    label: 'Honeypot Filter',
    why: 'Excludes profiles with internal contradictions, such as impossible skill duration or unsupported expert claims, before scoring can reward them.'
  },
  {
    id: 'hybrid',
    label: 'Hybrid Search',
    why: 'Combines dense semantic similarity over the career narrative with sparse, exact evidence checks so paraphrased skill matches and literal requirements both matter.'
  },
  {
    id: 'cross_encoder',
    label: 'Cross-Encoder Rerank',
    why: 'The shortlist is sorted by weighted fit signals, behavior modifiers, penalties, and deterministic tie-breaks rather than a single vector score.'
  },
  {
    id: 'judge',
    label: 'LLM-as-Judge',
    why: 'Each ranked candidate receives a fact-grounded justification generated from the same component scores used to place them.'
  },
  {
    id: 'output',
    label: 'Ranked Output',
    why: 'Recruiters get an ordered ledger and can open the evidence view to inspect the career-history phrases behind the score.'
  }
];

const iconMap: Record<string, typeof FileSearch> = {
  raw: FileSearch,
  honeypot: Filter,
  hybrid: GitBranch,
  cross_encoder: Scale,
  judge: Gauge,
  output: ListChecks
};

type Props = {
  snapshot?: PipelineSnapshot | null;
  activeStage?: string | null;
  compact?: boolean;
  onStageSelect?: (stageId: string) => void;
};

function AnimatedCount({ value, label }: { value: number; label: string }) {
  return (
    <span className="animate-fade-in-fast">
      {value} {label}
    </span>
  );
}

export default function LivePipelineGraph({ snapshot, activeStage, compact = false, onStageSelect }: Props) {
  const stages = useMemo(
    () => snapshot?.stages?.length ? snapshot.stages : fallbackStages,
    [snapshot?.stages]
  );
  const [stateSelectedId, setStateSelectedId] = useState(stages[0]?.id || 'raw');
  const [idleIndex, setIdleIndex] = useState(0);

  const selectedId = activeStage || stateSelectedId;

  useEffect(() => {
    if (activeStage) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches || snapshot?.has_run) return;
    const timer = window.setInterval(() => {
      setIdleIndex((index) => {
        const next = (index + 1) % stages.length;
        setStateSelectedId(stages[next].id);
        return next;
      });
    }, 1800);
    return () => window.clearInterval(timer);
  }, [activeStage, snapshot?.has_run, stages]);

  const selected = useMemo(
    () => stages.find((stage) => stage.id === selectedId) || stages[0],
    [selectedId, stages]
  );

  const selectStage = (stageId: string) => {
    setStateSelectedId(stageId);
    onStageSelect?.(stageId);
  };

  const isActiveStage = (stageId: string) => stageId === selected.id || stageId === activeStage || (!snapshot?.has_run && stages.findIndex(s => s.id === stageId) === idleIndex);

  return (
    <section className={`pipeline-board ${compact ? 'pipeline-board--compact' : ''}`} aria-labelledby="pipeline-title">
      <div className="pipeline-board__header">
        <div>
          <div className="eyebrow">Live Pipeline Graph</div>
          <h2 id="pipeline-title" className="text-3xl md:text-4xl font-display leading-tight">
            Multi-stage ranking you can interrogate.
          </h2>
        </div>
        <div className="pipeline-board__status font-mono">
          {snapshot?.has_run ? (
            <>
              <span>{snapshot.source || 'latest run'}</span>
              {typeof snapshot.runtime_seconds === 'number' && (
                <strong className="animate-fade-in">{snapshot.runtime_seconds.toFixed(2)}s runtime</strong>
              )}
              {typeof snapshot.top_candidate_score === 'number' && (
                <span>top score: <strong>{snapshot.top_candidate_score.toFixed(3)}</strong></span>
              )}
            </>
          ) : (
            <span className="flex items-center gap-2">
              <Activity size={12} className="text-evidence/60" />
              Idle map. Run the bundled sample to populate live counts.
            </span>
          )}
        </div>
      </div>

      <div className="pipeline-board__graph" role="list" aria-label="Ranking pipeline stages">
        {stages.map((stage, index) => {
          const Icon = iconMap[stage.id] || FileSearch;
          const active = isActiveStage(stage.id);
          const hasCounts = typeof stage.count_in === 'number' || typeof stage.count_out === 'number';
          return (
            <div
              className="pipeline-board__step"
              role="listitem"
              key={stage.id}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <button
                type="button"
                onMouseEnter={() => selectStage(stage.id)}
                onFocus={() => selectStage(stage.id)}
                onClick={() => selectStage(stage.id)}
                className={`pipeline-node ${active ? 'pipeline-node--active' : ''}`}
                aria-pressed={stage.id === selected.id}
              >
                <span className="pipeline-node__icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="pipeline-node__label">{stage.label}</span>
                <span className="pipeline-node__metric font-mono">
                  {hasCounts ? `${stage.count_in ?? '-'} → ${stage.count_out ?? '-'}` : 'inspect'}
                </span>
              </button>
              {index < stages.length - 1 && (
                <ArrowRight className="pipeline-arrow" size={22} strokeWidth={1.6} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      <div className="pipeline-board__drawer" key={selected.id}>
        <div className="animate-fade-in">
          <div className="eyebrow">{selected.label}</div>
          <p>{selected.why}</p>
        </div>
        <div className="pipeline-board__numbers font-mono" aria-live="polite">
          {typeof selected.count_in === 'number' && (
            <span><AnimatedCount value={selected.count_in} label="in" /></span>
          )}
          {typeof selected.excluded === 'number' && selected.excluded > 0 && (
            <span><AnimatedCount value={selected.excluded} label="excluded" /></span>
          )}
          {typeof selected.count_out === 'number' && (
            <span><AnimatedCount value={selected.count_out} label="out" /></span>
          )}
          {snapshot?.top_candidate_id && selected.id === 'judge' && (
            <Link to={`/results/${snapshot.top_candidate_id}#evidence`} className="pipeline-board__evidence-link">
              Open top evidence file
            </Link>
          )}
        </div>
      </div>

      <noscript>
        <div className="pipeline-board__noscript">
          JavaScript is disabled, so the pipeline is shown as a static sequence. The stages remain readable from raw candidate loading through evidence-backed ranked output.
        </div>
      </noscript>
    </section>
  );
}
