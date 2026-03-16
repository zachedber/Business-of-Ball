'use client';
import { useState } from 'react';

// ============================================================
// NOTIFICATIONS PANEL
// Dismissable alert list with info / warning / critical severity
// ============================================================

const SEVERITY_STYLES = {
  info:     { bg: '#e8f0fb', border: 'var(--blue)',  color: 'var(--blue)',  icon: 'ℹ' },
  warning:  { bg: '#fff3e0', border: 'var(--amber)', color: 'var(--amber)', icon: '⚠' },
  critical: { bg: '#fde8e8', border: 'var(--red)',   color: 'var(--red)',   icon: '🚨' },
};

/**
 * NotificationsPanel — renders dismissable alert cards.
 *
 * @param {Array}    notifications - Array of {id, severity, message, type}
 * @param {function} onDismiss     - Called with notification id to dismiss it
 */
export default function NotificationsPanel({ notifications, onDismiss }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {notifications.map(note => {
        const style = SEVERITY_STYLES[note.severity] || SEVERITY_STYLES.info;
        return (
          <div
            key={note.id}
            className="fade-in"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 14px',
              background: style.bg,
              border: `1px solid ${style.border}`,
              borderLeft: `4px solid ${style.border}`,
              borderRadius: 2,
            }}
          >
            <span style={{ fontSize: '0.9rem', flexShrink: 0, marginTop: 1 }}>{style.icon}</span>
            <span
              className="font-body"
              style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', flex: 1, lineHeight: 1.4 }}
            >
              {note.message}
            </span>
            <button
              onClick={() => onDismiss(note.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ink-muted)',
                fontSize: '0.9rem',
                padding: '0 2px',
                flexShrink: 0,
                lineHeight: 1,
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * NotificationBadge — compact red dot + count for mobile nav.
 *
 * @param {number} count - Number of active notifications
 */
export function NotificationBadge({ count }) {
  if (!count) return null;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 16,
      height: 16,
      background: 'var(--red)',
      color: '#fff',
      borderRadius: '50%',
      fontSize: '0.55rem',
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      marginLeft: 3,
      verticalAlign: 'middle',
    }}>
      {count > 9 ? '9+' : count}
    </span>
  );
}
