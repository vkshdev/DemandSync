'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Sliders,
  Bot,
} from 'lucide-react';
import { InventoryAlert } from '@/types/api';
import { api } from '@/lib/api';
import { STORES } from '@/lib/catalog';

interface AlertsTableProps {
  onInspectWithCopilot?: (alert: InventoryAlert) => void;
  onSimulateSku?: (skuId: string, storeId: string) => void;
}

export default function AlertsTable({
  onInspectWithCopilot,
  onSimulateSku,
}: AlertsTableProps) {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await api.getInventoryAlerts();
      setAlerts(data.alerts);
    } catch {
      setAlerts([
        {
          sku_id: 'SKU-001',
          sku_name: 'Winter Thermal Parka',
          store_id: 'STORE-001',
          current_stock: 42,
          safety_stock_units: 50,
          reorder_point_units: 78,
          stockout_risk_pct: 84.5,
          stock_deficit_units: 36,
          urgency: 'CRITICAL',
          projected_stockout_loss_usd: 2340.0,
        },
        {
          sku_id: 'SKU-009',
          sku_name: 'ANC Wireless Headphones',
          store_id: 'STORE-002',
          current_stock: 12,
          safety_stock_units: 15,
          reorder_point_units: 24,
          stockout_risk_pct: 71.2,
          stock_deficit_units: 12,
          urgency: 'CRITICAL',
          projected_stockout_loss_usd: 1788.0,
        },
        {
          sku_id: 'SKU-004',
          sku_name: 'Organic Whole Milk 1 Gal',
          store_id: 'STORE-003',
          current_stock: 58,
          safety_stock_units: 60,
          reorder_point_units: 95,
          stockout_risk_pct: 46.8,
          stock_deficit_units: 37,
          urgency: 'WARNING',
          projected_stockout_loss_usd: 177.6,
        },
        {
          sku_id: 'SKU-014',
          sku_name: 'Ceramic Space Heater',
          store_id: 'STORE-004',
          current_stock: 19,
          safety_stock_units: 20,
          reorder_point_units: 32,
          stockout_risk_pct: 42.0,
          stock_deficit_units: 13,
          urgency: 'WARNING',
          projected_stockout_loss_usd: 585.0,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAlerts = alerts.filter((item) => {
    const matchesSearch =
      item.sku_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku_name && item.sku_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStore = storeFilter === 'ALL' || item.store_id === storeFilter;
    const matchesUrgency = urgencyFilter === 'ALL' || item.urgency === urgencyFilter;
    return matchesSearch && matchesStore && matchesUrgency;
  });

  const totalBreaches = alerts.length;
  const criticalCount = alerts.filter((a) => a.urgency === 'CRITICAL').length;
  const totalLoss = alerts.reduce((acc, a) => acc + (a.projected_stockout_loss_usd || 0), 0);
  const avgRisk =
    alerts.length > 0
      ? (alerts.reduce((acc, a) => acc + a.stockout_risk_pct, 0) / alerts.length).toFixed(1)
      : '0.0';

  return (
    <div className="w-full space-y-6">
      {/* Summary KPI Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Breaches</div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-1">{totalBreaches}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">SKUs below Reorder Point</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Critical Urgency</div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{criticalCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Risk &gt; 70% threshold</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Margin at Risk</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            ${totalLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Projected stockout loss</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mean Stockout Risk</div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-1">{avgRisk}%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Across breached catalog</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by SKU ID or product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Store Filter */}
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Stores</option>
            {STORES.map((st) => (
              <option key={st.store_id} value={st.store_id}>
                {st.store_id} ({st.name})
              </option>
            ))}
          </select>

          {/* Urgency Filter Tabs */}
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setUrgencyFilter('ALL')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                urgencyFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setUrgencyFilter('CRITICAL')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                urgencyFilter === 'CRITICAL' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Critical
            </button>
            <button
              onClick={() => setUrgencyFilter('WARNING')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                urgencyFilter === 'WARNING' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Warning
            </button>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">SKU & Item</th>
              <th className="py-3 px-4">Store</th>
              <th className="py-3 px-4 text-right">Current Stock</th>
              <th className="py-3 px-4 text-right">Safety Stock</th>
              <th className="py-3 px-4 text-right">ROP</th>
              <th className="py-3 px-4 text-right">Deficit</th>
              <th className="py-3 px-4">Stockout Risk</th>
              <th className="py-3 px-4">Urgency</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredAlerts.length > 0 ? (
              filteredAlerts.map((row, idx) => (
                <tr key={`${row.sku_id}-${row.store_id}-${idx}`} className="hover:bg-slate-800/40 transition">
                  {/* SKU & Product */}
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-100">{row.sku_id}</div>
                    <div className="text-[11px] text-slate-400 font-sans">{row.sku_name || 'Retail Merchandise'}</div>
                  </td>

                  {/* Store */}
                  <td className="py-3 px-4 text-slate-300 font-sans">{row.store_id}</td>

                  {/* Stock Metrics */}
                  <td className="py-3 px-4 text-right font-bold text-slate-200">{row.current_stock}</td>
                  <td className="py-3 px-4 text-right text-slate-400">{row.safety_stock_units || row.safety_stock}</td>
                  <td className="py-3 px-4 text-right text-slate-300">{row.reorder_point_units || row.reorder_point}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-bold text-rose-400">
                      -{row.stock_deficit_units || row.deficit_units || 0}
                    </span>
                  </td>

                  {/* Stockout Risk % */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            row.stockout_risk_pct >= 70
                              ? 'bg-rose-500'
                              : row.stockout_risk_pct >= 40
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, row.stockout_risk_pct)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-300">{row.stockout_risk_pct.toFixed(1)}%</span>
                    </div>
                  </td>

                  {/* Urgency Pill */}
                  <td className="py-3 px-4 font-sans">
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        row.urgency === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : row.urgency === 'WARNING'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {row.urgency}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right font-sans">
                    <div className="flex items-center justify-end gap-2">
                      {onInspectWithCopilot && (
                        <button
                          onClick={() => onInspectWithCopilot(row)}
                          title="Inspect in Copilot"
                          className="p-1.5 bg-slate-800 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-200 rounded-lg border border-slate-700 transition"
                        >
                          <Bot className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onSimulateSku && (
                        <button
                          onClick={() => onSimulateSku(row.sku_id, row.store_id)}
                          title="Simulate Scenario"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="py-8 text-center text-xs text-slate-500 font-sans">
                  {isLoading
                    ? 'Loading inventory breach telemetry...'
                    : 'No inventory breaches match current criteria.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
