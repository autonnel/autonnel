export interface StatsColumnDef {
  key: string;
  label: string;
  title: string;
  eventType: string;
  category: 'click' | 'success' | 'error';
}

const PAYMENT_COLUMNS: StatsColumnDef[] = [
  { key: 'paypalButtonClick', label: 'PayPal', title: 'PayPal Button Click', eventType: 'PAYPAL_BUTTON_CLICK', category: 'click' },
  { key: 'paypalExpressClick', label: 'PP Express', title: 'PayPal Express Button Click', eventType: 'PAYPAL_EXPRESS_CLICK', category: 'click' },
  { key: 'paypalCcClick', label: 'PP CC', title: 'PayPal Credit Card Click', eventType: 'PAYPAL_CC_CLICK', category: 'click' },
  { key: 'paypalPayment', label: 'PayPal', title: 'PayPal Payment Success', eventType: 'PAYPAL_PAYMENT', category: 'success' },
  { key: 'paypalCcPayment', label: 'PP CC', title: 'PayPal Credit Card Payment Success', eventType: 'PAYPAL_CC_PAYMENT', category: 'success' },
  { key: 'paypalError', label: 'PP Error', title: 'PayPal Payment Error', eventType: 'PAYPAL_ERROR', category: 'error' },
  { key: 'stripeSubmit', label: 'Stripe', title: 'Stripe Card Submit', eventType: 'STRIPE_SUBMIT', category: 'click' },
  { key: 'stripePayment', label: 'Stripe', title: 'Stripe Payment Success', eventType: 'STRIPE_PAYMENT', category: 'success' },
  { key: 'stripeDeclined', label: 'Stripe Err', title: 'Stripe Payment Declined', eventType: 'STRIPE_DECLINED', category: 'error' },
];

const PAGE_VIEW_ITEMS = [
  { key: 'lp1', label: 'LP1', title: 'Landing Page 1 - First landing page visits' },
  { key: 'lp2', label: 'LP2', title: 'Landing Page 2 - Second landing page visits' },
  { key: 'lp3', label: 'LP3', title: 'Landing Page 3 - Third landing page visits' },
  { key: 'checkout', label: 'Checkout', title: 'Checkout - Checkout page visits' },
  { key: 'productSelected', label: 'Prod Sel', title: 'Product Selected - Users who changed product selection' },
  { key: 'upsell1', label: 'Upsell1', title: 'Upsell 1 - First upsell page visits' },
  { key: 'upsell2', label: 'Upsell2', title: 'Upsell 2 - Second upsell page visits' },
  { key: 'upsell3', label: 'Upsell3', title: 'Upsell 3 - Third upsell page visits' },
  { key: 'thankyou', label: 'Thankyou', title: 'Thank You - Thank you page visits' },
  { key: 'error', label: 'Error', title: 'Error - Error page visits' },
  { key: 'pageLeave', label: 'Leave', title: 'Page Leave - Users who left/navigated away' },
];

const BASE_STAT_KEYS = [
  'lp1',
  'lp2',
  'lp3',
  'checkout',
  'productSelected',
  'upsell1',
  'upsell2',
  'upsell3',
  'thankyou',
  'error',
  'pageLeave',
  'totalUclick',
  'totalSuccess',
  'revenue',
  'orders',
  'enteringVisitors',
  'convertingVisitors',
];

function columnsByCategory(category: StatsColumnDef['category']): StatsColumnDef[] {
  return PAYMENT_COLUMNS.filter((col) => col.category === category);
}

function toItem(col: StatsColumnDef) {
  return { key: col.key, label: col.label, title: col.title };
}

export function getClickSubHeaders(): StatsColumnDef[] {
  return columnsByCategory('click');
}

export function getSuccessSubHeaders(): StatsColumnDef[] {
  return columnsByCategory('success');
}

export function getErrorSubHeaders(): StatsColumnDef[] {
  return columnsByCategory('error');
}

export function getStatsGroups() {
  return [
    {
      title: 'Page Views',
      description: 'Unique visitors per page type',
      items: PAGE_VIEW_ITEMS,
    },
    {
      title: 'Payment Actions',
      description: 'Users who initiated payment',
      items: getClickSubHeaders().map(toItem),
    },
    {
      title: 'Payment Results',
      description: 'Payment outcomes',
      items: [
        ...getSuccessSubHeaders().map(toItem),
        ...getErrorSubHeaders().map(toItem),
        {
          key: 'revenue',
          label: 'Revenue (USD)',
          title: 'Revenue - Total revenue in USD from paid orders',
          isCurrency: true,
        },
      ],
    },
  ];
}

export function createEmptyStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const key of BASE_STAT_KEYS) {
    stats[key] = 0;
  }
  for (const col of PAYMENT_COLUMNS) {
    stats[col.key] = 0;
  }
  return stats;
}
