import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, FileText, User, AlertTriangle, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiUrl } from '../lib/api';

interface CareerRole {
  title: string;
  company: string;
  duration_months: number;
  description: string;
}

interface EvidenceSpan {
  start: number;
  end: number;
  career_history_index: number;
  contributes_to: string;
  delta_estimate: number;
}

interface CandidateProfile {
  anonymized_name?: string;
  name?: string;
  current_title?: string;
  location?: string;
}

interface CandidateData {
  candidate: {
    profile?: CandidateProfile;
    career_history?: CareerRole[];
  };
  evidence_spans?: EvidenceSpan[];
  score?: number;
  fit_score?: number;
  behavioral_modifier?: number;
  penalty?: number;
  title_fit: number;
  must_have_skill_fit: number;
  eval_framework_fit: number;
  semantic_career_fit: number;
  experience_years_fit: number;
  career_trajectory_fit: number;
  location_fit: number;
  disqualifiers?: string[];
}

type Tab = 'evidence' | 'scores' | 'profile';

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CandidateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('evidence');

  useEffect(() => {
    fetch(apiUrl(`/api/candidate/${id}`))
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(console.error);
  }, [id]);

  const scoreChartData = useMemo(() => {
    if (!data) return [];
    const items = [
      { name: 'Title', value: data.title_fit * 0.14, raw: data.title_fit, weight: 0.14 },
      { name: 'Must-have skills', value: data.must_have_skill_fit * 0.24, raw: data.must_have_skill_fit, weight: 0.24 },
      { name: 'Eval framework', value: data.eval_framework_fit * 0.08, raw: data.eval_framework_fit, weight: 0.08 },
      { name: 'Semantic fit', value: data.semantic_career_fit * 0.22, raw: data.semantic_career_fit, weight: 0.22 },
      { name: 'Exp years', value: data.experience_years_fit * 0.08, raw: data.experience_years_fit, weight: 0.08 },
      { name: 'Trajectory', value: data.career_trajectory_fit * 0.08, raw: data.career_trajectory_fit, weight: 0.08 },
      { name: 'Location', value: data.location_fit * 0.06, raw: data.location_fit, weight: 0.06 },
    ].filter(i => i.value > 0);
    return items;
  }, [data]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="skeleton h-6 w-48 rounded-lg" />
          <div className="skeleton h-4 w-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4 animate-fade-in">
        <AlertTriangle size={32} className="text-caution" />
        <div className="font-display text-2xl text-white">Record Not Found</div>
        <p className="text-[#94A3B8]">Candidate {id} is not in the current active ranking session.</p>
        <Link to="/results" className="btn-ink text-sm mt-4">Return to Ledger</Link>
      </div>
    );
  }

  const cand = data.candidate;
  const spans = data.evidence_spans || [];

  const renderHighlightedText = (text: string, roleSpans: EvidenceSpan[]) => {
    const cleanSpans = roleSpans
      .filter((span) => Number.isInteger(span.start) && Number.isInteger(span.end) && span.end > span.start)
      .sort((a, b) => a.start - b.start)
      .reduce<EvidenceSpan[]>((acc, span) => {
        const previous = acc[acc.length - 1];
        if (!previous || span.start >= previous.end) acc.push(span);
        return acc;
      }, []);

    if (cleanSpans.length === 0) return <span>{text}</span>;

    const parts = [];
    let cursor = 0;
    cleanSpans.forEach((span, index) => {
      if (span.start > cursor) {
        parts.push(<span key={`plain-${index}`}>{text.slice(cursor, span.start)}</span>);
      }
      parts.push(
        <mark
          key={`mark-${index}`}
          className="bg-evidence/20 text-[#FDE68A] px-1 border-b-2 border-evidence rounded-sm transition-all hover:bg-evidence/30"
          title={`${span.contributes_to}: +${span.delta_estimate}`}
        >
          {text.slice(span.start, span.end)}
        </mark>
      );
      cursor = span.end;
    });
    if (cursor < text.length) parts.push(<span key="plain-tail">{text.slice(cursor)}</span>);
    return parts;
  };

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'evidence', label: 'Evidence', icon: FileText },
    { key: 'scores', label: 'Score Breakdown', icon: BarChart3 },
    { key: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      <div className="border-b border-rule/30 bg-card/80 glass px-5 md:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link to="/results" className="text-[#64748B] hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="font-mono text-xs text-[#64748B]">{id}</div>
            <h2 className="font-display text-lg font-semibold text-white">{cand.profile?.anonymized_name || cand.profile?.name || 'Redacted'}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data.disqualifiers && data.disqualifiers.length > 0 ? (
            <span className="tag-caution flex items-center gap-1"><AlertTriangle size={10} /> {data.disqualifiers.length} flags</span>
          ) : (
            <span className="tag-trust flex items-center gap-1"><ShieldCheck size={10} /> Clean</span>
          )}
          <span className="text-2xl font-mono font-bold text-trust">{data.score?.toFixed(3)}</span>
        </div>
      </div>

      <div className="border-b border-rule/30 bg-ink/50 px-5 md:px-8 flex gap-0">
        {tabs.map(t => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 md:px-6 py-3 text-sm font-medium border-b-2 transition-all ${active ? 'border-evidence text-evidence' : 'border-transparent text-[#64748B] hover:text-white hover:border-rule/50'}`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tab === 'evidence' && (
          <div className="max-w-3xl mx-auto p-5 md:p-8">
            {cand.career_history?.map((role: CareerRole, idx: number) => {
              const roleSpans = spans.filter((s: EvidenceSpan) => s.career_history_index === idx);
              return (
                <div key={idx} className="mb-10 animate-slide-up" style={{ animationDelay: `${idx * 100}ms` }}>
                  <div className="flex items-baseline gap-3 mb-1">
                    <h4 className="font-bold text-lg text-white">{role.title}</h4>
                    <span className="text-sm text-[#94A3B8]">— {role.company}</span>
                  </div>
                  <div className="font-mono text-xs text-[#475569] mb-3">{role.duration_months} MONTHS</div>
                  <div className="text-base leading-relaxed whitespace-pre-wrap text-[#CBD5E1] relative pl-4 border-l-2 border-rule/30">
                    {roleSpans.length > 0 ? (
                      <>
                        <div className="mb-3">
                          <span className="text-[10px] font-mono bg-evidence/15 text-evidence px-2 py-0.5 border border-evidence/30 rounded-sm">EVIDENCE DETECTED</span>
                        </div>
                        {renderHighlightedText(role.description || '', roleSpans)}
                      </>
                    ) : (
                      <div className="opacity-70">{role.description}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'scores' && (
          <div className="max-w-3xl mx-auto p-5 md:p-8 space-y-8 animate-fade-in">
            <div>
              <h3 className="font-display text-xl mb-2 text-white">Weighted Score Components</h3>
              <p className="text-sm text-[#94A3B8] mb-6">Each component contributes raw_fit × weight to the final score.</p>
              {scoreChartData.length > 0 && (
                <div className="bg-card border border-rule/30 p-4 md:p-6 rounded-xl">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={scoreChartData} margin={{ top: 8, left: -16, right: 8, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono', fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono', fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#1E293B', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#E2E8F0' }}
                        labelStyle={{ color: '#F59E0B' }}
                        formatter={(value: unknown) => typeof value === 'number' ? value.toFixed(3) : value as React.ReactNode}
                      />
                      <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-ink/80 border border-rule/30 p-6 md:p-8 rounded-xl">
              <h3 className="font-display text-lg mb-6 text-white border-b border-rule/20 pb-3 flex items-center justify-between">
                <span>Score Ledger</span>
                <span className="font-mono text-xs font-normal text-[#475569]">COMPUTED</span>
              </h3>
              <div className="font-mono text-[11px] space-y-3 mb-6 text-[#94A3B8] leading-relaxed">
                {[
                  { label: 'Title fit', raw: data.title_fit, weight: 0.14 },
                  { label: 'Must-have skills', raw: data.must_have_skill_fit, weight: 0.24 },
                  { label: 'Eval-framework', raw: data.eval_framework_fit, weight: 0.08 },
                  { label: 'Semantic fit', raw: data.semantic_career_fit, weight: 0.22, highlight: true },
                  { label: 'Exp years fit', raw: data.experience_years_fit, weight: 0.08 },
                  { label: 'Trajectory', raw: data.career_trajectory_fit, weight: 0.08 },
                  { label: 'Location', raw: data.location_fit, weight: 0.06 },
                ].map((item, i) => (
                  <div key={i} className={`flex justify-between items-end ${item.highlight ? 'text-evidence font-bold' : ''}`}>
                    <span className="border-b border-white/10 border-dotted flex-1 mr-4 pb-0.5">{item.label}</span>
                    <span>{item.raw?.toFixed(2)} × {item.weight} = {(item.raw * item.weight).toFixed(3)}</span>
                  </div>
                ))}
              </div>
              <div className="font-mono text-[11px] border-t border-rule/20 pt-3 space-y-2 mb-4 text-[#94A3B8]">
                <div className="flex justify-between text-white/80">
                  <span>FIT SUBTOTAL</span>
                  <span>{data.fit_score?.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>× BEHAVIOR MODIFIER</span>
                  <span>{data.behavioral_modifier?.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-caution font-bold">
                  <span>− DISQUALIFIER PENALTY</span>
                  <span>{data.penalty?.toFixed(3)}</span>
                </div>
              </div>
              <div className="flex justify-between items-baseline font-mono border-t border-rule/20 pt-4 mt-2">
                <span className="text-sm text-trust font-bold tracking-widest">FINAL SCORE</span>
                <span className="text-2xl text-trust">{data.score?.toFixed(3)}</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div className="max-w-3xl mx-auto p-5 md:p-8 animate-fade-in">
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-card border border-rule/30 p-5 card-hover rounded-xl">
                <div className="text-[10px] uppercase font-bold text-[#475569] tracking-wider mb-1">Name</div>
                <div className="font-display text-xl text-white">{cand.profile?.anonymized_name || cand.profile?.name || 'Redacted'}</div>
              </div>
              <div className="bg-card border border-rule/30 p-5 card-hover rounded-xl">
                <div className="text-[10px] uppercase font-bold text-[#475569] tracking-wider mb-1">Current Title</div>
                <div className="text-base font-medium text-[#E2E8F0]">{cand.profile?.current_title || 'Unknown'}</div>
              </div>
              <div className="bg-card border border-rule/30 p-5 card-hover rounded-xl">
                <div className="text-[10px] uppercase font-bold text-[#475569] tracking-wider mb-1">Location</div>
                <div className="text-sm text-[#E2E8F0]">{cand.profile?.location || 'Unknown'}</div>
              </div>
              <div className="bg-card border border-rule/30 p-5 card-hover rounded-xl">
                <div className="text-[10px] uppercase font-bold text-[#475569] tracking-wider mb-1">Candidate ID</div>
                <div className="text-sm font-mono text-[#E2E8F0]">{id}</div>
              </div>
            </div>

            <div className="mb-4 text-[10px] uppercase font-bold text-[#475569] tracking-wider">Diagnostic Flags</div>
            {data.disqualifiers && data.disqualifiers.length > 0 ? (
              <div className="space-y-3">
                {data.disqualifiers.map((d: string, i: number) => (
                  <div key={i} className="p-4 bg-caution/10 border-l-4 border-caution text-caution text-xs leading-relaxed card-hover rounded-lg">
                    <span className="font-bold block mb-1 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> Flag: {d}
                    </span>
                    JD flags this as a critical fit risk based on established disqualifier rules.
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-trust/10 border-l-4 border-trust text-trust text-xs font-medium flex items-center gap-2 rounded-lg">
                <ShieldCheck size={14} />
                No disqualifying patterns detected.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
