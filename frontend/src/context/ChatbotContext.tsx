'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ChatbotContextType {
  isOpen: boolean;
  activeContext: Record<string, unknown>;
  activeTab: 'chat' | 'briefing';
  openChatbot: (context?: Record<string, unknown>, tab?: 'chat' | 'briefing') => void;
  closeChatbot: () => void;
  toggleChatbot: () => void;
  setActiveTab: (tab: 'chat' | 'briefing') => void;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export function ChatbotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeContext, setActiveContext] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState<'chat' | 'briefing'>('chat');

  const openChatbot = (context?: Record<string, unknown>, tab: 'chat' | 'briefing' = 'chat') => {
    if (context) {
      setActiveContext(context);
    }
    setActiveTab(tab);
    setIsOpen(true);
  };

  const closeChatbot = () => {
    setIsOpen(false);
  };

  const toggleChatbot = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <ChatbotContext.Provider
      value={{
        isOpen,
        activeContext,
        activeTab,
        openChatbot,
        closeChatbot,
        toggleChatbot,
        setActiveTab,
      }}
    >
      {children}
    </ChatbotContext.Provider>
  );
}

export function useChatbot() {
  const context = useContext(ChatbotContext);
  if (!context) {
    throw new Error('useChatbot must be used within a ChatbotProvider');
  }
  return context;
}
