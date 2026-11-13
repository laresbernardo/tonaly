import React, { useEffect, useRef } from 'react';
import { pianoSynth } from '../lib/music-theory/piano-synth';

interface AudioVisualizerProps {
  mood?: 'idle' | 'listening' | 'correct' | 'wrong' | 'milestone';
  height?: number;
}

const MOOD_COLORS: Record<NonNullable<AudioVisualizerProps['mood']>, { primary: string; secondary: string }> = {
  idle: { primary: 'rgba(148, 163, 184, 0.35)', secondary: 'rgba(56, 189, 248, 0.16)' },
  listening: { primary: 'rgba(34, 211, 238, 0.88)', secondary: 'rgba(56, 189, 248, 0.32)' },
  correct: { primary: 'rgba(52, 211, 153, 0.9)', secondary: 'rgba(16, 185, 129, 0.32)' },
  wrong: { primary: 'rgba(251, 113, 133, 0.85)', secondary: 'rgba(244, 63, 94, 0.28)' },
  milestone: { primary: 'rgba(251, 191, 36, 0.95)', secondary: 'rgba(34, 211, 238, 0.4)' },
};

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ mood = 'idle', height = 46 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moodRef = useRef(mood);

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const samples = new Uint8Array(256);
    let animId = 0;
    let smoothedEnergy = 0;
    let phase = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      }

      const w = canvas.width;
      const h = canvas.height;
      const midY = h * 0.5;

      const rawEnergy = pianoSynth.sampleWaveform(samples);
      smoothedEnergy = smoothedEnergy * 0.82 + rawEnergy * 0.18;
      phase += 0.035 + smoothedEnergy * 0.09;

      ctx.clearRect(0, 0, w, h);

      const palette = MOOD_COLORS[moodRef.current];

      // Subtle center reference horizon
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1 * dpr;
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      // Secondary harmonic ghost string
      ctx.beginPath();
      ctx.strokeStyle = palette.secondary;
      ctx.lineWidth = 1.5 * dpr;
      const points = 96;
      for (let i = 0; i <= points; i++) {
        const t = i / points;
        const x = t * w;
        // Standing-wave envelope pinned cleanly at both ends like a real instrument string
        const windowEnv = Math.sin(t * Math.PI);
        const sampleIdx = Math.min(samples.length - 1, Math.floor(t * samples.length));
        const waveVal = (samples[sampleIdx] - 128) / 128;
        const idleBreath = Math.sin(t * Math.PI * 3 - phase * 0.8) * 1.6 * dpr;
        const y = midY + windowEnv * (waveVal * h * 0.42 + idleBreath * 0.6);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Primary live acoustic string
      ctx.beginPath();
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = (1.8 + smoothedEnergy * 1.4) * dpr;
      for (let i = 0; i <= points; i++) {
        const t = i / points;
        const x = t * w;
        const windowEnv = Math.sin(t * Math.PI);
        const sampleIdx = Math.min(samples.length - 1, Math.floor(t * samples.length));
        const waveVal = (samples[sampleIdx] - 128) / 128;
        const idleBreath = Math.sin(t * Math.PI * 2 + phase) * 1.8 * dpr;
        const y = midY + windowEnv * (waveVal * h * 0.68 + idleBreath * (1 - Math.min(1, smoothedEnergy * 2)));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = window.requestAnimationFrame(render);
    };

    animId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto pointer-events-none select-none opacity-95" style={{ height }}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

export default AudioVisualizer;
