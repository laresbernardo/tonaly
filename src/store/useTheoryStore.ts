import { create } from 'zustand';
import { ALL_NOTES } from '../lib/music-theory/notes';
import { 
  INTERVAL_MAP, 
  getNoteFromSemitones, 
  getRandomPlayableNote,
  getIntervalBySemitones
} from '../lib/music-theory/intervals';
import { pianoSynth } from '../lib/music-theory/piano-synth';
import { db, auth } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';

export interface HistoryItem {
  id: string;
  timestamp: number;
  gameMode: 'Note Identification' | 'Interval Identification';
  difficulty: string;
  correct: boolean;
  correctAnswer: string;
  userGuess: string;
  item: string; // Note name or Interval name
  synced?: boolean;
  intervalDirection?: 'low-to-high' | 'high-to-low';
  responseTimeMs?: number;
}

interface TheoryStore {
  gameMode: 'Note Identification' | 'Interval Identification';
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Custom';
  customNotes: string[];
  customIntervals: string[];
  logResults: boolean;
  intervalDirection: 'low-to-high' | 'high-to-low';
  noteNomenclature: 'scientific' | 'solfege';
  testActive: boolean;
  currentTest: {
    baseNote: string;
    targetNote: string | null;
    correctAnswer: string;
    playSequence: string[];
    playedAt?: number;
  } | null;
  userGuess: string | null;
  isCorrect: boolean | null;
  hasAnswered: boolean;
  history: HistoryItem[];
  loadingHistory: boolean;
  historyUnsubscribe: (() => void) | null;
  mnemonics: Record<string, string[]>;
  loadingMnemonics: boolean;

  // Actions
  setGameMode: (mode: 'Note Identification' | 'Interval Identification') => void;
  setDifficulty: (diff: 'Easy' | 'Medium' | 'Hard' | 'Custom') => void;
  setCustomNotes: (notes: string[]) => void;
  setCustomIntervals: (intervals: string[]) => void;
  setLogResults: (log: boolean) => void;
  setIntervalDirection: (direction: 'low-to-high' | 'high-to-low') => void;
  setNoteNomenclature: (nomenclature: 'scientific' | 'solfege') => void;
  generateNewTest: () => void;
  rehearTest: () => void;
  submitGuess: (guess: string) => Promise<void>;
  playOptionSound: (option: string) => void;
  loadHistory: (userId: string | null) => Promise<void>;
  clearHistory: () => Promise<void>;
  deleteHistoryItem: (itemId: string) => Promise<void>;
  setMnemonic: (item: string, text: string[]) => Promise<void>;
  loadMnemonics: (userId: string | null) => Promise<void>;
  saveSettings: () => Promise<void>;
  loadSettings: (userId: string | null) => Promise<void>;
}

// Note lists helper for matching R Shiny logic
const getEasyNotes = () => ALL_NOTES.filter(note => /^[CDEFGAB]4$/.test(note));
const getMediumNotes = () => ALL_NOTES.filter(note => /[4-5]/.test(note) && !note.includes('0') && !note.includes('1') && !note.includes('7') && !note.includes('8'));
const getHardNotes = () => ALL_NOTES.filter(note => /[3-6]/.test(note));

