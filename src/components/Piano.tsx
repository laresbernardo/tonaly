import React from 'react';
import { ALL_NOTES } from '../lib/music-theory/notes';
import { pianoSynth } from '../lib/music-theory/piano-synth';

interface PianoProps {
  activeNotes?: string[];       // Notes currently highlighted (e.g., currently sounding)
  interactive?: boolean;        // If true, clicking keys makes sound and/or triggers callback
  onKeyClick?: (note: string) => void;
  correctNote?: string | null;  // For showing answers on the piano
  incorrectNote?: string | null;// For showing wrong guesses on the piano
  customRange?: string[];       // Optional custom range of notes
}


export const Piano: React.FC<PianoProps> = ({
  activeNotes = [],
  interactive = true,
  onKeyClick,
  correctNote = null,
  incorrectNote = null,
  customRange
}) => {
  // Display notes from C4 to C5 for a standard visual center or use customRange
  const pianoRange = customRange || ALL_NOTES.filter(note => /[4-5]/.test(note)).slice(3, 16); // C4 to C5 inclusive

  const handleKeyStrike = (note: string) => {
    if (!interactive) return;
    pianoSynth.playNote(note, 2.5);
    if (onKeyClick) {
      onKeyClick(note);
    }
  };

  // Helper to detect if note is sharp (black key)
  const isBlackKey = (note: string) => {
    return note.includes('#') || note.includes('b');
  };

  return (
    <div className="flex flex-col items-center w-full my-4">
      {/* Sleek parent container with scrollbar hidden natively */}
      <div className="relative w-full bg-slate-950 p-5 rounded-3xl border border-slate-800/80 shadow-3xl overflow-x-auto scrollbar-none select-none">
        <div className="relative flex h-36 sm:h-44 min-w-[600px] lg:min-w-full">
          {/* 1. White Keys Render */}
          {pianoRange.filter(n => !isBlackKey(n)).map((note) => {
            const isActive = activeNotes.includes(note);
            const isCorrect = correctNote === note;
            const isWrong = incorrectNote === note;

            let bgClass = 'bg-gradient-to-b from-slate-50 to-slate-100 hover:from-white hover:to-slate-50 border-slate-200 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.05)] border-b-[6px] rounded-b-xl active:from-slate-100 active:to-slate-200';
            let textClass = 'text-slate-400';

            if (isCorrect) {
              bgClass = 'bg-gradient-to-b from-emerald-400 to-emerald-500 border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)] border-b-[4px] rounded-b-xl';
              textClass = 'text-white';
            } else if (isWrong) {
              bgClass = 'bg-gradient-to-b from-rose-400 to-rose-500 border-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.4)] border-b-[4px] rounded-b-xl';
              textClass = 'text-white';
            } else if (isActive) {
              bgClass = 'bg-gradient-to-b from-cyan-400 to-cyan-500 border-cyan-600 shadow-[0_0_15px_rgba(34,211,238,0.4)] border-b-[4px] rounded-b-xl';
              textClass = 'text-white';
            }

            return (
              <button
                key={note}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleKeyStrike(note);
                }}
                className={`flex-1 border-r transition duration-100 flex items-end justify-center pb-4 font-mono text-[10px] sm:text-xs font-bold uppercase focus:outline-none piano-key-shadow ${bgClass} ${textClass}`}
                style={{ zIndex: 1 }}
              >
                <span>{note.replace(/[0-9]/g, '')}</span>
              </button>
            );
          })}

          {/* 2. Black Keys Render Overlay */}
          <div className="absolute top-0 left-0 w-full h-[62%] flex pointer-events-none" style={{ zIndex: 2 }}>
            {pianoRange.filter(n => !isBlackKey(n)).map(whiteNote => {
              // Standard piano black keys offsets
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

              let bgClass = 'bg-gradient-to-b from-slate-900 to-slate-950 border-slate-950 border-b-[6px] border-x rounded-b-md shadow-[0_4px_6px_rgba(0,0,0,0.4)] hover:from-slate-850 hover:to-slate-900 active:from-slate-800';

              if (isCorrect) {
                bgClass = 'bg-gradient-to-b from-emerald-500 to-emerald-600 border-emerald-700 border-b-[4px] rounded-b-md shadow-[0_0_12px_rgba(16,185,129,0.5)]';
              } else if (isWrong) {
                bgClass = 'bg-gradient-to-b from-rose-500 to-rose-600 border-rose-700 border-b-[4px] rounded-b-md shadow-[0_0_12px_rgba(244,63,94,0.5)]';
              } else if (isActive) {
                bgClass = 'bg-gradient-to-b from-cyan-500 to-cyan-600 border-cyan-700 border-b-[4px] rounded-b-md shadow-[0_0_12px_rgba(34,211,238,0.5)]';
              }

              return (
                <div key={`wrapper-${whiteNote}`} className="flex-1 relative flex justify-end pointer-events-none">
                  <button
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleKeyStrike(blackNote);
                    }}
                    className={`absolute right-0 w-[55%] h-full transition duration-100 pointer-events-auto focus:outline-none transform translate-x-1/2 ${bgClass}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <span className="text-[10px] text-slate-500 mt-3 font-bold tracking-wider uppercase select-none flex items-center space-x-1">
        <span>👉</span> <span>Click keys to play audio and identify note/interval relations</span>
      </span>
    </div>
  );
};
export default Piano;
