'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calculator,
} from 'lucide-react';
import { StockoutHeatmap } from '@/components/charts/StockoutHeatmap';
import AlertsTable from '@/components/inventory/AlertsTable';
import { apiClient } from '@/lib/api';
import { useChatbot } from '@/context/ChatbotContext';
import { CalculatePolicyRequest, CalculatePolicyResponse, InventoryAlert } from '@/types/api';

export default function InventoryPage() {
  const router = useRouter();
  const { openChatbot } = useChatbot();

  // Policy calculator state
  const [targetSla, setTargetSla] = useState<number>(0.95);
  const [demandMean, setDemandMean] = useState<number>(18.0);
  const [demandStd, setDemandStd] = useState<number>(4.5);
  const [leadTimeMean, setLeadTimeMean] = useState<number>(7.0);
  const [leadTimeStd, setLeadTimeStd] = useState<number>(2.0);
  const [unitPrice, setUnitPrice] = useState<number>(85.0);
  const [unitCost, setUnitCost] = useState<number>(40.0);
  const [policyResult, setPolicyResult] = useState<CalculatePolicyResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  const handleCalculatePolicy = async () => {
    setIsCalculating(true);
    try {
      const payload: CalculatePolicyRequest = {
        sku_id: 'CUSTOM-POLICY',
        daily_demand_mean: demandMean,
        daily_demand_std: demandStd,
        lead_time_days_mean: leadTimeMean,
        lead_time_days_std: leadTimeStd,
        target_service_level: targetSla,
        unit_retail_price_usd: unitPrice,
        unit_cost_usd: unitCost,
        annual_demand_units: Math.round(demandMean * 365),
        order_cost_usd: 50.0,
        holding_cost_per_unit_year_usd: Math.round(unitCost * 0.20 * 10) / 10,
        current_stock: Math.round(demandMean * 3),
      };
      const res = await apiClient.calculatePolicy(payload);
      setPolicyResult(res);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleInspectWithCopilot = (alert: InventoryAlert) => {
    openChatbot({
      sku_id: alert.sku_id,
      sku_name: alert.sku_name,
      store_id: alert.store_id,
      current_stock: alert.current_stock,
      safety_stock: alert.safety_stock_units,
      reorder_point: alert.reorder_point_units,
      stockout_risk_pct: alert.stockout_risk_pct,
    });
  };

  const handleSimulateSku = (skuId: string, storeId: string) => {
    router.push(`/simulator?sku_id=${skuId}&store_id=${storeId}`);
  };

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Inventory Optimization
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Dynamic Buffers & Risk Heatmap</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Stockout Risk Matrix & Reorder Alerts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Automated minimum stock levels, safety reserves, and smart replenishment recommendations.
          </p>
        </div>
      </div>

      {/* Stockout Risk Heatmap Component */}
      <StockoutHeatmap />

      {/* Inventory Alerts Table Component */}
      <AlertsTable
        onInspectWithCopilot={handleInspectWithCopilot}
        onSimulateSku={handleSimulateSku}
      />

      {/* Smart Reorder & Safety Stock Calculator Card */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Smart Reorder & Safety Buffer Calculator
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Dynamic Safety Buffer Estimator
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left inputs */}
          <div className="lg:col-span-6 space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Daily Demand Mean (units/day)</label>
                <input
                  type="number"
                  value={demandMean}
                  onChange={(e) => setDemandMean(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Daily Demand Std Dev</label>
                <input
                  type="number"
                  value={demandStd}
                  onChange={(e) => setDemandStd(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Lead Time Mean (days)</label>
                <input
                  type="number"
                  value={leadTimeMean}
                  onChange={(e) => setLeadTimeMean(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Lead Time Std Dev (days)</label>
                <input
                  type="number"
                  value={leadTimeStd}
                  onChange={(e) => setLeadTimeStd(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Target Service Level</label>
                <select
                  value={targetSla}
                  onChange={(e) => setTargetSla(parseFloat(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none"
                >
                  <option value={0.90}>90% (Standard fulfillment)</option>
                  <option value={0.95}>95% (Recommended baseline)</option>
                  <option value={0.98}>98% (High priority catalog)</option>
                  <option value={0.99}>99% (Mission critical lines)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Unit Price ($)</label>
                <input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Unit Cost ($)</label>
                <input
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleCalculatePolicy}
              disabled={isCalculating}
              className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-md font-semibold text-xs transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isCalculating ? 'Computing Optimal Policy...' : 'Compute Prescriptive Policy'}
            </button>
          </div>

          {/* Right policy results display */}
          <div className="lg:col-span-6 bg-slate-50 dark:bg-slate-900/60 rounded-md p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <h3 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Prescriptive Recommendations
            </h3>

            <div className="grid grid-cols-3 gap-2.5 mb-3">
              <div className="p-3 rounded-md bg-white dark:bg-[#121214] border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Safety Reserve</div>
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                  {policyResult ? `${policyResult.safety_stock_units} u` : '42 u'}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Surge protection</div>
              </div>

              <div className="p-3 rounded-md bg-white dark:bg-[#121214] border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Reorder Level</div>
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                  {policyResult ? `${policyResult.reorder_point_units} u` : '168 u'}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Minimum threshold</div>
              </div>

              <div className="p-3 rounded-md bg-white dark:bg-[#121214] border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Recommended Batch</div>
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                  {policyResult ? `${policyResult.economic_order_quantity_units} u` : '286 u'}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Optimal order size</div>
              </div>
            </div>

            <div className="p-3 rounded-md bg-white dark:bg-[#121214] border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Annual Holding Cost:</span>
                <span className="text-slate-800 dark:text-slate-200">
                  ${policyResult ? policyResult.holding_cost_burden_usd.toFixed(2) : '336.00'}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Stockout Probability:</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {policyResult ? policyResult.stockout_risk_pct.toFixed(1) : '8.2'}%
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Projected Stockout Loss:</span>
                <span className="text-rose-700 dark:text-rose-400 font-semibold">
                  ${policyResult ? policyResult.projected_stockout_loss_usd.toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
