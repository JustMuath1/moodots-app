import React from 'react';

// City standby scenes from the design (StandbyCities): 32×18 dot matrices.
export const CITY_W = 32;
export const CITY_H = 18;

const SAUDI_VARS = { bg: '#0B0A09', surf: '#151311', line: '#24201C', text: '#FFF4E0', text2: '#E8DFD3', muted: '#8A8077', acc: '#D9A441', acc2: '#D9A441', amb: 'rgba(16, 122, 71, 0.22)', b1: '#8E2A22', b2: '#D9A441', numglow: '0 0 24px rgba(217, 164, 65, 0.25)', chip: '#1E3A2B', chipText: '#CFEBD9' };

export const CITY_VARS = {
  riyadh: { bg: '#120B08', surf: '#1E130D', line: '#3D271C', text: '#F7EADB', text2: '#DCC6B0', muted: '#9C8470', acc: '#D9734E', acc2: '#E9C99A', amb: 'rgba(217, 115, 78, 0.18)', b1: '#D9734E', b2: '#E9C99A', numglow: '0 0 24px rgba(217, 115, 78, 0.3)', chip: '#3A2116', chipText: '#F2C9A8' },
  dalla: SAUDI_VARS,
  palm: SAUDI_VARS,
  dammam: { bg: '#05111A', surf: '#0C1C26', line: '#1A3442', text: '#EAF6F4', text2: '#C2DCD8', muted: '#7FA29E', acc: '#2EC4B6', acc2: '#FFB08A', amb: 'rgba(255, 138, 92, 0.16)', b1: '#2EC4B6', b2: '#C9A87A', numglow: '0 0 24px rgba(46, 196, 182, 0.3)', chip: '#0E3A3A', chipText: '#B8FFF6' },
  baha: { bg: '#0B111C', surf: '#141C28', line: '#28344A', text: '#F2EEE8', text2: '#CFC8BE', muted: '#8A93A6', acc: '#F09A54', acc2: '#FFC46B', amb: 'rgba(240, 154, 84, 0.18)', b1: '#A8784C', b2: '#F09A54', numglow: '0 0 24px rgba(240, 154, 84, 0.3)', chip: '#2A2018', chipText: '#FFD9A8' },
};

const lit = (col, a) => ({ backgroundColor: col, boxShadow: `0 0 ${Math.round(9 * a)}px ${col}` });
const flat = (col) => ({ backgroundColor: col });

// Riyadh skyline: Kingdom Centre (K, bridge L), Al Faisaliah (F, sphere S, spire p), crescent M
const RIYADH = (() => {
  const S = {};
  const set = (r, c, ch) => { S[r * 100 + c] = ch; };
  const box = (r1, r2, c1, c2, ch) => { for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) set(r, c, ch); };
  box(17, 17, 0, 31, 'G');
  box(13, 16, 0, 1, 'b'); box(11, 16, 2, 4, 'b'); box(14, 16, 5, 5, 'b'); box(12, 16, 13, 16, 'b'); box(10, 16, 25, 27, 'b'); box(13, 16, 28, 31, 'b');
  box(6, 8, 9, 10, 'F'); box(9, 12, 8, 11, 'F'); box(13, 16, 7, 12, 'F');
  [[3, 9], [3, 10], [4, 8], [4, 9], [4, 10], [4, 11], [5, 9], [5, 10]].forEach(([r, c]) => set(r, c, 'S'));
  [[1, 10], [2, 10], [2, 9]].forEach(([r, c]) => set(r, c, 'p'));
  box(7, 16, 18, 23, 'K');
  for (let r = 0; r <= 6; r++) { set(r, 18, 'K'); set(r, 23, 'K'); }
  for (let r = 4; r <= 6; r++) { set(r, 19, 'K'); set(r, 22, 'K'); }
  box(3, 3, 19, 22, 'L');
  [[1, 28], [1, 29], [2, 27], [3, 27], [4, 28], [4, 29]].forEach(([r, c]) => set(r, c, 'M'));
  return S;
})();
const STARS = [[0, 2], [2, 6], [1, 15], [5, 14], [0, 25], [6, 30], [3, 3], [7, 27]];

