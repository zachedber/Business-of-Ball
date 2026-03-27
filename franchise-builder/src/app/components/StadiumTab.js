'use client';
import { useState, useEffect } from 'react';
import StadiumManagementSection from '@/app/components/StadiumManagementSection';

function PricingSlider({ label, value, min, max, step, sweetSpot, onChange, onCommit }) {
  const isOverpriced = value > sweetSpot;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span className="stat-label" style={{ fontSize: '0.72rem' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="font-mono" style={{ fontSize: '0.78rem', fontWeight: 700 }}>${value}</span>
          {isOverpriced && <span className="badge badge-red" style={{ fontSize: '0.58rem' }}>GOUGING</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        onMouseUp={e => onCommit(Number(e.currentTarget.value))}
        onTouchEnd={e => onCommit(Number(e.currentTarget.value))}
        onKeyUp={e => onCommit(Number(e.currentTarget.value))}
        style={{ width: '100%' }}
      />
      <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--ink-muted)', display: 'flex', justifyContent: 'space-between' }}>
        <span>${min}</span>
        <span>Sweet spot: ${sweetSpot}</span>
        <span>${max}</span>
      </div>
    </div>
  );
}

export default function StadiumTab({ fr, setFr, season }) {
  const pricing = fr.pricing || {};
  const [concessions, setConcessions] = useState(pricing.concessionsPrice || 15);
  const [merch, setMerch] = useState(pricing.merchPrice || 40);
  const [parking, setParking] = useState(pricing.parkingPrice || 25);

  useEffect(() => {
    setConcessions(pricing.concessionsPrice || 15);
    setMerch(pricing.merchPrice || 40);
    setParking(pricing.parkingPrice || 25);
  }, [pricing.concessionsPrice, pricing.merchPrice, pricing.parkingPrice]);

  function commitPricing(key, val) {
    setFr(prev => ({
      ...prev,
      pricing: { ...(prev.pricing || {}), [key]: val },
    }));
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StadiumManagementSection fr={fr} setFr={setFr} season={season} />

      {/* Revenue Pricing Sliders */}
      <div className="card" style={{ padding: 16 }}>
        <h3 className="font-display section-header" style={{ fontSize: '0.9rem' }}>Matchday Revenue Pricing</h3>
        <p className="font-body" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: 12 }}>
          Set prices for concessions, merchandise, and parking. Prices above the sweet spot hurt fan rating.
        </p>
        <PricingSlider
          label="Concessions"
          value={concessions}
          min={5}
          max={40}
          step={1}
          sweetSpot={15}
          onChange={setConcessions}
          onCommit={v => commitPricing('concessionsPrice', v)}
        />
        <PricingSlider
          label="Merchandise"
          value={merch}
          min={15}
          max={80}
          step={5}
          sweetSpot={40}
          onChange={setMerch}
          onCommit={v => commitPricing('merchPrice', v)}
        />
        <PricingSlider
          label="Parking"
          value={parking}
          min={10}
          max={60}
          step={5}
          sweetSpot={25}
          onChange={setParking}
          onCommit={v => commitPricing('parkingPrice', v)}
        />
      </div>
    </div>
  );
}