export const useTheoryStore = create<TheoryStore>((set, get) => ({
  gameMode: 'Interval Identification',
  difficulty: 'Medium',
  customNotes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'],
  customIntervals: ['Unison', 'Major 3rd', 'Perfect 5th', 'Octave'],
  logResults: true,
  intervalDirection: 'low-to-high',
  noteNomenclature: 'scientific',
  testActive: false,
  currentTest: null,
  userGuess: null,
  isCorrect: null,
  hasAnswered: false,
  history: [],
  loadingHistory: false,
  historyUnsubscribe: null,
  mnemonics: {},
  loadingMnemonics: false,

  setGameMode: (gameMode) => {
    set({ gameMode, currentTest: null, testActive: false, hasAnswered: false, isCorrect: null });
    get().saveSettings();
  },
  
  setDifficulty: (difficulty) => {
    set({ difficulty, currentTest: null, testActive: false, hasAnswered: false, isCorrect: null });
    get().saveSettings();
  },
  
  setCustomNotes: (customNotes) => {
    set({ customNotes });
    get().saveSettings();
  },
  
  setCustomIntervals: (customIntervals) => {
    set({ customIntervals });
    get().saveSettings();
  },
  
  setLogResults: (logResults) => {
    set({ logResults });
    get().saveSettings();
  },

  setIntervalDirection: (intervalDirection) => {
    set({ intervalDirection });
    get().saveSettings();
  },

  setNoteNomenclature: (noteNomenclature) => {
    set({ noteNomenclature });
    get().saveSettings();
  },

  generateNewTest: () => {
    const { gameMode, difficulty, customNotes, customIntervals, intervalDirection } = get();
    
    // 1. Determine Note Pool
    let notePool: string[] = [];
    if (difficulty === 'Easy') notePool = getEasyNotes();
    else if (difficulty === 'Medium') notePool = getMediumNotes();
    else if (difficulty === 'Hard') notePool = getHardNotes();
    else notePool = customNotes.length > 0 ? customNotes : getEasyNotes();

    // Draw random base note
    const baseNote = getRandomPlayableNote(notePool);

    if (gameMode === 'Note Identification') {
      // Note Mode: correct answer is the base note itself
      const test = {
        baseNote,
        targetNote: null,
        correctAnswer: baseNote,
        playSequence: [baseNote],
        playedAt: Date.now()
      };

      set({
        currentTest: test,
        testActive: true,
        userGuess: null,
        isCorrect: null,
        hasAnswered: false
      });

      // Play sound
      pianoSynth.playNote(baseNote, 2.5);
    } else {
      // Interval Mode: Determine playable intervals semitones
      let semitoneOptions: number[] = [];
      if (difficulty === 'Easy') {
        semitoneOptions = [0, 4, 7, 12]; // Unison, Major 3rd, Perfect 5th, Octave
      } else if (difficulty === 'Medium') {
        semitoneOptions = Array.from({ length: 13 }, (_, i) => i); // 0 to 12 semitones
      } else if (difficulty === 'Hard') {
        semitoneOptions = Array.from({ length: 25 }, (_, i) => i); // 0 to 24 semitones
      } else {
        semitoneOptions = INTERVAL_MAP
          .filter(item => customIntervals.includes(item.name))
          .map(item => item.semitones);
        if (semitoneOptions.length === 0) semitoneOptions = [0, 4, 7, 12];
      }

      // Pick random interval
      const randomSemitone = semitoneOptions[Math.floor(Math.random() * semitoneOptions.length)];
      const targetNote = getNoteFromSemitones(
        baseNote,
        intervalDirection === 'high-to-low' ? -randomSemitone : randomSemitone
      );
      const intervalDef = getIntervalBySemitones(randomSemitone);

      if (!targetNote || !intervalDef) {
        // Fallback if out of bounds
        get().generateNewTest();
        return;
      }

      const test = {
        baseNote,
        targetNote,
        correctAnswer: intervalDef.name,
        playSequence: [baseNote, targetNote],
        playedAt: Date.now()
      };

      set({
        currentTest: test,
        testActive: true,
        userGuess: null,
        isCorrect: null,
        hasAnswered: false
      });

      // Play sequentially
      pianoSynth.playInterval(baseNote, targetNote, 'melodic', 650);
    }
  },

  rehearTest: () => {
    const { currentTest, gameMode } = get();
    if (!currentTest) return;

    if (gameMode === 'Note Identification') {
      pianoSynth.playNote(currentTest.baseNote, 2.5);
    } else if (currentTest.targetNote) {
      pianoSynth.playInterval(currentTest.baseNote, currentTest.targetNote, 'melodic', 650);
    }
  },

  playOptionSound: (option: string) => {
    const { gameMode, currentTest, intervalDirection } = get();
    if (!currentTest) return;

    if (gameMode === 'Note Identification') {
      pianoSynth.playNote(option, 2.5);
    } else {
      const baseNote = currentTest.baseNote;
      const intervalDef = INTERVAL_MAP.find(item => item.name === option);
      if (intervalDef) {
        const semitones = intervalDef.semitones;
        const targetNote = getNoteFromSemitones(
          baseNote,
          intervalDirection === 'high-to-low' ? -semitones : semitones
        );
        if (targetNote) {
          pianoSynth.playInterval(baseNote, targetNote, 'melodic', 650);
        }
      }
    }
  },

  submitGuess: async (guess) => {
    const { currentTest, gameMode, difficulty, logResults, history, intervalDirection } = get();
    if (!currentTest || get().hasAnswered) return;

    const isCorrectAnswer = guess === currentTest.correctAnswer;
    const responseTimeMs = currentTest.playedAt ? Date.now() - currentTest.playedAt : undefined;
    
    const newHistoryItem: Omit<HistoryItem, 'id'> = {
      timestamp: Date.now(),
      gameMode,
      difficulty,
      correct: isCorrectAnswer,
      correctAnswer: currentTest.correctAnswer,
      userGuess: guess,
      item: currentTest.correctAnswer,
      ...(gameMode === 'Interval Identification' ? { intervalDirection } : {}),
      ...(responseTimeMs !== undefined ? { responseTimeMs } : {})
    };

    set({
      userGuess: guess,
      isCorrect: isCorrectAnswer,
      hasAnswered: true
    });

    // Play guess sound regardless of it is correct or wrong
    get().playOptionSound(guess);

    // Optionally log to History
    if (logResults) {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          await addDoc(collection(db, 'users', currentUser.uid, 'history'), newHistoryItem);
        } catch (e) {
          console.warn('Firestore logging failed, saved locally:', e);
        }
      } else {
        const localId = `local_${Date.now()}`;
        const fullHistoryItem: HistoryItem = { ...newHistoryItem, id: localId, synced: false };
        set({ history: [fullHistoryItem, ...history] });
      }
    }
  },

  loadHistory: async (userId) => {
    // If there is an existing unsubscribe function, call it first
    const existingUnsubscribe = get().historyUnsubscribe;
    if (existingUnsubscribe) {
      existingUnsubscribe();
      set({ historyUnsubscribe: null });
    }

    set({ loadingHistory: true });
    
    if (userId) {
      try {
        // Run migration query once to fix any missing interval directions or responseTimeMs in Firestore
        const { getDocs, writeBatch } = await import('firebase/firestore');
        const migrationQuery = query(
          collection(db, 'users', userId, 'history')
        );
        const migrationSnap = await getDocs(migrationQuery);
        const batch = writeBatch(db);
        let hasUpdates = false;
        migrationSnap.forEach((document) => {
          const data = document.data();
          const updates: Record<string, any> = {};

          if (data.gameMode === 'Interval Identification' && !data.intervalDirection) {
            updates.intervalDirection = 'low-to-high';
          }
          if (data.responseTimeMs === undefined) {
            updates.responseTimeMs = 3000;
          }

          if (Object.keys(updates).length > 0) {
            batch.update(document.ref, updates);
            hasUpdates = true;
          }
        });
        if (hasUpdates) {
          await batch.commit();
        }

        const q = query(
          collection(db, 'users', userId, 'history'),
          orderBy('timestamp', 'desc')
        );
        
        const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
          const fetched: HistoryItem[] = [];
          snap.forEach((document) => {
            const data = document.data();
            fetched.push({
              id: document.id,
              timestamp: data.timestamp,
              gameMode: data.gameMode,
              difficulty: data.difficulty,
              correct: data.correct,
              correctAnswer: data.correctAnswer,
              userGuess: data.userGuess,
              item: data.item,
              intervalDirection: data.intervalDirection || (data.gameMode === 'Interval Identification' ? 'low-to-high' : undefined),
              responseTimeMs: data.responseTimeMs,
              synced: !document.metadata.hasPendingWrites
            });
          });
          set({ history: fetched, loadingHistory: false });
        }, (error) => {
          console.error('Failed to listen to Firestore history:', error);
          set({ loadingHistory: false });
        });

        set({ historyUnsubscribe: unsubscribe });
      } catch (e) {
        console.error('Failed to set up Firestore history listener/migration:', e);
        set({ history: [], loadingHistory: false });
      }
    } else {
      // Guest history resets on refresh (starts from scratch)
      set({ history: [], loadingHistory: false });
    }
  },

  clearHistory: async () => {
    const { history } = get();
    set({ history: [] });

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const promises = history.map(item => {
          if (!item.id.startsWith('local_')) {
            return deleteDoc(doc(db, 'users', currentUser.uid, 'history', item.id));
          }
          return Promise.resolve();
        });
        await Promise.all(promises);
      } catch (e) {
        console.error('Failed to clear Firestore history:', e);
      }
    }
  },

  deleteHistoryItem: async (itemId) => {
    const { history } = get();
    const updatedHistory = history.filter(item => item.id !== itemId);
    set({ history: updatedHistory });

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        if (!itemId.startsWith('local_')) {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'history', itemId));
        }
      } catch (e) {
        console.error('Failed to delete Firestore log:', e);
      }
    }
  },

  setMnemonic: async (item: string, text: string[]) => {
    const { mnemonics } = get();
    // Cap at 5 references
    const cappedText = text.slice(0, 5);
    const newMnemonics = { ...mnemonics, [item]: cappedText };
    set({ mnemonics: newMnemonics });

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'users', currentUser.uid, 'preferences', 'mnemonics'), newMnemonics, { merge: true });
      } catch (e) {
        console.warn('Failed to save mnemonic to Firestore:', e);
      }
    }
  },

  loadMnemonics: async (userId) => {
    set({ loadingMnemonics: true });
    if (userId) {
      try {
        const { getDoc, setDoc } = await import('firebase/firestore');
        const docSnap = await getDoc(doc(db, 'users', userId, 'preferences', 'mnemonics'));
        const localMnemonics = get().mnemonics;
        
        let cloudMnemonics: Record<string, string[]> = {};
        if (docSnap.exists()) {
          const rawData = docSnap.data() as Record<string, string | string[]>;
          // Migrate any string values to array format
          Object.keys(rawData).forEach((key) => {
            const val = rawData[key];
            if (typeof val === 'string') {
              cloudMnemonics[key] = [val];
            } else if (Array.isArray(val)) {
              cloudMnemonics[key] = val;
            }
          });
        }

        // Merge: local mnemonics + cloud mnemonics (cloud values win on collision)
        const mergedMnemonics = { ...localMnemonics, ...cloudMnemonics };
        set({ mnemonics: mergedMnemonics, loadingMnemonics: false });

        // If local mnemonics had unique items, save merged back to cloud
        const hasNewLocalItems = Object.keys(localMnemonics).some(
          key => !cloudMnemonics[key] || JSON.stringify(localMnemonics[key]) !== JSON.stringify(cloudMnemonics[key])
        );
        if (hasNewLocalItems) {
          await setDoc(doc(db, 'users', userId, 'preferences', 'mnemonics'), mergedMnemonics, { merge: true });
        }
      } catch (e) {
        console.error('Failed to load mnemonics:', e);
        set({ loadingMnemonics: false });
      }
    } else {
      set({ mnemonics: {}, loadingMnemonics: false });
    }
  },

  saveSettings: async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const { gameMode, difficulty, customNotes, customIntervals, intervalDirection, logResults, noteNomenclature } = get();
      try {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'users', currentUser.uid, 'preferences', 'settings'), {
          gameMode,
          difficulty,
          customNotes,
          customIntervals,
          intervalDirection,
          logResults,
          noteNomenclature
        }, { merge: true });
      } catch (e) {
        console.warn('Failed to save settings to Firestore:', e);
      }
    }
  },

  loadSettings: async (userId) => {
    if (userId) {
      try {
        const { getDoc } = await import('firebase/firestore');
        const docSnap = await getDoc(doc(db, 'users', userId, 'preferences', 'settings'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          set({
            gameMode: data.gameMode ?? get().gameMode,
            difficulty: data.difficulty ?? get().difficulty,
            customNotes: data.customNotes ?? get().customNotes,
            customIntervals: data.customIntervals ?? get().customIntervals,
            intervalDirection: data.intervalDirection ?? get().intervalDirection,
            logResults: data.logResults ?? get().logResults,
            noteNomenclature: data.noteNomenclature ?? get().noteNomenclature,
          });
        } else {
          get().saveSettings();
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }
}));
