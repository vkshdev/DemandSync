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
  cellClass: string;
  textClass: string;
} {
  if (pct >= 50) {
    return {
      tier: 'CRITICAL',
      cellClass:
        'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/80 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50 dark:hover:bg-rose-950/50',
      textClass: 'text-rose-700 dark:text-rose-400',
    };
  }
  if (pct >= 20) {
    return {
      tier: 'MODERATE',
      cellClass:
        'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50 dark:hover:bg-amber-950/50',
      textClass: 'text-amber-700 dark:text-amber-400',
    };
  }
  return {
    tier: 'LOW',
    cellClass:
      'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100/90 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800/60',
    textClass: 'text-slate-700 dark:text-slate-300',
  };
}

export function StockoutHeatmap({
  data,
  title = 'Store × Category Stockout Risk Matrix',
  subtitle = 'Prescriptive probability across retail distribution nodes',
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
      className={`rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214] p-5 shadow-sm ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-700 dark:text-slate-300" />
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{title}</h3>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600" />
            &lt; 20% (Low)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700" />
            20% - 49% (Moderate)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-400">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-100 dark:bg-rose-900/40 border border-rose-300 dark:border-rose-700" />
            ≥ 50% (Critical)
          </span>
        </div>
      </div>

      {/* Responsive Matrix Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-3">Store Node</th>
              {DEFAULT_CATEGORIES.map((cat) => (
                <th key={cat} className="py-2.5 px-3 text-center">
                  {cat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
            {DEFAULT_STORES.map((store) => (
              <tr key={store.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                <td className="py-2 px-3 font-sans font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Store className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <div>
                      <div className="text-xs">{store.name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{store.id}</div>
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
                    <td key={cat} className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleCellClick(cell)}
                        className={`w-full rounded-md border py-2 px-1.5 transition-all cursor-pointer ${
                          tier.cellClass
                        } ${
                          isSelected ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-1 dark:ring-offset-slate-900' : ''
                        }`}
                      >
                        <div className={`text-xs font-bold font-mono ${tier.textClass}`}>
                          {cell.riskPct.toFixed(1)}%
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans mt-0.5">
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
        <div className="mt-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>{selectedCell.storeName} ({selectedCell.storeId})</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-900 dark:text-white font-bold">{selectedCell.category}</span>
            </div>
            <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
              Stockout Risk: <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedCell.riskPct.toFixed(1)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedCell.breachedSkusCount !== undefined && selectedCell.breachedSkusCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-medium text-[11px]">
                <AlertTriangle className="h-3 w-3" />
                <span>{selectedCell.breachedSkusCount} SKU(s) breached ROP</span>
              </div>
            )}
            {selectedCell.projectedLossUsd !== undefined && selectedCell.projectedLossUsd > 0 && (
              <div className="font-mono text-xs text-slate-600 dark:text-slate-300">
                Est. Loss: <span className="text-rose-700 dark:text-rose-400 font-semibold">${selectedCell.projectedLossUsd.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
