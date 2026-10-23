'use client';

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  ShieldCheck,
  RefreshCw,
  FileText,
  AlertTriangle,
  Server,
  Zap,
} from 'lucide-react';
import CopilotChat from '@/components/copilot/CopilotChat';
import { apiClient } from '@/lib/api';
import { SKUS, STORES } from '@/lib/catalog';
import {
  CopilotBriefingRequest,
  CopilotBriefingResponse,
  CopilotStatusResponse,
} from '@/types/api';

export default function CopilotPage() {
  const [status, setStatus] = useState<CopilotStatusResponse | null>(null);
  const [selectedSkuId, setSelectedSkuId] = useState<string>('SKU-001');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('STORE-001');
  const [briefing, setBriefing] = useState<CopilotBriefingResponse | null>(null);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState<boolean>(false);

  useEffect(() => {
    async function init() {
      try {
        const s = await apiClient.getCopilotStatus();
        setStatus(s);
      } catch {
        setStatus({
          provider: 'local_qwen',
          model_id: 'Qwen/Qwen2.5-1.5B-Instruct',
          model_name: 'Qwen/Qwen2.5-1.5B-Instruct',
          device: 'cpu',
          privacy: '100% On-Device Private - Zero Data Egress',
          low_cpu_mem_usage: true,
          status: 'ready',
          local_inference: true,
          model_loaded: false,
          air_gapped: true,
          model_status: 'ready',
        });
      }
      loadBriefing();
    }
    init();
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
    <div className="space-y-6">
      {/* Header and Hardware Status */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Air-Gapped Copilot
              </span>
              <span className="text-xs text-slate-400">Zero Cloud Egress</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Cpu className="w-6 h-6 text-indigo-400" />
              <span>DemandSync Private AI Copilot</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              On-device natural language supply chain intelligence powered by local Qwen2.5-1.5B CPU inference. Analyzes real-time DuckDB tables, TreeSHAP drivers, and prescriptive safety stocks without external network connectivity.
            </p>
          </div>

          {/* Privacy Monitor Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <div className="font-semibold text-emerald-300">
                  {status?.privacy || '100% On-Device Private - Zero Data Egress'}
                </div>
                <div className="text-[10px] text-emerald-400/80 font-mono">
                  Engine: {status?.model_name || 'Qwen/Qwen2.5-1.5B-Instruct'} (CPU)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Briefing Generator, Right Conversational Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Briefing Generator Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-100">
                  Executive Briefing Generator
                </h2>
              </div>
              <button
                onClick={loadBriefing}
                disabled={isLoadingBriefing}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBriefing ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
            </div>

            {/* Selector Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Target SKU</label>
                <select
                  value={selectedSkuId}
                  onChange={(e) => setSelectedSkuId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {SKUS.map((s) => (
                    <option key={s.sku_id} value={s.sku_id}>
                      {s.sku_id} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Store Node</label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Risk Exposure</span>
                    <span
                      className={`inline-block mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                        briefing.risk_level === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : briefing.risk_level === 'WARNING'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {briefing.risk_level}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Projected Loss</span>
                    <span className="text-base font-mono font-bold text-rose-400">
                      ${briefing.projected_stockout_loss_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-300 mb-1">Executive Summary</h3>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                    {briefing.executive_summary}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-300 mb-1.5">Key Demand Drivers</h3>
                  <ul className="space-y-1">
                    {briefing.key_drivers.map((drv, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <span className="text-indigo-400 font-bold">*</span>
                        <span>{drv}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-300 mb-1.5">Prescriptive Actions</h3>
                  <div className="space-y-2">
                    {briefing.action_recommendations.map((action, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-800/30 text-xs text-indigo-200 flex items-start gap-2"
                      >
                        <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 text-[10px] text-slate-500 font-mono">
                  Inference engine: {briefing.model_used}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Full-Height Chat Assistant */}
        <div className="lg:col-span-7 h-[700px] rounded-xl border border-slate-800 overflow-hidden shadow-xl flex flex-col">
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
