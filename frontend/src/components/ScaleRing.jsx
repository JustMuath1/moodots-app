import React, { useRef, useEffect, useMemo } from 'react';
import { gsap } from 'gsap';
import { t } from '../utils/i18n';

const DOT_COUNT = 32;
const RADIUS = 34;
const CX = 40;
const CY = 40;
const DOT_R = 2.5;
const MAX_WEIGHT = 500;

export default function ScaleRing({ weight = 0, lang }) {
  const dotsRef = useRef([]);
  const valRef = useRef(null);

  const dots = useMemo(() => {
    const arr = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      const angle = (i / DOT_COUNT) * 2 * Math.PI - Math.PI / 2;
      arr.push({ cx: CX + RADIUS * Math.cos(angle), cy: CY + RADIUS * Math.sin(angle) });
    }
    return arr;
  }, []);

  useEffect(() => {
    const lit = Math.min(DOT_COUNT, Math.round((Math.abs(weight) / MAX_WEIGHT) * DOT_COUNT));
    dotsRef.current.forEach((el, i) => {
      if (!el) return;
      gsap.to(el, {
        attr: { fill: i < lit ? '#C8A96E' : 'rgba(255,255,255,0.08)' },
        opacity: i < lit ? 1 : 0.25,
        duration: 0.12,
        delay: i * 0.008,
      });
    });
  }, [weight]);

  useEffect(() => {
    if (valRef.current) {
      gsap.fromTo(valRef.current, { scale: 1.08 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
    }
  }, [weight]);

  return (
    <div className="scale-ring-wrap">
      <svg className="scale-ring" viewBox="0 0 80 80">
        {dots.map((d, i) => (
          <circle
            key={i}
            ref={(el) => (dotsRef.current[i] = el)}
            className="dot"
            cx={d.cx}
            cy={d.cy}
            r={DOT_R}
            fill="rgba(255,255,255,0.08)"
            opacity="0.25"
          />
        ))}
      </svg>
      <div className="scale-weight">
        <span className="scale-weight-val" ref={valRef}>{weight.toFixed(1)}</span>
        <span className="scale-weight-unit">{t('grams', lang)}</span>
      </div>
    </div>
  );
}
