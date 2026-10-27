'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Sliders,
  Bot,
  Layers,
} from 'lucide-react';
import { KpiCard } from '@/components/charts/KpiCard';
import { MacroDemandChart } from '@/components/charts/MacroDemandChart';
import { apiClient } from '@/lib/api';
import { useChatbot } from '@/context/ChatbotContext';
import {
  ForecastOverviewResponse,
  InventoryAlertsResponse,
} from '@/types/api';

export default function OverviewPage() {
  const [overview, setOverview] = useState<ForecastOverviewResponse | null>(null);
  const [alerts, setAlerts] = useState<InventoryAlertsResponse | null>(null);
  const { openChatbot } = useChatbot();

  useEffect(() => {
    async function loadData() {
      const [ovData, alData] = await Promise.all([
        apiClient.getForecastOverview(),
        apiClient.getInventoryAlerts(),
      ]);
      setOverview(ovData);
      setAlerts(alData);
    }
    loadData();
  }, []);

  const totalDemand = overview?.projected_chain_demand_units || 25480;
  const criticalCount = alerts?.alerts.filter((a) => a.urgency === 'CRITICAL').length || 2;
  const totalBreaches = alerts?.alerts_count || 4;

  return (
    <div className="space-y-6">
      {/* Top Banner / Executive Headline */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Executive Telemetry
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Chain-Wide Decision Support</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Retail Demand & Prescriptive Inventory Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Real-time demand forecasting and inventory tracking across 5 regional stores and 15 catalog items.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openChatbot({ sku_id: 'SKU-001', store_id: 'STORE-001' })}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>DemandSync Chatbot</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Projected 30D Demand"
          value={`${totalDemand.toLocaleString()} units`}
          subLabel="5 regional store nodes"
          delta={{
            value: '+4.2%',
            direction: 'up',
            period: 'vs prior 30d',
            isPositiveGood: true,
          }}
          status="healthy"
          statusLabel="Growing"
        />

        <KpiCard
          title="Critical Stockout Risks"
          value={`${criticalCount} items`}
          subLabel="Action required today"
          delta={{
            value: '-1 SKU',
            direction: 'down',
            period: 'vs yesterday',
            isPositiveGood: true,
          }}
          status={criticalCount > 0 ? 'critical' : 'healthy'}
          statusLabel={criticalCount > 0 ? 'Immediate Action' : 'Optimal'}
        />

        <KpiCard
          title="Total Reorder Breaches"
          value={`${totalBreaches} SKUs`}
          subLabel="Below reorder threshold"
          status="warning"
          statusLabel="Replenish"
        />

        <KpiCard
          title="Network Service Level"
          value="96.4%"
          subLabel="Target: 95.0%"
          delta={{
            value: '+1.4%',
            direction: 'up',
            period: 'vs SLA target',
            isPositiveGood: true,
          }}
          status="healthy"
          statusLabel="Target Met"
        />
      </div>

      {/* Main Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 14-Day Demand Trend Chart */}
        <div className="lg:col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>Aggregated Demand Trajectory</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Projected sales volume with expected, minimum, and peak surge estimates.
              </p>
            </div>
            <Link
              href="/explorer"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition"
            >
              <span>Explore SKUs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-[300px]">
            <MacroDemandChart
              data={overview?.daily_aggregate_forecast || []}
              totalProjectedVolume={totalDemand}
              macroTrend={overview?.macro_trend}
            />
          </div>
        </div>

        {/* Right Column: Quick Links & Priority Actions */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider mb-3">
              Analytical Modules
            </h3>
            <div className="space-y-2 text-xs">
              <Link
                href="/explorer"
                className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">SKU Forecast Explorer</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Demand drivers & forecast curves</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                href="/performance"
                className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">Model Backtest & Accuracy</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Forecast error & service level metrics</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                href="/simulator"
                className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">What-If Scenario Lab</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Discounts & lead-time shocks</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                href="/inventory"
                className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">Stockout Risk Heatmap</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Store × Category risk matrix</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Stockout Alerts Table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Priority Inventory Interventions</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Items below minimum stock levels requiring urgent inventory replenishment.
            </p>
          </div>
          <Link
            href="/inventory"
            className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition"
          >
            <span>View All ({alerts?.alerts_count || 0})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Store</th>
                <th className="py-2.5 px-3 text-right">On-Hand Stock</th>
                <th className="py-2.5 px-3 text-right">Minimum Level</th>
                <th className="py-2.5 px-3 text-right">Stockout Risk</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
              {(alerts?.alerts || []).slice(0, 4).map((item) => (
                <tr key={`${item.sku_id}-${item.store_id}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                    {item.sku_name || item.sku_id}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                    {item.store_id}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium">
                    {item.current_stock.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500">
                    {(item.reorder_point_units ?? item.reorder_point ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                        item.stockout_risk_pct >= 70
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50'
                          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50'
                      }`}
                    >
                      {item.stockout_risk_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-sans">
                    <button
                      onClick={() => openChatbot({ sku_id: item.sku_id, store_id: item.store_id, sku_name: item.sku_name })}
                      className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-medium transition cursor-pointer"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
