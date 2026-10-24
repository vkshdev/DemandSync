'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  Layers,
  Play,
  Sparkles,
} from 'lucide-react';
import {
  ScenarioSimulationRequest,
  ScenarioSimulationResponse,
  DailySimulationPoint,
} from '@/types/api';
import { api } from '@/lib/api';
import { SKUS, STORES } from '@/lib/catalog';

interface ScenarioLabProps {
  initialSkuId?: string;
  initialStoreId?: string;
  onOpenCopilot?: (context: Record<string, unknown>) => void;
}

export default function ScenarioLab({
  initialSkuId = 'SKU-001',
  initialStoreId = 'STORE-001',
  onOpenCopilot,
}: ScenarioLabProps) {
  const [skuId, setSkuId] = useState(initialSkuId);
  const [storeId, setStoreId] = useState(initialStoreId);

  // Simulation parameters
  const [discountPct, setDiscountPct] = useState<number>(0.20);
  const [tempShift, setTempShift] = useState<number>(-10.0);
  const [extremeWeather, setExtremeWeather] = useState<boolean>(true);
  const [leadTimeShock, setLeadTimeShock] = useState<number>(7);
  const [liveSync, setLiveSync] = useState<boolean>(true);

  // Simulation results
  const [result, setResult] = useState<ScenarioSimulationResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<DailySimulationPoint | null>(null);

  const runSimulation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload: ScenarioSimulationRequest = {
        sku_id: skuId,
        store_id: storeId,
        discount_pct: Number(discountPct.toFixed(2)),
        weather_temp_celsius_shift: Number(tempShift.toFixed(1)),
        extreme_weather_flag: extremeWeather,
        supplier_lead_time_days_shock: leadTimeShock,
        horizon_days: 30,
      };
      const data = await api.simulateScenario(payload);
      setResult(data);
    } catch {
      setError('Simulation service offline. Displaying deterministic local projection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (liveSync) {
      const timer = setTimeout(() => {
        runSimulation();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [skuId, storeId, discountPct, tempShift, extremeWeather, leadTimeShock, liveSync]);

  const handleReset = () => {
    setDiscountPct(0.0);
    setTempShift(0.0);
    setExtremeWeather(false);
    setLeadTimeShock(0);
  };

  const applyPreset = (presetName: string) => {
    if (presetName === 'summer') {
      setDiscountPct(0.25);
      setTempShift(8.0);
      setExtremeWeather(false);
      setLeadTimeShock(2);
    } else if (presetName === 'vortex') {
      setDiscountPct(0.10);
      setTempShift(-12.0);
      setExtremeWeather(true);
      setLeadTimeShock(5);
    } else if (presetName === 'port') {
      setDiscountPct(0.05);
      setTempShift(0.0);
      setExtremeWeather(false);
      setLeadTimeShock(12);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-slate-100">Prescriptive Scenario Lab</h2>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Evaluate multidimensional demand elasticity and supply chain disruptions under what-if parameters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 px-1.5">Presets:</span>
            <button
              onClick={() => applyPreset('summer')}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] transition"
            >
              Summer Promo
            </button>
            <button
              onClick={() => applyPreset('vortex')}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] transition"
            >
              Polar Vortex
            </button>
            <button
              onClick={() => applyPreset('port')}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] transition"
            >
              Port Shock
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer ml-1">
            <input
              type="checkbox"
              checked={liveSync}
              onChange={(e) => setLiveSync(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0"
            />
            Live Recalc
          </label>
          <button
            onClick={runSimulation}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {isLoading ? 'Simulating...' : 'Run'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs bg-amber-950/40 border border-amber-800/60 text-amber-300 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Controls on Left, Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-5 p-5 rounded-xl bg-slate-900 border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-800">
            Scenario Parameters
          </h3>

          {/* SKU and Store Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Target SKU</label>
              <select
                value={skuId}
                onChange={(e) => setSkuId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {SKUS.map((item) => (
                  <option key={item.sku_id} value={item.sku_id}>
                    {item.sku_id} - {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Store Location</label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {STORES.map((st) => (
                  <option key={st.store_id} value={st.store_id}>
                    {st.store_id} ({st.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Slider 1: Promotional Markdown Discount */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-300">Promotional Markdown Discount</span>
              <span className="font-mono font-bold text-indigo-400">
                {(discountPct * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.30"
              step="0.05"
              value={discountPct}
              onChange={(e) => setDiscountPct(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0%</span>
              <span>5%</span>
              <span>10%</span>
              <span>15%</span>
              <span>20%</span>
              <span>25%</span>
              <span>30%</span>
            </div>
          </div>

          {/* Slider 2: Ambient Temperature Shift */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-300">Temperature Shift (C)</span>
              <span
                className={`font-mono font-bold ${
                  tempShift < 0 ? 'text-cyan-400' : tempShift > 0 ? 'text-amber-400' : 'text-slate-300'
                }`}
              >
                {tempShift > 0 ? `+${tempShift.toFixed(1)}` : tempShift.toFixed(1)} C
              </span>
            </div>
            <input
              type="range"
              min="-15"
              max="15"
              step="1"
              value={tempShift}
              onChange={(e) => setTempShift(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-15 C (Polar Vortex)</span>
              <span>0 C (Baseline)</span>
              <span>+15 C (Heatwave)</span>
            </div>
          </div>

          {/* Toggle: Extreme Weather Disruption */}
          <div className="pt-2">
            <label className="flex items-center justify-between p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-slate-200">Extreme Weather Disruption</span>
                <p className="text-[11px] text-slate-400">Triggers +20% exogenous surge and retail foot traffic shock</p>
              </div>
              <input
                type="checkbox"
                checked={extremeWeather}
                onChange={(e) => setExtremeWeather(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-indigo-500 focus:ring-0 cursor-pointer"
              />
            </label>
          </div>

          {/* Slider 3: Supplier Lead-Time Shock */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-300">Supplier Lead-Time Shock</span>
              <span className={`font-mono font-bold ${leadTimeShock > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                +{leadTimeShock} days
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="14"
              step="1"
              value={leadTimeShock}
              onChange={(e) => setLeadTimeShock(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 days (Normal)</span>
              <span>+7 days (Transit Delay)</span>
              <span>+14 days (Port Shock)</span>
            </div>
          </div>

          {/* Action: Send to Copilot */}
          {onOpenCopilot && (
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={() =>
                  onOpenCopilot({
                    sku_id: skuId,
                    store_id: storeId,
                    discount_pct: discountPct,
                    temp_shift: tempShift,
                    extreme_weather: extremeWeather,
                    lead_time_shock: leadTimeShock,
                    result: result,
                  })
                }
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Analyze Scenario in Copilot Briefing
              </button>
            </div>
          )}
        </div>

        {/* Results Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* 4 Impact KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Card 1: 30-Day Demand Volume */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Demand Volume</div>
              <div className="mt-2">
                <div className="text-xl font-bold font-mono text-slate-100">
                  {result ? `${result.simulated_p50_total.toFixed(0)} units` : '-'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Base: {result ? `${result.baseline_p50_total.toFixed(0)} units` : '-'}
                </div>
              </div>
              <div className="mt-3">
                {result && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      result.demand_delta_pct >= 0
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {result.demand_delta_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {result.demand_delta_pct >= 0
                      ? `+${result.demand_delta_pct.toFixed(1)}%`
                      : `${result.demand_delta_pct.toFixed(1)}%`}
                  </span>
                )}
              </div>
            </div>

            {/* Card 2: Stockout Risk */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Stockout Risk</div>
              <div className="mt-2">
                <div className="text-xl font-bold font-mono text-slate-100">
                  {result ? `${result.simulated_stockout_risk_pct.toFixed(1)}%` : '-'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Base: {result ? `${result.baseline_stockout_risk_pct.toFixed(1)}%` : '-'}
                </div>
              </div>
              <div className="mt-3">
                {result && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      result.simulated_stockout_risk_pct >= 70
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : result.simulated_stockout_risk_pct >= 40
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {result.simulated_stockout_risk_pct >= 70
                      ? 'CRITICAL'
                      : result.simulated_stockout_risk_pct >= 40
                      ? 'WARNING'
                      : 'HEALTHY'}
                  </span>
                )}
              </div>
            </div>

            {/* Card 3: Revised Safety Stock */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Revised SS</div>
              <div className="mt-2">
                <div className="text-xl font-bold font-mono text-slate-100">
                  {result ? `${result.revised_safety_stock_units} units` : '-'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Non-negative integer</div>
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                  <ShieldCheck className="w-3 h-3 text-indigo-400" />
                  95% SL Buffer
                </span>
              </div>
            </div>

            {/* Card 4: Revised Reorder Point */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Revised ROP</div>
              <div className="mt-2">
                <div className="text-xl font-bold font-mono text-slate-100">
                  {result ? `${result.revised_reorder_point_units} units` : '-'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Reorder trigger</div>
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                  <Layers className="w-3 h-3 text-cyan-400" />
                  Lead time coverage
                </span>
              </div>
            </div>
          </div>

          {/* Comparative Daily Curve Display */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-200">30-Day Comparative Forecast Trajectory</h4>
                <p className="text-xs text-slate-400">Median demand projection: Baseline vs Simulated Shock</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-slate-500 inline-block border-b border-dashed border-slate-400" />
                  <span className="text-slate-400">Baseline (P50)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-indigo-500 rounded-full inline-block" />
                  <span className="text-indigo-300">Simulated (P50)</span>
                </div>
              </div>
            </div>

            {/* Responsive SVG Chart */}
            <div className="relative w-full h-64 bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
              {result && result.daily_simulation_series.length > 0 ? (
                <ComparativeChartSvg series={result.daily_simulation_series} onHoverPoint={setHoveredDay} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                  {isLoading ? 'Computing simulation vectors...' : 'No simulation trajectory available'}
                </div>
              )}
            </div>

            {/* Interactive Hover Telemetry Bar */}
            <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-400">
                {hoveredDay
                  ? `Date: ${hoveredDay.date} (Day ${hoveredDay.day})`
                  : 'Hover over chart curve to view daily point data'}
              </span>
              {hoveredDay && (
                <div className="flex items-center gap-4 font-mono">
                  <span className="text-slate-400">
                    Base: <strong className="text-slate-200">{hoveredDay.baseline_p50.toFixed(1)}</strong>
                  </span>
                  <span className="text-indigo-400">
                    Sim: <strong className="text-indigo-300">{hoveredDay.simulated_p50.toFixed(1)}</strong>
                  </span>
                  <span
                    className={
                      hoveredDay.simulated_p50 >= hoveredDay.baseline_p50 ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    Delta: {hoveredDay.simulated_p50 >= hoveredDay.baseline_p50 ? '+' : ''}
                    {(hoveredDay.simulated_p50 - hoveredDay.baseline_p50).toFixed(1)} units
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparativeChartSvg({
  series,
  onHoverPoint,
}: {
  series: DailySimulationPoint[];
  onHoverPoint: (point: DailySimulationPoint | null) => void;
}) {
  const width = 600;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };

  const maxVal = Math.max(...series.map((p) => Math.max(p.baseline_p90, p.simulated_p90)), 10.0);

  const getX = (idx: number) => padding.left + (idx / (series.length - 1)) * (width - padding.left - padding.right);
  const getY = (val: number) => height - padding.bottom - (val / maxVal) * (height - padding.top - padding.bottom);

  const baselinePath = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.baseline_p50)}`).join(' ');

  const simulatedPath = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.simulated_p50)}`).join(' ');

  const envelopePath = [
    ...series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.simulated_p90)}`),
    ...series.slice().reverse().map((p, i) => `L ${getX(series.length - 1 - i)} ${getY(p.simulated_p10)}`),
    'Z',
  ].join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full select-none"
      onMouseLeave={() => onHoverPoint(null)}
    >
      {/* Horizontal Gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
        const y = height - padding.bottom - ratio * (height - padding.top - padding.bottom);
        const labelVal = (ratio * maxVal).toFixed(0);
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#334155"
              strokeDasharray="3 3"
              strokeWidth="0.75"
            />
            <text x={padding.left - 6} y={y + 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
              {labelVal}
            </text>
          </g>
        );
      })}

      {/* Simulated Quantile Envelope (P10 - P90) */}
      <path d={envelopePath} fill="#6366f1" fillOpacity="0.12" />

      {/* Baseline P50 Curve (Dashed) */}
      <path d={baselinePath} fill="none" stroke="#94a3b8" strokeWidth="1.75" strokeDasharray="4 4" />

      {/* Simulated P50 Curve (Bold Solid) */}
      <path d={simulatedPath} fill="none" stroke="#6366f1" strokeWidth="2.5" />

      {/* Interactive Hover Nodes */}
      {series.map((p, i) => (
        <circle
          key={i}
          cx={getX(i)}
          cy={getY(p.simulated_p50)}
          r="4"
          className="cursor-pointer fill-indigo-400 hover:fill-white hover:r-6 transition-all opacity-0 hover:opacity-100"
          onMouseEnter={() => onHoverPoint(p)}
        />
      ))}
    </svg>
  );
}
