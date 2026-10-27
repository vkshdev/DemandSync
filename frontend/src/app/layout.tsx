import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { HeaderNav } from '@/components/layout/HeaderNav';
import { ChatbotProvider } from '@/context/ChatbotContext';
import FloatingChatbot from '@/components/copilot/FloatingChatbot';
import './globals.css';

export const metadata: Metadata = {
  title: 'DemandSync - Retail Demand Forecasting & Inventory Optimization',
  description:
    'Enterprise AI-driven demand forecasting and prescriptive inventory optimization platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = saved === 'dark' || (!saved && prefersDark);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    var meta = document.querySelector('meta[name="color-scheme"]');
                    if (meta) meta.content = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    var meta = document.querySelector('meta[name="color-scheme"]');
                    if (meta) meta.content = 'light';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-slate-100 antialiased font-sans selection:bg-slate-800 selection:text-white dark:selection:bg-slate-200 dark:selection:text-slate-900">
        <ThemeProvider>
          <ChatbotProvider>
            <HeaderNav />

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {children}
            </main>

            {/* Enterprise Clean Minimalist Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#09090b] py-5 mt-16 text-xs text-slate-500 dark:text-slate-400">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="font-medium text-slate-600 dark:text-slate-400">
                  DemandSync &middot; Intelligent Demand Forecasting &amp; Inventory Optimization
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Enterprise Edition</span>
                  <span>&bull;</span>
                  <span>All systems operational</span>
                </div>
              </div>
            </footer>

            {/* Global Floating DemandSync Chatbot */}
            <FloatingChatbot />
          </ChatbotProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
