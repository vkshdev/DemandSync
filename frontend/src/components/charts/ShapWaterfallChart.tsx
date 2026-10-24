'use client';

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Cpu, Layers } from 'lucide-react';
import { TreeShapDriver } from '@/types/api';

export interface ShapWaterfallChartProps {
  drivers: TreeShapDriver[];
  title?: string;
  subtitle?: string;
  maxDisplay?: number;
  className?: string;
}

const FEATURE_NAME_MAP: Record<string, string> = {
  historical_weekend_traffic_lift: 'Weekend Foot Traffic Lift',
  weekend_traffic_lift: 'Weekend Foot Traffic Lift',
  price_elasticity_discount: 'Promotional Price Elasticity',
  promotional_discount: 'Promotional Discount Depth',
  temperature_anomaly_factor: 'Temperature Anomaly Multiplier',
  regional_temperature_lift: 'Regional Temperature Lift',
  precipitation_mm: 'Precipitation & Rain Shock',
  unseasonal_rain_drag: 'Unseasonal Precipitation Drag',
  sales_lag_1: 'Prior Day Sales Momentum (t-1)',
  sales_lag_7: 'Weekly Seasonal Lag (t-7)',
  sales_lag_14: 'Bi-Weekly Lag (t-14)',
  sales_lag_28: 'Monthly Seasonal Cycle (t-28)',
  sales_roll_mean_7: '7-Day Velocity Baseline',
  sales_roll_mean_28: '28-Day Moving Baseline',
  extreme_weather_flag: 'Severe Weather Disruption',
  promo_active: 'Active Promotional Campaign',
  discount_pct: 'Markdown Discount Depth',
  local_competitor_proximity: 'Local Retail Competition Drag',
  supplier_lead_time_volatility: 'Supplier Lead Time Volatility',
};

export function ShapWaterfallChart({
  drivers = [],
  title = 'TreeSHAP Demand Swing Drivers',
  subtitle = 'Feature attributions ranked by impact magnitude on median (P50) forecast',
  maxDisplay = 6,
  className = '',
}: ShapWaterfallChartProps) {
  const sortedDrivers = useMemo(() => {
    return [...drivers]
      .sort((a, b) => Math.abs(b.attribution_value) - Math.abs(a.attribution_value))
      .slice(0, maxDisplay);
  }, [drivers, maxDisplay]);

  const maxMagnitude = useMemo(() => {
    if (!sortedDrivers.length) return 0.2;
    const maxVal = Math.max(...sortedDrivers.map((d) => Math.abs(d.attribution_value)));
    return Math.max(maxVal, 0.05);
  }, [sortedDrivers]);

  const formatFeatureName = (feat: string) => {
    if (FEATURE_NAME_MAP[feat]) return FEATURE_NAME_MAP[feat];
    return feat
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-400" />
            <h3 className="font-semibold text-slate-100">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 font-medium text-emerald-400">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            Positive Lift
          </span>
          <span className="flex items-center gap-1 font-medium text-rose-400">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500" />
            Negative Drag
          </span>
        </div>
      </div>

      {sortedDrivers.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-800 text-sm text-slate-500">
          No SHAP attribution records for this item
        </div>
      ) : (
        <div className="space-y-3.5 pt-2">
          {sortedDrivers.map((driver, idx) => {
            const isPositive = driver.attribution_value >= 0;
            const pctOfMax = (Math.abs(driver.attribution_value) / maxMagnitude) * 100;
            const barWidth = Math.min(100, Math.max(4, pctOfMax));

            return (
              <div
                key={idx}
                className="group rounded-lg bg-slate-950/40 p-2.5 transition-colors hover:bg-slate-950/70 border border-slate-800/60"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-200">
                    {formatFeatureName(driver.feature)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-semibold text-[11px] px-1.5 py-0.5 rounded ${
                        isPositive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {driver.impact || `${isPositive ? '+' : ''}${(driver.attribution_value * 100).toFixed(1)}%`}
                    </span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      {isPositive ? '+' : ''}
                      {driver.attribution_value.toFixed(3)}
                    </span>
                  </div>
                </div>

                {/* Waterfall Magnitude Bar */}
                <div className="relative h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600 z-10" />

                  {isPositive ? (
                    <div
                      className="absolute top-0 bottom-0 left-1/2 rounded-r-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${barWidth / 2}%` }}
                    />
                  ) : (
                    <div
                      className="absolute top-0 bottom-0 rounded-l-full bg-rose-500 transition-all duration-300"
                      style={{
                        right: '50%',
                        width: `${barWidth / 2}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary caption */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5 text-indigo-400" />
          Additive baseline decomposition relative to unconditional sample mean
        </span>
        <span className="font-mono">Top {sortedDrivers.length} features shown</span>
      </div>
    </div>
  );
}
