import { useState, useEffect, useMemo } from 'react';
import { version } from '../package.json';
import {
  Music,
  LogIn,
  LogOut,
  Repeat,
  Volume2,
  History,
  Trophy,
  RotateCcw,
  Trash2,
  Lightbulb,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  Check,
  X,
  AlertTriangle,
  Flame,
  Zap,
  Heart,
  SlidersHorizontal,
  Sparkles,
  Keyboard,
  Radio,
  ArrowRight,
  HelpCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { signInWithGoogle, logout, auth } from './services/firebase';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  useTheoryStore,
  getNoteOptionsForDifficulty,
  BLITZ_DURATION_MS,
  type GameMode,
  type DifficultyLevel,
  type DroneRootSetting,
} from './store/useTheoryStore';
import AnalyticsDashboard, { type InsightsScope } from './components/AnalyticsDashboard';
import LandingPage from './components/LandingPage';
import Piano from './components/Piano';
import AudioVisualizer from './components/AudioVisualizer';
import { ALL_NOTES, convertNoteToNomenclature } from './lib/music-theory/notes';
import { INTERVAL_MAP, getNoteFromSemitones } from './lib/music-theory/intervals';
import { CHORD_MAP, getChordsForDifficulty } from './lib/music-theory/chords';
import { TIMBRE_LABELS, type SynthTimbre } from './lib/music-theory/piano-synth';
import MnemonicEditor from './components/MnemonicEditor';
import MnemonicsLibrary from './components/MnemonicsLibrary';
import { getMnemonicWithDefault } from './lib/music-theory/default-references';

declare global {
  interface Window {
    __TONALY_START_IN_STUDIO__?: boolean;
  }
}

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const getTabFromUrl = (): 'training' | 'analytics' | 'history' | 'mnemonics' => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path === '/arena') return 'training';
    if (path === '/insights') return 'analytics';
    if (path === '/data') return 'history';
    if (path === '/mnemonics') return 'mnemonics';
  }
  return 'training';
};

const isInStudioPath = (): boolean => {
  if (typeof window !== 'undefined') {
    if (window.__TONALY_START_IN_STUDIO__) return true;
    const path = window.location.pathname;
    return ['/arena', '/insights', '/data', '/mnemonics'].includes(path);
  }
  return false;
};

