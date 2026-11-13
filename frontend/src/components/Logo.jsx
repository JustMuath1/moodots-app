import React from 'react';

// Nuqta logo from the design: a cup drawn in dots (steam and coffee in the accent colour)
// and the word نُقطة drawn in the same dots, its five letter dots in the accent colour.
const MARK = [{ accent: true, dots: [[42, 18, 5], [54, 30, 5], [78, 18, 5], [90, 30, 5], [30, 66, 5], [42, 66, 5], [54, 66, 5], [66, 66, 5], [78, 66, 5], [90, 66, 5]] }, { accent: false, dots: [[30, 78, 5], [42, 78, 5], [54, 78, 5], [66, 78, 5], [78, 78, 5], [90, 78, 5], [30, 90, 5], [42, 90, 5], [54, 90, 5], [66, 90, 5], [78, 90, 5], [90, 90, 5], [42, 102, 5], [54, 102, 5], [66, 102, 5], [78, 102, 5], [102, 78, 5], [102, 90, 5]] }];
const WORD = [{ accent: false, dots: [[183, 27, 2.6], [183, 33, 2.6], [183, 39, 2.6], [63, 39, 2.6], [69, 39, 2.6], [75, 39, 2.6], [81, 39, 2.6], [87, 39, 2.6], [93, 39, 2.6], [99, 39, 2.6], [105, 39, 2.6], [111, 39, 2.6], [117, 39, 2.6], [123, 39, 2.6], [129, 39, 2.6], [135, 39, 2.6], [141, 39, 2.6], [147, 39, 2.6], [153, 39, 2.6], [159, 39, 2.6], [165, 39, 2.6], [171, 39, 2.6], [177, 39, 2.6], [153, 21, 2.6], [159, 21, 2.6], [147, 27, 2.6], [165, 27, 2.6], [147, 33, 2.6], [165, 33, 2.6], [99, 3, 2.6], [99, 9, 2.6], [99, 15, 2.6], [99, 21, 2.6], [93, 27, 2.6], [99, 27, 2.6], [105, 27, 2.6], [111, 27, 2.6], [87, 33, 2.6], [117, 33, 2.6], [39, 21, 2.6], [45, 21, 2.6], [51, 21, 2.6], [33, 27, 2.6], [57, 27, 2.6], [33, 33, 2.6], [57, 33, 2.6], [39, 39, 2.6], [45, 39, 2.6], [51, 39, 2.6]] }, { accent: true, dots: [[183, 15, 3], [147, 9, 3], [165, 9, 3], [39, 9, 3], [51, 9, 3]] }];

function Dots({ groups }) {
  return groups.map((g, i) => (
    <g key={i} style={{ fill: g.accent ? 'var(--accent)' : 'var(--text)' }}>
      {g.dots.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
    </g>
  ));
}

export function LogoMark({ size = 32, className = '' }) {
  return (
    <svg className={`logo-mark ${className}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <Dots groups={MARK} />
    </svg>
  );
}

export function Wordmark({ height = 24, className = '' }) {
  return (
    <svg className={`logo-word ${className}`} height={height} width={Math.round(height * 160 / 42)} viewBox="28 0 160 42" role="img" aria-label="نُقطة">
      <Dots groups={WORD} />
    </svg>
  );
}

export default function Logo({ markSize = 32, wordHeight = 24, className = '' }) {
  return (
    <span className={`logo ${className}`}>
      <LogoMark size={markSize} />
      <Wordmark height={wordHeight} />
    </span>
  );
}
