'use client';

import React, { useState, useMemo } from 'react';
import { ShieldAlert, Store, AlertTriangle, ChevronRight } from 'lucide-react';

export interface HeatmapCellData {
  storeId: string;
  storeName: string;
  category: string;
  riskPct: number;
  breachedSkusCount?: number;
  projectedLossUsd?: number;
}

export interface StockoutHeatmapProps {
  data?: HeatmapCellData[];
  title?: string;
  subtitle?: string;
  onCellSelect?: (cell: HeatmapCellData) => void;
  className?: string;
}

const DEFAULT_STORES = [
  { id: 'STORE-001', name: 'Chicago Downtown' },
  { id: 'STORE-002', name: 'Dallas Metro' },
  { id: 'STORE-003', name: 'New York Manhattan' },
  { id: 'STORE-004', name: 'Denver Foothills' },
  { id: 'STORE-005', name: 'Miami Coastal' },
];

const DEFAULT_CATEGORIES = ['Grocery', 'Apparel', 'Electronics', 'Beverages', 'Home'];

export function getRiskTier(pct: number): {
  tier: 'LOW' | 'MODERATE' | 'CRITICAL';
  bgClass: string;
  textClass: string;
  badgeClass: string;
  borderClass: string;
} {
  if (pct >= 50) {
    return {
      tier: 'CRITICAL',
      bgClass: 'bg-rose-500/20 hover:bg-rose-500/35',
      textClass: 'text-rose-400',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      borderClass: 'border-rose-500/30',
    };
  }
  if (pct >= 20) {
    return {
      tier: 'MODERATE',
      bgClass: 'bg-amber-500/20 hover:bg-amber-500/35',
      textClass: 'text-amber-400',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      borderClass: 'border-amber-500/30',
    };
  }
  return {
    tier: 'LOW',
    bgClass: 'bg-emerald-500/20 hover:bg-emerald-500/35',
    textClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    borderClass: 'border-emerald-500/30',
  };
}

