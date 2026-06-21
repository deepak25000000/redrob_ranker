import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiUrl } from '../lib/api';

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl(`/api/candidate/${id}`))
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(console.error);
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="font-mono text-sm text-ink/50 animate-pulse">Retrieving case file...</div>
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="p-12 text-center text-caution">
        <div className="font-display text-2xl mb-2">Record Not Found</div>
        <p className="text-ink/70">Candidate {id} is not in the current active ranking session.</p>
      </div>
    );
  }

  const cand = data.candidate;
  const spans = data.evidence_spans || [];
  const renderHighlightedText = (text: string, roleSpans: any[]) => {
    const cleanSpans = roleSpans
      .filter((span) => Number.isInteger(span.start) && Number.isInteger(span.end) && span.end > span.start)
      .sort((a, b) => a.start - b.start)
      .reduce((acc: any[], span) => {
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
          className="bg-evidence/30 text-ink px-1 border-b-2 border-evidence"
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

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden h-full max-h-[calc(100vh-73px)] border-t border-rule">
      {/* Pane 1: Profile Summary */}
      <div className="w-full md:w-[28%] border-r border-rule bg-paper p-8 overflow-y-auto hidden md:block">
        <Link to="/results" className="text-xs font-mono font-medium text-ink/50 hover:text-ink mb-8 flex items-center gap-2 transition-colors focus:outline-none focus:underline">
          <span>←</span> RETURN TO LEDGER
        </Link>
        <div className="font-mono text-xs mb-3 text-ink/50 tracking-wider">CANDIDATE PROFILE</div>
        <h2 className="font-display text-3xl mb-2 leading-tight">{cand.profile?.anonymized_name || cand.profile?.name || "Redacted"}</h2>
        <p className="text-base font-medium text-ink/90 mb-6">{cand.profile?.current_title}</p>
        
        <div className="grid grid-cols-2 gap-4 mb-10 pb-8 border-b border-rule/50">
          <div>
            <div className="text-[10px] uppercase font-bold text-ink/40 tracking-wider mb-1">Location</div>
            <div className="text-sm">{cand.profile?.location || "Unknown"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-ink/40 tracking-wider mb-1">Candidate ID</div>
            <div className="text-sm font-mono">{id}</div>
          </div>
        </div>

        <div className="mb-4 text-[10px] uppercase font-bold text-ink/40 tracking-wider">Diagnostic Flags</div>
        {data.disqualifiers?.length > 0 ? (
          <div className="space-y-3">
            {data.disqualifiers.map((d: string, i: number) => (
              <div key={i} className="p-3 bg-caution/10 border-l-4 border-caution text-caution text-xs leading-relaxed">
                <span className="font-bold block mb-1">Flag: {d}</span>
                JD flags this as a critical fit risk based on established disqualifier rules.
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-trust/10 border-l-4 border-trust text-trust text-xs font-medium">
            No disqualifying patterns detected.
          </div>
        )}
      </div>

      {/* Pane 2: Annotated Evidence View */}
      <div id="evidence" className="flex-1 bg-card p-10 overflow-y-auto relative scroll-mt-24">
        <div className="max-w-2xl mx-auto">
          <div className="sticky top-0 bg-card/95 backdrop-blur py-4 mb-8 border-b-2 border-rule z-10 flex justify-between items-end">
            <div>
              <h3 className="font-display text-2xl mb-1">Annotated Evidence View</h3>
              <p className="text-sm text-ink/60">
                Career history text with inline highlights dictating the fit score.
              </p>
            </div>
          </div>

          {cand.career_history?.map((role: any, idx: number) => {
            const roleSpans = spans.filter((s: any) => s.career_history_index === idx);
            
            return (
              <div key={idx} className="mb-12">
                <div className="flex items-baseline gap-4 mb-2">
                  <h4 className="font-bold text-lg">{role.title}</h4>
                  <span className="text-sm text-ink/60">— {role.company}</span>
                </div>
                <div className="font-mono text-xs text-ink/50 mb-4">{role.duration_months} MONTHS</div>
                
                <div className="text-base leading-relaxed whitespace-pre-wrap text-ink/90 relative">
                  {roleSpans.length > 0 ? (
                    <>
                      <div className="absolute -left-6 top-0 bottom-0 w-1 bg-evidence/30"></div>
                      <span className="inline-block mb-4 text-xs font-mono bg-evidence/20 text-ink/80 px-2 py-1 border border-evidence/30 rounded-sm">
                        EVIDENCE DETECTED
                      </span>
                      <br/>
                      {renderHighlightedText(role.description || '', roleSpans)}
                    </>
                  ) : (
                    <div className="opacity-80">
                      {role.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pane 3: Score Ledger */}
      <div className="w-full md:w-[26%] border-l border-rule bg-ink text-paper p-8 overflow-y-auto">
        <h3 className="font-display text-xl mb-8 text-card border-b-2 border-rule/30 pb-3 flex items-center justify-between">
          <span>Score Ledger</span>
          <span className="font-mono text-xs font-normal opacity-50">COMPUTED</span>
        </h3>
        
        <div className="font-mono text-[11px] space-y-4 mb-10 opacity-80 leading-relaxed tracking-wide">
          <div className="flex justify-between items-end">
            <span className="border-b border-paper/20 border-dotted flex-1 mr-4 pb-1">Title fit</span>
            <span>{data.title_fit?.toFixed(2)} × 0.14 = {(data.title_fit * 0.14).toFixed(3)}</span>
          </div>
          <div className="flex justify-between items-end">
            <span className="border-b border-paper/20 border-dotted flex-1 mr-4 pb-1">Must-have skills</span>
            <span>{data.must_have_skill_fit?.toFixed(2)} × 0.24 = {(data.must_have_skill_fit * 0.24).toFixed(3)}</span>
          </div>
          <div className="flex justify-between items-end">
            <span className="border-b border-paper/20 border-dotted flex-1 mr-4 pb-1">Eval-framework</span>
            <span>{data.eval_framework_fit?.toFixed(2)} × 0.08 = {(data.eval_framework_fit * 0.08).toFixed(3)}</span>
          </div>
          <div className="flex justify-between items-end text-evidence font-bold">
            <span className="border-b border-paper/20 border-dotted flex-1 mr-4 pb-1">Semantic fit</span>
            <span>{data.semantic_career_fit?.toFixed(2)} × 0.22 = {(data.semantic_career_fit * 0.22).toFixed(3)}</span>
          </div>
          <div className="flex justify-between items-end">
            <span className="border-b border-paper/20 border-dotted flex-1 mr-4 pb-1">Exp years fit</span>
            <span>{data.experience_years_fit?.toFixed(2)} × 0.08 = {(data.experience_years_fit * 0.08).toFixed(3)}</span>
          </div>
          <div className="flex justify-between items-end">
            <span className="border-b border-paper/20 border-dotted flex-1 mr-4 pb-1">Trajectory</span>
            <span>{data.career_trajectory_fit?.toFixed(2)} × 0.08 = {(data.career_trajectory_fit * 0.08).toFixed(3)}</span>
          </div>
          <div className="flex justify-between items-end">
            <span className="border-b border-paper/20 border-dotted flex-1 mr-4 pb-1">Location</span>
            <span>{data.location_fit?.toFixed(2)} × 0.06 = {(data.location_fit * 0.06).toFixed(3)}</span>
          </div>
        </div>

        <div className="font-mono text-[11px] border-t border-rule/30 pt-4 space-y-3 mb-6 tracking-wide">
          <div className="flex justify-between text-paper/90">
            <span>FIT SUBTOTAL</span>
            <span>{data.fit_score?.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-paper/70">
            <span>× BEHAVIOR MODIFIER</span>
            <span>{data.behavioral_modifier?.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-caution font-bold">
            <span>− DISQUALIFIER PENALTY</span>
            <span>{data.penalty?.toFixed(3)}</span>
          </div>
        </div>

        <div className="flex justify-between items-baseline font-mono border-t border-rule/50 pt-6 mt-6">
          <span className="text-sm text-trust font-bold tracking-widest">FINAL SCORE</span>
          <span className="text-2xl text-trust">{data.score?.toFixed(3)}</span>
        </div>
      </div>
    </div>
  );
}
