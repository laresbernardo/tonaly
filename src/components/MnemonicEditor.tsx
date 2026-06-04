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
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') setIsAdding(false);
  };

  if (!isOpen) {
    return (
      <div className={`flex justify-center ${center ? '' : 'sm:justify-start'} animate-fadeIn`}>
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center space-x-1.5 text-xs text-purple-400 hover:text-purple-300 transition px-3.5 py-1.5 rounded-xl bg-purple-950/15 border border-purple-500/20 hover:bg-purple-950/25 cursor-pointer"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          <span>Show Mnemonics {activeReferences.length > 0 ? `(${activeReferences.length})` : ''}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full max-w-md mx-auto">
      {/* Tags List */}
      <div className={`flex flex-wrap gap-1.5 items-center justify-center ${center ? '' : 'sm:justify-start'} animate-fadeIn`}>
        {activeReferences.map((ref, idx) => (
          <span 
            key={idx} 
            className={`inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-full border transition duration-150 ${
              isCustomized 
                ? 'bg-purple-900/30 border-purple-500/40 text-purple-200' 
                : 'bg-slate-900/40 border-slate-800 text-slate-300'
            }`}
          >
            <Music className="h-3 w-3 text-purple-400/80 shrink-0" />
            <span className="italic">{ref}</span>
            <button 
              onClick={() => handleDelete(idx)}
              className="text-purple-400/50 hover:text-rose-400 transition ml-1 cursor-pointer"
              title="Delete reference"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Add Button if less than 5 */}
        {activeReferences.length < 5 && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center space-x-1 text-[11px] text-purple-400 hover:text-purple-300 border border-dashed border-purple-500/30 hover:border-purple-500/60 rounded-full px-2.5 py-0.5 transition bg-purple-950/10 cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>Add</span>
          </button>
        )}

        {/* Reset to Default Button */}
        {isCustomized && (
          <button
            onClick={handleReset}
            className="inline-flex items-center space-x-1 text-[10px] text-slate-500 hover:text-cyan-400 transition cursor-pointer ml-1"
            title="Reset to default references"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}

        {/* Collapse Button */}
        {!defaultOpen && (
          <button
            onClick={() => setIsOpen(false)}
            className="inline-flex items-center space-x-1 text-[11px] text-slate-500 hover:text-slate-400 transition cursor-pointer ml-2"
            title="Hide references"
          >
            <span>Hide</span>
          </button>
        )}
      </div>

      {/* Input Field when adding */}
      {isAdding && (
        <div className="flex items-center space-x-2 bg-purple-950/20 border border-purple-500/40 rounded-xl px-3 py-1.5 animate-fadeIn">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Add song or sound (up to 5)...'
            maxLength={50}
            className="bg-transparent border-none text-purple-100 text-xs focus:outline-none focus:ring-0 flex-1 placeholder-purple-400/40 italic"
          />
          <button 
            onClick={handleAdd}
            className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10"
          >
            Save
          </button>
          <button 
            onClick={() => setIsAdding(false)}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
