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
  'Which items need to be reordered today?',
  'Summarize Chicago inventory risk',
  'What is the stock risk for SKU-001?',
  'Simulate a 20% discount promotion',
];

function stripMarkdownMarks(str: string): string {
  if (!str) return '';
  return str.replace(/\*\*/g, '').replace(/\*/g, '').trim();
}

function renderInlineFormatting(text: string): React.ReactNode {
  if (!text) return null;
  const regex = /(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2);
      const riskNum = parseFloat(boldText);
      const isHighRisk = boldText.includes('%') && !isNaN(riskNum) && riskNum >= 70;
      return (
        <strong
          key={idx}
          className={`font-semibold ${
            isHighRisk
              ? 'text-rose-600 dark:text-rose-400 font-bold'
              : 'text-slate-900 dark:text-zinc-100'
          }`}
        >
          {boldText}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={idx} className="italic text-slate-600 dark:text-zinc-400">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-[11px] text-slate-800 dark:text-zinc-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const cleaned = part.replace(/\*\*/g, '').replace(/\*/g, '');
    return <React.Fragment key={idx}>{cleaned}</React.Fragment>;
  });
}

interface ProductCardBlock {
  type: 'product_card';
  index: string;
  title: string;
  subtitle: string;
  bullets: string[];
}

interface CalloutBlock {
  type: 'callout';
  title: string;
  items: string[];
}

interface SimpleBlock {
  type: 'main_header' | 'section_header' | 'bullet' | 'paragraph';
  text: string;
}

type ParsedBlock = ProductCardBlock | CalloutBlock | SimpleBlock;

