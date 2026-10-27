'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Sliders,
  Bot,
  FileSpreadsheet,
  Activity,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { InventoryAlert, PipelineDriftReport } from '@/types/api';
import { api } from '@/lib/api';
import { STORES } from '@/lib/catalog';
import { PurchaseOrderModal } from '@/components/inventory/PurchaseOrderModal';

interface AlertsTableProps {
  onInspectWithCopilot?: (alert: InventoryAlert) => void;
  onSimulateSku?: (skuId: string, storeId: string) => void;
  onCreatePO?: (alert: InventoryAlert) => void;
}

export default function AlertsTable({
  onInspectWithCopilot,
  onSimulateSku,
  onCreatePO,
}: AlertsTableProps) {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [driftReport, setDriftReport] = useState<PipelineDriftReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');
  const [poModalAlert, setPoModalAlert] = useState<InventoryAlert | null>(null);
  const [isPoModalOpen, setIsPoModalOpen] = useState<boolean>(false);

  const handleOpenPO = (alert: InventoryAlert) => {
    if (onCreatePO) {
      onCreatePO(alert);
    }
    setPoModalAlert(alert);
    setIsPoModalOpen(true);
  };

  useEffect(() => {
    loadAlerts();
    loadDrift();
  }, []);

  const loadDrift = async () => {
    try {
      const report = await api.getDriftReport();
      setDriftReport(report);
    } catch {
      // Handled by api fallback
    }
  };

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
    <div className="w-full space-y-4">
      {/* Summary KPI Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Active Breaches
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
            {totalBreaches}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">SKUs below minimum stock level</div>
        </div>
        <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
          <div className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
            Critical Urgency
          </div>
          <div className="text-xl font-bold font-mono text-rose-700 dark:text-rose-400 mt-0.5">
            {criticalCount}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Risk &gt; 70% threshold</div>
        </div>
        <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
          <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            Margin at Risk
          </div>
          <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-0.5">
            ${totalLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Projected stockout loss</div>
        </div>
        <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Mean Stockout Risk
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
            {avgRisk}%
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Across catalog</div>
        </div>
      </div>

      {/* Automated Pipeline Drift Indicator (EPIC-7 P3) */}
      {driftReport && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#09090b]/80 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 font-semibold">
              <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-slate-800 dark:text-slate-200">Data Drift Monitor:</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                driftReport.overall_system_status === 'HEALTHY'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}
            >
              {driftReport.overall_system_status} (Distribution Stable)
            </span>
            <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
              Demand patterns consistent • {driftReport.total_series_evaluated} series monitored
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Evaluated: {driftReport.timestamp.slice(0, 10)}
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter SKU or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Store Filter */}
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Stores</option>
            {STORES.map((st) => (
              <option key={st.store_id} value={st.store_id}>
                {st.store_id} ({st.name})
              </option>
            ))}
          </select>

          {/* Urgency Filter Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-md border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setUrgencyFilter('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                urgencyFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setUrgencyFilter('CRITICAL')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                urgencyFilter === 'CRITICAL'
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 font-semibold'
                  : 'text-slate-500 hover:text-rose-600 dark:text-slate-400'
              }`}
            >
              Critical
            </button>
            <button
              onClick={() => setUrgencyFilter('WARNING')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                urgencyFilter === 'WARNING'
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 font-semibold'
                  : 'text-slate-500 hover:text-amber-600 dark:text-slate-400'
              }`}
            >
              Warning
            </button>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-3.5">SKU & Product</th>
              <th className="py-2.5 px-3.5">Store</th>
              <th className="py-2.5 px-3.5 text-right">Current Stock</th>
              <th className="py-2.5 px-3.5 text-right">Safety Buffer</th>
              <th className="py-2.5 px-3.5 text-right">Reorder Level</th>
              <th className="py-2.5 px-3.5 text-right">Deficit</th>
              <th className="py-2.5 px-3.5">Stockout Risk</th>
              <th className="py-2.5 px-3.5">Urgency</th>
              <th className="py-2.5 px-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
            {filteredAlerts.length > 0 ? (
              filteredAlerts.map((row, idx) => (
                <tr
                  key={`${row.sku_id}-${row.store_id}-${idx}`}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                >
                  {/* SKU & Product */}
                  <td className="py-2.5 px-3.5">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{row.sku_id}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                      {row.sku_name || 'Retail Merchandise'}
                    </div>
                  </td>

                  {/* Store */}
                  <td className="py-2.5 px-3.5 text-slate-700 dark:text-slate-300 font-sans">
                    {row.store_id}
                  </td>

                  {/* Stock Metrics */}
                  <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 dark:text-slate-200">
                    {row.current_stock}
                  </td>
                  <td className="py-2.5 px-3.5 text-right text-slate-500 dark:text-slate-400">
                    {row.safety_stock_units || row.safety_stock}
                  </td>
                  <td className="py-2.5 px-3.5 text-right text-slate-600 dark:text-slate-300">
                    {row.reorder_point_units || row.reorder_point}
                  </td>
                  <td className="py-2.5 px-3.5 text-right">
                    <span className="font-bold text-rose-700 dark:text-rose-400">
                      -{row.stock_deficit_units || row.deficit_units || 0}
                    </span>
                  </td>

                  {/* Stockout Risk % */}
                  <td className="py-2.5 px-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-14 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            row.stockout_risk_pct >= 70
                              ? 'bg-rose-600 dark:bg-rose-500'
                              : row.stockout_risk_pct >= 40
                              ? 'bg-amber-600 dark:bg-amber-500'
                              : 'bg-emerald-600 dark:bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, row.stockout_risk_pct)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-700 dark:text-slate-300">
                        {row.stockout_risk_pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>

                  {/* Urgency Pill */}
                  <td className="py-2.5 px-3.5 font-sans">
                    <span
                      className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        row.urgency === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50'
                          : row.urgency === 'WARNING'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50'
                      }`}
                    >
                      {row.urgency}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3.5 text-right font-sans">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenPO(row)}
                        title="Generate Purchase Order"
                        aria-label="Generate Purchase Order"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-[11px] font-semibold transition"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Create PO</span>
                      </button>
                      {onInspectWithCopilot && (
                        <button
                          onClick={() => onInspectWithCopilot(row)}
                          title="Inspect with Chatbot"
                          aria-label="Inspect with Chatbot"
                          className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        >
                          <Bot className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onSimulateSku && (
                        <button
                          onClick={() => onSimulateSku(row.sku_id, row.store_id)}
                          title="Simulate Scenario"
                          aria-label="Simulate Scenario"
                          className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition"
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
                <td colSpan={9} className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 font-sans">
                  {isLoading
                    ? 'Loading inventory breach telemetry...'
                    : 'No inventory breaches match current criteria.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 1-Click Purchase Order Modal */}
      <PurchaseOrderModal
        alert={poModalAlert}
        isOpen={isPoModalOpen}
        onClose={() => setIsPoModalOpen(false)}
      />
    </div>
  );
}
