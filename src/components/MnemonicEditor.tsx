import { useState, useRef, useEffect } from 'react';
import { useTheoryStore } from '../store/useTheoryStore';
import { getMnemonicWithDefault, DEFAULT_REFERENCES } from '../lib/music-theory/default-references';
import { Music, Plus, X, RotateCcw, Lightbulb } from 'lucide-react';

interface MnemonicEditorProps {
  itemName: string;
  center?: boolean;
  defaultOpen?: boolean;
}

export default function MnemonicEditor({ itemName, center = false, defaultOpen = false }: MnemonicEditorProps) {
  const { mnemonics, setMnemonic } = useTheoryStore();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const activeReferences = getMnemonicWithDefault(itemName, mnemonics);
  const isCustomized = mnemonics[itemName] !== undefined;

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleAdd = () => {
    if (!inputValue.trim()) return;
    const newList = [...activeReferences, inputValue.trim()];
    setMnemonic(itemName, newList);
    setInputValue('');
    setIsAdding(false);
  };

  const handleDelete = (indexToDelete: number) => {
    const newList = activeReferences.filter((_, idx) => idx !== indexToDelete);
    setMnemonic(itemName, newList);
  };

  const handleReset = () => {
    setMnemonic(itemName, DEFAULT_REFERENCES[itemName] || []);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') setIsAdding(false);
  };

  if (!isOpen) {
    return (
      <div className={`flex justify-center ${center ? '' : 'sm:justify-start'} animate-fadeIn`}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center space-x-1.5 text-xs text-amber-300/90 hover:text-amber-200 transition px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 cursor-pointer"
        >
          <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
          <span>Memory Anchors {activeReferences.length > 0 ? `(${activeReferences.length})` : ''}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full max-w-md mx-auto">
      <div className={`flex flex-wrap gap-1.5 items-center justify-center ${center ? '' : 'sm:justify-start'} animate-fadeIn`}>
        {activeReferences.map((ref, idx) => (
          <span
            key={idx}
            className={`inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-full border transition duration-150 ${
              isCustomized
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-100'
                : 'bg-slate-900/60 border-slate-800 text-slate-300'
            }`}
          >
            <Music className="h-3 w-3 text-amber-400/80 shrink-0" />
            <span className="italic">{ref}</span>
            <button
              type="button"
              onClick={() => handleDelete(idx)}
              className="text-slate-500 hover:text-rose-400 transition ml-1 cursor-pointer"
              title="Delete reference"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {activeReferences.length < 5 && !isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center space-x-1 text-[11px] text-amber-300 hover:text-amber-200 border border-dashed border-amber-500/30 hover:border-amber-400/60 rounded-full px-2.5 py-0.5 transition bg-amber-500/5 cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>Add</span>
          </button>
        )}

        {isCustomized && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center space-x-1 text-[10px] text-slate-500 hover:text-cyan-400 transition cursor-pointer ml-1"
            title="Reset to default references"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}

        {!defaultOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="inline-flex items-center space-x-1 text-[11px] text-slate-500 hover:text-slate-300 transition cursor-pointer ml-2"
            title="Hide references"
          >
            <span>Hide</span>
          </button>
        )}
      </div>

      {isAdding && (
        <div className="flex items-center space-x-2 bg-slate-950/80 border border-amber-500/35 rounded-xl px-3 py-1.5 animate-fadeIn">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add song or memory cue (up to 5)..."
            maxLength={50}
            className="bg-transparent border-none text-slate-100 text-xs focus:outline-none focus:ring-0 flex-1 placeholder-slate-500 italic"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            className="text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