const SPEED_TIER_META = {
  instant: { label: 'Instant', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: '⚡' },
  fast: { label: 'Fast', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: '🔥' },
  solid: { label: 'Solid', badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', icon: '✨' },
  steady: { label: 'Steady', badgeClass: 'bg-slate-800/80 text-slate-300 border-slate-700/60', icon: '⏱' },
} as const;

// Educational level descriptions for each mode & tier so learners always know what they are practicing and why
const LEVEL_CURRICULUM: Record<
  GameMode,
  Record<DifficultyLevel, { title: string; summary: string; detail: string }>
> = {
  'Note Identification': {
    Easy: {
      title: '7 Natural White Keys (1 Octave)',
      summary: 'C4–B4 natural notes only (no sharps/flats) — builds core middle-register pitch memory.',
      detail: 'C4, D4, E4, F4, G4, A4, B4. Ideal for anchoring fundamental scale degrees before adding accidentals.',
    },
    Medium: {
      title: '12 Chromatic Notes (1 Octave)',
      summary: 'All 12 semitones from C4 to B4 including sharps/flats (C#, Eb, F#, G#, Bb).',
      detail: 'Trains full chromatic pitch color within a single octave so you feel white-key vs. black-key character.',
    },
    Hard: {
      title: '24 Chromatic Notes (2 Octaves)',
      summary: 'Full C4–B5 two-octave chromatic range — tests both pitch identity and octave register.',
      detail: 'Challenges your ear to distinguish pitch class and high/low octave placement simultaneously.',
    },
    Custom: {
      title: 'Custom Pitch Pool',
      summary: 'Hand-pick specific notes (e.g. F4 vs F#4) to isolate and fix exact pitch confusions.',
      detail: 'Select any 2 or more pitches below to create a focused micro-drill.',
    },
  },
  'Interval Identification': {
    Easy: {
      title: '4 Consonant Pillars',
      summary: 'Unison, Major 3rd, Perfect 5th, and Octave — the foundational building blocks of melody.',
      detail: 'Starts with open, unmistakable harmonic landmarks before introducing tighter chromatic steps.',
    },
    Medium: {
      title: 'All 13 Intervals in 1 Octave',
      summary: 'Every distance from Unison (0 st) through Tritone (6 st) up to Octave (12 st).',
      detail: 'Complete melodic & harmonic vocabulary: m2, M2, m3, M3, P4, Tritone, P5, m6, M6, m7, M7, Octave.',
    },
    Hard: {
      title: '20 Intervals up to 2 Octaves',
      summary: 'Adds compound jazz & orchestral leaps: 9ths, 10ths, 11th, 12th, and Double Octave.',
      detail: 'Trains wide-voicing recognition used in piano voicings, film scoring, and jazz improvisation.',
    },
    Custom: {
      title: 'Custom Interval Lab',
      summary: 'Choose specific intervals side-by-side (e.g. Perfect 4th vs Perfect 5th) for A/B ear calibration.',
      detail: 'Toggle any intervals below to drill only the leaps you want to master.',
    },
  },
  'Chord Identification': {
    Easy: {
      title: 'Major vs. Minor Triads',
      summary: 'Hear bright Major (4-semitone 3rd) vs. melancholic Minor (3-semitone 3rd) harmony.',
      detail: 'The single most important harmonic distinction in music—trains instant emotional color recognition.',
    },
    Medium: {
      title: '6 Triad & Suspended Qualities',
      summary: 'Major, Minor, Diminished (tense), Augmented (dreamy), Sus2 (open), and Sus4 (yearning).',
      detail: 'Covers every 3-note chord quality you encounter in pop, rock, classical, and songwriting.',
    },
    Hard: {
      title: '10 Triads + 7th Chords',
      summary: 'Adds lush 4-note voicings: Maj7, Min7, Dom7 (blues/tension), and Half-Dim 7th (noir/jazz).',
      detail: 'Full studio harmony palette for transcribing jazz, R&B, neo-soul, and film progressions.',
    },
    Custom: {
      title: 'Custom Chord Lab',
      summary: 'Isolate any exact chord qualities (e.g. Dom7 vs Min7, or Dim vs Half-Dim 7th).',
      detail: 'Select the exact chord qualities below to compare their harmonic tension side-by-side.',
    },
  },
};

const MODE_SHORT_LABELS: Record<GameMode, string> = {
  'Note Identification': 'Notes',
  'Interval Identification': 'Intervals',
  'Chord Identification': 'Chords',
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'training' | 'analytics' | 'history' | 'mnemonics'>(getTabFromUrl);
  const [inStudio, setInStudio] = useState(isInStudioPath);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showStudioGuide, setShowStudioGuide] = useState(false);
  // Tracks manual Setup expansion during an active round; automatically resets to collapsed on Start / Next!
  const [expandedForTestId, setExpandedForTestId] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (inStudio) {
          let urlValue = '/arena';
          if (activeTab === 'analytics') urlValue = '/insights';
          else if (activeTab === 'history') urlValue = '/data';
          else if (activeTab === 'mnemonics') urlValue = '/mnemonics';

          if (window.location.pathname !== urlValue) {
            window.history.pushState({}, '', urlValue);
          }
        } else if (window.location.pathname !== '/') {
          window.history.pushState({}, '', '/');
        }
      } catch {
        // Ignore History pushState restrictions in sandboxed preview iframes
      }
    }
  }, [activeTab, inStudio]);

  useEffect(() => {
    const handlePopState = () => {
      const isStudio = isInStudioPath();
      setInStudio(isStudio);
      if (isStudio) {
        const tab = getTabFromUrl();
        if (tab !== activeTab) {
          setActiveTab(tab);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab]);

  const {
    gameMode,
    difficulty,
    sessionMode,
    adaptivePractice,
    customNotes,
    customIntervals,
    customChords,
    logResults,
    intervalDirection,
    chordVoicing,
    noteNomenclature,
    timbre,
    droneEnabled,
    droneRoot,
    showArenaPiano,
    testActive,
    currentTest,
    userGuess,
    isCorrect,
    hasAnswered,
    currentStreak,
    sessionBestStreak,
    lastResponseTimeMs,
    lastSpeedTier,
    lastComboMilestone,
    lastTimeBonusMs,
    blitzTimeLeftMs,
    blitzScore,
    blitzBestScore,
    blitzFinished,
    survivalScore,
    survivalBestScore,
    survivalGameOver,
    history: resultsHistory,
    loadingHistory,
    setGameMode,
    setDifficulty,
    setSessionMode,
    setAdaptivePractice,
    startWeaknessTraining,
    startCustomDrill,
    setCustomNotes,
    setCustomIntervals,
    setCustomChords,
    setLogResults,
    setIntervalDirection,
    setChordVoicing,
    setNoteNomenclature,
    setTimbre,
    setDroneEnabled,
    setDroneRoot,
    setShowArenaPiano,
    generateNewTest,
    startNewArcadeRun,
    tickBlitzTimer,
    rehearTest,
    playUserGuessSound,
    submitGuess,
    playOptionSound,
    loadHistory,
    clearHistory,
    deleteHistoryItem,
    mnemonics,
    loadMnemonics,
    loadSettings,
  } = useTheoryStore();

  const [insightsScope, setInsightsScope] = useState<InsightsScope>('all');

  // 60-Second Blitz active listening clock (pauses automatically once user answers so they can inspect/replay freely!)
  useEffect(() => {
    if (sessionMode !== 'blitz' || !testActive || hasAnswered || blitzFinished || activeTab !== 'training' || !inStudio) {
      return;
    }
    let lastTick = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;
      tickBlitzTimer(delta);
    }, 80);
    return () => window.clearInterval(id);
  }, [sessionMode, testActive, hasAnswered, blitzFinished, activeTab, inStudio, tickBlitzTimer]);

  const handleLogoClick = () => {
    if (droneEnabled) {
      setDroneEnabled(false);
    }
    setInStudio(false);
  };

  const pendingSyncCount = useMemo(() => {
    if (!user) return 0;
    return resultsHistory.filter((item) => item.synced === false).length;
  }, [user, resultsHistory]);

  const [hintState, setHintState] = useState<{ testId: number | undefined; items: string[] }>({
    testId: undefined,
    items: [],
  });
  const revealedHints = useMemo(
    () => (hintState.testId === currentTest?.playedAt ? hintState.items : []),
    [hintState, currentTest?.playedAt]
  );

  const allRefsForCurrentTest = useMemo(() => {
    if (!currentTest?.correctAnswer) return [];
    return getMnemonicWithDefault(currentTest.correctAnswer, mnemonics);
  }, [currentTest, mnemonics]);

  const handleRevealHint = () => {
    const remainingRefs = allRefsForCurrentTest.filter((ref) => !revealedHints.includes(ref));
    if (remainingRefs.length > 0) {
      const randomRef = remainingRefs[Math.floor(Math.random() * remainingRefs.length)];
      setHintState({
        testId: currentTest?.playedAt,
        items: [...revealedHints, randomRef],
      });
    }
  };

  // Auth subscriber and history loader
  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => setLoading(false), 1200);

    getRedirectResult(auth).catch((error) => {
      console.error('Redirect sign-in error:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      window.clearTimeout(fallbackTimer);
      setUser(currentUser);
      setLoading(false);
      loadHistory(currentUser ? currentUser.uid : null);
      loadMnemonics(currentUser ? currentUser.uid : null);
      loadSettings(currentUser ? currentUser.uid : null);
      if (currentUser) {
        setInStudio(true);
      }
    });

    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [loadHistory, loadMnemonics, loadSettings]);

  // Existing one-time custom mnemonics migration preserved safely
  useEffect(() => {
    if (user) {
      const runMigration = async () => {
        try {
          const flag = window.localStorage.getItem('tonaly_mnemonics_migration_v1');
          if (!flag) {
            const data = {
              Unison: ['Happy Birthday (first 2 notes)', 'Same pitch'],
              'Minor 2nd': ['Jaws Theme', 'Für Elise (first 2 notes)', 'Pink Panther'],
              'Major 2nd': ['Happy Birthday (2nd to 3rd note)', 'Silent Night (first 2 notes)', 'Frère Jacques', 'Do-Re'],
              'Minor 3rd': ['Hey Jude', 'La Perica', 'Romeo & Julieta'],
              'Major 3rd': ['Kumbaya', 'Blue Danube', 'Maiquetia: su atencion por favor'],
              'Perfect 4th': ['Amazing Grace', 'Harry Potter Theme', 'Tango final', 'Cambur pinton', 'Trumpet announcement'],
              'Tritone (Diminished 5th)': ['The Simpsons Theme', 'Maria (West Side Story)', 'Dune chant'],
              'Perfect 5th': ['Star Wars Theme', 'Twinkle Twinkle Little Star', 'Wise Men', 'Forest Gump Theme'],
              'Minor 6th': ['The Entertainer (Scott Joplin)', 'Love Story Theme', 'We Are Young (Fun. chorus)'],
            };

            for (const [key, value] of Object.entries(data)) {
              await useTheoryStore.getState().setMnemonic(key, value);
            }

            window.localStorage.setItem('tonaly_mnemonics_migration_v1', 'done');
          }
        } catch (e) {
          console.error('Mnemonics setup migration failed:', e);
        }
      };
      runMigration();
    }
  }, [user]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Active guess options aligned 100% with useTheoryStore pools
  const guessOptions = useMemo(() => {
    if (gameMode === 'Note Identification') {
      return getNoteOptionsForDifficulty(difficulty, customNotes);
    }
    if (gameMode === 'Chord Identification') {
      return getChordsForDifficulty(difficulty, customChords).map((c) => c.name);
    }
    if (difficulty === 'Easy') {
      return ['Unison', 'Major 3rd', 'Perfect 5th', 'Octave'];
    }
    if (difficulty === 'Medium') {
      return INTERVAL_MAP.slice(0, 13).map((item) => item.name);
    }
    if (difficulty === 'Hard') {
      return INTERVAL_MAP.map((item) => item.name);
    }
    return customIntervals.length > 0 ? customIntervals : ['Unison', 'Major 3rd', 'Perfect 5th', 'Octave'];
  }, [gameMode, difficulty, customNotes, customIntervals, customChords]);

  const currentRoundKey = currentTest?.playedAt ?? -1;
  const isSetupOpen = !testActive || expandedForTestId === currentRoundKey;

  const toggleSetupWhilePlaying = () => {
    if (!testActive) return;
    if (isSetupOpen) {
      setExpandedForTestId(null);
      setShowSettingsDrawer(false);
      setShowStudioGuide(false);
    } else {
      setExpandedForTestId(currentRoundKey);
    }
  };

  // Keyboard shortcuts: Space = New/Next (never auto-advances!), R = Repeat Target, G = Play Your Guess, P = Toggle Piano, Esc = Close Setup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!inStudio || activeTab !== 'training') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        generateNewTest();
      } else if (e.code === 'KeyR') {
        rehearTest();
      } else if (e.code === 'KeyG' && hasAnswered && !isCorrect && userGuess) {
        playUserGuessSound();
      } else if (e.code === 'KeyP') {
        setShowArenaPiano(!showArenaPiano);
      } else if (e.code === 'Escape' && testActive && isSetupOpen) {
        setExpandedForTestId(null);
        setShowSettingsDrawer(false);
        setShowStudioGuide(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    inStudio,
    activeTab,
    generateNewTest,
    rehearTest,
    playUserGuessSound,
    hasAnswered,
    isCorrect,
    userGuess,
    showArenaPiano,
    setShowArenaPiano,
    testActive,
    isSetupOpen,
  ]);

  // Friendly, adaptive 2-octave Arena Piano window (uncluttered ~15 white keys, framed around active notes)
  const arenaPianoRange = useMemo(() => {
    let minIdx = ALL_NOTES.indexOf('C4');
    let maxIdx = ALL_NOTES.indexOf('C6');

    if (hasAnswered && currentTest) {
      const relevantNotes = [
        currentTest.baseNote,
        ...(currentTest.targetNote ? [currentTest.targetNote] : []),
        ...(currentTest.chordNotes || []),
      ];
      const indices = relevantNotes.map((n) => ALL_NOTES.indexOf(n)).filter((i) => i !== -1);
      if (indices.length > 0) {
        const lowest = Math.min(...indices);
        const highest = Math.max(...indices);
        if (lowest < minIdx) {
          minIdx = Math.max(0, ALL_NOTES.indexOf('C3'));
          maxIdx = Math.max(highest + 2, ALL_NOTES.indexOf('C5'));
        }
        if (highest > maxIdx) {
          maxIdx = Math.min(ALL_NOTES.length - 1, ALL_NOTES.indexOf('C6') + 12);
        }
      }
    }

    return ALL_NOTES.slice(minIdx, maxIdx + 1);
  }, [hasAnswered, currentTest]);

  // Compute piano visual highlights ONLY after answering so nothing is spoiled mid-test
  const pianoVisuals = useMemo(() => {
    if (!hasAnswered || !currentTest) {
      return {
        rootNote: null as string | null,
        correctNote: null as string | null,
        correctNotes: [] as string[],
        incorrectNote: null as string | null,
        arcInterval: null as { from: string; to: string; label?: string } | null,
      };
    }

    if (gameMode === 'Note Identification') {
      return {
        rootNote: null,
        correctNote: currentTest.correctAnswer,
        correctNotes: [currentTest.correctAnswer],
        incorrectNote: !isCorrect && userGuess ? userGuess : null,
        arcInterval: null,
      };
    }

    if (gameMode === 'Chord Identification') {
      const tones = currentTest.chordNotes || [currentTest.baseNote];
      return {
        rootNote: tones[0] || currentTest.baseNote,
        correctNote: null,
        correctNotes: tones.slice(1),
        incorrectNote: null,
        arcInterval: null,
      };
    }

    let wrongTarget: string | null = null;
    if (!isCorrect && userGuess) {
      const guessedInt = INTERVAL_MAP.find((i) => i.name === userGuess);
      if (guessedInt) {
        const signed =
          currentTest.actualDirection === 'high-to-low' ? -guessedInt.semitones : guessedInt.semitones;
        wrongTarget = getNoteFromSemitones(currentTest.baseNote, signed);
      }
    }

    return {
      rootNote: currentTest.baseNote,
      correctNote: currentTest.targetNote,
      correctNotes: currentTest.targetNote ? [currentTest.targetNote] : [],
      incorrectNote: wrongTarget,
      arcInterval:
        currentTest.targetNote && currentTest.baseNote !== currentTest.targetNote
          ? { from: currentTest.baseNote, to: currentTest.targetNote }
          : null,
    };
  }, [hasAnswered, currentTest, gameMode, isCorrect, userGuess]);

  const visualizerMood = useMemo(() => {
    if (!testActive) return 'idle';
    if (!hasAnswered) return 'listening';
    if (lastComboMilestone && lastComboMilestone >= 5) return 'milestone';
    return isCorrect ? 'correct' : 'wrong';
  }, [testActive, hasAnswered, isCorrect, lastComboMilestone]);

  const blitzProgressPct = Math.max(0, Math.min(100, (blitzTimeLeftMs / BLITZ_DURATION_MS) * 100));
  const activeCurriculum = LEVEL_CURRICULUM[gameMode][difficulty];

  return (
    <div className="min-h-screen text-slate-50 flex flex-col justify-between selection:bg-cyan-500 selection:text-white relative">
      {/* Signature Tonaly Atmospheric Studio Backdrop + Musical Stave & Vibrating Strings */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none bg-[#080c15]">
        <div className="absolute -top-[28%] -left-[10%] w-[68%] h-[68%] rounded-full bg-cyan-950/25 blur-[135px]" />
        <div className="absolute -bottom-[28%] -right-[10%] w-[65%] h-[65%] rounded-full bg-amber-950/10 blur-[135px]" />
        <div className="absolute top-[40%] left-[30%] w-[45%] h-[45%] rounded-full bg-blue-950/10 blur-[120px]" />

        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(circle, #06b6d4 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <svg className="absolute inset-0 w-full h-full opacity-[0.38]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="string-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="stave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0" />
              <stop offset="20%" stopColor="#334155" stopOpacity="0.8" />
              <stop offset="80%" stopColor="#334155" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="translate-y-[10%] sm:translate-y-[15%]">
            <line x1="0" y1="100" x2="100%" y2="100" stroke="url(#stave-grad)" strokeWidth="1.2" />
            <line x1="0" y1="120" x2="100%" y2="120" stroke="url(#stave-grad)" strokeWidth="1.2" />
            <line x1="0" y1="140" x2="100%" y2="140" stroke="url(#stave-grad)" strokeWidth="1.2" />
            <line x1="0" y1="160" x2="100%" y2="160" stroke="url(#stave-grad)" strokeWidth="1.2" />
            <line x1="0" y1="180" x2="100%" y2="180" stroke="url(#stave-grad)" strokeWidth="1.2" />
          </g>
          <path
            d="M -100,280 C 220,120 420,480 720,230 C 1020,30 1220,380 1620,180 C 1820,100 2020,280 2220,180"
            fill="none"
            stroke="url(#string-grad-1)"
            strokeWidth="2"
          />
        </svg>
      </div>

      {/* Header */}
      <header className="glass-panel sticky top-0 z-50 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between border-t-0 border-x-0">
        <div
          onClick={handleLogoClick}
          className="flex items-center space-x-3 cursor-pointer group select-none"
        >
          <img
            src="/logo.png"
            alt="Tonaly"
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl object-cover border border-cyan-500/30 shadow-md group-hover:border-cyan-400 transition bg-white"
          />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight m-0 text-white leading-none group-hover:text-cyan-300 transition">
              Tonaly
            </h1>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-wider uppercase">
              Ear Training Studio
            </span>
          </div>
        </div>

        {/* Middle Navigation Tabs (All 4 Original Sections Preserved) */}
        {inStudio && (
          <nav className="hidden md:flex items-center bg-slate-950/85 p-1 rounded-xl border border-slate-800/70">
            {(
              [
                { id: 'training', label: 'Arena' },
                { id: 'analytics', label: 'Insights' },
                { id: 'history', label: 'Data' },
                { id: 'mnemonics', label: 'Mnemonics' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider cursor-pointer ${
                  activeTab === tab.id ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        {/* Right Side Controls */}
        <div className="flex items-center space-x-3">
          {!inStudio && (
            <button
              type="button"
              onClick={() => setInStudio(true)}
              className="hidden sm:flex items-center bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs px-4 py-2 rounded-xl font-bold transition uppercase tracking-wider cursor-pointer"
            >
              Enter Studio
            </button>
          )}

          {loading ? (
            <div className="h-9 w-24 bg-slate-800/80 rounded-xl" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-900/80 border border-slate-800 px-2.5 py-1.5 rounded-xl">
                <Cloud className="h-3.5 w-3.5 text-cyan-400" />
                <span className="max-w-[110px] truncate">{user.displayName || user.email || 'Synced'}</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center bg-slate-900/85 hover:bg-rose-950/30 text-slate-300 hover:text-rose-400 p-2 rounded-xl transition border border-slate-800 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              {inStudio && (
                <span
                  title="Progress is automatically saved in this browser. Sign in to sync across devices."
                  className="hidden lg:inline-flex items-center space-x-1.5 bg-slate-900/80 border border-slate-800 text-slate-400 text-[10px] font-semibold px-2.5 py-1.5 rounded-xl"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Guest (Local Save)</span>
                </span>
              )}
              <button
                type="button"
                onClick={handleSignIn}
                className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3.5 py-2 rounded-xl transition font-bold shadow-lg shadow-cyan-950/40 uppercase tracking-wider cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-7 flex-grow">
        {!inStudio ? (
          <LandingPage
            onPlayAsGuest={() => setInStudio(true)}
            onSignIn={handleSignIn}
            user={user}
          />
        ) : (
          <>
            {/* Mobile Tab Selectors */}
            <div className="flex md:hidden items-center justify-center bg-slate-950/90 p-1 rounded-xl border border-slate-800/80 mb-4">
              {(
                [
                  { id: 'training', label: 'Arena' },
                  { id: 'analytics', label: 'Insights' },
                  { id: 'history', label: 'Data' },
                  { id: 'mnemonics', label: 'Mnemonics' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black transition uppercase tracking-wider text-center cursor-pointer ${
                    activeTab === tab.id ? 'bg-cyan-600 text-white' : 'text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: PRACTICE ARENA */}
            {activeTab === 'training' && (
              <div className="max-w-5xl mx-auto space-y-3 sm:space-y-3.5">
                {/* SMART FOCUS SESSION BAR WHILE PLAYING vs. FULL STUDIO SETUP DECK */}
                {!isSetupOpen ? (
                  <div className="glass-panel px-3 py-2 rounded-2xl flex items-center justify-between gap-2 animate-fadeIn">
                    {/* Left: Tappable Active Session Summary */}
                    <button
                      type="button"
                      onClick={toggleSetupWhilePlaying}
                      title="Click to change mode, difficulty, or studio settings"
                      className="flex items-center gap-1.5 sm:gap-2 min-w-0 text-left group cursor-pointer py-0.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 group-hover:scale-125 transition-transform" />
                      <span className="text-xs font-extrabold text-white truncate">
                        {MODE_SHORT_LABELS[gameMode]}
                      </span>
                      <span className="text-slate-600 text-xs">·</span>
                      <span className="text-xs font-bold text-cyan-300 shrink-0">{difficulty}</span>

                      {sessionMode !== 'zen' && (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                            sessionMode === 'blitz'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {sessionMode === 'blitz' ? '⚡ Blitz' : '♥ Survival'}
                        </span>
                      )}

                      {adaptivePractice && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-500/30 shrink-0">
                          <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                          <span>Adaptive</span>
                        </span>
                      )}

                      <span className="hidden md:inline text-[11px] text-slate-400 truncate">
                        · {TIMBRE_LABELS[timbre]}
                      </span>
                    </button>

                    {/* Right: Live In-Game Toggles (Drone & Piano) + Expand Setup */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDroneEnabled(!droneEnabled)}
                        title={droneEnabled ? 'Disable Tonic Drone' : 'Enable Tonic Drone'}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                          droneEnabled
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Radio className={`h-3.5 w-3.5 ${droneEnabled ? 'text-cyan-400 animate-pulse' : ''}`} />
                        <span className="hidden sm:inline">
                          {droneEnabled
                            ? `Drone (${droneRoot === 'auto' ? 'Auto' : droneRoot.replace('3', '')})`
                            : 'Drone'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowArenaPiano(!showArenaPiano)}
                        title="Toggle Studio Keyboard [P]"
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                          showArenaPiano
                            ? 'bg-slate-800/90 border-slate-700 text-slate-100'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Keyboard className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="hidden sm:inline">Piano</span>
                      </button>

                      <button
                        type="button"
                        onClick={toggleSetupWhilePlaying}
                        className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-cyan-300 transition cursor-pointer"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Setup</span>
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="glass-panel p-2.5 sm:p-4 rounded-2xl space-y-2 sm:space-y-3 animate-fadeIn">
                    {testActive && (
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Session Setup &amp; Studio Controls
                        </span>
                        <button
                          type="button"
                          onClick={toggleSetupWhilePlaying}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-200 text-[11px] font-bold transition cursor-pointer"
                        >
                          <span>Done</span>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                      {/* Primary Segmented Selectors: Full-width symmetric grids on mobile, inline pills on sm+ */}
                      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-1.5 sm:gap-2">
                      {/* Game Mode Switcher */}
                      <div className="grid grid-cols-3 sm:inline-flex studio-inset p-1 rounded-xl w-full sm:w-auto">
                        {(
                          [
                            { mode: 'Note Identification' as GameMode, label: 'Notes' },
                            { mode: 'Interval Identification' as GameMode, label: 'Intervals' },
                            { mode: 'Chord Identification' as GameMode, label: 'Chords' },
                          ]
                        ).map((m) => (
                          <button
                            key={m.mode}
                            type="button"
                            onClick={() => setGameMode(m.mode)}
                            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition text-center cursor-pointer ${
                              gameMode === m.mode
                                ? 'bg-cyan-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>

                      {/* Difficulty Tier Switcher (Easy | Medium | Hard | Custom) */}
                      <div className="grid grid-cols-4 sm:inline-flex studio-inset p-1 rounded-xl w-full sm:w-auto">
                        {(['Easy', 'Medium', 'Hard', 'Custom'] as const).map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setDifficulty(level)}
                            className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold transition text-center cursor-pointer ${
                              difficulty === level
                                ? 'bg-cyan-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>

                      {/* Session Mode Switcher (Zen / 60s Blitz / Survival) */}
                      <div className="grid grid-cols-3 sm:inline-flex studio-inset p-1 rounded-xl w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setSessionMode('zen')}
                          title="Untimed mindful studio practice"
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition text-center cursor-pointer ${
                            sessionMode === 'zen'
                              ? 'bg-slate-800 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Zen
                        </button>
                        <button
                          type="button"
                          onClick={() => setSessionMode('blitz')}
                          title="60-second sprint — clock pauses after each answer so you can still review tips!"
                          className={`inline-flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            sessionMode === 'blitz'
                              ? 'bg-amber-500 text-slate-950 shadow'
                              : 'text-slate-400 hover:text-amber-300'
                          }`}
                        >
                          <Zap className="h-3 w-3 shrink-0" />
                          <span className="sm:hidden">Blitz</span>
                          <span className="hidden sm:inline">60s Blitz</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSessionMode('survival')}
                          title="Sudden-death run — play until a single miss"
                          className={`inline-flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            sessionMode === 'survival'
                              ? 'bg-rose-500 text-white shadow'
                              : 'text-slate-400 hover:text-rose-300'
                          }`}
                        >
                          <Heart className="h-3 w-3 shrink-0" />
                          <span>Survival</span>
                        </button>
                      </div>
                    </div>

                    {/* Studio Tool Dock: Symmetric 5-column icon+label grid on mobile, sleek horizontal pills on sm+ */}
                    <div className="grid grid-cols-5 sm:flex sm:flex-wrap items-stretch sm:items-center gap-1.5 w-full lg:w-auto">
                      <button
                        type="button"
                        onClick={() => setAdaptivePractice(!adaptivePractice)}
                        className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-1.5 px-1 sm:px-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold border transition cursor-pointer ${
                          adaptivePractice
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>Adaptive</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDroneEnabled(!droneEnabled)}
                        className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-1.5 px-1 sm:px-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold border transition cursor-pointer ${
                          droneEnabled
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Radio className={`h-3.5 w-3.5 shrink-0 ${droneEnabled ? 'text-cyan-400 animate-pulse' : ''}`} />
                        <span>Drone</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowArenaPiano(!showArenaPiano)}
                        className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-1.5 px-1 sm:px-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold border transition cursor-pointer ${
                          showArenaPiano
                            ? 'bg-slate-800/90 border-slate-700 text-slate-100'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Keyboard className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        <span>Piano</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
                        className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-1.5 px-1 sm:px-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold border transition cursor-pointer ${
                          showSettingsDrawer
                            ? 'bg-cyan-600 border-cyan-500 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
                        }`}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                        <span className="sm:hidden">Options</span>
                        <span className="hidden sm:inline">Sound &amp; Options</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowStudioGuide(!showStudioGuide)}
                        title="Learn what Levels, Adaptive, Drone, and Modes do"
                        className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-1.5 px-1 sm:px-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold border transition cursor-pointer ${
                          showStudioGuide
                            ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/30'
                        }`}
                      >
                        <HelpCircle className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        <span>Guide</span>
                      </button>
                    </div>
                  </div>

                  {/* Sleek Single-Row Tappable Curriculum Bar + Active Feature Banners */}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setShowStudioGuide(!showStudioGuide)}
                      className="w-full flex items-center justify-between gap-2 bg-slate-950/60 hover:bg-slate-950/85 border border-slate-800/70 rounded-xl px-3 py-2 text-left transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                        <span className="text-[11px] font-bold text-cyan-300 truncate">
                          {difficulty} · {activeCurriculum.title}
                        </span>
                        <span className="hidden md:inline text-[11px] text-slate-400 truncate">
                          — {activeCurriculum.summary}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-cyan-300 shrink-0 transition">
                        {showStudioGuide ? 'Hide ▲' : 'Details ▼'}
                      </span>
                    </button>

                    {/* Contextual explanation banner whenever Adaptive or Drone is turned ON */}
                    {(adaptivePractice || droneEnabled) && (
                      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                        {adaptivePractice && (
                          <div className="flex-1 min-w-[240px] bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 text-[11px] text-amber-100 flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-amber-300">Smart Adaptive Active:</strong> Weights upcoming questions toward items you miss or answer slowly.
                            </div>
                          </div>
                        )}

                        {droneEnabled && (
                          <div className="flex-1 min-w-[240px] bg-cyan-500/10 border border-cyan-500/25 rounded-xl px-3 py-2 text-[11px] text-cyan-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <Radio className="h-3.5 w-3.5 text-cyan-400 animate-pulse shrink-0 mt-0.5" />
                              <div>
                                <strong className="text-cyan-300">Tonic Drone Active:</strong> Hums a continuous reference root pitch for harmonic ear context.
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-start gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 w-full sm:w-auto overflow-x-auto">
                              <span className="text-[10px] text-slate-400 px-1 font-semibold shrink-0">Key:</span>
                              {(
                                [
                                  ...(gameMode !== 'Note Identification'
                                    ? ([{ val: 'auto', label: 'Auto' }] as const)
                                    : []),
                                  { val: 'C3', label: 'C' },
                                  { val: 'D3', label: 'D' },
                                  { val: 'E3', label: 'E' },
                                  { val: 'F3', label: 'F' },
                                  { val: 'G3', label: 'G' },
                                  { val: 'A3', label: 'A' },
                                  { val: 'B3', label: 'B' },
                                ] as { val: DroneRootSetting; label: string }[]
                              ).map((k) => (
                                <button
                                  key={k.val}
                                  type="button"
                                  onClick={() => setDroneRoot(k.val)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer shrink-0 ${
                                    droneRoot === k.val
                                      ? 'bg-cyan-600 text-white'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {k.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Directly Visible Custom Pool Picker whenever Difficulty === 'Custom' */}
                  {difficulty === 'Custom' && (
                    <div className="border-t border-slate-800/70 pt-3 animate-fadeIn">
                      {gameMode === 'Note Identification' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-cyan-300">
                              Custom Note Pool ({customNotes.length} selected — click notes to toggle)
                            </span>
                            <button
                              type="button"
                              onClick={() => setCustomNotes(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'])}
                              className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                            >
                              Reset to C4–B4
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_NOTES.slice(ALL_NOTES.indexOf('C4'), ALL_NOTES.indexOf('B5') + 1).map(
                              (note) => {
                                const selected = customNotes.includes(note);
                                return (
                                  <button
                                    key={note}
                                    type="button"
                                    onClick={() => {
                                      if (selected && customNotes.length > 1) {
                                        setCustomNotes(customNotes.filter((n) => n !== note));
                                      } else if (!selected) {
                                        setCustomNotes([...customNotes, note]);
                                      }
                                    }}
                                    className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                                      selected
                                        ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/45'
                                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                                    }`}
                                  >
                                    {convertNoteToNomenclature(note, noteNomenclature)}
                                  </button>
                                );
                              }
                            )}
                          </div>
                        </div>
                      )}

                      {gameMode === 'Interval Identification' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-cyan-300">
                              Custom Interval Pool ({customIntervals.length} selected — click intervals to toggle)
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCustomIntervals(['Unison', 'Major 3rd', 'Perfect 5th', 'Octave'])
                              }
                              className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                            >
                              Reset to Pillars
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {INTERVAL_MAP.map((item) => {
                              const selected = customIntervals.includes(item.name);
                              return (
                                <button
                                  key={item.name}
                                  type="button"
                                  onClick={() => {
                                    if (selected && customIntervals.length > 1) {
                                      setCustomIntervals(customIntervals.filter((n) => n !== item.name));
                                    } else if (!selected) {
                                      setCustomIntervals([...customIntervals, item.name]);
                                    }
                                  }}
                                  className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                                    selected
                                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/45'
                                      : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                                  }`}
                                >
                                  {item.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {gameMode === 'Chord Identification' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-cyan-300">
                              Custom Chord Pool ({customChords.length} selected — click chords to toggle)
                            </span>
                            <button
                              type="button"
                              onClick={() => setCustomChords(['Major', 'Minor', 'Diminished', 'Maj7'])}
                              className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                            >
                              Reset Default
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {CHORD_MAP.map((chord) => {
                              const selected = customChords.includes(chord.name);
                              return (
                                <button
                                  key={chord.name}
                                  type="button"
                                  onClick={() => {
                                    if (selected && customChords.length > 1) {
                                      setCustomChords(customChords.filter((c) => c !== chord.name));
                                    } else if (!selected) {
                                      setCustomChords([...customChords, chord.name]);
                                    }
                                  }}
                                  className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                                    selected
                                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/45'
                                      : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                                  }`}
                                >
                                  {chord.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}

                {/* EDUCATIVE STUDIO GUIDE PANEL (Explains Levels, Drone, Adaptive & Arcade Modes clearly!) */}
                {isSetupOpen && showStudioGuide && (
                  <div className="glass-panel p-5 rounded-3xl animate-fadeIn space-y-5 border-cyan-500/30">
                    <div className="flex items-center justify-between border-b border-slate-800/70 pb-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-cyan-400" />
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                          Ear Training Studio Guide — How Everything Works
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowStudioGuide(false)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Section 1: Difficulty Tiers Explained for Active Mode */}
                    <div className="space-y-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block">
                        {gameMode.replace(' Identification', '')} Curriculum Levels
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {(['Easy', 'Medium', 'Hard', 'Custom'] as const).map((lvl) => {
                          const info = LEVEL_CURRICULUM[gameMode][lvl];
                          const isCurrent = difficulty === lvl;
                          return (
                            <div
                              key={lvl}
                              onClick={() => setDifficulty(lvl)}
                              className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                                isCurrent
                                  ? 'bg-cyan-950/35 border-cyan-500/50'
                                  : 'studio-inset hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-black text-white">{lvl}</span>
                                {isCurrent && (
                                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-bold text-slate-200 mb-1">{info.title}</p>
                              <p className="text-[11px] text-slate-400 leading-relaxed">{info.detail}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section 2: Drone, Adaptive & Session Modes Explained */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                      <div className="studio-inset p-4 rounded-2xl space-y-1.5">
                        <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                          <Radio className="h-4 w-4 text-cyan-400" />
                          <span>What is Tonic Drone?</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          A continuous, soft low reference note held in the background—used for centuries in conservatory ear training and Indian classical <em>tanpura</em> practice. Instead of guessing notes in thin air, your ear learns the unique harmonic &ldquo;pull&rdquo; and color of every pitch against home base. In Intervals/Chords, <strong>Auto</strong> matches each question&apos;s root!
                        </p>
                      </div>

                      <div className="studio-inset p-4 rounded-2xl space-y-1.5">
                        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                          <Sparkles className="h-4 w-4 text-amber-400" />
                          <span>What is Smart Adaptive?</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Instead of picking questions purely at random, <strong>Adaptive</strong> tracks both your accuracy and hesitation speed on every note, interval, and chord. Items you miss, haven&apos;t practiced yet, or answer slowly appear significantly more often—acting like musical spaced repetition while still mixing in mastered anchors.
                        </p>
                      </div>

                      <div className="studio-inset p-4 rounded-2xl space-y-1.5">
                        <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                          <Zap className="h-4 w-4 text-emerald-400" />
                          <span>Zen vs. 60s Blitz vs. Survival</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          <strong>Zen</strong> is untimed studio exploration. <strong>60s Blitz</strong> tests rapid instinct (+1.0s bonus for sub-1.8s answers), and <em>pauses the clock</em> as soon as you answer so you can still replay and study song mnemonics unhurried! <strong>Survival</strong> challenges how many you can land in a row without a single miss.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Collapsible Sound & Studio Options Drawer */}
                {isSetupOpen && showSettingsDrawer && (
                  <div className="glass-panel p-5 rounded-3xl animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* Instrument Timbre */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Studio Instrument Timbre
                        </label>
                        <div className="grid grid-cols-2 gap-1 studio-inset p-1 rounded-xl">
                          {(Object.keys(TIMBRE_LABELS) as SynthTimbre[]).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTimbre(t)}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition truncate cursor-pointer ${
                                timbre === t
                                  ? 'bg-cyan-600 text-white'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {TIMBRE_LABELS[t]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Interval Direction OR Chord Voicing */}
                      {gameMode === 'Interval Identification' ? (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Interval Play Order
                          </label>
                          <div className="grid grid-cols-2 gap-1 studio-inset p-1 rounded-xl">
                            {(
                              [
                                { val: 'low-to-high', label: 'Ascending' },
                                { val: 'high-to-low', label: 'Descending' },
                                { val: 'mixed', label: 'Mixed' },
                                { val: 'harmonic', label: 'Harmonic (Together)' },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.val}
                                type="button"
                                onClick={() => setIntervalDirection(opt.val)}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition truncate cursor-pointer ${
                                  intervalDirection === opt.val
                                    ? 'bg-cyan-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : gameMode === 'Chord Identification' ? (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Chord Voicing Style
                          </label>
                          <div className="grid grid-cols-3 gap-1 studio-inset p-1 rounded-xl">
                            {(
                              [
                                { val: 'harmonic', label: 'Strummed' },
                                { val: 'arpeggio', label: 'Arpeggio' },
                                { val: 'mixed', label: 'Mixed' },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.val}
                                type="button"
                                onClick={() => setChordVoicing(opt.val)}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                  chordVoicing === opt.val
                                    ? 'bg-cyan-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Reference Drone Root
                          </label>
                          <div className="grid grid-cols-4 gap-1 studio-inset p-1 rounded-xl">
                            {(['C3', 'D3', 'F3', 'G3', 'A3'] as DroneRootSetting[]).map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => setDroneRoot(r)}
                                className={`py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                  droneRoot === r
                                    ? 'bg-cyan-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {r.replace('3', '')}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Nomenclature & Analytics Recording */}
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Note Nomenclature
                          </label>
                          <div className="flex studio-inset p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setNoteNomenclature('scientific')}
                              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                noteNomenclature === 'scientific'
                                  ? 'bg-cyan-600 text-white'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Scientific (C4)
                            </button>
                            <button
                              type="button"
                              onClick={() => setNoteNomenclature('solfege')}
                              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                noteNomenclature === 'solfege'
                                  ? 'bg-cyan-600 text-white'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Solfège (Do4)
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] font-semibold text-slate-300">Log Rounds to Insights</span>
                          <button
                            type="button"
                            onClick={() => setLogResults(!logResults)}
                            className={`w-10 h-5 rounded-full p-0.5 transition duration-200 cursor-pointer ${
                              logResults ? 'bg-emerald-500' : 'bg-slate-800'
                            }`}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow transform transition duration-200 ${
                                logResults ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* MAIN STUDIO ARENA CARD */}
                <div className="glass-panel p-4 sm:p-6 rounded-3xl relative overflow-hidden">
                  {/* 60s Blitz Progress Bar */}
                  {sessionMode === 'blitz' && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-slate-900">
                      <div
                        className={`h-full transition-all duration-100 ${
                          blitzTimeLeftMs <= 10_000 ? 'bg-rose-500' : 'bg-amber-400'
                        }`}
                        style={{ width: `${blitzProgressPct}%` }}
                      />
                    </div>
                  )}

                  {/* Arena HUD & Action Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/60 mb-4">
                    {/* Left HUD: Live Streak, Combos & Arcade Score */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Live Streak Counter */}
                      <div
                        title={`Session Best Streak: ${sessionBestStreak}`}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all duration-300 ${
                          currentStreak >= 25
                            ? 'bg-amber-400/20 border-amber-400/50 text-amber-200 shadow-lg shadow-amber-500/10'
                            : currentStreak >= 10
                              ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                              : currentStreak >= 5
                                ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                                : currentStreak > 0
                                  ? 'bg-slate-900/90 border-slate-700 text-slate-200'
                                  : 'bg-slate-950/60 border-slate-800/80 text-slate-500'
                        }`}
                      >
                        <Flame
                          className={`h-3.5 w-3.5 ${
                            currentStreak >= 5
                              ? 'text-amber-400 fill-amber-400'
                              : currentStreak > 0
                                ? 'text-amber-400'
                                : 'text-slate-600'
                          }`}
                        />
                        <span>{currentStreak}</span>
                        {currentStreak >= 5 && (
                          <span className="text-[10px] uppercase tracking-wider opacity-90">
                            {currentStreak >= 25 ? 'Master' : currentStreak >= 10 ? 'Hot' : 'Combo'}
                          </span>
                        )}
                      </div>

                      {/* 60s Blitz HUD */}
                      {sessionMode === 'blitz' && (
                        <div className="inline-flex items-center gap-2.5 studio-inset px-3 py-1.5 rounded-xl text-xs font-bold">
                          <span
                            className={`font-mono font-black ${
                              blitzTimeLeftMs <= 10_000 ? 'text-rose-400' : 'text-amber-300'
                            }`}
                          >
                            {(blitzTimeLeftMs / 1000).toFixed(1)}s
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-200">
                            Score <strong className="text-white">{blitzScore}</strong>
                          </span>
                          <span className="text-slate-500 text-[11px] hidden sm:inline">
                            (Best {blitzBestScore})
                          </span>
                          {testActive && hasAnswered && !blitzFinished && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              Clock Paused
                            </span>
                          )}
                          {lastTimeBonusMs && hasAnswered && (
                            <span className="text-[10px] font-extrabold text-amber-300 animate-comboPop">
                              +1.0s Fast!
                            </span>
                          )}
                        </div>
                      )}

                      {/* Survival HUD */}
                      {sessionMode === 'survival' && (
                        <div className="inline-flex items-center gap-2.5 studio-inset px-3 py-1.5 rounded-xl text-xs font-bold">
                          <Heart
                            className={`h-3.5 w-3.5 ${
                              survivalGameOver ? 'text-slate-600' : 'text-rose-400 fill-rose-400'
                            }`}
                          />
                          <span className="text-slate-200">
                            Run <strong className="text-white">{survivalScore}</strong>
                          </span>
                          <span className="text-slate-500 text-[11px]">(Best {survivalBestScore})</span>
                        </div>
                      )}
                    </div>

                    {/* Right Action Controls (Never auto-advances—user stays in full control) */}
                    <div className="flex items-center space-x-2 ml-auto">
                      {testActive &&
                        !hasAnswered &&
                        !blitzFinished &&
                        allRefsForCurrentTest.length > 0 &&
                        revealedHints.length < allRefsForCurrentTest.length && (
                          <button
                            type="button"
                            onClick={handleRevealHint}
                            className="flex items-center space-x-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs px-3 py-2 rounded-xl border border-amber-500/25 font-bold transition cursor-pointer"
                          >
                            <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                            <span className="hidden sm:inline">Hint</span>
                          </button>
                        )}

                      <button
                        type="button"
                        onClick={rehearTest}
                        disabled={!testActive}
                        className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-800 font-bold transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Repeat className="h-3.5 w-3.5 text-cyan-400" />
                        <span>
                          Replay <span className="hidden sm:inline">[R]</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={generateNewTest}
                        className={`flex items-center space-x-1.5 text-xs px-4 py-2 rounded-xl font-extrabold transition shadow-lg cursor-pointer ${
                          hasAnswered
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/40'
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/40'
                        }`}
                      >
                        {hasAnswered ? (
                          <>
                            <span>
                              {blitzFinished || survivalGameOver ? 'New Run' : 'Next'}
                              <span className="hidden sm:inline"> [Space]</span>
                            </span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-4 w-4" />
                            <span>
                              {testActive ? 'Skip' : 'Start'}
                              <span className="hidden sm:inline"> [Space]</span>
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Arcade Run Complete / Game Over Banner */}
                  {sessionMode === 'blitz' && blitzFinished && (
                    <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 animate-scaleIn">
                      <div className="text-center sm:text-left">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                          60-Second Blitz Complete
                        </span>
                        <h4 className="text-lg font-black text-white">
                          Final Score: {blitzScore}{' '}
                          {blitzScore >= blitzBestScore && blitzScore > 0 && (
                            <span className="text-xs font-bold text-amber-300 ml-1">★ Personal Best!</span>
                          )}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={startNewArcadeRun}
                        className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                      >
                        Play Blitz Again
                      </button>
                    </div>
                  )}

                  {sessionMode === 'survival' && survivalGameOver && (
                    <div className="mb-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 animate-scaleIn">
                      <div className="text-center sm:text-left">
                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">
                          Survival Run Ended
                        </span>
                        <h4 className="text-lg font-black text-white">
                          You survived {survivalScore} in a row!{' '}
                          <span className="text-xs font-normal text-slate-300">
                            Inspect the answer &amp; mnemonics below before starting your next run.
                          </span>
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={startNewArcadeRun}
                        className="bg-rose-500 hover:bg-rose-400 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition shrink-0 cursor-pointer"
                      >
                        New Survival Run
                      </button>
                    </div>
                  )}

                  {/* CENTRAL AUDIO-REACTIVE STAGE */}
                  <div
                    className={`min-h-[145px] sm:min-h-[195px] flex flex-col items-center justify-center text-center p-4 sm:p-7 rounded-2xl border transition-all duration-300 select-none ${
                      !testActive
                        ? 'studio-inset text-slate-400'
                        : hasAnswered
                          ? isCorrect
                            ? 'border-emerald-500/30 bg-emerald-950/15 text-white animate-glow-correct'
                            : 'border-rose-500/30 bg-rose-950/15 text-white animate-glow-wrong'
                          : 'studio-inset'
                    }`}
                  >
                    <AudioVisualizer mood={visualizerMood} height={42} />

                    {!testActive ? (
                      <div className="space-y-2 mt-2 animate-fadeIn">
                        <h3 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                          {sessionMode === 'blitz'
                            ? 'Ready for a 60-Second Ear Blitz?'
                            : sessionMode === 'survival'
                              ? 'Ready for Sudden-Death Survival?'
                              : 'Ready to train your ear?'}
                        </h3>
                        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                          <span className="hidden sm:inline">
                            Press{' '}
                            <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-200">
                              Space
                            </kbd>{' '}
                            or click{' '}
                          </span>
                          <span className="sm:hidden">Tap </span>
                          <span className="text-cyan-400 font-semibold">Start</span> to sound the first{' '}
                          {gameMode === 'Note Identification'
                            ? 'pitch'
                            : gameMode === 'Chord Identification'
                              ? 'chord'
                              : 'interval'}
                          .
                        </p>
                      </div>
                    ) : hasAnswered ? (
                      <div className="space-y-3 w-full mt-1 animate-fadeIn">
                        {/* Combo Milestone + Correct/Wrong + Speed Tier Row */}
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {isCorrect ? (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-extrabold px-3 py-1 rounded-full text-[11px] uppercase tracking-wider">
                              <Check className="h-3.5 w-3.5" />
                              <span>Correct</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 font-extrabold px-3 py-1 rounded-full text-[11px] uppercase tracking-wider">
                              <X className="h-3.5 w-3.5" />
                              <span>Missed</span>
                            </span>
                          )}

                          {isCorrect && lastSpeedTier && lastResponseTimeMs !== null && (
                            <span
                              className={`inline-flex items-center gap-1 border px-2.5 py-1 rounded-full text-[11px] font-bold ${SPEED_TIER_META[lastSpeedTier].badgeClass}`}
                            >
                              <span>{SPEED_TIER_META[lastSpeedTier].icon}</span>
                              <span>{(lastResponseTimeMs / 1000).toFixed(1)}s</span>
                              <span>• {SPEED_TIER_META[lastSpeedTier].label}</span>
                            </span>
                          )}

                          {lastComboMilestone && (
                            <span className="inline-flex items-center gap-1 bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-full text-[11px] uppercase tracking-wider animate-comboPop shadow-md">
                              <Flame className="h-3.5 w-3.5 fill-slate-950" />
                              <span>{lastComboMilestone}x Combo!</span>
                            </span>
                          )}
                        </div>

                        {/* Revealed Answer Title */}
                        <div>
                          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            {gameMode === 'Note Identification' && currentTest?.correctAnswer
                              ? convertNoteToNomenclature(currentTest.correctAnswer, noteNomenclature)
                              : currentTest?.correctAnswer}
                          </h3>

                          {/* Pitch Breakdown Pill */}
                          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                            {gameMode === 'Interval Identification' && currentTest && (
                              <div className="inline-flex items-center gap-2 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800 text-[11px] text-slate-300 font-medium">
                                <span className="font-bold text-cyan-300 font-mono">
                                  {convertNoteToNomenclature(currentTest.baseNote, noteNomenclature)}
                                </span>
                                <span className="text-slate-500">
                                  {currentTest.actualDirection === 'harmonic' ? '+' : '→'}
                                </span>
                                <span className="font-bold text-emerald-300 font-mono">
                                  {convertNoteToNomenclature(currentTest.targetNote || '', noteNomenclature)}
                                </span>
                              </div>
                            )}

                            {gameMode === 'Chord Identification' && currentTest?.chordNotes && (
                              <div className="inline-flex items-center gap-1.5 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800 text-[11px] text-slate-300 font-mono">
                                {currentTest.chordNotes.map((n, idx) => (
                                  <span
                                    key={n}
                                    className={idx === 0 ? 'text-cyan-300 font-bold' : 'text-emerald-300 font-bold'}
                                  >
                                    {convertNoteToNomenclature(n, noteNomenclature)}
                                    {idx < currentTest.chordNotes!.length - 1 ? ' · ' : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Side-by-Side Ear A/B Comparison when Wrong */}
                        {!isCorrect && userGuess && (
                          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={rehearTest}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-xs font-bold transition cursor-pointer"
                            >
                              <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                              <span>
                                Target:{' '}
                                {gameMode === 'Note Identification'
                                  ? convertNoteToNomenclature(currentTest?.correctAnswer || '', noteNomenclature)
                                  : currentTest?.correctAnswer}{' '}
                                [R]
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={playUserGuessSound}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 text-xs font-bold transition cursor-pointer"
                            >
                              <Volume2 className="h-3.5 w-3.5 text-rose-400" />
                              <span>
                                Your Guess:{' '}
                                {gameMode === 'Note Identification'
                                  ? convertNoteToNomenclature(userGuess, noteNomenclature)
                                  : userGuess}{' '}
                                [G]
                              </span>
                            </button>
                          </div>
                        )}

                        {/* Memory Anchors / Mnemonics right on the reveal stage */}
                        <div className="w-full pt-1">
                          <MnemonicEditor
                            key={currentTest?.correctAnswer || ''}
                            itemName={currentTest?.correctAnswer || ''}
                            center={true}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 mt-2 animate-fadeIn">
                        <h3 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
                          What{' '}
                          {gameMode === 'Note Identification'
                            ? 'note'
                            : gameMode === 'Chord Identification'
                              ? 'chord quality'
                              : 'interval'}{' '}
                          did you hear?
                        </h3>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          Choose below
                          {showArenaPiano && gameMode === 'Note Identification'
                            ? ' or strike the matching piano key'
                            : ''}
                          , or press{' '}
                          <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-300">
                            R
                          </kbd>{' '}
                          to listen again.
                        </p>

                        {revealedHints.length > 0 && (
                          <div className="mt-2 text-xs bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 max-w-sm mx-auto text-amber-200 animate-fadeIn flex flex-col items-center space-y-1.5">
                            <span className="font-extrabold text-[10px] text-amber-400 uppercase tracking-widest flex items-center gap-1">
                              <Lightbulb className="h-3 w-3" />
                              <span>Memory Clue</span>
                            </span>
                            <div className="flex flex-wrap gap-1.5 justify-center">
                              {revealedHints.map((ref, idx) => (
                                <span
                                  key={idx}
                                  className="bg-slate-950/70 px-2.5 py-0.5 rounded-full border border-amber-500/20 text-[11px] italic"
                                >
                                  {ref}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Guess Options Grid */}
                  {testActive && !blitzFinished && (
                    <div className="mt-5 space-y-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          {hasAnswered ? 'Tap any option to compare by ear' : 'Select Your Answer'}
                        </span>
                        {hasAnswered && (
                          <span className="text-[11px] text-slate-400">
                            Press{' '}
                            <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-200">
                              Space
                            </kbd>{' '}
                            when ready for next
                          </span>
                        )}
                      </div>

                      <div
                        className={`grid gap-2 ${
                          guessOptions.length > 14
                            ? 'grid-cols-3 sm:grid-cols-6'
                            : 'grid-cols-2 sm:grid-cols-4'
                        }`}
                      >
                        {guessOptions.map((option) => {
                          const selected = userGuess === option;
                          const correct = currentTest?.correctAnswer === option;
                          const wrong = selected && !correct;

                          let btnClass =
                            'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-800 hover:border-cyan-500/40 active:scale-[0.98]';

                          if (hasAnswered) {
                            if (correct) {
                              btnClass =
                                'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-extrabold hover:bg-emerald-500/30 shadow-lg shadow-emerald-500/10';
                            } else if (wrong) {
                              btnClass =
                                'bg-rose-500/20 border-rose-500 text-rose-300 font-extrabold hover:bg-rose-500/30 shadow-lg shadow-rose-500/10';
                            } else {
                              btnClass =
                                'bg-slate-950/50 text-slate-400 border-slate-800/70 hover:bg-slate-900 hover:text-slate-200';
                            }
                          }

                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => (hasAnswered ? playOptionSound(option) : submitGuess(option))}
                              className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all duration-150 focus:outline-none text-center cursor-pointer ${btnClass}`}
                            >
                              {gameMode === 'Note Identification'
                                ? convertNoteToNomenclature(option, noteNomenclature)
                                : option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Friendly, Uncluttered Collapsible Studio Piano */}
                  {showArenaPiano && (
                    <div className="mt-5 sm:mt-6 pt-4 border-t border-slate-800/60 animate-fadeIn">
                      <div className="flex items-center justify-between gap-2 mb-2 px-1">
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                          <span className="font-bold uppercase tracking-wider text-slate-300 whitespace-nowrap">
                            Studio Keyboard
                          </span>
                          {hasAnswered && gameMode !== 'Note Identification' && (
                            <span className="hidden sm:inline-flex items-center gap-2 text-[10px]">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-cyan-400" /> Root
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Target
                              </span>
                              {!isCorrect && pianoVisuals.incorrectNote && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Your Guess
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 text-right truncate">
                          {testActive && !hasAnswered && gameMode === 'Note Identification'
                            ? 'Tap key to guess'
                            : 'Tap keys to explore pitches'}
                        </span>
                      </div>

                      <Piano
                        compact={true}
                        interactive={true}
                        enableMidi={true}
                        playAudioOnClick={!(testActive && !hasAnswered && gameMode === 'Note Identification')}
                        customRange={arenaPianoRange}
                        rootNote={pianoVisuals.rootNote}
                        correctNote={pianoVisuals.correctNote}
                        correctNotes={pianoVisuals.correctNotes}
                        incorrectNote={pianoVisuals.incorrectNote}
                        arcInterval={pianoVisuals.arcInterval}
                        onKeyClick={(note) => {
                          if (
                            testActive &&
                            !hasAnswered &&
                            !blitzFinished &&
                            gameMode === 'Note Identification' &&
                            guessOptions.includes(note)
                          ) {
                            submitGuess(note);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: PERFORMANCE INSIGHTS DASHBOARD */}
            {activeTab === 'analytics' && (
              <div className="glass-panel p-5 sm:p-6 rounded-3xl animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-4 mb-6">
                  <div>
                    <h2 className="text-lg font-black text-white flex items-center space-x-2">
                      <Trophy className="h-5 w-5 text-cyan-400" />
                      <span>Performance Insights &amp; Ear Diagnostics</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Explore accuracy, reaction-speed tiers, daily trends, difficulty breakdowns, and mistake pairs across modes.
                    </p>
                  </div>
                  <div className="flex studio-inset p-1 rounded-xl self-start sm:self-auto">
                    {(
                      [
                        { scope: 'all' as InsightsScope, label: 'All Modes' },
                        { scope: 'Interval Identification' as InsightsScope, label: 'Intervals' },
                        { scope: 'Chord Identification' as InsightsScope, label: 'Chords' },
                        { scope: 'Note Identification' as InsightsScope, label: 'Notes' },
                      ]
                    ).map((m) => (
                      <button
                        key={m.scope}
                        type="button"
                        onClick={() => setInsightsScope(m.scope)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                          insightsScope === m.scope
                            ? 'bg-cyan-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <AnalyticsDashboard
                  allHistory={resultsHistory}
                  mode={insightsScope}
                  onSelectMode={(next) => setInsightsScope(next)}
                  onTrainWeaknesses={(targetMode) => {
                    startWeaknessTraining(targetMode);
                    setActiveTab('training');
                  }}
                  onDrillPair={(targetMode, pairItems) => {
                    startCustomDrill(targetMode, pairItems);
                    setActiveTab('training');
                  }}
                />
              </div>
            )}

            {/* TAB 3: DATA / SESSION LOG TABLE */}
            {activeTab === 'history' && (
              <div className="glass-panel p-6 rounded-3xl animate-fadeIn">
                <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-black text-white flex items-center space-x-2">
                      <History className="h-5 w-5 text-cyan-400" />
                      <span>Session Log Data</span>
                    </h2>

                    <div className="flex items-center gap-2">
                      <span
                        title={isOnline ? 'Online' : 'Offline'}
                        className={`inline-flex items-center justify-center p-1.5 rounded-lg border ${
                          isOnline
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}
                      >
                        {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                      </span>

                      {user ? (
                        pendingSyncCount > 0 ? (
                          <span
                            title={`Syncing (${pendingSyncCount} pending)`}
                            className="inline-flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-400 p-1.5 rounded-lg animate-pulse"
                          >
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          </span>
                        ) : (
                          <span
                            title="Cloud Synced"
                            className="inline-flex items-center justify-center bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 p-1.5 rounded-lg"
                          >
                            <Cloud className="h-3.5 w-3.5" />
                          </span>
                        )
                      ) : (
                        <span
                          title="Saved in Browser (Sign in for Cloud Sync)"
                          className="inline-flex items-center justify-center bg-slate-800 border border-slate-700/60 text-slate-400 p-1.5 rounded-lg"
                        >
                          <CloudOff className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    title="Reset Log"
                    className="flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 p-2 rounded-lg transition self-center cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="py-20 text-center text-slate-400 text-sm">
                    Loading practice history...
                  </div>
                ) : resultsHistory.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 text-sm">
                    No practice entries logged yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800/60">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/90 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                          <th className="p-4">Date/Time</th>
                          <th className="p-4">Game Mode</th>
                          <th className="p-4">Difficulty</th>
                          <th className="p-4">Session</th>
                          <th className="p-4">Motion / Voicing</th>
                          <th className="p-4">Target</th>
                          <th className="p-4">Your Guess</th>
                          <th className="p-4 text-center">Time</th>
                          <th className="p-4 text-center">Result</th>
                          <th className="p-4 text-center">Sync</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900 text-xs font-medium text-slate-300">
                        {resultsHistory.slice(0, 150).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-900/35 transition">
                            <td className="p-4 text-slate-400 font-mono whitespace-nowrap">
                              {formatDate(item.timestamp)}
                            </td>
                            <td className="p-4">{item.gameMode}</td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 bg-slate-800/80 rounded text-[10px] font-bold text-slate-200">
                                {item.difficulty}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="capitalize text-[11px] text-slate-300 font-semibold">
                                {item.sessionMode || 'zen'}
                              </span>
                            </td>
                            <td className="p-4">
                              {item.intervalDirection ? (
                                <span className="capitalize text-[11px] text-slate-400 font-bold">
                                  {item.intervalDirection.replace(/-/g, ' ')}
                                </span>
                              ) : item.chordVoicing ? (
                                <span className="capitalize text-[11px] text-slate-400 font-bold">
                                  {item.chordVoicing}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="p-4 font-bold text-cyan-400">
                              {item.gameMode === 'Note Identification'
                                ? convertNoteToNomenclature(item.correctAnswer, noteNomenclature)
                                : item.correctAnswer}
                            </td>
                            <td className="p-4 text-slate-400">
                              {item.gameMode === 'Note Identification'
                                ? convertNoteToNomenclature(item.userGuess, noteNomenclature)
                                : item.userGuess}
                            </td>
                            <td className="p-4 text-center text-slate-400 font-mono">
                              {item.responseTimeMs !== undefined
                                ? `${(item.responseTimeMs / 1000).toFixed(1)}s`
                                : '—'}
                            </td>
                            <td className="p-4 text-center">
                              {item.correct ? (
                                <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-[10px] font-bold border border-emerald-500/20 uppercase tracking-wider">
                                  Pass
                                </span>
                              ) : (
                                <span className="bg-rose-500/10 text-rose-400 px-2 py-1 rounded text-[10px] font-bold border border-rose-500/20 uppercase tracking-wider">
                                  Fail
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {user ? (
                                item.synced ? (
                                  <span className="text-emerald-500 inline-flex items-center" title="Synced to Cloud">
                                    <CheckCircle2 className="h-4 w-4" />
                                  </span>
                                ) : (
                                  <span className="text-amber-500 inline-flex items-center" title="Pending Sync">
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-500 inline-flex items-center" title="Saved Locally">
                                  <CloudOff className="h-4 w-4" />
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                type="button"
                                onClick={() => deleteHistoryItem(item.id)}
                                className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition duration-150 cursor-pointer"
                                title="Delete Entry"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: MNEMONICS LIBRARY */}
            {activeTab === 'mnemonics' && <MnemonicsLibrary />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 px-6 py-6 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md">
        <p className="text-[11px] text-slate-500 font-medium tracking-wide flex items-center gap-2">
          <Music className="h-3 w-3 text-cyan-500/70" />
          <span>
            A{' '}
            <a
              href="https://bervos.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-cyan-400 transition duration-200 font-bold"
            >
              BERVOS
            </a>{' '}
            project • v{version}
          </span>
        </p>
      </footer>

      {/* Reset History Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel max-w-md w-full p-6 rounded-3xl shadow-2xl relative overflow-hidden animate-scaleIn">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-rose-500/10 p-2 rounded-xl border border-rose-500/20 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-white">Reset Log History?</h3>
            </div>

            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              You are about to delete{' '}
              <span className="text-rose-400 font-bold font-mono">{resultsHistory.length}</span> practice log
              {resultsHistory.length === 1 ? '' : 's'}. This action is permanent and cannot be undone.
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-900 border border-slate-800/60 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearHistory();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950/40 transition cursor-pointer"
              >
                Delete Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
