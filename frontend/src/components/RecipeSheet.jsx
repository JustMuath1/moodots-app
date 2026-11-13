import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { t } from '../utils/i18n';

export default function RecipeSheet({ recipe, lang, onClose, onBrew }) {
  const overlayRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.fromTo(sheetRef.current, { y: '100%' }, { y: 0, duration: 0.4, ease: 'power3.out' });
  }, []);

  const handleClose = () => {
    gsap.to(sheetRef.current, { y: '100%', duration: 0.3, ease: 'power2.in' });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.25, onComplete: onClose });
  };

  if (!recipe) return null;

  const details = [
    recipe.bean_weight && { label: 'Bean Weight', val: `${recipe.bean_weight}g` },
    recipe.grind_size && { label: 'Grind Size', val: recipe.grind_size },
    recipe.water_volume && { label: 'Water', val: `${recipe.water_volume}ml` },
    recipe.brew_temp && { label: 'Temp', val: `${recipe.brew_temp}°C` },
    recipe.flow_rate && { label: 'Flow', val: `${recipe.flow_rate} ml/min` },
  ].filter(Boolean);

  return (
    <div className="sheet-overlay" ref={overlayRef} onClick={handleClose}>
      <div className="sheet" ref={sheetRef} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">{recipe.name}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '.75rem', marginBottom: '1.25rem' }}>
          {details.map((d) => (
            <div key={d.label} className="module-stat" style={{ background: 'var(--secondary)', borderRadius: '.75rem' }}>
              <div className="module-stat-val">{d.val}</div>
              <div className="module-stat-label">{d.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onBrew}>
            {t('brewRecipe', lang)}
          </button>
          <button className="btn btn-ghost" onClick={handleClose}>
            {t('cancel', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
