import { EmailTemplateType } from '../../types';
import type { LocaleBundles } from '../_types';

const totalsTable = (
  subtotal: string,
  shipping: string,
  tax: string,
  discount: string,
  total: string,
) => `<table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;border-collapse:collapse;">
<tr><td>${subtotal}</td><td align="right">{{orderSubtotal}}</td></tr>
<!-- IF_SHIPPING -->
<tr><td>${shipping}</td><td align="right">{{orderShipping}}</td></tr>
<!-- END_SHIPPING -->
<!-- IF_TAX -->
<tr><td>${tax}</td><td align="right">{{orderTax}}</td></tr>
<!-- END_TAX -->
<!-- IF_COUPON -->
<tr><td>${discount} ({{couponCode}})</td><td align="right">-{{couponDiscount}}</td></tr>
<!-- END_COUPON -->
<tr style="border-top:1px solid #d7dde3;font-weight:700;"><td>${total}</td><td align="right">{{orderTotal}}</td></tr>
</table>`;

const addressText = `<div style="font-size:14px;line-height:1.7;">
{{customerFullName}}<br>
{{shippingAddress}}<br>
<!-- IF_ADDRESS2 -->
{{shippingAddress2}}<br>
<!-- END_ADDRESS2 -->
{{shippingCity}}, {{shippingState}} {{shippingPostalCode}}<br>
{{shippingCountry}}
</div>`;

