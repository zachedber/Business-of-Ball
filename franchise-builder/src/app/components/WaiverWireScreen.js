import React from 'react';

const waiverCandidates = [
  { name: 'Malik Carter', position: 'PG', age: 24, rating: 77 },
  { name: 'Jonah Whitaker', position: 'SG', age: 27, rating: 74 },
  { name: 'Elias Navarro', position: 'SF', age: 22, rating: 72 },
];

export default function WaiverWireScreen() {
  return (
    <section className="card-elevated fade-in space-y-4">
      <header>
        <h2 className="section-header mb-2">Waiver Wire</h2>
        <p className="text-sm text-slate-600">
          Browse available players and submit a waiver claim.
        </p>
      </header>

      <div className="table-wrap overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-display text-xs uppercase tracking-wide text-slate-600">Name</th>
              <th className="px-4 py-3 font-display text-xs uppercase tracking-wide text-slate-600">Position</th>
              <th className="px-4 py-3 font-display text-xs uppercase tracking-wide text-slate-600">Age</th>
              <th className="px-4 py-3 font-display text-xs uppercase tracking-wide text-slate-600">Rating</th>
              <th className="px-4 py-3 font-display text-xs uppercase tracking-wide text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {waiverCandidates.map((player) => (
              <tr key={player.name} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{player.name}</td>
                <td className="px-4 py-3 text-slate-700">{player.position}</td>
                <td className="px-4 py-3 text-slate-700">{player.age}</td>
                <td className="px-4 py-3 text-slate-700">{player.rating}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-blue-700"
                  >
                    Claim
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
