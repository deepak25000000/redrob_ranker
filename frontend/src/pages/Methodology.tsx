import { useEffect, useState } from 'react';
import { AlertCircle, Scale, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import LivePipelineGraph, { type PipelineSnapshot } from '../components/LivePipelineGraph';
import { apiUrl } from '../lib/api';

const weightColors = ['#F59E0B', '#10B981', '#EF4444', '#F59E0B', '#10B981', '#EF4444', '#F59E0B', '#10B981', '#EF4444'];

interface MethodologyData {
  weights: Record<string, number>;
  disqualifier_rules: string[];
  must_have_skill_groups?: Record<string, string[]>;
  nice_to_have_skill_groups?: Record<string, string[]>;
}

export default function Methodology() {
  const [data, setData] = useState<MethodologyData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/methodology'))
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
      <div className="max-w-4xl mx-auto py-16 px-8 w-full animate-fade-in">
        <div className="p-6 bg-caution/10 border-l-4 border-caution flex flex-col items-start gap-3 rounded-lg">
          <span className="font-bold text-caution font-mono uppercase tracking-wider text-xs flex items-center gap-2">
            <AlertCircle size={14} /> Data Load Failure
          </span>
          <span className="text-[#FCA5A5] leading-relaxed text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-8 w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="skeleton h-6 w-64 rounded-lg" />
          <div className="skeleton h-4 w-48 rounded-lg" />
        </div>
      </div>
    );
  }

  const weightEntries = Object.entries(data.weights) as [string, number][];
  const chartData = weightEntries.map(([k, v]) => ({
    name: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    weight: v * 100,
    raw: v
  }));

  return (
    <div className="max-w-5xl mx-auto py-12 md:py-16 px-5 md:px-8 w-full animate-fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-display mb-2 text-white">Methodology</h1>
        <p className="text-[#94A3B8] text-sm">How candidate scores are computed — weights, rules, and pipeline architecture.</p>
      </div>

      <div className="mb-12">
        <LivePipelineGraph snapshot={pipeline} compact />
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="card-hover">
          <div className="flex items-center gap-2 mb-5">
            <Scale size={18} className="text-evidence" />
            <h2 className="text-xl font-display text-white">Current Weights</h2>
          </div>
          <div className="bg-card border border-rule/30 shadow-sm overflow-hidden rounded-xl">
            {weightEntries.map(([k, v], idx, arr) => (
              <div key={k} className={`flex justify-between items-center p-4 font-mono text-[11px] ${idx !== arr.length - 1 ? 'border-b border-rule/20' : ''}`}>
                <span className="text-[#94A3B8] capitalize flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: weightColors[idx % weightColors.length] }} />
                  {k.replace(/_/g, ' ')}
                </span>
                <span className="font-bold text-white">{Number(v).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-hover">
          <div className="flex items-center gap-2 mb-5">
            <Shield size={18} className="text-caution" />
            <h2 className="text-xl font-display text-white">Disqualifier Rules</h2>
          </div>
          <div className="bg-card border-t-4 border-caution border-l border-r border-b border-rule/30 shadow-sm p-6 rounded-xl">
            <div className="font-mono text-[10px] text-caution uppercase tracking-widest font-bold mb-4">CRITICAL FIT RISKS</div>
            <ul className="space-y-3 text-sm text-[#CBD5E1]">
              {data.disqualifier_rules.map((rule: string) => (
                <li key={rule} className="flex gap-3 items-start group transition-all">
                  <span className="text-caution mt-0.5 font-mono text-xs" aria-hidden="true">#</span>
                  <span className="leading-snug">{rule.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mb-12 card-hover">
        <h2 className="text-xl font-display mb-5 text-white">Weight Distribution</h2>
        <div className="bg-card border border-rule/30 shadow-sm p-4 md:p-6 rounded-xl">
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 100, bottom: 4 }}>
                <XAxis type="number" domain={[0, 30]} tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono', fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono', fill: '#64748B' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  contentStyle={{ background: '#1E293B', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 12, fontFamily: 'IBM Plex Mono', color: '#E2E8F0' }}
                  labelStyle={{ color: '#F59E0B' }}
                  formatter={(value: unknown) => typeof value === 'number' ? `${value.toFixed(1)}%` : value as React.ReactNode}
                />
                <Bar dataKey="weight" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={weightColors[i % weightColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-4 text-[10px] font-mono text-[#475569] text-center">
            Bar length represents each component's percentage contribution to the final hybrid score.
          </div>
        </div>
      </div>

      {data.must_have_skill_groups && Object.keys(data.must_have_skill_groups).length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-display mb-5 text-white">Skill Groups</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(data.must_have_skill_groups).map(([group, skills]) => (
              <div key={group} className="bg-card border border-rule/30 p-5 card-hover rounded-xl">
                <div className="font-mono text-[10px] text-evidence uppercase tracking-wider font-bold mb-2">Must-have</div>
                <h3 className="font-display text-base mb-2 text-white capitalize">{group.replace(/_/g, ' ')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s: string) => (
                    <span key={s} className="tag-evidence text-[9px]">{s}</span>
                  ))}
                </div>
              </div>
            ))}
            {data.nice_to_have_skill_groups && Object.entries(data.nice_to_have_skill_groups).map(([group, skills]) => (
              <div key={group} className="bg-card border border-rule/30 p-5 card-hover rounded-xl">
                <div className="font-mono text-[10px] text-trust uppercase tracking-wider font-bold mb-2">Nice-to-have</div>
                <h3 className="font-display text-base mb-2 text-white capitalize">{group.replace(/_/g, ' ')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s: string) => (
                    <span key={s} className="tag-trust text-[9px]">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
