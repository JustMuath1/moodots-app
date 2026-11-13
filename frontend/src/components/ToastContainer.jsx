import React from 'react';
import { LogoMark } from './Logo';

export default function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.level}${toast.exiting ? ' toast-exit' : ''}`}
        >
          <LogoMark size={22} className="toast-logo" />
          <span className="toast-msg">{toast.msg}</span>
        </div>
      ))}
    </div>
  );
}
