import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Search, X, ChevronDown, ChevronUp, Sparkles, Briefcase, MapPin, Clock,
  AlertTriangle, Users, Sun, Moon, BarChart3, ChevronRight,
  Star, Target, Layers, RefreshCw, Wifi, WifiOff
} from 'lucide-react';
import { apiUrl } from '../lib/api';

interface RankingEntry {
  candidate_id: string; rank: number; score: number; reasoning: string;
  name: string | null; current_title: string | null; current_company: string | null;
  years_of_experience: number | null; location: string | null; country: string | null;
  top_skills: string[];
}

interface FullCandidate extends RankingEntry {
  score_breakdown: Record<string, number>;
  profile: Record<string, any>;
  career_history: any[]; education: any[]; skills: any[];
  certifications: any[]; languages: any[]; redrob_signals: Record<string, any>;
}

type Theme = 'dark' | 'light';
type ViewMode = 'dashboard' | 'ranking' | 'compare';

const JD_INFO = {
  role: 'Senior AI Engineer — Founding Team',
  company: 'Redrob AI',
  location: 'Hybrid — Pune / Noida',
  experience: '6–8 years',
  must_haves: ['Embeddings & retrieval', 'Vector DB / hybrid search', 'Python', 'Production ML systems', 'Ranking / recommendation'],
  nice_to_haves: ['Fine-tuning LLMs', 'Learning-to-rank (LTR)', 'MLOps', 'Deep Learning stack', 'LLM tooling', 'Distributed systems'],
  disqualifiers: ['Pure research-only career', 'Consulting-only career (TCS/Infosys/Wipro)', 'No production code in 18mo', 'CV/Speech/Robotics without NLP', 'Outside India, no relocate willingness'],
  ideal: 'Six to eight years of experience in applied ML/AI at a product company. Has shipped end-to-end ranking, search, or recommendation systems. Strong opinions on retrieval, evaluation, and when to fine-tune vs prompt.',
};

const PROFICIENCY_COLORS: Record<string, string> = {
  beginner: '#64748B', intermediate: '#F59E0B', advanced: '#10B981', expert: '#8B5CF6',
};

