import React, { useMemo, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { useTheoryStore, type HistoryItem } from '../store/useTheoryStore';
import { Award, CheckCircle2, Percent, BarChart3, Flame, Target, Clock, Timer } from 'lucide-react';
import { INTERVAL_MAP } from '../lib/music-theory/intervals';
import { ALL_NOTES, convertNoteToNomenclature } from '../lib/music-theory/notes';

interface AnalyticsDashboardProps {
  history: HistoryItem[];
}

const formatTotalTime = (ms: number) => {
  if (ms < 1000) return '0s';
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ history }) => {
  const { noteNomenclature } = useTheoryStore();
  const [directionFilter, setDirectionFilter] = useState<'all' | 'low-to-high' | 'high-to-low'>('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState<'1D' | '1M' | '1Y' | 'ALL TIME'>('1Y');
  const [itemChartMetric, setItemChartMetric] = useState<'successRate' | 'avgResponseTimeSec'>('successRate');

  const filteredHistory = useMemo(() => {
    let result = history;

    // Apply direction filter
    if (directionFilter !== 'all') {
      result = result.filter(item => item.intervalDirection === directionFilter);
    }

    // Apply time range filter
    if (timeRangeFilter !== 'ALL TIME') {
      // eslint-disable-next-line react-hooks/purity
      const now = Date.now();
      let cutOff = 0;
      if (timeRangeFilter === '1D') cutOff = now - 24 * 60 * 60 * 1000;
      else if (timeRangeFilter === '1M') cutOff = now - 30 * 24 * 60 * 60 * 1000;
      else if (timeRangeFilter === '1Y') cutOff = now - 365 * 24 * 60 * 60 * 1000;
      
      result = result.filter(item => item.timestamp >= cutOff);
    }

    return result;
  }, [history, directionFilter, timeRangeFilter]);

  // 1. Calculations
  const metrics = useMemo(() => {
    if (filteredHistory.length === 0) {
      return {
        total: 0,
        successRate: 0,
        correctCount: 0,
        wrongCount: 0,
        bestStreak: 0,
        topWeakness: { name: 'N/A', rate: 0 },
        byItemData: [],
        overTimeData: [],
        totalResponseTimeMs: 0,
        avgResponseTimeMs: 0
      };
    }

    const total = filteredHistory.length;
    const correctCount = filteredHistory.filter(item => item.correct).length;
    const wrongCount = total - correctCount;
    const successRate = Math.round((correctCount / total) * 100);

    let totalResponseTimeMs = 0;
    let responseTimeCount = 0;

    // Aggregate Success Rate and Response Time by Item (note or interval)
    const itemMap: Record<string, { correct: number; total: number; totalResponseTimeMs: number; responseTimeCount: number }> = {};
    filteredHistory.forEach((h) => {
      const correctKey = h.correctAnswer;
      if (!itemMap[correctKey]) {
        itemMap[correctKey] = { correct: 0, total: 0, totalResponseTimeMs: 0, responseTimeCount: 0 };
      }
      itemMap[correctKey].total += 1;
      if (h.correct) {
        itemMap[correctKey].correct += 1;
      }
      if (h.responseTimeMs !== undefined) {
        itemMap[correctKey].totalResponseTimeMs += h.responseTimeMs;
        itemMap[correctKey].responseTimeCount += 1;
        totalResponseTimeMs += h.responseTimeMs;
        responseTimeCount += 1;
      }
    });

    const avgResponseTimeMs = responseTimeCount > 0 ? totalResponseTimeMs / responseTimeCount : 0;

    const byItemData = Object.entries(itemMap).map(([name, stats]) => {
      const avgResponseTimeSec = stats.responseTimeCount > 0
        ? parseFloat((stats.totalResponseTimeMs / stats.responseTimeCount / 1000).toFixed(2))
        : 0;

      const displayName = ALL_NOTES.includes(name)
        ? convertNoteToNomenclature(name, noteNomenclature)
        : name;

      return {
        name: `${displayName} (${stats.total})`,
        originalName: name,
        successRate: Math.round((stats.correct / stats.total) * 100),
        avgResponseTimeSec,
        totalAttempts: stats.total
      };
    }).sort((a, b) => {
      const noteAIndex = ALL_NOTES.indexOf(a.originalName);
      const noteBIndex = ALL_NOTES.indexOf(b.originalName);
      if (noteAIndex !== -1 && noteBIndex !== -1) {
        return noteAIndex - noteBIndex;
      }

      const intervalA = INTERVAL_MAP.find(i => i.name === a.originalName);
      const intervalB = INTERVAL_MAP.find(i => i.name === b.originalName);
      
      if (intervalA && intervalB) {
        return intervalA.semitones - intervalB.semitones;
      }
      
      if (intervalA) return -1;
      if (intervalB) return 1;
      if (noteAIndex !== -1) return -1;
      if (noteBIndex !== -1) return 1;
      
      return a.originalName.localeCompare(b.originalName);
    });

    // Aggregate attempts over time (grouped by day, showing last 10 days with entries)
    const dayMap: Record<string, { correct: number; total: number; timestamp: number; dateStr: string }> = {};
    filteredHistory.forEach((h) => {
      const dateObj = new Date(h.timestamp);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      const day = dateObj.getDate();
      const key = `${year}-${month + 1}-${day}`;

      const dateStr = dateObj.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric' 
      });

      if (!dayMap[key]) {
        dayMap[key] = { correct: 0, total: 0, timestamp: h.timestamp, dateStr };
      }
      dayMap[key].total += 1;
      if (h.correct) {
        dayMap[key].correct += 1;
      }
    });

    const overTimeData = Object.values(dayMap)
      .sort((a, b) => a.timestamp - b.timestamp) // Sort chronologically (oldest first)
      .slice(-10) // Show last 10 days of practice with entries
      .map((d) => ({
        date: `${d.dateStr} (${d.total})`,
        originalDate: d.dateStr,
        successRate: Math.round((d.correct / d.total) * 100),
        attempts: d.total
      }));

    // Calculate Best Streak
    let bestStreak = 0;
    let currentStreak = 0;
    const sortedHistory = [...filteredHistory].sort((a, b) => a.timestamp - b.timestamp);
    sortedHistory.forEach(h => {
      if (h.correct) {
        currentStreak++;
        if (currentStreak > bestStreak) {
          bestStreak = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
    });

    // Calculate Top Weakness
    const eligibleWeaknesses = byItemData.filter(item => item.totalAttempts >= 3);
    const weaknessPool = eligibleWeaknesses.length > 0 ? eligibleWeaknesses : byItemData;
    let topWeakness = { name: 'N/A', rate: 0 };
    if (weaknessPool.length > 0) {
      const weakest = [...weaknessPool].sort((a, b) => a.successRate - b.successRate)[0];
      topWeakness = { name: weakest.originalName, rate: weakest.successRate };
    }

    return {
      total,
      successRate,
      correctCount,
      wrongCount,
      bestStreak,
      topWeakness,
      byItemData,
      overTimeData,
      totalResponseTimeMs,
      avgResponseTimeMs
    };
  }, [filteredHistory, noteNomenclature]);

  if (history.length === 0) {
    return (
      <div className="glass-panel p-10 rounded-3xl text-center border border-slate-800 my-6">
        <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white mb-1">No Analytics Available</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Complete some ear training tests and log your results to view your personalized dashboard insights and success ratios!
        </p>
      </div>
    );
  }

  const chartHeight = Math.max(256, metrics.byItemData.length * 30);

  return (
    <div className="space-y-8 my-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/60">
        {/* Label */}
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1 shrink-0">Filters</span>
        
        {/* Filter Controls Group */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:justify-end">
          {/* Direction Filter */}
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Direction</span>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['all', 'low-to-high', 'high-to-low'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDirectionFilter(filter)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize whitespace-nowrap ${directionFilter === filter
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  {filter.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Time Range Filter */}
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-none">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Time Range</span>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['1D', '1M', '1Y', 'ALL TIME'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRangeFilter(range)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition uppercase whitespace-nowrap ${timeRangeFilter === range
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Attempts */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/60 flex flex-col justify-between min-h-[96px] sm:min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold truncate pr-1">Total Tests</span>
            <div className="bg-cyan-500/10 p-1.5 rounded-lg border border-cyan-500/20 shrink-0">
              <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-400" />
            </div>
          </div>
          <div className="mt-2">
            <h4 className="text-xl sm:text-2xl font-black text-white leading-none">{metrics.total}</h4>
          </div>
        </div>

        {/* Success Rate */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/60 flex flex-col justify-between min-h-[96px] sm:min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold truncate pr-1">Success Rate</span>
            <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20 shrink-0">
              <Percent className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-2">
            <h4 className="text-xl sm:text-2xl font-black text-white leading-none">{metrics.successRate}%</h4>
          </div>
        </div>

        {/* Best Streak */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/60 flex flex-col justify-between min-h-[96px] sm:min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold truncate pr-1">Best Streak</span>
            <div className="bg-orange-500/10 p-1.5 rounded-lg border border-orange-500/20 shrink-0">
              <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-400" />
            </div>
          </div>
          <div className="mt-2">
            <h4 className="text-xl sm:text-2xl font-black text-white leading-none">{metrics.bestStreak}</h4>
          </div>
        </div>

        {/* Top Weakness */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/60 flex flex-col justify-between min-h-[96px] sm:min-h-[110px] overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold truncate pr-1">Top Weakness</span>
            <div className="bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/20 shrink-0">
              <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-400" />
            </div>
          </div>
          <div className="mt-2 min-w-0">
            <h4 
              className="text-base sm:text-lg font-black text-white leading-none truncate" 
              title={`${ALL_NOTES.includes(metrics.topWeakness.name) ? convertNoteToNomenclature(metrics.topWeakness.name, noteNomenclature) : metrics.topWeakness.name} (${metrics.topWeakness.rate}% success)`}
            >
              {ALL_NOTES.includes(metrics.topWeakness.name) ? convertNoteToNomenclature(metrics.topWeakness.name, noteNomenclature) : metrics.topWeakness.name}
            </h4>
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/60 flex flex-col justify-between min-h-[96px] sm:min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold truncate pr-1">Avg Speed</span>
            <div className="bg-indigo-500/10 p-1.5 rounded-lg border border-indigo-500/20 shrink-0">
              <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-400" />
            </div>
          </div>
          <div className="mt-2">
            <h4 className="text-xl sm:text-2xl font-black text-white leading-none">
              {metrics.avgResponseTimeMs > 0 ? `${(metrics.avgResponseTimeMs / 1000).toFixed(1)}s` : 'N/A'}
            </h4>
          </div>
        </div>

        {/* Total Time Played */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/60 flex flex-col justify-between min-h-[96px] sm:min-h-[110px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold truncate pr-1">Time Played</span>
            <div className="bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20 shrink-0">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-2">
            <h4 className="text-xl sm:text-2xl font-black text-white leading-none">
              {formatTotalTime(metrics.totalResponseTimeMs)}
            </h4>
          </div>
        </div>
      </div>

      {/* Recharts Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Success Rates/Speed by Item */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-cyan-400" />
              <span>{itemChartMetric === 'successRate' ? 'Item Mastery Success Rates' : 'Item Mastery Avg Response Time'}</span>
            </h3>
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 self-start sm:self-auto">
              <button
                onClick={() => setItemChartMetric('successRate')}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition ${
                  itemChartMetric === 'successRate'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Accuracy
              </button>
              <button
                onClick={() => setItemChartMetric('avgResponseTimeSec')}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition ${
                  itemChartMetric === 'avgResponseTimeSec'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Speed
              </button>
            </div>
          </div>
          
          <div style={{ height: chartHeight }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={metrics.byItemData}
                layout="vertical"
                margin={{ top: 5, right: 15, left: 30, bottom: 5 }}
              >
                <XAxis 
                  type="number" 
                  domain={itemChartMetric === 'successRate' ? [0, 100] : [0, 'auto']} 
                  stroke="#475569" 
                  fontSize={11}
                  tickFormatter={(val) => itemChartMetric === 'successRate' ? `${val}%` : `${val}s`}
                />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                  formatter={(value: any) => [
                    itemChartMetric === 'successRate' ? `${value}%` : `${value}s`,
                    itemChartMetric === 'successRate' ? 'Success Rate' : 'Avg Response Time'
                  ]}
                />
                <Bar dataKey={itemChartMetric} radius={[0, 4, 4, 0]} barSize={14}>
                  {metrics.byItemData.map((entry, index) => {
                    const color = itemChartMetric === 'successRate'
                      ? (entry.successRate >= 70 ? '#10b981' : entry.successRate >= 40 ? '#06b6d4' : '#f43f5e')
                      : (entry.avgResponseTimeSec <= 1.5 ? '#10b981' : entry.avgResponseTimeSec <= 3.0 ? '#06b6d4' : '#f43f5e');
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Success Rate Over Time */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800/60">
          <h3 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5 text-indigo-400" />
            <span>Recent Practice Performance</span>
          </h3>
          
          <div style={{ height: chartHeight }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.overTimeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="successRate" 
                  name="Success Rate %"
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  activeDot={{ r: 6 }}
                  dot={{ r: 4, strokeWidth: 2, stroke: '#0f172a' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
export default AnalyticsDashboard;
