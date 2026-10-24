'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Activity } from 'lucide-react';
import { DailyForecastPoint } from '@/types/api';

export interface QuantileBandChartProps {
  data: DailyForecastPoint[];
  title?: string;
  subtitle?: string;
  height?: number;
  unitLabel?: string;
  showActuals?: boolean;
  className?: string;
}

export function QuantileBandChart({
  data = [],
  title = '30-Day Probabilistic Demand Forecast',
  subtitle = 'Quantile confidence envelope (P10-P90) with median projection (P50)',
  height = 340,
  unitLabel = 'units',
  showActuals = true,
  className = '',
}: QuantileBandChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const viewBoxWidth = 800;
  const viewBoxHeight = height;
  const padding = { top: 28, right: 36, bottom: 48, left: 64 };
  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const chartHeight = viewBoxHeight - padding.top - padding.bottom;

  const { minVal, maxVal, hasActuals } = useMemo(() => {
    if (!data.length) return { minVal: 0, maxVal: 100, hasActuals: false };
    let min = Infinity;
    let max = -Infinity;
    let actualsFound = false;

    data.forEach((d) => {
      if (d.p10 < min) min = d.p10;
      if (d.p90 > max) max = d.p90;
      if (typeof d.actual === 'number') {
        actualsFound = true;
        if (d.actual < min) min = d.actual;
        if (d.actual > max) max = d.actual;
      }
    });

    const floorMin = Math.max(0, Math.floor(min * 0.85));
    const ceilMax = Math.ceil(max * 1.15) || 100;
    return { minVal: floorMin, maxVal: ceilMax, hasActuals: actualsFound };
  }, [data]);

  const scaleX = (index: number) => {
    if (data.length <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (data.length - 1)) * chartWidth;
  };

  const scaleY = (val: number) => {
    const range = maxVal - minVal || 1;
    return padding.top + chartHeight - ((val - minVal) / range) * chartHeight;
  };

  const bandPath = useMemo(() => {
    if (data.length < 2) return '';
    let upper = '';
    let lower = '';

    data.forEach((d, i) => {
      const x = scaleX(i);
      const yP90 = scaleY(d.p90);
      const yP10 = scaleY(d.p10);
      if (i === 0) {
        upper += `M ${x.toFixed(1)},${yP90.toFixed(1)}`;
      } else {
        upper += ` L ${x.toFixed(1)},${yP90.toFixed(1)}`;
      }
      lower = ` L ${x.toFixed(1)},${yP10.toFixed(1)}` + lower;
    });

    return `${upper}${lower} Z`;
  }, [data, minVal, maxVal]);

  const medianPath = useMemo(() => {
    if (data.length < 2) return '';
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)},${scaleY(d.p50).toFixed(1)}`)
      .join(' ');
  }, [data, minVal, maxVal]);

  const actualPath = useMemo(() => {
    if (!showActuals || data.length < 2) return '';
    const pointsWithActual = data
      .map((d, i) => ({ d, i }))
      .filter((item) => typeof item.d.actual === 'number');
    if (pointsWithActual.length < 2) return '';
    return pointsWithActual
      .map(
        (item, idx) =>
          `${idx === 0 ? 'M' : 'L'} ${scaleX(item.i).toFixed(1)},${scaleY(item.d.actual as number).toFixed(1)}`
      )
      .join(' ');
  }, [data, minVal, maxVal, showActuals]);

  const yTicks = useMemo(() => {
    const steps = 4;
    const ticks = [];
    for (let i = 0; i <= steps; i++) {
      const val = minVal + ((maxVal - minVal) / steps) * i;
      ticks.push(Math.round(val));
    }
    return ticks;
  }, [minVal, maxVal]);

  const xTickIndices = useMemo(() => {
    if (data.length <= 5) return data.map((_, i) => i);
    const step = Math.floor(data.length / 5);
    const indices = [0, step, step * 2, step * 3, step * 4, data.length - 1];
    return Array.from(new Set(indices));
  }, [data]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!data.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * viewBoxWidth;

    const clampedX = Math.max(padding.left, Math.min(padding.left + chartWidth, svgX));
    const ratio = (clampedX - padding.left) / chartWidth;
    const nearestIdx = Math.round(ratio * (data.length - 1));
    setHoverIndex(nearestIdx);
  };

  const activePoint = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : null;

  return (
    <div
      ref={containerRef}
      className={`rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-400" />
            <h3 className="font-semibold text-slate-100">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded bg-indigo-500/25 border border-indigo-400/40" />
            <span>P10 - P90 Envelope</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-indigo-500 rounded" />
            <span>P50 Median</span>
          </div>
          {hasActuals && showActuals && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-emerald-400 border-dashed border-b border-emerald-400" />
              <span>Actuals</span>
            </div>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-800 text-sm text-slate-500">
          No forecast data available for selected horizon
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            className="w-full h-auto cursor-crosshair overflow-visible"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="quantileGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.08" />
              </linearGradient>
            </defs>

            {/* Y Grid & Labels */}
            {yTicks.map((tickVal) => {
              const y = scaleY(tickVal);
              return (
                <g key={tickVal}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + chartWidth}
                    y2={y}
                    stroke="#334155"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[11px] fill-slate-400 font-mono"
                  >
                    {tickVal}
                  </text>
                </g>
              );
            })}

            {/* X Labels */}
            {xTickIndices.map((idx) => {
              const x = scaleX(idx);
              const point = data[idx];
              if (!point) return null;
              const dateLabel = point.date.length > 5 ? point.date.slice(5) : point.date;
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={padding.top + chartHeight}
                    x2={x}
                    y2={padding.top + chartHeight + 6}
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={padding.top + chartHeight + 20}
                    textAnchor="middle"
                    className="text-[11px] fill-slate-400 font-mono"
                  >
                    {dateLabel}
                  </text>
                </g>
              );
            })}

            {/* Quantile Envelope */}
            {bandPath && (
              <path
                d={bandPath}
                fill="url(#quantileGrad)"
                stroke="#6366f1"
                strokeWidth="1"
                strokeOpacity="0.4"
                strokeDasharray="2 2"
              />
            )}

            {/* Median P50 Line */}
            {medianPath && (
              <path
                d={medianPath}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Actuals Line */}
            {actualPath && (
              <path
                d={actualPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
            )}

            {/* Hover Crosshair & Indicators */}
            {hoverIndex !== null && activePoint && (
              <g>
                <line
                  x1={scaleX(hoverIndex)}
                  y1={padding.top}
                  x2={scaleX(hoverIndex)}
                  y2={padding.top + chartHeight}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={scaleX(hoverIndex)}
                  cy={scaleY(activePoint.p90)}
                  r="3.5"
                  fill="#818cf8"
                />
                <circle
                  cx={scaleX(hoverIndex)}
                  cy={scaleY(activePoint.p50)}
                  r="4.5"
                  fill="#6366f1"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <circle
                  cx={scaleX(hoverIndex)}
                  cy={scaleY(activePoint.p10)}
                  r="3.5"
                  fill="#818cf8"
                />
                {typeof activePoint.actual === 'number' && (
                  <circle
                    cx={scaleX(hoverIndex)}
                    cy={scaleY(activePoint.actual)}
                    r="4"
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                )}
              </g>
            )}
          </svg>

          {/* Interactive Floating Tooltip Card */}
          {activePoint && hoverIndex !== null && (
            <div
              className="pointer-events-none absolute top-2 rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md text-xs z-20 min-w-[210px]"
              style={{
                left: `${Math.min(
                  80,
                  Math.max(10, (scaleX(hoverIndex) / viewBoxWidth) * 100)
                )}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                <span className="font-semibold text-slate-200">Date: {activePoint.date}</span>
                {activePoint.day && <span className="text-slate-400">Day {activePoint.day}</span>}
              </div>
              <div className="space-y-1.5 font-mono">
                <div className="flex justify-between items-center text-indigo-300">
                  <span className="text-[11px] text-slate-400">P90 (Surge):</span>
                  <span className="font-bold">{activePoint.p90.toFixed(1)} {unitLabel}</span>
                </div>
                <div className="flex justify-between items-center text-indigo-400">
                  <span className="text-[11px] text-slate-300 font-medium">P50 (Median):</span>
                  <span className="font-bold text-slate-100">{activePoint.p50.toFixed(1)} {unitLabel}</span>
                </div>
                <div className="flex justify-between items-center text-indigo-300">
                  <span className="text-[11px] text-slate-400">P10 (Floor):</span>
                  <span className="font-bold">{activePoint.p10.toFixed(1)} {unitLabel}</span>
                </div>
                {typeof activePoint.actual === 'number' && (
                  <div className="flex justify-between items-center text-emerald-400 pt-1 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-300">Actual:</span>
                    <span className="font-bold">{activePoint.actual.toFixed(1)} {unitLabel}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800/80 text-[10px]">
                  <span>Uncertainty Span:</span>
                  <span>{(activePoint.p90 - activePoint.p10).toFixed(1)} {unitLabel}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
