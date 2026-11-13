import { getNoteFrequency, noteToMidi } from './notes';

export type SynthTimbre = 'piano' | 'rhodes' | 'guitar' | 'pad';

export const TIMBRE_LABELS: Record<SynthTimbre, string> = {
  piano: 'Felt Piano',
  rhodes: 'Electric Rhodes',
  guitar: 'Acoustic Pluck',
  pad: 'Warm Synth Pad',
};

interface DroneVoice {
  masterGain: GainNode;
  oscillators: OscillatorNode[];
  lfo: OscillatorNode;
  currentNote: string;
}

class PianoSynth {
  private audioCtx: AudioContext | null = null;
  private masterInput: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private waveformBuffer: Uint8Array<ArrayBuffer> | null = null;
  private timbre: SynthTimbre = 'piano';
  private droneVoice: DroneVoice | null = null;
  private hammerBuffer: AudioBuffer | null = null;

  public setTimbre(timbre: SynthTimbre): void {
    this.timbre = timbre;
  }

  public getTimbre(): SynthTimbre {
    return this.timbre;
  }

  // Initialize AudioContext and studio signal chain lazily on user interaction
  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextCtor({
        latencyHint: 'interactive',
      });
      this.setupMasterChain(this.audioCtx);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private setupMasterChain(ctx: AudioContext): void {
    const masterInput = ctx.createGain();
    masterInput.gain.value = 0.9;

    // Warm studio compressor so chords and rapid key strikes never clip
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.22;

    // Analyser for real-time audio-reactive strings
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.84;

    // Dry path
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.82;

    // Synthetic room reverb impulse response (warm intimate studio space, zero external files)
    const convolver = ctx.createConvolver();
    convolver.buffer = this.createRoomImpulse(ctx, 1.55, 2.8);
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.22;

    masterInput.connect(dryGain);
    dryGain.connect(compressor);

    masterInput.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(compressor);

    compressor.connect(analyser);
    analyser.connect(ctx.destination);

    this.masterInput = masterInput;
    this.analyser = analyser;
    this.waveformBuffer = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    this.hammerBuffer = this.createHammerNoiseBuffer(ctx);
  }

