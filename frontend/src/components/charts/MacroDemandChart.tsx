'use client';

import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { DailyForecastPoint } from '@/types/api';

export interface MacroDemandChartProps {
  data: DailyForecastPoint[];
  totalProjectedVolume?: number;
  macroTrend?: string;
  title?: string;
  subtitle?: string;
  height?: number;
  className?: string;
}

export function MacroDemandChart({
  data = [],
  totalProjectedVolume,
  macroTrend = '+4.2% projected MoM growth',
  title = 'Chain-Wide Aggregate Demand Curve',
  subtitle = '30-day macro volume projection with trend momentum',
  height = 300,
  className = '',
}: MacroDemandChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const viewBoxWidth = 800;
  const viewBoxHeight = height;
  const padding = { top: 24, right: 32, bottom: 44, left: 60 };
  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const chartHeight = viewBoxHeight - padding.top - padding.bottom;

  const totalUnits = useMemo(() => {
    if (typeof totalProjectedVolume === 'number') return totalProjectedVolume;
    return Math.round(data.reduce((acc, curr) => acc + curr.p50, 0));
  }, [data, totalProjectedVolume]);

  const { minVal, maxVal } = useMemo(() => {
    if (!data.length) return { minVal: 0, maxVal: 1000 };
    let min = Infinity;
    let max = -Infinity;
    data.forEach((d) => {
      if (d.p50 < min) min = d.p50;
      if (d.p50 > max) max = d.p50;
      if (typeof d.actual === 'number') {
        if (d.actual < min) min = d.actual;
        if (d.actual > max) max = d.actual;
      }
    });
    return {
      minVal: Math.max(0, Math.floor(min * 0.85)),
      maxVal: Math.ceil(max * 1.15),
    };
  }, [data]);

  const scaleX = (index: number) => {
    if (data.length <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (data.length - 1)) * chartWidth;
  };

  const scaleY = (val: number) => {
    const range = maxVal - minVal || 1;
    return padding.top + chartHeight - ((val - minVal) / range) * chartHeight;
  };

  const areaPath = useMemo(() => {
    if (data.length < 2) return '';
    let p = `M ${scaleX(0).toFixed(1)},${scaleY(data[0].p50).toFixed(1)}`;
    for (let i = 1; i < data.length; i++) {
      p += ` L ${scaleX(i).toFixed(1)},${scaleY(data[i].p50).toFixed(1)}`;
    }
    const lastX = scaleX(data.length - 1);
    const bottomY = padding.top + chartHeight;
    p += ` L ${lastX.toFixed(1)},${bottomY.toFixed(1)} L ${scaleX(0).toFixed(1)},${bottomY.toFixed(1)} Z`;
    return p;
  }, [data, minVal, maxVal]);

  const linePath = useMemo(() => {
    if (data.length < 2) return '';
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)},${scaleY(d.p50).toFixed(1)}`)
      .join(' ');
  }, [data, minVal, maxVal]);

  const yTicks = useMemo(() => {
    const steps = 4;
    const ticks = [];
    for (let i = 0; i <= steps; i++) {
      ticks.push(Math.round(minVal + ((maxVal - minVal) / steps) * i));
    }
    return ticks;
  }, [minVal, maxVal]);

  const xTickIndices = useMemo(() => {
    if (data.length <= 5) return data.map((_, i) => i);
    const step = Math.floor(data.length / 5);
    return [0, step, step * 2, step * 3, step * 4, data.length - 1];
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
      className={`rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-sky-400" />
            <h3 className="font-semibold text-slate-100">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Total 30-Day Demand</div>
            <div className="text-base font-bold font-mono text-slate-100">
              {totalUnits.toLocaleString()} units
            </div>
          </div>
          {macroTrend && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{macroTrend}</span>
            </div>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-800 text-sm text-slate-500">
          No aggregate macro data loaded
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
              <linearGradient id="macroGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Y Grid */}
            {yTicks.map((val: number) => {
              const y = scaleY(val);
              return (
                <g key={val}>
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
                    {val.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {/* X Ticks */}
            {xTickIndices.map((idx: number) => {
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

            {/* Shaded Area */}
            {areaPath && <path d={areaPath} fill="url(#macroGradient)" />}

            {/* Line Path */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Hover Indicator */}
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
                  cy={scaleY(activePoint.p50)}
                  r="5"
                  fill="#0ea5e9"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>

          {/* Hover Tooltip */}
          {activePoint && hoverIndex !== null && (
            <div
              className="pointer-events-none absolute top-2 rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md text-xs z-20 min-w-[170px]"
              style={{
                left: `${Math.min(
                  80,
                  Math.max(10, (scaleX(hoverIndex) / viewBoxWidth) * 100)
                )}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="font-semibold text-slate-200 border-b border-slate-800 pb-1 mb-1.5">
                {activePoint.date}
              </div>
              <div className="font-mono space-y-1">
                <div className="flex justify-between text-sky-400">
                  <span className="text-slate-400">Demand:</span>
                  <span className="font-bold">{activePoint.p50.toFixed(1)} units</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
