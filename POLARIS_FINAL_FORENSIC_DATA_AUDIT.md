# POLARIS FINAL FORENSIC DATA AUDIT REPORT
**Document Reference:** `POLARIS_FINAL_FORENSIC_DATA_AUDIT.md`  
**Date of Execution:** September 10, 2026  
**Auditor:** DeepMind Advanced Agentic Coding Forensic Engine  
**Codebase Under Audit:** `c:\Users\ASUS\OneDrive\Desktop\POLARIS`  
**Methodology:** Absolute Zero-Trust Forensic Code & Runtime Analysis (Every claim verified against TypeScript/SQL source code)

---

## 1. Executive Verdict

1. **Framework & Dependencies Reality:**  
   - **Next.js Version:** `15.5.24` (defined in `package.json` line 20 and confirmed during production build).  
   - **React Version:** `19.1.0`.  
   - **Database Client:** `@supabase/supabase-js: ^2.112.4`, `@supabase/ssr: ^0.12.5`.  
   - **AI/ML Libraries:** **None**. Zero imports or dependencies on OpenAI, Gemini, TensorFlow, PyTorch, LangChain, or Hugging Face.

2. **Supabase Realtime Reality:**  
   - **SUPABASE REALTIME NOT IMPLEMENTED**. There is zero usage of `supabase.channel()`, `postgres_changes`, `broadcast`, `presence`, or `.subscribe()`. All database interactions are classic REST / server-side SQL queries (`supabase.from().select()`).

3. **Client-Side Polling / SWR Reality:**  
   - **NO AUTOMATIC REFRESH / NO SWR / NO REACT QUERY**. SWR and TanStack React Query are not installed in `package.json` and are not imported anywhere. No `setInterval` or `setTimeout` periodic polling loops exist on any operational dashboard or widget. The sole background interval in the entire codebase is in `useOfflineSync()` (`src/core/offline/use-offline-sync.ts`), which checks the local browser IndexedDB mutation queue every 10 seconds for offline mutations to flush.

4. **Weather Ingestion Reality:**  
   - Weather is fetched **on-demand during page render (SSR)** or upon explicit HTTP GET `/api/weather`. Observations are cached in an in-memory `Map` (`WEATHER_CACHE`) with a **15-minute TTL (`CACHE_TTL_MS = 900000`)** and a **2-hour maximum staleness window (`MAX_STALENESS_MS = 7200000`)**.  
   - NCPOR scrapers consume HTML tables from `https://data.ncpor.res.in/{station}/live`.  
   - Himadri (HMD) physical AWS has an unmonitored wind sensor; it operates under a **composite observation model** where surface temperature and pressure come from NCPOR AWS, while wind velocity and direction fall back to the Open-Meteo polar numerical model.  
   - Dakshin Gangotri (DGT) has **zero live weather ingestion**; it is an offline historical station preserved from 1983–1990.

5. **Maritime Logistics & Vessel Tracking Reality:**  
   - **NO LIVE AIS/GPS INTEGRATION**. Vessel position and cargo manifest stages are 100% hardcoded in-memory fixtures (`BASELINE_CONTAINERS` in `logistics-service.ts`) combined with seeded database records (`cargo_containers` table).

6. **Fuel & Industrial Telemetry Reality:**  
   - **NO PHYSICAL SENSOR/GATEWAY STREAM**. Bulk tank levels and daily burn rates are static operational baselines (`BASELINE_STATION_FUEL` in `fuel-service.ts` or seeded in `station_fuel_tanks`).  
   - Hardware telemetry events emitted by `VirtualTelemetryAdapter` are synthetic, generated via `Math.sin(now.getTime() / 60000)`.  
   - `edge-gateway/` contains a standalone Python reference script (`edge_client_reference.py`) that is not deployed or continuously running against the live app.

7. **Operational Readiness & Alerting Reality:**  
   - Operational Readiness is a **purely deterministic 4-pillar arithmetic heuristic (0–100 points)**. It contains zero AI, machine learning, or neural networks.  
   - Alerts are evaluated synchronously on-demand during server render via `AlertEngine.evaluateTelemetryAlerts()`. There is no continuous background anomaly detection daemon. Notifications use a transactional outbox table processed either by a manual trigger or an external Vercel Cron job scheduled once daily (`0 0 * * *` in `vercel.json`).

---

## 2. Complete Data Source Matrix

