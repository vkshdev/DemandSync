'use client';

import React, { useState, useEffect } from 'react';
import {
  Bot,
  RefreshCw,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import CopilotChat from '@/components/copilot/CopilotChat';
import { apiClient } from '@/lib/api';
import { SKUS, STORES } from '@/lib/catalog';
import {
  CopilotBriefingRequest,
  CopilotBriefingResponse,
} from '@/types/api';

export default function ChatbotPage() {
  const [selectedSkuId, setSelectedSkuId] = useState<string>('SKU-001');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('STORE-001');
  const [briefing, setBriefing] = useState<CopilotBriefingResponse | null>(null);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState<boolean>(false);

  useEffect(() => {
    loadBriefing();
  }, [selectedSkuId, selectedStoreId]);

  const loadBriefing = async () => {
    setIsLoadingBriefing(true);
    try {
      const req: CopilotBriefingRequest = {
        sku_id: selectedSkuId,
        store_id: selectedStoreId,
        current_stock: 35,
        p10_forecast: 50.0,
        p50_forecast: 75.0,
        p90_forecast: 110.0,
        safety_stock: 45,
        reorder_point: 70,
        stockout_risk_pct: 78.4,
        lead_time_days: 6,
        unit_margin_usd: 55.0,
      };
      const data = await apiClient.getCopilotBriefing(req);
      setBriefing(data);
    } finally {
      setIsLoadingBriefing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header and Status */}
      <div className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Intelligent Assistant
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Demand & Supply Analytics</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              <span>DemandSync Chatbot</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Ask questions about inventory levels, stockout risks, demand forecasts, and supply recommendations across your retail network.
            </p>
          </div>

          {/* Friendly Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="font-medium text-slate-700 dark:text-slate-300 text-xs">
              Online &middot; Ready to help
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Briefing Generator, Right Conversational Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Briefing Generator Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Executive Briefing Generator
                </h2>
              </div>
              <button
                onClick={loadBriefing}
                disabled={isLoadingBriefing}
                className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBriefing ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
            </div>

            {/* Selector Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1 tracking-wider">
                  Target SKU
                </label>
                <select
                  value={selectedSkuId}
                  onChange={(e) => setSelectedSkuId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
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
                  Store Node
                </label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  {STORES.map((st) => (
                    <option key={st.store_id} value={st.store_id}>
                      {st.store_id} ({st.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Briefing Output Card */}
            {briefing && (
              <div className="space-y-3.5 pt-1">
                <div className="flex items-center justify-between p-3 rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                      Risk Exposure
                    </span>
                    <span
                      className={`inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded border ${
                        briefing.risk_level === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50'
                          : briefing.risk_level === 'WARNING'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50'
                      }`}
                    >
                      {briefing.risk_level}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                      Projected Loss
                    </span>
                    <span className="text-base font-mono font-bold text-rose-700 dark:text-rose-400">
                      ${briefing.projected_stockout_loss_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Executive Summary
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-3 rounded-md border border-slate-200/80 dark:border-slate-800/80">
                    {briefing.executive_summary}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Key Demand Drivers
                  </h3>
                  <ul className="space-y-1">
                    {briefing.key_drivers.map((drv, i) => (
                      <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                        <span className="text-slate-400">•</span>
                        <span>{drv}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                    Prescriptive Actions
                  </h3>
                  <div className="space-y-1.5">
                    {briefing.action_recommendations.map((action, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Full-Height Chat Assistant */}
        <div className="lg:col-span-7 h-[680px] rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col bg-white dark:bg-[#121214]">
          <CopilotChat
            context={{
              sku_id: selectedSkuId,
              store_id: selectedStoreId,
            }}
          />
        </div>
      </div>
    </div>
  );
}
