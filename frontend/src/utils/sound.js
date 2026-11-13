let ctx = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Browsers (iOS Safari especially) only allow audio after a user gesture.
export function installAudioUnlock() {
  const unlock = () => {
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function bell(c, freq, start, dur, gain) {
  const osc = c.createOscillator();
  const overtone = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  overtone.type = 'sine';
  osc.frequency.value = freq;
  overtone.frequency.value = freq * 2.01;
  const og = c.createGain();
  og.gain.value = 0.25;
  overtone.connect(og).connect(g);
  osc.connect(g).connect(c.destination);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.start(start);
  overtone.start(start);
  osc.stop(start + dur + 0.05);
  overtone.stop(start + dur + 0.05);
}

export function playClick() {
  const c = getCtx();
  if (!c || c.state !== 'running') return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1800, t0);
  osc.frequency.exponentialRampToValueAtTime(600, t0 + 0.03);
  g.gain.setValueAtTime(0.12, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.05);
}

export function playReadyChime() {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  const t0 = c.currentTime + 0.05;
  // Rising major arpeggio, played twice
  const notes = [659.25, 783.99, 1046.5];
  [0, 1.1].forEach((offset) => {
    notes.forEach((f, i) => bell(c, f, t0 + offset + i * 0.16, 1.2, 0.22));
  });
}
