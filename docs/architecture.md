# POLARIS — Architecture

## 1. Overview
**POLARIS** (Polar Logistics, Operations, Resource & Asset Intelligence System) is a comprehensive polar expedition logistics and asset management platform. The system is built as a **modular monolith** utilizing **Next.js 15**, **TypeScript**, and **Supabase PostgreSQL**.

---

## 2. Architecture Pattern
- **Pattern**: Modular Monolith (not microservices).
- **Rationale**: 
  - Aligned with single-team execution and rapid delivery timelines (e.g., Smart India Hackathon).
  - Minimizes operational and deployment complexity while preserving strict internal domain boundaries.
  - Keeps code modular within a single codebase so individual modules or services can be cleanly extracted later if scaling requirements dictate.

---

## 3. Request Flow
POLARIS enforces a strict unidirectional request flow. API routes function solely as transport endpoints and must **not** contain core business logic.

```
UI (Client Components / Pages)
  │
  ▼
Route / Transport Layer (Server Actions / Route Handlers)
  │
  ▼
Authentication (Supabase Auth verification)
  │
  ▼
Authorization (Role & scope verification)
  │
  ▼
Input Validation (Schema validation)
  │
  ▼
Application Use Case (Workflow orchestration)
  │
  ▼
Domain Module (Pure business logic & domain rules)
  │
  ▼
Repository / Integration (Data access & external adapters)
  │
  ▼
Database (Supabase PostgreSQL) or External Systems
```

---

## 4. Module Boundaries

```
src/
├── modules/               # Business Modules
│   ├── expedition/        # Expeditions, phases, and team assignments
│   ├── asset/             # Physical asset tracking and lifecycle
│   ├── inventory/         # Stock balances and ledger transactions
│   ├── logistics/         # Shipments, waybills, cargo items, and transit events
│   ├── risk/              # Risk evaluation, threshold scoring, and alerts
│   └── simulation/        # What-if scenario projections
├── core/                  # Core & Shared Reference Data
│   ├── station/           # Research station reference data (NOT a business module)
│   │   ├── use-cases/     # Station-specific application use cases
│   │   └── station-repository.ts
│   ├── geography/         # Geographic coordinates, regions, and spatial constants
│   ├── errors/            # Standardized application error definitions (`application-errors.ts`)
│   └── types/             # Shared system-wide types and primitives
├── integrations/          # External Data Adapters
│   ├── npdc/              # National Polar Data Center integration
│   ├── era5/              # Copernicus ERA5 weather & reanalysis
│   ├── nsidc/             # National Snow and Ice Data Center sea-ice feeds
│   └── osm/               # OpenStreetMap geospatial tiles/services
├── intelligence/          # AI Reasoning & Tool Subsystem
│   ├── ai/                # LLM orchestration and agents
│   ├── tools/             # Typed, bounded domain tools for AI invocation
│   └── prompts/           # System prompts and prompt templates
└── infrastructure/        # Infrastructure & Technical Concerns
    ├── db/                # Supabase client instances and connection utilities
    ├── auth/              # Auth wrappers and session management
    ├── storage/           # Object storage handlers (S3 / Supabase Storage)
    └── observability/     # Logging, metrics, and tracing
```

### 4.1 Application Use-Case Layer Conventions
- **Module Ownership**: Use cases reside directly inside their owning feature/core module under a `use-cases/` directory (e.g., `src/core/station/use-cases/`).
- **Pattern**: Class-based with a single public `execute(...)` method.
- **Dependency Injection**: Explicit constructor injection of required repositories or adapters. No global state, singletons, service locators, or DI containers.
- **Result Contract**: Deterministic, typed discriminated union (`UseCaseResult<T, E>`) returning `{ success: true, data }` or `{ success: false, error: { code, message } }`. Use cases do not throw domain or not-found exceptions across boundaries.
- **Transport Independence**: Use cases are completely HTTP-agnostic (no Next.js request/response objects, status codes, or header manipulations).

---

## 5. Domain Ownership