function riyadhDots(f) {
  const out = [];
  for (let r = 0; r < CITY_H; r++) {
    for (let c = 0; c < CITY_W; c++) {
      const ch = RIYADH[r * 100 + c];
      let st = flat('#1A110D');
      const win = (r * 7 + c * 3 + Math.floor(f / 8)) % 9 === 0;
      if (ch === 'G') st = flat('#2A1C14');
      else if (ch === 'b') st = win ? lit('#F2C27A', 0.6) : flat('#3D2A20');
      else if (ch === 'F' || ch === 'K') st = win ? lit('#F2C27A', 0.7) : flat('#6E5240');
      else if (ch === 'S' || ch === 'p') st = lit('#E9C99A', 0.6 + 0.4 * Math.abs(Math.sin(f / 10)));
      else if (ch === 'L') st = lit((Math.floor(f / 4) + c) % 4 === 0 ? '#CFE6FF' : '#7FB8FF', 0.9);
      else if (ch === 'M') st = lit('#F3E3B5', 0.7);
      const si = STARS.findIndex(([a, b]) => a === r && b === c);
      if (si >= 0 && !ch) st = (f + si * 3) % 11 < 5 ? lit('#FFF4E0', 0.6) : flat('#3A2A20');
      out.push(st);
    }
  }
  return out;
}

// Dammam corniche at sunset: sun and its reflection, waves, a dhow, a palm and a gull
function dammamDots(f) {
  const b = Math.floor(f / 5) % 2;
  const gull = 33 - (Math.floor(f / 2) % 38);
  const out = [];
  for (let r = 0; r < CITY_H; r++) {
    for (let c = 0; c < CITY_W; c++) {
      let st = flat('#0B1A24');
      const dist = Math.sqrt((r - 10) * (r - 10) + (c - 8) * (c - 8));
      if (r <= 10 && dist <= 3.3) st = lit(dist <= 2.2 ? '#FFB08A' : '#FF6B57', 0.6 + 0.3 * Math.abs(Math.sin(f / 12)));
      if (r >= 11 && r <= 15) {
        st = (c + 2 * r + Math.floor(f / 2)) % 7 < 2 ? lit('#2EC4B6', 0.4) : flat('#0F3A44');
        if (c >= 6 && c <= 10 && (r + c + f) % 3 === 0 && Math.abs(c - 8) <= 15 - r) st = lit('#FF8A5C', 0.5);
      }
      if (r === 16) st = flat('#C9A87A');
      if (r === 17) st = flat('#8A7A66');
      if (c === 2 && r >= 11 && r <= 15) st = flat('#8A6A45');
      if (r === 10 && c >= 0 && c <= 4) st = flat('#2E8A57');
      if (r === 9 && (c === 1 || c === 3)) st = lit('#4FC07E', 0.4);
      if (c === 22 && r >= 2 + b && r <= 8 + b) st = flat('#6B4A30');
      for (let k = 0; k <= 5; k++) if (r === 3 + k + b && c >= 21 - k && c <= 21) st = flat('#F3EDE4');
      if (r === 10 + b && c >= 18 && c <= 25) st = flat('#8A5A3A');
      if (r === 9 + b && (c === 17 || c === 25 || c === 26)) st = flat('#8A5A3A');
      if ((r === 2 && c === gull) || (r === 1 && (c === gull - 1 || c === gull + 1))) st = flat('#EAF6F4');
      out.push(st);
    }
  }
  return out;
}

// ── Saudi standby (handoff StandbySaudi): 28×18, dallah + finjan and palm ──
const SAUDI_W = 28;
const litA = (col, a) => ({ backgroundColor: col, boxShadow: `0 0 ${Math.round(8 * a)}px ${col}${Math.round(a * 140).toString(16).padStart(2, '0')}` });
const DIM = flat('#181513');

