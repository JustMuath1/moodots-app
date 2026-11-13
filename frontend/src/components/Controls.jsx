import React, { useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { t } from '../utils/i18n';

function RippleButton({ children, className, onClick, disabled }) {
  const ref = useRef(null);

  const handleClick = useCallback((e) => {
    if (disabled) return;
    const btn = ref.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);

      gsap.fromTo(btn, { scale: 0.93 }, { scale: 1, duration: 0.35, ease: 'elastic.out(1, 0.5)' });
    }
    onClick?.();
  }, [disabled, onClick]);

  const handleMouseMove = useCallback((e) => {
    if (!ref.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(ref.current, { x: x * 0.12, y: y * 0.12, duration: 0.25, ease: 'power2.out' });
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    if (!ref.current) return;
    gsap.to(ref.current, { x: 0, y: 0, duration: 0.4, ease: 'elastic.out(1, 0.5)' });
  }, []);

  return (
    <div className="magnetic-wrap" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <button ref={ref} className={className} onClick={handleClick} disabled={disabled}>
        {children}
      </button>
    </div>
  );
}

export default function Controls({ lang, ble, onTare, onBrew, onPause, onStop }) {
  const disabled = ble !== 'connected';

  return (
    <div className="controls-grid">
      <RippleButton className="btn btn-secondary" onClick={onTare} disabled={disabled}>
        {t('tare', lang)}
      </RippleButton>
      <RippleButton className="btn btn-primary" onClick={onBrew} disabled={disabled}>
        {t('brew', lang)}
      </RippleButton>
      <RippleButton className="btn btn-secondary" onClick={onPause} disabled={disabled}>
        {t('pause', lang)}
      </RippleButton>
      <RippleButton className="btn btn-danger" onClick={onStop} disabled={disabled}>
        {t('stop', lang)}
      </RippleButton>
    </div>
  );
}