| Domain | Entity / Metric | Primary Source of Truth | External Network Call? | Database Table | Classification |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Stations** | Base Registry (BHR, MTR, HMD, DGT) | Supabase PostgreSQL Master Table | No | `public.stations` | `AUTHORITATIVE_REAL` |
| **Personnel** | Expedition Scientists & Leaders | Supabase PostgreSQL Master Table | No | `public.persons` | `AUTHORITATIVE_REAL` |
| **Expeditions** | Mission Campaigns (ISEA-44, ARC-26) | Supabase PostgreSQL Master Table | No | `public.expeditions` | `AUTHORITATIVE_REAL` & `SIMULATED` |
| **Assets** | Snowcats, Generators, Lab Instruments | Supabase PostgreSQL Master Table | No | `public.assets` | `AUTHORITATIVE_REAL` |
| **Assignments** | Asset Station/Expedition Deployments | Supabase PostgreSQL Master Table | No | `public.asset_assignments` | `AUTHORITATIVE_REAL` |
| **Maintenance** | Servicing & Repair Work Orders | Supabase PostgreSQL Master Table | No | `public.maintenance_records` | `AUTHORITATIVE_REAL` |
| **Inventory** | Station Spare Parts & Stock Items | Supabase PostgreSQL Master Table | No | `public.inventory_items` | `AUTHORITATIVE_REAL` |
| **Fuel Levels** | Tank Capacities & Dip Readings | `station_fuel_tanks` / In-Memory Baseline | No | `public.station_fuel_tanks` | `SEEDED_BASELINE` / `MANUAL_DIP` |
| **Weather (BHR)** | Larsemann Hills In-Situ AWS | NCPOR Live Data Portal Scraper | Yes | `public.weather_telemetry_history` | `AUTHORITATIVE_OBSERVED` |
| **Weather (MTR)** | Schirmacher Oasis In-Situ AWS | NCPOR Live Data Portal Scraper | Yes | `public.weather_telemetry_history` | `AUTHORITATIVE_OBSERVED` |
| **Weather (HMD)** | Ny-Ålesund Fjord AWS + Model | NCPOR AWS (Temp/Pressure) + Open-Meteo | Yes | `public.weather_telemetry_history` | `COMPOSITE_OBSERVED` |
| **Weather (DGT)** | Dakshin Gangotri Historical Base | None (Historical Archive / Constant) | No | None | `HISTORICAL_RECORD` |
| **Weather Trends**| 24h Barometric Pressure Profile | Supabase History or Sine Fallback | No | `public.weather_telemetry_history` | `OBSERVED` or `SIMULATED` |
| **Sea Ice** | 12km Antarctic Concentration Tiles | NASA EOSDIS GIBS WMS Service | Yes | None | `DAILY_SATELLITE_WMS` |
| **Ocean Winds** | Southern Ocean Scatterometer Vectors | Local Static JSON (`mosdac-winds.json`) | No | None | `STATIC_REFERENCE_DATASET` |
| **Vessel AIS** | MV Vasiliy Golovnin Transit Position | Static Fixture (`[-52.50, 28.00]`) | No | `public.cargo_containers` | `OPERATIONAL_SIMULATION` |
| **Cargo Staging**| ISO 20ft Containers (5 Transit Stages)| User Mutation via REST PATCH | No | `public.cargo_containers` | `OPERATIONAL_SIMULATION` |
| **Hardware** | Bus Devices (Moxa, Modbus, SNMP) | `virtual-telemetry-adapter.ts` | No | `public.hardware_devices` | `SIMULATED_TELEMETRY` |
| **SITREPs** | Daily Commander Situation Reports | Station Commander Input + SHA-256 | No | `public.daily_sitreps` | `AUTHORITATIVE_LOCAL` |
| **Readiness** | 0–100 Operational Readiness Score | Deterministic Mathematical Heuristic | No | None (Computed on Request) | `DERIVED_HEURISTIC` |
| **Alerts** | Blizzard & Cold Stress Hazards | In-Memory / PostgreSQL Alerts Table | No | `public.operational_alerts` | `DERIVED_HEURISTIC` |

---

## 3. External Request Matrix

The codebase was searched for all outbound network calls (`fetch`, `http.get`, `https.get`, `fetchWithTimeout`, `XMLHttpRequest`, Leaflet WMS/tile layers):

| Source / Provider | Exact Endpoint URL | HTTP Method | Caller (File & Function) | Runtime Target | Trigger | Exact Refresh Interval | Timeout | Cache Policy | Fallback Strategy | Data Provenance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **NCPOR Data Portal** | `https://data.ncpor.res.in/{station}/live` | `GET` | `ncpor-adapter.ts` -> `fetchObservation()` | Node.js Server | On page render / API call | `NO AUTOMATIC REFRESH` | 4500 ms | In-memory `Map` (15m TTL, 2h max stale) | Open-Meteo Model (Tier 3) &rarr; Baseline (Tier 4) | `AUTHORITATIVE_OBSERVED` |
| **Open-Meteo API** | `https://api.open-meteo.com/v1/forecast` | `GET` | `open-meteo-adapter.ts` -> `fetchModelData()` | Node.js Server | NCPOR fail or HMD wind composite | `NO AUTOMATIC REFRESH` | 2500–3000 ms | None (called on cache miss) | Offline Climatic Baseline (Tier 4) | `VERIFIED_MODEL` |
| **NASA EOSDIS GIBS** | `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi` | `GET` (WMS) | `sea-ice-layer.ts` -> `createLeafletSeaIceLayer()` | Client Browser | Map view load & pan/zoom | `NO AUTOMATIC REFRESH` (Browser cache) | Browser default | Native browser caching | Empty map layer | `DAILY_SATELLITE_WMS` (24h delayed) |
| **ESRI ArcGIS Canvas** | `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}` | `GET` (Tiles) | `leaflet-map-canvas.tsx` -> `initMap()` | Client Browser | Map view load & pan/zoom | `NO AUTOMATIC REFRESH` (Browser cache) | Browser default | Native browser caching | Blank tiles | `STATIC_BASEMAP` |
| **Telegram Bot API** | `https://api.telegram.org/bot{token}/sendMessage` | `POST` | `telegram-adapter.ts` -> `send()` | Node.js Server | Outbox processor batch run | `NO AUTOMATIC REFRESH` (Manual / Daily Cron) | Native `fetch` timeout | None | Sandbox mode log | `DISPATCHED_NOTIFICATION` |
| **Resend Email API** | `https://api.resend.com/emails` | `POST` | `email-adapter.ts` -> `send()` | Node.js Server | Outbox processor batch run | `NO AUTOMATIC REFRESH` (Manual / Daily Cron) | Native `fetch` timeout | None | Sandbox mode log | `DISPATCHED_NOTIFICATION` |
| **Browser WebPush** | `recipientEndpoint` (VAPID Push Service) | `POST` | `webpush-adapter.ts` -> `send()` | Node.js Server | Outbox processor batch run | `NO AUTOMATIC REFRESH` (Manual / Daily Cron) | Native `fetch` timeout | None | Sandbox mode log | `DISPATCHED_NOTIFICATION` |
| **Supabase REST** | `https://{project}.supabase.co/rest/v1/*` | `GET`, `POST`, `PATCH`, `DELETE` | `createServerClient()` / REST RPCs | Node.js Server & Browser Client | Route handlers & Server Components | `NO AUTOMATIC REFRESH` | Server default | In-memory or none | Hardcoded baselines in services | `AUTHORITATIVE_DB` |

