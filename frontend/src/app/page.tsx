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
  Cpu,
  Layers,
} from 'lucide-react';
import { KpiCard } from '@/components/charts/KpiCard';
import { MacroDemandChart } from '@/components/charts/MacroDemandChart';
import CopilotDrawer from '@/components/copilot/CopilotDrawer';
import { apiClient } from '@/lib/api';
import {
  ForecastOverviewResponse,
  InventoryAlertsResponse,
  CopilotStatusResponse,
} from '@/types/api';

export default function OverviewPage() {
  const [overview, setOverview] = useState<ForecastOverviewResponse | null>(null);
  const [alerts, setAlerts] = useState<InventoryAlertsResponse | null>(null);
  const [copilotStatus, setCopilotStatus] = useState<CopilotStatusResponse | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [activeCopilotContext, setActiveCopilotContext] = useState<Record<string, unknown>>({});

  useEffect(() => {
    async function loadData() {
      const [ovData, alData, cpData] = await Promise.all([
        apiClient.getForecastOverview(),
        apiClient.getInventoryAlerts(),
        apiClient.getCopilotStatus(),
      ]);
      setOverview(ovData);
      setAlerts(alData);
      setCopilotStatus(cpData);
    }
    loadData();
  }, []);

  const totalDemand = overview?.projected_chain_demand_units || 25480;
  const criticalCount = alerts?.alerts.filter((a) => a.urgency === 'CRITICAL').length || 2;
  const totalBreaches = alerts?.alerts_count || 4;

  const openCopilotForSku = (skuId: string, storeId: string, skuName?: string | null) => {
    setActiveCopilotContext({
      sku_id: skuId,
      store_id: storeId,
      sku_name: skuName || 'Retail Item',
    });
    setIsCopilotOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Headline */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Executive Telemetry
            </span>
            <span className="text-xs text-slate-400">Multi-Store Decision Support</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Retail Demand & Prescriptive Inventory Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Air-gapped probabilistic forecast synthesis across 5 regional stores and 15 catalog SKUs. Powered by LightGBM multi-quantile regression and on-device Qwen2.5 intelligence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveCopilotContext({ sku_id: 'SKU-001', store_id: 'STORE-001' });
              setIsCopilotOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Cpu className="w-4 h-4" />
            <span>Open AI Copilot</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Projected 30-Day Demand"
          value={`${totalDemand.toLocaleString()} units`}
          subLabel="Aggregated across 5 store nodes"
          delta={{
            value: '+4.2%',
            direction: 'up',
            period: 'vs prior 30d',
            isPositiveGood: true,
          }}
          status="healthy"
          statusLabel="Growing"
          icon={Activity}
        />

        <KpiCard
          title="Critical Inventory Breaches"
          value={criticalCount}
          subLabel={`${totalBreaches} total SKUs below ROP threshold`}
          delta={{
            value: '+1',
            direction: 'up',
            period: 'vs yesterday',
            isPositiveGood: false,
          }}
          status={criticalCount > 0 ? 'critical' : 'healthy'}
          statusLabel={criticalCount > 0 ? 'Action Needed' : 'Protected'}
          icon={AlertTriangle}
        />

        <KpiCard
          title="Estimated Margin at Risk"
          value="$4,128.00"
          subLabel="Potential stockout loss exposure"
          delta={{
            value: '-8.5%',
            direction: 'down',
            period: 'from peak shock',
            isPositiveGood: true,
          }}
          status="warning"
          statusLabel="Exposure"
          icon={TrendingUp}
        />

        <KpiCard
          title="On-Shelf Service Level"
          value="96.2%"
          subLabel="Target SLA benchmark: 95.0%"
          delta={{
            value: '+1.2%',
            direction: 'up',
            period: 'above target',
            isPositiveGood: true,
          }}
          status="healthy"
          statusLabel="Optimal"
          icon={ShieldCheck}
        />
      </div>

      {/* Macro Demand Forecast Chart */}
      <MacroDemandChart
        data={overview?.daily_aggregate_forecast || []}
        totalProjectedVolume={totalDemand}
        macroTrend={overview?.macro_trend || '+4.2% projected MoM growth'}
      />

      {/* Lower Split: Critical Breaches & Quick Action Jump */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Top Risk SKUs Preview */}
        <div className="lg:col-span-8 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
                <h2 className="font-semibold text-slate-100">Critical Stockout Vulnerabilities</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Items requiring immediate replenishment PO advance or DC rebalancing
              </p>
            </div>
            <Link
              href="/inventory"
              className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            >
              <span>View All Alerts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">SKU & Name</th>
                  <th className="py-2.5 px-3">Store</th>
                  <th className="py-2.5 px-3 text-right">On-Hand</th>
                  <th className="py-2.5 px-3 text-right">ROP</th>
                  <th className="py-2.5 px-3 text-right">Deficit</th>
                  <th className="py-2.5 px-3">Stockout Risk</th>
                  <th className="py-2.5 px-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {alerts?.alerts.slice(0, 4).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-bold text-slate-200">{item.sku_id}</div>
                      <div className="text-[11px] text-slate-400">{item.sku_name}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{item.store_id}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-100">{item.current_stock}</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">{item.reorder_point_units}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-400">
                      -{item.stock_deficit_units}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          item.stockout_risk_pct >= 70
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {item.stockout_risk_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <button
                        onClick={() => openCopilotForSku(item.sku_id, item.store_id, item.sku_name)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-200 border border-slate-700 text-[11px] font-medium transition cursor-pointer"
                      >
                        Copilot Brief
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Quick Links & Model Telemetry */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md">
            <h3 className="font-semibold text-slate-100 text-sm mb-3">Analytical Modules</h3>
            <div className="space-y-2.5 text-xs">
              <Link
                href="/explorer"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 hover:bg-slate-800/60 border border-slate-800/80 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">SKU Deep-Dive Explorer</div>
                    <div className="text-[11px] text-slate-400">Probabilistic bands & TreeSHAP attributions</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </Link>

              <Link
                href="/simulator"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 hover:bg-slate-800/60 border border-slate-800/80 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">What-If Scenario Lab</div>
                    <div className="text-[11px] text-slate-400">Promo discounts & lead-time shocks</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </Link>

              <Link
                href="/inventory"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 hover:bg-slate-800/60 border border-slate-800/80 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">Stockout Risk Heatmap</div>
                    <div className="text-[11px] text-slate-400">Store x Category matrix & policy math</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span>Local Model</span>
              <span className="font-mono text-slate-200">{copilotStatus?.model_name || 'Qwen/Qwen2.5-1.5B'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Compute Hardware</span>
              <span className="font-mono text-emerald-400">CPU (Air-Gapped)</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Cloud Telemetry</span>
              <span className="font-mono text-emerald-400">Zero Egress</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Slide-Out Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        activeContext={activeCopilotContext}
      />
    </div>
  );
}
