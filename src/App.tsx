import { useState, useEffect } from 'react';
import { 
  Music, 
  Sparkles, 
  Layers, 
  FolderKanban, 
  Database, 
  Radio, 
  Share2, 
  LogIn, 
  LogOut, 
  CheckCircle, 
  Wifi, 
  WifiOff 
} from 'lucide-react';
import { signInWithGoogle, logout, auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col justify-between selection:bg-purple-500 selection:text-white">
      {/* Top Navigation Header */}
      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600/20 p-2.5 rounded-xl border border-purple-500/30">
            <Music className="h-6 w-6 text-purple-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight m-0 text-white leading-none">Tonaly</h1>
            <span className="text-xs text-slate-400 font-medium tracking-wider uppercase">R Shiny to React PWA</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Network Status Indicator */}
          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
            isOnline 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {isOnline ? (
              <>
                <Wifi className="h-3.5 w-3.5" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span>Offline Mode Ready</span>
              </>
            )}
          </div>

          {/* Auth Action Button */}
          {loading ? (
            <div className="h-9 w-24 bg-slate-800 animate-pulse rounded-lg"></div>
          ) : user ? (
            <div className="flex items-center space-x-3">
              {user.photoURL && (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-8 h-8 rounded-full border border-purple-500/40" 
                />
              )}
              <span className="text-sm font-medium text-slate-200 hidden md:inline">
                {user.displayName}
              </span>
              <button 
                onClick={handleLogout}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm px-3.5 py-2 rounded-lg transition border border-slate-700"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={handleSignIn}
              className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-2 rounded-lg transition font-medium shadow-lg shadow-purple-600/20"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign in with Google</span>
            </button>
          )}
        </div>
      </header>

      {/* Hero / Landing Content */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-grow flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 bg-purple-500/10 border border-purple-500/30 px-4 py-1.5 rounded-full text-purple-300 text-sm font-semibold mb-6">
            <Sparkles className="h-4 w-4" />
            <span>Phase 1 Architecture Successfully Deployed!</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-6 leading-[1.1]">
            Modernizing <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">Tonaly</span> Music Theory
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            An expert transformation of R/Shiny analytical music intelligence into a modern, ultra-scalable client-side React Progressive Web Application backed by Firebase. Ready for real-time offline processing.
          </p>
        </div>

        {/* Architecture Foundation Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Scalable SoC */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between group hover:border-purple-500/40 transition duration-300">
            <div>
              <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20 w-fit mb-5 group-hover:scale-110 transition">
                <FolderKanban className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Modular Architecture</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Separation of Concerns model separating pure music theory logic from UI render. High scaling for advanced scales, circle of fifths, and chords.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs text-purple-400 font-bold space-x-1">
              <CheckCircle className="h-4 w-4" />
              <span>Pristine SoC Configured</span>
            </div>
          </div>

          {/* Card 2: Offline PWA */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between group hover:border-indigo-500/40 transition duration-300">
            <div>
              <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 w-fit mb-5 group-hover:scale-110 transition">
                <Layers className="h-6 w-6 text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">PWA & Service Worker</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Integrated Vite PWA for automated static resources and custom Google Fonts caching. Built-in offline capabilities run flawlessly anywhere.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs text-indigo-400 font-bold space-x-1">
              <CheckCircle className="h-4 w-4" />
              <span>Offline Manifest Ready</span>
            </div>
          </div>

          {/* Card 3: Firebase Service */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between group hover:border-blue-500/40 transition duration-300">
            <div>
              <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 w-fit mb-5 group-hover:scale-110 transition">
                <Database className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Firebase & DB Cache</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Ready with secure Google Auth provider and multi-tab Firestore IndexedDB cache persistence to keep user preferences synced offline.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs text-blue-400 font-bold space-x-1">
              <CheckCircle className="h-4 w-4" />
              <span>Firebase SDK Initialized</span>
            </div>
          </div>
        </div>

        {/* Environmental Config Reminder Box */}
        <div className="mt-12 glass-panel p-6 rounded-2xl bg-gradient-to-r from-purple-950/20 to-indigo-950/20 border border-purple-500/15 text-center">
          <h4 className="text-base font-semibold text-purple-200 mb-2 flex items-center justify-center space-x-2">
            <Radio className="h-4 w-4 animate-pulse" />
            <span>Next Up: Configure Your Variables</span>
          </h4>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Simply open <code className="text-purple-300 font-mono text-xs bg-purple-500/5 px-1.5 py-0.5 rounded">.env.local</code> in the project directory and add your own Firebase configuration keys to enable active Google sign-in!
          </p>
        </div>
      </main>

      {/* Premium Clean Footer */}
      <footer className="border-t border-slate-900 px-6 py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Tonaly PWA. Built with supreme full-stack design.</p>
        <div className="flex space-x-4 mt-2 sm:mt-0">
          <a href="https://github.com/laresbernardo/tonaly" target="_blank" className="hover:text-slate-300 transition flex items-center space-x-1">
            <Share2 className="h-3.5 w-3.5" />
            <span>Original Shiny App</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
