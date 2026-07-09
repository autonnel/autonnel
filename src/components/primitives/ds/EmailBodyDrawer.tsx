import * as React from 'react';
import Drawer from './Drawer';

export interface EmailBodyPayload {
  subject: string;
  to: string;
  status: string;
  htmlContent: string;
  orderNumber?: string;
}

const EMAIL_OPEN_EVENT = 'autonnel:email-body-open';

export function openEmailBody(payload: EmailBodyPayload) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EMAIL_OPEN_EVENT, { detail: payload }));
  }
}

const EmailBodyDrawer: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [payload, setPayload] = React.useState<EmailBodyPayload | null>(null);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<EmailBodyPayload>;
      if (ce.detail) {
        setPayload(ce.detail);
        setOpen(true);
      }
    };
    window.addEventListener(EMAIL_OPEN_EVENT, handler);
    return () => window.removeEventListener(EMAIL_OPEN_EVENT, handler);
  }, []);

  return (
    <Drawer
      open={open}
      onClose={() => setOpen(false)}
      title={payload?.subject || 'Email'}
      subtitle={payload ? `To ${payload.to}${payload.orderNumber ? ` · ${payload.orderNumber}` : ''}` : ''}
    >
      <div className="p-4">
        {payload ? (
          <iframe
            srcDoc={payload.htmlContent}
            sandbox=""
            className="w-full min-h-[60vh] bg-ds-card border border-ds-line rounded-[8px]"
            title={`Email body for ${payload.subject}`}
          />
        ) : null}
      </div>
    </Drawer>
  );
};

export default EmailBodyDrawer;
