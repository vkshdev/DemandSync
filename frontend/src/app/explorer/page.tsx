'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  Store,
  Tag,
  DollarSign,
  Clock,
  Package,
  Sliders,
  Cpu,
} from 'lucide-react';
import { QuantileBandChart } from '@/components/charts/QuantileBandChart';
import { ShapWaterfallChart } from '@/components/charts/ShapWaterfallChart';
import CopilotDrawer from '@/components/copilot/CopilotDrawer';
import { apiClient } from '@/lib/api';
import { SKUS, STORES, getSkuById, getStoreById } from '@/lib/catalog';
import { SKUForecastResponse } from '@/types/api';

export default function ExplorerPage() {
  const [selectedSkuId, setSelectedSkuId] = useState<string>('SKU-001');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('STORE-001');
  const [forecastData, setForecastData] = useState<SKUForecastResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

  const selectedSku = getSkuById(selectedSkuId);
  const selectedStore = getStoreById(selectedStoreId);

  useEffect(() => {
    async function loadForecast() {
      setIsLoading(true);
      try {
        const data = await apiClient.getSKUForecast(selectedSkuId, selectedStoreId);
        setForecastData(data);
      } finally {
        setIsLoading(false);
      }
    }
    loadForecast();
  }, [selectedSkuId, selectedStoreId]);

  const unitMargin = selectedSku.base_price - selectedSku.unit_cost;
  const marginPct = ((unitMargin / selectedSku.base_price) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header & Selectors Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Granular Explorer
            </span>
            <span className="text-xs text-slate-400">Probabilistic Time-Series & TreeSHAP</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            SKU & Store Probabilistic Forecasting
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluate LightGBM quantile regression bands (P10, P50, P90) and TreeSHAP explainability drivers.
          </p>
        </div>

        {/* Dual Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Select SKU</label>
            <select
              value={selectedSkuId}
              onChange={(e) => setSelectedSkuId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {SKUS.map((item) => (
                <option key={item.sku_id} value={item.sku_id}>
                  {item.sku_id} - {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Select Store</label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {STORES.map((st) => (
                <option key={st.store_id} value={st.store_id}>
                  {st.store_id} ({st.name})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end pt-5">
            <button
              onClick={() => setIsCopilotOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Ask Copilot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Product Summary Profile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <Tag className="w-3 h-3 text-indigo-400" />
            Department / Category
          </div>
          <div className="text-xs font-bold text-slate-100 mt-1">
            {selectedSku.department} / {selectedSku.category}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-400" />
            Retail Price
          </div>
          <div className="text-sm font-bold font-mono text-emerald-400 mt-1">
            ${selectedSku.base_price.toFixed(2)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-slate-400" />
            Unit Cost
          </div>
          <div className="text-sm font-bold font-mono text-slate-200 mt-1">
            ${selectedSku.unit_cost.toFixed(2)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-indigo-400" />
            Unit Margin
          </div>
          <div className="text-sm font-bold font-mono text-indigo-400 mt-1">
            ${unitMargin.toFixed(2)} ({marginPct}%)
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            Lead Time
          </div>
          <div className="text-sm font-bold font-mono text-slate-200 mt-1">
            {selectedSku.lead_time_days} days
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <Package className="w-3 h-3 text-amber-400" />
            Minimum Order Qty
          </div>
          <div className="text-sm font-bold font-mono text-slate-200 mt-1">
            {selectedSku.min_order_qty} units
          </div>
        </div>
      </div>

      {/* Quantile Band Chart */}
      <QuantileBandChart
        data={forecastData?.time_series || []}
        title={`30-Day Probabilistic Demand Forecast: ${selectedSku.name}`}
        subtitle={`Location: ${selectedStore.name} (${selectedStore.store_id}) | Quantile envelope P10-P90 with median projection P50`}
        height={340}
      />

      {/* TreeSHAP Attributions & Scenario Jump */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <ShapWaterfallChart
            drivers={forecastData?.shap_drivers || []}
            title={`TreeSHAP Drivers for ${selectedSku.sku_id}`}
            subtitle="Feature contributions explaining demand deviation from historical unconditional average"
          />
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-100 text-sm">Simulate Elasticity</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Test how promotional markdowns, regional temperature anomalies, and supplier shipping shocks impact {selectedSku.name} at {selectedStore.name}.
            </p>
          </div>

          <div className="pt-6 space-y-3">
            <Link
              href={`/simulator?sku_id=${selectedSku.sku_id}&store_id=${selectedStore.store_id}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Launch in Scenario Lab</span>
            </Link>

            <button
              onClick={() => setIsCopilotOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>Generate Executive Briefing</span>
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Daily Breakdown Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          Daily Forecast Quantile Breakdown Table
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2 px-3">Horizon Day</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3 text-right">P10 (Floor)</th>
                <th className="py-2 px-3 text-right">P50 (Median)</th>
                <th className="py-2 px-3 text-right">P90 (Surge)</th>
                <th className="py-2 px-3 text-right">Delta Span</th>
                <th className="py-2 px-3 text-right">Historical Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {forecastData?.time_series.slice(0, 14).map((pt, i) => (
                <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-2 px-3 text-slate-400">Day {pt.day || i + 1}</td>
                  <td className="py-2 px-3 text-slate-300 font-sans">{pt.date}</td>
                  <td className="py-2 px-3 text-right text-indigo-300">{pt.p10.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-100">{pt.p50.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right text-indigo-300">{pt.p90.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right text-slate-400">
                    {(pt.p90 - pt.p10).toFixed(1)}
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-400">
                    {typeof pt.actual === 'number' ? pt.actual.toFixed(1) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Slide-Out Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        activeContext={{
          sku_id: selectedSku.sku_id,
          sku_name: selectedSku.name,
          store_id: selectedStore.store_id,
          unit_margin_usd: unitMargin,
        }}
      />
    </div>
  );
}