export function StockoutHeatmap({
  data,
  title = 'Store x Category Stockout Risk Matrix',
  subtitle = 'Color-coded stockout probability across retail chain nodes',
  onCellSelect,
  className = '',
}: StockoutHeatmapProps) {
  const [selectedCell, setSelectedCell] = useState<HeatmapCellData | null>(null);

  const matrixData: HeatmapCellData[] = useMemo(() => {
    if (data && data.length > 0) return data;

    const syntheticMap: Record<string, Record<string, { risk: number; skus: number; loss: number }>> = {
      'STORE-001': {
        Grocery: { risk: 14.5, skus: 0, loss: 0 },
        Apparel: { risk: 84.5, skus: 2, loss: 3240 },
        Electronics: { risk: 32.0, skus: 1, loss: 750 },
        Beverages: { risk: 8.2, skus: 0, loss: 0 },
        Home: { risk: 18.0, skus: 0, loss: 0 },
      },
      'STORE-002': {
        Grocery: { risk: 11.0, skus: 0, loss: 0 },
        Apparel: { risk: 28.5, skus: 1, loss: 480 },
        Electronics: { risk: 58.0, skus: 2, loss: 2100 },
        Beverages: { risk: 15.0, skus: 0, loss: 0 },
        Home: { risk: 22.0, skus: 1, loss: 320 },
      },
      'STORE-003': {
        Grocery: { risk: 62.0, skus: 3, loss: 4120 },
        Apparel: { risk: 42.0, skus: 1, loss: 890 },
        Electronics: { risk: 16.5, skus: 0, loss: 0 },
        Beverages: { risk: 25.0, skus: 1, loss: 380 },
        Home: { risk: 12.0, skus: 0, loss: 0 },
      },
      'STORE-004': {
        Grocery: { risk: 9.5, skus: 0, loss: 0 },
        Apparel: { risk: 68.0, skus: 2, loss: 2450 },
        Electronics: { risk: 14.0, skus: 0, loss: 0 },
        Beverages: { risk: 10.5, skus: 0, loss: 0 },
        Home: { risk: 44.0, skus: 1, loss: 610 },
      },
      'STORE-005': {
        Grocery: { risk: 19.0, skus: 0, loss: 0 },
        Apparel: { risk: 12.0, skus: 0, loss: 0 },
        Electronics: { risk: 24.5, skus: 1, loss: 510 },
        Beverages: { risk: 52.0, skus: 2, loss: 1450 },
        Home: { risk: 15.0, skus: 0, loss: 0 },
      },
    };

    const cells: HeatmapCellData[] = [];
    DEFAULT_STORES.forEach((store) => {
      DEFAULT_CATEGORIES.forEach((cat) => {
        const item = syntheticMap[store.id]?.[cat] || { risk: 12.0, skus: 0, loss: 0 };
        cells.push({
          storeId: store.id,
          storeName: store.name,
          category: cat,
          riskPct: item.risk,
          breachedSkusCount: item.skus,
          projectedLossUsd: item.loss,
        });
      });
    });
    return cells;
  }, [data]);

  const cellLookup = useMemo(() => {
    const map = new Map<string, HeatmapCellData>();
    matrixData.forEach((cell) => {
      map.set(`${cell.storeId}::${cell.category}`, cell);
    });
    return map;
  }, [matrixData]);

  const handleCellClick = (cell: HeatmapCellData) => {
    setSelectedCell(cell);
    if (onCellSelect) onCellSelect(cell);
  };

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-indigo-400" />
            <h3 className="font-semibold text-slate-100">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-emerald-400">
            <span className="inline-block h-3 w-3 rounded bg-emerald-500/25 border border-emerald-500/40" />
            &lt; 20% (Low)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-amber-400">
            <span className="inline-block h-3 w-3 rounded bg-amber-500/25 border border-amber-500/40" />
            20% - 49% (Moderate)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-rose-400">
            <span className="inline-block h-3 w-3 rounded bg-rose-500/25 border border-rose-500/40" />
            &gt;= 50% (Critical)
          </span>
        </div>
      </div>

      {/* Responsive Matrix Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="py-2.5 px-3 font-semibold text-slate-400">Store Node</th>
              {DEFAULT_CATEGORIES.map((cat) => (
                <th key={cat} className="py-2.5 px-3 text-center font-semibold text-slate-300">
                  {cat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {DEFAULT_STORES.map((store) => (
              <tr key={store.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="py-2.5 px-3 font-sans font-medium text-slate-200 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <div>{store.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{store.id}</div>
                    </div>
                  </div>
                </td>

                {DEFAULT_CATEGORIES.map((cat) => {
                  const cell = cellLookup.get(`${store.id}::${cat}`) || {
                    storeId: store.id,
                    storeName: store.name,
                    category: cat,
                    riskPct: 0,
                  };
                  const tier = getRiskTier(cell.riskPct);
                  const isSelected =
                    selectedCell?.storeId === store.id && selectedCell?.category === cat;

                  return (
                    <td key={cat} className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleCellClick(cell)}
                        className={`w-full rounded-lg border py-2.5 px-2 transition-all duration-200 cursor-pointer ${
                          tier.bgClass
                        } ${tier.borderClass} ${
                          isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-slate-900' : ''
                        }`}
                      >
                        <div className={`text-sm font-bold ${tier.textClass}`}>
                          {cell.riskPct.toFixed(1)}%
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-sans mt-0.5">
                          {tier.tier}
                        </div>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected Cell Detail Card */}
      {selectedCell && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-semibold text-slate-100 flex items-center gap-2">
              <span>{selectedCell.storeName} ({selectedCell.storeId})</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-indigo-400">{selectedCell.category}</span>
            </div>
            <div className="text-slate-400 text-[11px] mt-0.5">
              Stockout Risk Probability: <span className="font-mono font-semibold text-slate-200">{selectedCell.riskPct.toFixed(1)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedCell.breachedSkusCount !== undefined && selectedCell.breachedSkusCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{selectedCell.breachedSkusCount} SKU(s) breached ROP</span>
              </div>
            )}
            {selectedCell.projectedLossUsd !== undefined && selectedCell.projectedLossUsd > 0 && (
              <div className="font-mono text-slate-300">
                Est. Loss: <span className="text-rose-400 font-semibold">${selectedCell.projectedLossUsd.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
