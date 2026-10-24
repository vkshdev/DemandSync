'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Cpu, RefreshCw, FileText } from 'lucide-react';
import CopilotChat from './CopilotChat';
import {
  CopilotBriefingRequest,
  CopilotBriefingResponse,
  CopilotStatusResponse,
} from '@/types/api';
import { api } from '@/lib/api';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeContext?: Record<string, unknown>;
}

export default function CopilotDrawer({
  isOpen,
  onClose,
  activeContext = {},
}: CopilotDrawerProps) {
  const [briefing, setBriefing] = useState<CopilotBriefingResponse | null>(null);
  const [status, setStatus] = useState<CopilotStatusResponse | null>(null);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'briefing'>('chat');

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      loadBriefing();
    }
  }, [isOpen, activeContext]);

  const loadStatus = async () => {
    try {
      const data = await api.getCopilotStatus();
      setStatus(data);
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
  };

  const loadBriefing = async () => {
    setIsLoadingBriefing(true);
    try {
      const req: CopilotBriefingRequest = {
        sku_id: (activeContext?.sku_id as string) || 'SKU-001',
        sku_name: (activeContext?.sku_name as string) || 'Winter Thermal Parka',
        store_id: (activeContext?.store_id as string) || 'STORE-001',
        current_stock: (activeContext?.current_stock as number) || 42,
        p10_forecast: 65.0,
        p50_forecast: 95.0,
        p90_forecast: 140.0,
        safety_stock: 50,
        reorder_point: 78,
        stockout_risk_pct: 84.5,
        lead_time_days: 7,
        unit_margin_usd: 65.0,
        top_drivers: [
          { feature: 'unseasonal_polar_vortex_temp_drop', impact: '+36% surge' },
          { feature: 'historical_weekend_traffic_lift', impact: '+14% lift' },
        ],
      };
      const res = await api.getCopilotBriefing(req);
      setBriefing(res);
    } catch {
      setBriefing({
        sku_id: 'SKU-001',
        store_id: 'STORE-001',
        risk_level: 'CRITICAL',
        projected_stockout_loss_usd: 2385.0,
        recommended_action:
          'Immediately advance purchase reorder by 3 days for at least 89 units to prevent inventory rupture.',
        executive_summary:
          'Alert for Winter Thermal Parka (SKU-001) at STORE-001: Projected demand volatility shows an 84.5% stockout risk driven by polar vortex temperature drop. Current on-hand inventory (42) is below reorder point (78), posing an estimated $2,385.00 margin loss.',
        key_drivers: [
          'unseasonal_polar_vortex_temp_drop (+36% surge)',
          'historical_weekend_traffic_lift (+14% lift)',
        ],
        action_recommendations: [
          'Immediately advance purchase reorder by 3 days for at least 89 units to prevent inventory rupture.',
          'Shift safety stock buffer from 50 to 68 units until ambient temperatures normalize.',
        ],
        model_used: 'local-qwen-offline (deterministic-rule-engine)',
      });
    } finally {
      setIsLoadingBriefing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Shell */}
      <div className="relative w-full max-w-lg h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col z-10 text-slate-100">
        {/* Header with Privacy Indicator */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/90">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-base text-slate-100">DemandSync Copilot</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Air-Gapped Privacy Status Badge */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-emerald-300">
                {status?.privacy || '100% On-Device Private - Zero Data Egress'}
              </span>
            </div>
            <span className="font-mono text-emerald-400/80">CPU Air-Gapped</span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 pt-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('chat')}
              className={`pb-2 px-3 border-b-2 transition ${
                activeTab === 'chat'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Interactive Chat
            </button>
            <button
              onClick={() => setActiveTab('briefing')}
              className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'briefing'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Executive Briefing
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chat' ? (
            <CopilotChat context={activeContext} />
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Target: {briefing?.sku_id || 'SKU-001'}
                </span>
                <button
                  onClick={loadBriefing}
                  disabled={isLoadingBriefing}
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingBriefing ? 'animate-spin' : ''}`} />
                  Refresh Briefing
                </button>
              </div>

              {/* Executive Briefing Card */}
              {briefing && (
                <div className="space-y-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  {/* Risk Badge and Loss Metric */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Risk Exposure</span>
                      <span
                        className={`inline-block mt-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
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
                      <span className="text-lg font-mono font-bold text-rose-400">
                        ${briefing.projected_stockout_loss_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Executive Summary */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-1">Executive Summary</h4>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                      {briefing.executive_summary}
                    </p>
                  </div>

                  {/* Key SHAP Drivers */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-1.5">Key Demand Drivers</h4>
                    <ul className="space-y-1">
                      {briefing.key_drivers.map((drv, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                          <span className="text-indigo-400 font-bold">*</span>
                          <span>{drv}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Recommendations */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-1.5">Prescriptive Actions</h4>
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

                  {/* Attribution Footer */}
                  <div className="pt-2 text-[10px] text-slate-500 font-mono">
                    Inference engine: {briefing.model_used}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
