export const DEFAULT_REFERENCES: Record<string, string[]> = {
  // Intervals
  "Unison": ["Happy Birthday (first 2 notes)", "Same pitch"],
  "Minor 2nd": ["Jaws Theme", "Für Elise (first 2 notes)", "White Christmas"],
  "Major 2nd": ["Happy Birthday (2nd to 3rd note)", "Silent Night (first 2 notes)", "Frère Jacques"],
  "Minor 3rd": ["Greensleeves", "Lullaby (Brahms)", "Hey Jude (first 2 notes of 'Jude')"],
  "Major 3rd": ["Oh When the Saints", "Kumbaya", "Blue Danube"],
  "Perfect 4th": ["Here Comes the Bride", "Amazing Grace", "Harry Potter Theme"],
  "Tritone (Diminished 5th)": ["The Simpsons Theme", "Maria (West Side Story)", "Purple Haze (Hendrix riff)"],
  "Perfect 5th": ["Star Wars Theme", "Twinkle Twinkle Little Star", "Lavender's Blue"],
  "Minor 6th": ["The Entertainer (Scott Joplin)", "Love Story Theme", "We Are Young (Fun. chorus)"],
  "Major 6th": ["My Bonnie Lies over the Ocean", "NBC Chimes", "Jingle Bells (dashing through the...)"],
  "Minor 7th": ["Star Trek Theme (original)", "The Winner Takes It All", "Somewhere (West Side Story)"],
  "Major 7th": ["Take On Me (first 2 notes of chorus)", "Don't Know Why (Norah Jones)", "Pure Imagination"],
  "Octave": ["Somewhere Over the Rainbow", "Singing in the Rain", "Let It Go (first 2 notes)"],
  "Minor 9th": ["Minor 2nd + Octave"],
  "Major 9th": ["Yesterday (The Beatles)", "Major 2nd + Octave"],
  "Minor 10th": ["Minor 3rd + Octave"],
  "Major 10th": ["Major 3rd + Octave"],
  "Perfect 11th": ["Perfect 4th + Octave"],
  "Augmented 11th": ["Tritone + Octave"],
  "Perfect 12th": ["Perfect 5th + Octave"],
  "Minor 13th": ["Minor 6th + Octave"],
  "Major 13th": ["Major 6th + Octave"],
  "Minor 14th": ["Minor 7th + Octave"],
  "Major 14th": ["Major 7th + Octave"],
  "Double Octave": ["Two Octaves up"],

  // Notes (Common Octaves 3, 4, 5)
  "C3": ["Bass C"],
  "C#3": ["C#3 / Db3"],
  "Db3": ["C#3 / Db3"],
  "D3": ["D3"],
  "D#3": ["D#3 / Eb3"],
  "Eb3": ["D#3 / Eb3"],
  "E3": ["Guitar 6th string open (Low E)"],
  "F3": ["F3"],
  "F#3": ["F#3 / Gb3"],
  "Gb3": ["F#3 / Gb3"],
  "G3": ["Guitar 3rd string open (G)"],
  "G#3": ["G#3 / Ab3"],
  "Ab3": ["G#3 / Ab3"],
  "A3": ["Guitar 5th string open (A)"],
  "A#3": ["A#3 / Bb3"],
  "Bb3": ["A#3 / Bb3"],
  "B3": ["Guitar 2nd string open (B)"],
  
  "C4": ["Middle C", "Standard piano anchor"],
  "C#4": ["Minor 2nd above Middle C"],
  "Db4": ["Minor 2nd above Middle C"],
  "D4": ["Major 2nd above Middle C"],
  "D#4": ["Minor 3rd above Middle C"],
  "Eb4": ["Minor 3rd above Middle C"],
  "E4": ["Guitar 1st string open (High E)"],
  "F4": ["Perfect 4th above Middle C"],
  "F#4": ["Looney Tunes theme start", "Tritone above Middle C"],
  "Gb4": ["Looney Tunes theme start", "Tritone above Middle C"],
  "G4": ["Perfect 5th above Middle C"],
  "G#4": ["Minor 6th above Middle C"],
  "Ab4": ["Minor 6th above Middle C"],
  "A4": ["Standard tuning pitch (440 Hz)", "Violin/Oboe tuning note"],
  "A#4": ["Minor 7th above Middle C"],
  "Bb4": ["Minor 7th above Middle C"],
  "B4": ["Major 7th above Middle C"],

  "C5": ["Tenor High C", "High C"],
  "C#5": ["C#5 / Db5"],
  "Db5": ["C#5 / Db5"],
  "D5": ["D5"],
  "D#5": ["D#5 / Eb5"],
  "Eb5": ["D#5 / Eb5"],
  "E5": ["E5"],
  "F5": ["F5"],
  "F#5": ["F#5 / Gb5"],
  "Gb5": ["F#5 / Gb5"],
  "G5": ["G5"],
  "G#5": ["G#5 / Ab5"],
  "Ab5": ["G#5 / Ab5"],
  "A5": ["A5 (880 Hz)"],
  "A#5": ["A#5 / Bb5"],
  "Bb5": ["A#5 / Bb5"],
  "B5": ["B5"]
};

export const getMnemonicWithDefault = (item: string, mnemonics: Record<string, string[]>): string[] => {
  // If user has defined references, use them
  if (mnemonics && mnemonics[item] !== undefined) {
    return mnemonics[item];
  }
  
  // Otherwise return defaults
  if (DEFAULT_REFERENCES[item]) {
    return DEFAULT_REFERENCES[item];
  }

  // Fallback dynamic generation for notes
  const noteMatch = item.match(/^([A-G]#?|b?)([0-8])$/);
  if (noteMatch) {
    return [`Pitch of ${item}`];
  }
  
  return [];
};
