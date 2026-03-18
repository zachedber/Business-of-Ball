'use client';
import { useState } from 'react';
import { setNarrativeApiKey, hasNarrativeApi } from '@/lib/narrative';

// ============================================================
// SETTINGS
// ============================================================
export default function Settings({ onDelete, setScreen }) {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  function saveApiKey() {
    if (apiKey.trim()) {
      setNarrativeApiKey(apiKey.trim());
      try { localStorage.setItem('bob_api', apiKey.trim()); } catch {}
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }
  return (
    <div style={{ maxWidth: 550, margin: '0 auto', padding: '30px 16px' }}>
      <h2 className="font-display section-header" style={{ fontSize: '1.2rem' }}>Settings</h2>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 className="font-display" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Claude API (Optional)</h3>
        <p className="font-body" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: 10 }}>Enables AI-generated narratives. Game works without it.</p>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="font-mono"
            style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--cream-darker)', borderRadius: 2, fontSize: '0.75rem', background: 'var(--cream)' }}
          />
          <button className="btn-secondary" onClick={saveApiKey}>{saved ? 'Saved' : 'Save'}</button>
        </div>
        <div className="font-mono" style={{ fontSize: '0.7rem', color: hasNarrativeApi() ? 'var(--green)' : 'var(--ink-muted)', marginTop: 6 }}>
          {hasNarrativeApi() ? 'AI Active' : 'Procedural mode'}
        </div>
      </div>
      <div className="card" style={{ padding: 16, borderColor: 'var(--red)' }}>
        <button
          className="btn-secondary"
          style={{ borderColor: 'var(--red)', color: 'var(--red)', fontSize: '0.75rem' }}
          onClick={() => { if (confirm('Delete all save data?')) { onDelete(); setScreen('intro'); } }}
        >
          Delete Save Data
        </button>
      </div>
    </div>
  );
}
