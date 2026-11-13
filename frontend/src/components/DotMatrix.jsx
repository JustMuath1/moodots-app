import React, { useEffect, useState } from 'react';

const ROWS = 22;
const COLS = 20;
import { THEMES } from '../utils/themes';

// Palette of the current theme; set at the top of each render (rendering is synchronous)
let P = THEMES.copper.dots;

const CUP_MAP = [
  '........ss..........',
  '........ss..........',
  '........ss..........',
  '..DDDDDDDDDDDDDDDD..',
  '..DiiiiiiiiiiiiiiD..',
  '...DiiiiiiiiiiiiD...',
  '....DiiiiiiiiiiD....',
  '.....DiiiiiiiiD.....',
  '......DDDDDDDD......',
  '.......DDDDDD.......',
  '.........dd.........',
  '.........dd.........',
  '..CCCCCCCCCCCCCCC...',
  '..CcccccccccccccC...',
  '..CcccccccccccccCHH.',
  '..CcccccccccccccC..H',
  '..CcccccccccccccC..H',
  '..CcccccccccccccCHH.',
  '...CcccccccccccC....',
  '....CcccccccccC.....',
  '.....CCCCCCCCCC.....',
  '.BBBBBBBBBBBBBBBBB..',
];

const HEART_BIG = [
  '...XXX...XXX...',
  '..XXXXX.XXXXX..',
  '.XXXXXXXXXXXXX.',
  '.XXXXXXXXXXXXX.',
  '..XXXXXXXXXXX..',
  '...XXXXXXXXX...',
  '....XXXXXXX....',
  '.....XXXXX.....',
  '......XXX......',
  '.......X.......',
];
const HEART_SMALL = [
  '...............',
  '...............',
  '.....X...X.....',
  '....XXX.XXX....',
  '....XXXXXXX....',
  '.....XXXXX.....',
  '......XXX......',
  '.......X.......',
  '...............',
  '...............',
];

export const CELEBRATIONS = ['steam', 'heart', 'ripple', 'sparkle'];

// Brew screen: dripper over a cup. mode: idle | heat | pour | wait | paused | done
function cupDots({ frame, weight, target, mode, cold, connecting }) {
  const pouring = mode === 'pour';
  const waiting = mode === 'wait' || mode === 'heat';
  const blink = waiting || connecting;
  const blinkCol = mode === 'heat' && !connecting ? P.stream : P.wait;
  const bi = Math.floor(connecting ? Date.now() / 300 : frame / 2) % 3;
  const brewingLike = mode !== 'idle';
  const dripping = (pouring || mode === 'wait') && weight > 2;
  const fill = mode === 'done' ? 7 : Math.round(7 * Math.min(Math.max(weight, 0) / Math.max(target || 250, 1), 1));
  const grounds = brewingLike || weight > 0 ? 4 : 0;

  const dots = [];
  CUP_MAP.forEach((row, r) => {
    for (let c = 0; c < COLS; c++) {
      const ch = row[c];
      let col = P.off;
      let glow = '';
      if (ch === 'D') col = P.outline;
      else if (ch === 'C' || ch === 'H') col = P.cup;
      else if (ch === 'B') col = P.base;
      else if (ch === 's' && pouring && (r + frame) % 3 !== 2) { col = P.stream; glow = P.stream; }
      else if (ch === 'd' && dripping && (r + frame) % 2 === 0) col = P.drip;
      else if (ch === 'i' && 7 - r < grounds) {
        if (pouring) col = (c + r + frame) % 4 === 0 ? P.bedHot : P.wet;
        else if (mode === 'wait') col = (c + r + Math.floor(frame / 3)) % 5 === 0 ? P.bubble : P.bean;
        else col = P.grounds;
      } else if (ch === 'c' && 19 - r < fill) {
        col = 19 - r === fill - 1 ? P.crema : P.coffee;
        if (19 - r === fill - 1) glow = P.crema;
      }
      // ice cubes in the bottom of the cup for cold recipes, until coffee covers them
      if (cold && ch === 'c' && 19 - r >= fill && r >= 17 && (c + r) % 3 === 0) col = P.ice;
      // three dots above the dripper blink in turn while the machine waits (red while heating)
      if (blink && r === 1 && (c === 6 || c === 9 || c === 12)) {
        const on = (c - 6) / 3 === bi;
        col = on ? blinkCol : P.track;
        glow = on ? blinkCol : '';
      }
      dots.push({ col, glow });
    }
  });
  return dots;
}

