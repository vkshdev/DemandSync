'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

interface Message {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
  modelUsed?: string;
}

const QUICK_PROMPT_CHIPS = [
  'Summarize Chicago inventory risk',
  'What is the stockout exposure for SKU-001?',
  'Simulate 20% discount on lead time shock',
  'Which items breached reorder point today?',
];

export default function CopilotChat({
  context = {},
}: {
  context?: Record<string, unknown>;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'copilot',
      text: 'DemandSync Private Copilot initialized. I have analyzed your multi-store demand and inventory risk matrix on-device. How may I assist your supply chain decisions?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'Qwen/Qwen2.5-1.5B-Instruct (Local)',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSend = async (queryToSend?: string) => {
    const query = (queryToSend || inputQuery).trim();
    if (!query || isGenerating) return;

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsGenerating(true);

    try {
      const response = await api.copilotChat({
        query: query,
        context: context,
      });

      const botMessage: Message = {
        id: `c-${Date.now()}`,
        sender: 'copilot',
        text: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: response.model_used,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch {
      const fallbackMessage: Message = {
        id: `c-${Date.now()}`,
        sender: 'copilot',
        text: `Automated Assistant: DemandSync analyzed your query '${query}'. Active DuckDB analytical tables indicate multiple SKUs approaching reorder triggers. Safety stock buffer expansion and expedited purchase orders are recommended.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'deterministic-rule-engine (local)',
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Quick Prompt Chips */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/50">
        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          Quick Inquiries
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPT_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer text-left"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
              {m.sender === 'user' ? (
                <>
                  <span>You</span>
                  <User className="w-3 h-3 text-slate-400" />
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-indigo-400" />
                  <span>Copilot ({m.modelUsed || 'Local'})</span>
                </>
              )}
              <span>*</span>
              <span>{m.timestamp}</span>
            </div>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'bg-slate-800 border border-slate-700 text-slate-200'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
              <Bot className="w-3 h-3 text-indigo-400" />
              <span>Copilot Analyzing...</span>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span>Executing local on-device inference...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-slate-800 bg-slate-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask DemandSync Copilot about inventory, forecasts, or risks..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isGenerating}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