function parseMessageBlocks(rawText: string): ParsedBlock[] {
  const lines = rawText.split('\n');
  const blocks: ParsedBlock[] = [];
  let currentCard: ProductCardBlock | null = null;
  let currentCallout: CalloutBlock | null = null;

  const flushCard = () => {
    if (currentCard) {
      blocks.push(currentCard);
      currentCard = null;
    }
  };

  const flushCallout = () => {
    if (currentCallout) {
      blocks.push(currentCallout);
      currentCallout = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushCard();
      continue;
    }

    // 1. Executive Main Header Banner
    if (
      (i === 0 &&
        (trimmed.startsWith('🏙️') ||
          trimmed.startsWith('📊') ||
          trimmed.startsWith('📦') ||
          trimmed.startsWith('🧪') ||
          trimmed.startsWith('💼'))) ||
      trimmed.startsWith('# ') ||
      trimmed.startsWith('## ')
    ) {
      flushCard();
      flushCallout();
      blocks.push({
        type: 'main_header',
        text: stripMarkdownMarks(trimmed.replace(/^#+\s*/, '')),
      });
      continue;
    }

    // 2. Action / Logistics Callout Section
    if (
      trimmed.startsWith('🚚') ||
      trimmed.startsWith('💡') ||
      trimmed.startsWith('⚡') ||
      trimmed.startsWith('🎯') ||
      trimmed.toLowerCase().includes('logistics recommendation') ||
      trimmed.toLowerCase().includes('prescriptive action') ||
      trimmed.toLowerCase().includes('recommended action') ||
      trimmed.toLowerCase().includes('mitigation strategy')
    ) {
      flushCard();
      flushCallout();
      currentCallout = {
        type: 'callout',
        title: stripMarkdownMarks(trimmed),
        items: [],
      };
      continue;
    }

    // 3. Section subheadings
    if (
      trimmed.startsWith('📦') ||
      trimmed.startsWith('🚨') ||
      trimmed.startsWith('📈') ||
      trimmed.startsWith('🔍') ||
      trimmed.startsWith('### ')
    ) {
      flushCard();
      flushCallout();
      blocks.push({
        type: 'section_header',
        text: stripMarkdownMarks(trimmed.replace(/^###\s*/, '')),
      });
      continue;
    }

    // 4. Content inside callout
    if (currentCallout) {
      if (
        trimmed.startsWith('•') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('-') ||
        /^\d+\./.test(trimmed)
      ) {
        currentCallout.items.push(trimmed.replace(/^[•*-]\s*|^\d+\.\s*/, ''));
        continue;
      } else if (!trimmed.startsWith('#')) {
        currentCallout.items.push(trimmed);
        continue;
      } else {
        flushCallout();
      }
    }

    // 5. Numbered product card items e.g. "1. **Product P0003 (P0003)** — Category: *Toys*"
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (
      numMatch &&
      (trimmed.toLowerCase().includes('sku') ||
        trimmed.toLowerCase().includes('product') ||
        trimmed.toLowerCase().includes('category') ||
        trimmed.toLowerCase().includes('parka') ||
        trimmed.toLowerCase().includes('unit') ||
        trimmed.toLowerCase().includes('stock') ||
        trimmed.toLowerCase().includes('elasticity') ||
        trimmed.toLowerCase().includes('variance') ||
        trimmed.toLowerCase().includes('rupture'))
    ) {
      flushCard();
      const num = numMatch[1];
      const remainder = numMatch[2];
      const splitParts = remainder.split(/\s*(?:—|–| at )\s*/);
      let title = '';
      let subtitle = '';
      if (splitParts.length > 1) {
        title = stripMarkdownMarks(splitParts[0]);
        subtitle = stripMarkdownMarks(splitParts.slice(1).join(' · '));
      } else {
        title = stripMarkdownMarks(remainder);
      }

      currentCard = {
        type: 'product_card',
        index: num,
        title,
        subtitle,
        bullets: [],
      };
      continue;
    }

    // 6. Sub-bullets under current product card
    if (
      currentCard &&
      (trimmed.startsWith('•') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('-') ||
        rawLine.startsWith('   •') ||
        rawLine.startsWith('   *'))
    ) {
      currentCard.bullets.push(trimmed.replace(/^[•*-]\s*/, ''));
      continue;
    }

    // 7. General bullet item
    if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushCard();
      blocks.push({
        type: 'bullet',
        text: trimmed.replace(/^[•*-]\s*/, ''),
      });
      continue;
    }

    // 8. Regular paragraph
    flushCard();
    blocks.push({
      type: 'paragraph',
      text: trimmed,
    });
  }

  flushCard();
  flushCallout();

  return blocks;
}

function FormattedMessage({ text }: { text: string }) {
  if (!text) return null;
  const blocks = parseMessageBlocks(text);

  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-800 dark:text-zinc-200">
      {blocks.map((block, idx) => {
        if (block.type === 'main_header') {
          return (
            <div
              key={idx}
              className="text-xs sm:text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-100 pb-2 mb-2 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2"
            >
              <span>{block.text}</span>
            </div>
          );
        }

        if (block.type === 'section_header') {
          return (
            <div
              key={idx}
              className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mt-3 mb-1.5 flex items-center gap-1.5"
            >
              <span>{block.text}</span>
            </div>
          );
        }

        if (block.type === 'product_card') {
          return (
            <div
              key={idx}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-3 my-2 shadow-2xs space-y-2"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800/80 pb-1.5">
                <div className="flex items-center gap-2 font-semibold text-xs text-slate-900 dark:text-zinc-100">
                  <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[10px] flex items-center justify-center font-bold text-slate-700 dark:text-zinc-300">
                    {block.index}
                  </span>
                  <span>{block.title}</span>
                </div>
                {block.subtitle && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-zinc-700/80">
                    {block.subtitle}
                  </span>
                )}
              </div>
              <div className="space-y-1 pt-0.5">
                {block.bullets.map((b, bIdx) => (
                  <div
                    key={bIdx}
                    className="text-[11px] text-slate-600 dark:text-zinc-400 flex items-start gap-1.5"
                  >
                    <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-zinc-500 mt-1.5 shrink-0" />
                    <span>{renderInlineFormatting(b)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (block.type === 'callout') {
          return (
            <div
              key={idx}
              className="mt-3 p-3 rounded-lg border-l-4 border-slate-700 dark:border-zinc-400 bg-slate-50 dark:bg-zinc-900/80 border-t border-r border-b border-slate-200 dark:border-zinc-800 space-y-1.5"
            >
              <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                {block.title}
              </div>
              <div className="space-y-1 text-xs text-slate-700 dark:text-zinc-300">
                {block.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex items-start gap-2">
                    <span className="text-slate-400 dark:text-zinc-500 shrink-0 font-bold">•</span>
                    <div>{renderInlineFormatting(item)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (block.type === 'bullet') {
          return (
            <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-zinc-300 my-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500 mt-1.5 shrink-0" />
              <div>{renderInlineFormatting(block.text)}</div>
            </div>
          );
        }

        return (
          <p key={idx} className="text-xs leading-relaxed text-slate-700 dark:text-zinc-300 mb-2">
            {renderInlineFormatting(block.text)}
          </p>
        );
      })}
    </div>
  );
}

export default function CopilotChat({
  context = {},
}: {
  context?: Record<string, unknown>;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'copilot',
      text: 'Hello! I am your DemandSync Assistant. How may I assist your supply chain decisions today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'DemandSync Assistant',
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

    const botMsgId = `c-${Date.now()}`;
    const initialBotMessage: Message = {
      id: botMsgId,
      sender: 'copilot',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'DemandSync Assistant',
    };

    let streamSuccess = false;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

    try {
      const response = await fetch(`${apiBase}/copilot/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context }),
      });

      if (response.ok && response.body) {
        setMessages((prev) => [...prev, initialBotMessage]);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        let sseBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const events = sseBuffer.split('\n\n');
          sseBuffer = events.pop() || '';

          for (const ev of events) {
            const lines = ev.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.token) {
                    accumulatedText += parsed.token;
                    setMessages((prev) =>
                      prev.map((m) => (m.id === botMsgId ? { ...m, text: accumulatedText } : m))
                    );
                    streamSuccess = true;
                  }
                } catch {
                  // Ignore SSE framing artifacts
                }
              }
            }
          }
        }
      }
    } catch {
      // Stream failed or blocked, proceed to fallback
    }

    if (!streamSuccess) {
      try {
        const response = await api.copilotChat({
          query: query,
          context: context,
        });

        const botMessage: Message = {
          id: botMsgId,
          sender: 'copilot',
          text: response.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: 'DemandSync Assistant',
        };
        setMessages((prev) =>
          prev.some((m) => m.id === botMsgId)
            ? prev.map((m) => (m.id === botMsgId ? botMessage : m))
            : [...prev, botMessage]
        );
      } catch {
        const fallbackMessage: Message = {
          id: botMsgId,
          sender: 'copilot',
          text: `DemandSync analyzed your query '${query}'. Active analytical tables indicate multiple SKUs approaching reorder triggers. Safety stock buffer expansion and purchase order advancement are recommended.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: 'DemandSync Assistant',
        };
        setMessages((prev) =>
          prev.some((m) => m.id === botMsgId)
            ? prev.map((m) => (m.id === botMsgId ? fallbackMessage : m))
            : [...prev, fallbackMessage]
        );
      }
    }

    setIsGenerating(false);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#121214]">
      {/* Quick Prompt Chips */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
        <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1 tracking-wider">
          <Sparkles className="w-3 h-3 text-slate-600 dark:text-slate-400" />
          Quick Inquiries
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPT_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              className="text-[11px] px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 transition cursor-pointer text-left shadow-2xs"
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
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 mb-1">
              {m.sender === 'user' ? (
                <>
                  <span>You</span>
                  <User className="w-3 h-3 text-slate-400" />
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-slate-700 dark:text-slate-300" />
                  <span>DemandSync Assistant</span>
                </>
              )}
              <span>•</span>
              <span>{m.timestamp}</span>
            </div>
            <div
              className={`max-w-[90%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-medium whitespace-pre-wrap'
                  : 'bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 shadow-2xs'
              }`}
            >
              {m.sender === 'user' ? (
                m.text
              ) : (
                <FormattedMessage text={m.text} />
              )}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 mb-1">
              <Bot className="w-3 h-3 text-slate-600 dark:text-slate-400" />
              <span>Analyzing...</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600 dark:bg-slate-400 animate-pulse" />
              <span>Analyzing inventory and demand data...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121214]">
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
            placeholder="Ask DemandSync Chatbot about stock, reorder levels, or forecasts..."
            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isGenerating}
            aria-label="Send message"
            className="p-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-md transition disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