export default function DashboardPage() {
  const [rankingData, setRankingData] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState<Theme>('dark');
  const [viewMode, setViewMode] = useState<ViewMode>('ranking');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullDetail, setFullDetail] = useState<FullCandidate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['stats', 'distribution']));
  const [skillFilter, setSkillFilter] = useState<string[]>([]);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(apiUrl('/api/ranking'), { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error('API unavailable');
        const data = await res.json();
        if (!cancelled) { setRankingData(data.ranked || []); setIsOnline(true); setLoading(false); }
      } catch {
        try {
          const res = await fetch('/sample_ranking.json');
          const data = await res.json();
          if (!cancelled) { setRankingData(data.ranked || []); setIsOnline(false); setLoading(false); }
        } catch {
          if (!cancelled) { setError('No data available. Start the backend or run ranking first.'); setLoading(false); }
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/candidate/${id}`), { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error('API unavailable');
      const data = await res.json();
      setFullDetail(data);
      setDetailLoading(false);
    } catch {
      const entry = rankingData.find(r => r.candidate_id === id);
      if (entry) setFullDetail({ ...entry, score_breakdown: {}, profile: {}, career_history: [], education: [], skills: [], certifications: [], languages: [], redrob_signals: {} } as FullCandidate);
      setDetailLoading(false);
    }
  }, [rankingData]);

  const isDark = theme === 'dark';
  const filtered = useMemo(() => {
    let items = rankingData;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(c => [c.candidate_id, c.name, c.current_title, c.current_company, ...c.top_skills].some(f => f?.toLowerCase().includes(q)));
    }
    if (skillFilter.length > 0) items = items.filter(c => c.top_skills.some(s => skillFilter.includes(s)));
    return items.sort((a, b) => a.rank - b.rank);
  }, [rankingData, search, skillFilter]);

  const selected = useMemo(() => fullDetail || rankingData.find(c => c.candidate_id === selectedId) || null, [fullDetail, selectedId, rankingData]);

  const allSkills = useMemo(() => {
    const s = new Set<string>();
    rankingData.forEach(c => c.top_skills.forEach(sk => s.add(sk)));
    return Array.from(s).sort();
  }, [rankingData]);

  const stats = useMemo(() => {
    if (rankingData.length === 0) return null;
    const top10 = rankingData.slice(0, 10);
    const avgExp = top10.reduce((a, c) => a + (c.years_of_experience || 0), 0) / top10.length;
    return {
      total: rankingData.length, avgExpTop10: avgExp.toFixed(1),
      topScore: rankingData[0]?.score || 0,
      avgScore: (rankingData.reduce((a, c) => a + c.score, 0) / rankingData.length).toFixed(3),
    };
  }, [rankingData]);

  const scoreDist = useMemo(() => {
    const bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    return bins.slice(0, -1).map((b, i) => ({
      range: `${b.toFixed(1)}-${bins[i + 1].toFixed(1)}`,
      count: rankingData.filter(c => c.score >= b && c.score < bins[i + 1]).length,
    }));
  }, [rankingData]);

  const toggleSection = (s: string) => {
    setExpandedSections(prev => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });
  };

  const openDetail = (id: string) => {
    setSelectedId(id);
    setShowDetailDrawer(true);
    if (isOnline) fetchDetail(id);
    else {
      const entry = rankingData.find(r => r.candidate_id === id);
      if (entry) setFullDetail({ ...entry, score_breakdown: {}, profile: {}, career_history: [], education: [], skills: [], certifications: [], languages: [], redrob_signals: {} } as FullCandidate);
    }
  };

  if (loading) {
    return (
      <div className={`flex-1 flex items-center justify-center p-12 min-h-screen ${isDark ? 'bg-[#0B1120]' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <div className={`text-sm font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading ranking data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-12 min-h-screen gap-4 ${isDark ? 'bg-[#0B1120] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
        <WifiOff size={32} className="text-red-400" />
        <div className="font-display text-xl">No Data Available</div>
        <p className="text-sm text-center max-w-md">{error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-amber-500 text-black font-bold text-sm rounded-lg hover:bg-amber-400 transition-all">Retry</button>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0B1120] text-[#E2E8F0]' : 'bg-slate-50 text-slate-800'}`}>
      {/* LEFT SIDEBAR */}
      <aside className={`hidden lg:flex flex-col w-80 border-r shrink-0 overflow-y-auto transition-colors ${isDark ? 'bg-[#0F172A]/80 border-[#1E293B]' : 'bg-white/80 border-slate-200'}`}>
        <div className="p-5 border-b" style={{ borderColor: isDark ? '#1E293B' : '#E2E8F0' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/15' : 'bg-amber-500/10'}`}>
              <Sparkles size={16} className="text-amber-500" />
            </div>
            <div>
              <div className={`text-xs font-mono ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>REDROB RANKER</div>
              <div className={`text-sm font-display font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            {isOnline ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-amber-400" />}
            <span className={`text-[9px] font-mono ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>{isOnline ? 'LIVE - API connected' : 'OFFLINE - sample data'}</span>
          </div>
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
            <div className={`text-xs font-mono font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Job Description</div>
            <h3 className={`text-sm font-display font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{JD_INFO.role}</h3>
            <div className="flex items-center gap-1.5 mb-2">
              <Briefcase size={10} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{JD_INFO.company} · {JD_INFO.location}</span>
            </div>
            <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}><span className="font-bold">{JD_INFO.experience}</span> experience</div>
          </div>
        </div>
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {[
            { title: 'Must-haves', items: JD_INFO.must_haves, color: isDark ? 'text-emerald-400' : 'text-emerald-600', bg: isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200' },
            { title: 'Nice-to-haves', items: JD_INFO.nice_to_haves, color: isDark ? 'text-amber-400' : 'text-amber-600', bg: isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200' },
          ].map(section => (
            <div key={section.title}>
              <h4 className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-2 ${section.color}`}>{section.title}</h4>
              <div className="flex flex-wrap gap-1.5">
                {section.items.map(m => <span key={m} className={`px-2 py-0.5 text-[10px] font-mono font-medium rounded-full border ${section.bg} ${section.color}`}>{m}</span>)}
              </div>
            </div>
          ))}
          <div>
            <h4 className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>Disqualifiers</h4>
            <div className="space-y-1">
              {JD_INFO.disqualifiers.map(d => (
                <div key={d} className={`flex items-start gap-1.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <AlertTriangle size={10} className="text-red-500 shrink-0 mt-0.5" />
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>Ideal Candidate</h4>
            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{JD_INFO.ideal}</p>
          </div>
        </div>
        <div className={`p-5 border-t ${isDark ? 'border-[#1E293B]' : 'border-slate-200'}`}>
          {stats && (
            <div className="grid grid-cols-2 gap-2">
              <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                <div className={`text-lg font-bold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{stats.total}</div>
                <div className={`text-[9px] font-mono uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Candidates</div>
              </div>
              <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                <div className={`text-lg font-bold font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{stats.avgExpTop10}<span className="text-[10px]">y</span></div>
                <div className={`text-[9px] font-mono uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Avg Exp Top 10</div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className={`sticky top-0 z-30 px-4 md:px-6 py-3 transition-colors ${isDark ? 'bg-[#0F172A]/85 border-b border-[#1E293B]/40' : 'bg-white/85 border-b border-slate-200'}`} style={isDark ? { backdropFilter: 'blur(16px)' } : { backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, skill, company..."
                  className={`w-full pl-8 pr-8 py-2 text-sm rounded-lg border transition-all ${isDark ? 'bg-[#1E293B]/80 text-white border-[#334155] focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 placeholder:text-slate-500' : 'bg-white text-slate-800 border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 placeholder:text-slate-400'}`} />
                {search && <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}><X size={14} /></button>}
              </div>
              <div className="hidden md:flex items-center gap-1 border-l pl-3" style={{ borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                {(['dashboard', 'ranking', 'compare'] as const).map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode)}
                    className={`px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all ${viewMode === mode ? isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700' : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                    {mode === 'dashboard' ? 'Dashboard' : mode === 'ranking' ? 'Ranking' : 'Compare'}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-amber-400' : 'hover:bg-slate-100 text-slate-400 hover:text-amber-600'}`}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {viewMode === 'dashboard' && (
            <div className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
              <div>
                <button onClick={() => toggleSection('stats')} className="flex items-center gap-2 mb-4">
                  <h2 className={`text-lg font-display font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Dashboard Overview</h2>
                  {expandedSections.has('stats') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedSections.has('stats') && stats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Ranked', value: stats.total, icon: Users, color: 'text-blue-400' },
                      { label: 'Top Score', value: stats.topScore.toFixed(3), icon: Star, color: 'text-amber-400' },
                      { label: 'Avg Score', value: stats.avgScore, icon: BarChart3, color: 'text-emerald-400' },
                      { label: 'Avg Exp Top 10', value: `${stats.avgExpTop10}y`, icon: Clock, color: 'text-violet-400' },
                    ].map((s, i) => {
                      const Icon = s.icon;
                      return (
                        <div key={i} className={`p-4 rounded-xl border transition-all ${isDark ? 'bg-[#1E293B]/60 border-[#334155]' : 'bg-white border-slate-200 shadow-sm'}`}>
                          <Icon size={18} className={`${s.color} mb-2`} />
                          <div className={`text-xl font-bold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.value}</div>
                          <div className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <button onClick={() => toggleSection('distribution')} className="flex items-center gap-2 mb-3">
                  <h3 className={`text-sm font-display font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Score Distribution</h3>
                  {expandedSections.has('distribution') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {expandedSections.has('distribution') && (
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1E293B]/40 border-[#334155]' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={scoreDist}>
                        <XAxis dataKey="range" tick={{ fontSize: 9, fill: isDark ? '#64748B' : '#94A3B8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: isDark ? '#64748B' : '#94A3B8' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: isDark ? '#1E293B' : '#fff', border: `1px solid rgba(245,158,11,0.2)`, borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="count" fill="#F59E0B" radius={[3, 3, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Filter by skill:</span>
                {allSkills.slice(0, 20).map(skill => (
                  <button key={skill} onClick={() => setSkillFilter(skillFilter.includes(skill) ? skillFilter.filter(s => s !== skill) : [...skillFilter, skill])}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded-full border transition-all ${skillFilter.includes(skill) ? isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-amber-100 text-amber-700 border-amber-300' : isDark ? 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-500' : 'bg-transparent text-slate-400 border-slate-300 hover:border-slate-400'}`}>
                    {skill}
                  </button>
                ))}
              </div>
              <div>
                <h3 className={`text-sm font-display font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Top 5</h3>
                <div className="grid md:grid-cols-5 gap-3">
                  {rankingData.slice(0, 5).map(c => (
                    <button key={c.candidate_id} onClick={() => openDetail(c.candidate_id)}
                      className={`p-4 rounded-xl border text-left transition-all ${isDark ? 'bg-gradient-to-br from-[#1E293B]/80 to-[#1E293B]/40 border-[#334155] hover:border-amber-500/40' : 'bg-gradient-to-br from-white to-slate-50 border-slate-200 hover:border-amber-400/40 shadow-sm'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${c.rank === 1 ? 'bg-amber-500 text-black' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>{c.rank}</div>
                        <Star size={12} className={c.rank === 1 ? 'text-amber-500' : isDark ? 'text-slate-600' : 'text-slate-300'} />
                      </div>
                      <div className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{c.name || c.candidate_id}</div>
                      <div className={`text-[10px] font-mono mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{c.current_title} @ {c.current_company}</div>
                      <div className={`text-base font-bold font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{c.score.toFixed(3)}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {viewMode === 'ranking' && (
            <div className="p-4 md:p-6 max-w-6xl mx-auto w-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-lg font-display font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Ranked Candidates</h2>
                  <p className={`text-xs font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{filtered.length} of {rankingData.length} displayed {!isOnline && '(offline sample)'}</p>
                </div>
              </div>
              <div className="space-y-2">
                {filtered.map(c => (
                  <button key={c.candidate_id} onClick={() => openDetail(c.candidate_id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${isDark ? 'bg-[#1E293B]/40 border-[#334155] hover:border-amber-500/30 hover:bg-[#1E293B]/60' : 'bg-white border-slate-200 hover:border-amber-400/30 hover:bg-slate-50 shadow-sm'}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold font-mono text-sm ${c.rank === 1 ? 'bg-amber-500 text-black' : c.rank <= 3 ? isDark ? 'bg-slate-700 text-amber-400' : 'bg-slate-200 text-slate-700' : isDark ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                        {c.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{c.name || c.candidate_id}</span>
                          <span className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{c.current_title} @ {c.current_company}</span>
                          <span className={`text-[10px] font-mono border-l pl-2 ${isDark ? 'text-slate-500 border-[#334155]' : 'text-slate-400 border-slate-200'}`}>{c.years_of_experience?.toFixed(1)}y</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {c.top_skills.slice(0, 4).map(s => (
                            <span key={s} className="px-2 py-0.5 text-[9px] font-mono font-medium rounded-full border" style={{ background: isDark ? '#F59E0B15' : '#F59E0B10', color: '#F59E0B', borderColor: isDark ? '#F59E0B30' : '#F59E0B40' }}>{s}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 flex gap-0.5 h-2 overflow-hidden rounded-full" style={{ background: isDark ? '#1E293B' : '#E2E8F0' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(c.score * 60, 100)}%`, background: '#F59E0B' }} />
                          </div>
                          <span className={`text-xs font-mono font-bold w-16 text-right ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>+{c.score.toFixed(3)}</span>
                        </div>
                        <p className={`text-[10px] leading-relaxed mt-1 line-clamp-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{c.reasoning}</p>
                      </div>
                      <ChevronRight size={14} className={`shrink-0 mt-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className={`text-center py-16 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Search size={32} className="mx-auto mb-3 opacity-40" />
                    <div className="font-mono text-sm">No candidates match your search</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode === 'compare' && (
            <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
              <div className="mb-6">
                <h2 className={`text-lg font-display font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Keyword vs. Hybrid Ranking</h2>
                <p className={`text-xs font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Top 10 comparison: naive keyword match vs. full hybrid score</p>
              </div>
              {(() => {
                const kwScore = (c: RankingEntry) => {
                  const kw = ['RAG','LLM','LangChain','Pinecone','Transformer','Embedding','GPT','VectorDB'];
                  let score = 0;
                  c.top_skills.forEach(s => { if (kw.some(k => s.toLowerCase().includes(k.toLowerCase()))) score += 1; });
                  return score;
                };
                const kwRanked = [...rankingData].sort((a, b) => kwScore(b) - kwScore(a) || a.rank - b.rank);
                const kwTop10 = kwRanked.slice(0, 10);
                const ourTop10 = rankingData.slice(0, 10);
                return (
                  <>
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      <div className={`p-5 rounded-xl border ${isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-center gap-2 mb-4">
                          <AlertTriangle size={16} className="text-red-500" />
                          <h3 className={`text-sm font-display font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Keyword Match</h3>
                        </div>
                        {kwTop10.map((c, i) => {
                          const ourRank = rankingData.findIndex(d => d.candidate_id === c.candidate_id) + 1;
                          const delta = ourRank - (i + 1);
                          return (
                            <div key={c.candidate_id} className={`flex items-center gap-2 p-2 rounded-lg text-xs mb-1 ${isDark ? 'bg-slate-800/30' : 'bg-white/50'}`}>
                              <span className={`w-5 h-5 rounded flex items-center justify-center font-bold font-mono text-[10px] ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'}`}>{i + 1}</span>
                              <span className={`flex-1 font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{c.name}</span>
                              <span className={`font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{delta > 0 ? `↓${delta}` : delta < 0 ? `↑${Math.abs(delta)}` : '—'}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className={`p-5 rounded-xl border ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                        <div className="flex items-center gap-2 mb-4">
                          <Target size={16} className="text-emerald-500" />
                          <h3 className={`text-sm font-display font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Hybrid Ranking</h3>
                        </div>
                        {ourTop10.map((c, i) => {
                          const kwRank = kwRanked.findIndex(d => d.candidate_id === c.candidate_id) + 1;
                          const delta = kwRank - (i + 1);
                          return (
                            <div key={c.candidate_id} className={`flex items-center gap-2 p-2 rounded-lg text-xs mb-1 ${isDark ? 'bg-slate-800/30' : 'bg-white/50'}`}>
                              <span className={`w-5 h-5 rounded flex items-center justify-center font-bold font-mono text-[10px] ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>{i + 1}</span>
                              <span className={`flex-1 font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{c.name}</span>
                              <span className={`font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : '—'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#1E293B]/40 border-[#334155]' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <h3 className={`text-sm font-display font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Why it matters</h3>
                      <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Hybrid ranking demotes keyword-stuffed profiles when their career history doesn't back up the claimed AI skills, and promotes candidates who describe the same work in plain language. This catches the hidden-gem candidates that keyword matching would miss.</p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* DETAIL DRAWER */}
      {showDetailDrawer && selected && (
        <DetailDrawer entry={selected} isDark={isDark} isOnline={isOnline} detailLoading={detailLoading} onClose={() => { setShowDetailDrawer(false); setFullDetail(null); }} />
      )}
    </div>
  );
}

function DetailDrawer({ entry, isDark, isOnline, detailLoading, onClose }: {
  entry: RankingEntry | FullCandidate; isDark: boolean; isOnline: boolean; detailLoading: boolean; onClose: () => void;
}) {
  const hasFullDetail = 'skills' in entry && Array.isArray(entry.skills);
  const skills = hasFullDetail ? (entry as FullCandidate).skills : [];
  const careerHistory = hasFullDetail ? (entry as FullCandidate).career_history || [] : [];
  const redrobSignals = hasFullDetail ? (entry as FullCandidate).redrob_signals || {} : {};
  const scoreBreakdown = hasFullDetail ? (entry as FullCandidate).score_breakdown || {} : {};

  const fitComponents = [
    { name: 'Title', value: scoreBreakdown.title_fit || 0, weight: 0.14 },
    { name: 'Must-have Skills', value: scoreBreakdown.must_have_skill_fit || 0, weight: 0.24 },
    { name: 'Eval Framework', value: scoreBreakdown.eval_framework_fit || 0, weight: 0.08 },
    { name: 'Semantic Fit', value: scoreBreakdown.semantic_career_fit || 0, weight: 0.22 },
    { name: 'Experience', value: scoreBreakdown.experience_years_fit || 0, weight: 0.08 },
    { name: 'Trajectory', value: scoreBreakdown.career_trajectory_fit || 0, weight: 0.08 },
    { name: 'Location', value: scoreBreakdown.location_fit || 0, weight: 0.06 },
  ];

  const radarData = fitComponents.map(s => ({ name: s.name, value: (s.value || 0) * 100 }));

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative ml-auto w-full max-w-2xl h-full overflow-y-auto shadow-2xl transition-colors ${isDark ? 'bg-[#0F172A] border-l border-[#1E293B]' : 'bg-white border-l border-slate-200'}`}>
        <div className={`sticky top-0 z-10 p-5 border-b flex items-center justify-between ${isDark ? 'bg-[#0F172A]/90 border-[#1E293B]' : 'bg-white/90 border-slate-200'}`}>
          <div>
            <div className={`text-xs font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{entry.candidate_id}</div>
            <h2 className={`text-lg font-display font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{entry.name || 'Redacted'}</h2>
          </div>
          <div className="flex items-center gap-3">
            {detailLoading && <RefreshCw size={14} className="animate-spin text-amber-400" />}
            <div className={`text-2xl font-bold font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{entry.score.toFixed(3)}</div>
            <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* BASIC INFO */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Role', value: `${entry.current_title} @ ${entry.current_company}`, icon: Briefcase },
              { label: 'Experience', value: `${entry.years_of_experience?.toFixed(1)} years`, icon: Clock },
              { label: 'Location', value: entry.country ? `${entry.location || ''}, ${entry.country}` : 'Unknown', icon: MapPin },
              { label: 'Top Skills', value: entry.top_skills?.slice(0, 3).join(', ') || 'N/A', icon: Layers },
            ].map((info, i) => (
              <div key={i} className={`p-3 rounded-xl border ${isDark ? 'bg-[#1E293B]/40 border-[#334155]' : 'bg-slate-50 border-slate-200'}`}>
                {<info.icon size={12} className="text-amber-500 mb-1" />}
                <div className={`text-[9px] font-mono uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{info.label}</div>
                <div className={`text-xs font-medium mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>{info.value}</div>
              </div>
            ))}
          </div>

          {/* OFFLINE NOTICE */}
          {!isOnline && !hasFullDetail && (
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 text-xs font-mono">
                <WifiOff size={12} className="text-amber-400" />
                <span className={isDark ? 'text-amber-300' : 'text-amber-700'}>Limited detail — start the backend for full profile data</span>
              </div>
            </div>
          )}

          {detailLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className={`ml-3 text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading full profile...</span>
            </div>
          )}

          {hasFullDetail && !detailLoading && (
            <>
              {/* RADAR CHART */}
              {radarData.some(d => d.value > 0) && (
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1E293B]/40 border-[#334155]' : 'bg-slate-50 border-slate-200'}`}>
                  <h3 className={`text-xs font-display font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Score Components</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke={isDark ? '#334155' : '#CBD5E1'} />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: isDark ? '#94A3B8' : '#64748B' }} />
                      <PolarRadiusAxis tick={false} axisLine={false} />
                      <Radar dataKey="value" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* BEHAVIORAL SIGNALS */}
              {Object.keys(redrobSignals).length > 0 && (
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1E293B]/40 border-[#334155]' : 'bg-slate-50 border-slate-200'}`}>
                  <h3 className={`text-xs font-display font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Redrob Signals</h3>
                  <div className="space-y-1.5 text-[10px]">
                    {[
                      { label: 'Last Active', value: redrobSignals.last_active_date || 'N/A' },
                      { label: 'Open to Work', value: redrobSignals.open_to_work_flag ? 'Yes' : 'No', good: !!redrobSignals.open_to_work_flag },
                      { label: 'Notice Period', value: `${redrobSignals.notice_period_days || '?'}d`, good: (redrobSignals.notice_period_days || 999) <= 30 },
                      { label: 'Email Verified', value: redrobSignals.verified_email ? 'Yes' : 'No', good: !!redrobSignals.verified_email },
                      { label: 'Phone Verified', value: redrobSignals.verified_phone ? 'Yes' : 'No', good: !!redrobSignals.verified_phone },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{s.label}</span>
                        <div className="flex items-center gap-1.5">
                          {s.good !== undefined && <div className={`w-1.5 h-1.5 rounded-full ${s.good ? 'bg-emerald-500' : 'bg-red-500'}`} />}
                          <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{s.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SKILLS */}
              {skills.length > 0 && (
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1E293B]/40 border-[#334155]' : 'bg-slate-50 border-slate-200'}`}>
                  <h3 className={`text-xs font-display font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Skills ({skills.length})</h3>
                  <div className="space-y-1.5">
                    {skills.map((s: any) => {
                      const col = PROFICIENCY_COLORS[s.proficiency] || '#64748B';
                      return (
                        <div key={s.name} className="flex items-center gap-3">
                          <span className={`text-xs font-medium w-28 truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{s.name}</span>
                          <div className="flex-1">
                            <div className={`h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((s.duration_months / 60) * 100, 100)}%`, background: col }} />
                            </div>
                          </div>
                          <span className={`text-[9px] font-mono w-10 text-right ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.duration_months}m</span>
                          <span className={`text-[9px] font-mono w-6 text-right ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.endorsements}e</span>
                          <span className={`text-[9px] font-mono w-16 text-right capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`} style={{ color: col }}>{s.proficiency}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CAREER HISTORY */}
              {careerHistory.length > 0 && (
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1E293B]/40 border-[#334155]' : 'bg-slate-50 border-slate-200'}`}>
                  <h3 className={`text-xs font-display font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Career ({careerHistory.length} roles)</h3>
                  <div className="space-y-3">
                    {careerHistory.map((role: any, i: number) => (
                      <div key={i} className="relative pl-4 border-l-2" style={{ borderColor: i === 0 ? '#F59E0B' : isDark ? '#334155' : '#CBD5E1' }}>
                        <div className={`absolute left-[-5px] top-1 w-2 h-2 rounded-full ${i === 0 ? 'bg-amber-500' : isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{role.title}</span>
                          <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>@ {role.company}</span>
                          {role.is_current && <span className="px-1 py-0 text-[8px] font-mono font-bold bg-emerald-500/20 text-emerald-400 rounded">CURRENT</span>}
                        </div>
                        <div className={`text-[9px] font-mono mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{role.duration_months}m</div>
                        <p className={`text-[10px] leading-relaxed line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{role.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* REASONING */}
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
            <h3 className={`text-xs font-display font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Ranking Justification</h3>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{entry.reasoning}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
