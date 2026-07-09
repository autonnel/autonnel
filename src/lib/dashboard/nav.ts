


export interface NavChild {
  id: string;
  label: string;
  href: string;
}

export interface NavGroup {
  id: string;
  label: string;
  href?: string;
  children?: NavChild[];
}

export const WORKSPACE_NAV: NavGroup[] = [
  { id: 'overview', label: 'Overview', href: '/overview' },
  {
    id: 'funnels',
    label: 'Funnels',
    children: [
      { id: 'funnels.funnels', label: 'Funnels', href: '/funnels' },
      { id: 'funnels.pages', label: 'Pages', href: '/pages' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    children: [
      { id: 'orders.orders', label: 'Orders', href: '/orders' },
      { id: 'orders.emails', label: 'Emails', href: '/orders/emails' },
    ],
  },
  {
    id: 'payment',
    label: 'Payment',
    children: [
      { id: 'payment.payment', label: 'Payment', href: '/payment' },
      { id: 'payment.transactions', label: 'Transactions', href: '/transactions' },
    ],
  },
  { id: 'marketing', label: 'Marketing', href: '/marketing' },
  { id: 'analytics', label: 'Analytics', href: '/analytics' },
];

export const SETTINGS_NAV: NavGroup = {
  id: 'settings',
  label: 'Settings',
  children: [
    { id: 'settings.branding', label: 'Branding', href: '/settings/branding' },
    { id: 'settings.localization', label: 'Localization', href: '/settings/localization' },
    { id: 'settings.domains', label: 'Domains', href: '/settings/domains' },
    { id: 'settings.custom-code', label: 'Custom Code', href: '/settings/custom-code' },
    { id: 'settings.storage', label: 'Storage', href: '/settings/storage' },
    { id: 'settings.llm', label: 'LLM', href: '/settings/llm' },
    { id: 'settings.notifications', label: 'Notifications', href: '/settings/notifications' },
    { id: 'settings.ai-conversion-analysis', label: 'AI Conversion Analysis', href: '/settings/ai-conversion-analysis' },
    { id: 'settings.integrations', label: 'Integrations', href: '/settings/integrations' },
    { id: 'settings.email', label: 'Email Provider', href: '/settings/email' },
    { id: 'settings.email-templates', label: 'Email Templates', href: '/settings/email-templates' },
    { id: 'settings.ecommerce', label: 'Headless Ecommerce', href: '/settings/ecommerce' },
    { id: 'settings.recall', label: 'Recall', href: '/settings/recall' },
    { id: 'settings.maintenance', label: 'Maintenance', href: '/settings/maintenance' },
    { id: 'settings.coupons', label: 'Coupons', href: '/settings/coupons' },
    { id: 'settings.users', label: 'Users', href: '/settings/users' },
    { id: 'settings.permissions', label: 'Roles & Permissions', href: '/settings/permissions' },
    { id: 'settings.api-keys', label: 'API Keys', href: '/settings/api-keys' },
    { id: 'settings.logs', label: 'Logs', href: '/settings/logs' },
  ],
};

export function findNavById(id: string): { group?: NavGroup; child?: NavChild } {
  if (!id) return {};
  const all: NavGroup[] = [...WORKSPACE_NAV, SETTINGS_NAV];
  for (const group of all) {
    if (group.id === id) return { group };
    if (group.children) {
      for (const child of group.children) {
        if (child.id === id) return { group, child };
      }
    }
  }
  return {};
}
