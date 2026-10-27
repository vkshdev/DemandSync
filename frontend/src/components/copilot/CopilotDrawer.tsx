'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Bot, RefreshCw, FileText, FileSpreadsheet } from 'lucide-react';
import CopilotChat from './CopilotChat';
import {
  CopilotBriefingRequest,
  CopilotBriefingResponse,
  CopilotStatusResponse,
} from '@/types/api';
import { api } from '@/lib/api';
import { PurchaseOrderModal } from '@/components/inventory/PurchaseOrderModal';

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
  const [, setStatus] = useState<CopilotStatusResponse | null>(null);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'briefing'>('chat');
  const [isPoModalOpen, setIsPoModalOpen] = useState<boolean>(false);

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
        model_name: 'DemandSync Assistant',
        device: 'cpu',
        privacy: 'Private & Secure',
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
          'Advance purchase reorder by 3 days for at least 89 units to avoid inventory stockout.',
        executive_summary:
          'Alert for Winter Thermal Parka (SKU-001) at STORE-001: Demand volatility indicates 84.5% stockout probability driven by regional cold anomaly. On-hand inventory (42) has breached reorder point (78).',
        key_drivers: [
          'Unseasonal temperature drop (+36% lift)',
          'Historical weekend traffic acceleration (+14%)',
        ],
        action_recommendations: [
          'Advance supplier purchase order by 3 days for 89 units.',
          'Shift temporary safety stock buffer to 68 units until demand stabilizes.',
        ],
        model_used: 'DemandSync Assistant',
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
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Shell */}
      <div className="relative w-full max-w-lg h-full bg-white dark:bg-[#121214] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 text-slate-900 dark:text-slate-100 animate-in slide-in-from-right duration-200">
        {/* Header with Status Indicator */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white/95 dark:bg-[#121214]/95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">DemandSync Chatbot</h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Close chatbot"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Friendly Status Badge */}
          <div className="flex items-center justify-between px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Online &middot; Ready to help
              </span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">DemandSync Assistant</span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 pt-1 text-xs font-medium">
            <button
              onClick={() => setActiveTab('chat')}
              className={`pb-2 px-3 border-b-2 transition ${
                activeTab === 'chat'
                  ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Interactive Chat
            </button>
            <button
              onClick={() => setActiveTab('briefing')}
              className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'briefing'
                  ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
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
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Target: {briefing?.sku_id || 'SKU-001'}
                </span>
                <button
                  onClick={loadBriefing}
                  disabled={isLoadingBriefing}
                  className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingBriefing ? 'animate-spin' : ''}`} />
                  Refresh Briefing
                </button>
              </div>

              {/* Executive Briefing Card */}
              {briefing && (
                <div className="space-y-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  {/* Risk Badge and Loss Metric */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
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

                  {/* Executive Summary */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Executive Summary
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-md border border-slate-200 dark:border-slate-800">
                      {briefing.executive_summary}
                    </p>
                  </div>

                  {/* Key Demand Drivers */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Key Demand Drivers
                    </h4>
                    <ul className="space-y-1">
                      {briefing.key_drivers.map((drv: string, i: number) => (
                        <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                          <span className="text-slate-400">•</span>
                          <span>{drv}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Recommendations */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                      Prescriptive Actions
                    </h4>
                    <div className="space-y-1.5">
                      {briefing.action_recommendations.map((action: string, i: number) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 1-Click PO Execution Trigger */}
                  <div className="pt-2">
                    <button
                      onClick={() => setIsPoModalOpen(true)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Generate Purchase Order</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Purchase Order Modal */}
      {briefing && (
        <PurchaseOrderModal
          alert={{
            sku_id: briefing.sku_id || (activeContext?.sku_id as string) || 'SKU-001',
            store_id: briefing.store_id || (activeContext?.store_id as string) || 'STORE-001',
            current_stock: (activeContext?.current_stock as number) || 15,
            safety_stock_units: (activeContext?.safety_stock as number) || 50,
            reorder_point_units: (activeContext?.reorder_point as number) || 80,
            stockout_risk_pct: (activeContext?.stockout_risk_pct as number) || 84.5,
            stock_deficit_units: 35,
            urgency: briefing.risk_level || 'CRITICAL',
            projected_stockout_loss_usd: briefing.projected_stockout_loss_usd,
          }}
          isOpen={isPoModalOpen}
          onClose={() => setIsPoModalOpen(false)}
        />
      )}
    </div>
  );
}
