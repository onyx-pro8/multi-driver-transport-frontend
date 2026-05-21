# Multi-Driver H3 — Frontend (Milestone 1)

Next.js 14 + TypeScript + Tailwind CSS dashboard for H3 conversion and driver zone management.

## Prerequisites

- Node.js 18+
- Backend API running (see `../backend/README.md`)

## Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open **http://localhost:3000**

## Features (Milestone 1)

- Light / dark mode toggle
- Step workflow: Convert → Create Zones → Review
- Coordinate → H3 conversion with copyable results
- Driver zone creation (map click or manual H3 IDs)
- Leaflet map with H3 hexagon overlays
- Driver zones table (view / edit / delete)
- Reserved section for future multi-driver path visualization

## Structure

```
app/                   # Next.js app router
components/
  ui/                  # Reusable UI primitives
  layout/              # Sidebar, header, shell
  map/                 # H3MapView (reusable for Milestone 7)
  driver-zones/        # Milestone 1 feature components
lib/                   # API client, utilities
types/                 # Shared TypeScript types
public/logo.png        # App logo
```
