'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, X, Maximize2 } from 'lucide-react';
import { useChatbot } from '@/context/ChatbotContext';
import CopilotChat from './CopilotChat';

export default function FloatingChatbot() {
  const { isOpen, closeChatbot, toggleChatbot, activeContext } = useChatbot();

  if (!isOpen) {
    return (
      <button
        onClick={toggleChatbot}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-semibold text-xs shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-slate-700/40 dark:border-slate-300"
        aria-label="Open DemandSync Chatbot"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <Bot className="w-4 h-4" />
        <span>DemandSync Chatbot</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[440px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-5rem)] flex flex-col rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121214] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-[#121214]/95 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center font-bold">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>DemandSync Chatbot</span>
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>Online · Ask anything about inventory</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/copilot"
            title="Open full page"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={closeChatbot}
            aria-label="Close chatbot"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Feed */}
      <div className="flex-1 overflow-hidden">
        <CopilotChat context={activeContext} />
      </div>
    </div>
  );
}
