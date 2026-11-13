import { create } from 'zustand';
import { ALL_NOTES, normalizeNoteName } from '../lib/music-theory/notes';
import {
  INTERVAL_MAP,
  getNoteFromSemitones,
  getIntervalBySemitones,
} from '../lib/music-theory/intervals';
import {
  CHORD_MAP,
  getChordsForDifficulty,
  getChordByName,
  getChordNotes,
} from '../lib/music-theory/chords';
import { pianoSynth, type SynthTimbre } from '../lib/music-theory/piano-synth';
import { db, auth } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';

export type GameMode = 'Note Identification' | 'Interval Identification' | 'Chord Identification';
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard' | 'Custom';
export type SessionMode = 'zen' | 'blitz' | 'survival';
export type IntervalDirectionSetting = 'low-to-high' | 'high-to-low' | 'mixed' | 'harmonic';
export type ChordVoicingSetting = 'harmonic' | 'arpeggio' | 'mixed';
export type SpeedTier = 'instant' | 'fast' | 'solid' | 'steady';
export type DroneRootSetting = 'auto' | 'C3' | 'D3' | 'E3' | 'F3' | 'G3' | 'A3' | 'B3';

export interface HistoryItem {
  id: string;
  timestamp: number;
  gameMode: GameMode;
  difficulty: string;
  sessionMode?: SessionMode;
  correct: boolean;
  correctAnswer: string;
  userGuess: string;
  item: string;
  synced?: boolean;
  intervalDirection?: 'low-to-high' | 'high-to-low' | 'harmonic';
  chordVoicing?: 'harmonic' | 'arpeggio';
  responseTimeMs?: number;
}

export interface CurrentTestState {
  baseNote: string;
  targetNote: string | null;
  chordNotes?: string[];
  correctAnswer: string;
  playSequence: string[];
  actualDirection?: 'low-to-high' | 'high-to-low' | 'harmonic';
  actualVoicing?: 'harmonic' | 'arpeggio';
  playedAt?: number;
}

const GUEST_HISTORY_KEY = 'tonaly_guest_history_v1';
const GUEST_MNEMONICS_KEY = 'tonaly_guest_mnemonics_v1';
const LOCAL_SETTINGS_KEY = 'tonaly_settings_v1';
const ARCADE_SCORES_KEY = 'tonaly_arcade_scores_v1';

export const BLITZ_DURATION_MS = 60_000;

// Unified note pools so test generation and button grids are 100% aligned
export const getNoteOptionsForDifficulty = (
  difficulty: DifficultyLevel,
  customNotes: string[]
): string[] => {
  const easy = ALL_NOTES.filter((note) => /^[CDEFGAB]4$/.test(note));
  if (difficulty === 'Easy') return easy;
  if (difficulty === 'Medium') {
    const start = ALL_NOTES.indexOf('C4');
    const end = ALL_NOTES.indexOf('B4');
    return ALL_NOTES.slice(start, end + 1);
  }
  if (difficulty === 'Hard') {
    const start = ALL_NOTES.indexOf('C4');
    const end = ALL_NOTES.indexOf('B5');
    return ALL_NOTES.slice(start, end + 1);
  }
  const normalized = customNotes.map(normalizeNoteName).filter((n) => ALL_NOTES.includes(n));
  return normalized.length > 0 ? normalized : easy;
};

// Base note roots for Interval & Chord generation (comfortable middle studio register)
const getAnchorNotePool = (difficulty: DifficultyLevel): string[] => {
  if (difficulty === 'Easy') {
    return ALL_NOTES.filter((n) => /^[CDEFGAB]4$/.test(n));
  }
  if (difficulty === 'Medium') {
    const start = ALL_NOTES.indexOf('G3');
    const end = ALL_NOTES.indexOf('C5');
    return ALL_NOTES.slice(start, end + 1);
  }
  const start = ALL_NOTES.indexOf('E3');
  const end = ALL_NOTES.indexOf('E5');
  return ALL_NOTES.slice(start, end + 1);
};

