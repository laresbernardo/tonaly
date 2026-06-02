import { getNoteFrequency } from './notes';

class PianoSynth {
  private audioCtx: AudioContext | null = null;

  // Initialize AudioContext lazily upon user interaction (browser policy compliance)
  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Synthesizes a highly realistic, organic piano key strike using additive synthesis.
   */
  public playNote(note: string, duration: number = 1.2): void {
    const ctx = this.getAudioContext();
    const freq = getNoteFrequency(note);
    
    const now = ctx.currentTime;
    
    // 1. Master gain node for the overall note volume envelope
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    // Sharp attack corresponding to a physical hammer strike
    masterGain.gain.linearRampToValueAtTime(0.3, now + 0.015);
    // Natural exponential decay of the string vibration
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    masterGain.connect(ctx.destination);

    // 2. Additive Harmonics Synthesis for an authentic acoustic piano timbre
    // Real pianos have a fundamental and multiple decay harmonics:
    const harmonics = [
      { ratio: 1, gain: 0.6, type: 'sine' as OscillatorType },       // Fundamental
      { ratio: 2, gain: 0.2, type: 'sine' as OscillatorType },       // 1st Octave Harmonic
      { ratio: 3, gain: 0.08, type: 'triangle' as OscillatorType },  // Perfect 5th Octave Harmonic
      { ratio: 4, gain: 0.05, type: 'sine' as OscillatorType },       // 2nd Octave Harmonic
      { ratio: 5, gain: 0.02, type: 'triangle' as OscillatorType }    // Major 3rd Harmonic
    ];

    harmonics.forEach((harmonic) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = harmonic.type;
      osc.frequency.setValueAtTime(freq * harmonic.ratio, now);
      
      // Add slight detuning to mimic real multiple strings structure
      osc.detune.setValueAtTime((Math.random() - 0.5) * 6, now);
      
      gainNode.gain.setValueAtTime(harmonic.gain, now);
      // High frequencies decay faster in real piano strings
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration * (1 / Math.sqrt(harmonic.ratio)));
      
      osc.connect(gainNode);
      gainNode.connect(masterGain);
      
      osc.start(now);
      osc.stop(now + duration);
    });
  }

  /**
   * Plays an interval: two notes sequentially or simultaneously.
   */
  public playInterval(
    note1: string, 
    note2: string, 
    type: 'melodic' | 'harmonic' = 'melodic',
    tempoMs: number = 600
  ): void {
    if (type === 'melodic') {
      this.playNote(note1, 1.0);
      setTimeout(() => {
        this.playNote(note2, 1.2);
      }, tempoMs);
    } else {
      this.playNote(note1, 1.4);
      this.playNote(note2, 1.4);
    }
  }
}

export const pianoSynth = new PianoSynth();
