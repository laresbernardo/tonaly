import { ALL_NOTES } from './notes';

export interface Interval {
  semitones: number;
  name: string;
  abbreviation: string;
}

// Map semitones to standard and abbreviated musical interval names
export const INTERVAL_MAP: Interval[] = [
  { semitones: 0, name: "Unison", abbreviation: "P1" },
  { semitones: 1, name: "Minor 2nd", abbreviation: "m2" },
  { semitones: 2, name: "Major 2nd", abbreviation: "M2" },
  { semitones: 3, name: "Minor 3rd", abbreviation: "m3" },
  { semitones: 4, name: "Major 3rd", abbreviation: "M3" },
  { semitones: 5, name: "Perfect 4th", abbreviation: "P4" },
  { semitones: 6, name: "Tritone (Diminished 5th)", abbreviation: "d5" },
  { semitones: 7, name: "Perfect 5th", abbreviation: "P5" },
  { semitones: 8, name: "Minor 6th", abbreviation: "m6" },
  { semitones: 9, name: "Major 6th", abbreviation: "M6" },
  { semitones: 10, name: "Minor 7th", abbreviation: "m7" },
  { semitones: 11, name: "Major 7th", abbreviation: "M7" },
  { semitones: 12, name: "Octave", abbreviation: "P8" },
  { semitones: 13, name: "Minor 9th", abbreviation: "m9" },
  { semitones: 14, name: "Major 9th", abbreviation: "M9" },
  { semitones: 15, name: "Minor 10th", abbreviation: "m10" },
  { semitones: 16, name: "Major 10th", abbreviation: "M10" },
  { semitones: 17, name: "Perfect 11th", abbreviation: "P11" },
  { semitones: 18, name: "Augmented 11th", abbreviation: "A11" },
  { semitones: 19, name: "Perfect 12th", abbreviation: "P12" },
  { semitones: 20, name: "Minor 13th", abbreviation: "m13" },
  { semitones: 21, name: "Major 13th", abbreviation: "M13" },
  { semitones: 22, name: "Minor 14th", abbreviation: "m14" },
  { semitones: 23, name: "Major 14th", abbreviation: "M14" },
  { semitones: 24, name: "Double Octave", abbreviation: "P15" }
];

// Find the target note name given a start note and a semitone offset
export const getNoteFromSemitones = (startNote: string, semitones: number): string | null => {
  const startIndex = ALL_NOTES.indexOf(startNote);
  if (startIndex === -1) return null;
  
  const targetIndex = startIndex + semitones;
  if (targetIndex < 0 || targetIndex >= ALL_NOTES.length) return null;
  
  return ALL_NOTES[targetIndex];
};

// Get a randomized playable base note depending on the selected octaves
export const getRandomPlayableNote = (notePool: string[]): string => {
  const randomIndex = Math.floor(Math.random() * notePool.length);
  return notePool[randomIndex];
};

// Get the interval definition based on semitone distance
export const getIntervalBySemitones = (semitones: number): Interval | null => {
  return INTERVAL_MAP.find(item => item.semitones === semitones) || null;
};

// Get the interval definition based on name
export const getIntervalByName = (name: string): Interval | null => {
  return INTERVAL_MAP.find(item => item.name === name) || null;
};
