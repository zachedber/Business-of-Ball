'use client';
import { useState } from 'react';

// ============================================================
// HELP TEXT — tooltip definitions for all key stats
// ============================================================
export const HELP_TEXT = {
  fanRating: 'Fan loyalty (0-100). Drives attendance, merchandise, and naming rights interest. Boosted by winning, marketing staff, and community events. Hurt by losing, overpriced tickets, and rival stakes.',
  lockerRoomChemistry: 'Team chemistry (0-100). Affects win probability. Boosted by coach personality, stable roster, and consecutive winning. Hurt by player turnover and volatile traits.',
  mediaRep: 'Media reputation (0-100). Influences free agent interest and naming rights value. Grows with winning and showman players. Falls with losing and scandals.',
  communityRating: 'Community standing (0-100). Affects public funding approval for stadium projects and political event outcomes.',
  revenue: 'Total seasonal revenue from gate receipts, TV deals, merchandise, naming rights, premium seating, and revenue sharing.',
  profit: 'Revenue minus expenses (salaries, staff, stadium maintenance, debt interest). Positive profit adds to liquid capital.',
  cash: 'Liquid capital available for spending. All purchases, upgrades, and signings require sufficient cash. Cannot go below $0.',
  debt: 'Outstanding loans at 8% annual interest. Max debt is 40% of franchise valuation. Interest is deducted from profit each season.',
  valuation: 'Estimated franchise value based on market size, wins, fan rating, stadium, and revenue. Determines max loan amount and GM reputation.',
  slotBudget: 'Annual salary budget for your 3 roster slots (Star 1, Star 2, Core Piece). Separate from liquid capital.',
  capSpace: 'Remaining salary cap space. The cap grows 3% per season from base inflation.',
  schemeFit: 'How well your coordinators\' schemes complement each other and the head coach (0-100). High fit = win% bonus, low fit = penalty.',
  staffChemistry: 'How well your coaching staff works together (0-100). Tenure and compatible personalities increase chemistry.',
  stadiumCondition: 'Physical condition of stadium (0-100). Degrades with age. Low condition hurts fan rating and attendance.',
  stadiumCapacity: 'Maximum seating capacity. Higher capacity = more gate revenue potential. Determined by stadium tier.',
  gmRep: 'GM Reputation determines access to better coaches and free agents. Grows with winning, smart financial moves, and championships.',
  scoutingStaff: 'Scouting investment (1-3). Higher levels reveal more accurate draft prospect ratings.',
  developmentStaff: 'Player development (1-3). Higher levels boost annual player rating growth.',
  medicalStaff: 'Medical staff (1-3). Higher levels reduce injury frequency and severity.',
  marketingStaff: 'Marketing investment (1-3). Higher levels boost fan rating growth.',
  trainingFacility: 'Training facility quality (1-3). Higher levels provide a win probability bonus.',
  rosterQuality: 'Overall roster strength based on star players, depth quality, and coach level.',
  attendance: 'Percentage of stadium capacity filled on game days. Driven by fan rating, ticket price, team quality, and stadium condition.',
  economyCycle: 'City economic conditions cycle between Boom (+revenue), Stable, and Recession (-revenue) every few seasons.',
  ticketPrice: 'Base ticket price. Higher prices increase per-ticket revenue but reduce attendance if team quality doesn\'t match.',
  luxuryBoxes: 'Premium luxury suites generating $0.8M/yr each. Cost $2M to install.',
  clubSeatSections: 'Premium club seat sections generating $0.15M/yr each (win-adjusted). Cost $0.5M each.',
};

// ============================================================
// HELP TOOLTIP COMPONENT
// ============================================================
export default function HelpTooltip({ statKey, children, style }) {
  const [show, setShow] = useState(false);
  const text = HELP_TEXT[statKey];
  if (!text) return children || null;

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3, ...style }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow(s => !s); }}
    >
      {children}
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 14, height: 14, borderRadius: '50%',
          background: 'var(--cream-darker)', color: 'var(--ink-muted)',
          fontSize: '0.55rem', fontWeight: 700, cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        ?
      </span>
      {show && (
        <span
          style={{
            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--ink)', color: 'var(--cream)', padding: '8px 12px',
            borderRadius: 4, fontSize: '0.68rem', lineHeight: 1.4,
            width: 220, maxWidth: '80vw', zIndex: 100,
            marginBottom: 6, pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
          className="font-body"
        >
          {text}
        </span>
      )}
    </span>
  );
}
