# POLARIS Field Edge Telemetry Gateway Specification

## Architecture Overview

Physical field devices and sensors located at polar research stations (Bharati, Maitri, Himadri) operate over industrial protocols (Modbus RTU over RS-485, Modbus TCP, SNMP, and NMEA-0183 serial).

Because cloud serverless environments (e.g. Vercel) cannot maintain persistent TCP sockets, serial RS-485 ports, or survive polar satellite comms disruptions, POLARIS enforces a strict **Hardware Edge Boundary**:

```
[ Tier C: Field Industrial Hardware ]
  - Hydrostatic Fuel Level Transmitters (Yokogawa / WIKA)
  - Generator Controllers (ComAp InteliLite / DeepSea)
  - Powerhouse DC UPS (APC SNMP)
  - GPS Chronometers (Trimble NMEA-0183)
                     │
                     ▼ (RS-485 / Modbus TCP / SNMP / Serial)
[ Tier B: POLARIS Edge Gateway Runtime ]
  (Industrial PC / Moxa / Raspberry Pi CM4 located on-station)
  - Local polling loop (10s – 60s)
  - Reboot-safe sequence & boot session tracking
  - Offline store-and-forward SQLite buffer
  - Cryptographic gateway authentication (HMAC / SHA-256)
                     │
                     ▼ (HTTPS / Satellite WAN / Iridium / Starlink)
[ Tier A: POLARIS Cloud Ingestion API ]
  - Endpoint: POST /api/hardware/ingest
  - Headers:
      x-polaris-gateway-id: EDGE-GW-BHR-01
      x-polaris-gateway-key: <SCOPED_PRESHARED_KEY>
  - Reboot-safe deduplication: (gateway_id, device_id, boot_session_id, sequence_number)
  - PostgreSQL Persistence: public.hardware_telemetry_history
```

## Credential Management & Key Revocation

Each Edge Gateway is provisioned with a unique, scoped API key.
The cloud database stores only the **SHA-256 hash** of the key in `public.gateway_credentials`.
Station administrators can revoke compromised gateways immediately by setting `is_active = false` or `revoked_at = now()`.

## Reboot-Safe Sequence Identity

When an edge gateway reboots, internal sequence counters may reset to 0.
To prevent sequence collisions or false deduplication, every packet includes:
1. `event_id`: Unique UUID v4 generated per reading
2. `boot_session_id`: Unique string generated upon gateway startup (e.g. `boot-<start_timestamp>`)
3. `sequence_number`: Monotonically increasing counter within that boot session.

## Virtual Telemetry Classification

For demonstration, development, and testing, the repository includes `VirtualTelemetryAdapter`.
All records produced by this adapter are watermarked with:
- `classification: 'SIMULATED_TELEMETRY'`
- `quality: 'SIMULATED'`
- `source: 'VIRTUAL'`