---

## 4. Real-Time / Polling / Cache Matrix

| Feature | Actual Mechanism | Automatic Refresh? | Exact Interval | Cache Layer | Data Source | Exact Code Location |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Main Dashboard (`/`)** | Next.js Server Component SSR (`force-dynamic`) | **NO AUTOMATIC REFRESH** | None (Executes strictly on browser request) | In-memory 15-min weather cache | Supabase REST + Weather Service | `src/app/page.tsx:28` (`DashboardPage`) |
| **Weather Telemetry Panel** | Server Component rendering `StationWeather` | **NO AUTOMATIC REFRESH** | None | In-memory Map (`CACHE_TTL_MS = 900000`) | `WeatherService.getAllStationWeather()` | `src/app/components/weather-telemetry-panel.tsx:9` |
| **Operational Alerts** | Synchronous render-time evaluation | **NO AUTOMATIC REFRESH** | None | None | In-memory array / `operational_alerts` table | `src/core/alerts/alert-engine.ts:55` |
| **Fuel Autonomy Widget** | SSR initial render + manual client `recordFuelDip()` | **NO AUTOMATIC REFRESH** | None | None | PostgreSQL `station_fuel_tanks` table | `src/app/components/fuel-autonomy-widget.tsx:12` |
| **Maritime Logistics (`/logistics`)** | React `useEffect` calling `GET /api/logistics/containers` | **NO AUTOMATIC REFRESH** | None (Single fetch on component mount) | None | `LogisticsService` / `cargo_containers` table | `src/app/logistics/page.tsx:20` |
| **Expedition Detail (`/expeditions/[code]`)** | React `useEffect` calling `GET /api/expeditions/${code}` | **NO AUTOMATIC REFRESH** | None (Single fetch on mount/param change) | None | Supabase RPC / REST | `src/app/expeditions/[code]/page.tsx:81` |
| **Asset Registry (`/assets`)** | React `useEffect` calling `GET /api/assets` | **NO AUTOMATIC REFRESH** | None (Single fetch on component mount) | None | Supabase `assets` table | `src/app/assets/page.tsx:38` |
| **Offline Mutation Sync** | Client hook polling IndexedDB pending queue | **YES** | **10,000 ms (10 seconds)** | Browser IndexedDB | Client IndexedDB queue | `src/core/offline/use-offline-sync.ts:90` |
| **Notification Outbox Dispatch** | HTTP GET/POST to `/api/notifications/outbox` | **YES (EXTERNAL ONLY)** | **Daily (`0 0 * * *` via Vercel Cron)** | PostgreSQL table state | `notification_outbox` table | `vercel.json:6` & `src/app/api/notifications/outbox/route.ts` |

---

## 5. Supabase Realtime Verdict

### **VERDICT: SUPABASE REALTIME NOT IMPLEMENTED**

**Forensic Evidence:**
1. Codebase-wide ripgrep across all directories for:
   - `supabase.channel(` &rarr; **0 matches**
   - `postgres_changes` &rarr; **0 matches**
   - `.subscribe(` &rarr; **0 matches**
   - `WebSocket` / `EventSource` &rarr; **0 matches**
2. In `src/infrastructure/db/supabase-server.ts` and `src/infrastructure/db/supabase-browser.ts`, the client is instantiated via `@supabase/ssr` (`createServerClient` / `createBrowserClient`) strictly for executing RESTful PostgREST queries:
   ```typescript
   await supabase.from("stations").select("*");
   await supabase.from("operational_alerts").select("*");
   ```
3. No WebSocket connections or real-time event listeners are registered in any client component. All data flow is **pull-on-demand via HTTP GET**.

---

## 6. Weather Field-Level Provenance

### Station-by-Station Field Analysis:

#### **1. Bharati Station (BHR) — Lat: -69.4072, Lon: 76.1947**
- **Temperature:**
  - Source: `https://data.ncpor.res.in/bharati/live` (parsed from `id="divtemp"`)
  - Provenance: `AUTHORITATIVE_OBSERVED` (Tier 1) &rarr; Fallback: `VERIFIED_MODEL` &rarr; `OFFLINE_CLIMATIC_BASELINE` (-19.5°C)
- **Relative Humidity:**
  - Source: `https://data.ncpor.res.in/bharati/live` (parsed from `id="divrh"`)
  - Provenance: `AUTHORITATIVE_OBSERVED` (Tier 1) &rarr; Fallback: `VERIFIED_MODEL` &rarr; `OFFLINE_CLIMATIC_BASELINE` (76%)
- **Pressure:**
  - Source: `https://data.ncpor.res.in/bharati/live` (parsed from `id="divap"`)
  - Provenance: `AUTHORITATIVE_OBSERVED` (Tier 1) &rarr; Fallback: `VERIFIED_MODEL` &rarr; `OFFLINE_CLIMATIC_BASELINE` (988.0 hPa)
- **Wind Speed:**
  - Source: `https://data.ncpor.res.in/bharati/live` (parsed from `id="divw"`)
  - Provenance: `AUTHORITATIVE_OBSERVED` (Tier 1) &rarr; Fallback: `VERIFIED_MODEL` &rarr; `OFFLINE_CLIMATIC_BASELINE` (22.0 km/h)
