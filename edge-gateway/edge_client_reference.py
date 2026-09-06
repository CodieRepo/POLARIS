#!/usr/bin/env python3
"""
POLARIS Edge Gateway Reference Implementation
Target: Industrial Linux Edge Gateway (e.g. Moxa UC-8100, Raspberry Pi CM4)
Location: Station Server Rack (Bharati / Maitri)

Connects to physical field sensors, formats reboot-safe telemetry events,
and dispatches batches to the POLARIS Cloud Ingestion API over HTTPS.
"""

import os
import sys
import time
import uuid
import json
import logging
from datetime import datetime, timezone
import urllib.request
import urllib.error

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

GATEWAY_ID = os.getenv("POLARIS_GATEWAY_ID", "EDGE-GW-BHR-01")
GATEWAY_KEY = os.getenv("POLARIS_GATEWAY_KEY", "")
CLOUD_ENDPOINT = os.getenv("POLARIS_INGEST_URL", "https://polaris-five-eta.vercel.app/api/hardware/ingest")

BOOT_SESSION_ID = f"boot-{int(time.time())}"
sequence_counter = 0


def get_next_sequence():
    global sequence_counter
    sequence_counter += 1
    return sequence_counter


def sample_field_devices():
    """
    In a physical deployment, this function polls Modbus RTU (minimalmodbus/pymodbus),
    SNMP (pysnmp), or NMEA serial ports (pyserial).
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    # Device 1: Bulk Fuel Tank Hydrostatic Level Sensor (Modbus TCP)
    tank_event = {
        "eventId": str(uuid.uuid4()),
        "gatewayId": GATEWAY_ID,
        "deviceId": "BHR-MODBUS-TK01",
        "sequenceNumber": get_next_sequence(),
        "bootSessionId": BOOT_SESSION_ID,
        "observedAt": now_iso,
        "metric": "FUEL_LEVEL_LITERS",
        "value": 122350.0,
        "unit": "liters",
        "quality": "GOOD",
        "source": "MODBUS",
        "classification": "PHYSICAL_TELEMETRY",
        "rawPayload": {"modbusRegister": 40001, "rawRegisterValue": 12235},
    }

    # Device 2: Generator Load Monitor (Modbus RTU)
    gen_event = {
        "eventId": str(uuid.uuid4()),
        "gatewayId": GATEWAY_ID,
        "deviceId": "BHR-MODBUS-GEN01",
        "sequenceNumber": get_next_sequence(),
        "bootSessionId": BOOT_SESSION_ID,
        "observedAt": now_iso,
        "metric": "GENERATOR_POWER_KW",
        "value": 143.2,
        "unit": "kW",
        "quality": "GOOD",
        "source": "MODBUS",
        "classification": "PHYSICAL_TELEMETRY",
        "rawPayload": {"modbusSlaveId": 1, "loadKw": 143.2},
    }

    return [tank_event, gen_event]


def dispatch_telemetry(events):
    payload = json.dumps({"gatewayId": GATEWAY_ID, "events": events}).encode("utf-8")
    req = urllib.request.Request(CLOUD_ENDPOINT, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("x-polaris-gateway-id", GATEWAY_ID)
    req.add_header("x-polaris-gateway-key", GATEWAY_KEY)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read().decode("utf-8")
            logging.info(f"Ingestion response ({resp.status}): {data}")
            return True
    except urllib.error.HTTPError as e:
        logging.error(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
        return False
    except urllib.error.URLError as e:
        logging.error(f"Connection failed: {e.reason}")
        return False


def main():
    logging.info(f"Starting POLARIS Edge Gateway client {GATEWAY_ID} [Session: {BOOT_SESSION_ID}]")
    events = sample_field_devices()
    logging.info(f"Sampled {len(events)} device events. Dispatching to {CLOUD_ENDPOINT}...")
    success = dispatch_telemetry(events)
    if success:
        logging.info("Telemetry batch dispatched successfully.")
    else:
        logging.warning("Batch dispatch failed. In production, spool to local SQLite buffer.")


if __name__ == "__main__":
    main()
