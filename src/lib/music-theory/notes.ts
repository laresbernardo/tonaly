// Standard 88-key piano notes array from A0 to C8
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

// Solfege syllable mapping for classical training support
export const SOLFEGE_MAP: Record<string, string> = {
  "C": "Do",
  "D": "Re",
  "E": "Mi",
  "F": "Fa",
  "G": "Sol",
  "A": "La",
  "B": "Ti"
};

// Formatting function for note display
export const formatNoteName = (noteName: string): string => {
  const baseNote = noteName.replace(/[0-9#b]/g, ''); // extract letter
  const solfege = SOLFEGE_MAP[baseNote];
  return solfege ? `${noteName} (${solfege})` : noteName;
};

// Filter notes by octave selector helper
export const getNotesByOctaves = (octaves: number[]): string[] => {
  const regex = new RegExp(`[${octaves.join('')}]`);
  return ALL_NOTES.filter(note => regex.test(note));
};

// Standard note frequencies map for standard C4 = 261.63Hz reference
export const getNoteFrequency = (note: string): number => {
  const notesMap = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  
  // Normalize flat notes to sharp notes for mapping
  let normalizedNote = note;
  if (note.startsWith("Bb")) normalizedNote = "A#" + note.slice(2);
  else if (note.startsWith("Eb")) normalizedNote = "D#" + note.slice(2);
  else if (note.startsWith("Ab")) normalizedNote = "G#" + note.slice(2);
  else if (note.startsWith("Db")) normalizedNote = "C#" + note.slice(2);
  else if (note.startsWith("Gb")) normalizedNote = "F#" + note.slice(2);

  const keyPattern = /^([A-G]#?)([0-8])$/;
  const match = normalizedNote.match(keyPattern);
  if (!match) return 440; // Fallback to A4 standard pitch

  const noteName = match[1];
  const octave = parseInt(match[2], 10);
  
  const semitoneOffset = notesMap.indexOf(noteName);
  // C4 index key is 40 in MIDI standard
  const midiNumber = 12 * (octave + 1) + semitoneOffset;
  
  // Frequency based on A4 = 440Hz (MIDI index 69)
  return 440 * Math.pow(2, (midiNumber - 69) / 12);
};
