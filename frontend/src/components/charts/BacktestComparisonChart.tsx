'use client';

import React, { useState } from 'react';
import { BacktestPoint } from '@/types/api';

interface BacktestComparisonChartProps {
  data: BacktestPoint[];
  cutoffDate?: string;
}

export function BacktestComparisonChart({
  data,
  cutoffDate,
}: BacktestComparisonChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] text-slate-500 dark:text-slate-400 text-xs">
        No out-of-sample backtest data available for this selection.
      </div>
    );
  }

  const width = 800;
  const height = 340;
  const padding = { top: 24, right: 30, bottom: 44, left: 52 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Compute maximum y scale with 10% headroom
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.actual, d.p90, d.p50)),
    10
  );
  const yMax = Math.ceil(maxVal * 1.15);

  const getX = (index: number) => {
    if (data.length <= 1) return padding.left;
    return padding.left + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return padding.top + chartHeight - (val / yMax) * chartHeight;
  };

  // Generate SVG paths
  // P10-P90 polygon band
  const p90Points = data.map((d, i) => `${getX(i)},${getY(d.p90)}`);
  const p10PointsRev = data
    .slice()
    .reverse()
    .map((d, i) => `${getX(data.length - 1 - i)},${getY(d.p10)}`);
  const bandPolygon = [...p90Points, ...p10PointsRev].join(' ');

  // Predicted P50 line path
  const p50Path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.p50)}`)
    .join(' ');

  // Actual sales line path
  const actualPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.actual)}`)
    .join(' ');

  // 4 horizontal grid guidelines
  const gridTicks = [0, 0.25, 0.5, 0.75, 1.0].map((pct) => Math.round(yMax * pct));

  const hoveredPoint = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="relative rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-4 shadow-sm transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-slate-200 dark:border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Out-of-Sample Trajectory
            </span>
            <span className="inline-flex items-center rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              Zero Leakage Backtest
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Actual daily sales vs expected demand forecast (30-day rolling evaluation)
            {cutoffDate && ` • Cutoff: ${cutoffDate}`}
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            <span className="text-slate-800 dark:text-slate-200">Actual Sales</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-blue-600 dark:bg-blue-400" />
            <span className="text-slate-800 dark:text-slate-200">Expected Sales</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-indigo-400/40 bg-indigo-500/20" />
            <span className="text-slate-500 dark:text-slate-400">Expected Range</span>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="backtestBandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.06" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y-axis labels */}
          {gridTicks.map((val) => {
            const y = getY(val);
            return (
              <g key={`grid-${val}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="currentColor"
                  opacity="0.5"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Quantile Envelope Polygon */}
          <polygon
            points={bandPolygon}
            fill="url(#backtestBandGrad)"
            stroke="#6366f1"
            strokeOpacity="0.4"
            strokeWidth="1"
            strokeDasharray="2 2"
          />

          {/* Predicted P50 Line */}
          <path
            d={p50Path}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Actual Sales Line */}
          <path
            d={actualPath}
            fill="none"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Actual Data Points (every 3rd or all when hovered) */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.actual);
            const isHovered = hoveredIdx === i;
            return (
              <circle
                key={`actual-pt-${i}`}
                cx={cx}
                cy={cy}
                r={isHovered ? 5 : 2.5}
                fill="#059669"
                stroke="white"
                strokeWidth={isHovered ? 2 : 1}
                className="transition-all duration-150"
              />
            );
          })}

          {/* X-axis date labels */}
          {data.map((d, i) => {
            if (i % Math.ceil(data.length / 7) !== 0 && i !== data.length - 1) return null;
            const x = getX(i);
            const dateStr = d.date.slice(5); // MM-DD
            return (
              <text
                key={`xlabel-${i}`}
                x={x}
                y={height - padding.bottom + 18}
                textAnchor="middle"
                fill="currentColor"
                opacity="0.55"
                fontSize="10"
                fontFamily="monospace"
              >
                {dateStr}
              </text>
            );
          })}

          {/* Hover Crosshair & Trigger Columns */}
          {hoveredIdx !== null && (
            <g pointerEvents="none">
              <line
                x1={getX(hoveredIdx)}
                y1={padding.top}
                x2={getX(hoveredIdx)}
                y2={height - padding.bottom}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.6"
              />
              <circle
                cx={getX(hoveredIdx)}
                cy={getY(data[hoveredIdx].p50)}
                r="4.5"
                fill="#2563eb"
                stroke="white"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Invisible interactive overlay vertical slices */}
          {data.map((_, i) => {
            const x = getX(i);
            const sliceWidth = chartWidth / data.length;
            return (
              <rect
                key={`overlay-${i}`}
                x={x - sliceWidth / 2}
                y={padding.top}
                width={sliceWidth}
                height={chartHeight}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoveredIdx(i)}
              />
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && hoveredIdx !== null && (
          <div
            className="pointer-events-none absolute top-4 z-20 rounded-md border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-2.5 text-xs text-slate-900 dark:text-slate-100 shadow-md backdrop-blur-sm transition-all"
            style={{
              left: `${Math.min(
                Math.max((getX(hoveredIdx) / width) * 100 - 10, 4),
                74
              )}%`,
            }}
          >
            <div className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1 mb-1.5 flex justify-between gap-4">
              <span>{hoveredPoint.date}</span>
              <span>Day {hoveredPoint.day}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
              <div className="text-slate-500 dark:text-slate-400">Actual Sales:</div>
              <div className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                {hoveredPoint.actual.toFixed(1)} u
              </div>

              <div className="text-slate-500 dark:text-slate-400">Expected Sales:</div>
              <div className="text-right font-semibold text-blue-600 dark:text-blue-400">
                {hoveredPoint.p50.toFixed(1)} u
              </div>

              <div className="text-slate-500 dark:text-slate-400">Forecast Spread:</div>
              <div className="text-right text-slate-500 dark:text-slate-400">
                [{hoveredPoint.p10.toFixed(1)} - {hoveredPoint.p90.toFixed(1)}]
              </div>

              <div className="text-slate-500 dark:text-slate-400">Variance (Err):</div>
              <div
                className={`text-right font-semibold ${
                  hoveredPoint.error > 0
                    ? 'text-amber-500'
                    : hoveredPoint.error < 0
                    ? 'text-rose-500'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {hoveredPoint.error > 0 ? `+${hoveredPoint.error.toFixed(1)}` : hoveredPoint.error.toFixed(1)} u
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