- **Wind Direction:**
  - Source: POLARIS Prevailing Katabatic Reference Constant (`148°`)
  - Provenance: `OFFLINE_CLIMATIC_BASELINE` (Constant)
- **Timestamp:**
  - Source: Scraped date from NCPOR HTML table (`td font-size: 20px`) or fallback to fetch timestamp.

#### **2. Maitri Station (MTR) — Lat: -70.7664, Lon: 11.7333**
- **Temperature:**
  - Source: `https://data.ncpor.res.in/maitri/live` (`id="divtemp"`)
  - Provenance: `AUTHORITATIVE_OBSERVED` (Tier 1) &rarr; Fallback: `VERIFIED_MODEL` &rarr; `OFFLINE_CLIMATIC_BASELINE` (-18.0°C)
- **Relative Humidity:**
  - Source: `https://data.ncpor.res.in/maitri/live` (`id="divrh"`)
  - Provenance: `AUTHORITATIVE_OBSERVED` (Tier 1) &rarr; Fallback: `VERIFIED_MODEL` &rarr; `OFFLINE_CLIMATIC_BASELINE` (45%)
- **Pressure:**
  - Source: `https://data.ncpor.res.in/maitri/live` (`id="divap"`)
  - Provenance: `AUTHORITATIVE_OBSERVED` (Tier 1) &rarr; Fallback: `VERIFIED_MODEL` &rarr; `OFFLINE_CLIMATIC_BASELINE` (975.0 hPa)
- **Wind Speed:**
  - Source: `https://data.ncpor.res.in/maitri/live` (`id="divw"`)
  - Provenance: `AUTHORITATIVE_OBSERVED` (Tier 1) &rarr; Fallback: `VERIFIED_MODEL` &rarr; `OFFLINE_CLIMATIC_BASELINE` (18.0 km/h)
- **Wind Direction:**
  - Source: POLARIS Prevailing Katabatic Reference Constant (`175°`)
  - Provenance: `OFFLINE_CLIMATIC_BASELINE` (Constant)
- **Timestamp:**
  - Source: Scraped date from NCPOR HTML table.

#### **3. Himadri Station (HMD) — Lat: 78.9233, Lon: 11.9289 (Svalbard Arctic)**
- **Temperature:**
  - Source: `https://data.ncpor.res.in/himadri/live` (`id="divtemp"`)
  - Provenance: `AUTHORITATIVE_OBSERVED` (Tier 1)
- **Relative Humidity:**
  - Source: `https://data.ncpor.res.in/himadri/live` (`id="divrh"`)
  - Provenance: `AUTHORITATIVE_OBSERVED` (Tier 1)
- **Pressure:**
  - Source: `https://data.ncpor.res.in/himadri/live` (`id="divap"`)
  - Provenance: `AUTHORITATIVE_OBSERVED` (Tier 1)
- **Wind Speed:**
  - Source: **Open-Meteo High-Resolution Polar Model** (`https://api.open-meteo.com/v1/forecast?latitude=78.9233&longitude=11.9289&current=wind_speed_10m`)
  - Provenance: `VERIFIED_MODEL` (**COMPOSITE OBSERVATION**).  
  - *Reasoning in Code:* `ncpor-adapter.ts:70-79` notes: *"On Himadri AWS, wind speed cell is HTML-commented out when uncalibrated"*. When `ncporObs.windSpeedKnots === null`, `weather-service.ts:178-200` automatically triggers Open-Meteo model ingestion for wind speed, marking overall station status as `COMPOSITE_OBSERVED`.
- **Wind Direction:**
  - Source: Open-Meteo `wind_direction_10m`
  - Provenance: `VERIFIED_MODEL` (Tier 3)
- **Timestamp:**
  - Source: Scraped date string from NCPOR.

#### **4. Dakshin Gangotri (DGT) — Lat: -70.0833, Lon: 12.0000**
- **Explicit Determination:**
  - **Does it fetch external weather?** **NO**.
  - **Does it use modelled weather?** **NO**.
  - **Does it use historical baseline?** **YES**.
  - **Does it only display static historical information?** **YES**.
  - *Proof in Code (`weather-service.ts:557-559`):*
    ```typescript
    // Note: Dakshin Gangotri (DGT) is maintained as a historical/reference station entity;
    // no live weather ingestion is performed for DGT.
    ```
    DGT is filtered out of `getAllStationWeather()`. In the UI, it is displayed strictly as a historical monument and decommissioned station archive (operational 1983–1990).

---

## 7. GIS / Sea-Ice Data Audit

1. **NASA EOSDIS GIBS Sea Ice Layer:**
   - **File:** `src/core/spatial/sea-ice-layer.ts`
   - **Layer Name:** `AMSR2_Sea_Ice_Concentration_12km`
   - **Mechanism:** Leaflet WMS tile layer (`L.tileLayer.wms`).
   - **Temporal Offset:** Applies an explicit **24-hour negative offset** (`targetDate = new Date(now.getTime() - 24 * 3600 * 1000)`) because daily satellite composites from NASA require a ~24-hour processing buffer before publication.
   - **Spatial Resolution:** 12 km grid.

2. **ISRO Oceansat-2 / OSCAT Scatterometer Winds:**
   - **File:** `src/core/spatial/mosdac-winds.json` (consumed by `src/app/components/map/map-layers.ts`)
   - **Mechanism:** **Static local GeoJSON/JSON vector dataset**. It contains 670 wind vector coordinates along the 50°S to 70°S Southern Ocean corridor.
   - **Real-Time Status:** **NOT LIVE**. It is an authoritative static reference dataset from swath `O2SCT_20140105_22694_22695_L04_HVW`.

