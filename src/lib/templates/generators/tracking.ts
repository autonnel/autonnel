import type { Data } from '@puckeditor/core';

export const trackingTemplate = (): Data => {
  return {
    root: { props: { maxWidth: '960' }  as any },
    content: [
      {
        type: 'OrderTrackingPanel',
        props: {
          id: 'order-tracking-1',
          title: 'Track Your Order',
          subtitle: 'Enter your email address to view your order history and tracking information.',
          emailLabel: 'Email Address',
          emailPlaceholder: 'Enter the email used for your order',
          submitButtonText: 'Find My Orders',
          submitButtonColor: '#3b82f6',
          showOrderStatus: true,
          showOrderItems: true,
          showShippingAddress: true,
          showPaymentInfo: true,
          noOrdersMessage: 'No orders found for this email address. Please check and try again.',
          supportEmail: 'support@example.com',
          backgroundColor: '#ffffff',
          borderColor: '#e5e7eb',
          borderRadius: 16,
          padding: 32,
          accentColor: '#3b82f6',
        },
      },
      {
        type: 'PageFooter',
        props: {
          id: 'footer-1',
          theme: 'compact',
          brandName: { text: 'Your Brand', color: '#ffffff', fontSize: 18 },
          backgroundColor: '#1e293b',
          showNav: true,
          showAbout: false,
          showLogo: false,
          showCopyright: true,
          showSocial: false,
          links: [
            { label: { text: 'Home', color: '#ffffff', fontSize: 14 }, url: { type: 'custom' as const, url: '/' } },
            { label: { text: 'Track Order', color: '#ffffff', fontSize: 14 }, url: { type: 'custom' as const, url: '/tracking' } },
          ],
          copyright: { text: '© 2026 Your Brand. All rights reserved.', color: 'rgba(255,255,255,0.7)', fontSize: 12 },
          padding: 32,
          fullWidth: true,
        },
      },
    ],
    zones: {},
  };
};
