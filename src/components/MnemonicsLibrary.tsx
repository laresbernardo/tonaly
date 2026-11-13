import { useState } from 'react';
import { ALL_NOTES, convertNoteToNomenclature } from '../lib/music-theory/notes';
import { INTERVAL_MAP } from '../lib/music-theory/intervals';
import { CHORD_MAP } from '../lib/music-theory/chords';
import MnemonicEditor from './MnemonicEditor';
import { BookOpen, Volume2 } from 'lucide-react';
import { useTheoryStore } from '../store/useTheoryStore';

export default function MnemonicsLibrary() {
  const { noteNomenclature, playPreviewItem } = useTheoryStore();
  const [category, setCategory] = useState<'intervals' | 'chords' | 'notes'>('intervals');

  const commonNotes = ALL_NOTES.slice(ALL_NOTES.indexOf('C4'), ALL_NOTES.indexOf('B5') + 1);
  const commonIntervals = INTERVAL_MAP.slice(0, 13);

  return (
    <div className="glass-panel p-6 rounded-3xl animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-4 mb-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-black text-white">Sonic Memory Anchors</h2>
          </div>
          <p className="text-xs text-slate-400">
            Tap any speaker icon to preview the sound and customize up to 5 personal song cues.
          </p>
        </div>

        <div className="flex studio-inset p-1 rounded-xl self-start sm:self-auto">
          {(['intervals', 'chords', 'notes'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setCategory(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition cursor-pointer ${
                category === tab ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {category === 'intervals' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
          {commonIntervals.map((interval) => (
            <div
              key={interval.name}
              className="studio-inset rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-slate-700/80 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-slate-100 text-sm truncate">{interval.name}</span>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-1.5 py-0.5 rounded shrink-0">
                    {interval.abbreviation} • {interval.semitones}st
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => playPreviewItem(interval.name, 'Interval Identification')}
                  title={`Play ${interval.name}`}
                  className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition cursor-pointer shrink-0"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
              <MnemonicEditor itemName={interval.name} defaultOpen={true} />
            </div>
          ))}
        </div>
      )}

      {category === 'chords' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
          {CHORD_MAP.map((chord) => (
            <div
              key={chord.name}
              className="studio-inset rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-slate-700/80 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-sm">{chord.name}</span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-1.5 py-0.5 rounded">
                      {chord.abbreviation}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{chord.character}</p>
                </div>
                <button
                  type="button"
                  onClick={() => playPreviewItem(chord.name, 'Chord Identification')}
                  title={`Play ${chord.name} chord`}
                  className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition cursor-pointer shrink-0"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
              <MnemonicEditor itemName={chord.name} defaultOpen={true} />
            </div>
          ))}
        </div>
      )}

      {category === 'notes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
          {commonNotes.map((note) => {
            const formatted = convertNoteToNomenclature(note, noteNomenclature);
            return (
              <div
                key={note}
                className="studio-inset rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-slate-700/80 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-100 text-sm font-mono">{formatted}</span>
                  <button
                    type="button"
                    onClick={() => playPreviewItem(note, 'Note Identification')}
                    title={`Play ${formatted}`}
                    className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition cursor-pointer shrink-0"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
                <MnemonicEditor itemName={note} defaultOpen={true} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
