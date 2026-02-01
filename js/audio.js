import { state } from "./state.js";

// ---- Audio Context ----
const AudioContext = window.AudioContext || window.webkitAudioContext;
export let audioCtx = new AudioContext();

export function toggleMute() {
  state.isMuted = !state.isMuted;
  
  if (state.isMuted) {
    if (audioCtx.state === "running") audioCtx.suspend();
  } else {
    if (audioCtx.state === "suspended") audioCtx.resume();
  }
  return state.isMuted;
}

export function playSound(type) {
  if (state.isMuted || !audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  switch (type) {
    case "shoot":
      osc.type = "square";
      osc.frequency.setValueAtTime(400 + state.multiplier * 50, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case "explosion":
      // Osc 1: Low thud
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(150, now);
      osc1.frequency.exponentialRampToValueAtTime(10, now + 0.5);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Osc 2: Crackle/Noise-like
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);

      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(100, now);
      osc2.frequency.linearRampToValueAtTime(80, now + 0.2);
      // FM synthesis modulation for roughness
      const modOsc = audioCtx.createOscillator();
      const modGain = audioCtx.createGain();
      modOsc.type = "square";
      modOsc.frequency.value = 50;
      modGain.gain.value = 500;
      modOsc.connect(modGain);
      modGain.connect(osc2.frequency);
      modOsc.start(now);
      modOsc.stop(now + 0.3);

      gain2.gain.setValueAtTime(0.2, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc2.start(now);
      osc2.stop(now + 0.3);
      break;
    case "lock":
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case "combo_break":
      osc.type = "triangle";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
  }
}

// ---- Background Music ----
class MusicController {
    constructor() {
        this.isPlaying = false;
        this.tempo = 110;
        this.nextNoteTime = 0;
        this.timerID = null;
        this.sequence = [
            { note: 36, dur: 0.25 }, { note: 36, dur: 0.25 }, { note: 36, dur: 0.25 }, { note: 48, dur: 0.25 }, // C1, C2
            { note: 39, dur: 0.25 }, { note: 39, dur: 0.25 }, { note: 39, dur: 0.25 }, { note: 51, dur: 0.25 }, // Eb1, Eb2
            { note: 41, dur: 0.25 }, { note: 41, dur: 0.25 }, { note: 41, dur: 0.25 }, { note: 53, dur: 0.25 }, // F1, F2
            { note: 34, dur: 0.25 }, { note: 34, dur: 0.25 }, { note: 34, dur: 0.25 }, { note: 46, dur: 0.25 }, // Bb0, Bb1
        ];
        this.currentStep = 0;
    }

    start() {
        if (this.isPlaying) return;
        if (audioCtx.state === "suspended") audioCtx.resume();
        this.isPlaying = true;
        this.currentStep = 0;
        this.nextNoteTime = audioCtx.currentTime;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        window.clearTimeout(this.timerID);
    }

    scheduler() {
        if (!this.isPlaying) return;
        // Looking ahead
        while (this.nextNoteTime < audioCtx.currentTime + 0.1) {
            this.playNote(this.nextNoteTime);
            this.nextNote();
        }
        this.timerID = window.setTimeout(() => this.scheduler(), 25);
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        // sequence is 16th notes (0.25 beat)
        this.nextNoteTime += 0.25 * secondsPerBeat; // 16th notes at tempo
        this.currentStep++;
        if (this.currentStep >= this.sequence.length) {
            this.currentStep = 0;
        }
    }

    playNote(time) {
        if (state.isMuted) return;
        
        const noteData = this.sequence[this.currentStep];
        
        // Bass Synth
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        // Lowpass Filter for that "pluck" sound
        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        
        // Frequencies (MIDI to Hz)
        const freq = 440 * Math.pow(2, (noteData.note - 69) / 12);
        
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);
        
        // Filter Envelope
        filter.frequency.setValueAtTime(200, time);
        filter.frequency.exponentialRampToValueAtTime(2000, time + 0.05); // Attack
        filter.frequency.exponentialRampToValueAtTime(200, time + 0.3);   // Decay

        // Amp Envelope
        gain.gain.setValueAtTime(0.15, time); // Volume
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3); // Decay

        osc.start(time);
        osc.stop(time + 0.3);
    }
}

const music = new MusicController();

export function startMusic() {
    music.start();
}

export function stopMusic() {
    music.stop();
}
