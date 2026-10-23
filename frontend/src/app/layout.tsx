import type { Metadata } from 'next';
import Link from 'next/link';
import { Layers, Activity, Sliders, AlertTriangle, Cpu, ShieldCheck } from 'lucide-react';
import './globals.css';

export const metadata: Metadata = {
  title: 'DemandSync - Retail Demand Forecasting & Prescriptive Inventory',
  description: 'Enterprise AI-driven probabilistic demand forecasting and prescriptive inventory optimization platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans selection:bg-indigo-500 selection:text-white">
        <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Brand Header */}
              <div className="flex items-center space-x-3">
                <Link href="/" className="flex items-center space-x-2.5">
                  <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-lg font-bold tracking-tight text-white">DemandSync</span>
                    <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase bg-slate-800 text-slate-300 rounded border border-slate-700">
                      Enterprise
                    </span>
                  </div>
                </Link>
              </div>

              {/* Navigation Links */}
              <nav className="hidden md:flex items-center space-x-1">
                <Link
                  href="/"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <Activity className="w-4 h-4" />
                  <span>Overview</span>
                </Link>
                <Link
                  href="/explorer"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  <span>SKU Explorer</span>
                </Link>
                <Link
                  href="/simulator"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Scenario Lab</span>
                </Link>
                <Link
                  href="/inventory"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Inventory Alerts</span>
                </Link>
                <Link
                  href="/copilot"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <Cpu className="w-4 h-4" />
                  <span>AI Copilot</span>
                </Link>
              </nav>

              {/* Air-gapped Privacy Status Pill */}
              <div className="flex items-center space-x-3">
                <div className="hidden lg:flex items-center space-x-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs text-slate-300">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>100% On-Device Private - Zero Data Egress</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Global Enterprise Footer */}
        <footer className="border-t border-slate-800/60 bg-slate-950 py-6 mt-16 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>DemandSync Prescriptive Analytics Platform v1.0. Zero external cloud telemetry.</div>
            <div className="flex space-x-6">
              <span>Backend: FastAPI + DuckDB</span>
              <span>Model: LightGBM Multi-Quantile</span>
              <span>Copilot: Qwen2.5-1.5B CPU</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
