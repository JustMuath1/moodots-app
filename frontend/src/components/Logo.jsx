import React from 'react';

// moodots logo, from the brand files (docs/brand/moodots-mark.svg and moodots-wordmark-en.svg):
// an "md" drawn in dots, the inside of the d in the accent colour, and the word moodots in the same dots.
// Every dot has radius 5 on a 12-unit grid.
const MARK = [{ accent: false, dots: [[102,24],[102,36],[18,48],[30,48],[42,48],[54,48],[78,48],[90,48],[102,48],[18,60],[42,60],[66,60],[102,60],[18,72],[42,72],[66,72],[102,72],[18,84],[42,84],[66,84],[102,84],[18,96],[42,96],[66,96],[78,96],[90,96],[102,96]] }, { accent: true, dots: [[78,60],[90,60],[78,72],[90,72],[78,84],[90,84]] }];
const WORD = [{ accent: false, dots: [[246,18],[342,18],[246,30],[342,30],[18,42],[30,42],[42,42],[54,42],[102,42],[114,42],[162,42],[174,42],[222,42],[234,42],[246,42],[282,42],[294,42],[330,42],[342,42],[354,42],[390,42],[402,42],[414,42],[18,54],[42,54],[66,54],[90,54],[126,54],[150,54],[186,54],[210,54],[246,54],[270,54],[306,54],[342,54],[378,54],[18,66],[42,66],[66,66],[90,66],[126,66],[150,66],[186,66],[210,66],[246,66],[270,66],[306,66],[342,66],[390,66],[402,66],[18,78],[42,78],[66,78],[90,78],[126,78],[150,78],[186,78],[210,78],[246,78],[270,78],[306,78],[342,78],[414,78],[18,90],[42,90],[66,90],[102,90],[114,90],[162,90],[174,90],[222,90],[234,90],[246,90],[282,90],[294,90],[354,90],[378,90],[390,90],[402,90]] }];

function Dots({ groups }) {
  return groups.map((g, i) => (
    <g key={i} style={{ fill: g.accent ? 'var(--accent)' : 'var(--text)' }}>
      {g.dots.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} />)}
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

// The word is 406 × 82 units (dots from 18 to 414 across, 18 to 90 down, plus their radius).
export function Wordmark({ height = 24, className = '' }) {
  return (
    <svg className={`logo-word ${className}`} height={height} width={Math.round(height * 406 / 82)} viewBox="13 13 406 82" role="img" aria-label="moodots">
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
