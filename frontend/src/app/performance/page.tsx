'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { SKUS, STORES } from '@/lib/catalog';
import { BacktestResponse } from '@/types/api';
import { BacktestComparisonChart } from '@/components/charts/BacktestComparisonChart';
import { TrendingUp, AlertTriangle, CheckCircle, BarChart3, RefreshCw, Info } from 'lucide-react';

export default function PerformancePage() {
  const [selectedSku, setSelectedSku] = useState<string>('SKU-001');
  const [selectedStore, setSelectedStore] = useState<string>('STORE-001');
  const [loading, setLoading] = useState<boolean>(true);
  const [backtestData, setBacktestData] = useState<BacktestResponse | null>(null);

  const fetchBacktest = async (sku: string, store: string) => {
    setLoading(true);
    try {
      const res = await api.getBacktest(sku, store);
      setBacktestData(res);
    } catch (err) {
      console.error('Failed to load backtest data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBacktest(selectedSku, selectedStore);
  }, [selectedSku, selectedStore]);

  const metrics = backtestData?.metrics;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Model Performance & Backtesting
            </h1>
            <span className="rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Continuous Evaluation
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Rigorous out-of-sample backtesting evaluating historical forecast precision across 30-day fulfillment windows.
          </p>
        </div>

        {/* Store & SKU Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="store-select" className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Store:
            </label>
            <select
              id="store-select"
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none"
            >
              {STORES.map((s) => (
                <option key={s.store_id} value={s.store_id}>
                  {s.store_id} ({s.name})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="sku-select" className="text-xs font-medium text-slate-500 dark:text-slate-400">
              SKU:
            </label>
            <select
              id="sku-select"
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none max-w-[200px]"
            >
              {SKUS.map((k) => (
                <option key={k.sku_id} value={k.sku_id}>
                  {k.sku_id} - {k.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchBacktest(selectedSku, selectedStore)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            title="Re-run Backtest"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Evaluate</span>
          </button>
        </div>
      </div>

      {/* Metric Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. WAPE Scorecard */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">WAPE</span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">Error Rate</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
              {metrics ? `${metrics.wape_pct.toFixed(1)}%` : '--'}
            </span>
            {metrics && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  metrics.wape_pct < 12.0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                    : metrics.wape_pct < 20.0
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                }`}
              >
                {metrics.wape_pct < 12.0 ? 'Top Tier' : metrics.wape_pct < 20.0 ? 'Acceptable' : 'High Variance'}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Volume-weighted absolute error. Industry benchmark target is &lt;15%.
          </p>
        </div>

        {/* 2. Tracking Signal (Forecast Bias) */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Tracking Bias</span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">Directional Skew</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tracking-tight ${
                !metrics
                  ? 'text-slate-900 dark:text-slate-100'
                  : metrics.bias_pct > 10.0
                  ? 'text-amber-600 dark:text-amber-400'
                  : metrics.bias_pct < -10.0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {metrics ? `${metrics.bias_pct > 0 ? '+' : ''}${metrics.bias_pct.toFixed(1)}%` : '--'}
            </span>
            {metrics && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  metrics.tracking_signal_status === 'OPTIMAL'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
                }`}
              >
                {metrics.tracking_signal_status}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {metrics?.bias_pct && metrics.bias_pct > 10.0
              ? 'Warning: Systemic over-forecasting creates overstock risk.'
              : metrics?.bias_pct && metrics.bias_pct < -10.0
              ? 'Warning: Systemic under-forecasting creates stockout risk.'
              : 'Unbiased calibration: no persistent over/under drift.'}
          </p>
        </div>

        {/* 3. MASE Benchmark */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">MASE Benchmark</span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">Vs. Baseline</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
              {metrics ? metrics.mase.toFixed(2) : '--'}
            </span>
            {metrics && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  metrics.mase < 1.0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                }`}
              >
                {metrics.mase < 1.0 ? `${Math.round((1 - metrics.mase) * 100)}% > Baseline` : 'Below Naive'}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Mean Absolute Scaled Error relative to naive 1-day persistence baseline.
          </p>
        </div>

        {/* 4. Quantile Pinball Calibration */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Quantile Accuracy</span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">Low / Mid / High</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
            <span className="text-slate-400 dark:text-slate-500 text-xs">Low:</span>
            <span>{metrics ? metrics.pinball_loss_p10.toFixed(2) : '--'}</span>
            <span className="text-slate-400 dark:text-slate-500 text-xs ml-1">Expected:</span>
            <span>{metrics ? metrics.pinball_loss_p50.toFixed(2) : '--'}</span>
            <span className="text-slate-400 dark:text-slate-500 text-xs ml-1">Peak:</span>
            <span>{metrics ? metrics.pinball_loss_p90.toFixed(2) : '--'}</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Asymmetric quantile loss out-of-sample over {metrics?.test_days ?? 30} days.
          </p>
        </div>
      </div>

      {/* Main Dual-Line Comparison Chart */}
      <BacktestComparisonChart
        data={backtestData?.time_series || []}
        cutoffDate={backtestData?.cutoff_date}
      />

      {/* Detailed Out-of-Sample Evaluation Table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50/70 dark:bg-slate-900/60">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Chronological Out-of-Sample Log (Last 30 Days)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Trained strictly on records prior to cutoff date: {backtestData?.cutoff_date || 'N/A'}.
            </p>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {backtestData?.time_series.length || 0} evaluation records
          </div>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Horizon</th>
                <th className="px-4 py-2 font-medium text-right">Actual Sales</th>
                <th className="px-4 py-2 font-medium text-right">Expected Sales</th>
                <th className="px-4 py-2 font-medium text-right">Expected Range</th>
                <th className="px-4 py-2 font-medium text-right">Forecast Error</th>
                <th className="px-4 py-2 font-medium text-right">Abs Error</th>
                <th className="px-4 py-2 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
              {backtestData?.time_series.map((pt) => {
                const withinBand = pt.actual >= pt.p10 && pt.actual <= pt.p90;
                return (
                  <tr key={pt.date} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2 font-semibold text-slate-900 dark:text-slate-100">{pt.date}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">Day {pt.day}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {pt.actual.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                      {pt.p50.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400">
                      [{pt.p10.toFixed(1)} - {pt.p90.toFixed(1)}]
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-semibold ${
                        pt.error > 0 ? 'text-amber-500' : pt.error < 0 ? 'text-rose-500' : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {pt.error > 0 ? `+${pt.error.toFixed(1)}` : pt.error.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-800 dark:text-slate-200">
                      {pt.abs_error.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          withinBand
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
                        }`}
                      >
                        {withinBand ? 'In Envelope' : 'Out of Band'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
