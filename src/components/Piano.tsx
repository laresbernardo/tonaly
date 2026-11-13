import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ALL_NOTES,
  convertNoteToNomenclature,
  midiToNoteName,
  normalizeNoteName,
} from '../lib/music-theory/notes';
import { pianoSynth } from '../lib/music-theory/piano-synth';
import { useTheoryStore } from '../store/useTheoryStore';

interface PianoProps {
  activeNotes?: string[];
  rootNote?: string | null;
  correctNote?: string | null;
  correctNotes?: string[];
  incorrectNote?: string | null;
  arcInterval?: { from: string; to: string; label?: string } | null;
  interactive?: boolean;
  playAudioOnClick?: boolean;
  enableMidi?: boolean;
  compact?: boolean;
  caption?: string | null;
  onKeyClick?: (note: string) => void;
  customRange?: string[];
}

// Canonical black key suffix for each white note letter (matching ALL_NOTES: C#, Eb, F#, G#, Bb)
const BLACK_KEY_FOR_WHITE: Record<string, string> = {
  C: 'C#',
  D: 'Eb',
  F: 'F#',
  G: 'G#',
  A: 'Bb',
};

export const Piano: React.FC<PianoProps> = ({
  activeNotes = [],
  rootNote = null,
  correctNote = null,
  correctNotes = [],
  incorrectNote = null,
  arcInterval = null,
  interactive = true,
  playAudioOnClick = true,
  enableMidi = false,
  compact = false,
  caption = null,
  onKeyClick,
  customRange,
}) => {
  const { noteNomenclature } = useTheoryStore();
  const [pressedNotes, setPressedNotes] = useState<string[]>([]);

  // Friendly, uncluttered default range: C4 to C5 (or customRange)
  const pianoRange = useMemo(() => {
    if (customRange && customRange.length > 0) return customRange;
    const start = ALL_NOTES.indexOf('C4');
    const end = ALL_NOTES.indexOf('C5');
    return ALL_NOTES.slice(start, end + 1);
  }, [customRange]);

  const normalizedActive = useMemo(() => activeNotes.map(normalizeNoteName), [activeNotes]);
  const normalizedRoot = rootNote ? normalizeNoteName(rootNote) : null;
  const normalizedCorrectSet = useMemo(() => {
    const list = [...correctNotes];
    if (correctNote) list.push(correctNote);
    return new Set(list.map(normalizeNoteName));
  }, [correctNote, correctNotes]);
  const normalizedWrong = incorrectNote ? normalizeNoteName(incorrectNote) : null;

  const handleKeyStrike = useCallback(
    (rawNote: string) => {
      if (!interactive) return;
      const note = normalizeNoteName(rawNote);
      setPressedNotes((prev) => (prev.includes(note) ? prev : [...prev, note]));
      window.setTimeout(() => {
        setPressedNotes((prev) => prev.filter((n) => n !== note));
      }, 220);

      if (playAudioOnClick) {
        pianoSynth.playNote(note, 2.3);
      }
      if (onKeyClick) {
        onKeyClick(note);
      }
    },
    [interactive, playAudioOnClick, onKeyClick]
  );

  // Optional Web MIDI controller support for tactile hardware play
  useEffect(() => {
    if (!enableMidi || !interactive || typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      return;
    }

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    (navigator as Navigator & { requestMIDIAccess: () => Promise<MIDIAccess> })
      .requestMIDIAccess()
      .then((access) => {
        if (cancelled) return;
        access.inputs.forEach((input) => {
          const onMidi = (event: MIDIMessageEvent) => {
            const data = event.data;
            if (!data || data.length < 3) return;
            const status = data[0] & 0xf0;
            const midiNote = data[1];
            const velocity = data[2];
            if (status === 0x90 && velocity > 0) {
              const noteName = midiToNoteName(midiNote);
              if (noteName) handleKeyStrike(noteName);
            }
          };
          input.addEventListener('midimessage', onMidi);
          cleanups.push(() => input.removeEventListener('midimessage', onMidi));
        });
      })
      .catch(() => {
        // Ignore denied/unsupported MIDI silently
      });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [enableMidi, interactive, handleKeyStrike]);

  const isBlackKey = (note: string) => note.includes('#') || note.includes('b');
  const whiteNotes = useMemo(() => pianoRange.filter((n) => !isBlackKey(n)), [pianoRange]);

  // Compute clean horizontal percentage (0..100) for any note in pianoRange for the Interval Arc
  const getNoteHorizontalPercent = useCallback(
    (rawNote: string): number | null => {
      const note = normalizeNoteName(rawNote);
      if (!pianoRange.includes(note) || whiteNotes.length === 0) return null;

      if (!isBlackKey(note)) {
        const idx = whiteNotes.indexOf(note);
        if (idx === -1) return null;
        return ((idx + 0.5) / whiteNotes.length) * 100;
      }

      // Find preceding white key
      const allIdx = pianoRange.indexOf(note);
      const prevWhite = allIdx > 0 ? pianoRange[allIdx - 1] : null;
      if (!prevWhite) return null;
      const whiteIdx = whiteNotes.indexOf(prevWhite);
      if (whiteIdx === -1) return null;
      return ((whiteIdx + 1) / whiteNotes.length) * 100;
    },
    [pianoRange, whiteNotes]
  );

  const arcCoords = useMemo(() => {
    if (!arcInterval) return null;
    const x1 = getNoteHorizontalPercent(arcInterval.from);
    const x2 = getNoteHorizontalPercent(arcInterval.to);
    if (x1 === null || x2 === null) return null;
    return { x1, x2, label: arcInterval.label };
  }, [arcInterval, getNoteHorizontalPercent]);

  const heightClass = compact ? 'h-28 sm:h-32' : 'h-36 sm:h-44';
  const minWidthClass = whiteNotes.length > 12 ? 'min-w-[560px] sm:min-w-full' : 'min-w-[320px] w-full';

  return (
    <div className="flex flex-col items-center w-full">
      <div
        className={`relative w-full studio-inset ${
          compact ? 'p-3 sm:p-4 pt-6 sm:pt-7 rounded-2xl' : 'p-4 sm:p-5 rounded-3xl'
        } overflow-x-auto scrollbar-none select-none`}
      >
        <div className={`relative flex ${heightClass} ${minWidthClass}`}>
          {/* Visual Interval Arc Overlay (only shown when arcCoords is active) */}
          {arcCoords && (
            <svg
              viewBox="0 0 100 28"
              preserveAspectRatio="none"
              className="absolute -top-5 left-0 w-full h-7 pointer-events-none overflow-visible"
              style={{ zIndex: 4 }}
            >
              <defs>
                <linearGradient id="piano-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
              <path
                d={`M ${arcCoords.x1} 24 Q ${(arcCoords.x1 + arcCoords.x2) / 2} 2 ${arcCoords.x2} 24`}
                fill="none"
                stroke="url(#piano-arc-grad)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <circle cx={arcCoords.x1} cy={24} r="1.3" fill="#22d3ee" />
              <circle cx={arcCoords.x2} cy={24} r="1.3" fill="#34d399" />
            </svg>
          )}

          {/* 1. White Keys Render */}
          {whiteNotes.map((note, idx) => {
            const isPressed = pressedNotes.includes(note);
            const isActive = normalizedActive.includes(note);
            const isRoot = normalizedRoot === note;
            const isCorrect = normalizedCorrectSet.has(note);
            const isWrong = normalizedWrong === note;
            const isCNote = note.startsWith('C');

            let bgClass =
              'bg-gradient-to-b from-slate-100 to-slate-200/95 hover:from-white hover:to-slate-100 border-slate-300/80 border-b-[5px]';
            let textClass = isCNote ? 'text-slate-600' : 'text-slate-400';

            if (isCorrect) {
              bgClass =
                'bg-gradient-to-b from-emerald-300 to-emerald-500 border-emerald-600 shadow-[0_0_16px_rgba(16,185,129,0.32)] border-b-[3px]';
              textClass = 'text-slate-950 font-extrabold';
            } else if (isRoot) {
              bgClass =
                'bg-gradient-to-b from-cyan-300 to-cyan-500 border-cyan-600 shadow-[0_0_16px_rgba(34,211,238,0.32)] border-b-[3px]';
              textClass = 'text-slate-950 font-extrabold';
            } else if (isWrong) {
              bgClass =
                'bg-gradient-to-b from-rose-300 to-rose-500 border-rose-600 shadow-[0_0_14px_rgba(244,63,94,0.3)] border-b-[3px]';
              textClass = 'text-slate-950 font-extrabold';
            } else if (isActive || isPressed) {
              bgClass =
                'bg-gradient-to-b from-cyan-200 to-cyan-400 border-cyan-500 shadow-[0_0_14px_rgba(34,211,238,0.28)] border-b-[3px]';
              textClass = 'text-slate-950 font-extrabold';
            }

            const label = convertNoteToNomenclature(note, noteNomenclature);
            const shortLabel = isCNote || isCorrect || isRoot || isWrong
              ? label
              : label.replace(/[0-9]/g, '');

            return (
              <button
                key={note}
                type="button"
                aria-label={`Play ${label}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleKeyStrike(note);
                }}
                className={`flex-1 ${
                  idx < whiteNotes.length - 1 ? 'mr-[2px]' : ''
                } rounded-b-xl transition-all duration-100 flex items-end justify-center pb-2.5 sm:pb-3 font-mono text-[10px] sm:text-[11px] font-bold focus:outline-none piano-key-shadow ${
                  isPressed ? 'translate-y-[2px]' : ''
                } ${interactive ? 'cursor-pointer' : 'cursor-default'} ${bgClass} ${textClass}`}
                style={{ zIndex: 1 }}
              >
                <span className="tracking-tight">{shortLabel}</span>
              </button>
            );
          })}

          {/* 2. Black Keys Overlay */}
          <div
            className="absolute top-0 left-0 w-full h-[60%] flex pointer-events-none"
            style={{ zIndex: 2 }}
          >
            {whiteNotes.map((whiteNote, idx) => {
              const noteLetter = whiteNote.charAt(0);
              const octave = whiteNote.slice(-1);
              const blackPrefix = BLACK_KEY_FOR_WHITE[noteLetter];

              // Do not render an overhanging black key past the rightmost key of the range
              if (!blackPrefix || idx === whiteNotes.length - 1) {
                return <div key={`space-${whiteNote}`} className="flex-1 pointer-events-none" />;
              }

              const blackNote = `${blackPrefix}${octave}`;
              if (!pianoRange.includes(blackNote)) {
                return <div key={`space-${whiteNote}`} className="flex-1 pointer-events-none" />;
              }

              const isPressed = pressedNotes.includes(blackNote);
              const isActive = normalizedActive.includes(blackNote);
              const isRoot = normalizedRoot === blackNote;
              const isCorrect = normalizedCorrectSet.has(blackNote);
              const isWrong = normalizedWrong === blackNote;
              const showBadge = isCorrect || isRoot || isWrong || isActive;

              let bgClass =
                'bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-slate-950 border-b-[5px] border-x rounded-b-lg shadow-[0_5px_10px_rgba(0,0,0,0.55)] hover:from-slate-700 hover:to-slate-900';

              if (isCorrect) {
                bgClass =
                  'bg-gradient-to-b from-emerald-400 to-emerald-600 border-emerald-700 border-b-[3px] rounded-b-lg shadow-[0_0_14px_rgba(16,185,129,0.5)]';
              } else if (isRoot) {
                bgClass =
                  'bg-gradient-to-b from-cyan-400 to-cyan-600 border-cyan-700 border-b-[3px] rounded-b-lg shadow-[0_0_14px_rgba(34,211,238,0.5)]';
              } else if (isWrong) {
                bgClass =
                  'bg-gradient-to-b from-rose-400 to-rose-600 border-rose-700 border-b-[3px] rounded-b-lg shadow-[0_0_14px_rgba(244,63,94,0.5)]';
              } else if (isActive || isPressed) {
                bgClass =
                  'bg-gradient-to-b from-cyan-400 to-cyan-600 border-cyan-700 border-b-[3px] rounded-b-lg shadow-[0_0_12px_rgba(34,211,238,0.45)]';
              }

              const blackLabel = convertNoteToNomenclature(blackNote, noteNomenclature).replace(
                /[0-9]/g,
                ''
              );

              return (
                <div
                  key={`wrapper-${whiteNote}`}
                  className="flex-1 relative flex justify-end pointer-events-none"
                >
                  <button
                    type="button"
                    aria-label={`Play ${blackNote}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleKeyStrike(blackNote);
                    }}
                    className={`absolute right-0 w-[58%] h-full transition-all duration-100 pointer-events-auto focus:outline-none transform translate-x-1/2 flex items-end justify-center pb-1.5 ${
                      isPressed ? 'translate-y-[2px]' : ''
                    } ${interactive ? 'cursor-pointer' : 'cursor-default'} ${bgClass}`}
                  >
                    {showBadge && (
                      <span className="text-[9px] font-mono font-extrabold text-slate-950 leading-none tracking-tighter">
                        {blackLabel}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {caption && (
        <span className="text-[11px] text-slate-400 mt-2.5 font-medium tracking-wide select-none text-center">
          {caption}
        </span>
      )}
    </div>
  );
};

export default Piano;
