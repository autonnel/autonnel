import React, { useState } from 'react';
import Drawer from '@/components/primitives/ds/Drawer';
import AnalystPanel from './AnalystPanel';

interface AnalystPanelLauncherProps {
  funnelId?: string;
  funnelName?: string;
}

export default function AnalystPanelLauncher({ funnelId, funnelName }: AnalystPanelLauncherProps) {
  const [open, setOpen] = useState(false);

  const subtitle = funnelName ? `Analyzing: ${funnelName}` : 'All funnels';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-ink border border-ds-ink text-ds-card hover:bg-[#1F2937]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" aria-hidden="true">
          <path d="M12 2a2 2 0 0 1 2 2v1a7 7 0 0 1 4 6.3V14a3 3 0 0 0 1 2.2V18H5v-1.8A3 3 0 0 0 6 14v-2.7A7 7 0 0 1 10 5V4a2 2 0 0 1 2-2Z" />
          <path d="M9 21h6" />
        </svg>
        Ask AI analyst
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Conversion analyst"
        subtitle={subtitle}
        widthClass="w-full sm:w-[440px] lg:w-[480px]"
      >
        <div style={{ height: '100%' }}>
          <AnalystPanel funnelId={funnelId} />
        </div>
      </Drawer>
    </>
  );
}
