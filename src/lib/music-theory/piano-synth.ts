import { getNoteFrequency } from './notes';

class PianoSynth {
  private audioCtx: AudioContext | null = null;

  // Initialize AudioContext lazily upon user interaction (browser policy compliance)
  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive'
      });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Synthesizes an organic, rich acoustic piano strike with natural wood resonance and long tail.
   */
  public playNote(note: string, duration: number = 2.5): void {
    const ctx = this.getAudioContext();
    const freq = getNoteFrequency(note);
    const now = ctx.currentTime;
    
    // 1. Master gain node with realistic piano string physical vibration envelope
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.3, now + 0.01); // Sharp physical hammer strike
    masterGain.gain.exponentialRampToValueAtTime(0.12, now + 0.35); // Fast initial energy dispersion
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Natural slow ringout tail
    
    masterGain.connect(ctx.destination);

    // 2. Classic Acoustically-Voiced Harmonic Spectrum (mix of Sines and Triangles for wood soundboard resonance)
    const harmonics = [
      { ratio: 1, gain: 0.6, type: 'sine' as OscillatorType },       // Fundamental
      { ratio: 2, gain: 0.24, type: 'sine' as OscillatorType },      // 1st Octave Harmonic
      { ratio: 3, gain: 0.1, type: 'triangle' as OscillatorType },   // Perfect 5th Octave Harmonic
      { ratio: 4, gain: 0.05, type: 'sine' as OscillatorType },      // 2nd Octave Harmonic
      { ratio: 5, gain: 0.02, type: 'triangle' as OscillatorType }   // Major 3rd Harmonic
    ];

    harmonics.forEach((harmonic) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = harmonic.type;
      osc.frequency.setValueAtTime(freq * harmonic.ratio, now);
      
      // Subtle detuning of individual strings to mimic physical triple-string acoustic piano setup
      osc.detune.setValueAtTime((Math.random() - 0.5) * 5, now);
      
      gainNode.gain.setValueAtTime(harmonic.gain, now);
      // High frequency harmonics decay faster due to physical friction
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration * (1 / Math.sqrt(harmonic.ratio)));
      
      osc.connect(gainNode);
      gainNode.connect(masterGain);
      
      osc.start(now);
      osc.stop(now + duration);
    });
  }

  /**
   * Plays an interval with beautiful natural ringing decay.
   */
  public playInterval(
    note1: string, 
    note2: string, 
    type: 'melodic' | 'harmonic' = 'melodic',
    tempoMs: number = 650
  ): void {
    if (type === 'melodic') {
      this.playNote(note1, 2.0);
      setTimeout(() => {
        this.playNote(note2, 2.5);
      }, tempoMs);
    } else {
      this.playNote(note1, 2.5);
      this.playNote(note2, 2.5);
    }
  }

  /**
   * Explicitly unlocks the AudioContext on user interaction to comply with strict mobile policies.
   */
  public unlock(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const ctx = this.getAudioContext();
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
          const resumePromise = ctx.resume();
          if (resumePromise && typeof resumePromise.then === 'function') {
            resumePromise.then(() => {
              this.playSilence(ctx);
              resolve();
            }).catch((err) => {
              console.warn('AudioContext resume failed:', err);
              resolve();
            });
          } else {
            this.playSilence(ctx);
            resolve();
          }
        } else {
          this.playSilence(ctx);
          resolve();
        }
      } catch (e) {
        console.warn('AudioContext unlock failed:', e);
        resolve();
      }
    });
  }

  private playSilence(ctx: AudioContext): void {
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn('Silent playback failed:', e);
    }
  }
}

export const pianoSynth = new PianoSynth();

// Auto-unlock AudioContext on first user interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    pianoSynth.unlock();
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('touchend', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('touchstart', unlockAudio);
  window.addEventListener('touchend', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
}