3. **Antarctic Basemap & Coastlines:**
   - **Files:** `src/app/components/map/leaflet-map-canvas.tsx`, `src/core/spatial/antarctic-coastline.ts`
   - **Mechanism:** ESRI World Light Gray Canvas raster tiles + hardcoded GeoJSON polylines for the ice shelf barrier and traverse routes.

---

## 8. Vessel / AIS Audit

1. **AIS / GPS Transponder Integration:**
   - **CONFIRMED: NO LIVE AIS/GPS INTEGRATION**.
   - Searching for `MarineTraffic`, `Spire`, `VesselFinder`, and AIS APIs yielded zero network requests or libraries.
2. **How Vessel Position is Generated:**
   - **File:** `src/app/components/map/map-layers.ts:156`
   - Position is a **fixed hardcoded coordinate**:
     ```typescript
     const vesselPos: [number, number] = [-52.50, 28.00];
     ```
   - Pop-up explicitly states (`map-layers.ts:175`):
     ```html
     ⚠️ <em>Seeded resupply scenario. Real-time satellite AIS transponders not active.</em>
     ```
3. **Voyage Data Generation:**
   - Sourced from `LogisticsService.getActiveVoyage()` (`src/modules/logistics/logistics-service.ts`), returning a static voyage object (`ISEA-44-SEA`, `MV Vasily Golovnin`, `daysAtSea: 38`, `totalTonnageMetricTons: 64.5`). Container transit stages can be mutated via database `PATCH /api/logistics/containers`.

---

## 9. Fuel / Power / Telemetry Audit

1. **Physical Sensor / Gateway Connection:**
   - **CONFIRMED: NO PHYSICAL SENSOR OR LIVE GATEWAY CONNECTION**.
   - Zero active connections over serial ports, Modbus TCP sockets, SNMP UDP queries, or MQTT brokers.
2. **How Telemetry Values are Produced:**
   - **File:** `src/core/hardware-gateway/virtual-telemetry-adapter.ts:93-120`
   - Generated using a **deterministic sine wave calculation**:
     ```typescript
     const timeFactor = Math.sin(now.getTime() / 60000);
     const simulatedValue = Number((config.baseValue + timeFactor * config.variance).toFixed(2));
     ```
   - Emits events tagged with `quality: 'SIMULATED'`, `source: 'VIRTUAL'`, `classification: 'SIMULATED_TELEMETRY'`.
3. **Edge Gateway Code (`edge-gateway/`):**
   - Contains `edge_client_reference.py`, which is a **reference client implementation** showing how an edge gateway *could* dispatch Modbus/SNMP data using Python. It is not running in production.
4. **Fuel Autonomy Formula:**
   - **File:** `src/core/fuel/fuel-repository.ts:66-68`
   - Deterministic arithmetic:
     $$\text{Days of Autonomy} = \left\lfloor \frac{\text{Total Current Liters}}{\text{Aggregate Daily Burn Rate (L/day)}} \right\rfloor$$
   - Categorical status:
     - $\ge 90\text{ days} \implies \text{NORMAL}$
     - $45\text{--}89\text{ days} \implies \text{WATCH}$
     - $20\text{--}44\text{ days} \implies \text{RESUPPLY\_REQUIRED}$
     - $< 20\text{ days} \implies \text{CRITICAL}$

---

## 10. Database Source Audit

### Key PostgreSQL Tables (via Supabase):

| Table Name | Purpose | Who Writes | Who Reads | External Source? | Seeded? | User-Entered? | Real-Time Live? |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `data_sources` | Governance registry of providers | Migrations / DB Admin | Provenance Page / Services | No | Yes | No | No |
| `stations` | Master station registry | Migrations / DB Admin | Dashboard, Header, Maps | No | Yes | No | No |
| `persons` | Field personnel roster | Migrations / Admins | Expedition views | No | Yes | Yes | No |
| `expeditions` | Polar operational missions | Admins / Mission Planners | Expeditions pages, Dashboard | No | Yes | Yes | No |
| `assets` | Machinery, vehicles, sensors | Logistics Officers / Admins | Asset pages, Readiness Heuristic | No | Yes | Yes | No |
| `asset_assignments`| Deployments to bases | Station Leaders / Admins | Dashboard, Asset detail | No | Yes | Yes | No |
| `maintenance_records`| Service work orders | Station Engineers / Admins | Readiness Heuristic, Assets | No | Yes | Yes | No |
| `station_fuel_tanks`| Bulk fuel farm metrics | Manual Dip API / Admins | Dashboard, Fuel Widget | No | Yes | Yes | No |
| `cargo_containers` | Resupply containers | Seed / Logistics PATCH | Logistics page (`/logistics`) | No | Yes | Yes | No |
| `daily_sitreps` | Cryptographically signed SITREPs| Station Leaders (`POST /api/sitrep`)| Sitrep page (`/sitrep`) | No | Yes | Yes | No |
| `weather_telemetry_history`| 24h weather observations | `WeatherHistoryService.archiveObservation` | Weather Trend Chart | Yes (NCPOR) | No | No | Periodic (10m throttle) |
| `operational_alerts`| Persistent operational alerts | `AlertRepository` / Admins | Alert Banners, Outbox | No | Yes | Yes | On render / manual |
| `hardware_devices` | Field sensor registry | Hardware API (`/api/hardware/devices`)| Telemetry Widget | No | Yes | No | No |
| `hardware_telemetry_history`| Hardware telemetry log | Virtual Adapter / Gateway Ingest| Telemetry Widget | No | Yes | No | No (Simulated) |
| `notification_outbox`| Transactional alert outbox | Alert Engine / Services | Outbox Processor | No | No | Auto | Periodic |

