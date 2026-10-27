'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Tag,
  DollarSign,
  Clock,
  Package,
  Sliders,
  Bot,
} from 'lucide-react';
import { QuantileBandChart } from '@/components/charts/QuantileBandChart';
import { ShapWaterfallChart } from '@/components/charts/ShapWaterfallChart';
import { apiClient } from '@/lib/api';
import { useChatbot } from '@/context/ChatbotContext';
import { SKUS, STORES, getSkuById, getStoreById } from '@/lib/catalog';
import { SKUForecastResponse } from '@/types/api';

export default function ExplorerPage() {
  const [selectedSkuId, setSelectedSkuId] = useState<string>('SKU-001');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('STORE-001');
  const [forecastData, setForecastData] = useState<SKUForecastResponse | null>(null);
  const [, setIsLoading] = useState<boolean>(true);
  const { openChatbot } = useChatbot();

  const selectedSku = getSkuById(selectedSkuId);
  const selectedStore = getStoreById(selectedStoreId);

  useEffect(() => {
    async function fetchForecast() {
      setIsLoading(true);
      try {
        const data = await apiClient.getSkuForecast(selectedSkuId, selectedStoreId);
        setForecastData(data);
      } catch (e) {
        console.error('Failed to load forecast data', e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchForecast();
  }, [selectedSkuId, selectedStoreId]);

  const unitMargin = selectedSku.base_price - selectedSku.unit_cost;
  const marginPct = ((unitMargin / selectedSku.base_price) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header & Target Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              SKU Level Telemetry
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Multi-Store Forecast Analysis</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {selectedSku.name} ({selectedSku.sku_id})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Detailed probabilistic demand distributions, price elasticity curves, and feature attribution breakdowns.
          </p>
        </div>

        {/* Global Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1 tracking-wider">
              Select SKU
            </label>
            <select
              value={selectedSkuId}
              onChange={(e) => setSelectedSkuId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              {SKUS.map((s) => (
                <option key={s.sku_id} value={s.sku_id}>
                  {s.sku_id} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1 tracking-wider">
              Select Store
            </label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              {STORES.map((st) => (
                <option key={st.store_id} value={st.store_id}>
                  {st.store_id} ({st.name})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end pt-4">
            <button
              onClick={() =>
                openChatbot({
                  sku_id: selectedSku.sku_id,
                  sku_name: selectedSku.name,
                  store_id: selectedStore.store_id,
                  unit_margin_usd: unitMargin,
                })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Ask Chatbot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Product Summary Profile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold flex items-center gap-1 tracking-wider">
            <Tag className="w-3 h-3 text-slate-400" />
            Category
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
            {selectedSku.department} / {selectedSku.category}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold flex items-center gap-1 tracking-wider">
            <DollarSign className="w-3 h-3 text-slate-400" />
            Retail Price
          </div>
          <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            ${selectedSku.base_price.toFixed(2)}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold flex items-center gap-1 tracking-wider">
            <DollarSign className="w-3 h-3 text-slate-400" />
            Unit Cost
          </div>
          <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            ${selectedSku.unit_cost.toFixed(2)}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold flex items-center gap-1 tracking-wider">
            <DollarSign className="w-3 h-3 text-slate-400" />
            Unit Margin
          </div>
          <div className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
            ${unitMargin.toFixed(2)} ({marginPct}%)
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold flex items-center gap-1 tracking-wider">
            <Clock className="w-3 h-3 text-slate-400" />
            Lead Time
          </div>
          <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {selectedSku.lead_time_days} days
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold flex items-center gap-1 tracking-wider">
            <Package className="w-3 h-3 text-slate-400" />
            Min Order Qty
          </div>
          <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {selectedSku.min_order_qty} units
          </div>
        </div>
      </div>

      {/* Forecast Band Chart */}
      <QuantileBandChart
        data={forecastData?.time_series || []}
        title={`30-Day Demand Forecast: ${selectedSku.name}`}
        subtitle={`Location: ${selectedStore.name} (${selectedStore.store_id}) | Projected daily sales range with expected baseline`}
        height={300}
      />

      {/* Demand Drivers & Scenario Jump */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8">
          <ShapWaterfallChart
            drivers={forecastData?.shap_drivers || []}
            title={`Key Demand Drivers: ${selectedSku.name}`}
            subtitle="Top factors influencing expected customer demand and sales volume"
          />
        </div>

        <div className="lg:col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sliders className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">
                Simulate Elasticity
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Test how promotional markdowns, regional temperature anomalies, and supplier shipping shocks impact {selectedSku.name} at {selectedStore.name}.
            </p>
          </div>

          <div className="pt-4 space-y-2">
            <Link
              href={`/simulator?sku_id=${selectedSku.sku_id}&store_id=${selectedStore.store_id}`}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-md text-xs font-semibold shadow-xs transition"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Launch in Scenario Lab</span>
            </Link>

            <button
              onClick={() =>
                openChatbot({
                  sku_id: selectedSku.sku_id,
                  sku_name: selectedSku.name,
                  store_id: selectedStore.store_id,
                  unit_margin_usd: unitMargin,
                })
              }
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-800 transition cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-slate-500" />
              <span>Ask Chatbot for Recommendation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Daily Breakdown Table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-5 shadow-sm">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Daily Sales Forecast Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Horizon Day</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Low Estimate</th>
                <th className="py-2.5 px-3 text-right">Expected Sales</th>
                <th className="py-2.5 px-3 text-right">Peak Surge</th>
                <th className="py-2.5 px-3 text-right">Forecast Range</th>
                <th className="py-2.5 px-3 text-right">Actual Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {forecastData?.time_series.slice(0, 14).map((pt, i) => (
                <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 px-3 text-slate-500 dark:text-slate-400">Day {pt.day || i + 1}</td>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300 font-sans">{pt.date}</td>
                  <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">{pt.p10.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{pt.p50.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">{pt.p90.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right text-slate-400 dark:text-slate-500">
                    {(pt.p90 - pt.p10).toFixed(1)}
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-400 font-semibold">
                    {typeof pt.actual === 'number' ? pt.actual.toFixed(1) : '-'}
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
