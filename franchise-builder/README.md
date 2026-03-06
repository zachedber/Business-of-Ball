# Franchise Builder V2

A deep, replayable sports empire management game. Build and manage franchises across the National Gridiron League (NGL) and American Basketball League (ABL).

## Features (Phase 1)
- **62 AI teams** across two leagues with full season simulation
- **Complete GM toolkit**: roster management, salary cap, contracts, injuries
- **Draft system** with scouting and prospect evaluation
- **Player development** with aging, traits, and career arcs
- **Financial management**: revenue, expenses, ticket pricing, staff
- **Facility upgrades**: scouting, development, medical, marketing
- **Broadcast-style UI**: ESPN/newsprint aesthetic with live ticker
- **AI Narratives** (optional): Claude API for dynamic season recaps, GM grades, and events
- **Auto-save**: Local storage persistence with Supabase ready

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Claude API (Optional)
Add your Claude API key in Settings to enable AI-generated narratives. The game works perfectly without it using procedural text generation.

## Tech Stack
- Next.js 15 + React 19
- Tailwind CSS 4
- Local Storage persistence (Supabase-ready)
- Pure-math ML models for attendance, development, and injury prediction

## Deployment
Deploy to Vercel with one click — no configuration needed.
