'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ScenarioLab from '@/components/simulator/ScenarioLab';
import CopilotDrawer from '@/components/copilot/CopilotDrawer';

function SimulatorContent() {
  const searchParams = useSearchParams();
  const skuParam = searchParams?.get('sku_id') || 'P0001';
  const storeParam = searchParams?.get('store_id') || 'S001';

  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotContext, setCopilotContext] = useState<Record<string, unknown>>({});

  const handleOpenCopilot = (context: Record<string, unknown>) => {
    setCopilotContext(context);
    setIsCopilotOpen(true);
  };

  return (
    <div className="space-y-6">
      <ScenarioLab
        initialSkuId={skuParam}
        initialStoreId={storeParam}
        onOpenCopilot={handleOpenCopilot}
      />

      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        activeContext={copilotContext}
      />
    </div>
  );
}

export default function SimulatorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading scenario simulator...</div>}>
      <SimulatorContent />
    </Suspense>
  );
}
