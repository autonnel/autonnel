import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getConfig } from '@/lib/config/get-config';
import { getS3Config } from '@/lib/config/storage';
import { listPaymentProviders } from '@/lib/config/payment';
import { getEmailKvConfig } from '@/lib/config/email';
import { listLlmModels } from '@/lib/config/llm-models';

export interface SetupTask {
  id: 'ecommerce' | 'storage' | 'payment' | 'funnel' | 'email' | 'llm';
  label: string;
  description: string;
  href: string;
  optional: boolean;
  completed: boolean;
}

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

export async function loadSetupTasks(): Promise<SetupTask[]> {
  const db = getTenantPrisma();
  const [ecommerce, storage, payments, funnelCount, email, llmModels] = await Promise.all([
    safe(getConfig<{ provider?: string }>('ecommerce.config'), null),
    safe(getS3Config(), null),
    safe(listPaymentProviders(), []),
    safe(db.funnel.count() as Promise<number>, 0),
    safe(getEmailKvConfig(), null),
    safe(listLlmModels(), []),
  ]);

  return [
    {
      id: 'ecommerce',
      label: 'Connect headless eCommerce',
      description: 'Link Shopify, WooCommerce or Picocart to pull products and push orders',
      href: '/settings/ecommerce',
      optional: false,
      completed: !!ecommerce,
    },
    {
      id: 'storage',
      label: 'Configure storage',
      description: 'S3-compatible storage for page assets and media uploads',
      href: '/settings/storage',
      optional: false,
      completed: !!storage,
    },
    {
      id: 'payment',
      label: 'Add a payment provider',
      description: 'PayPal or Stripe to accept checkout payments',
      href: '/payment',
      optional: false,
      completed: payments.length > 0,
    },
    {
      id: 'funnel',
      label: 'Create your first funnel',
      description: 'Landing pages, checkout and upsells in one flow',
      href: '/funnels?new=1',
      optional: false,
      completed: funnelCount > 0,
    },
    {
      id: 'email',
      label: 'Set up email',
      description: 'Transactional emails: receipts, shipping updates and recall',
      href: '/settings/email',
      optional: true,
      completed: !!email,
    },
    {
      id: 'llm',
      label: 'Configure LLM',
      description: 'Enables AI page generation and conversion analysis',
      href: '/settings/llm',
      optional: true,
      completed: llmModels.length > 0,
    },
  ];
}
