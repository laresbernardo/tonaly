import { ALL_NOTES } from '../lib/music-theory/notes';
import { INTERVAL_MAP } from '../lib/music-theory/intervals';
import MnemonicEditor from './MnemonicEditor';
import { BookOpen } from 'lucide-react';

export default function MnemonicsLibrary() {
  // Only show notes that are in the common playable range (e.g. octave 4 and 5)
  // to avoid cluttering the dictionary with too many extreme notes.
  const commonNotes = ALL_NOTES.filter(note => /[4-5]/.test(note) && !note.includes('0') && !note.includes('1') && !note.includes('7') && !note.includes('8'));
  const commonIntervals = INTERVAL_MAP.slice(0, 13).map(i => i.name);

  return (
    <div className="glass-panel p-6 rounded-3xl border border-slate-800/60 animate-fadeIn">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-4 mb-6">
        <div className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-black text-white">Sonic Mnemonics</h2>
        </div>
        <div className="text-xs text-slate-400">
          Your personal reference dictionary
        </div>
      </div>

      <div className="space-y-8">
        {/* Intervals Section */}
        <section>
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800/50 pb-2">
            Intervals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {commonIntervals.map(interval => (
              <div key={interval} className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
                <div className="font-bold text-cyan-300 text-sm mb-2">{interval}</div>
                <MnemonicEditor itemName={interval} />
              </div>
            ))}
          </div>
        </section>

        {/* Notes Section */}
        <section>
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800/50 pb-2 mt-8">
            Notes (Middle Octaves)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {commonNotes.map(note => (
              <div key={note} className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
                <div className="font-bold text-cyan-300 text-sm mb-2">{note}</div>
                <MnemonicEditor itemName={note} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
