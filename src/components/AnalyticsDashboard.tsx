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
  CartesianGrid,
} from 'recharts';
import {
  useTheoryStore,
  type HistoryItem,
  type GameMode,
  type DifficultyLevel,
  type SessionMode,
} from '../store/useTheoryStore';
import {
  Award,
  CheckCircle2,
  Percent,
  BarChart3,
  Flame,
  Target,
  Clock,
  Timer,
  Sparkles,
  Zap,
  Heart,
  Volume2,
  GitCompareArrows,
  TrendingUp,
  ArrowUpDown,
} from 'lucide-react';
import { INTERVAL_MAP } from '../lib/music-theory/intervals';
import { CHORD_MAP } from '../lib/music-theory/chords';
import { ALL_NOTES, convertNoteToNomenclature } from '../lib/music-theory/notes';

export type InsightsScope = 'all' | GameMode;

interface AnalyticsDashboardProps {
  allHistory: HistoryItem[];
  mode: InsightsScope;
  onSelectMode?: (mode: InsightsScope) => void;
  onTrainWeaknesses?: (mode: GameMode) => void;
  onDrillPair?: (mode: GameMode, items: string[]) => void;
}

const formatTotalTime = (ms: number) => {
  if (ms < 1000) return '0s';
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

const inferModeForItem = (itemName: string): GameMode => {
  if (ALL_NOTES.includes(itemName)) return 'Note Identification';
  if (CHORD_MAP.some((c) => c.name === itemName)) return 'Chord Identification';
  return 'Interval Identification';
};

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  allHistory,
  mode,
  onSelectMode,
  onTrainWeaknesses,
  onDrillPair,
}) => {
  const {
    noteNomenclature,
    blitzBestScore,
    survivalBestScore,
    playPreviewItem,
  } = useTheoryStore();

  const [directionFilter, setDirectionFilter] = useState<'all' | 'low-to-high' | 'high-to-low' | 'harmonic'>('all');
  const [voicingFilter, setVoicingFilter] = useState<'all' | 'harmonic' | 'arpeggio'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | DifficultyLevel>('all');
  const [sessionFilter, setSessionFilter] = useState<'all' | SessionMode>('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState<'1D' | '7D' | '1M' | '1Y' | 'ALL TIME'>('ALL TIME');
  const [itemChartMetric, setItemChartMetric] = useState<'successRate' | 'avgResponseTimeSec' | 'totalAttempts'>('successRate');
  const [trendChartMetric, setTrendChartMetric] = useState<'successRate' | 'avgSpeedSec'>('successRate');
  const [tableSort, setTableSort] = useState<'musical' | 'accuracyAsc' | 'accuracyDesc' | 'speedAsc' | 'attemptsDesc'>('musical');

  const formatItemLabel = (name: string) =>
    ALL_NOTES.includes(name) ? convertNoteToNomenclature(name, noteNomenclature) : name;

  // Apply time, difficulty, session, mode, and motion/voicing filters
  const filteredHistory = useMemo(() => {
    let result = allHistory;

    if (mode !== 'all') {
      result = result.filter((item) => item.gameMode === mode);
    }

    if (mode === 'Interval Identification' && directionFilter !== 'all') {
      result = result.filter((item) => item.intervalDirection === directionFilter);
    }

    if (mode === 'Chord Identification' && voicingFilter !== 'all') {
      result = result.filter((item) => item.chordVoicing === voicingFilter);
    }

    if (difficultyFilter !== 'all') {
      result = result.filter((item) => item.difficulty === difficultyFilter);
    }

    if (sessionFilter !== 'all') {
      result = result.filter((item) => (item.sessionMode || 'zen') === sessionFilter);
    }

    if (timeRangeFilter !== 'ALL TIME') {
      // eslint-disable-next-line react-hooks/purity
      const now = Date.now();
      let cutOff = 0;
      if (timeRangeFilter === '1D') cutOff = now - 24 * 60 * 60 * 1000;
      else if (timeRangeFilter === '7D') cutOff = now - 7 * 24 * 60 * 60 * 1000;
      else if (timeRangeFilter === '1M') cutOff = now - 30 * 24 * 60 * 60 * 1000;
      else if (timeRangeFilter === '1Y') cutOff = now - 365 * 24 * 60 * 60 * 1000;

      result = result.filter((item) => item.timestamp >= cutOff);
    }

    return result;
  }, [allHistory, mode, directionFilter, voicingFilter, difficultyFilter, sessionFilter, timeRangeFilter]);

  // Per-mode high-level breakdown (for cross-mode comparison cards)
  const modeComparison = useMemo(() => {
    const modes: { id: GameMode; label: string; subtitle: string }[] = [
      { id: 'Interval Identification', label: 'Intervals', subtitle: 'Melodic & Harmonic Distance' },
      { id: 'Chord Identification', label: 'Chords', subtitle: 'Triads, Sus & 7th Voicings' },
      { id: 'Note Identification', label: 'Notes', subtitle: 'Pitch & Register Recognition' },
    ];

    return modes.map((m) => {
      const items = allHistory.filter((h) => h.gameMode === m.id);
      const total = items.length;
      const correct = items.filter((h) => h.correct).length;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      const timed = items.filter((h) => h.responseTimeMs !== undefined);
      const avgSec =
        timed.length > 0
          ? (timed.reduce((acc, x) => acc + (x.responseTimeMs || 0), 0) / timed.length / 1000).toFixed(1)
          : null;

      let bestStreak = 0;
      let cur = 0;
      [...items]
        .sort((a, b) => a.timestamp - b.timestamp)
        .forEach((h) => {
          if (h.correct) {
            cur += 1;
            if (cur > bestStreak) bestStreak = cur;
          } else {
            cur = 0;
          }
        });

      return { ...m, total, correct, accuracy, avgSec, bestStreak };
    });
  }, [allHistory]);

  // Core analytics calculations
  const metrics = useMemo(() => {
    if (filteredHistory.length === 0) {
      return {
        total: 0,
        successRate: 0,
        correctCount: 0,
        wrongCount: 0,
        bestStreak: 0,
        topWeakness: { name: 'N/A', rate: 0, mode: 'Interval Identification' as GameMode },
        topStrength: { name: 'N/A', rate: 0 },
        byItemData: [],
        overTimeData: [],
        totalResponseTimeMs: 0,
        avgResponseTimeMs: 0,
        medianResponseTimeMs: 0,
        fastestCorrectMs: 0,
        speedTiers: { instant: 0, fast: 0, solid: 0, steady: 0, totalTimedCorrect: 0 },
        difficultyBreakdown: [] as { level: string; total: number; accuracy: number; avgSec: string }[],
        confusedPairs: [] as { target: string; guess: string; count: number; gameMode: GameMode }[],
      };
    }

    const total = filteredHistory.length;
    const correctCount = filteredHistory.filter((item) => item.correct).length;
    const wrongCount = total - correctCount;
    const successRate = Math.round((correctCount / total) * 100);

    let totalResponseTimeMs = 0;
    const allResponseTimes: number[] = [];
    const correctResponseTimes: number[] = [];
    const speedTiers = { instant: 0, fast: 0, solid: 0, steady: 0, totalTimedCorrect: 0 };

    const itemMap: Record<
      string,
      {
        correct: number;
        total: number;
        totalResponseTimeMs: number;
        responseTimeCount: number;
        fastestMs: number | null;
        gameMode: GameMode;
      }
    > = {};

    const diffMap: Record<string, { correct: number; total: number; timeMs: number; timeCount: number }> = {};
    const confusionMap: Record<string, { target: string; guess: string; count: number; gameMode: GameMode }> = {};

    filteredHistory.forEach((h) => {
      const correctKey = h.correctAnswer;
      if (!itemMap[correctKey]) {
        itemMap[correctKey] = {
          correct: 0,
          total: 0,
          totalResponseTimeMs: 0,
          responseTimeCount: 0,
          fastestMs: null,
          gameMode: h.gameMode,
        };
      }
      itemMap[correctKey].total += 1;
      if (h.correct) {
        itemMap[correctKey].correct += 1;
      } else if (h.userGuess && h.userGuess !== h.correctAnswer) {
        const pairKey = `${h.gameMode}::${h.correctAnswer}::${h.userGuess}`;
        if (!confusionMap[pairKey]) {
          confusionMap[pairKey] = {
            target: h.correctAnswer,
            guess: h.userGuess,
            count: 0,
            gameMode: h.gameMode,
          };
        }
        confusionMap[pairKey].count += 1;
      }

      const dKey = h.difficulty || 'Medium';
      if (!diffMap[dKey]) {
        diffMap[dKey] = { correct: 0, total: 0, timeMs: 0, timeCount: 0 };
      }
      diffMap[dKey].total += 1;
      if (h.correct) diffMap[dKey].correct += 1;

      if (h.responseTimeMs !== undefined && h.responseTimeMs > 0) {
        itemMap[correctKey].totalResponseTimeMs += h.responseTimeMs;
        itemMap[correctKey].responseTimeCount += 1;
        totalResponseTimeMs += h.responseTimeMs;
        allResponseTimes.push(h.responseTimeMs);

        diffMap[dKey].timeMs += h.responseTimeMs;
        diffMap[dKey].timeCount += 1;

        if (h.correct) {
          correctResponseTimes.push(h.responseTimeMs);
          if (itemMap[correctKey].fastestMs === null || h.responseTimeMs < itemMap[correctKey].fastestMs!) {
            itemMap[correctKey].fastestMs = h.responseTimeMs;
          }
          speedTiers.totalTimedCorrect += 1;
          if (h.responseTimeMs <= 1350) speedTiers.instant += 1;
          else if (h.responseTimeMs <= 2600) speedTiers.fast += 1;
          else if (h.responseTimeMs <= 4500) speedTiers.solid += 1;
          else speedTiers.steady += 1;
        }
      }
    });

    const avgResponseTimeMs = allResponseTimes.length > 0 ? totalResponseTimeMs / allResponseTimes.length : 0;
    const sortedTimes = [...allResponseTimes].sort((a, b) => a - b);
    const medianResponseTimeMs =
      sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length / 2)] : 0;
    const fastestCorrectMs =
      correctResponseTimes.length > 0 ? Math.min(...correctResponseTimes) : 0;

    const byItemData = Object.entries(itemMap)
      .map(([name, stats]) => {
        const avgResponseTimeSec =
          stats.responseTimeCount > 0
            ? parseFloat((stats.totalResponseTimeMs / stats.responseTimeCount / 1000).toFixed(2))
            : 0;

        const displayName = ALL_NOTES.includes(name)
          ? convertNoteToNomenclature(name, noteNomenclature)
          : name;

        return {
          name: `${displayName} (${stats.total})`,
          displayName,
          originalName: name,
          gameMode: stats.gameMode,
          correctCount: stats.correct,
          wrongCount: stats.total - stats.correct,
          successRate: Math.round((stats.correct / stats.total) * 100),
          avgResponseTimeSec,
          fastestSec: stats.fastestMs !== null ? parseFloat((stats.fastestMs / 1000).toFixed(2)) : null,
          totalAttempts: stats.total,
        };
      })
      .sort((a, b) => {
        const noteAIndex = ALL_NOTES.indexOf(a.originalName);
        const noteBIndex = ALL_NOTES.indexOf(b.originalName);
        if (noteAIndex !== -1 && noteBIndex !== -1) return noteAIndex - noteBIndex;

        const intervalA = INTERVAL_MAP.find((i) => i.name === a.originalName);
        const intervalB = INTERVAL_MAP.find((i) => i.name === b.originalName);
        if (intervalA && intervalB) return intervalA.semitones - intervalB.semitones;

        const chordA = CHORD_MAP.findIndex((c) => c.name === a.originalName);
        const chordB = CHORD_MAP.findIndex((c) => c.name === b.originalName);
        if (chordA !== -1 && chordB !== -1) return chordA - chordB;

        return a.originalName.localeCompare(b.originalName);
      });

    const dayMap: Record<
      string,
      { correct: number; total: number; timeMs: number; timeCount: number; timestamp: number; dateStr: string }
    > = {};
    filteredHistory.forEach((h) => {
      const dateObj = new Date(h.timestamp);
      const key = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()}`;
      const dateStr = dateObj.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });

      if (!dayMap[key]) {
        dayMap[key] = { correct: 0, total: 0, timeMs: 0, timeCount: 0, timestamp: h.timestamp, dateStr };
      }
      dayMap[key].total += 1;
      if (h.correct) dayMap[key].correct += 1;
      if (h.responseTimeMs !== undefined && h.responseTimeMs > 0) {
        dayMap[key].timeMs += h.responseTimeMs;
        dayMap[key].timeCount += 1;
      }
    });

    const overTimeData = Object.values(dayMap)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-14)
      .map((d) => ({
        date: `${d.dateStr} (${d.total})`,
        originalDate: d.dateStr,
        successRate: Math.round((d.correct / d.total) * 100),
        avgSpeedSec: d.timeCount > 0 ? parseFloat((d.timeMs / d.timeCount / 1000).toFixed(2)) : 0,
        attempts: d.total,
      }));

    let bestStreak = 0;
    let currentStreak = 0;
    const sortedHistory = [...filteredHistory].sort((a, b) => a.timestamp - b.timestamp);
    sortedHistory.forEach((h) => {
      if (h.correct) {
        currentStreak++;
        if (currentStreak > bestStreak) bestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    });

    const eligibleItems = byItemData.filter((item) => item.totalAttempts >= 2);
    const pool = eligibleItems.length > 0 ? eligibleItems : byItemData;
    let topWeakness = { name: 'N/A', rate: 0, mode: 'Interval Identification' as GameMode };
    let topStrength = { name: 'N/A', rate: 0 };
    if (pool.length > 0) {
      const weakest = [...pool].sort(
        (a, b) => a.successRate - b.successRate || b.avgResponseTimeSec - a.avgResponseTimeSec
      )[0];
      topWeakness = {
        name: weakest.originalName,
        rate: weakest.successRate,
        mode: weakest.gameMode || inferModeForItem(weakest.originalName),
      };

      const strongest = [...pool].sort(
        (a, b) => b.successRate - a.successRate || a.avgResponseTimeSec - b.avgResponseTimeSec
      )[0];
      topStrength = { name: strongest.originalName, rate: strongest.successRate };
    }

    const levelOrder = ['Easy', 'Medium', 'Hard', 'Custom'];
    const difficultyBreakdown = Object.entries(diffMap)
      .map(([level, st]) => ({
        level,
        total: st.total,
        accuracy: Math.round((st.correct / st.total) * 100),
        avgSec: st.timeCount > 0 ? `${(st.timeMs / st.timeCount / 1000).toFixed(1)}s` : '—',
      }))
      .sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level));

    const confusedPairs = Object.values(confusionMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      total,
      successRate,
      correctCount,
      wrongCount,
      bestStreak,
      topWeakness,
      topStrength,
      byItemData,
      overTimeData,
      totalResponseTimeMs,
      avgResponseTimeMs,
      medianResponseTimeMs,
      fastestCorrectMs,
      speedTiers,
      difficultyBreakdown,
      confusedPairs,
    };
  }, [filteredHistory, noteNomenclature]);

  const sortedTableRows = useMemo(() => {
    const rows = [...metrics.byItemData];
    if (tableSort === 'accuracyAsc') return rows.sort((a, b) => a.successRate - b.successRate);
    if (tableSort === 'accuracyDesc') return rows.sort((a, b) => b.successRate - a.successRate);
    if (tableSort === 'speedAsc') {
      return rows.sort((a, b) => (a.avgResponseTimeSec || 999) - (b.avgResponseTimeSec || 999));
    }
    if (tableSort === 'attemptsDesc') return rows.sort((a, b) => b.totalAttempts - a.totalAttempts);
    return rows;
  }, [metrics.byItemData, tableSort]);

  if (allHistory.length === 0) {
    return (
      <div className="space-y-4 my-4">
        {/* Arcade High Scores even when history is empty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="studio-inset p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  60s Blitz Record
                </span>
                <span className="text-lg font-black text-white">{blitzBestScore} pts</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-500">Speed Sprint</span>
          </div>

          <div className="studio-inset p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300">
                <Heart className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Survival Record
                </span>
                <span className="text-lg font-black text-white">{survivalBestScore} streak</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-500">Sudden Death</span>
          </div>
        </div>

        <div className="studio-inset p-10 rounded-3xl text-center">
          <BarChart3 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No Practice Sessions Logged Yet</h3>
          <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
            Complete a few rounds in the Arena to unlock accuracy charts, reaction-speed tiers, daily trends, mistake-pair analysis, and adaptive weakness training.
          </p>
        </div>
      </div>
    );
  }

  const chartHeight = Math.max(260, metrics.byItemData.length * 32);

  return (
    <div className="space-y-6 my-4">
      {/* Cross-Mode Mastery Overview + Arcade Records */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {modeComparison.map((mc) => {
          const active = mode === mc.id;
          return (
            <button
              key={mc.id}
              type="button"
              onClick={() => onSelectMode && onSelectMode(active ? 'all' : mc.id)}
              className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
                active
                  ? 'bg-cyan-950/35 border-cyan-500/50 shadow-lg shadow-cyan-950/30'
                  : 'studio-inset hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black text-white uppercase tracking-wider">{mc.label}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    mc.total === 0
                      ? 'bg-slate-800 text-slate-400'
                      : mc.accuracy >= 75
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : mc.accuracy >= 50
                          ? 'bg-cyan-500/15 text-cyan-300'
                          : 'bg-rose-500/15 text-rose-300'
                  }`}
                >
                  {mc.total === 0 ? 'Untested' : `${mc.accuracy}% acc`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">{mc.subtitle}</p>
              <div className="flex items-center justify-between text-[11px] text-slate-300 border-t border-slate-800/70 pt-2">
                <span>
                  <strong className="text-white">{mc.total}</strong> tests
                </span>
                <span>Avg {mc.avgSec ? `${mc.avgSec}s` : '—'}</span>
                <span>🔥 {mc.bestStreak}</span>
              </div>
            </button>
          );
        })}

        {/* Arcade High Scores Summary Card */}
        <div className="studio-inset p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black text-white uppercase tracking-wider">Arcade Records</span>
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full">
              Personal Bests
            </span>
          </div>
          <div className="space-y-2 mt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                <Zap className="h-3.5 w-3.5 text-amber-400" /> 60s Blitz
              </span>
              <strong className="text-white font-mono">{blitzBestScore} pts</strong>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-slate-800/70 pt-1.5">
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                <Heart className="h-3.5 w-3.5 text-rose-400" /> Survival Run
              </span>
              <strong className="text-white font-mono">{survivalBestScore} in a row</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 studio-inset p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-3.5">
          {/* Time Range */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">
              Time Window
            </span>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80">
              {(['1D', '7D', '1M', '1Y', 'ALL TIME'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRangeFilter(range)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition uppercase whitespace-nowrap cursor-pointer ${
                    timeRangeFilter === range
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">
              Difficulty
            </span>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80">
              {(['all', 'Easy', 'Medium', 'Hard', 'Custom'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDifficultyFilter(lvl)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition capitalize whitespace-nowrap cursor-pointer ${
                    difficultyFilter === lvl
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl === 'all' ? 'All' : lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Session Mode Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">
              Session Style
            </span>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'zen', label: 'Zen' },
                  { id: 'blitz', label: '60s Blitz' },
                  { id: 'survival', label: 'Survival' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSessionFilter(s.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                    sessionFilter === s.id
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interval Motion Filter */}
          {mode === 'Interval Identification' && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">
                Interval Motion
              </span>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80">
                {(['all', 'low-to-high', 'high-to-low', 'harmonic'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setDirectionFilter(filter)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition capitalize whitespace-nowrap cursor-pointer ${
                      directionFilter === filter
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter === 'low-to-high'
                      ? 'Ascending'
                      : filter === 'high-to-low'
                        ? 'Descending'
                        : filter}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chord Voicing Filter */}
          {mode === 'Chord Identification' && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">
                Chord Voicing
              </span>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'harmonic', label: 'Strummed' },
                    { id: 'arpeggio', label: 'Arpeggio' },
                  ] as const
                ).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoicingFilter(v.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                      voicingFilter === v.id
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {onTrainWeaknesses && metrics.topWeakness.name !== 'N/A' && (
          <button
            type="button"
            onClick={() => onTrainWeaknesses(mode === 'all' ? metrics.topWeakness.mode : mode)}
            className="inline-flex items-center justify-center gap-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition shrink-0 cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Train Weaknesses in Arena</span>
          </button>
        )}
      </div>

      {filteredHistory.length === 0 ? (
        <div className="studio-inset p-10 rounded-3xl text-center">
          <BarChart3 className="h-9 w-9 text-slate-600 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-white mb-1">No Matching Sessions for Current Filters</h4>
          <p className="text-xs text-slate-400">
            Try switching Time Window to <strong className="text-slate-200">ALL TIME</strong> or resetting Difficulty / Session filters above.
          </p>
        </div>
      ) : (
        <>
          {/* 8 KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="studio-inset p-4 rounded-2xl flex flex-col justify-between min-h-[96px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Total Tests
                </span>
                <Award className="h-4 w-4 text-cyan-400 shrink-0" />
              </div>
              <div className="mt-2">
                <h4 className="text-xl sm:text-2xl font-black text-white leading-none">{metrics.total}</h4>
                <span className="text-[10px] text-slate-400 font-medium">
                  <span className="text-emerald-400 font-semibold">{metrics.correctCount} pass</span> ·{' '}
                  <span className="text-rose-400 font-semibold">{metrics.wrongCount} miss</span>
                </span>
              </div>
            </div>

            <div className="studio-inset p-4 rounded-2xl flex flex-col justify-between min-h-[96px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Accuracy
                </span>
                <Percent className="h-4 w-4 text-emerald-400 shrink-0" />
              </div>
              <div className="mt-2">
                <h4 className="text-xl sm:text-2xl font-black text-white leading-none">
                  {metrics.successRate}%
                </h4>
                <span className="text-[10px] text-slate-400">
                  {metrics.successRate >= 85
                    ? 'Studio Mastery'
                    : metrics.successRate >= 65
                      ? 'Developing Solidly'
                      : 'Building Anchors'}
                </span>
              </div>
            </div>

            <div className="studio-inset p-4 rounded-2xl flex flex-col justify-between min-h-[96px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Avg & Median Speed
                </span>
                <Timer className="h-4 w-4 text-sky-400 shrink-0" />
              </div>
              <div className="mt-2">
                <h4 className="text-xl sm:text-2xl font-black text-white leading-none">
                  {metrics.avgResponseTimeMs > 0 ? `${(metrics.avgResponseTimeMs / 1000).toFixed(1)}s` : 'N/A'}
                </h4>
                <span className="text-[10px] text-slate-400">
                  Median{' '}
                  {metrics.medianResponseTimeMs > 0
                    ? `${(metrics.medianResponseTimeMs / 1000).toFixed(1)}s`
                    : '—'}{' '}
                  · Best{' '}
                  {metrics.fastestCorrectMs > 0 ? `${(metrics.fastestCorrectMs / 1000).toFixed(2)}s` : '—'}
                </span>
              </div>
            </div>

            <div className="studio-inset p-4 rounded-2xl flex flex-col justify-between min-h-[96px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Best Streak & Time
                </span>
                <Flame className="h-4 w-4 text-amber-400 shrink-0" />
              </div>
              <div className="mt-2">
                <h4 className="text-xl sm:text-2xl font-black text-white leading-none">
                  {metrics.bestStreak} <span className="text-xs font-bold text-amber-300">in a row</span>
                </h4>
                <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-500" />
                  <span>{formatTotalTime(metrics.totalResponseTimeMs)} active listening</span>
                </span>
              </div>
            </div>

            <div className="studio-inset p-4 rounded-2xl flex flex-col justify-between min-h-[90px] col-span-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Strongest Ear Anchor
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <h4 className="text-base sm:text-lg font-black text-white truncate">
                  {formatItemLabel(metrics.topStrength.name)}
                </h4>
                {metrics.topStrength.name !== 'N/A' && (
                  <span className="text-xs text-emerald-400 font-bold shrink-0">
                    {metrics.topStrength.rate}% accuracy
                  </span>
                )}
              </div>
            </div>

            <div className="studio-inset p-4 rounded-2xl flex flex-col justify-between min-h-[90px] col-span-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Primary Growth Target (Weakest Item)
                </span>
                <Target className="h-4 w-4 text-rose-400 shrink-0" />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <h4 className="text-base sm:text-lg font-black text-white truncate">
                  {formatItemLabel(metrics.topWeakness.name)}
                </h4>
                {metrics.topWeakness.name !== 'N/A' && (
                  <span className="text-xs text-rose-400 font-bold shrink-0">
                    {metrics.topWeakness.rate}% accuracy
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Reflex Speed Tiers Breakdown + Difficulty Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Speed Tiers Distribution */}
            <div className="studio-inset p-5 rounded-2xl lg:col-span-2 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Timer className="h-4 w-4 text-amber-400" />
                  <span>Recognition Reflex Speed Tiers (Correct Answers)</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Faster recognition = internalized sound vs. mental counting
                </span>
              </div>

              {metrics.speedTiers.totalTimedCorrect === 0 ? (
                <p className="text-xs text-slate-500 py-2">No timed correct answers recorded yet.</p>
              ) : (
                <>
                  {/* Stacked visual bar */}
                  <div className="h-3 w-full rounded-full bg-slate-950 overflow-hidden flex border border-slate-800/80">
                    {(
                      [
                        { key: 'instant', count: metrics.speedTiers.instant, color: 'bg-amber-400' },
                        { key: 'fast', count: metrics.speedTiers.fast, color: 'bg-emerald-400' },
                        { key: 'solid', count: metrics.speedTiers.solid, color: 'bg-cyan-400' },
                        { key: 'steady', count: metrics.speedTiers.steady, color: 'bg-slate-500' },
                      ] as const
                    ).map((tier) => {
                      const pct = (tier.count / metrics.speedTiers.totalTimedCorrect) * 100;
                      if (pct <= 0) return null;
                      return (
                        <div
                          key={tier.key}
                          style={{ width: `${pct}%` }}
                          className={`${tier.color} h-full transition-all`}
                        />
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {[
                      {
                        label: '⚡ Instant',
                        sub: '≤ 1.35s',
                        count: metrics.speedTiers.instant,
                        textClass: 'text-amber-300',
                      },
                      {
                        label: '🔥 Fast',
                        sub: '1.35s – 2.6s',
                        count: metrics.speedTiers.fast,
                        textClass: 'text-emerald-300',
                      },
                      {
                        label: '✨ Solid',
                        sub: '2.6s – 4.5s',
                        count: metrics.speedTiers.solid,
                        textClass: 'text-cyan-300',
                      },
                      {
                        label: '⏱ Steady',
                        sub: '> 4.5s',
                        count: metrics.speedTiers.steady,
                        textClass: 'text-slate-300',
                      },
                    ].map((t) => {
                      const pct = Math.round((t.count / metrics.speedTiers.totalTimedCorrect) * 100);
                      return (
                        <div key={t.label} className="bg-slate-950/70 border border-slate-800/70 rounded-xl p-2.5">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-extrabold ${t.textClass}`}>{t.label}</span>
                            <span className="text-xs font-mono font-bold text-white">{pct}%</span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                            <span>{t.sub}</span>
                            <span>{t.count}×</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Accuracy & Timing by Difficulty Level */}
            <div className="studio-inset p-5 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
                <span>By Difficulty Tier</span>
              </h3>
              <div className="space-y-2">
                {metrics.difficultyBreakdown.map((d) => (
                  <div
                    key={d.level}
                    className="bg-slate-950/70 border border-slate-800/70 rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white">{d.level}</span>
                      <span className="text-[11px] text-slate-500 ml-2">{d.total} tests</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-slate-400 text-[11px]">{d.avgSec}</span>
                      <span
                        className={`font-bold ${
                          d.accuracy >= 75
                            ? 'text-emerald-400'
                            : d.accuracy >= 50
                              ? 'text-cyan-400'
                              : 'text-rose-400'
                        }`}
                      >
                        {d.accuracy}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Recharts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Chart: Mastery Accuracy / Avg Speed / Volume by Item */}
            <div className="studio-inset p-5 sm:p-6 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4 text-cyan-400" />
                  <span>
                    {itemChartMetric === 'successRate'
                      ? 'Mastery Accuracy by Item'
                      : itemChartMetric === 'avgResponseTimeSec'
                        ? 'Avg Response Speed by Item'
                        : 'Practice Volume by Item'}
                  </span>
                </h3>
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 self-start sm:self-auto">
                  {(
                    [
                      { key: 'successRate', label: 'Accuracy' },
                      { key: 'avgResponseTimeSec', label: 'Speed' },
                      { key: 'totalAttempts', label: 'Volume' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setItemChartMetric(tab.key)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                        itemChartMetric === tab.key
                          ? 'bg-cyan-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height: chartHeight }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.byItemData}
                    layout="vertical"
                    margin={{ top: 5, right: 15, left: 25, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      domain={itemChartMetric === 'successRate' ? [0, 100] : [0, 'auto']}
                      stroke="#475569"
                      fontSize={11}
                      tickFormatter={(val) =>
                        itemChartMetric === 'successRate'
                          ? `${val}%`
                          : itemChartMetric === 'avgResponseTimeSec'
                            ? `${val}s`
                            : `${val}`
                      }
                    />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={112} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0b1120',
                        borderColor: '#1e293b',
                        borderRadius: '10px',
                      }}
                      labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                      formatter={(value: unknown) => [
                        itemChartMetric === 'successRate'
                          ? `${value}%`
                          : itemChartMetric === 'avgResponseTimeSec'
                            ? `${value}s`
                            : `${value} tests`,
                        itemChartMetric === 'successRate'
                          ? 'Success Rate'
                          : itemChartMetric === 'avgResponseTimeSec'
                            ? 'Avg Speed'
                            : 'Attempts',
                      ]}
                    />
                    <Bar dataKey={itemChartMetric} radius={[0, 5, 5, 0]} barSize={14}>
                      {metrics.byItemData.map((entry, index) => {
                        const color =
                          itemChartMetric === 'successRate'
                            ? entry.successRate >= 75
                              ? '#10b981'
                              : entry.successRate >= 45
                                ? '#06b6d4'
                                : '#f43f5e'
                            : itemChartMetric === 'avgResponseTimeSec'
                              ? entry.avgResponseTimeSec <= 1.5
                                ? '#10b981'
                                : entry.avgResponseTimeSec <= 3.0
                                  ? '#06b6d4'
                                  : '#f43f5e'
                              : '#22d3ee';
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Chart: Daily Accuracy OR Daily Speed Trend */}
            <div className="studio-inset p-5 sm:p-6 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>
                    {trendChartMetric === 'successRate' ? 'Daily Accuracy Trend' : 'Daily Reaction Speed Trend'}
                  </span>
                </h3>
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setTrendChartMetric('successRate')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                      trendChartMetric === 'successRate'
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Accuracy %
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendChartMetric('avgSpeedSec')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                      trendChartMetric === 'avgSpeedSec'
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Speed (s)
                  </button>
                </div>
              </div>

              <div style={{ height: chartHeight }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.overTimeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      domain={trendChartMetric === 'successRate' ? [0, 100] : [0, 'auto']}
                      tickFormatter={(v) => (trendChartMetric === 'successRate' ? `${v}%` : `${v}s`)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0b1120',
                        borderColor: '#1e293b',
                        borderRadius: '10px',
                      }}
                      labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                      formatter={(val: unknown) => [
                        trendChartMetric === 'successRate' ? `${val}%` : `${val}s`,
                        trendChartMetric === 'successRate' ? 'Accuracy' : 'Avg Speed',
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey={trendChartMetric}
                      name={trendChartMetric === 'successRate' ? 'Accuracy %' : 'Avg Speed (s)'}
                      stroke={trendChartMetric === 'successRate' ? '#22d3ee' : '#fbbf24'}
                      strokeWidth={3}
                      activeDot={{ r: 6 }}
                      dot={{ r: 4, strokeWidth: 2, stroke: '#090d16' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Most Confused Ear Pairs ("What You Mistake For What") */}
          {metrics.confusedPairs.length > 0 && (
            <div className="studio-inset p-5 sm:p-6 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <GitCompareArrows className="h-4 w-4 text-rose-400" />
                  <span>Most Frequent Ear Confusions (Target vs. Guessed)</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Isolate any confused pair in Custom Mode to calibrate your ear side-by-side
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {metrics.confusedPairs.map((pair) => (
                  <div
                    key={`${pair.gameMode}-${pair.target}-${pair.guess}`}
                    className="bg-slate-950/75 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                        {pair.gameMode.replace(' Identification', '')}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300">
                        {pair.count}× confused
                      </span>
                    </div>
                    <div className="text-xs font-bold flex items-center flex-wrap gap-1.5">
                      <span className="text-emerald-300">{formatItemLabel(pair.target)}</span>
                      <span className="text-slate-500">mistaken as</span>
                      <span className="text-rose-300">{formatItemLabel(pair.guess)}</span>
                    </div>
                    {onDrillPair && (
                      <button
                        type="button"
                        onClick={() => onDrillPair(pair.gameMode, [pair.target, pair.guess])}
                        className="w-full py-1.5 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-cyan-200 text-[11px] font-bold transition cursor-pointer"
                      >
                        Drill This Pair in Custom Mode →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complete Sortable Item Mastery & Timing Table */}
          <div className="studio-inset p-5 sm:p-6 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-cyan-400" />
                <span>Detailed Item Accuracy & Timing Breakdown</span>
              </h3>
              <div className="flex flex-wrap bg-slate-950 p-1 rounded-xl border border-slate-800/80 gap-1">
                {(
                  [
                    { id: 'musical', label: 'Musical Order' },
                    { id: 'accuracyAsc', label: 'Weakest First' },
                    { id: 'accuracyDesc', label: 'Strongest First' },
                    { id: 'speedAsc', label: 'Fastest First' },
                    { id: 'attemptsDesc', label: 'Most Tested' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setTableSort(s.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      tableSort === s.id
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800/70">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-4">Listen</th>
                    <th className="py-3 px-4">Attempts</th>
                    <th className="py-3 px-4">Pass / Miss</th>
                    <th className="py-3 px-4">Accuracy</th>
                    <th className="py-3 px-4">Avg Speed</th>
                    <th className="py-3 px-4">Best Speed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/90 text-xs text-slate-300">
                  {sortedTableRows.map((row) => {
                    const itemMode = row.gameMode || inferModeForItem(row.originalName);
                    return (
                      <tr key={`${itemMode}-${row.originalName}`} className="hover:bg-slate-900/40 transition">
                        <td className="py-2.5 px-4 font-bold text-white">{row.displayName}</td>
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => playPreviewItem(row.originalName, itemMode)}
                            title={`Hear ${row.displayName}`}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-500/20 border border-slate-800 hover:border-cyan-500/35 text-cyan-400 transition cursor-pointer"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                        <td className="py-2.5 px-4 font-mono">{row.totalAttempts}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px]">
                          <span className="text-emerald-400">{row.correctCount}</span> /{' '}
                          <span className="text-rose-400">{row.wrongCount}</span>
                        </td>
                        <td className="py-2.5 px-4 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className={`h-full rounded-full ${
                                  row.successRate >= 75
                                    ? 'bg-emerald-400'
                                    : row.successRate >= 45
                                      ? 'bg-cyan-400'
                                      : 'bg-rose-400'
                                }`}
                                style={{ width: `${row.successRate}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-[11px] w-9 text-right">
                              {row.successRate}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-mono">
                          {row.avgResponseTimeSec > 0 ? `${row.avgResponseTimeSec}s` : '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-amber-300">
                          {row.fastestSec !== null ? `${row.fastestSec}s` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
