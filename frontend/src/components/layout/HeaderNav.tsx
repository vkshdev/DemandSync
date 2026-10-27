'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Layers,
  Activity,
  Sliders,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: Activity },
  { href: '/explorer', label: 'SKU Explorer', icon: Layers },
  { href: '/performance', label: 'Model Backtest', icon: TrendingUp },
  { href: '/simulator', label: 'Scenario Lab', icon: Sliders },
  { href: '/inventory', label: 'Inventory Alerts', icon: AlertTriangle },
];

export function HeaderNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand Header */}
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center font-bold transition-transform group-hover:scale-105 motion-reduce:group-hover:scale-100">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  DemandSync
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700/80">
                  Enterprise
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Action Elements: Theme Toggle */}
          <div className="flex items-center space-x-3">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