export const en: LocaleBundles = {
  [EmailTemplateType.ORDER_RECEIPT]: {
    name: 'Purchase Receipt',
    subject: 'Your receipt for order {{orderNumber}}',
    texts: {
      'header-title': 'Thanks for your purchase',
      'greeting-text': 'Hi {{customerFirstName}}, we have wrapped up your order and put everything together below for your records.',
      'order-info-text': 'Order {{orderNumber}} was placed on {{orderDate}}.',
      'items-heading': 'What you ordered',
      'items-list': '{{orderItemsHtml}}',
      'totals-table': totalsTable('Items subtotal', 'Delivery', 'Estimated tax', 'Discount', 'Amount charged'),
      'address-heading': 'Where it is headed',
      'address-text': addressText,
      'closing-text': 'Spotted something off? Reply to this note or reach us at {{storeEmail}} and we will sort it out.',
      'footer-text': 'Sent by {{storeName}} - {{storeUrl}}',
    },
  },
  [EmailTemplateType.ORDER_SHIPPED]: {
    name: 'Order shipped',
    subject: 'Good news — order {{orderNumber}} is on the move',
    texts: {
      'header-title': 'Your package has left the building',
      'greeting-text':
        'Hi {{customerFirstName}}, we packed up order {{orderNumber}} and handed it to the carrier. From here it travels straight to your door.',
      'tracking-info':
        'Follow every stop along the way with your tracking number: {{trackingNumber}}.',
      'track-button': 'Track my package',
      'address-heading': 'Delivering to',
      'address-text':
        '{{customerFullName}}<br>{{shippingAddress}}<br><!-- IF_ADDRESS2 -->{{shippingAddress2}}<br><!-- END_ADDRESS2 -->{{shippingCity}}, {{shippingState}} {{shippingPostalCode}}<br>{{shippingCountry}}',
      'footer-text':
        'Sent with care by {{storeName}}. Drop by anytime at {{storeUrl}}.',
    },
  },
  [EmailTemplateType.ORDER_DELIVERED]: {
    name: 'Order Delivered',
    subject: 'It arrived — order #{{orderNumber}} is at your door',
    texts: {
      'header-title': 'Delivered — enjoy every bit',
      'greeting-text':
        '<p>Great news, {{customerFirstName}}. Order #{{orderNumber}} made it all the way to you. We hope it was worth the wait.</p>',
      'review-button': 'Share your thoughts',
      'review-prompt':
        '<p><strong>Loving it so far?</strong> A quick word from you helps other shoppers decide and tells us we got it right.</p>',
      'delivery-info':
        '<p><strong>Drop-off confirmed on {{deliveredDate}}</strong></p><p style="color:#7a6a55">Left at {{shippingAddress}}<!-- IF_ADDRESS2 -->, {{shippingAddress2}}<!-- END_ADDRESS2 -->, {{shippingCity}}. Something not right? Just reply and we will sort it out.</p>',
      'footer-text': '{{storeName}} | {{storeUrl}}',
    },
  },
  [EmailTemplateType.ORDER_REFUNDED]: {
    name: 'Order Refunded',
    subject: 'Refund Processed for Order #{{orderNumber}}',
    texts: {
      'header-title': 'Refund Processed',
      'greeting-text': '<p>Hi {{customerFirstName}}, we have processed a refund for your order.</p>',
      'refund-info':
        '<p style="font-size:24px;text-align:center"><strong>Refund Amount: {{refundAmount}}</strong></p><p style="color:#666;text-align:center">Order #{{orderNumber}}</p>',
      'details-text':
        '<p><strong>Refund Date:</strong> {{refundDate}}</p><p style="color:#666">Please allow 5-10 business days for the refund to appear in your account.</p>',
      'footer-text': 'Questions? Contact us at {{storeEmail}}',
    },
  },
  [EmailTemplateType.RECALL_1]: {
    name: 'Cart reminder',
    subject: '{{customerFirstName}}, your picks are still waiting',
    texts: {
      'header-title': 'You left a few things behind',
      'greeting-text':
        'Hi {{customerFirstName}}, thanks for stopping by {{storeName}}. We saved your cart so you can pick up right where you left off.',
      'items-placeholder': '{{orderItemsHtml}}',
      'trust-box':
        'Secure checkout, easy returns within 30 days, and friendly support whenever you need a hand.',
      'coupon-text':
        '<!-- IF_COUPON -->Take {{couponDiscount}} off this order with code {{couponCode}} at checkout.<!-- END_COUPON -->',
      'cta-button-label': 'Return to my cart',
      'closing-text':
        'Items can sell out quickly, so grab yours while they are still in stock. See you soon!',
      'footer-text':
        'You are receiving this from {{storeName}}. Manage your preferences at {{storeUrl}}.',
    },
  },
  [EmailTemplateType.RECALL_2]: {
    name: 'Recall Email 2 (Day 3)',
    subject: "Don't miss out! We have a surprise just for you, {{customerFirstName}}",
    texts: {
      'header-title': "Don't Miss Out! We Have a Surprise for You",
      'greeting-text':
        '<p>Hi {{customerFirstName}},</p><p>We really want you to have your <strong>{{storeName}}</strong> items! To help you decide, we\'ve got an exclusive offer just for you:</p>',
      'coupon-box':
        '<!-- IF_COUPON --><p style="font-size:20px; margin-bottom:8px;"><strong>Your Exclusive Code</strong></p><p style="font-size:28px; letter-spacing:2px; margin:8px 0;"><strong>{{couponCode}}</strong></p><p style="color:#666; font-size:14px;">Save <strong>{{couponDiscount}}</strong> -- valid for 48 hours only</p><!-- END_COUPON -->',
      'cta-button': 'Shop Now',
      'reviews-box':
        '<p style="font-weight:600; margin-bottom:12px;">What our customers say:</p><p style="margin:8px 0; font-style:italic; color:#555;">"This is the best purchase I\'ve made this year -- the quality exceeded my expectations!" -- Customer A</p><p style="margin:8px 0; font-style:italic; color:#555;">"Super fast shipping and beautifully packaged." -- Customer B</p>',
      'closing-text':
        "<p style=\"color:#666; font-size:13px;\">Don't let someone else grab your favorites -- order now and it'll ship tomorrow!</p>",
      'footer-text': '{{storeName}} | {{storeUrl}}',
    },
  },
  [EmailTemplateType.RECALL_3]: {
    name: 'Recall Email 3 (Day 7)',
    subject: 'Final notice: Your cart is about to expire, {{customerFirstName}}',
    texts: {
      'header-title': 'Final Notice: Your Cart Is About to Expire',
      'greeting-text':
        '<p>Hi {{customerFirstName}},</p><p>This is the last reminder about the items in your cart. Due to limited stock, if payment is not completed within <strong>24 hours</strong>, we will have to release these items to other customers in line.</p>',
      'items-placeholder': '<p>{{orderItemsHtml}}</p>',
      'coupon-box':
        '<!-- IF_COUPON --><p style="font-size:18px; color:#dc2626; margin-bottom:8px;"><strong>Last Chance</strong></p><p style="font-size:22px; letter-spacing:2px; margin:8px 0;"><strong>{{couponCode}}</strong></p><p>Use this code to save <strong>{{couponDiscount}}</strong></p><!-- END_COUPON -->',
      'cta-button': 'Last Chance -- Checkout Now',
      'feedback-box':
        '<p style="font-weight:600; margin-bottom:8px;">Changed your mind?</p><p style="color:#666; margin:0;">We truly value your feedback. If you\'ve decided not to purchase, could you let us know why? Your input helps us improve.</p>',
      'closing-text':
        '<p style="color:#666; font-size:13px;">Regardless of your decision, thank you for your interest in <strong>{{storeName}}</strong>. We look forward to serving you in the future.</p>',
      'footer-text': '{{storeName}} | {{storeUrl}}',
    },
  },
};
