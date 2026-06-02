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
import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';

export interface HistoryItem {
  id: string;
  timestamp: number;
  gameMode: 'Note Identification' | 'Interval Identification';
  difficulty: string;
  correct: boolean;
  correctAnswer: string;
  userGuess: string;
  item: string; // Note name or Interval name
}

interface TheoryStore {
  gameMode: 'Note Identification' | 'Interval Identification';
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Custom';
  customNotes: string[];
  customIntervals: string[];
  logResults: boolean;
  testActive: boolean;
  currentTest: {
    baseNote: string;
    targetNote: string | null;
    correctAnswer: string;
    playSequence: string[];
  } | null;
  userGuess: string | null;
  isCorrect: boolean | null;
  hasAnswered: boolean;
  history: HistoryItem[];
  loadingHistory: boolean;

  // Actions
  setGameMode: (mode: 'Note Identification' | 'Interval Identification') => void;
  setDifficulty: (diff: 'Easy' | 'Medium' | 'Hard' | 'Custom') => void;
  setCustomNotes: (notes: string[]) => void;
  setCustomIntervals: (intervals: string[]) => void;
  setLogResults: (log: boolean) => void;
  generateNewTest: () => void;
  rehearTest: () => void;
  submitGuess: (guess: string) => Promise<void>;
  loadHistory: (userId: string | null) => Promise<void>;
  clearHistory: () => void;
  deleteHistoryItem: (itemId: string) => Promise<void>;
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
  testActive: false,
  currentTest: null,
  userGuess: null,
  isCorrect: null,
  hasAnswered: false,
  history: [],
  loadingHistory: false,

  setGameMode: (gameMode) => set({ gameMode, currentTest: null, testActive: false, hasAnswered: false, isCorrect: null }),
  
  setDifficulty: (difficulty) => set({ difficulty, currentTest: null, testActive: false, hasAnswered: false, isCorrect: null }),
  
  setCustomNotes: (customNotes) => set({ customNotes }),
  
  setCustomIntervals: (customIntervals) => set({ customIntervals }),
  
  setLogResults: (logResults) => set({ logResults }),

  generateNewTest: () => {
    const { gameMode, difficulty, customNotes, customIntervals } = get();
    
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
        playSequence: [baseNote]
      };

      set({
        currentTest: test,
        testActive: true,
        userGuess: null,
        isCorrect: null,
        hasAnswered: false
      });

      // Play sound
      pianoSynth.playNote(baseNote, 1.5);
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
      const targetNote = getNoteFromSemitones(baseNote, randomSemitone);
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
        playSequence: [baseNote, targetNote]
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
      pianoSynth.playNote(currentTest.baseNote, 1.5);
    } else if (currentTest.targetNote) {
      pianoSynth.playInterval(currentTest.baseNote, currentTest.targetNote, 'melodic', 650);
    }
  },

  submitGuess: async (guess) => {
    const { currentTest, gameMode, difficulty, logResults, history } = get();
    if (!currentTest || get().hasAnswered) return;

    const isCorrectAnswer = guess === currentTest.correctAnswer;
    
    const newHistoryItem: Omit<HistoryItem, 'id'> = {
      timestamp: Date.now(),
      gameMode,
      difficulty,
      correct: isCorrectAnswer,
      correctAnswer: currentTest.correctAnswer,
      userGuess: guess,
      item: currentTest.correctAnswer
    };

    set({
      userGuess: guess,
      isCorrect: isCorrectAnswer,
      hasAnswered: true
    });

    // Optionally log to History
    if (logResults) {
      const localId = `local_${Date.now()}`;
      const fullHistoryItem: HistoryItem = { ...newHistoryItem, id: localId };

      // Update state immediately for instant responsiveness
      set({ history: [fullHistoryItem, ...history] });

      // Sync to Firestore if user is signed in and online
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'history'), newHistoryItem);
          // Replace local temporary ID with real Firestore ID
          set(state => ({
            history: state.history.map(item => item.id === localId ? { ...item, id: docRef.id } : item)
          }));
        } catch (e) {
          console.warn('Firestore logging failed, saved locally:', e);
        }
      } else {
        // Sync with local storage for guests
        const cached = localStorage.getItem('tonaly_guest_history');
        const currentCache = cached ? JSON.parse(cached) : [];
        localStorage.setItem('tonaly_guest_history', JSON.stringify([fullHistoryItem, ...currentCache]));
      }
    }
  },

  loadHistory: async (userId) => {
    set({ loadingHistory: true });
    
    if (userId) {
      try {
        const q = query(
          collection(db, 'users', userId, 'history'),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
        const snap = await getDocs(q);
        const fetched: HistoryItem[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          fetched.push({
            id: doc.id,
            timestamp: data.timestamp,
            gameMode: data.gameMode,
            difficulty: data.difficulty,
            correct: data.correct,
            correctAnswer: data.correctAnswer,
            userGuess: data.userGuess,
            item: data.item
          });
        });
        set({ history: fetched, loadingHistory: false });
      } catch (e) {
        console.error('Failed to fetch Firestore history, loading local storage:', e);
        // fallback to local guest cache
        const cached = localStorage.getItem('tonaly_guest_history');
        set({ history: cached ? JSON.parse(cached) : [], loadingHistory: false });
      }
    } else {
      const cached = localStorage.getItem('tonaly_guest_history');
      set({ history: cached ? JSON.parse(cached) : [], loadingHistory: false });
    }
  },

  clearHistory: () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      localStorage.removeItem('tonaly_guest_history');
    }
    set({ history: [] });
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
    } else {
      const cached = localStorage.getItem('tonaly_guest_history');
      if (cached) {
        const currentCache = JSON.parse(cached);
        const updatedCache = currentCache.filter((item: any) => item.id !== itemId);
        localStorage.setItem('tonaly_guest_history', JSON.stringify(updatedCache));
      }
    }
  }
}));