const DALLA = (() => {
  const S = {};
  const set = (r, c, ch) => { S[r * 100 + c] = ch; };
  const span = (r, a, b, ch) => { for (let c = a; c <= b; c++) set(r, c, ch); };
  set(0, 20, 'X'); span(1, 19, 21, 'k'); set(2, 20, 'K');
  span(3, 19, 21, 'K'); span(4, 19, 21, 'K'); span(5, 18, 22, 'K'); span(6, 18, 22, 'k'); span(7, 17, 23, 'k');
  span(8, 18, 22, 'K'); span(9, 18, 22, 'k');
  span(10, 17, 23, 'K'); span(11, 16, 24, 'K'); span(12, 15, 25, 'K'); span(13, 15, 25, 'K'); span(14, 15, 25, 'K'); span(15, 16, 24, 'K'); span(16, 17, 23, 'K');
  for (let r = 10; r <= 16; r++) for (let c = 15; c <= 25; c++) if (S[r * 100 + c] === 'K' && (r + c) % 2 === 0) set(r, c, 'k');
  for (let r = 10; r <= 15; r++) set(r, 18, 'X');
  [3, 4, 5, 8].forEach((r) => set(r, 19, 'X'));
  [[4, 21], [5, 22], [8, 22], [10, 23], [11, 24], [12, 25], [13, 25], [14, 25], [15, 24], [16, 23]].forEach(([r, c]) => set(r, c, 'D'));
  const spout = { 5: [4, 4], 6: [4, 4], 7: [4, 5], 8: [5, 5], 9: [5, 6], 10: [5, 6], 11: [5, 7], 12: [6, 8], 13: [6, 9], 14: [6, 10], 15: [7, 11], 16: [7, 10], 17: [8, 9] };
  Object.keys(spout).forEach((key) => {
    const c = Number(key); const [t, b] = spout[key];
    for (let r = t; r <= b; r++) set(r, c, 'K');
    set(t, c, 'k');
    if (b > t) set(b, c, 'D');
  });
  set(5, 23, 'H'); set(4, 24, 'H'); set(7, 24, 'H'); set(7, 25, 'H'); for (let r = 8; r <= 13; r++) set(r, 26, 'H');
  span(13, 1, 8, 'F'); set(14, 1, 'F'); set(14, 8, 'F'); span(14, 2, 7, 'f'); set(15, 2, 'F'); set(15, 7, 'F'); span(15, 3, 6, 'f'); span(16, 3, 6, 'F');
  span(16, 10, 13, 'P'); set(15, 10, 'T'); set(15, 12, 'T'); set(14, 11, 'T');
  span(17, 1, 27, 'L');
  return S;
})();
const DALLA_STREAM = [[5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5]];

function dallaDots(f) {
  const t = f % 64;
  const pouring = t < 34;
  const level = t < 10 ? 0 : t < 22 ? 1 : 2;
  const out = [];
  for (let r = 0; r < CITY_H; r++) {
    for (let c = 0; c < SAUDI_W; c++) {
      const ch = DALLA[r * 100 + c];
      let st = DIM;
      if (ch === 'K') st = flat('#C9A15A');
      else if (ch === 'k') st = flat('#E2BF72');
      else if (ch === 'X') st = litA('#FFF1C4', 0.7);
      else if (ch === 'D') st = flat('#9C7A3C');
      else if (ch === 'H') st = flat('#B8913F');
      else if (ch === 'F') st = flat('#F3EDE4');
      else if (ch === 'f') {
        const k = r === 15 ? 0 : 1;
        if (k < level) st = r === 14 || level === 1 ? litA('#E8B95A', 0.7) : flat('#C8923A');
      } else if (ch === 'P') st = flat('#6E655D');
      else if (ch === 'T') st = flat('#7A2E22');
      else if (ch === 'L') st = flat('#2A2420');
      const si = DALLA_STREAM.findIndex(([a, b]) => a === r && b === c);
      if (si >= 0 && pouring && (si - f) % 3 !== 0) st = litA('#E8B95A', 0.8);
      if (!pouring && level === 2 && r >= 8 && r <= 12) {
        const sway = [0, 1, 1, 0][Math.floor((f + (11 - r) * 2) / 3) % 4];
        if ((c === 3 + sway || c === 5 + sway) && (r + Math.floor(f / 2)) % 4 !== 0) st = flat(`rgba(243, 237, 228, ${0.15 + 0.07 * (12 - r)})`);
      }
      out.push(st);
    }
  }
  return out;
}

