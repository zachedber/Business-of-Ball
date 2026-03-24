import React from 'react';

export default function TrainingCampScreen() {
  return (
    <section className="card-elevated fade-in max-w-2xl space-y-6">
      <header className="space-y-2">
        <h2 className="section-header mb-0">Training Camp</h2>
        <p className="text-sm text-slate-600">
          Allocate focus points before opening night. Fine-tune your roster priorities.
        </p>
      </header>

      <div className="space-y-5">
        <label className="block space-y-2">
          <span className="font-display text-xs uppercase tracking-wide text-slate-700">Offense Focus</span>
          <input type="range" min={0} max={100} defaultValue={50} className="w-full accent-blue-600" />
        </label>

        <label className="block space-y-2">
          <span className="font-display text-xs uppercase tracking-wide text-slate-700">Defense Focus</span>
          <input type="range" min={0} max={100} defaultValue={50} className="w-full accent-emerald-600" />
        </label>

        <label className="block space-y-2">
          <span className="font-display text-xs uppercase tracking-wide text-slate-700">Conditioning</span>
          <input type="range" min={0} max={100} defaultValue={50} className="w-full accent-amber-500" />
        </label>
      </div>

      <div className="pt-2">
        <button
          type="button"
          className="w-full rounded-md bg-slate-900 px-4 py-3 font-display text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-slate-800"
        >
          Start Season
        </button>
      </div>
    </section>
  );
}
