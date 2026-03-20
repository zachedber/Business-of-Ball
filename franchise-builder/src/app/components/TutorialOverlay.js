'use client';
import { useState } from 'react';

const STEPS = [
  {
    title: 'Welcome to Business of Ball',
    body: 'You are the GM and owner of a sports franchise. Your job is to build a winning team, grow revenue, and become a dynasty. Every decision affects the others.',
  },
  {
    title: 'Your roster: slots + taxi squad',
    body: 'You manage three starting player slots \u2014 Star 1, Star 2, and Core Piece. Draft prospects land on your Taxi Squad (up to 4) for development before you promote them. Let contracts expire and you lose the player.',
  },
  {
    title: 'How a season works',
    body: 'Simulate the first half, make moves at the Trade Deadline, then simulate the second half. After the season: playoffs, draft, free agency \u2014 then it starts again.',
  },
  {
    title: 'GM Reputation matters',
    body: 'Your rep score affects which free agents will sign with you, how much they cost, and what draft position you get. Win games, spend wisely, and keep your fanbase happy to build rep.',
  },
  {
    title: 'Cash vs franchise value',
    body: 'Cash is liquid money you spend right now. Franchise value is your net worth \u2014 it grows with wins, stadium upgrades, and fan rating. Don\u2019t run out of cash.',
  },
  {
    title: "You're ready",
    body: 'Start by simulating your first season. Check the Finance and Biz tabs to understand your revenue. Good luck.',
  },
];

export default function TutorialOverlay({ onClose }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(14,17,23,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 16,
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 16, maxWidth: 480, width: '100%',
        padding: '32px 28px 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        position: 'relative',
      }}>
        {/* Skip link */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 18,
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
            color: 'var(--ink-muted)', textDecoration: 'underline',
          }}
        >
          Skip tutorial
        </button>

        {/* Title */}
        <h2 className="font-display" style={{
          fontSize: '1.15rem', fontWeight: 700, marginBottom: 12,
          textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink)',
        }}>
          {current.title}
        </h2>

        {/* Body */}
        <p className="font-body" style={{
          fontSize: '0.88rem', lineHeight: 1.65, color: 'var(--ink-soft)',
          marginBottom: 24, minHeight: 72,
        }}>
          {current.body}
        </p>

        {/* Step dots */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20,
        }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === step ? 'var(--team-primary)' : 'var(--border)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="btn-secondary"
            style={{ fontSize: '0.78rem', padding: '7px 16px', opacity: step === 0 ? 0.3 : 1 }}
          >
            Previous
          </button>
          {isLast ? (
            <button
              onClick={onClose}
              className="btn-primary"
              style={{ fontSize: '0.82rem', padding: '9px 24px' }}
            >
              Let&apos;s play
            </button>
          ) : (
            <button
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              className="btn-primary"
              style={{ fontSize: '0.78rem', padding: '7px 20px' }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
