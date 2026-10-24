import React from 'react';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

export type KpiStatus = 'healthy' | 'warning' | 'critical' | 'neutral';
export type DeltaDirection = 'up' | 'down' | 'neutral';

export interface KpiDelta {
  value: string | number;
  direction: DeltaDirection;
  period?: string;
  isPositiveGood?: boolean;
}

export interface KpiCardProps {
  title: string;
  value: string | number;
  subLabel?: string;
  delta?: KpiDelta;
  status?: KpiStatus;
  statusLabel?: string;
  icon?: LucideIcon;
  sparklineData?: number[];
  className?: string;
}

export function KpiCard({
  title,
  value,
  subLabel,
  delta,
  status = 'neutral',
  statusLabel,
  icon: Icon,
  className = '',
}: KpiCardProps) {
  const statusColors = {
    healthy: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    warning: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
    critical: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
    neutral: 'border-slate-800 text-slate-400 bg-slate-800/40',
  };

  const getDeltaStyle = () => {
    if (!delta) return null;
    const isGood =
      delta.isPositiveGood !== undefined
        ? delta.direction === 'up'
          ? delta.isPositiveGood
          : !delta.isPositiveGood
        : delta.direction === 'up';

    if (delta.direction === 'neutral') {
      return {
        textClass: 'text-slate-400 bg-slate-800/60 border-slate-700',
        icon: Minus,
      };
    }

    if (isGood) {
      return {
        textClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
        icon: delta.direction === 'up' ? TrendingUp : TrendingDown,
      };
    }
    return {
      textClass: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
      icon: delta.direction === 'up' ? TrendingUp : TrendingDown,
    };
  };

  const deltaStyle = getDeltaStyle();

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-medium text-slate-400">{title}</span>
          <div className="flex items-center gap-2">
            {statusLabel && (
              <span
                className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${statusColors[status]}`}
              >
                {statusLabel}
              </span>
            )}
            {Icon && <Icon className="h-4 w-4 text-slate-400" />}
          </div>
        </div>

        <div className="text-2xl font-bold font-mono text-slate-100 tracking-tight">
          {value}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        {delta && deltaStyle ? (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-mono font-semibold ${deltaStyle.textClass}`}
            >
              <deltaStyle.icon className="h-3 w-3" />
              {delta.value}
            </span>
            {delta.period && (
              <span className="text-[11px] text-slate-400">{delta.period}</span>
            )}
          </div>
        ) : (
          <div />
        )}

        {subLabel && (
          <span className="text-[11px] text-slate-400 text-right">{subLabel}</span>
        )}
      </div>
    </div>
  );
}
