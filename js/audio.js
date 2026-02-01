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
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
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
