import React from 'react';

const accentClasses = {
  charity: 'border-l-4 border-green-500 bg-green-50/60',
  drama: 'border-l-4 border-amber-500 bg-amber-50/60',
  criminal: 'border-l-4 border-red-500 bg-red-50/60',
};

const typeLabelClasses = {
  charity: 'text-green-700 bg-green-100',
  drama: 'text-amber-800 bg-amber-100',
  criminal: 'text-red-700 bg-red-100',
};

export default function EventNotificationCard({
  type,
  playerName,
  description,
}) {
  return (
    <article
      className={`rounded-lg border border-slate-200 p-4 shadow-sm ${accentClasses[type]}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-slate-900">
          {playerName}
        </h3>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${typeLabelClasses[type]}`}
        >
          {type}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-slate-700">{description}</p>
    </article>
  );
}
