import React, { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { t } from '../utils/i18n';

export default function CloudAccount({ lang, loggedIn, email, showToast, onClose }) {
  const [emailVal, setEmailVal] = useState('');
  const [passVal, setPassVal] = useState('');
  const [loading, setLoading] = useState(false);
  const overlayRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current, { scale: 0.92, opacity: 0, y: 20 }, {
      scale: 1, opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.5)',
    });
  }, []);

  const handleClose = () => {
    gsap.to(modalRef.current, { scale: 0.95, opacity: 0, y: 10, duration: 0.2, ease: 'power2.in' });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, onComplete: onClose });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/cloud/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, password: passVal }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Logged in — syncing recipes…', 'success');
        await fetch('/api/cloud/sync', { method: 'POST' });
        handleClose();
      } else {
        showToast(data.error || 'Login failed', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
    setLoading(false);
  };

  const handleSync = async () => {
    try {
      await fetch('/api/cloud/sync', { method: 'POST' });
      showToast('Recipes synced', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/cloud/logout', { method: 'POST' });
      showToast('Signed out', 'info');
      handleClose();
    } catch {}
  };

  const inputStyle = {
    padding: '10px 14px',
    borderRadius: '12px',
    border: '1px solid var(--line)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '15px',
    fontFamily: 'inherit',
    width: '100%',
    outline: 'none',
  };

  const btnBase = {
    height: '48px',
    borderRadius: '14px',
    fontSize: '15px',
    fontWeight: 700,
    border: 'none',
    padding: '0 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleClose}>
      <div className="modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t('cloudAccount', lang)}</div>

        {loggedIn ? (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
              padding: '12px', borderRadius: '14px', background: 'var(--surface)',
              border: '1px solid var(--line)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--on-accent)', fontWeight: 700, fontSize: '14px', flexShrink: 0,
              }}>
                {(email || '?')[0].toUpperCase()}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--muted-2)' }}>{email}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ ...btnBase, flex: 1, background: 'var(--accent)', color: 'var(--on-accent)' }} onClick={handleSync}>
                {t('sync', lang)}
              </button>
              <button style={{ ...btnBase, background: 'transparent', border: '1px solid var(--line-2)', color: 'var(--muted-2)' }} onClick={handleLogout}>
                {t('logout', lang)}
              </button>
            </div>
          </div>
        ) : (
          <form style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} onSubmit={handleLogin}>
            <input
              type="email"
              placeholder={t('email', lang)}
              value={emailVal}
              onChange={(e) => setEmailVal(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder={t('password', lang)}
              value={passVal}
              onChange={(e) => setPassVal(e.target.value)}
              required
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ ...btnBase, flex: 1, background: 'var(--accent)', color: 'var(--on-accent)' }} type="submit" disabled={loading}>
                {loading ? '…' : t('login', lang)}
              </button>
              <button style={{ ...btnBase, background: 'transparent', border: '1px solid var(--line-2)', color: 'var(--muted-2)' }} type="button" onClick={handleClose}>
                {t('cancel', lang)}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
