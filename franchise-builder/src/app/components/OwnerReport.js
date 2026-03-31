'use client';
import { useState, useMemo } from 'react';
import { buildOwnerReport } from '@/lib/economy/ownerReport';

/**
 * OwnerReport — Tabbed post-season analysis card.
 *
 * "Summary" sub-tab: existing recap text + grade.
 * "Analysis" sub-tab: five-section deep dive.
 *
 * Only renders when recap is truthy (i.e. after a season has been simulated).
 */
export default function OwnerReport({ fr, recap, grade }) {
  const [subTab, setSubTab] = useState('summary');

  const report = useMemo(() => {
    if (!fr?.history?.length) return null;
    const currentIdx = fr.history.length - 1;
    const prev = currentIdx > 0 ? fr.history[currentIdx - 1] : null;
    return buildOwnerReport(fr, prev);
  }, [fr]);

  if (!report) return null;

  return (
    <div className="card" style={{ background: 'linear-gradient(180deg,rgba(212,168,67,0.08),rgba(255,255,255,0.4))' }}>
      <h3 className="font-display section-header" style={{ fontSize: '0.9rem', marginBottom: 0 }}>Owner Report</h3>

      {/* Sub-tab nav */}
      <div className="tab-nav" style={{ marginBottom: 12 }}>
        {[['summary', 'Summary'], ['analysis', 'Analysis']].map(([key, label]) => (
          <button
            key={key}
            className={`tab-btn${subTab === key ? ' active' : ''}`}
            onClick={() => setSubTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'summary' && (
        <SummaryTab recap={recap} grade={grade} />
      )}

      {subTab === 'analysis' && (
        <AnalysisTab report={report} />
      )}
    </div>
  );
}

// ── Summary Sub-tab (preserves existing recap card content) ──────────

function SummaryTab({ recap, grade }) {
  return (
    <div>
      <p className="font-body" style={{ lineHeight: 1.6, color: 'var(--ink-soft)', fontSize: '0.85rem' }}>{recap}</p>
      {grade && (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(26,18,8,0.08)' }}>
          <span className="font-display" style={{ fontSize: '2.6rem', lineHeight: 1, fontWeight: 700, color: gradeColor(grade.grade) }}>
            {grade.grade}
          </span>
          <span className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{grade.analysis}</span>
        </div>
      )}
    </div>
  );
}

// ── Analysis Sub-tab (five sections) ─────────────────────────────────

function AnalysisTab({ report }) {
  const { onField, fanSentiment, finances, valuation, verdict } = report;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. On-Field Results */}
      <Section title="On-Field Results" accentVar="--info">
        <StatRow label="Record" value={onField.record} />
        <StatRow
          label="vs Expectation"
          value={onField.expectation === 'above' ? 'Above expected' : onField.expectation === 'below' ? 'Below expected' : 'Met expectations'}
          color={onField.expectation === 'above' ? 'var(--profit)' : onField.expectation === 'below' ? 'var(--loss)' : 'var(--ink-soft)'}
        />
        <StatRow label="Primary driver" value={capitalize(onField.primaryDriver)} />
        <Note text={onField.injuryNote} />
      </Section>

      {/* 2. Fan Sentiment */}
      <Section title="Fan Sentiment" accentVar="--media">
        <StatRow label="Rating" value={fanSentiment.current} />
        <StatRow
          label="Change"
          value={deltaLabel(fanSentiment.delta)}
          color={fanSentiment.delta > 0 ? 'var(--profit)' : fanSentiment.delta < 0 ? 'var(--loss)' : 'var(--ink-soft)'}
        />
        <StatRow label="Primary driver" value={capitalize(fanSentiment.primaryDriver)} />
      </Section>

      {/* 3. Financial Performance */}
      <Section title="Financial Performance" accentVar="--profit">
        <StatRow label="Revenue" value={`$${finances.revenue}M`} />
        <StatRow label="Expenses" value={`$${finances.expenses}M`} />
        <StatRow
          label="Profit"
          value={`$${finances.profit}M`}
          color={finances.profit >= 0 ? 'var(--profit)' : 'var(--loss)'}
        />
        <StatRow label="Profit vs last season" value={deltaLabel(finances.delta.profit, '$', 'M')} color={finances.delta.profit >= 0 ? 'var(--profit)' : 'var(--loss)'} />
        <StatRow label="Primary driver" value={capitalize(finances.primaryDriver)} />
        {finances.cashWarning && (
          <Note text="Cash reserves below $20M — financial flexibility is severely limited." warn />
        )}
      </Section>

      {/* 4. Valuation Movement */}
      <Section title="Valuation Movement" accentVar="--legacy">
        <StatRow label="Current valuation" value={`$${valuation.current}M`} />
        <StatRow
          label="Change"
          value={deltaLabel(valuation.delta, '$', 'M')}
          color={valuation.delta > 0 ? 'var(--profit)' : valuation.delta < 0 ? 'var(--loss)' : 'var(--ink-soft)'}
        />
        <StatRow label="Top factor" value={capitalize(valuation.primaryDriver)} />
      </Section>

      {/* 5. Front Office Verdict */}
      <Section title="Front Office Verdict" accentVar="--gold">
        <VerdictRow label="Biggest success" text={verdict.success} />
        <VerdictRow label="Biggest failure" text={verdict.failure} />
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(26,18,8,0.08)' }}>
          <span className="font-display" style={{ fontSize: '2.6rem', lineHeight: 1, fontWeight: 700, color: gradeColor(verdict.grade) }}>
            {verdict.grade}
          </span>
          <span className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{verdict.gradeReason}</span>
        </div>
      </Section>
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────

function Section({ title, accentVar, children }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.5)', border: '1px solid var(--border-soft)', borderLeft: `3px solid var(${accentVar})` }}>
      <h4 className="font-display" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: `var(${accentVar})`, marginBottom: 8 }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
      <span className="stat-label" style={{ fontSize: '0.75rem' }}>{label}</span>
      <span className="font-mono" style={{ fontSize: '0.78rem', fontWeight: 600, color: color || 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function Note({ text, warn }) {
  return (
    <p className="font-body" style={{
      fontSize: '0.76rem',
      color: warn ? 'var(--warn)' : 'var(--ink-muted)',
      lineHeight: 1.45,
      marginTop: 6,
      padding: warn ? '6px 8px' : 0,
      borderRadius: warn ? 6 : 0,
      background: warn ? 'rgba(217,119,6,0.08)' : 'transparent',
    }}>
      {text}
    </p>
  );
}

function VerdictRow({ label, text }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span className="stat-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>{label}</span>
      <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', lineHeight: 1.5, margin: 0 }}>{text}</p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function gradeColor(g) {
  if (!g) return 'var(--ink)';
  if (g.startsWith('A')) return 'var(--profit)';
  if (g.startsWith('B')) return 'var(--warn)';
  return 'var(--loss)';
}

function deltaLabel(val, prefix = '', suffix = '') {
  if (val === 0 || val == null) return 'No change';
  const sign = val > 0 ? '+' : '';
  return `${sign}${prefix}${val}${suffix}`;
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
