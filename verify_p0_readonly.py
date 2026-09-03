import urllib.request
import json
import sys

BASE_URL = "https://polaris-five-eta.vercel.app"

def fetch_json(endpoint: str):
    req = urllib.request.Request(f"{BASE_URL}{endpoint}", headers={"User-Agent": "POLARIS-P0-Audit"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8")), resp.status

print("=== POLARIS P0 READ-ONLY PRODUCTION HEALTH AUDIT ===")

# 1. Dashboard & Readiness Heuristic
d_data, d_status = fetch_json("/api/dashboard")
readiness = d_data["data"]["readiness"]
print(f"\n1. DASHBOARD & READINESS METRIC (HTTP {d_status}):")
print(f"   * Readiness Score: {readiness.get('score')} / 100")
print(f"   * Status: {readiness.get('status')}")
print(f"   * Maintenance Category Score: {readiness.get('categoryScores', {}).get('maintenanceHealth')} / 20")
assert d_status == 200, "Dashboard must return 200"
assert readiness.get("score") == 92, f"Expected 92, got {readiness.get('score')}"
assert readiness.get("categoryScores", {}).get("maintenanceHealth") == 14, "Expected Maintenance 14/20"

# 2. Stations API
s_data, s_status = fetch_json("/api/stations")
stations = s_data["data"]
print(f"\n2. RESEARCH STATIONS API (HTTP {s_status}, {len(stations)} stations):")
for s in stations:
    print(f"   * {s['code']}: {s['name']} (Lat: {s['latitude']}, Lon: {s['longitude']}, Status: {s['status']})")
assert s_status == 200, "Stations must return 200"
assert len(stations) == 4, "Must have 4 stations"

# 3. Weather Telemetry & Provenance
w_data, w_status = fetch_json("/api/weather")
weather = w_data["stations"]
print(f"\n3. WEATHER TELEMETRY API (HTTP {w_status}, {len(weather)} stations):")
for code, w in weather.items():
    st = w.get("stationOverallStatus", {})
    meas = w.get("measurements", {})
    temp = meas.get("temperatureC", {})
    print(f"   * {code}: Temp {temp.get('value')}°C ({temp.get('measurementType')}) | Classification: {st.get('classification')} | Health: {st.get('sourceHealth')}")
assert w_status == 200, "Weather must return 200"
assert "BHR" in weather and "MTR" in weather and "HMD" in weather, "Must contain BHR, MTR, HMD"

# 4. Expeditions API
e_data, e_status = fetch_json("/api/expeditions")
expeditions = e_data["data"]
print(f"\n4. EXPEDITIONS API (HTTP {e_status}, {len(expeditions)} expeditions):")
for e in expeditions:
    print(f"   * {e['code']}: {e['name']} ({e['status']})")
assert e_status == 200, "Expeditions must return 200"

# 5. Assets API
a_data, a_status = fetch_json("/api/assets")
assets = a_data["data"]
print(f"\n5. ASSET INVENTORY API (HTTP {a_status}, {len(assets)} assets):")
crit_assets = [a for a in assets if a.get("criticality") == "CRITICAL"]
print(f"   * Total Assets: {len(assets)}")
print(f"   * Mission-Critical Assets: {len(crit_assets)}")
assert a_status == 200, "Assets must return 200"
assert len(assets) == 9, "Must have 9 assets"

print("\nALL 5 READ-ONLY PRODUCTION AUDIT CHECKS PASSED PERFECTLY WITH ZERO MUTATION.")