// Smart adaptive weighted picker targeting weak/slow/unpracticed items
function pickAdaptiveItem<T>(
  candidates: T[],
  getKey: (item: T) => string,
  history: HistoryItem[],
  gameMode: GameMode,
  adaptive: boolean,
  lastAnswer?: string
): T {
  if (candidates.length === 0) {
    throw new Error('Cannot pick from empty candidate pool');
  }
  if (candidates.length === 1) return candidates[0];

  // Avoid immediate monotonous triple-repeats when pool has options
  const filtered = lastAnswer && candidates.length > 2 && Math.random() < 0.72
    ? candidates.filter((c) => getKey(c) !== lastAnswer)
    : candidates;
  const pool = filtered.length > 0 ? filtered : candidates;

  if (!adaptive) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const modeHistory = history.filter((h) => h.gameMode === gameMode).slice(0, 250);
  const statsMap: Record<string, { correct: number; total: number; totalMs: number; msCount: number }> = {};
  for (const h of modeHistory) {
    const key = h.correctAnswer;
    if (!statsMap[key]) {
      statsMap[key] = { correct: 0, total: 0, totalMs: 0, msCount: 0 };
    }
    statsMap[key].total += 1;
    if (h.correct) statsMap[key].correct += 1;
    if (h.responseTimeMs !== undefined) {
      statsMap[key].totalMs += h.responseTimeMs;
      statsMap[key].msCount += 1;
    }
  }

  const weights = pool.map((candidate) => {
    const key = getKey(candidate);
    const st = statsMap[key];
    if (!st || st.total < 2) {
      return 2.8; // Boost unpracticed items so adaptive quickly maps your ear
    }
    const accuracy = st.correct / st.total;
    const avgMs = st.msCount > 0 ? st.totalMs / st.msCount : 2500;
    const errorWeight = 1.0 + Math.pow(1 - accuracy, 1.35) * 5.2;
    const speedPenalty = avgMs > 2400 ? Math.min(1.6, (avgMs - 2400) / 3000) : 0;
    return errorWeight + speedPenalty;
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function computeSpeedTier(ms?: number): SpeedTier | null {
  if (ms === undefined) return null;
  if (ms <= 1350) return 'instant';
  if (ms <= 2600) return 'fast';
  if (ms <= 4500) return 'solid';
  return 'steady';
}

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

interface TheoryStore {
  gameMode: GameMode;
  difficulty: DifficultyLevel;
  sessionMode: SessionMode;
  adaptivePractice: boolean;
  customNotes: string[];
  customIntervals: string[];
  customChords: string[];
  logResults: boolean;
  intervalDirection: IntervalDirectionSetting;
  chordVoicing: ChordVoicingSetting;
  noteNomenclature: 'scientific' | 'solfege';
  timbre: SynthTimbre;
  droneEnabled: boolean;
  droneRoot: DroneRootSetting;
  showArenaPiano: boolean;

  // Active test & feedback state
  testActive: boolean;
  currentTest: CurrentTestState | null;
  userGuess: string | null;
  isCorrect: boolean | null;
  hasAnswered: boolean;

  // Live Streak, Combos & Speed
  currentStreak: number;
  sessionBestStreak: number;
  lastResponseTimeMs: number | null;
  lastSpeedTier: SpeedTier | null;
  lastComboMilestone: number | null;
  lastTimeBonusMs: number | null;

  // Arcade states (60s Blitz & Survival)
  blitzTimeLeftMs: number;
  blitzScore: number;
  blitzBestScore: number;
  blitzFinished: boolean;
  survivalScore: number;
  survivalBestScore: number;
  survivalGameOver: boolean;

  // Persistence
  history: HistoryItem[];
  loadingHistory: boolean;
  historyUnsubscribe: (() => void) | null;
  mnemonics: Record<string, string[]>;
  loadingMnemonics: boolean;

  // Actions
  setGameMode: (mode: GameMode) => void;
  setDifficulty: (diff: DifficultyLevel) => void;
  setSessionMode: (mode: SessionMode) => void;
  setAdaptivePractice: (enabled: boolean) => void;
  startWeaknessTraining: (mode: GameMode) => void;
  startCustomDrill: (mode: GameMode, items: string[]) => void;
  setCustomNotes: (notes: string[]) => void;
  setCustomIntervals: (intervals: string[]) => void;
  setCustomChords: (chords: string[]) => void;
  setLogResults: (log: boolean) => void;
  setIntervalDirection: (direction: IntervalDirectionSetting) => void;
  setChordVoicing: (voicing: ChordVoicingSetting) => void;
  setNoteNomenclature: (nomenclature: 'scientific' | 'solfege') => void;
  setTimbre: (timbre: SynthTimbre) => void;
  setDroneEnabled: (enabled: boolean) => void;
  setDroneRoot: (root: DroneRootSetting) => void;
  setShowArenaPiano: (show: boolean) => void;

  generateNewTest: () => void;
  startNewArcadeRun: () => void;
  tickBlitzTimer: (deltaMs: number) => void;
  rehearTest: () => void;
  playUserGuessSound: () => void;
  playOptionSound: (option: string) => void;
  playPreviewItem: (item: string, mode: GameMode) => void;
  submitGuess: (guess: string) => Promise<void>;

  loadHistory: (userId: string | null) => Promise<void>;
  clearHistory: () => Promise<void>;
  deleteHistoryItem: (itemId: string) => Promise<void>;
  setMnemonic: (item: string, text: string[]) => Promise<void>;
  loadMnemonics: (userId: string | null) => Promise<void>;
  saveSettings: () => Promise<void>;
  loadSettings: (userId: string | null) => Promise<void>;
}

const initialArcade = readLocalJson<{ blitzBestScore: number; survivalBestScore: number }>(
  ARCADE_SCORES_KEY,
  { blitzBestScore: 0, survivalBestScore: 0 }
);

export const useTheoryStore = create<TheoryStore>((set, get) => ({
  gameMode: 'Interval Identification',
  difficulty: 'Medium',
  sessionMode: 'zen',
  adaptivePractice: false,
  customNotes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'],
  customIntervals: ['Unison', 'Major 3rd', 'Perfect 5th', 'Octave'],
  customChords: ['Major', 'Minor', 'Diminished', 'Maj7'],
  logResults: true,
  intervalDirection: 'low-to-high',
  chordVoicing: 'harmonic',
  noteNomenclature: 'scientific',
  timbre: 'piano',
  droneEnabled: false,
  droneRoot: 'C3',
  showArenaPiano: true,

  testActive: false,
  currentTest: null,
  userGuess: null,
  isCorrect: null,
  hasAnswered: false,

  currentStreak: 0,
  sessionBestStreak: 0,
  lastResponseTimeMs: null,
  lastSpeedTier: null,
  lastComboMilestone: null,
  lastTimeBonusMs: null,

  blitzTimeLeftMs: BLITZ_DURATION_MS,
  blitzScore: 0,
  blitzBestScore: initialArcade.blitzBestScore,
  blitzFinished: false,
  survivalScore: 0,
  survivalBestScore: initialArcade.survivalBestScore,
  survivalGameOver: false,

  history: readLocalJson<HistoryItem[]>(GUEST_HISTORY_KEY, []),
  loadingHistory: false,
  historyUnsubscribe: null,
  mnemonics: readLocalJson<Record<string, string[]>>(GUEST_MNEMONICS_KEY, {}),
  loadingMnemonics: false,

  setGameMode: (gameMode) => {
    set({
      gameMode,
      currentTest: null,
      testActive: false,
      hasAnswered: false,
      isCorrect: null,
      userGuess: null,
      blitzTimeLeftMs: BLITZ_DURATION_MS,
      blitzScore: 0,
      blitzFinished: false,
      survivalScore: 0,
      survivalGameOver: false,
    });
    get().saveSettings();
  },

  setDifficulty: (difficulty) => {
    set({
      difficulty,
      currentTest: null,
      testActive: false,
      hasAnswered: false,
      isCorrect: null,
      userGuess: null,
    });
    get().saveSettings();
  },

  setSessionMode: (sessionMode) => {
    set({
      sessionMode,
      currentTest: null,
      testActive: false,
      hasAnswered: false,
      isCorrect: null,
      userGuess: null,
      currentStreak: 0,
      lastComboMilestone: null,
      lastTimeBonusMs: null,
      blitzTimeLeftMs: BLITZ_DURATION_MS,
      blitzScore: 0,
      blitzFinished: false,
      survivalScore: 0,
      survivalGameOver: false,
    });
    get().saveSettings();
  },

  setAdaptivePractice: (adaptivePractice) => {
    set({ adaptivePractice });
    get().saveSettings();
  },

  startWeaknessTraining: (mode) => {
    set({
      gameMode: mode,
      sessionMode: 'zen',
      adaptivePractice: true,
      difficulty: get().difficulty === 'Easy' ? 'Medium' : get().difficulty,
      currentTest: null,
      testActive: false,
      hasAnswered: false,
      isCorrect: null,
    });
    get().saveSettings();
  },

  startCustomDrill: (mode, items) => {
    const cleanItems = Array.from(new Set(items)).filter(Boolean);
    if (cleanItems.length === 0) return;
    set({
      gameMode: mode,
      difficulty: 'Custom',
      sessionMode: 'zen',
      ...(mode === 'Note Identification' ? { customNotes: cleanItems.map(normalizeNoteName) } : {}),
      ...(mode === 'Interval Identification' ? { customIntervals: cleanItems } : {}),
      ...(mode === 'Chord Identification' ? { customChords: cleanItems } : {}),
      currentTest: null,
      testActive: false,
      hasAnswered: false,
      isCorrect: null,
      userGuess: null,
    });
    get().saveSettings();
  },

  setCustomNotes: (customNotes) => {
    set({ customNotes: customNotes.map(normalizeNoteName) });
    get().saveSettings();
  },

  setCustomIntervals: (customIntervals) => {
    set({ customIntervals });
    get().saveSettings();
  },

  setCustomChords: (customChords) => {
    set({ customChords });
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

  setChordVoicing: (chordVoicing) => {
    set({ chordVoicing });
    get().saveSettings();
  },

  setNoteNomenclature: (noteNomenclature) => {
    set({ noteNomenclature });
    get().saveSettings();
  },

  setTimbre: (timbre) => {
    pianoSynth.setTimbre(timbre);
    set({ timbre });
    get().saveSettings();
  },

  setDroneEnabled: (droneEnabled) => {
    const { droneRoot, currentTest } = get();
    set({ droneEnabled });
    if (droneEnabled) {
      const targetRoot = droneRoot === 'auto' ? (currentTest?.baseNote || 'C3') : droneRoot;
      pianoSynth.setDrone(true, targetRoot);
    } else {
      pianoSynth.stopDrone();
    }
    get().saveSettings();
  },

  setDroneRoot: (droneRoot) => {
    const { droneEnabled, currentTest } = get();
    set({ droneRoot });
    if (droneEnabled) {
      const targetRoot = droneRoot === 'auto' ? (currentTest?.baseNote || 'C3') : droneRoot;
      pianoSynth.setDrone(true, targetRoot);
    }
    get().saveSettings();
  },

  setShowArenaPiano: (showArenaPiano) => {
    set({ showArenaPiano });
    get().saveSettings();
  },

  startNewArcadeRun: () => {
    set({
      currentStreak: 0,
      lastComboMilestone: null,
      lastTimeBonusMs: null,
      blitzTimeLeftMs: BLITZ_DURATION_MS,
      blitzScore: 0,
      blitzFinished: false,
      survivalScore: 0,
      survivalGameOver: false,
      currentTest: null,
      testActive: false,
      hasAnswered: false,
    });
    get().generateNewTest();
  },

  tickBlitzTimer: (deltaMs) => {
    const { sessionMode, testActive, hasAnswered, blitzFinished, blitzTimeLeftMs, blitzScore, blitzBestScore } = get();
    if (sessionMode !== 'blitz' || !testActive || hasAnswered || blitzFinished) return;

    const nextTime = Math.max(0, blitzTimeLeftMs - deltaMs);
    if (nextTime <= 0) {
      const newBest = Math.max(blitzBestScore, blitzScore);
      set({
        blitzTimeLeftMs: 0,
        blitzFinished: true,
        blitzBestScore: newBest,
      });
      writeLocalJson(ARCADE_SCORES_KEY, {
        blitzBestScore: newBest,
        survivalBestScore: get().survivalBestScore,
      });
      pianoSynth.playFeedbackSound(false, null);
    } else {
      set({ blitzTimeLeftMs: nextTime });
    }
  },

  generateNewTest: () => {
    const state = get();
    // If an arcade run ended, pressing Space / New cleanly restarts a fresh run
    if (state.sessionMode === 'blitz' && state.blitzFinished) {
      state.startNewArcadeRun();
      return;
    }
    if (state.sessionMode === 'survival' && state.survivalGameOver) {
      state.startNewArcadeRun();
      return;
    }

    const {
      gameMode,
      difficulty,
      customNotes,
      customIntervals,
      customChords,
      intervalDirection,
      chordVoicing,
      adaptivePractice,
      history,
      currentTest,
      droneEnabled,
      droneRoot,
    } = state;

    if (gameMode === 'Note Identification') {
      const notePool = getNoteOptionsForDifficulty(difficulty, customNotes);
      const chosenNote = pickAdaptiveItem(
        notePool,
        (n) => n,
        history,
        gameMode,
        adaptivePractice,
        currentTest?.correctAnswer
      );

      const test: CurrentTestState = {
        baseNote: chosenNote,
        targetNote: null,
        correctAnswer: chosenNote,
        playSequence: [chosenNote],
        playedAt: Date.now(),
      };

      set({
        currentTest: test,
        testActive: true,
        userGuess: null,
        isCorrect: null,
        hasAnswered: false,
        lastComboMilestone: null,
        lastTimeBonusMs: null,
      });

      if (droneEnabled) {
        pianoSynth.setDrone(true, droneRoot === 'auto' ? 'C3' : droneRoot);
      }
      pianoSynth.playNote(chosenNote, 2.5);
      return;
    }

    if (gameMode === 'Chord Identification') {
      const chordPool = getChordsForDifficulty(difficulty, customChords);
      const chosenChord = pickAdaptiveItem(
        chordPool,
        (c) => c.name,
        history,
        gameMode,
        adaptivePractice,
        currentTest?.correctAnswer
      );

      const anchors = getAnchorNotePool(difficulty === 'Hard' ? 'Medium' : difficulty);
      const baseNote =
        droneEnabled && droneRoot !== 'auto'
          ? droneRoot.replace(/[0-8]$/, '4')
          : anchors[Math.floor(Math.random() * anchors.length)];

      const chordNotes = getChordNotes(baseNote, chosenChord.semitones);
      if (!chordNotes) {
        get().generateNewTest();
        return;
      }

      const resolvedVoicing: 'harmonic' | 'arpeggio' =
        chordVoicing === 'mixed'
          ? Math.random() < 0.5
            ? 'harmonic'
            : 'arpeggio'
          : chordVoicing;

      const test: CurrentTestState = {
        baseNote,
        targetNote: chordNotes[chordNotes.length - 1],
        chordNotes,
        correctAnswer: chosenChord.name,
        playSequence: chordNotes,
        actualVoicing: resolvedVoicing,
        playedAt: Date.now(),
      };

      set({
        currentTest: test,
        testActive: true,
        userGuess: null,
        isCorrect: null,
        hasAnswered: false,
        lastComboMilestone: null,
        lastTimeBonusMs: null,
      });

      if (droneEnabled) {
        pianoSynth.setDrone(true, droneRoot === 'auto' ? baseNote : droneRoot);
      }
      pianoSynth.playChord(chordNotes, resolvedVoicing);
      return;
    }

    // Interval Identification Mode
    let semitoneOptions: number[];
    if (difficulty === 'Easy') {
      semitoneOptions = [0, 4, 7, 12];
    } else if (difficulty === 'Medium') {
      semitoneOptions = Array.from({ length: 13 }, (_, i) => i);
    } else if (difficulty === 'Hard') {
      semitoneOptions = Array.from({ length: 25 }, (_, i) => i);
    } else {
      semitoneOptions = INTERVAL_MAP.filter((item) => customIntervals.includes(item.name)).map(
        (item) => item.semitones
      );
      if (semitoneOptions.length === 0) semitoneOptions = [0, 4, 7, 12];
    }

    const intervalCandidates = semitoneOptions
      .map((s) => getIntervalBySemitones(s))
      .filter((i): i is NonNullable<typeof i> => Boolean(i));

    const chosenInterval = pickAdaptiveItem(
      intervalCandidates,
      (i) => i.name,
      history,
      gameMode,
      adaptivePractice,
      currentTest?.correctAnswer
    );

    const actualDirection: 'low-to-high' | 'high-to-low' | 'harmonic' =
      intervalDirection === 'mixed'
        ? Math.random() < 0.5
          ? 'low-to-high'
          : 'high-to-low'
        : intervalDirection;

    const anchors = getAnchorNotePool(difficulty);
    const baseNote =
      droneEnabled && droneRoot !== 'auto'
        ? droneRoot.replace(/[0-8]$/, '4')
        : anchors[Math.floor(Math.random() * anchors.length)];

    const signedOffset =
      actualDirection === 'high-to-low' ? -chosenInterval.semitones : chosenInterval.semitones;
    const targetNote = getNoteFromSemitones(baseNote, signedOffset);

    if (!targetNote) {
      // Safe fallback towards middle C4 if random extreme note went out of bounds
      const fallbackBase = 'C4';
      const fallbackTarget = getNoteFromSemitones(fallbackBase, signedOffset) || 'C4';
      const test: CurrentTestState = {
        baseNote: fallbackBase,
        targetNote: fallbackTarget,
        correctAnswer: chosenInterval.name,
        playSequence: [fallbackBase, fallbackTarget],
        actualDirection,
        playedAt: Date.now(),
      };
      set({
        currentTest: test,
        testActive: true,
        userGuess: null,
        isCorrect: null,
        hasAnswered: false,
        lastComboMilestone: null,
        lastTimeBonusMs: null,
      });
      if (droneEnabled) {
        pianoSynth.setDrone(true, droneRoot === 'auto' ? fallbackBase : droneRoot);
      }
      pianoSynth.playInterval(
        fallbackBase,
        fallbackTarget,
        actualDirection === 'harmonic' ? 'harmonic' : 'melodic',
        620
      );
      return;
    }

    const test: CurrentTestState = {
      baseNote,
      targetNote,
      correctAnswer: chosenInterval.name,
      playSequence: [baseNote, targetNote],
      actualDirection,
      playedAt: Date.now(),
    };

    set({
      currentTest: test,
      testActive: true,
      userGuess: null,
      isCorrect: null,
      hasAnswered: false,
      lastComboMilestone: null,
      lastTimeBonusMs: null,
    });

    if (droneEnabled) {
      pianoSynth.setDrone(true, droneRoot === 'auto' ? baseNote : droneRoot);
    }

    pianoSynth.playInterval(
      baseNote,
      targetNote,
      actualDirection === 'harmonic' ? 'harmonic' : 'melodic',
      620
    );
  },

  rehearTest: () => {
    const { currentTest, gameMode } = get();
    if (!currentTest) return;

    if (gameMode === 'Note Identification') {
      pianoSynth.playNote(currentTest.baseNote, 2.5);
    } else if (gameMode === 'Chord Identification' && currentTest.chordNotes) {
      pianoSynth.playChord(currentTest.chordNotes, currentTest.actualVoicing || 'harmonic');
    } else if (currentTest.targetNote) {
      pianoSynth.playInterval(
        currentTest.baseNote,
        currentTest.targetNote,
        currentTest.actualDirection === 'harmonic' ? 'harmonic' : 'melodic',
        620
      );
    }
  },

  playUserGuessSound: () => {
    const { userGuess } = get();
    if (!userGuess) return;
    get().playOptionSound(userGuess);
  },

  playOptionSound: (option: string) => {
    const { gameMode, currentTest, intervalDirection, chordVoicing } = get();
    if (!currentTest) return;

    if (gameMode === 'Note Identification') {
      pianoSynth.playNote(option, 2.2);
      return;
    }

    if (gameMode === 'Chord Identification') {
      const chordDef = getChordByName(option);
      if (chordDef) {
        const notes = getChordNotes(currentTest.baseNote, chordDef.semitones);
        if (notes) {
          const voicing =
            currentTest.actualVoicing || (chordVoicing === 'arpeggio' ? 'arpeggio' : 'harmonic');
          pianoSynth.playChord(notes, voicing);
        }
      }
      return;
    }

    const baseNote = currentTest.baseNote;
    const intervalDef = INTERVAL_MAP.find((item) => item.name === option);
    if (intervalDef) {
      const dir = currentTest.actualDirection || (intervalDirection === 'high-to-low' ? 'high-to-low' : 'low-to-high');
      const semitones = intervalDef.semitones;
      const targetNote = getNoteFromSemitones(
        baseNote,
        dir === 'high-to-low' ? -semitones : semitones
      );
      if (targetNote) {
        pianoSynth.playInterval(
          baseNote,
          targetNote,
          dir === 'harmonic' ? 'harmonic' : 'melodic',
          620
        );
      }
    }
  },

  playPreviewItem: (item: string, mode: GameMode) => {
    if (mode === 'Note Identification') {
      pianoSynth.playNote(item, 2.3);
      return;
    }
    if (mode === 'Chord Identification') {
      const chordDef = CHORD_MAP.find((c) => c.name === item);
      if (chordDef) {
        const notes = getChordNotes('C4', chordDef.semitones);
        if (notes) pianoSynth.playChord(notes, 'arpeggio', 190);
      }
      return;
    }
    const intervalDef = INTERVAL_MAP.find((i) => i.name === item);
    if (intervalDef) {
      const target = getNoteFromSemitones('C4', intervalDef.semitones);
      if (target) pianoSynth.playInterval('C4', target, 'melodic', 580);
    }
  },

  submitGuess: async (rawGuess) => {
    const state = get();
    const {
      currentTest,
      gameMode,
      difficulty,
      logResults,
      history,
      sessionMode,
      currentStreak,
      sessionBestStreak,
      blitzScore,
      blitzBestScore,
      blitzTimeLeftMs,
      blitzFinished,
      survivalScore,
      survivalBestScore,
      survivalGameOver,
    } = state;

    if (!currentTest || state.hasAnswered) return;
    if (sessionMode === 'blitz' && blitzFinished) return;
    if (sessionMode === 'survival' && survivalGameOver) return;

    const guess = gameMode === 'Note Identification' ? normalizeNoteName(rawGuess) : rawGuess;
    const isCorrectAnswer = guess === currentTest.correctAnswer;
    const responseTimeMs = currentTest.playedAt ? Date.now() - currentTest.playedAt : undefined;
    const speedTier = isCorrectAnswer ? computeSpeedTier(responseTimeMs) : null;

    const newStreak = isCorrectAnswer ? currentStreak + 1 : 0;
    const newSessionBest = Math.max(sessionBestStreak, newStreak);
    const isMilestone =
      isCorrectAnswer &&
      (newStreak === 5 || newStreak === 10 || newStreak === 25 || (newStreak > 25 && newStreak % 25 === 0));
    const comboMilestone = isMilestone ? newStreak : null;

    // Arcade updates (without forced auto-advance)
    let nextBlitzScore = blitzScore;
    let nextBlitzBest = blitzBestScore;
    let nextBlitzTime = blitzTimeLeftMs;
    let bonusMs: number | null = null;

    if (sessionMode === 'blitz') {
      if (isCorrectAnswer) {
        nextBlitzScore += 1;
        if (responseTimeMs !== undefined && responseTimeMs <= 1800) {
          bonusMs = 1000;
          nextBlitzTime = Math.min(BLITZ_DURATION_MS + 10_000, blitzTimeLeftMs + 1000);
        }
        if (nextBlitzScore > nextBlitzBest) {
          nextBlitzBest = nextBlitzScore;
          writeLocalJson(ARCADE_SCORES_KEY, {
            blitzBestScore: nextBlitzBest,
            survivalBestScore,
          });
        }
      }
    }

    let nextSurvivalScore = survivalScore;
    let nextSurvivalBest = survivalBestScore;
    let nextSurvivalGameOver = survivalGameOver;

    if (sessionMode === 'survival') {
      if (isCorrectAnswer) {
        nextSurvivalScore += 1;
        if (nextSurvivalScore > nextSurvivalBest) {
          nextSurvivalBest = nextSurvivalScore;
          writeLocalJson(ARCADE_SCORES_KEY, {
            blitzBestScore: nextBlitzBest,
            survivalBestScore: nextSurvivalBest,
          });
        }
      } else {
        nextSurvivalGameOver = true;
      }
    }

    const newHistoryItem: Omit<HistoryItem, 'id'> = {
      timestamp: Date.now(),
      gameMode,
      difficulty,
      sessionMode,
      correct: isCorrectAnswer,
      correctAnswer: currentTest.correctAnswer,
      userGuess: guess,
      item: currentTest.correctAnswer,
      ...(gameMode === 'Interval Identification' && currentTest.actualDirection
        ? { intervalDirection: currentTest.actualDirection }
        : {}),
      ...(gameMode === 'Chord Identification' && currentTest.actualVoicing
        ? { chordVoicing: currentTest.actualVoicing }
        : {}),
      ...(responseTimeMs !== undefined ? { responseTimeMs } : {}),
    };

    set({
      userGuess: guess,
      isCorrect: isCorrectAnswer,
      hasAnswered: true,
      currentStreak: newStreak,
      sessionBestStreak: newSessionBest,
      lastResponseTimeMs: responseTimeMs ?? null,
      lastSpeedTier: speedTier,
      lastComboMilestone: comboMilestone,
      lastTimeBonusMs: bonusMs,
      blitzScore: nextBlitzScore,
      blitzBestScore: nextBlitzBest,
      blitzTimeLeftMs: nextBlitzTime,
      survivalScore: nextSurvivalScore,
      survivalBestScore: nextSurvivalBest,
      survivalGameOver: nextSurvivalGameOver,
    });

    // Subtle ear-safe feedback chime (keeps short-term memory of the target sound clear!)
    pianoSynth.playFeedbackSound(isCorrectAnswer, comboMilestone);

    if (logResults) {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          await addDoc(collection(db, 'users', currentUser.uid, 'history'), newHistoryItem);
        } catch (e) {
          console.warn('Firestore logging failed, saved locally:', e);
          const localId = `local_${Date.now()}`;
          const fullHistoryItem: HistoryItem = { ...newHistoryItem, id: localId, synced: false };
          const updated = [fullHistoryItem, ...history];
          set({ history: updated });
          writeLocalJson(GUEST_HISTORY_KEY, updated.slice(0, 500));
        }
      } else {
        const localId = `local_${Date.now()}`;
        const fullHistoryItem: HistoryItem = { ...newHistoryItem, id: localId, synced: false };
        const updated = [fullHistoryItem, ...history];
        set({ history: updated });
        writeLocalJson(GUEST_HISTORY_KEY, updated.slice(0, 500));
      }
    }
  },

  loadHistory: async (userId) => {
    const existingUnsubscribe = get().historyUnsubscribe;
    if (existingUnsubscribe) {
      existingUnsubscribe();
      set({ historyUnsubscribe: null });
    }

    set({ loadingHistory: true });

    if (userId) {
      try {
        // Upload any guest session items collected prior to signing in
        const guestItems = readLocalJson<HistoryItem[]>(GUEST_HISTORY_KEY, []);
        if (guestItems.length > 0) {
          await Promise.all(
            guestItems.map((item) => {
              const { id: _unusedId, synced: _unusedSynced, ...payload } = item;
              void _unusedId;
              void _unusedSynced;
              return addDoc(collection(db, 'users', userId, 'history'), payload).catch(() => null);
            })
          );
          writeLocalJson(GUEST_HISTORY_KEY, []);
        }

        const q = query(collection(db, 'users', userId, 'history'), orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(
          q,
          { includeMetadataChanges: true },
          (snap) => {
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
                intervalDirection:
                  data.intervalDirection ||
                  (data.gameMode === 'Interval Identification' ? 'low-to-high' : undefined),
                responseTimeMs: data.responseTimeMs,
                synced: !document.metadata.hasPendingWrites,
              });
            });
            set({ history: fetched, loadingHistory: false });
          },
          (error) => {
            console.error('Failed to listen to Firestore history:', error);
            set({ loadingHistory: false });
          }
        );

        set({ historyUnsubscribe: unsubscribe });
      } catch (e) {
        console.error('Failed to set up Firestore history listener:', e);
        set({ loadingHistory: false });
      }
    } else {
      // Guest history persists across reloads via localStorage
      const savedGuest = readLocalJson<HistoryItem[]>(GUEST_HISTORY_KEY, []);
      set({ history: savedGuest, loadingHistory: false });
    }
  },

  clearHistory: async () => {
    const { history } = get();
    set({ history: [] });
    writeLocalJson(GUEST_HISTORY_KEY, []);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const promises = history.map((item) => {
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
    const updatedHistory = history.filter((item) => item.id !== itemId);
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
      writeLocalJson(GUEST_HISTORY_KEY, updatedHistory);
    }
  },

  setMnemonic: async (item: string, text: string[]) => {
    const { mnemonics } = get();
    const cappedText = text.slice(0, 5);
    const newMnemonics = { ...mnemonics, [item]: cappedText };
    set({ mnemonics: newMnemonics });
    writeLocalJson(GUEST_MNEMONICS_KEY, newMnemonics);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'users', currentUser.uid, 'preferences', 'mnemonics'), newMnemonics, {
          merge: true,
        });
      } catch (e) {
        console.warn('Failed to save mnemonic to Firestore:', e);
      }
    }
  },

  loadMnemonics: async (userId) => {
    set({ loadingMnemonics: true });
    const localMnemonics = readLocalJson<Record<string, string[]>>(GUEST_MNEMONICS_KEY, get().mnemonics);

    if (userId) {
      try {
        const { getDoc, setDoc } = await import('firebase/firestore');
        const docSnap = await getDoc(doc(db, 'users', userId, 'preferences', 'mnemonics'));

        const cloudMnemonics: Record<string, string[]> = {};
        if (docSnap.exists()) {
          const rawData = docSnap.data() as Record<string, string | string[]>;
          Object.keys(rawData).forEach((key) => {
            const val = rawData[key];
            if (typeof val === 'string') {
              cloudMnemonics[key] = [val];
            } else if (Array.isArray(val)) {
              cloudMnemonics[key] = val;
            }
          });
        }

        const mergedMnemonics = { ...localMnemonics, ...cloudMnemonics };
        set({ mnemonics: mergedMnemonics, loadingMnemonics: false });
        writeLocalJson(GUEST_MNEMONICS_KEY, mergedMnemonics);

        const hasNewLocalItems = Object.keys(localMnemonics).some(
          (key) =>
            !cloudMnemonics[key] ||
            JSON.stringify(localMnemonics[key]) !== JSON.stringify(cloudMnemonics[key])
        );
        if (hasNewLocalItems) {
          await setDoc(doc(db, 'users', userId, 'preferences', 'mnemonics'), mergedMnemonics, {
            merge: true,
          });
        }
      } catch (e) {
        console.error('Failed to load mnemonics:', e);
        set({ mnemonics: localMnemonics, loadingMnemonics: false });
      }
    } else {
      set({ mnemonics: localMnemonics, loadingMnemonics: false });
    }
  },

  saveSettings: async () => {
    const {
      gameMode,
      difficulty,
      sessionMode,
      adaptivePractice,
      customNotes,
      customIntervals,
      customChords,
      intervalDirection,
      chordVoicing,
      logResults,
      noteNomenclature,
      timbre,
      showArenaPiano,
      blitzBestScore,
      survivalBestScore,
    } = get();

    const payload = {
      gameMode,
      difficulty,
      sessionMode,
      adaptivePractice,
      customNotes,
      customIntervals,
      customChords,
      intervalDirection,
      chordVoicing,
      logResults,
      noteNomenclature,
      timbre,
      showArenaPiano,
      blitzBestScore,
      survivalBestScore,
    };

    writeLocalJson(LOCAL_SETTINGS_KEY, payload);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'users', currentUser.uid, 'preferences', 'settings'), payload, {
          merge: true,
        });
      } catch (e) {
        console.warn('Failed to save settings to Firestore:', e);
      }
    }
  },

  loadSettings: async (userId) => {
    const local = readLocalJson<Record<string, unknown>>(LOCAL_SETTINGS_KEY, {});

    const applyData = (data: Record<string, unknown>) => {
      const loadedTimbre = (data.timbre as SynthTimbre) ?? get().timbre;
      pianoSynth.setTimbre(loadedTimbre);
      set({
        gameMode: (data.gameMode as GameMode) ?? get().gameMode,
        difficulty: (data.difficulty as DifficultyLevel) ?? get().difficulty,
        sessionMode: (data.sessionMode as SessionMode) ?? get().sessionMode,
        adaptivePractice: (data.adaptivePractice as boolean) ?? get().adaptivePractice,
        customNotes: (data.customNotes as string[]) ?? get().customNotes,
        customIntervals: (data.customIntervals as string[]) ?? get().customIntervals,
        customChords: (data.customChords as string[]) ?? get().customChords,
        intervalDirection: (data.intervalDirection as IntervalDirectionSetting) ?? get().intervalDirection,
        chordVoicing: (data.chordVoicing as ChordVoicingSetting) ?? get().chordVoicing,
        logResults: (data.logResults as boolean) ?? get().logResults,
        noteNomenclature: (data.noteNomenclature as 'scientific' | 'solfege') ?? get().noteNomenclature,
        timbre: loadedTimbre,
        showArenaPiano: (data.showArenaPiano as boolean) ?? get().showArenaPiano,
        blitzBestScore: Math.max(get().blitzBestScore, Number(data.blitzBestScore || 0)),
        survivalBestScore: Math.max(get().survivalBestScore, Number(data.survivalBestScore || 0)),
      });
    };

    if (Object.keys(local).length > 0) {
      applyData(local);
    }

    if (userId) {
      try {
        const { getDoc } = await import('firebase/firestore');
        const docSnap = await getDoc(doc(db, 'users', userId, 'preferences', 'settings'));
        if (docSnap.exists()) {
          applyData(docSnap.data());
        } else {
          get().saveSettings();
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  },
}));
