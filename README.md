# POLARIS

**Polar Logistics, Operations, Resource & Asset Intelligence System**

An integrated polar expedition logistics and asset management platform for the Ministry of Earth Sciences (MoES).

> Smart India Hackathon 2026 — SIH26062

## Overview

POLARIS is a hybrid operations platform combining:

- **Central Command Center** — global oversight of all expeditions, stations, assets, logistics, and risks
- **Individual Expedition Workspaces** — focused operational workspace for each expedition

### MVP Scope

1. Command Center Dashboard
2. Expedition Management
3. Asset Management
4. Inventory & Supplies
5. Logistics / Shipment Management
6. Risk & Alerts
7. AI Copilot (grounded in system data)
8. What-if Operational Simulation

## Architecture

**Modular monolith** built with:

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Database**: Supabase PostgreSQL (direct client, no ORM)
- **Styling**: Tailwind CSS
- **Auth**: Supabase Auth + PostgreSQL RLS

See [docs/architecture.md](docs/architecture.md) for the full architecture reference.

## Project Structure

```
src/
├── app/                    # Next.js App Router (pages, layouts, routes)
├── modules/                # Business domain modules
│   ├── expedition/         #   Expedition lifecycle & membership
│   ├── asset/              #   Physical asset management
│   ├── inventory/          #   Consumable stock & transactions
│   ├── logistics/          #   Shipments & movement
│   ├── risk/               #   Risk assessments & alerts
│   └── simulation/         #   What-if scenarios
├── core/                   # Shared reference & utilities
│   ├── station/            #   Station reference data
│   ├── geography/          #   Geographic utilities
│   ├── errors/             #   Error types & handling
│   └── types/              #   Shared type definitions
├── integrations/           # External data adapters
│   ├── npdc/               #   NCPOR / NPDC
│   ├── era5/               #   Copernicus ERA5 reanalysis
│   ├── nsidc/              #   NSIDC sea-ice data
│   └── osm/                #   OpenStreetMap
├── intelligence/           # AI & reasoning layer
│   ├── ai/                 #   AI copilot core
│   ├── tools/              #   Domain tools for AI
│   └── prompts/            #   Prompt templates
└── infrastructure/         # Platform services
    ├── db/                 #   Database client & utilities
    ├── auth/               #   Authentication & authorization
    ├── storage/            #   File/object storage
    └── observability/      #   Logging & monitoring

supabase/
├── migrations/             # Versioned database migrations
└── seed/                   # Seed data scripts

docs/
├── architecture.md         # Architecture & module boundaries
├── development-workflow.md # Milestone workflow & quality standards
└── data-strategy.md        # Data layers & integration strategy
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.18+ or v20+)
- npm (ships with Node.js)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd POLARIS

# Install dependencies
npm install

# Create local environment file
cp .env.example .env.local
# Edit .env.local with your actual credentials
```

### Development

```bash
# Start development server
npm run dev

# Run linter
npm run lint

# Type check
npm run typecheck

# Production build
npm run build
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Supabase service role key |
| `ERA5_API_KEY` | Server | Copernicus CDS API key |

See [.env.example](.env.example) for the complete list.

## Documentation

- [Architecture](docs/architecture.md) — system architecture, module boundaries, security model
- [Development Workflow](docs/development-workflow.md) — milestone process, quality standards, conventions
- [Data Strategy](docs/data-strategy.md) — data layers, external integrations, seed data principles

## License

This project is developed for the Smart India Hackathon 2026.
