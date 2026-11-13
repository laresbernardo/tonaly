// Standard 88-key piano notes array from A0 (MIDI 21) to C8 (MIDI 108)
export const ALL_NOTES = [
  "A0", "Bb0", "B0",
  "C1", "C#1", "D1", "Eb1", "E1", "F1", "F#1", "G1", "G#1", "A1", "Bb1", "B1",
  "C2", "C#2", "D2", "Eb2", "E2", "F2", "F#2", "G2", "G#2", "A2", "Bb2", "B2",
  "C3", "C#3", "D3", "Eb3", "E3", "F3", "F#3", "G3", "G#3", "A3", "Bb3", "B3",
  "C4", "C#4", "D4", "Eb4", "E4", "F4", "F#4", "G4", "G#4", "A4", "Bb4", "B4",
  "C5", "C#5", "D5", "Eb5", "E5", "F5", "F#5", "G5", "G#5", "A5", "Bb5", "B5",
  "C6", "C#6", "D6", "Eb6", "E6", "F6", "F#6", "G6", "G#6", "A6", "Bb6", "B6",
  "C7", "C#7", "D7", "Eb7", "E7", "F7", "F#7", "G7", "G#7", "A7", "Bb7", "B7",
  "C8"
];

// Canonical enharmonic mapping matching ALL_NOTES (C#, Eb, F#, G#, Bb)
const ENHARMONIC_TO_CANONICAL: Record<string, string> = {
  Db: "C#",
  "D#": "Eb",
  Gb: "F#",
  Ab: "G#",
  "A#": "Bb",
};

/**
 * Normalizes any enharmonic note name (e.g. "D#4" -> "Eb4", "Db4" -> "C#4")
 * so it matches ALL_NOTES canonically across Piano, Synth, and Store.
 */
export const normalizeNoteName = (note: string): string => {
  if (!note) return note;
  const match = note.trim().match(/^([A-G](?:#|b)?)([0-8]?)$/);
  if (!match) return note;
  const [, pitchClass, octave] = match;
  const canonicalPitch = ENHARMONIC_TO_CANONICAL[pitchClass] || pitchClass;
  return `${canonicalPitch}${octave}`;
};

// Solfege syllable mapping for classical training support
export const SOLFEGE_MAP: Record<string, string> = {
  C: "Do",
  D: "Re",
  E: "Mi",
  F: "Fa",
  G: "Sol",
  A: "La",
  B: "Si"
};

// Formatting function for note display
export const formatNoteName = (noteName: string): string => {
  const normalized = normalizeNoteName(noteName);
  const baseNote = normalized.replace(/[0-9#b]/g, '');
  const solfege = SOLFEGE_MAP[baseNote];
  return solfege ? `${normalized} (${solfege})` : normalized;
};

// Converts note names (like C#4 or Eb4) to selected nomenclature (like Do#4 or Mib4)
export const convertNoteToNomenclature = (noteName: string, nomenclature: 'scientific' | 'solfege'): string => {
  if (!noteName) return noteName;
  const normalized = normalizeNoteName(noteName);
  if (nomenclature === 'scientific') return normalized;

  const match = normalized.match(/^([A-G])([#b]?)([0-9]?)$/);
  if (!match) return normalized;
  const [, letter, accidental, octave] = match;

  const solfegeLetter = SOLFEGE_MAP[letter] || letter;
  return `${solfegeLetter}${accidental}${octave}`;
};

// Filter notes by octave selector helper
export const getNotesByOctaves = (octaves: number[]): string[] => {
  const regex = new RegExp(`[${octaves.join('')}]`);
  return ALL_NOTES.filter(note => regex.test(note));
};

// Convert MIDI number (21..108) to canonical ALL_NOTES string
export const midiToNoteName = (midi: number): string | null => {
  const idx = midi - 21;
  if (idx < 0 || idx >= ALL_NOTES.length) return null;
  return ALL_NOTES[idx];
};

// Convert note string to MIDI number (21..108)
export const noteToMidi = (note: string): number | null => {
  const normalized = normalizeNoteName(note);
  const idx = ALL_NOTES.indexOf(normalized);
  if (idx === -1) return null;
  return idx + 21;
};

// Standard note frequencies map for standard A4 = 440Hz (C4 = 261.63Hz)
export const getNoteFrequency = (note: string): number => {
  const midi = noteToMidi(note);
  if (midi === null) return 440;
  return 440 * Math.pow(2, (midi - 69) / 12);
};
