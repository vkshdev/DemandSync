'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calculator,
  ShieldCheck,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { StockoutHeatmap } from '@/components/charts/StockoutHeatmap';
import AlertsTable from '@/components/inventory/AlertsTable';
import CopilotDrawer from '@/components/copilot/CopilotDrawer';
import { apiClient } from '@/lib/api';
import { CalculatePolicyRequest, CalculatePolicyResponse, InventoryAlert } from '@/types/api';

export default function InventoryPage() {
  const router = useRouter();
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotContext, setCopilotContext] = useState<Record<string, unknown>>({});

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
    setCopilotContext({
      sku_id: alert.sku_id,
      sku_name: alert.sku_name,
      store_id: alert.store_id,
      current_stock: alert.current_stock,
      safety_stock: alert.safety_stock_units,
      reorder_point: alert.reorder_point_units,
      stockout_risk_pct: alert.stockout_risk_pct,
    });
    setIsCopilotOpen(true);
  };

  const handleSimulateSku = (skuId: string, storeId: string) => {
    router.push(`/simulator?sku_id=${skuId}&store_id=${storeId}`);
  };

  return (
    <div className="space-y-8">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Inventory Optimization
            </span>
            <span className="text-xs text-slate-400">Dynamic Buffers & Risk Heatmap</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Stockout Risk Matrix & Reorder Point Alerts
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Prescriptive Safety Stock (SS), Reorder Point (ROP), and Economic Order Quantity (EOQ) optimization.
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

      {/* Prescriptive Policy Calculator Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">
              Prescriptive Inventory Policy Calculator
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            SS = ceil(Z * sqrt(L_mean * d_std^2 + d_mean^2 * L_std^2))
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left inputs */}
          <div className="lg:col-span-6 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Daily Demand Mean (units/day)</label>
                <input
                  type="number"
                  value={demandMean}
                  onChange={(e) => setDemandMean(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Daily Demand Std Dev</label>
                <input
                  type="number"
                  value={demandStd}
                  onChange={(e) => setDemandStd(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Supplier Lead Time Mean (days)</label>
                <input
                  type="number"
                  value={leadTimeMean}
                  onChange={(e) => setLeadTimeMean(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Lead Time Std Dev (days)</label>
                <input
                  type="number"
                  value={leadTimeStd}
                  onChange={(e) => setLeadTimeStd(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Target Service Level</label>
                <select
                  value={targetSla}
                  onChange={(e) => setTargetSla(parseFloat(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                >
                  <option value={0.90}>90% (Z=1.28)</option>
                  <option value={0.95}>95% (Z=1.65)</option>
                  <option value={0.98}>98% (Z=2.05)</option>
                  <option value={0.99}>99% (Z=2.33)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Unit Price ($)</label>
                <input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Unit Cost ($)</label>
                <input
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleCalculatePolicy}
              disabled={isCalculating}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition shadow disabled:opacity-50 cursor-pointer"
            >
              {isCalculating ? 'Computing Optimal Policy...' : 'Compute Prescriptive Policy'}
            </button>
          </div>

          {/* Right policy results display */}
          <div className="lg:col-span-6 bg-slate-950/60 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Prescriptive Recommendations
            </h3>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Safety Stock</div>
                <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
                  {policyResult ? `${policyResult.safety_stock_units} units` : '42 units'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Variance buffer</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Reorder Point</div>
                <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                  {policyResult ? `${policyResult.reorder_point_units} units` : '168 units'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">PO trigger point</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">EOQ Batch</div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                  {policyResult ? `${policyResult.economic_order_quantity_units} units` : '286 units'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Cost-optimal PO</div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Annual Holding Cost Burden:</span>
                <span className="text-slate-200">
                  ${policyResult ? policyResult.holding_cost_burden_usd.toFixed(2) : '336.00'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Current Stockout Risk Probability:</span>
                <span className="text-slate-200">
                  {policyResult ? policyResult.stockout_risk_pct.toFixed(1) : '8.2'}%
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Projected Stockout Margin Loss:</span>
                <span className="text-rose-400 font-semibold">
                  ${policyResult ? policyResult.projected_stockout_loss_usd.toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Slide-Out Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        activeContext={copilotContext}
      />
    </div>
  );
}