const PALM = (() => {
  const S = {};
  const set = (r, c, ch) => { S[r * 100 + c] = ch; };
  for (let r = 7; r <= 15; r++) { set(r, 13, r % 2 ? 'W' : 'w'); set(r, 14, r % 2 ? 'w' : 'W'); }
  [[7, 12], [8, 12], [8, 11], [7, 15], [8, 15], [8, 16]].forEach(([r, c]) => set(r, c, 'T'));
  for (let c = 6; c <= 22; c++) set(16, c, 'L');
  [[1, 3], [1, 4], [2, 2], [3, 2], [4, 3], [4, 4]].forEach(([r, c]) => set(r, c, 'M'));
  return S;
})();
const FRONDS = [
  [[6, 12], [5, 11], [5, 10], [5, 9], [6, 8], [7, 7]],
  [[7, 12], [7, 11], [8, 10], [9, 9], [10, 8]],
  [[6, 15], [5, 16], [5, 17], [5, 18], [6, 19], [7, 20]],
  [[7, 15], [7, 16], [8, 17], [9, 18], [10, 19]],
  [[6, 13], [5, 13], [4, 12], [3, 11], [3, 10]],
  [[6, 14], [5, 14], [4, 15], [3, 16], [3, 17]],
  [[5, 13], [4, 13], [3, 13], [2, 14]],
];
const PALM_STARS = [[1, 9], [3, 24], [0, 19], [2, 7], [5, 26], [0, 13]];

function palmDots(f) {
  const sway = Math.round(Math.sin(f / 5));
  const G = {};
  FRONDS.forEach((fr) => fr.forEach(([r, c], i) => {
    const tip = i >= fr.length - 2;
    G[(tip ? r + sway : r) * 100 + c] = tip ? 'g' : 'G';
  }));
  const out = [];
  for (let r = 0; r < CITY_H; r++) {
    for (let c = 0; c < SAUDI_W; c++) {
      const ch = PALM[r * 100 + c];
      let st = DIM;
      if (G[r * 100 + c] === 'G') st = flat('#2E8A57');
      else if (G[r * 100 + c] === 'g') st = litA('#4FC07E', 0.5);
      else if (ch === 'W') st = flat('#8A6A45');
      else if (ch === 'w') st = flat('#6B5236');
      else if (ch === 'T') st = litA('#D9A441', 0.45);
      else if (ch === 'L') st = flat('#3A2F22');
      else if (ch === 'M') st = litA('#F3E3B5', 0.8);
      const si = PALM_STARS.findIndex(([a, b]) => a === r && b === c);
      if (si >= 0) st = (f + si * 3) % 10 < 5 ? litA('#FFF4E0', 0.7) : flat('#3A332D');
      out.push(st);
    }
  }
  return out;
}

