'use client';

import StadiumManagementSection from '@/app/components/StadiumManagementSection';

export default function StadiumTab({ fr, setFr, season }) {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StadiumManagementSection fr={fr} setFr={setFr} season={season} />
    </div>
  );
}