// Grinder: beans drain from the hopper, a glow spins around the burr, grounds fill the dosing cup
function grindDots(frame, progress, running) {
  const ring = [];
  for (let c = 7; c <= 12; c++) ring.push(800 + c);
  ring.push(912);
  for (let c = 12; c >= 7; c--) ring.push(1000 + c);
  ring.push(907);
  const lvl = Math.round(5 * progress);
  const dots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let col = P.off;
      let glow = '';
      if (r <= 6) {
        const L = 2 + r;
        const R = 17 - r;
        if (c === L || c === R) col = P.outline;
        else if (c > L && c < R && r >= 1 + Math.floor(progress * 6)) col = running && (c + r + frame) % 3 === 0 ? P.beanLit : P.bean;
      } else if (r <= 11) {
        const k = ring.indexOf(r * 100 + c);
        if (r === 7 && c >= 6 && c <= 13) col = P.cup;
        else if (r === 11 && c >= 6 && c <= 13 && c !== 9 && c !== 10) col = P.cup;
        else if ((c === 6 || c === 13) && r < 11) col = P.cup;
        else if (k >= 0) {
          const d = (k - (frame % 14) + 14) % 14;
          if (running && d < 4) { col = d === 0 ? P.head : P.ring; if (d === 0) glow = P.ring; }
          else col = P.track;
        } else if (r === 9 && (c === 9 || c === 10)) col = running ? P.wet : P.base;
      } else if (r <= 15) {
        if ((c === 9 || c === 10) && running && (r + frame) % 2 === 0) col = P.drip;
      } else if (r === 21 && c >= 5 && c <= 14) col = P.cup;
      else if ((c === 5 || c === 14) && r < 21) col = P.cup;
      else if (c > 5 && c < 14 && 20 - r < lvl) col = 20 - r === lvl - 1 ? P.drip : P.wet;
      dots.push({ col, glow });
    }
  }
  return dots;
}

function brewDots(props) {
  const { mode, frame, grindProgress = 0, transferProgress = 0, grindRunning = true } = props;
  if (mode === 'grind') return grindDots(frame, grindProgress, grindRunning);
  const cup = cupDots(props);
  if (mode !== 'transfer') return cup;
  // a glowing line sweeps down, swapping the grinder for the dripper and cup
  const g = grindDots(frame, 1, false);
  const sweep = Math.floor(transferProgress * (ROWS + 1));
  return cup.map((d, i) => {
    const r = Math.floor(i / COLS);
    if (r === sweep) return { col: P.head, glow: P.ring };
    if (r === sweep - 1) return { col: P.ring, glow: '' };
    return r < sweep ? d : g[i];
  });
}

// Scale mode: a jug that fills toward the target, with a level gauge on the side
function jugDots({ frame, weight, target, running }) {
  const ratio = Math.max(weight, 0) / target;
  const lvl = Math.min(13, ratio * 13);
  const full = Math.floor(lvl);
  const part = lvl - full;
  const top = ratio > 1 ? P.stream : P.crema;
  const dots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let col = P.off;
      let glow = '';
      const k = 16 - r;
      const inJug = r >= 4 && r <= 16 && (r === 16 ? c >= 5 && c <= 14 : c >= 4 && c <= 15);
      const wall = (r >= 3 && r <= 15 && (c === 3 || c === 16)) || (r === 16 && (c === 4 || c === 15))
        || (r === 17 && c >= 5 && c <= 14) || (r === 3 && (c === 2 || c === 17));
      if (r <= 2 && (c === 9 || c === 10) && running && (r + frame) % 3 !== 2) { col = P.stream; glow = P.stream; }
      else if (wall) col = P.cup;
      else if (inJug && k < full) { col = k === full - 1 && part < 0.15 ? top : P.coffee; if (col === top) glow = top; }
      else if (inJug && k === full && part >= 0.15 && (c + frame) % 3 !== 0) { col = top; glow = top; }
      else if ((c === 0 || c === 1) && r >= 4 && r <= 16 && k % 3 === 0) col = k < lvl ? P.crema : P.base;
      else if (r === 19 && c >= 1 && c <= 18) col = weight > 0 ? P.outline : P.base;
      else if (r === 20 && (c === 2 || c === 3 || c === 16 || c === 17)) col = P.base;
      dots.push({ col, glow });
    }
  }
  return dots;
}

