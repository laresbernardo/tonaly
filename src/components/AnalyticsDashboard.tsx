import React, { useMemo } from 'react';
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
import type { HistoryItem } from '../store/useTheoryStore';
import { Award, CheckCircle2, XCircle, Percent, BarChart3 } from 'lucide-react';

interface AnalyticsDashboardProps {
  history: HistoryItem[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ history }) => {
  // 1. Calculations
  const metrics = useMemo(() => {
    if (history.length === 0) {
      return {
        total: 0,
        successRate: 0,
        correctCount: 0,
        wrongCount: 0,
        byItemData: [],
        overTimeData: []
      };
    }

    const total = history.length;
    const correctCount = history.filter(item => item.correct).length;
    const wrongCount = total - correctCount;
    const successRate = Math.round((correctCount / total) * 100);

    // Aggregate Success Rate by Item (note or interval)
    const itemMap: Record<string, { correct: number; total: number }> = {};
    history.forEach((h) => {
      const correctKey = h.correctAnswer;
      if (!itemMap[correctKey]) {
        itemMap[correctKey] = { correct: 0, total: 0 };
      }
      itemMap[correctKey].total += 1;
      if (h.correct) {
        itemMap[correctKey].correct += 1;
      }
    });

    const byItemData = Object.entries(itemMap).map(([name, stats]) => ({
      name,
      successRate: Math.round((stats.correct / stats.total) * 100),
      totalAttempts: stats.total
    })).sort((a, b) => b.successRate - a.successRate);

    // Aggregate attempts over time (grouped by day, showing last 7 days with entries)
    const dayMap: Record<string, { correct: number; total: number }> = {};
    history.slice(0, 30).forEach((h) => {
      const dateStr = new Date(h.timestamp).toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric' 
      });
      if (!dayMap[dateStr]) {
        dayMap[dateStr] = { correct: 0, total: 0 };
      }
      dayMap[dateStr].total += 1;
      if (h.correct) {
        dayMap[dateStr].correct += 1;
      }
    });

    const overTimeData = Object.entries(dayMap).map(([date, stats]) => ({
      date,
      successRate: Math.round((stats.correct / stats.total) * 100),
      attempts: stats.total
    })).reverse(); // Show chronological order

    return {
      total,
      successRate,
      correctCount,
      wrongCount,
      byItemData,
      overTimeData
    };
  }, [history]);

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

  return (
    <div className="space-y-8 my-6">
      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Attempts */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/60 flex items-center space-x-4">
          <div className="bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/20">
            <Award className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Tests</span>
            <h4 className="text-2xl font-black text-white m-0 leading-tight">{metrics.total}</h4>
          </div>
        </div>

        {/* Success Rate */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/60 flex items-center space-x-4">
          <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
            <Percent className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Success Rate</span>
            <h4 className="text-2xl font-black text-white m-0 leading-tight">{metrics.successRate}%</h4>
          </div>
        </div>

        {/* Correct Guesses */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/60 flex items-center space-x-4">
          <div className="bg-teal-500/10 p-3 rounded-xl border border-teal-500/20">
            <CheckCircle2 className="h-5 w-5 text-teal-400" />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Correct</span>
            <h4 className="text-2xl font-black text-white m-0 leading-tight">{metrics.correctCount}</h4>
          </div>
        </div>

        {/* Wrong Guesses */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/60 flex items-center space-x-4">
          <div className="bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
            <XCircle className="h-5 w-5 text-rose-400" />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Incorrect</span>
            <h4 className="text-2xl font-black text-white m-0 leading-tight">{metrics.wrongCount}</h4>
          </div>
        </div>
      </div>

      {/* Recharts Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Success Rates by Item */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800/60">
          <h3 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            <span>Item Mastery Success Rates (%)</span>
          </h3>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={metrics.byItemData.slice(0, 8)}
                layout="vertical"
                margin={{ top: 5, right: 15, left: 30, bottom: 5 }}
              >
                <XAxis type="number" domain={[0, 100]} stroke="#475569" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={70} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                />
                <Bar dataKey="successRate" radius={[0, 4, 4, 0]} barSize={14}>
                  {metrics.byItemData.map((entry, index) => {
                    const color = entry.successRate >= 70 ? '#10b981' : entry.successRate >= 40 ? '#06b6d4' : '#f43f5e';
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
          
          <div className="h-64 w-full">
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
