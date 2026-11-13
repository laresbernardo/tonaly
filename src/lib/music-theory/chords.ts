import { ALL_NOTES, normalizeNoteName } from './notes';

export interface ChordDefinition {
  name: string;
  abbreviation: string;
  semitones: number[];
  tier: 'Easy' | 'Medium' | 'Hard';
  character: string;
}

export const CHORD_MAP: ChordDefinition[] = [
  {
    name: 'Major',
    abbreviation: 'Maj',
    semitones: [0, 4, 7],
    tier: 'Easy',
    character: 'Bright, stable & open',
  },
  {
    name: 'Minor',
    abbreviation: 'min',
    semitones: [0, 3, 7],
    tier: 'Easy',
    character: 'Warm, melancholic & grounded',
  },
  {
    name: 'Diminished',
    abbreviation: 'dim',
    semitones: [0, 3, 6],
    tier: 'Medium',
    character: 'Tense, inward & suspenseful',
  },
  {
    name: 'Augmented',
    abbreviation: 'aug',
    semitones: [0, 4, 8],
    tier: 'Medium',
    character: 'Floating, dreamlike & unresolved',
  },
  {
    name: 'Sus2',
    abbreviation: 'sus2',
    semitones: [0, 2, 7],
    tier: 'Medium',
    character: 'Airy, modern & wistful',
  },
  {
    name: 'Sus4',
    abbreviation: 'sus4',
    semitones: [0, 5, 7],
    tier: 'Medium',
    character: 'Anthemic tension wanting to fall to 3rd',
  },
  {
    name: 'Maj7',
    abbreviation: 'Maj7',
    semitones: [0, 4, 7, 11],
    tier: 'Hard',
    character: 'Lush, nostalgic & jazz-lounge warm',
  },
  {
    name: 'Min7',
    abbreviation: 'm7',
    semitones: [0, 3, 7, 10],
    tier: 'Hard',
    character: 'Smooth, mellow & soulful',
  },
  {
    name: 'Dom7',
    abbreviation: '7',
    semitones: [0, 4, 7, 10],
    tier: 'Hard',
    character: 'Bluesy, energetic & pulling home',
  },
  {
    name: 'Half-Dim 7th',
    abbreviation: 'm7b5',
    semitones: [0, 3, 6, 10],
    tier: 'Hard',
    character: 'Noir, bittersweet & cinematic',
  },
];

export const getChordsForDifficulty = (
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Custom',
  customChords: string[]
): ChordDefinition[] => {
  if (difficulty === 'Easy') {
    return CHORD_MAP.filter((c) => c.tier === 'Easy');
  }
  if (difficulty === 'Medium') {
    return CHORD_MAP.filter((c) => c.tier === 'Easy' || c.tier === 'Medium');
  }
  if (difficulty === 'Hard') {
    return CHORD_MAP;
  }
  const selected = CHORD_MAP.filter((c) => customChords.includes(c.name));
  return selected.length > 0 ? selected : CHORD_MAP.filter((c) => c.tier === 'Easy');
};

export const getChordByName = (name: string): ChordDefinition | null => {
  return CHORD_MAP.find((c) => c.name === name) || null;
};

export const getChordNotes = (rootNote: string, semitones: number[]): string[] | null => {
  const normalizedRoot = normalizeNoteName(rootNote);
  const rootIndex = ALL_NOTES.indexOf(normalizedRoot);
  if (rootIndex === -1) return null;

  const notes: string[] = [];
  for (const offset of semitones) {
    const idx = rootIndex + offset;
    if (idx < 0 || idx >= ALL_NOTES.length) return null;
    notes.push(ALL_NOTES[idx]);
  }
  return notes;
};