const lit = (a, color = P.cup) => ({ col: color, glow: color, alpha: a });

// a filled cup in the lower rows (no dripper) — the base for steam and sparkle
function fullCupAt(r, c) {
  const ch = CUP_MAP[r][c];
  if (ch === 'C' || ch === 'H') return { col: P.cup };
  if (ch === 'B') return { col: P.base };
  if (ch === 'c') return r === 13 ? { col: P.crema, glow: P.crema } : { col: P.coffee };
  return null;
}

// deterministic sparkle: does (r, c) twinkle at this frame?
function twinkle(r, c, f) {
  const h = Math.sin(r * 12.9898 + c * 78.233 + Math.floor(f / 2) * 37.719) * 43758.5453;
  return h - Math.floor(h);
}

function celebrationDots(kind, f) {
  const dots = [];
  const beatBig = (() => { const p = f % 10; return p === 0 || p === 1 || p === 3; })();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let d = { col: P.off };
      if (kind === 'heart') {
        const hr = r - 6;
        const hc = c - 2;
        const map = beatBig ? HEART_BIG : HEART_SMALL;
        if (hr >= 0 && hr < map.length && hc >= 0 && hc < 15 && map[hr][hc] === 'X') {
          d = lit(beatBig ? 1 : 0.85, P.crema);
        }
      } else if (kind === 'ripple') {
        const dist = Math.hypot(r - 10.5, c - 9.5);
        const R = (f % 14) * 0.9;
        const R2 = ((f + 7) % 14) * 0.9;
        if (dist < 1.2) d = lit(1, P.crema);
        else if (Math.abs(dist - R) < 0.6) d = lit(Math.max(0.2, 1 - R / 12));
        else if (Math.abs(dist - R2) < 0.6) d = lit(Math.max(0.2, 1 - R2 / 12));
      } else {
        const cup = r >= 12 ? fullCupAt(r, c) : null;
        if (cup) d = cup;
        else if (kind === 'steam' && r <= 10) {
          [6, 9, 12].forEach((base, k) => {
            const tt = f + k * 3;
            const sway = [0, 1, 0, -1][Math.floor((tt + (10 - r) * 2) / 3) % 4];
            const rising = (r + Math.floor(tt / 1.5)) % 7;
            if (c === base + sway && rising < 4) d = lit(0.3 + 0.06 * r);
          });
        } else if (kind === 'sparkle' && r <= 11) {
          const v = twinkle(r, c, f);
          if (v > 0.93) d = lit(1, v > 0.97 ? P.crema : P.cup);
          else if (v > 0.88) d = lit(0.45);
        }
      }
      dots.push(d);
    }
  }
  return dots;
}

export default function DotMatrix({
  weight, frame, mode = 'idle', target = 250, grindProgress = 0, transferProgress = 0, connecting = false,
  scaleMode = false, scaleRunning = false, scaleTarget = 250, cold = false, celebrate = null, theme = 'copper', grindRunning = true,
}) {
  const th = THEMES[theme] || THEMES.copper;
  P = th.dots;
  const [celebFrame, setCelebFrame] = useState(0);
  useEffect(() => {
    if (!celebrate) return;
    setCelebFrame(0);
    const iv = setInterval(() => setCelebFrame((f) => f + 1), 150);
    return () => clearInterval(iv);
  }, [celebrate]);

  const dots = celebrate
    ? celebrationDots(celebrate, celebFrame)
    : scaleMode
      ? jugDots({ frame, weight, target: scaleTarget, running: scaleRunning })
      : brewDots({ frame, weight, target, mode, cold, connecting, grindProgress, transferProgress, grindRunning });

  return (
    <div className="dot-matrix" role="img" aria-label={mode === 'grind' ? 'Grinder animation' : scaleMode ? 'Scale animation' : 'Coffee brewing animation'}>
      {dots.map((d, i) => (
        <div
          key={i}
          className="xb-dot"
          style={{
            backgroundColor: d.col,
            opacity: d.alpha ?? 1,
            boxShadow: d.glow ? `0 0 ${d.alpha ? Math.round((th.glow + 2) * d.alpha) : th.glow - 1}px ${d.glow}88` : 'none',
          }}
        />
      ))}
    </div>
  );
}
