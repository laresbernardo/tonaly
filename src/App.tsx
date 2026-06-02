import { useState, useEffect, useMemo } from 'react';
import { version } from '../package.json';
import { 
  Music, 
  LogIn, 
  LogOut, 
  Play,
  Volume2,
  History,
  Settings,
  Trophy,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { signInWithGoogle, logout, auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { useTheoryStore } from './store/useTheoryStore';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import LandingPage from './components/LandingPage';
import { ALL_NOTES } from './lib/music-theory/notes';
import { INTERVAL_MAP } from './lib/music-theory/intervals';

// Helper to parse simple markdown double asterisks **bold** into JSX strong tags
const renderBoldText = (text: string) => {
  if (!text) return null;
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          return <strong key={index} className="font-bold text-cyan-400">{part}</strong>;
        }
        return part;
      })}
    </>
  );
};

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

function App() {
  // Determine initial view state from the browser URL path
  const getInitialStateFromPath = () => {
    const path = window.location.pathname;
    if (path === '/arena') return { inStudio: true, tab: 'training' as const };
    if (path === '/insights') return { inStudio: true, tab: 'analytics' as const };
    if (path === '/data') return { inStudio: true, tab: 'history' as const };
    return { inStudio: false, tab: 'training' as const };
  };

  const initialState = getInitialStateFromPath();

  // Auth and environment state
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'training' | 'analytics' | 'history'>(initialState.tab);
  const [inStudio, setInStudio] = useState(initialState.inStudio);

  // Sync state changes back to the browser's address bar URL path
  useEffect(() => {
    let targetPath = '/';
    if (inStudio) {
      if (activeTab === 'training') targetPath = '/arena';
      else if (activeTab === 'analytics') targetPath = '/insights';
      else if (activeTab === 'history') targetPath = '/data';
    }
    
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }, [inStudio, activeTab]);

  // Handle browser Back/Forward button clicks (popstate events)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/arena') {
        setInStudio(true);
        setActiveTab('training');
      } else if (path === '/insights') {
        setInStudio(true);
        setActiveTab('analytics');
      } else if (path === '/data') {
        setInStudio(true);
        setActiveTab('history');
      } else {
        setInStudio(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Zustand Global Ear Training States
  const {
    gameMode,
    difficulty,
    customNotes,
    customIntervals,
    logResults,
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
    generateNewTest,
    rehearTest,
    submitGuess,
    loadHistory,
    clearHistory,
    deleteHistoryItem
  } = useTheoryStore();

  // Local UI toggle for "Custom configuration" drawer
  const [showCustomConfig, setShowCustomConfig] = useState(false);

  // Auth subscriber and history loader
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      loadHistory(currentUser ? currentUser.uid : null);
      if (currentUser) {
        setInStudio(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadHistory]);

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
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col justify-between selection:bg-cyan-500 selection:text-white relative">
      {/* Aurora Glowing Background Mesh */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-cyan-950/25 blur-[130px] pointer-events-none" />
        <div className="absolute -bottom-[30%] -right-[10%] w-[70%] h-[70%] rounded-full bg-orange-950/10 blur-[130px] pointer-events-none" />
        <div className="absolute top-[40%] left-[30%] w-[45%] h-[45%] rounded-full bg-blue-950/10 blur-[120px] pointer-events-none" />
      </div>
      {/* Header */}
      <header className="glass-panel sticky top-0 z-50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <div 
          onClick={() => setInStudio(false)} 
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
                className="flex items-center space-x-1.5 bg-slate-900/85 hover:bg-rose-950/25 text-slate-300 hover:text-rose-400 text-xs px-3 py-2 rounded-lg transition border border-slate-800 hover:border-rose-950/30 group font-semibold animate-fadeIn"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-500/80 group-hover:text-rose-400 transition" />
                <span className="hidden sm:inline">Sign Out</span>
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
                <h2 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
                  <Settings className="h-5 w-5 text-cyan-400" />
                  <span>Configuration</span>
                </h2>

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
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/60 mb-4">
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <Volume2 className="h-5 w-5 text-cyan-400" />
                    <span>Arena</span>
                  </h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={rehearTest}
                      disabled={!testActive}
                      className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-slate-300 text-xs px-3 py-2 rounded-lg border border-slate-800 font-bold transition"
                    >
                      <Volume2 className="h-4 w-4 text-cyan-400" />
                      <span>Repeat [R]</span>
                    </button>
                    <button
                      onClick={generateNewTest}
                      className="flex items-center space-x-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-lg shadow-cyan-600/20 transition"
                    >
                      <Play className="h-4 w-4 text-white" />
                      <span>New Test [Space]</span>
                    </button>
                  </div>
                </div>

                {/* Large Visual Stage */}
                <div className="min-h-[120px] flex flex-col items-center justify-center text-center p-6 bg-slate-950/60 rounded-2xl border border-slate-900 my-4">
                  {!testActive ? (
                    <div className="space-y-2">
                      <Music className="h-10 w-10 text-cyan-500/50 mx-auto" />
                      <h3 className="text-lg font-bold text-slate-300">Ready to Start?</h3>
                      <p className="text-xs text-slate-400 max-w-md">
                        {renderBoldText("Click **New Test** (or press the **Spacebar**) to play a randomized musical ear training test")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {hasAnswered ? (
                        <div className="space-y-2 animate-fadeIn">
                          <div className="inline-flex items-center justify-center">
                            {isCorrect ? (
                              <span className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-extrabold px-4 py-1.5 rounded-full text-xs uppercase tracking-widest">
                                🎉 Correct Answer!
                              </span>
                            ) : (
                              <span className="bg-rose-500/10 border border-rose-500/40 text-rose-400 font-extrabold px-4 py-1.5 rounded-full text-xs uppercase tracking-widest">
                                ❌ Incorrect Guess
                              </span>
                            )}
                          </div>
                          <h3 className="text-2xl font-black text-white">
                            Answer: <span className="text-cyan-400">{currentTest?.correctAnswer}</span>
                          </h3>
                          {gameMode === 'Interval Identification' && currentTest && (
                            <p className="text-xs text-slate-400">
                              {renderBoldText(`Played **${currentTest.baseNote}** then **${currentTest.targetNote}**`)}
                            </p>
                          )}
                        </div>
                        ) : (
                          <div className="space-y-1">
                            <h3 className="text-lg font-bold text-cyan-300">
                              What {gameMode === 'Note Identification' ? 'note' : 'interval'} did you hear?
                            </h3>
                            <p className="text-xs text-slate-400">
                              Make your guess using the buttons below!
                            </p>
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
              <div className="text-xs text-slate-400">
                Logged practice sessions aggregated in real time
              </div>
            </div>

            <AnalyticsDashboard history={resultsHistory} />
          </div>
        )}

        {/* TAB 3: SESSION LOG TABLE */}
        {activeTab === 'history' && (
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/60">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-4 mb-6">
              <h2 className="text-lg font-black text-white flex items-center space-x-2">
                <History className="h-5 w-5 text-cyan-400" />
                <span>Session Log History</span>
              </h2>
              <button
                onClick={clearHistory}
                className="flex items-center space-x-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs px-3.5 py-2 rounded-lg font-bold transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Log</span>
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
                      <th className="p-4">Item Tested</th>
                      <th className="p-4">Your Guess</th>
                      <th className="p-4 text-center">Result</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-xs font-medium text-slate-300">
                    {resultsHistory.map((item) => (
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
                        <td className="p-4 font-bold text-cyan-400">{item.correctAnswer}</td>
                        <td className="p-4 text-slate-400">{item.userGuess}</td>
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
    </div>
  );
}

export default App;
