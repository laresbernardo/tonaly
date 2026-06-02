import React, { useState } from 'react';
import {
  LogIn,
  Sparkles,
  ShieldAlert,
  Activity,
  Award,
  CheckCircle,
  BookmarkCheck,
  Play
} from 'lucide-react';
import Piano from './Piano';
import { ALL_NOTES } from '../lib/music-theory/notes';
import { INTERVAL_MAP } from '../lib/music-theory/intervals';

interface LandingPageProps {
  onPlayAsGuest: () => void;
  onSignIn: () => void;
  user: any; // Current Firebase User
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onPlayAsGuest,
  onSignIn,
  user
}) => {
  const [lastClickedNote, setLastClickedNote] = useState<string | null>(null);
  const [prevClickedNote, setPrevClickedNote] = useState<string | null>(null);

  // Determine wide piano note pool: F3 to C6 inclusive
  const customPianoRange = ALL_NOTES.slice(
    ALL_NOTES.indexOf("F3"),
    ALL_NOTES.indexOf("C6") + 1
  );

  // Identify interval if both notes are set
  let identifiedInterval = '';
  let intervalSemitones = 0;
  let intervalAbbr = '';
  
  if (lastClickedNote && prevClickedNote) {
    const indexPrev = ALL_NOTES.indexOf(prevClickedNote);
    const indexLast = ALL_NOTES.indexOf(lastClickedNote);
    intervalSemitones = Math.abs(indexLast - indexPrev);
    const match = INTERVAL_MAP.find(item => item.semitones === intervalSemitones);
    if (match) {
      identifiedInterval = match.name;
      intervalAbbr = match.abbreviation;
    }
  }

  return (
    <div className="space-y-16 py-6 md:py-12 max-w-6xl mx-auto animate-fadeIn">

      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center gap-12 text-center">
        {/* Glow Orbs specific to Hero */}
        <div className="absolute -top-10 -left-10 w-72 h-72 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-orange-500/5 blur-[140px] pointer-events-none" />

        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-[11px] font-bold uppercase tracking-widest">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span>Next-Gen Ear Training Studio</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight text-white animate-fadeIn">
            Master Your Pitch. <br />
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              Elevate Your Hearing.
            </span>
          </h1>

          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto font-medium leading-relaxed">
            Tonaly is an immersive ear training studio designed for musicians and audiophiles. Develop absolute note recognition, master relative intervals, and unlock deep performance insights.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {user ? (
              <button
                onClick={onPlayAsGuest}
                className="w-full sm:w-auto flex items-center justify-center space-x-2.5 bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-4 rounded-2xl font-extrabold text-sm transition shadow-xl shadow-cyan-600/25 hover:-translate-y-0.5 duration-200 tracking-wider uppercase"
              >
                <Play className="h-4 w-4 fill-white" />
                <span>Enter Arena</span>
              </button>
            ) : (
              <>
                <button
                  onClick={onPlayAsGuest}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 px-8 py-4 rounded-2xl font-extrabold text-sm transition hover:-translate-y-0.5 duration-200 tracking-wider uppercase"
                >
                  <span>Play as Guest</span>
                </button>
                <button
                  onClick={onSignIn}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2.5 bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-4 rounded-2xl font-extrabold text-sm transition shadow-xl shadow-cyan-600/25 hover:-translate-y-0.5 duration-200 tracking-wider uppercase"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Wide Piano Embed Showcase */}
        <div className="w-full max-w-4xl glass-panel p-6 rounded-3xl border border-slate-800/60 shadow-3xl relative group hover:border-cyan-500/20 transition duration-300">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-3xl opacity-5 blur-[10px] group-hover:opacity-10 transition duration-300 pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Live Studio Console</span>
            </div>
            
            <div className="flex items-center space-x-3 select-none">
              <button 
                onClick={() => {
                  setLastClickedNote(null);
                  setPrevClickedNote(null);
                }}
                className="text-[10px] text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 px-2.5 py-1 rounded border border-slate-800/80 transition"
              >
                Reset Console
              </button>
              <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-md">Interval & Pitch Identifier</span>
            </div>
          </div>

          {/* Piano component rendered with wide range F3-C6 and click listener */}
          <Piano 
            interactive={true} 
            customRange={customPianoRange}
            onKeyClick={(note) => {
              if (prevClickedNote && lastClickedNote) {
                // Cycle Reset: third click clears prev note and sets current note as the new first note
                setPrevClickedNote(null);
                setLastClickedNote(note);
              } else if (lastClickedNote) {
                // Second click: set first note as prev and current note as last
                setPrevClickedNote(lastClickedNote);
                setLastClickedNote(note);
              } else {
                // First click: set last note
                setLastClickedNote(note);
              }
            }}
            activeNotes={lastClickedNote ? (prevClickedNote ? [prevClickedNote, lastClickedNote] : [lastClickedNote]) : []}
          />

          {/* Interactive Identifier Display Block */}
          <div className="mt-6 bg-slate-950/80 border border-slate-900 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 text-left animate-fadeIn">
            {!lastClickedNote ? (
              <div className="flex items-center space-x-3 py-2 text-slate-400 text-xs font-medium mx-auto">
                <span>🎹</span>
                <span>Strike keys on the virtual console above to identify note names, frequency pitches, and sequential intervals in real time!</span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-6">
                  {prevClickedNote && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">First Note</span>
                      <div className="text-lg font-extrabold text-slate-300 bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-xl">
                        {prevClickedNote}
                      </div>
                    </div>
                  )}
                  
                  {prevClickedNote && (
                    <div className="text-cyan-500 font-bold text-lg animate-pulse">➔</div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {prevClickedNote ? "Second Note (Latest)" : "Note Played"}
                    </span>
                    <div className="text-lg font-extrabold text-cyan-400 bg-cyan-950/20 border border-cyan-900/40 px-3.5 py-1.5 rounded-xl">
                      {lastClickedNote}
                    </div>
                  </div>
                </div>

                {identifiedInterval ? (
                  <div className="bg-gradient-to-r from-cyan-950/25 to-purple-950/10 border border-cyan-900/40 rounded-2xl p-4 max-w-md shrink-0 animate-fadeIn">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-black text-cyan-300 tracking-wide uppercase">{identifiedInterval}</span>
                      <span className="text-[9px] font-mono bg-purple-950/60 border border-purple-800/40 text-purple-300 px-1.5 py-0.5 rounded">
                        {intervalAbbr}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      The pitch distance between <strong className="text-slate-300">{prevClickedNote}</strong> and <strong className="text-slate-300">{lastClickedNote}</strong> measures exactly <strong className="text-cyan-400">{intervalSemitones} semitones</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs py-2 max-w-sm">
                    👉 <strong>Click a second key</strong> on the console above to calculate and view the exact musical interval between them!
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-black text-white">Robust Training Modalities</h2>
          <p className="text-slate-400 text-xs md:text-sm max-w-md mx-auto">
            Unlock key cognitive milestones designed to strengthen your absolute and relative musical pitch perception.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/60 flex flex-col space-y-4 hover:border-cyan-500/30 transition duration-300 group">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-lg">
              I
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition">Absolute Pitch Arena</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Develop absolute ear recognition. Train to identify single pitches (C4, F#5, Bb3) without reference notes. Customize your active note pools.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/60 flex flex-col space-y-4 hover:border-cyan-500/30 transition duration-300 group">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg">
              II
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-purple-400 transition">Interval Arena</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Master relative pitch recognition. Listen to sequential notes and identify intervals from minor seconds up to major double octaves.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800/60 flex flex-col space-y-4 hover:border-cyan-500/30 transition duration-300 group">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-lg">
              III
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-orange-400 transition">Performance Insights</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Unlock detailed heatmaps, overall response times, and error statistics. Pinpoint specific notes or intervals that slow down your workflow.
            </p>
          </div>
        </div>
      </section>

      {/* Session Persistence & Gating comparison (The core requirement) */}
      <section className="glass-panel rounded-3xl border border-slate-800/60 p-8 md:p-10 overflow-hidden relative">
        <div className="absolute -right-10 -top-10 w-80 h-80 rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-80 h-80 rounded-full bg-orange-500/5 blur-[100px] pointer-events-none" />

        <div className="max-w-2xl space-y-3 mb-10">
          <h2 className="text-2xl md:text-3xl font-black text-white">Data Persistence Architecture</h2>
          <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
            We believe in instant exploration. Test drive the app instantly as a guest, or connect your account to preserve your lifelong analytical gains. Here is how data behaves on both paths:
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Path 1: Guest Sandbox */}
          <div className="bg-slate-950/70 border border-slate-900 p-6 sm:p-8 rounded-2xl flex flex-col justify-between space-y-6 relative">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center space-x-1.5 text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-orange-500/20">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Guest Session</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">In-Memory Sandbox</span>
              </div>

              <h3 className="text-lg font-bold text-white">Free Anonymous Sandbox</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Instantly play note tests, practice ears, aggregate charts, and view session history tables with zero signup forms.
              </p>

              <div className="space-y-2.5 pt-2">
                <div className="flex items-start space-x-2 text-slate-300 text-xs">
                  <CheckCircle className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Complete training console access</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300 text-xs">
                  <CheckCircle className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Real-time stats, insights, and logs</span>
                </div>
                <div className="flex items-start space-x-2 text-orange-300 bg-orange-500/5 border border-orange-500/10 p-2.5 rounded-xl text-xs">
                  <ShieldAlert className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Notice:</strong> Refreshing the browser or leaving the tab completely purges your logs. Progress starts from scratch.
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onPlayAsGuest}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 py-3.5 rounded-xl font-bold text-xs transition duration-200 tracking-wider uppercase"
            >
              Play as Guest
            </button>
          </div>

          {/* Path 2: Signed-In */}
          <div className="bg-slate-950/70 border border-cyan-500/20 p-6 sm:p-8 rounded-2xl flex flex-col justify-between space-y-6 shadow-xl shadow-cyan-950/10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center space-x-1.5 text-cyan-300 bg-cyan-500/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-cyan-500/20">
                  <Activity className="h-3.5 w-3.5" />
                  <span>Persistent Cloud Storage</span>
                </div>
                <span className="text-[11px] text-cyan-400 font-mono">Sync Active</span>
              </div>

              <h3 className="text-lg font-bold text-white">Cloud Synced Account</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Log in securely with your Google Account to back up all training records to our Firestore cloud database.
              </p>

              <div className="space-y-2.5 pt-2">
                <div className="flex items-start space-x-2 text-slate-300 text-xs">
                  <BookmarkCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Lifelong preservation of accuracy trends</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300 text-xs">
                  <BookmarkCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Cross-device sync (desktop, mobile, tablet)</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300 text-xs">
                  <BookmarkCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Build historic training benchmarks and heatmaps</span>
                </div>
                <div className="flex items-start space-x-2 text-emerald-300 bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-xl text-xs">
                  <Award className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Reliable Sync:</strong> Close tabs and refresh at will. Your analytics dashboard will safely persist.
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onSignIn}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3.5 rounded-xl font-extrabold text-xs transition shadow-lg shadow-cyan-600/20 duration-200 tracking-wider uppercase"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
export default LandingPage;