  private createRoomImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let prev = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.pow(1 - t, decay);
        const white = Math.random() * 2 - 1;
        // One-pole lowpass damping so reverb tail feels warm like wood, not metallic
        prev = prev * 0.72 + white * 0.28;
        data[i] = prev * env * 0.55;
      }
    }
    return impulse;
  }

  private createHammerNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.035);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, 2.4);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    return buffer;
  }

  /**
   * Synthesizes a note with sample-accurate scheduling, pitch-mapped stereo panning,
   * and selectable studio timbre.
   */
  public playNote(
    note: string,
    duration: number = 2.4,
    delaySec: number = 0,
    velocity: number = 1.0,
    timbreOverride?: SynthTimbre
  ): void {
    const ctx = this.getAudioContext();
    const dest = this.masterInput || ctx.destination;
    const freq = getNoteFrequency(note);
    const midi = noteToMidi(note) ?? 60;
    const startTime = ctx.currentTime + Math.max(0, delaySec);
    const activeTimbre = timbreOverride || this.timbre;

    // Subtle stereo spread from low left (-0.32) to high right (+0.32)
    let voiceTarget: AudioNode = dest;
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      const normalizedPan = Math.max(-0.35, Math.min(0.35, ((midi - 60) / 36) * 0.35));
      panner.pan.setValueAtTime(normalizedPan, startTime);
      panner.connect(dest);
      voiceTarget = panner;
    }

    if (activeTimbre === 'piano') {
      this.triggerFeltPiano(ctx, voiceTarget, freq, startTime, duration, velocity);
    } else if (activeTimbre === 'rhodes') {
      this.triggerRhodes(ctx, voiceTarget, freq, startTime, duration, velocity);
    } else if (activeTimbre === 'guitar') {
      this.triggerGuitar(ctx, voiceTarget, freq, startTime, duration, velocity);
    } else {
      this.triggerWarmPad(ctx, voiceTarget, freq, startTime, duration, velocity);
    }
  }

  private triggerFeltPiano(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    velocity: number
  ): void {
    const voiceGain = ctx.createGain();
    const peak = 0.28 * velocity;
    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(peak, startTime + 0.008);
    voiceGain.gain.exponentialRampToValueAtTime(peak * 0.42, startTime + 0.32);
    voiceGain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    const warmthFilter = ctx.createBiquadFilter();
    warmthFilter.type = 'lowpass';
    warmthFilter.frequency.setValueAtTime(Math.min(6800, freq * 8.5), startTime);
    warmthFilter.frequency.exponentialRampToValueAtTime(Math.max(650, freq * 2.2), startTime + duration * 0.85);

    voiceGain.connect(warmthFilter);
    warmthFilter.connect(dest);

    // Subtle felt hammer transient
    if (this.hammerBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.hammerBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(Math.min(2800, freq * 3), startTime);
      noiseFilter.Q.value = 1.2;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.055 * velocity, startTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.0005, startTime + 0.03);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(startTime);
    }

    const harmonics = [
      { ratio: 1, gain: 0.62, type: 'sine' as OscillatorType, detune: -1.5 },
      { ratio: 1, gain: 0.32, type: 'triangle' as OscillatorType, detune: 1.8 },
      { ratio: 2, gain: 0.22, type: 'sine' as OscillatorType, detune: 0.8 },
      { ratio: 3, gain: 0.085, type: 'sine' as OscillatorType, detune: -2.0 },
      { ratio: 4, gain: 0.04, type: 'sine' as OscillatorType, detune: 2.5 },
      { ratio: 5, gain: 0.018, type: 'sine' as OscillatorType, detune: 0 },
    ];

    harmonics.forEach((h) => {
      if (freq * h.ratio > 14000) return;
      const osc = ctx.createOscillator();
      const hGain = ctx.createGain();
      osc.type = h.type;
      osc.frequency.setValueAtTime(freq * h.ratio, startTime);
      osc.detune.setValueAtTime(h.detune + (Math.random() - 0.5) * 2.5, startTime);

      const hDur = duration * (1 / Math.sqrt(h.ratio));
      hGain.gain.setValueAtTime(h.gain, startTime);
      hGain.gain.exponentialRampToValueAtTime(0.0008, startTime + hDur);

      osc.connect(hGain);
      hGain.connect(voiceGain);
      osc.start(startTime);
      osc.stop(startTime + hDur + 0.03);
    });
  }

  private triggerRhodes(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    velocity: number
  ): void {
    const voiceGain = ctx.createGain();
    const peak = 0.26 * velocity;
    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(peak, startTime + 0.012);
    voiceGain.gain.exponentialRampToValueAtTime(peak * 0.58, startTime + 0.28);
    voiceGain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration * 1.05);
    voiceGain.connect(dest);

    // Warm fundamental pair + classic glassy Rhodes tine overtone
    const partials = [
      { ratio: 1, gain: 0.68, detune: -3.5, decay: duration },
      { ratio: 1, gain: 0.42, detune: 3.5, decay: duration },
      { ratio: 2, gain: 0.22, detune: 1.0, decay: duration * 0.65 },
      { ratio: 3, gain: 0.06, detune: -1.5, decay: duration * 0.45 },
      { ratio: 7, gain: 0.075, detune: 0, decay: 0.22 }, // Bell tine strike
    ];

    partials.forEach((p) => {
      if (freq * p.ratio > 13000) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * p.ratio, startTime);
      osc.detune.setValueAtTime(p.detune, startTime);
      g.gain.setValueAtTime(p.gain, startTime);
      g.gain.exponentialRampToValueAtTime(0.0006, startTime + p.decay);
      osc.connect(g);
      g.connect(voiceGain);
      osc.start(startTime);
      osc.stop(startTime + p.decay + 0.03);
    });
  }

  private triggerGuitar(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    velocity: number
  ): void {
    const pluckDur = Math.min(duration, 2.2);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.8;
    filter.frequency.setValueAtTime(Math.min(5400, freq * 7.5), startTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(380, freq * 1.5), startTime + 0.36);

    const voiceGain = ctx.createGain();
    const peak = 0.24 * velocity;
    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(peak, startTime + 0.006);
    voiceGain.gain.exponentialRampToValueAtTime(peak * 0.36, startTime + 0.22);
    voiceGain.gain.exponentialRampToValueAtTime(0.0008, startTime + pluckDur);

    filter.connect(voiceGain);
    voiceGain.connect(dest);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, startTime);
    osc1.detune.setValueAtTime(-2, startTime);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq, startTime);
    osc2.detune.setValueAtTime(2.5, startTime);

    const g1 = ctx.createGain();
    g1.gain.value = 0.48;
    const g2 = ctx.createGain();
    g2.gain.value = 0.65;

    osc1.connect(g1);
    g1.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + pluckDur + 0.03);
    osc2.stop(startTime + pluckDur + 0.03);
  }

  private triggerWarmPad(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    velocity: number
  ): void {
    const padDur = Math.max(duration, 2.4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(2200, freq * 3.8), startTime);
    filter.Q.value = 0.8;

    const voiceGain = ctx.createGain();
    const peak = 0.2 * velocity;
    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(peak, startTime + 0.14);
    voiceGain.gain.exponentialRampToValueAtTime(peak * 0.7, startTime + padDur * 0.55);
    voiceGain.gain.exponentialRampToValueAtTime(0.0008, startTime + padDur);

    filter.connect(voiceGain);
    voiceGain.connect(dest);

    const voices = [
      { type: 'sawtooth' as OscillatorType, detune: -7, gain: 0.26, ratio: 1 },
      { type: 'sawtooth' as OscillatorType, detune: 7, gain: 0.26, ratio: 1 },
      { type: 'triangle' as OscillatorType, detune: 0, gain: 0.52, ratio: 1 },
      { type: 'sine' as OscillatorType, detune: 1, gain: 0.18, ratio: 2 },
    ];

    voices.forEach((v) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = v.type;
      osc.frequency.setValueAtTime(freq * v.ratio, startTime);
      osc.detune.setValueAtTime(v.detune, startTime);
      g.gain.value = v.gain;
      osc.connect(g);
      g.connect(filter);
      osc.start(startTime);
      osc.stop(startTime + padDur + 0.05);
    });
  }

  /**
   * Plays an interval with sample-accurate timing (melodic or harmonic).
   */
  public playInterval(
    note1: string,
    note2: string,
    type: 'melodic' | 'harmonic' = 'melodic',
    tempoMs: number = 620
  ): void {
    if (type === 'melodic') {
      this.playNote(note1, 2.0, 0, 0.95);
      this.playNote(note2, 2.5, tempoMs / 1000, 1.0);
    } else {
      // Subtle 14ms humanization so both notes articulate distinctly while ringing together
      this.playNote(note1, 2.6, 0, 0.85);
      this.playNote(note2, 2.6, 0.014, 0.88);
    }
  }

  /**
   * Plays a multi-note chord either voiced together (subtle strum) or arpeggiated.
   */
  public playChord(
    notes: string[],
    type: 'harmonic' | 'arpeggio' = 'harmonic',
    stepMs: number = 210
  ): void {
    if (notes.length === 0) return;
    const perVoiceVel = Math.min(0.92, 1.15 / Math.sqrt(notes.length));

    if (type === 'arpeggio') {
      notes.forEach((note, idx) => {
        this.playNote(note, 2.4, (idx * stepMs) / 1000, perVoiceVel);
      });
    } else {
      notes.forEach((note, idx) => {
        this.playNote(note, 2.7, idx * 0.018, perVoiceVel);
      });
    }
  }

  /**
   * Plays subtle, ear-friendly tactile UI feedback (and celebratory chimes on 5x/10x/25x combos)
   * without overwriting the user's short-term pitch memory of the test item.
   */
  public playFeedbackSound(correct: boolean, comboMilestone: number | null = null): void {
    const ctx = this.getAudioContext();
    const dest = this.masterInput || ctx.destination;
    const now = ctx.currentTime;

    if (!correct) {
      // Soft, low wooden tap so pitch memory stays intact
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(68, now + 0.11);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.13);
      return;
    }

    if (comboMilestone && comboMilestone >= 5) {
      // Ascending crystalline flourish scaled by milestone tier (5x, 10x, 25x+)
      const freqs =
        comboMilestone >= 25
          ? [1046.5, 1318.5, 1568.0, 1975.5, 2093.0]
          : comboMilestone >= 10
            ? [1046.5, 1318.5, 1568.0, 2093.0]
            : [1046.5, 1318.5, 1568.0];

      freqs.forEach((f, idx) => {
        const t = now + idx * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.065, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0006, t + 0.45);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.48);
      });
      return;
    }

    // Standard subtle crisp confirmation shimmer
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1318.5, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.075);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0006, now + 0.14);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Starts, updates, or fades out a warm, meditative tonic root drone underneath ear training.
   */
  public setDrone(enabled: boolean, rootNote: string = 'C3'): void {
    if (!enabled) {
      this.stopDrone();
      return;
    }

    if (this.droneVoice && this.droneVoice.currentNote === rootNote) {
      return;
    }

    // Crossfade if switching drone key
    if (this.droneVoice) {
      this.stopDrone();
    }

    const ctx = this.getAudioContext();
    const dest = this.masterInput || ctx.destination;
    const now = ctx.currentTime;
    const baseFreq = getNoteFrequency(rootNote);
    // Keep drone comfortably in warm cello register (~95Hz - 220Hz)
    const droneFreq = baseFreq > 230 ? baseFreq * 0.5 : baseFreq < 80 ? baseFreq * 2 : baseFreq;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(0.065, now + 0.7);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, now);
    filter.Q.value = 0.7;

    // Gentle breathing LFO on filter cutoff
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.16;
    lfoGain.gain.value = 95;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    filter.connect(masterGain);
    masterGain.connect(dest);

    const configs = [
      { ratio: 1, type: 'sawtooth' as OscillatorType, detune: -4, gain: 0.42 },
      { ratio: 1, type: 'triangle' as OscillatorType, detune: 4, gain: 0.55 },
      { ratio: 1.5, type: 'sine' as OscillatorType, detune: 0, gain: 0.22 }, // Soft 5th harmonic
      { ratio: 2, type: 'sine' as OscillatorType, detune: 1.5, gain: 0.18 },
    ];

    const oscillators: OscillatorNode[] = [];
    configs.forEach((cfg) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = cfg.type;
      osc.frequency.setValueAtTime(droneFreq * cfg.ratio, now);
      osc.detune.setValueAtTime(cfg.detune, now);
      g.gain.value = cfg.gain;
      osc.connect(g);
      g.connect(filter);
      osc.start(now);
      oscillators.push(osc);
    });

    lfo.start(now);
    this.droneVoice = { masterGain, oscillators, lfo, currentNote: rootNote };
  }

  public stopDrone(): void {
    if (!this.droneVoice || !this.audioCtx) {
      this.droneVoice = null;
      return;
    }
    const { masterGain, oscillators, lfo } = this.droneVoice;
    this.droneVoice = null;
    const now = this.audioCtx.currentTime;
    try {
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), now);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      oscillators.forEach((osc) => osc.stop(now + 0.38));
      lfo.stop(now + 0.38);
    } catch {
      // Ignore already-stopped nodes
    }
  }

  /**
   * Copies real-time time-domain audio samples (0..255, centered at 128) for AudioVisualizer.
   * Returns RMS energy (0..1) so visualizers know whether audio is actively ringing.
   */
  public sampleWaveform(out?: Uint8Array): number {
    if (!this.analyser || !this.waveformBuffer || !this.audioCtx || this.audioCtx.state !== 'running') {
      if (out) out.fill(128);
      return 0;
    }

    this.analyser.getByteTimeDomainData(this.waveformBuffer);
    let sumSq = 0;
    const len = this.waveformBuffer.length;
    for (let i = 0; i < len; i++) {
      const v = this.waveformBuffer[i];
      if (out && i < out.length) out[i] = v;
      const centered = (v - 128) / 128;
      sumSq += centered * centered;
    }
    return Math.min(1, Math.sqrt(sumSq / len) * 4.2);
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
            resumePromise
              .then(() => {
                this.playSilence(ctx);
                resolve();
              })
              .catch(() => resolve());
          } else {
            this.playSilence(ctx);
            resolve();
          }
        } else {
          this.playSilence(ctx);
          resolve();
        }
      } catch {
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
    } catch {
      // Ignore
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
