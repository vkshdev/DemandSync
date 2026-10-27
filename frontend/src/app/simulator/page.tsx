'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ScenarioLab from '@/components/simulator/ScenarioLab';
import { useChatbot } from '@/context/ChatbotContext';

function SimulatorContent() {
  const searchParams = useSearchParams();
  const skuParam = searchParams?.get('sku_id') || 'SKU-001';
  const storeParam = searchParams?.get('store_id') || 'STORE-001';
  const { openChatbot } = useChatbot();

  const handleOpenCopilot = (context: Record<string, unknown>) => {
    openChatbot(context);
  };

  return (
    <div className="space-y-6">
      <ScenarioLab
        initialSkuId={skuParam}
        initialStoreId={storeParam}
        onOpenCopilot={handleOpenCopilot}
      />
    </div>
  );
}

export default function SimulatorPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-500">
          Loading scenario parameters...
        </div>
      }
    >
      <SimulatorContent />
    </Suspense>
  );
}
