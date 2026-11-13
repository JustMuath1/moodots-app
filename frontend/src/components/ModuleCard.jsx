import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';

export default function ModuleCard({ items }) {
  const refs = useRef([]);

  useEffect(() => {
    refs.current.forEach((el) => {
      if (el) gsap.fromTo(el, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.5)' });
    });
  }, []);

  return (
    <div className="module-grid">
      {items.map((item, i) => (
        <div key={item.label} className="module-stat" ref={(el) => (refs.current[i] = el)}>
          <div className="module-stat-val">
            {item.value}
            {item.unit && <span style={{ fontSize: '.75rem', opacity: 0.6 }}>{item.unit}</span>}
          </div>
          <div className="module-stat-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
