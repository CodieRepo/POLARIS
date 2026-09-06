'use client';

import { useState, useEffect, useCallback } from 'react';
import { HardwareDevice } from '@/core/hardware-gateway/types';
import { useAuth } from '@/infrastructure/auth/auth-provider';

interface HardwareTelemetryWidgetProps {
  stationId?: string;
  stationName?: string;
}

export function HardwareTelemetryWidget({
  stationId,
  stationName = 'Station Field Hardware',
}: HardwareTelemetryWidgetProps) {
  const { can, role } = useAuth();
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<string | null>(null);
  const [pollResult, setPollResult] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const url = stationId
        ? `/api/hardware/devices?stationId=${stationId}`
        : `/api/hardware/devices`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error('Failed to load hardware devices', err);
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleSimulatePoll = async () => {
    try {
      setPolling(true);
      setPollResult(null);
      const res = await fetch('/api/hardware/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayId: stationId?.includes('0002') ? 'EDGE-GW-MTR-01' : 'EDGE-GW-BHR-01',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastPollTime(new Date().toLocaleTimeString());
        setPollResult(`Accepted: ${data.result?.accepted || 0}, Deduplicated: ${data.result?.deduplicated || 0}`);
        await fetchDevices();
      } else {
        setPollResult(`Error: ${data.error}`);
      }
    } catch (err) {
      const e = err as Error;
      setPollResult(`Failed: ${e.message}`);
    } finally {
      setPolling(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-xl text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="text-base font-semibold tracking-wide text-white">
              Field Telemetry & Edge Gateway
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {stationName} &bull; Tier B Edge Gateway Ingestion
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            SIMULATED_TELEMETRY
          </span>
          {can("HARDWARE_SIMULATE_POLL") || (!role || role !== "VIEWER") ? (
            <button
              onClick={handleSimulatePoll}
              disabled={polling}
              className="px-3 py-1 text-xs font-medium rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white transition shadow cursor-pointer"
            >
              {polling ? 'Polling Bus...' : 'Simulate Edge Poll'}
            </button>
          ) : (
            <span className="text-[10px] font-mono text-slate-500 italic">
              Monitoring Mode
            </span>
          )}
        </div>
      </div>

      {pollResult && (
        <div className="mt-3 p-2 bg-slate-800/80 border border-slate-700 rounded text-xs font-mono text-cyan-300 flex justify-between">
          <span>Poll Result: {pollResult}</span>
          {lastPollTime && <span className="text-slate-400">At {lastPollTime}</span>}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-500 font-mono">
          Querying edge gateway device registry...
        </div>
      ) : devices.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500">
          No hardware telemetry devices configured for this station.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {devices.map((device) => {
            const reading = device.lastReading;
            return (
              <div
                key={device.id}
                className="bg-slate-950/70 border border-slate-800 rounded p-3 hover:border-slate-700 transition"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-xs font-mono font-bold text-cyan-400">
                      {device.deviceCode}
                    </div>
                    <div className="text-xs text-slate-300 font-medium truncate max-w-[180px]">
                      {device.name}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {device.protocol}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 font-mono block">
                      {reading ? reading.metric.replace(/_/g, ' ') : 'No telemetry yet'}
                    </span>
                    <span className="text-lg font-mono font-bold text-white">
                      {reading ? reading.value.toLocaleString() : '--'}
                    </span>{' '}
                    <span className="text-xs text-slate-400 font-mono">
                      {reading ? reading.unit : ''}
                    </span>
                  </div>

                  {reading && (
                    <div className="text-right">
                      <span
                        className={`text-[9px] font-mono uppercase px-1 py-0.5 rounded ${
                          reading.quality === 'GOOD'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                        }`}
                      >
                        {reading.quality}
                      </span>
                      <span className="block text-[9px] text-slate-500 font-mono mt-1">
                        {new Date(reading.observedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>Gateway Bus: Moxa UC-8100 / RS-485 Modbus TCP / SNMP</span>
        <span>Zero-Trust API Ingestion &bull; SHA-256 Auth</span>
      </div>
    </div>
  );
}
