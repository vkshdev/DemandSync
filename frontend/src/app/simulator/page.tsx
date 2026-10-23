'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ScenarioLab from '@/components/simulator/ScenarioLab';
import CopilotDrawer from '@/components/copilot/CopilotDrawer';

export default function SimulatorPage() {
  const searchParams = useSearchParams();
  const skuParam = searchParams?.get('sku_id') || 'SKU-001';
  const storeParam = searchParams?.get('store_id') || 'STORE-001';

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
