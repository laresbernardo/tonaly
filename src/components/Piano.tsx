import React from 'react';
import { ALL_NOTES } from '../lib/music-theory/notes';
import { pianoSynth } from '../lib/music-theory/piano-synth';

interface PianoProps {
  activeNotes?: string[];       // Notes currently highlighted (e.g., currently sounding)
  interactive?: boolean;        // If true, clicking keys makes sound and/or triggers callback
  onKeyClick?: (note: string) => void;
  correctNote?: string | null;  // For showing answers on the piano
  incorrectNote?: string | null;// For showing wrong guesses on the piano
}


export const Piano: React.FC<PianoProps> = ({
  activeNotes = [],
  interactive = true,
  onKeyClick,
  correctNote = null,
  incorrectNote = null
}) => {
  // Display notes from C4 to C5 for a standard visual center
  const pianoRange = ALL_NOTES.filter(note => /[4-5]/.test(note)).slice(3, 16); // C4 to C5 inclusive

  const handleKeyStrike = (note: string) => {
    if (!interactive) return;
    pianoSynth.playNote(note, 1.0);
    if (onKeyClick) {
      onKeyClick(note);
    }
  };

  // Helper to detect if note is sharp (black key)
  const isBlackKey = (note: string) => {
    return note.includes('#') || note.includes('b');
  };

  return (
    <div className="flex flex-col items-center w-full my-6">
      <div className="relative flex justify-center bg-slate-950 p-4 rounded-3xl border border-slate-800/80 shadow-2xl max-w-full overflow-x-auto select-none">
        <div className="relative flex h-48 sm:h-64 min-w-[320px] sm:min-w-[600px]">
          {/* 1. White Keys Render */}
          {pianoRange.filter(n => !isBlackKey(n)).map((note) => {
            const isActive = activeNotes.includes(note);
            const isCorrect = correctNote === note;
            const isWrong = incorrectNote === note;

            let bgClass = 'bg-white hover:bg-slate-100 active:bg-slate-200 border-slate-200';
            let textClass = 'text-slate-400';

            if (isCorrect) {
              bgClass = 'bg-emerald-500 border-emerald-600 shadow-inner';
              textClass = 'text-white';
            } else if (isWrong) {
              bgClass = 'bg-rose-500 border-rose-600 shadow-inner';
              textClass = 'text-white';
            } else if (isActive) {
              bgClass = 'bg-cyan-500 border-cyan-600 shadow-inner';
              textClass = 'text-white';
            }

            return (
              <button
                key={note}
                onClick={() => handleKeyStrike(note)}
                className={`flex-1 border-r border-b-8 rounded-b-lg transition duration-100 flex items-end justify-center pb-4 font-mono text-xs sm:text-sm font-bold uppercase focus:outline-none piano-key-shadow ${bgClass} ${textClass}`}
                style={{ zIndex: 1 }}
              >
                <span>{note.replace('4', '').replace('5', '')}</span>
              </button>
            );
          })}

          {/* 2. Black Keys Render Overlay */}
          <div className="absolute top-0 left-0 w-full h-3/5 flex pointer-events-none" style={{ zIndex: 2 }}>
            {pianoRange.filter(n => !isBlackKey(n)).map(whiteNote => {
              // Standard piano black keys offsets
              // Black keys exist between C-D, D-E, F-G, G-A, A-B
              const noteLetter = whiteNote.charAt(0);
              const octave = whiteNote.charAt(1);
              
              const hasBlackKey = ['C', 'D', 'F', 'G', 'A'].includes(noteLetter) && !(noteLetter === 'B');
              if (!hasBlackKey) {
                return <div key={`space-${whiteNote}`} className="flex-1 pointer-events-none" />;
              }

              // Map sharp notation
              const blackNote = `${noteLetter}#${octave}`;
              const isActive = activeNotes.includes(blackNote);
              const isCorrect = correctNote === blackNote;
              const isWrong = incorrectNote === blackNote;

              let bgClass = 'bg-slate-900 hover:bg-slate-800 active:bg-slate-700';

              if (isCorrect) {
                bgClass = 'bg-emerald-500 border-emerald-600';
              } else if (isWrong) {
                bgClass = 'bg-rose-500 border-rose-600';
              } else if (isActive) {
                bgClass = 'bg-cyan-500 border-cyan-600';
              }

              return (
                <div key={`wrapper-${whiteNote}`} className="flex-1 relative flex justify-end pointer-events-none">
                  <button
                    onClick={() => handleKeyStrike(blackNote)}
                    className={`absolute right-0 w-7 sm:w-10 h-full rounded-b-md border-b-4 border-x border-slate-950 transition duration-100 pointer-events-auto focus:outline-none ${bgClass}`}
                    style={{ 
                      transform: 'translateX(50%)', 
                      boxShadow: '0px 3px 5px rgba(0,0,0,0.5)'
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <span className="text-xs text-slate-500 mt-3 font-semibold tracking-wider uppercase">
        {interactive ? '👉 Click keys to test sounds' : '🎹 Played keys highlighted above'}
      </span>
    </div>
  );
};
export default Piano;