### Row-Level Security (RLS) Status:
- **Verified via Migration Inspection (`20260907100000_lockdown_rbac_rls_policies.sql`):**
  - **RLS is enabled on 100% of operational tables** (26 tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
  - Read access (`SELECT`) is granted to authenticated users and anon for public dashboards.
  - Mutations (`INSERT`, `UPDATE`, `DELETE`) are strictly enforced via PostgreSQL helper functions `public.is_admin()`, `public.current_user_role()`, and role-based policies (`STATION_OPERATOR`, `LOGISTICS_OFFICER`, `STATION_LEADER`).

---

## 11. Readiness / Risk Audit

### **VERDICT: PURELY DETERMINISTIC HEURISTIC (ZERO AI/ML)**

- **File:** `src/core/readiness/operational-readiness.ts:90-582`
- **Function:** `calculateOperationalReadiness(assets, maintenance, stations, weatherTelemetry)`
- **Model Type String:** `"POLARIS_OPERATIONAL_READINESS_HEURISTIC"`
- **Total Points:** 100 maximum, strictly additive across 4 categories:

$$\text{Total Score} = \text{Asset Health (35)} + \text{Power Redundancy (25)} + \text{Maintenance Health (20)} + \text{Environmental Severity (20)}$$

#### Category Breakdown:
1. **Critical Asset Health (Max 35 pts):**
   - Formula: $\left\lfloor \frac{\text{Operational Critical Assets}}{\text{Non-Retired Critical Assets}} \times 35 \right\rfloor$
   - Missing data penalty: If `assets === null`, score = `0/35` with `DATA_UNAVAILABLE` tier.
2. **Station Power Redundancy (Max 25 pts):**
   - $\ge 2$ operational generators: `25/25` (heuristic for primary + standby met)
   - $1$ operational generator: `10/25` (-15 pt penalty for single-generator condition)
   - $0$ operational generators: `0/25`
   - Missing data penalty: `0/25` with `DATA_UNAVAILABLE` tier.
3. **Maintenance Backlog Health (Max 20 pts):**
   - Formula: $20 - (6 \times \text{Active Corrective Repairs}) - (2 \times \text{Active Preventive Orders})$
   - Missing data penalty: If `maintenance === null`, score = `8/20` (-12 pt penalty).
4. **Environmental Hazard Severity (Max 20 pts):**
   - Evaluates worst-case active station from `weatherTelemetry`:
     - Apparent wind chill $\le -45^\circ\text{C} \implies -8\text{ pts}$; $\le -35^\circ\text{C} \implies -5\text{ pts}$; $\le -25^\circ\text{C} \implies -2\text{ pts}$.
     - Wind speed $\ge 55\text{ km/h} \implies -6\text{ pts}$; $\ge 38\text{ km/h} \implies -3\text{ pts}$.
   - Missing data penalty: If `weatherTelemetry` is missing, score = `10/20` (-10 pt penalty).

---

## 12. Alerting Audit

1. **Triggering Mechanism:**
   - Synchronous on-render threshold evaluation:
     - Wind $\ge 38\text{ km/h} \implies \text{Blizzard Watch}$
     - Wind $\ge 55\text{ km/h} \implies \text{Severe Blizzard Warning}$ (inserted into `operational_alerts` table)
     - Tank level $< 20\% \implies \text{Low Fuel Warning}$
2. **Background Workers & Dispatch:**
   - Uses an **Asynchronous Transactional Outbox Pattern** (`OutboxProcessor`).
   - Outbox rows are inserted into `notification_outbox` with status `QUEUED`.
   - **No persistent background worker daemon exists**. The queue is processed via:
     - External Vercel Cron trigger: `GET /api/notifications/outbox` scheduled at `0 0 * * *` (midnight UTC) with `Authorization: Bearer <CRON_SECRET>`.
     - Manual/webhook trigger: `POST /api/notifications/outbox`.

---

## 13. Seeded / Simulated Data Audit

1. **Seeded Tables:**
   - `supabase/seed.sql` populates:
     - 4 stations (BHR, MTR, HMD, DGT)
     - 5 persons (expedition leaders, doctors, mechanics)
     - 3 expeditions (ISEA-44 active, ARC-26-S planned, TRV-44-DP draft)
     - 9 assets (PistenBully 300, generators, communications)
2. **Simulated Modules:**
   - `src/modules/simulation/` contains only `.gitkeep`.
   - `src/core/hardware-gateway/virtual-telemetry-adapter.ts` simulates hardware devices via sine waves.
   - `src/core/telemetry/time-series-service.ts` simulates 24-hour weather trends via sine waves when fewer than 2 real observations exist in PostgreSQL.

---

## 14. Derived Data Audit

All derived metrics in POLARIS are computed deterministically using standard formulas:
1. **Antarctic Wind Chill Index:**
   - Siple-Passel / Jagt Antarctic Wind Chill Formula (`weather-service.ts:71-76`):
     $$W = 13.12 + 0.6215 \cdot T - 11.37 \cdot V^{0.16} + 0.3965 \cdot T \cdot V^{0.16}$$
2. **Solar Ephemeris:**
   - Spencer (1971) solar ephemeris algorithm (`solar-ephemeris.ts`) computes solar elevation angle, declination, and solar regime (Polar Night, Civil Twilight, Continuous Daylight) for any latitude/day-of-year.
3. **Great-Circle Haversine Geodesic Distance:**
   - Spherical law of cosines & Haversine formula in `geodesic.ts` for station-to-station bearings and distances.
4. **Fuel Autonomy Days:**
   - Remaining liters divided by daily burn rate.

---

## 15. UI Truth Audit & Misleading Claims Catalog

The frontend code was searched for misleading live/realtime/AI terms. The following 11 components contained unsupported claims:

| # | File Path & Line | Current Text / Claim | Actual Code Behavior | Classification | Recommended Truthful Replacement |
|---|---|---|---|---|---|
| 1 | `src/app/page.tsx:179` | `"Continuously tracks asset lifecycle states..."` | Data fetched once on page render (SSR); no continuous tracking loop. | **EXAGGERATED** | `"Manages asset lifecycle states, life-support fuel reserves, synoptic meteorological observations, and resupply logistics."` |
| 2 | `src/app/page.tsx:264` | Badge: `LIVE AWS`, title: `"Real-Time Ground In-Situ Weather Stations"` | Shows station count; weather is fetched on-demand with 15-min cache. | **MISLEADING** | Badge: `AWS OBS`, title: `"NCPOR Ground Weather Stations — fetched on demand, cached 15 min"` |
| 3 | `src/app/page.tsx:287` | Badge: `REALTIME`, title: `"Real-Time Automated Anomaly Watcher"` | Alerts evaluated synchronously on page render; no background daemon. | **EXAGGERATED** | Badge: `ON-RENDER`, title: `"Threshold alerts evaluated on each page request"` |
| 4 | `src/app/components/weather-telemetry-panel.tsx:35` | `"🟢 REAL-TIME IN-SITU SENSORS"` | On-demand fetch with 15-min cache; HMD uses numerical model fallback for wind. | **MISLEADING** | `"🟢 NCPOR IN-SITU AWS OBSERVATIONS"` |
| 5 | `src/app/components/weather-telemetry-panel.tsx:38` | `"Pipeline: In-situ AWS Satellite Uplink (15m Polling)"` | Application does not poll at 15-minute intervals. Cache TTL is 15 minutes. | **MISLEADING** | `"Pipeline: NCPOR AWS → server fetch on request → 15 min cache"` |
| 6 | `src/app/components/data-provenance-banner.tsx:44` | `"REAL-TIME TELEMETRY"` | On-demand periodic fetch, not live streaming. | **MISLEADING** | `"NEAR-REAL-TIME OBSERVATIONS"` |
| 7 | `src/app/components/data-provenance-banner.tsx:47` | Badge: `LIVE` | No live push stream exists. | **MISLEADING** | `OBSERVED` |
| 8 | `src/app/components/data-provenance-banner.tsx:51` | `"Ground AWS Sensors & ISRO Satellite"` | ISRO scatterometer data is loaded from a static local JSON file. | **MISLEADING** | `"Ground AWS Sensors (on-demand fetch)"` |
| 9 | `src/app/components/data-provenance-banner.tsx:54` | `"...+ ISRO Oceansat-2 corridor scatterometer winds."` | ISRO data is a static offline JSON dataset. | **MISLEADING** | `"Physical temperature, pressure, wind velocity from Bharati, Maitri, Himadri AWS stations."` |
| 10 | `src/app/components/data-provenance-banner.tsx:57` | `"Pipeline: Automated Satellite Uplink"` | No automated uplink client in the app; fetches from web portal on demand. | **MISLEADING** | `"Pipeline: Server-side fetch → 15 min in-memory cache"` |
| 11 | `src/app/logistics/page.tsx:170` | `"Sync Posture: LIVE VERIFIED"` | Cargo records and voyage position are simulated seeded records. | **MISLEADING** | `"Data Posture: DB LOADED"` |
| 12 | `src/app/provenance/page.tsx:143` | `"1. REAL-TIME TELEMETRY (Live Physical Data)"` | On-demand REST fetch with 15-min cache. | **MISLEADING** | `"1. NEAR-REAL-TIME OBSERVATIONS (On-Demand Fetch)"` |
| 13 | `src/app/provenance/page.tsx:146` | Badge: `LIVE STREAM` | No streaming protocol in place. | **MISLEADING** | `ON-DEMAND` |
| 14 | `src/app/provenance/page.tsx:151` | `"What is Real-Time:"` | Mischaracterizes periodic web fetch as real-time. | **MISLEADING** | `"What is fetched from external sensors:"` |
| 15 | `src/app/provenance/page.tsx:155` | Lists ISRO Oceansat winds as real-time stream | Static local JSON file (`mosdac-winds.json`). | **MISLEADING** | Added qualifier: `"(static reference dataset)"` |
| 16 | `src/app/provenance/page.tsx:156` | `"Automated Alert Watcher: Real-time blizzard..."` | Alerts evaluated on-demand during render. | **MISLEADING** | `"Alert Threshold Evaluator: Blizzard and wind threshold checks evaluated on each page request."` |
| 17 | `src/app/components/map/polaris-operational-map.tsx:175` | `"Real-time Telemetry & Satellite Layer Active"` | Satellite layer is 24h-delayed WMS; telemetry is page-load data. | **MISLEADING** | `"Station Observations & Satellite Layers Active"` |
| 18 | `src/app/components/map/polaris-operational-map.tsx:205` | `"LIVE SATELLITE & SENSORS (ISRO / NASA / Ground AWS)"` | ISRO data is static JSON; NASA is daily composite. | **MISLEADING** | `"SATELLITE & SENSOR DATA (ISRO / NASA / Ground AWS)"` |
| 19 | `src/app/components/map/map-legend.tsx:126` | `"● LIVE SATELLITE"` | Represents ISRO static JSON file. | **MISLEADING** | `"● SATELLITE DATA"` |
| 20 | `src/app/components/weather-trend-chart.tsx:101` | `"...authentic readings • Zero synthetic curves"` | Falls back to trigonometric sine-wave generation if database history is lacking. | **MISLEADING** | `"Pipeline: Meteorological Trend Telemetry (${points.length} data points)"` |
| 21 | `src/app/components/data-provenance-modal.tsx:22, 28, 35, 170, 196, 198, 199` | Multiple labels claiming `"Real-Time Telemetry"`, `"in real-time"`, `"Live Physical Telemetry"` | Contradicts the on-demand fetch and static JSON architecture. | **MISLEADING** | Replaced with `"Near-Real-Time Observations"`, `"OBSERVED"`, `"On-Demand Physical Observations"`. |
| 22 | `src/app/components/polaris-header.tsx:68` | Tooltip: `"View Real-Time vs Past vs Simulated Data Origin Guide"` | Exaggerates live capability. | **MISLEADING** | `"View Observed vs Past vs Simulated Data Origin Guide"` |
| 23 | `src/app/expeditions/[code]/page.tsx:112` | `"Synchronizing Mission Telemetry [{code}]..."` | Loading indicator for standard HTTP GET fetch of DB records. | **EXAGGERATED** | `"Loading Mission Data [{code}]..."` |

---

## 16. Security Reality

1. **Authentication & Session Tokens:**
   - Identity foundation built on Supabase Auth (`@supabase/ssr`).
   - Sessions read via HTTP-only cookies (`sb-...-auth-token`).
2. **Database Permissions & RLS:**
   - Anonymous access is restricted to read-only views on public reference tables.
   - All mutations require authenticated JWT tokens matching role checks (`STATION_OPERATOR`, `EXPEDITION_LEADER`, `ADMIN`).
   - Service role key is confined to server-side routes; not exposed to client bundles.
3. **Cryptographic Integrity:**
   - Daily Situation Reports (SITREPs) generate and verify SHA-256 digital hashes over report content to detect tampering in compliance with polar mission log standards.

---

## 17. Runtime Verification

| Verification Aspect | Observed Behavior |
| :--- | :--- |
| **Initial Page Load (`/`)** | Single HTTP GET request executing Next.js Server Component render. Queries Supabase via REST and fetches weather. |
| **5 Seconds Post-Load** | **Zero outbound network requests**. No timers fire. |
| **10 Seconds Post-Load** | Offline sync hook executes `refreshPendingCount()` against IndexedDB. **Zero network calls** if queue is empty. |
| **30 Seconds Post-Load** | **Zero outbound network requests**. |
| **60 Seconds Post-Load** | **Zero outbound network requests**. |
| **5 Minutes Post-Load** | **Zero outbound network requests**. |
| **Open WebSockets?** | **None**. Network tab reveals 0 WebSocket/SSE handshakes. |
| **Does Data Change Without User Action?**| **No**. Data remains completely static until user navigates or manually refreshes the page. |
| **Cache Suppression on Reload** | Successive page reloads within 15 minutes reuse in-memory `WEATHER_CACHE`, bypassing outbound calls to `data.ncpor.res.in`. |

---

## 18. Exact Limitations

1. **No Real-Time Push:** The application cannot push immediate emergency alerts or sensor updates to connected users without a page reload or an out-of-band notification (Telegram/Email/Push).
2. **Web Scraping Fragility:** Weather ingestion relies on regular-expression scraping of public NCPOR HTML tables. Structural HTML changes at `data.ncpor.res.in` will cause fallback to Open-Meteo models.
3. **Simulated Vessel Telemetry:** Logistics coordinates are static scenario waypoints; the vessel cannot be tracked live on high-seas voyages without true satellite AIS integration.
4. **Cold Start & Cache Invalidation:** Because Next.js serverless functions on Vercel spin down during inactivity, in-memory cache entries in `WEATHER_CACHE` can be lost between invocations.

---

## 19. Current vs Planned

| Operational Capability | Current Codebase State | Planned / Future Architecture |
| :--- | :--- | :--- |
| **Weather Telemetry** | Server-side HTML scraping with 15-min in-memory cache + Open-Meteo fallback | Direct MQTT/CoAP telemetry broker from Campbell Scientific station dataloggers |
| **Vessel Tracking** | Static scenario coordinates (`[-52.50, 28.00]`) with manual stage progression | Direct satellite AIS transponder ingest (Spire Maritime / MarineTraffic API) |
| **Hardware Telemetry** | Virtual deterministic adapter generating sine-wave mock readings | Industrial IoT Edge Gateways (Moxa UC-8100) running local Python pollers |
| **Database Sync** | Synchronous REST request-time querying (`supabase.from().select()`) | Supabase Realtime WebSocket subscriptions on operational tables |
| **Anomaly Alerting** | Synchronous render-time evaluation + Daily Vercel Cron outbox run | Event-driven serverless background workers with push fan-out |

---

## 20. Final Developer Summary

POLARIS is an exceptional, disciplined polar logistics and research mission management platform built on Next.js 15 and Supabase. Its mathematical foundations (Siple-Passel Wind Chill, Spencer Solar Ephemeris, Haversine geodesics, and the 4-pillar readiness heuristic) are mathematically sound, rigorously implemented, and fully explainable.

Its primary deficiency was **semantic overstatement in the presentation tier**: badges, descriptions, and tooltips used terms like `"REAL-TIME"`, `"LIVE AWS"`, `"LIVE SATELLITE"`, and `"LIVE VERIFIED"` for features that are technically **on-demand periodic fetches**, **cached REST calls**, **daily satellite composites**, or **authenticated scenario simulations**. Aligning these UI labels with the underlying implementation ensures absolute truthfulness without altering any operational logic.
