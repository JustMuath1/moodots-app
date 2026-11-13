import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { t } from '../utils/i18n';

function SignalBars({ rssi }) {
  // rssi null = currently connected (not advertising)
  const level = rssi == null ? 4 : rssi > -60 ? 4 : rssi > -70 ? 3 : rssi > -80 ? 2 : 1;
  return (
    <span className="sig-bars" aria-hidden="true">
      {[1, 2, 3, 4].map((b) => <span key={b} className={b <= level ? 'on' : ''} style={{ height: `${b * 25}%` }} />)}
    </span>
  );
}

export default function ConnectionModal({
  lang, ble, machineName, selectedMachine, sleeping, devices,
  onConnect, onDisconnect, onWake, onScanDevices, onSelectMachine, onClose,
}) {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current, { scale: 0.92, opacity: 0, y: 20 }, {
      scale: 1, opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.5)',
    });
    onScanDevices();
  }, []);

  const handleClose = () => {
    gsap.to(modalRef.current, { scale: 0.95, opacity: 0, y: 10, duration: 0.2, ease: 'power2.in' });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, onComplete: onClose });
  };

  const machineList = selectedMachine && !devices.list.some((d) => d.name.toUpperCase() === selectedMachine.toUpperCase())
    ? [{ name: selectedMachine, rssi: null, missing: true }, ...devices.list]
    : devices.list;

  const isConnected = ble === 'connected';
  const isScanning = ble === 'scanning' || ble === 'connecting';
  const isError = ble === 'error';
  const noPermission = ble === 'no_permission';

  const dotColor = isConnected
    ? (sleeping ? 'var(--accent)' : 'var(--ok-fg)')
    : isScanning ? 'var(--accent)'
    : isError || noPermission ? 'var(--stop-fg)'
    : 'var(--muted-2)';

  const dotGlow = isConnected && !sleeping
    ? '0 0 8px var(--ok-fg)'
    : isConnected && sleeping ? '0 0 8px var(--accent)' : 'none';

  const statusLabel = isConnected
    ? (sleeping ? t('machineSleeping', lang) : (machineName || 'xBloom'))
    : isScanning ? t('scanning', lang)
    : isError ? t('scanError', lang)
    : noPermission ? t('noPermission', lang)
    : t('disconnected', lang);

  const subLabel = isConnected
    ? (sleeping ? t('sleepingTapWake', lang) : t('connectedReady', lang))
    : isScanning ? t('lookingForXbloom', lang)
    : isError ? t('retrying', lang)
    : t('notConnected', lang);

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleClose}>
      <div className="modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t('connect', lang)}</div>

        {/* Machine card */}
        <div className="conn-machine-card">
          <div className="conn-machine-icon">
            {isScanning ? (
              <div className="conn-scan-ring" />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {isConnected ? (
                  <>
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                    <line x1="6" y1="1" x2="6" y2="4"/>
                    <line x1="10" y1="1" x2="10" y2="4"/>
                    <line x1="14" y1="1" x2="14" y2="4"/>
                  </>
                ) : (
                  <>
                    <path d="M6.5 6.5h11a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2z"/>
                    <path d="M8.5 10.5v7"/>
                    <path d="M15.5 10.5v7"/>
                    <path d="M5 17.5h14"/>
                  </>
                )}
              </svg>
            )}
          </div>
          <div className="conn-machine-info">
            <div className="conn-machine-name">{statusLabel}</div>
            <div className="conn-machine-sub">
              <span className="conn-status-dot" style={{ background: dotColor, boxShadow: dotGlow }} />
              {subLabel}
            </div>
          </div>
        </div>

        {/* Paired machine name tag */}
        {isConnected && machineName && (
          <div className="conn-paired-tag">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="4.5 12.75 10.5 18.75 19.5 5.25"/>
            </svg>
            <span>{t('paired', lang)} · {machineName}</span>
          </div>
        )}

        {/* Machine picker */}
        <div className="machine-picker">
          <div className="machine-picker-head">
            <span>{t('machines', lang)}</span>
            <button
              className="machine-rescan"
              onClick={onScanDevices}
              disabled={devices.scanning || isScanning}
            >
              {devices.scanning ? <span className="conn-scan-ring small" /> : t('scanAgain', lang)}
            </button>
          </div>
          {machineList.length > 0 && (
            <div className="machine-list" role="radiogroup" aria-label={t('machines', lang)}>
              {machineList.map((d) => {
                const isSel = (selectedMachine || '').toUpperCase() === d.name.toUpperCase();
                const isLive = isConnected && (machineName || '').toUpperCase() === d.name.toUpperCase();
                return (
                  <button
                    key={d.name}
                    role="radio"
                    aria-checked={isSel}
                    className={`machine-row${isSel ? ' selected' : ''}`}
                    onClick={() => onSelectMachine(d.name)}
                    disabled={isScanning}
                  >
                    <span className={`recipe-dot ${isSel ? 'on' : 'off'}`} />
                    <span className="machine-row-name" dir="ltr">{d.name}</span>
                    {isLive && <span className="machine-live">{t('connected', lang)}</span>}
                    {d.missing && !isLive
                      ? <span className="machine-missing">{devices.scanning ? '…' : t('notFound', lang)}</span>
                      : <SignalBars rssi={d.rssi} />}
                  </button>
                );
              })}
            </div>
          )}
          {devices.list.length === 0 && (
            <div className="machine-empty">
              {devices.scanning ? t('searchingMachines', lang)
                : devices.error === 'busy' ? t('lookingForXbloom', lang)
                : devices.error ? `${t('scanError', lang)}: ${devices.error}`
                : t('noMachinesFound', lang)}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="conn-actions">
          {isConnected && sleeping && (
            <button className="conn-btn conn-btn-wake" onClick={() => { onWake(); handleClose(); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
              {t('wakeUp', lang)}
            </button>
          )}

          {isConnected && !sleeping && (
            <button className="conn-btn conn-btn-disconnect" onClick={() => { onDisconnect(); handleClose(); }}>
              {t('disconnect', lang)}
            </button>
          )}

          {!isConnected && (
            <button className="conn-btn conn-btn-connect" onClick={onConnect} disabled={isScanning}>
              {isScanning ? (
                <>
                  <div className="conn-btn-spinner" />
                  {t('scanning', lang)}
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6.5 6.5 17.5 12 6.5 17.5 12 12z"/>
                  </svg>
                  {t('connect', lang)}
                </>
              )}
            </button>
          )}

          <button className="conn-btn conn-btn-ghost" onClick={handleClose}>
            {t('cancel', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
