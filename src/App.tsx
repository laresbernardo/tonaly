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
  AlertTriangle
} from 'lucide-react';
import { signInWithGoogle, logout, auth } from './services/firebase';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { useTheoryStore } from './store/useTheoryStore';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import LandingPage from './components/LandingPage';
import { ALL_NOTES } from './lib/music-theory/notes';
import { INTERVAL_MAP } from './lib/music-theory/intervals';
import MnemonicEditor from './components/MnemonicEditor';
import MnemonicsLibrary from './components/MnemonicsLibrary';
import { getMnemonicWithDefault } from './lib/music-theory/default-references';



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
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'arena') return 'training';
    if (tab === 'insights') return 'analytics';
    if (tab === 'data') return 'history';
    if (tab === 'mnemonics') return 'mnemonics';
  }
  return 'training';
};

function App() {
  // Auth and environment state
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'training' | 'analytics' | 'history' | 'mnemonics'>(getTabFromUrl);
  const [inStudio, setInStudio] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

  // Sync activeTab to URL search params
  useEffect(() => {
    if (typeof window !== 'undefined' && inStudio) {
      const params = new URLSearchParams(window.location.search);
      let urlValue = 'arena';
      if (activeTab === 'analytics') urlValue = 'insights';
      else if (activeTab === 'history') urlValue = 'data';
      else if (activeTab === 'mnemonics') urlValue = 'mnemonics';

      if (params.get('tab') !== urlValue) {
        params.set('tab', urlValue);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({}, '', newUrl);
      }
    }
  }, [activeTab, inStudio]);

  // Sync back from URL when browser back/forward buttons are clicked
  useEffect(() => {
    const handlePopState = () => {
      const tab = getTabFromUrl();
      if (tab !== activeTab) {
        setActiveTab(tab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab]);

  const handleLogoClick = () => {
    setInStudio(false);
    // Clear search params and hash from URL to show the main landing page URL cleanly
    if (window.location.search || window.location.hash) {
      window.history.pushState({}, '', window.location.pathname);
    }
  };

  // Zustand Global Ear Training States
  const {
    gameMode,
    difficulty,
    customNotes,
    customIntervals,
    logResults,
    intervalDirection,
    testActive,
    currentTest,
    userGuess,
    isCorrect,
    hasAnswered,
    history: resultsHistory,
    loadingHistory,
    setGameMode,
    setDifficulty,
    setCustomNotes,
    setCustomIntervals,
    setLogResults,
    setIntervalDirection,
    generateNewTest,
    rehearTest,
    submitGuess,
    loadHistory,
    clearHistory,
    deleteHistoryItem,
    mnemonics,
    loadMnemonics,
    loadSettings
  } = useTheoryStore();

  const [showCustomConfig, setShowCustomConfig] = useState(false);

  const pendingSyncCount = useMemo(() => {
    if (!user) return 0;
    return resultsHistory.filter(item => item.synced === false).length;
  }, [user, resultsHistory]);
  const [revealedHints, setRevealedHints] = useState<string[]>([]);

  // Reset revealedHints when currentTest changes
  useEffect(() => {
    setRevealedHints([]);
  }, [currentTest]);

  const allRefsForCurrentTest = useMemo(() => {
    if (!currentTest?.correctAnswer) return [];
    return getMnemonicWithDefault(currentTest.correctAnswer, mnemonics);
  }, [currentTest, mnemonics]);

  const handleRevealHint = () => {
    const remainingRefs = allRefsForCurrentTest.filter(ref => !revealedHints.includes(ref));
    if (remainingRefs.length > 0) {
      const randomRef = remainingRefs[Math.floor(Math.random() * remainingRefs.length)];
      setRevealedHints([...revealedHints, randomRef]);
    }
  };

  // Auth subscriber and history loader
  useEffect(() => {
    // Process redirect result if returning from a Google redirect
    getRedirectResult(auth).catch((error) => {
      console.error('Redirect sign-in error:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
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
      unsubscribe();
    };
  }, [loadHistory, loadMnemonics, loadSettings]);

  // One-time migration to set up the user's custom mnemonics as shown in the screenshot
  useEffect(() => {
    if (user) {
      const runMigration = async () => {
        const flag = localStorage.getItem('tonaly_mnemonics_migration_v1');
        if (!flag) {
          try {
            console.log('Running mnemonics setup migration...');
            const data = {
              "Unison": ["Happy Birthday (first 2 notes)", "Same pitch"],
              "Minor 2nd": ["Jaws Theme", "Für Elise (first 2 notes)", "Pink Panther"],
              "Major 2nd": ["Happy Birthday (2nd to 3rd note)", "Silent Night (first 2 notes)", "Frère Jacques", "Do-Re"],
              "Minor 3rd": ["Hey Jude", "La Perica", "Romeo & Julieta"],
              "Major 3rd": ["Kumbaya", "Blue Danube", "Maiquetia: su atencion por favor"],
              "Perfect 4th": ["Amazing Grace", "Harry Potter Theme", "Tango final", "Cambur pinton", "Trumpet announcement"],
              "Tritone (Diminished 5th)": ["The Simpsons Theme", "Maria (West Side Story)", "Dune chant"],
              "Perfect 5th": ["Star Wars Theme", "Twinkle Twinkle Little Star", "Wise Men", "Forest Gump Theme"],
              "Minor 6th": ["The Entertainer (Scott Joplin)", "Love Story Theme", "We Are Young (Fun. chorus)"]
            };
            
            // Set each mnemonic in the store (which syncs it to Firestore)
            for (const [key, value] of Object.entries(data)) {
              await useTheoryStore.getState().setMnemonic(key, value);
            }
            
            localStorage.setItem('tonaly_mnemonics_migration_v1', 'done');
            console.log('Mnemonics setup migration completed successfully!');
          } catch (e) {
            console.error('Mnemonics setup migration failed:', e);
          }
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

  // Handle keyboard shortcuts (Space = New Test, R = Repeat) for rapid practices
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        generateNewTest();
      } else if (e.code === 'KeyR') {
        rehearTest();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [generateNewTest, rehearTest]);

  // Determine active options for the guess grid buttons
  const guessOptions = useMemo(() => {
    if (gameMode === 'Note Identification') {
      // Show corresponding note options pool
      if (difficulty === 'Easy') {
        return ALL_NOTES.filter(note => /^[CDEFGAB]4$/.test(note));
      } else if (difficulty === 'Medium') {
        return ALL_NOTES.filter(note => /[4-5]/.test(note) && !note.includes('0') && !note.includes('1') && !note.includes('7') && !note.includes('8'));
      } else if (difficulty === 'Hard') {
        return ALL_NOTES.filter(note => /[4-5]/.test(note)); // Limiting options to standard range for high readability
      } else {
        return customNotes.length > 0 ? customNotes : ALL_NOTES.filter(note => /^[CDEFGAB]4$/.test(note));
      }
    } else {
      // Interval mode: list of available intervals
      if (difficulty === 'Easy') {
        return ['Unison', 'Major 3rd', 'Perfect 5th', 'Octave'];
      } else if (difficulty === 'Medium') {
        return INTERVAL_MAP.slice(0, 13).map(item => item.name); // 1 octave
      } else if (difficulty === 'Hard') {
        return INTERVAL_MAP.map(item => item.name); // 2 octaves
      } else {
        return customIntervals.length > 0 ? customIntervals : ['Unison', 'Major 3rd', 'Perfect 5th', 'Octave'];
      }
    }
  }, [gameMode, difficulty, customNotes, customIntervals]);


  return (
    <div className="min-h-screen text-slate-50 flex flex-col justify-between selection:bg-cyan-500 selection:text-white relative">
      {/* Aurora Glowing Background Mesh & Instrument String Patterns */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none bg-slate-950">
        {/* HSL-tailored Atmosphere Glowing Orbs */}
        <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-cyan-950/25 blur-[130px]" />
        <div className="absolute -bottom-[30%] -right-[10%] w-[70%] h-[70%] rounded-full bg-orange-950/10 blur-[130px]" />
        <div className="absolute top-[40%] left-[30%] w-[45%] h-[45%] rounded-full bg-blue-950/10 blur-[120px]" />
        
        {/* Subtle dot grid representing technical music studio precision */}
        <div 
          className="absolute inset-0 opacity-[0.24]" 
          style={{
            backgroundImage: 'radial-gradient(circle, #06b6d4 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />

        {/* Premium flowing instrument strings & audio waves SVG */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.48]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="string-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="string-grad-2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0" />
              <stop offset="50%" stopColor="#ec4899" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="stave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0" />
              <stop offset="20%" stopColor="#334155" stopOpacity="0.85" />
              <stop offset="80%" stopColor="#334155" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Horizontal Staff/Stave lines resembling musical strings */}
          <g className="translate-y-[10%] sm:translate-y-[15%]">
            <line x1="0" y1="100" x2="100%" y2="100" stroke="url(#stave-grad)" strokeWidth="1.5" />
            <line x1="0" y1="120" x2="100%" y2="120" stroke="url(#stave-grad)" strokeWidth="1.5" />
            <line x1="0" y1="140" x2="100%" y2="140" stroke="url(#stave-grad)" strokeWidth="1.5" />
            <line x1="0" y1="160" x2="100%" y2="160" stroke="url(#stave-grad)" strokeWidth="1.5" />
            <line x1="0" y1="180" x2="100%" y2="180" stroke="url(#stave-grad)" strokeWidth="1.5" />
          </g>

          {/* Vibrating wavy lines resembling guitar or piano strings */}
          {/* String 1 (Cyan high wave) */}
          <path 
            d="M -100,280 C 220,120 420,480 720,230 C 1020,30 1220,380 1620,180 C 1820,100 2020,280 2220,180" 
            fill="none" 
            stroke="url(#string-grad-1)" 
            strokeWidth="2.5"
            className="animate-pulse"
            style={{ animationDuration: '9s' }}
          />
          {/* String 2 (Purple low wave) */}
          <path 
            d="M -50,420 C 280,280 520,620 880,330 C 1220,80 1420,520 1820,280 C 1970,200 2120,380 2320,280" 
            fill="none" 
            stroke="url(#string-grad-2)" 
            strokeWidth="2"
            className="animate-pulse"
            style={{ animationDuration: '14s' }}
          />
          {/* String 3 (Thin vibrating string frequency) */}
          <path 
            d="M 0,135 Q 260,200 520,135 T 1040,135 T 1560,135 T 2080,135" 
            fill="none" 
            stroke="url(#string-grad-1)" 
            strokeWidth="1.25"
            strokeDasharray="6, 6"
            className="animate-pulse"
            style={{ animationDuration: '6s' }}
          />
        </svg>
      </div>
      {/* Header */}
      <header className="glass-panel sticky top-0 z-50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <div 
          onClick={handleLogoClick} 
          className="flex items-center space-x-3 cursor-pointer group select-none"
        >
          <img
            src="/logo.png"
            alt="Tonaly"
            className="h-9 w-9 rounded-xl object-cover border border-cyan-500/30 shadow-md group-hover:border-cyan-400 transition"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight m-0 text-white leading-none group-hover:text-cyan-300 transition">Tonaly</h1>
            <span className="text-xs text-slate-400 font-medium tracking-wider uppercase">Ear Training Studio</span>
          </div>
        </div>

        {/* Middle Navigation Tabs */}
        {inStudio && (
          <nav className="hidden md:flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800/60 animate-fadeIn">
            <button
              onClick={() => setActiveTab('training')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider ${activeTab === 'training' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
            >
              Arena
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider ${activeTab === 'analytics' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
            >
              Insights
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider ${activeTab === 'history' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
            >
              Data
            </button>
            <button
              onClick={() => setActiveTab('mnemonics')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider ${activeTab === 'mnemonics' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
            >
              Mnemonics
            </button>
          </nav>
        )}

        {/* Right Side Controls */}
        <div className="flex items-center space-x-4">
          {!inStudio && (
            <button
              onClick={() => setInStudio(true)}
              className="hidden sm:flex items-center bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs px-4 py-2 rounded-lg font-bold transition uppercase tracking-wider"
            >
              Enter Studio
            </button>
          )}

          {loading ? (
            <div className="h-9 w-24 bg-slate-800/80 rounded-lg"></div>
          ) : user ? (
            <div className="flex items-center">
              <button 
                onClick={handleLogout}
                  className="flex items-center justify-center bg-slate-900/85 hover:bg-rose-950/25 text-slate-300 hover:text-rose-400 p-2 rounded-lg transition border border-slate-800 hover:border-rose-950/30 group animate-fadeIn"
                  title="Sign Out"
              >
                  <LogOut className="h-4 w-4 text-rose-500/80 group-hover:text-rose-400 transition" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2.5">
              {inStudio && (
                <span className="hidden md:inline-flex items-center space-x-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                  <span>Guest Mode</span>
                </span>
              )}
              <button 
                onClick={handleSignIn}
                className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-4 py-2 rounded-lg transition font-bold shadow-lg shadow-cyan-600/20 uppercase tracking-wider"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-grow">
        {!inStudio ? (
          <LandingPage
            onPlayAsGuest={() => setInStudio(true)}
            onSignIn={handleSignIn}
            user={user}
          />
        ) : (
          <>
            {/* Mobile Tab Selectors */}
            <div className="flex md:hidden items-center justify-center bg-slate-900 p-1 rounded-xl border border-slate-800 mb-6">
              <button
                onClick={() => setActiveTab('training')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black transition uppercase tracking-wider text-center ${activeTab === 'training' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                  }`}
              >
                Arena
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black transition uppercase tracking-wider text-center ${activeTab === 'analytics' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                  }`}
              >
                Insights
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black transition uppercase tracking-wider text-center ${activeTab === 'history' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                  }`}
              >
                Data
              </button>
                <button
                  onClick={() => setActiveTab('mnemonics')}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black transition uppercase tracking-wider text-center ${activeTab === 'mnemonics' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                    }`}
                >
                  Mnemonics
                </button>
            </div>

            {/* Guest Gating Notice Banner */}
            {!user && (
              <div className="bg-orange-500/10 border border-orange-500/25 text-orange-300 rounded-2xl p-4 mb-6 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fadeIn">
                <div className="flex items-start space-x-2.5">
                  <span className="text-base shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <p className="font-bold text-orange-200">Playing in Guest Sandbox Mode</p>
                    <p className="text-slate-400 mt-0.5">Your history and insights will reset to scratch if you reload or close this page. Sign in to enable permanent cloud sync.</p>
                  </div>
                </div>
                <button
                  onClick={handleSignIn}
                  className="bg-orange-500 hover:bg-orange-400 text-slate-950 px-4 py-2 rounded-lg font-extrabold tracking-wider uppercase shrink-0 transition text-[10px] shadow-md shadow-orange-500/10"
                >
                  Sync to Cloud
                </button>
              </div>
            )}

        {/* TAB 1: PRACTICE ARENA */}
        {activeTab === 'training' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* LEFT SIDEBAR: SETTINGS & CONFIG */}
            <div className="lg:col-span-4 space-y-6">
                    <div className="glass-panel p-6 rounded-3xl border border-slate-800/60">

                {/* Game Mode Select */}
                <div className="space-y-3 mb-6">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Game Mode</label>
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setGameMode('Note Identification')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${gameMode === 'Note Identification'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      Notes Identification
                    </button>
                    <button
                      onClick={() => setGameMode('Interval Identification')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${gameMode === 'Interval Identification'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      Intervals
                    </button>
                  </div>
                </div>

                {/* Difficulty Selection */}
                <div className="space-y-3 mb-6">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Difficulty</label>
                  <div className="grid grid-cols-4 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    {(['Easy', 'Medium', 'Hard', 'Custom'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => {
                          setDifficulty(level);
                          if (level === 'Custom') setShowCustomConfig(true);
                        }}
                        className={`py-2 rounded-lg text-[11px] font-bold transition ${difficulty === level
                          ? 'bg-cyan-600 text-white'
                          : 'text-slate-400 hover:text-white'
                          }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Configuration Drawer (Collapsible) */}
                {difficulty === 'Custom' && (
                  <div className="border-t border-slate-800/80 pt-4 mt-4 space-y-4">
                    <button
                      onClick={() => setShowCustomConfig(!showCustomConfig)}
                      className="w-full flex items-center justify-between text-xs font-bold text-slate-300 bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-800"
                    >
                      <span>⚙️ Custom Parameters Drawer</span>
                      <span>{showCustomConfig ? '▲' : '▼'}</span>
                    </button>

                    {showCustomConfig && (
                      <div className="space-y-4 bg-slate-950 p-4 rounded-2xl border border-slate-900 animate-fadeIn">
                        {gameMode === 'Note Identification' ? (
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-400 block">Custom Note Pool ({customNotes.length})</span>
                            <div className="h-32 overflow-y-auto grid grid-cols-3 gap-1.5 pr-1 select-none">
                              {ALL_NOTES.filter(n => /[4-5]/.test(n)).map(note => {
                                const selected = customNotes.includes(note);
                                return (
                                  <button
                                    key={note}
                                    onClick={() => {
                                      if (selected) setCustomNotes(customNotes.filter(n => n !== note));
                                      else setCustomNotes([...customNotes, note]);
                                    }}
                                    className={`py-1 px-2 rounded-md text-[10px] font-bold transition border ${selected
                                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                      : 'bg-slate-900 text-slate-400 border-slate-800/80'
                                      }`}
                                  >
                                    {note}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-400 block">Custom Intervals ({customIntervals.length})</span>
                            <div className="h-32 overflow-y-auto grid grid-cols-2 gap-1.5 pr-1">
                              {INTERVAL_MAP.slice(0, 13).map(item => {
                                const selected = customIntervals.includes(item.name);
                                return (
                                  <button
                                    key={item.name}
                                    onClick={() => {
                                      if (selected) setCustomIntervals(customIntervals.filter(n => n !== item.name));
                                      else setCustomIntervals([...customIntervals, item.name]);
                                    }}
                                    className={`py-1 px-2 rounded-md text-[10px] font-bold transition border text-left ${selected
                                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                      : 'bg-slate-900 text-slate-400 border-slate-800/80'
                                      }`}
                                  >
                                    {item.name}
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

                      {/* Interval Direction Select */}
                      {gameMode === 'Interval Identification' && (
                        <div className="space-y-3 mb-6 animate-fadeIn mt-6">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interval Play Order</label>
                          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                            <button
                              onClick={() => setIntervalDirection('low-to-high')}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${intervalDirection === 'low-to-high'
                                ? 'bg-cyan-600 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                            >
                              Low to High
                            </button>
                            <button
                              onClick={() => setIntervalDirection('high-to-low')}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${intervalDirection === 'high-to-low'
                                ? 'bg-cyan-600 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                            >
                              High to Low
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Log results toggle */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800/60">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">Log results to history</span>
                    <span className="text-[10px] text-slate-400">Keep track of performance metrics</span>
                  </div>
                  <button
                    onClick={() => setLogResults(!logResults)}
                    className={`w-12 h-6 rounded-full p-0.5 transition duration-200 focus:outline-none ${logResults ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                  >
                    <div className={`bg-white w-5 h-5 rounded-full shadow transform transition duration-200 ${logResults ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* CENTER COLUMN: THE TRAINING ARENA */}
            <div className="lg:col-span-8 space-y-6">
              <div className="glass-panel p-6 rounded-3xl border border-slate-800/60 flex flex-col justify-between">

                {/* Arena Header Controls */}
                      <div className="flex items-center justify-end pb-4 border-b border-slate-800/60 mb-4">
                  <div className="flex space-x-2">
                          {testActive && !hasAnswered && allRefsForCurrentTest.length > 0 && revealedHints.length < allRefsForCurrentTest.length && (
                            <button
                              onClick={handleRevealHint}
                              className="flex items-center space-x-1.5 bg-purple-900/40 hover:bg-purple-900/60 disabled:opacity-40 text-purple-300 text-xs px-3 py-2 rounded-lg border border-purple-800/60 font-bold transition"
                            >
                              <Lightbulb className="h-4 w-4 text-purple-400" />
                              <span className="hidden sm:inline">Hint</span>
                            </button>
                          )}
                    <button
                      onClick={rehearTest}
                      disabled={!testActive}
                      className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-slate-300 text-xs px-3 py-2 rounded-lg border border-slate-800 font-bold transition"
                    >
                      <Repeat className="h-4 w-4 text-cyan-400" />
                      <span>Repeat [R]</span>
                    </button>
                    <button
                      onClick={generateNewTest}
                      className="flex items-center space-x-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-lg shadow-cyan-600/20 transition"
                    >
                      <Volume2 className="h-4 w-4 text-white" />
                            <span>New [Space]</span>
                    </button>
                  </div>
                </div>

                {/* Large Visual Stage */}
                      <div
                        className={`min-h-[180px] flex flex-col items-center justify-center text-center p-6 sm:p-8 rounded-3xl border transition-all duration-500 my-4 select-none ${!testActive
                            ? 'bg-slate-950/40 border-slate-900/80 text-slate-500'
                            : hasAnswered
                              ? isCorrect
                                ? 'border-emerald-500/30 bg-gradient-to-b from-slate-950/90 to-emerald-950/20 text-white animate-glow-correct'
                                : 'border-rose-500/30 bg-gradient-to-b from-slate-950/90 to-rose-950/20 text-white animate-glow-wrong'
                              : 'border-slate-800/70 bg-gradient-to-b from-slate-950/60 to-slate-900/40 shadow-inner hover:border-cyan-500/25'
                          }`}
                      >
                  {!testActive ? (
                          <div className="space-y-3 animate-fadeIn">
                            <div className="w-12 h-12 rounded-2xl bg-cyan-950/30 border border-cyan-800/20 flex items-center justify-center mx-auto text-cyan-500/70 shadow-inner">
                              <Music className="h-6 w-6 animate-pulse" />
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-base font-bold text-slate-200 tracking-tight">Ready for ear training?</h3>
                              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                                Click <span className="text-cyan-400 font-semibold">New Test</span> or press the <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-300">Spacebar</kbd> to begin.
                              </p>
                            </div>
                    </div>
                  ) : (
                            <div className="space-y-4 w-full">
                      {hasAnswered ? (
                                <div className="space-y-3 animate-fadeIn">
                          <div className="inline-flex items-center justify-center">
                            {isCorrect ? (
                                      <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold px-3.5 py-1 rounded-full text-[10px] uppercase tracking-wider">
                                        <Check className="h-3.5 w-3.5" />
                                        <span>Correct Answer!</span>
                              </span>
                            ) : (
                                        <span className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-extrabold px-3.5 py-1 rounded-full text-[10px] uppercase tracking-wider">
                                          <X className="h-3.5 w-3.5" />
                                          <span>Incorrect Guess</span>
                              </span>
                            )}
                          </div>

                                  <div className="space-y-1">
                                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest block">
                                      {isCorrect ? 'You Nailed It' : 'Correct Answer'}
                                    </span>
                                    <h3 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-500 tracking-tight">
                                      {currentTest?.correctAnswer}
                                    </h3>
                                  </div>

                                  <div className="flex flex-col items-center gap-3 pt-1">
                                    {gameMode === 'Interval Identification' && currentTest && (
                                      <div className="inline-flex items-center gap-2 bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800/80 text-[11px] text-slate-300 font-medium">
                                        <span className="text-slate-500">Played:</span>
                                        <span className="font-bold text-cyan-400 font-mono bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-800/30">{currentTest.baseNote}</span>
                                        <span className="text-slate-600">→</span>
                                        <span className="font-bold text-cyan-400 font-mono bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-800/30">{currentTest.targetNote}</span>
                                      </div>
                                    )}
                                    {gameMode === 'Note Identification' && currentTest && (
                                      <div className="inline-flex items-center gap-2 bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800/80 text-[11px] text-slate-300 font-medium">
                                        <span className="text-slate-500">Played Note:</span>
                                        <span className="font-bold text-cyan-400 font-mono bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-800/30">{currentTest.correctAnswer}</span>
                                      </div>
                                    )}

                                    <div className="w-full mt-2">
                                      <MnemonicEditor itemName={currentTest?.correctAnswer || ''} center={true} />
                                    </div>
                                  </div>
                        </div>
                              ) : (
                                  <div className="space-y-4 animate-fadeIn">
                                    {/* Listening/Awaiting Badge */}
                                    <div className="inline-flex items-center space-x-2 bg-cyan-950/30 border border-cyan-800/40 text-cyan-400 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                      <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                                      </span>
                                      <span>Listening Mode</span>
                                    </div>

                          <div className="space-y-1">
                                      <h3 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
                              What {gameMode === 'Note Identification' ? 'note' : 'interval'} did you hear?
                            </h3>
                                      <p className="text-xs text-slate-400 max-w-xs mx-auto">
                                        Select your guess below, or press <kbd className="px-1 py-0.5 bg-slate-900 border border-slate-800 rounded text-[9px] font-mono text-slate-400">R</kbd> to replay.
                            </p>
                          </div>

                                    {revealedHints.length > 0 && (
                                      <div className="mt-3 text-xs bg-purple-950/25 border border-purple-800/20 rounded-2xl p-3 max-w-sm mx-auto text-purple-300 animate-fadeIn flex flex-col items-center space-y-1.5">
                                        <span className="font-extrabold text-[10px] text-purple-400 uppercase tracking-widest flex items-center gap-1">
                                          <Lightbulb className="h-3 w-3" />
                                          <span>Hint References</span>
                                        </span>
                                        <div className="flex flex-wrap gap-1.5 justify-center">
                                          {revealedHints.map((ref, idx) => (
                                            <span key={idx} className="bg-purple-900/30 px-2.5 py-0.5 rounded-full border border-purple-500/20 text-[10px] font-medium italic">
                                              {ref}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Guess Options Grid */}
                {testActive && (
                  <div className="mt-6 space-y-3 animate-fadeIn">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block text-center">
                      {hasAnswered ? 'Answer Breakdown' : 'Select Your Guess'}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {guessOptions.map((option) => {
                        const selected = userGuess === option;
                        const correct = currentTest?.correctAnswer === option;
                        const wrong = selected && !correct;

                        let btnClass = 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800/80 hover:border-slate-700';

                        if (hasAnswered) {
                          if (correct) {
                            btnClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-extrabold';
                          } else if (wrong) {
                            btnClass = 'bg-rose-500/20 border-rose-500 text-rose-400 font-extrabold';
                          } else {
                            btnClass = 'bg-slate-950 text-slate-600 border-slate-900 cursor-not-allowed opacity-50';
                          }
                        }

                        return (
                          <button
                            key={option}
                            disabled={hasAnswered}
                            onClick={() => submitGuess(option)}
                            className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition focus:outline-none capitalize text-center ${btnClass}`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}


              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INSIGHTS DASHBOARD */}
        {activeTab === 'analytics' && (
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/60">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-4 mb-6">
              <h2 className="text-lg font-black text-white flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-cyan-400" />
                <span>Performance Insights</span>
              </h2>
            </div>

            <AnalyticsDashboard history={resultsHistory} />
          </div>
        )}

        {/* TAB 3: SESSION LOG TABLE */}
        {activeTab === 'history' && (
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/60">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 pb-4 mb-6">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-black text-white flex items-center space-x-2">
                          <History className="h-5 w-5 text-cyan-400" />
                          <span>History</span>
                        </h2>

                        <div className="flex items-center gap-2">
                          <span 
                            title={isOnline ? 'Online' : 'Offline'}
                            className={`inline-flex items-center justify-center p-1.5 rounded-lg border ${isOnline
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
                              title="Guest Mode (Local Only)"
                              className="inline-flex items-center justify-center bg-slate-800 border border-slate-700/60 text-slate-400 p-1.5 rounded-lg"
                            >
                              <CloudOff className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        title="Reset Log"
                        className="flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 p-2 rounded-lg transition self-center"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>

            {loadingHistory ? (
              <div className="py-20 text-center text-slate-400 text-sm">
                Fetching logs from Cloud Database...
              </div>
            ) : resultsHistory.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-sm">
                No practice entries found in local or cloud logs yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800/60">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                      <th className="p-4">Date/Time</th>
                      <th className="p-4">Game Mode</th>
                      <th className="p-4">Difficulty</th>
                                <th className="p-4">Direction</th>
                      <th className="p-4">Item Tested</th>
                      <th className="p-4">Your Guess</th>
                      <th className="p-4 text-center">Time</th>
                      <th className="p-4 text-center">Result</th>
                                <th className="p-4 text-center">Sync</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-xs font-medium text-slate-300">
                    {resultsHistory.slice(0, 100).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-900/30 transition">
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
                          {item.intervalDirection ? (
                            <span className="capitalize text-[11px] text-slate-400 font-bold">
                              {item.intervalDirection.replace(/-/g, ' ')}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="p-4 font-bold text-cyan-400">{item.correctAnswer}</td>
                        <td className="p-4 text-slate-400">{item.userGuess}</td>
                        <td className="p-4 text-center text-slate-400 font-mono">
                          {item.responseTimeMs !== undefined ? `${(item.responseTimeMs / 1000).toFixed(1)}s` : '—'}
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
                            <span className="text-slate-600 inline-flex items-center" title="Local Only (Guest)">
                              <CloudOff className="h-4 w-4" />
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
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
              {activeTab === 'mnemonics' && (
                <MnemonicsLibrary />
              )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 px-6 py-8 flex flex-col items-center justify-center space-y-4 bg-slate-950/40 backdrop-blur-md">
        <div className="flex flex-col items-center space-y-2 text-center">
          <p className="text-[11px] text-slate-500 font-medium tracking-wide">
            A <a href="https://bervos.org" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-cyan-400 transition duration-200 font-bold">BERVOS</a> project • v{version}
          </p>
        </div>
      </footer>
      {/* Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel max-w-md w-full p-6 rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden animate-scaleIn">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-rose-500 to-amber-500" />
            
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-rose-500/10 p-2 rounded-xl border border-rose-500/20 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-white">Reset Log History?</h3>
            </div>

            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              You are about to delete <span className="text-rose-400 font-bold font-mono">{resultsHistory.length}</span> practice log{resultsHistory.length === 1 ? '' : 's'}. This action is permanent and cannot be undone.
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-900 border border-slate-800/60 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearHistory();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950/40 transition"
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
