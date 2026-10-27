'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Send,
  CheckCircle,
  Copy,
  Check,
  Building,
  Package,
  Calendar,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { InventoryAlert, PurchaseOrderResponse, ERPTransmitResponse } from '@/types/api';
import { api } from '@/lib/api';

interface PurchaseOrderModalProps {
  alert: InventoryAlert | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PurchaseOrderModal({ alert, isOpen, onClose }: PurchaseOrderModalProps) {
  const [poData, setPoData] = useState<PurchaseOrderResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [transmitting, setTransmitting] = useState<boolean>(false);
  const [transmitResult, setTransmitResult] = useState<ERPTransmitResponse | null>(null);
  const [erpSystem, setErpSystem] = useState<'SAP_S4HANA' | 'ORACLE_NETSUITE' | 'MICROSOFT_DYNAMICS'>('SAP_S4HANA');
  const [copied, setCopied] = useState<boolean>(false);
  const [customQty, setCustomQty] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !alert) {
      setPoData(null);
      setTransmitResult(null);
      setCustomQty(null);
      return;
    }

    const initPO = async () => {
      setLoading(true);
      try {
        const po = await api.createPurchaseOrder({
          sku_id: alert.sku_id,
          store_id: alert.store_id,
          current_stock: alert.current_stock,
          safety_stock_units: alert.safety_stock_units,
          reorder_point_units: alert.reorder_point_units,
          eoq_units: 100,
          min_order_qty: 10,
        });
        setPoData(po);
        if (po.line_items.length > 0) {
          setCustomQty(po.line_items[0].order_quantity);
        }
      } catch (err) {
        console.error('Failed to initialize PO:', err);
      } finally {
        setLoading(false);
      }
    };

    initPO();
  }, [isOpen, alert]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !alert) return null;

  const activeQty = customQty ?? (poData?.total_units || 0);
  const unitCost = poData?.line_items[0]?.unit_cost_usd || 24.50;
  const activeTotalCost = Math.round(activeQty * unitCost * 100) / 100;

  const handleCopyPoNumber = () => {
    if (poData?.po_number) {
      navigator.clipboard.writeText(poData.po_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadCSV = () => {
    if (!poData) return;
    const item = poData.line_items[0];
    const headers = [
      'PO_NUMBER',
      'CREATED_AT',
      'STORE_ID',
      'VENDOR',
      'SKU_ID',
      'SKU_NAME',
      'ORDER_QUANTITY',
      'UNIT_COST_USD',
      'TOTAL_COST_USD',
      'EXPECTED_LEAD_TIME_DAYS',
      'STATUS',
    ];

    const values = [
      `"${poData.po_number}"`,
      `"${poData.created_at}"`,
      `"${poData.store_id}"`,
      `"${poData.vendor}"`,
      `"${item?.sku_id || alert.sku_id}"`,
      `"${item?.sku_name || alert.sku_name || ''}"`,
      activeQty,
      unitCost.toFixed(2),
      activeTotalCost.toFixed(2),
      poData.lead_time_days_expected,
      `"${poData.status}"`,
    ];

    const csvContent = `${headers.join(',')}\n${values.join(',')}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${poData.po_number}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleTransmit = async () => {
    if (!poData) return;
    setTransmitting(true);
    try {
      const updatedPo = {
        ...poData,
        total_units: activeQty,
        total_cost_usd: activeTotalCost,
        line_items: poData.line_items.map((li) => ({
          ...li,
          order_quantity: activeQty,
          total_cost_usd: activeTotalCost,
        })),
      };
      const res = await api.transmitPurchaseOrderToERP({
        po_number: poData.po_number,
        erp_system: erpSystem,
        po_data: updatedPo,
      });
      setTransmitResult(res);
    } catch (err) {
      console.error('ERP transmission failed:', err);
    } finally {
      setTransmitting(false);
    }
  };

  const targetBuffer = alert.reorder_point_units + alert.safety_stock_units;
  const netDeficit = Math.max(0, targetBuffer - alert.current_stock);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] text-slate-900 dark:text-slate-100 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Purchase Order Replenishment
                </h3>
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  EDI 850 / SAP MM
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automated replenishment execution for {alert.sku_id} at {alert.store_id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
              Generating replenishment optimization payload...
            </div>
          ) : (
            <>
              {/* Replenishment Policy Math Callout */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-medium">
                  <span className="uppercase tracking-wider text-[10px]">
                    Order Recommendation Summary
                  </span>
                  <span className="font-sans text-[11px] text-slate-600 dark:text-slate-300">
                    Calculated for optimal inventory replenishment
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-2">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Current Stock</span>
                    <span className="font-bold text-rose-500">{alert.current_stock} u</span>
                  </div>
                  <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-2">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Target Stock Level</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{targetBuffer} u</span>
                  </div>
                  <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-2">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Units Needed</span>
                    <span className="font-bold text-amber-500">{netDeficit} u</span>
                  </div>
                  <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-2">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Min Order Pack</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">10 u</span>
                  </div>
                </div>
              </div>

              {/* PO Metadata Card */}
              {poData && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">PO Number:</span>
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                        {poData.po_number}
                      </span>
                      <button
                        onClick={handleCopyPoNumber}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title="Copy PO Number"
                      >
                        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar className="h-3 w-3" />
                      <span>{poData.created_at.slice(0, 10)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Authorized Vendor:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{poData.vendor}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Destination Facility:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{poData.store_id}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Expected Supplier Lead Time:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{poData.lead_time_days_expected.toFixed(1)} business days</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Payment Terms:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">Net 30 (EDI Invoice)</span>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="pt-2">
                    <div className="rounded border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 font-mono text-slate-500 dark:text-slate-400 text-[10px]">
                          <tr>
                            <th className="px-3 py-1.5">SKU / Description</th>
                            <th className="px-3 py-1.5 text-right">Unit Cost</th>
                            <th className="px-3 py-1.5 text-right">Order Qty</th>
                            <th className="px-3 py-1.5 text-right">Total USD</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
                          {poData.line_items.map((item) => (
                            <tr key={item.sku_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="px-3 py-2">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">{item.sku_id}</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans truncate max-w-[220px]">
                                  {item.sku_name}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                                ${unitCost.toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  min={item.moq || 10}
                                  step={10}
                                  value={activeQty}
                                  onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-20 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 text-right text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100">
                                ${activeTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ERP Transmit Result Banner */}
              {transmitResult && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Purchase Order Transmitted Successfully</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-slate-900 dark:text-slate-100">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] block">EDI 850 Control Number:</span>
                      <span className="font-bold">{transmitResult.edi_control_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] block">ERP Transaction ID:</span>
                      <span className="font-bold">{transmitResult.erp_transaction_id}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    {transmitResult.message}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 px-5 py-3.5 bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <label htmlFor="erp-target" className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Target ERP:
            </label>
            <select
              id="erp-target"
              value={erpSystem}
              onChange={(e) => setErpSystem(e.target.value as any)}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none"
            >
              <option value="SAP_S4HANA">SAP S/4HANA (MM)</option>
              <option value="ORACLE_NETSUITE">Oracle NetSuite</option>
              <option value="MICROSOFT_DYNAMICS">MS Dynamics 365</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCSV}
              disabled={loading || !poData}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download CSV</span>
            </button>

            <button
              onClick={handleTransmit}
              disabled={loading || transmitting || !poData}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 dark:bg-white px-3.5 py-1.5 text-xs font-semibold text-white dark:text-slate-950 shadow transition-colors hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50"
            >
              {transmitting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-900 dark:border-white border-t-transparent" />
                  <span>Transmitting...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Transmit to ERP</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
