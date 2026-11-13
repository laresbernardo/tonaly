import React, { useState } from 'react';
import {
  LogIn,
  Activity,
  Award,
  CheckCircle,
  BookmarkCheck,
  Play,
  Volume2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import Piano from './Piano';
import { ALL_NOTES, getNoteFrequency } from '../lib/music-theory/notes';
import { INTERVAL_MAP } from '../lib/music-theory/intervals';
import { pianoSynth, TIMBRE_LABELS, type SynthTimbre } from '../lib/music-theory/piano-synth';
import { useTheoryStore } from '../store/useTheoryStore';

interface LandingPageProps {
  onPlayAsGuest: () => void;
  onSignIn: () => void;
  user: User | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onPlayAsGuest,
  onSignIn,
  user,
}) => {
  const { timbre, setTimbre } = useTheoryStore();
  const [lastClickedNote, setLastClickedNote] = useState<string | null>(null);
  const [prevClickedNote, setPrevClickedNote] = useState<string | null>(null);

  const customPianoRange = ALL_NOTES.slice(
    ALL_NOTES.indexOf('F3'),
    ALL_NOTES.indexOf('C6') + 1
  );

  let identifiedInterval = '';
  let intervalSemitones = 0;
  let intervalAbbr = '';

  if (lastClickedNote && prevClickedNote) {
    const indexPrev = ALL_NOTES.indexOf(prevClickedNote);
    const indexLast = ALL_NOTES.indexOf(lastClickedNote);
    if (indexPrev !== -1 && indexLast !== -1) {
      intervalSemitones = Math.abs(indexLast - indexPrev);
      const match = INTERVAL_MAP.find((item) => item.semitones === intervalSemitones);
      if (match) {
        identifiedInterval = match.name;
        intervalAbbr = match.abbreviation;
      }
    }
  }

  return (
    <div className="space-y-14 md:space-y-20 py-4 md:py-10 max-w-6xl mx-auto animate-fadeIn">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center gap-8 md:gap-10 text-center">
        <div className="max-w-3xl space-y-5">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08] text-white">
            Train Your Musical Ear. <br />
            <span className="text-cyan-400">Feel Every Interval & Chord.</span>
          </h1>

          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto font-normal leading-relaxed px-2">
            An interactive ear-training studio built for musicians, producers, and curious listeners. Master notes, melodic & harmonic intervals, and chord qualities with tactile instruments, live streaks, and adaptive practice.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 px-4 sm:px-0 w-full max-w-md mx-auto">
            {user ? (
              <button
                type="button"
                onClick={onPlayAsGuest}
                className="w-full sm:w-auto flex items-center justify-center space-x-2.5 bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm transition shadow-xl shadow-cyan-950/50 hover:-translate-y-0.5 duration-200 tracking-wider uppercase cursor-pointer"
              >
                <Play className="h-4 w-4 fill-white" />
                <span>Enter Studio Arena</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onPlayAsGuest}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white px-7 py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm transition shadow-xl shadow-cyan-950/50 hover:-translate-y-0.5 duration-200 tracking-wider uppercase cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>Start Playing</span>
                </button>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 px-7 py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm transition hover:-translate-y-0.5 duration-200 tracking-wider uppercase cursor-pointer"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Studio Console Showcase */}
        <div className="w-full max-w-4xl glass-panel p-4 sm:p-6 rounded-3xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center space-x-2.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-xs font-bold text-slate-200 tracking-wider uppercase">
                Interactive Studio Console
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 select-none">
              <div className="flex bg-slate-950/90 p-0.5 rounded-lg border border-slate-800/80">
                {(Object.keys(TIMBRE_LABELS) as SynthTimbre[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimbre(t)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                      timbre === t ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {TIMBRE_LABELS[t].split(' ')[1] || TIMBRE_LABELS[t]}
                  </button>
                ))}
              </div>
              {lastClickedNote && (
                <button
                  type="button"
                  onClick={() => {
                    setLastClickedNote(null);
                    setPrevClickedNote(null);
                  }}
                  className="text-[10px] text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800/80 transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <Piano
            interactive={true}
            enableMidi={true}
            customRange={customPianoRange}
            rootNote={prevClickedNote}
            correctNote={lastClickedNote}
            arcInterval={
              prevClickedNote && lastClickedNote
                ? { from: prevClickedNote, to: lastClickedNote, label: intervalAbbr }
                : null
            }
            onKeyClick={(note) => {
              if (prevClickedNote && lastClickedNote) {
                setPrevClickedNote(null);
                setLastClickedNote(note);
              } else if (lastClickedNote) {
                setPrevClickedNote(lastClickedNote);
                setLastClickedNote(note);
              } else {
                setLastClickedNote(note);
              }
            }}
          />

          {/* Interactive Identifier Display Block */}
          <div className="mt-4 studio-inset rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            {!lastClickedNote ? (
              <p className="text-slate-400 text-xs font-medium mx-auto md:mx-0">
                Tap any two keys above (or play a connected MIDI keyboard) to hear studio timbres and inspect exact intervals.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 w-full md:w-auto">
                  {prevClickedNote && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        First Pitch
                      </span>
                      <div className="text-base font-extrabold text-cyan-300 bg-cyan-950/30 border border-cyan-800/40 px-3.5 py-1.5 rounded-xl font-mono">
                        {prevClickedNote}
                      </div>
                    </div>
                  )}

                  {prevClickedNote && <div className="text-slate-500 font-bold text-base">→</div>}

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {prevClickedNote ? 'Second Pitch' : 'Pitch Played'}
                    </span>
                    <div className="text-base font-extrabold text-emerald-300 bg-emerald-950/30 border border-emerald-800/40 px-3.5 py-1.5 rounded-xl font-mono">
                      {lastClickedNote}{' '}
                      <span className="text-[11px] font-normal text-slate-400">
                        ({getNoteFrequency(lastClickedNote).toFixed(1)} Hz)
                      </span>
                    </div>
                  </div>
                </div>

                {identifiedInterval ? (
                  <div className="flex items-center gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl px-4 py-3 text-left">
                    <div>
                      <div className="flex items-center space-x-2 mb-0.5">
                        <span className="text-xs font-black text-white uppercase tracking-wide">
                          {identifiedInterval}
                        </span>
                        <span className="text-[10px] font-mono bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 px-1.5 py-0.5 rounded">
                          {intervalAbbr} • {intervalSemitones} st
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Replay together or melodically to lock in the color.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        prevClickedNote &&
                        lastClickedNote &&
                        pianoSynth.playInterval(prevClickedNote, lastClickedNote, 'harmonic')
                      }
                      title="Play harmonic interval"
                      className="p-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 transition cursor-pointer shrink-0"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs py-1 max-w-xs text-center md:text-right">
                    Strike a <strong>second key</strong> to measure the exact musical interval between them.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-3xl space-y-3">
          <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">01 / Modalities</span>
          <h3 className="text-base font-bold text-white">Notes, Intervals & Chords</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Train single-note pitch recognition, melodic & harmonic intervals, and 10 chord qualities over optional root drones in four studio timbres.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-3xl space-y-3">
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">02 / Arcade & Flow</span>
          <h3 className="text-base font-bold text-white">Zen, 60s Blitz & Survival</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Practice at your own pace with A/B mistake comparisons and visual keyboard arcs, or test your reflexes in 60-second Blitz and Sudden-Death Survival.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-3xl space-y-3">
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">03 / Adaptive Ear</span>
          <h3 className="text-base font-bold text-white">Smart Weakness Targeting</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Response speeds and accuracy trends automatically spotlight tricky intervals and chords so Adaptive Mode can drill what matters most.
          </p>
        </div>
      </section>

      {/* Local + Cloud Persistence Comparison */}
      <section className="glass-panel rounded-3xl p-6 sm:p-8 md:p-10">
        <div className="max-w-2xl space-y-2 mb-8">
          <h2 className="text-2xl font-black text-white">Instant Play, Seamless Sync</h2>
          <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
            Jump straight into the studio with automatic local browser saves, or connect Google to sync your streaks, custom mnemonics, and analytics across every device.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="studio-inset p-6 rounded-2xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 bg-slate-800/80 px-3 py-1 rounded-full">
                  Local Studio
                </span>
                <span className="text-[11px] text-slate-500 font-mono">Saved in Browser</span>
              </div>
              <h3 className="text-lg font-bold text-white">Instant Guest Access</h3>
              <div className="space-y-2.5 pt-1">
                <div className="flex items-start space-x-2 text-slate-300 text-xs">
                  <CheckCircle className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Full access to Notes, Intervals, Chords, Blitz & Survival</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300 text-xs">
                  <CheckCircle className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Local browser persistence—reloading won't erase your session</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onPlayAsGuest}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 py-3 rounded-xl font-bold text-xs transition uppercase tracking-wider cursor-pointer"
            >
              Launch Local Studio
            </button>
          </div>

          <div className="studio-inset p-6 rounded-2xl border-cyan-500/20 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center space-x-1.5 text-cyan-300 bg-cyan-500/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                  <Activity className="h-3.5 w-3.5" />
                  <span>Cloud Account</span>
                </span>
                <span className="text-[11px] text-cyan-400 font-mono">Cross-Device Sync</span>
              </div>
              <h3 className="text-lg font-bold text-white">Lifelong Cloud Backup</h3>
              <div className="space-y-2.5 pt-1">
                <div className="flex items-start space-x-2 text-slate-300 text-xs">
                  <BookmarkCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Automatic migration of any guest practice history on sign-in</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300 text-xs">
                  <Award className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Sync custom mnemonics, high scores, and analytics everywhere</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onSignIn}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-xl font-extrabold text-xs transition shadow-lg shadow-cyan-950/40 uppercase tracking-wider cursor-pointer"
            >
              Sign In with Google
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