| Domain / Boundary | Responsibility & Ownership | Key Rules & Exclusions |
|---|---|---|
| **Expedition** | Expedition lifecycle, operational phases, station associations, team membership | Owns expedition records and roster assignments |
| **Asset** | Physical equipment lifecycle, specifications, asset status, assignments, maintenance history | **Asset ≠ Inventory**. Represents discrete, tracked individual physical units |
| **Inventory** | Stock quantity balances, storage locations, consumable supplies, stock transactions | Operates on a `current_quantity` + `transaction_history` ledger model |
| **Logistics** | Shipments, manifests, cargo items, route stages, transit events | Coordinates movements between origins, transit nodes, and polar stations |
| **Risk** | Derived operational risk assessments, environmental thresholds, alert generation | Derived analytical domain; aggregates signals from weather, assets, and supplies |
| **Simulation** | What-if scenarios, parametric sweeps, projected outcomes | **NEVER mutates live operational state**; runs in isolated calculation contexts |
| **Station** | Shared reference data (coordinates, capacity, facilities) | Resides in `src/core/station/`; acts as a reference entity, not an active business workflow |
| **AI Subsystem** | Reasoning over structured summaries, natural-language interfaces, recommendations | **NOT a source-of-truth domain**. Purely advisory layer consuming domain tools |
| **Dashboard** | Presentation aggregation and UI composition | **NOT a business-data owner**; consumes application use cases and modules |

---

## 6. Database
- **Engine**: Supabase PostgreSQL.
- **Access Pattern**: Direct Supabase client calls encapsulated within module repositories.
- **ORM Policy**: No heavy ORM (no Prisma, no Drizzle). Lightweight typed queries via Supabase client.
- **Spatial Data**: Standard numeric latitude and longitude columns (`DECIMAL(9,6)`). No PostGIS extension required.
- **Repository Pattern**: Module-specific repositories only. No complex or generic repository abstractions.
- **Schema Management**: Managed exclusively through versioned SQL migration scripts in `supabase/migrations/`.

---

## 7. Security Model
- **Authentication**: Managed via Supabase Auth (JWT session validation on server).
- **Authorization**: Application-level role and scope checks applied in use cases and route layers.
- **Database Security**: PostgreSQL Row-Level Security (RLS) policies enforce data isolation at the storage tier.
- **Roles**:
  - `SUPER_ADMIN`: System-wide configuration and administrative access.
  - `COMMAND_ADMIN`: Central headquarters command access across all stations and expeditions.
  - `EXPEDITION_MANAGER`: Scoped management for assigned expeditions (derived dynamically from `expedition_members`, **not** stored as a flat profile attribute).
  - `STATION_OPERATOR`: Station-level operational logging, asset updates, and inventory management.
  - `VIEWER`: Read-only access to authorized public/operational reports.
- **Service Credentials**: Supabase service keys and external API secrets are restricted to server-side environments and never exposed to the client.
- **Client-Side Validation**: UI role checks are strictly for user experience / interface gating; they are **never** treated as security boundaries.

---

## 8. AI Boundary & Intelligence Architecture
- **Intelligence Flow**:
  ```
  Operational Data ──► Deterministic Rules / Analytics ──► AI Reasoning ──► Structured Recommendation ──► Human Decision
  ```
- **Tool-Gated Access**: The AI subsystem accesses system state exclusively via bounded, typed domain tools (e.g., `getExpeditionSummary`, `getInventoryRisk`).
- **Data Access Restrictions**: AI agents have **no raw SQL or direct database access**.
- **Role**: AI is a capability layer providing operational intelligence and actionable insights; it is **not** an autonomous controller or standalone product.

---

## 9. Personnel Model
- Personnel data is partitioned between the `persons` entity and the `expedition_members` junction entity.
- The `persons.auth_user_id` column is **nullable and unique** (`UNIQUE NULLS DISTINCT`):
  - A person record can represent a field scientist, contractor, or technician without requiring an active application user account.
  - Account association occurs only when login access is explicitly provisioned.
- Expedition roles and memberships are tracked per expedition in `expedition_members`.

---

## 10. Inventory Model
- **Dual-Model Design**: Maintained via `current_quantity` on the inventory balance record paired with an immutable `inventory_transactions` ledger.
- **Non-Negative Quantities**: Transaction quantities are strictly positive values (`quantity > 0`).
- **Directionality via Type**: Transaction direction and semantics are determined by the transaction type enum:
  - `RECEIPT` / `RESTOCK`: Inbound addition to current quantity.
  - `CONSUMPTION`: Outbound usage deduction.
  - `TRANSFER_IN` / `TRANSFER_OUT`: Relocation between storage nodes.
  - `ADJUSTMENT`: Reconciled inventory delta (with explicit adjustment sub-type).
  - `DAMAGE_LOSS` / `EXPIRY`: Outbound reduction due to loss or shelf-life expiration.