// ── Al-Baha: Thee Ain village at sunset, mountains, mist, green terraces ──
function bahaDots(f) {
  const S = {};
  const set = (r, c, v) => { S[r * 100 + c] = v; };
  const box = (r1, r2, c1, c2, v) => { for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) set(r, c, v); };
  const far = [8, 8, 7, 7, 6, 6, 7, 7, 8, 8, 7, 6, 6, 5, 5, 6, 6, 5, 4, 4, 3, 3, 4, 4, 5, 5, 4, 4, 5, 6, 6, 7];
  const near = [10, 10, 9, 9, 9, 10, 10, 11, 11, 12];
  for (let c = 0; c < 32; c++) {
    for (let r = 0; r < 18; r++) {
      if (r < far[c]) {
        if (r >= 1 && r <= 4 && c >= 8 + r && c <= 29 - r && (c + r + Math.floor(f / 3)) % 3 !== 0) set(r, c, lit(r <= 2 ? '#FFC46B' : '#FF8A5C', 0.7));
      } else if (r <= 11) set(r, c, r > far[c] ? flat('#3A4A66') : lit('#7A8AAA', 0.4));
      if (c < 10 && r >= near[c] && r <= 13) set(r, c, flat('#2A3346'));
      if (r >= 9 && r <= 10 && (c + r + Math.floor(f / 2)) % 3 === 0) set(r, c, flat('rgba(127, 143, 173, 0.85)'));
    }
  }
  [[12, 13, 23], [13, 12, 25], [14, 11, 26], [15, 10, 27]].forEach(([r, a, b]) => { for (let c = a; c <= b; c++) set(r, c, (r + c) % 3 === 0 ? lit('#E2D9C6', 0.5) : flat('#BFB6A3')); });
  box(10, 11, 13, 25, flat('#A8784C'));
  [[15, 7], [19, 6], [23, 7]].forEach(([c1, top]) => { box(top, 9, c1, c1 + 1, flat('#A8784C')); set(top, c1, flat('#C99A68')); set(top, c1 + 1, flat('#C99A68')); });
  [[10, 15], [10, 21], [11, 18], [8, 16], [7, 20], [8, 23], [11, 24]].forEach(([r, c], i) => set(r, c, (i + Math.floor(f / 6)) % 5 ? lit('#FFB86B', 0.8) : flat('#8A5A34')));
  box(15, 16, 5, 11, flat('#9C6E44')); set(15, 8, lit('#FFB86B', 0.8)); set(16, 6, lit('#FFB86B', 0.8));
  box(17, 17, 0, 21, flat('#1E3A24'));
  for (let r = 13; r <= 16; r++) set(r, 3, flat('#6B4A30'));
  for (let r = 14; r <= 16; r++) set(r, 1, flat('#6B4A30'));
  const sway = Math.round(Math.sin(f / 6));
  [[12, 1], [12, 2], [12, 4], [12, 5], [11, 3], [13, 0], [13, 6], [11, 2], [11, 4], [13, 2], [12, 0]].forEach(([r, c]) => set(r + (c === 0 || c === 6 ? sway : 0), c, flat('#3E8A4A')));
  [[13, 1], [12, 3]].forEach(([r, c]) => set(r, c, lit('#5FB86A', 0.4)));
  for (let r = 14; r <= 17; r++) for (let c = 22; c < 32; c++) if (r >= 14 + Math.floor((c - 22) / 6)) set(r, c, (r + c) % 4 === 0 ? flat('#2E6A3A') : flat('#1F4A2C'));
  const out = [];
  for (let r = 0; r < 18; r++) for (let c = 0; c < 32; c++) out.push(S[r * 100 + c] || flat('#182233'));
  return out;
}

export default function CityScene({ city, frame, label }) {
  const SCENES = { riyadh: riyadhDots, dammam: dammamDots, baha: bahaDots, dalla: dallaDots, palm: palmDots };
  const dots = (SCENES[city] || riyadhDots)(frame);
  const saudi = city === 'dalla' || city === 'palm';
  return (
    <div className={`sb-city-grid${saudi ? ' saudi' : ''}`} dir="ltr" role="img" aria-label={label}>
      {dots.map((st, i) => <div key={i} className="sb-city-dot" style={st} />)}
    </div>
  );
}
