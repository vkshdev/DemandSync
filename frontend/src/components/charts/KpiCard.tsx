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
    healthy:
      'border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    warning:
      'border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
    critical:
      'border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
    neutral:
      'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40',
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
        textClass:
          'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        icon: Minus,
      };
    }

    if (isGood) {
      return {
        textClass:
          'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50',
        icon: delta.direction === 'up' ? TrendingUp : TrendingDown,
      };
    }
    return {
      textClass:
        'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50',
      icon: delta.direction === 'up' ? TrendingUp : TrendingDown,
    };
  };

  const deltaStyle = getDeltaStyle();

  return (
    <div
      className={`rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-medium text-slate-500 dark:text-slate-400 tracking-wide">
            {title}
          </span>
          <div className="flex items-center gap-1.5">
            {statusLabel && (
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusColors[status]}`}
              >
                {statusLabel}
              </span>
            )}
            {Icon && <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />}
          </div>
        </div>

        <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tracking-tight">
          {value}
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2 text-xs">
        {delta && deltaStyle ? (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-mono font-medium ${deltaStyle.textClass}`}
            >
              <deltaStyle.icon className="h-3 w-3" />
              {delta.value}
            </span>
            {delta.period && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {delta.period}
              </span>
            )}
          </div>
        ) : (
          <div />
        )}

        {subLabel && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 text-right truncate">
            {subLabel}
          </span>
        )}
      </div>
    </div>
  );
}
