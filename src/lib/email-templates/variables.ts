import type { EmailTemplateType } from '@/lib/email-templates/types';


export interface EmailTemplateVariables {

  orderNumber?: string;
  orderDate?: string;
  orderTotal?: string;
  orderSubtotal?: string;
  orderShipping?: string;
  orderTax?: string;
  orderDiscount?: string;
  currency?: string;


  customerFirstName?: string;
  customerLastName?: string;
  customerFullName?: string;
  customerEmail?: string;
  customerPhone?: string;


  shippingAddress?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  billingAddress?: string;
  billingAddress2?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;


  trackingNumber?: string;
  trackingUrl?: string;
  carrierName?: string;
  estimatedDelivery?: string;
  deliveredDate?: string;


  refundAmount?: string;
  refundReason?: string;
  refundDate?: string;


  storeName?: string;
  storeUrl?: string;
  storeEmail?: string;
  storeLogo?: string;


  orderItemsHtml?: string;


  items?: Array<{
    name: string;
    quantity: number;
    price: string;
    image?: string;
    sku?: string;
  }>;


  checkoutUrl?: string;
  couponCode?: string;
  couponDiscount?: string;
  intervalHours?: string;


  [key: string]: unknown;
}


export const EMAIL_TEMPLATE_VARIABLES: Array<{
  key: keyof EmailTemplateVariables;
  label: string;
  category: string;
  example: string;
}> = [

  { key: 'orderNumber', label: 'Order Number', category: 'Order', example: 'ORD-12345' },
  { key: 'orderDate', label: 'Order Date', category: 'Order', example: 'January 15, 2025' },
  { key: 'orderTotal', label: 'Order Total', category: 'Order', example: '$99.99' },
  { key: 'orderSubtotal', label: 'Order Subtotal', category: 'Order', example: '$89.99' },
  { key: 'orderShipping', label: 'Shipping Cost', category: 'Order', example: '$5.00' },
  { key: 'orderTax', label: 'Tax Amount', category: 'Order', example: '$5.00' },
  { key: 'orderDiscount', label: 'Discount Amount', category: 'Order', example: '-$10.00' },
  { key: 'currency', label: 'Currency', category: 'Order', example: 'USD' },
  { key: 'orderItemsHtml', label: 'Order Items (HTML Table)', category: 'Order', example: '<table>...</table>' },


  { key: 'customerFirstName', label: 'First Name', category: 'Customer', example: 'John' },
  { key: 'customerLastName', label: 'Last Name', category: 'Customer', example: 'Doe' },
  { key: 'customerFullName', label: 'Full Name', category: 'Customer', example: 'John Doe' },
  { key: 'customerEmail', label: 'Email', category: 'Customer', example: 'john@example.com' },
  { key: 'customerPhone', label: 'Phone', category: 'Customer', example: '+1 (555) 123-4567' },


  { key: 'shippingAddress', label: 'Shipping Address', category: 'Shipping', example: '123 Main St' },
  { key: 'shippingAddress2', label: 'Shipping Address Line 2', category: 'Shipping', example: 'Apt 4B' },
  { key: 'shippingCity', label: 'Shipping City', category: 'Shipping', example: 'New York' },
  { key: 'shippingState', label: 'Shipping State', category: 'Shipping', example: 'NY' },
  { key: 'shippingPostalCode', label: 'Shipping Postal Code', category: 'Shipping', example: '10001' },
  { key: 'shippingCountry', label: 'Shipping Country', category: 'Shipping', example: 'United States' },


  { key: 'trackingNumber', label: 'Tracking Number', category: 'Shipping', example: '1Z999AA10123456784' },
  { key: 'trackingUrl', label: 'Tracking URL', category: 'Shipping', example: 'https://track.example.com/...' },
  { key: 'carrierName', label: 'Carrier Name', category: 'Shipping', example: 'UPS' },
  { key: 'estimatedDelivery', label: 'Estimated Delivery', category: 'Shipping', example: 'January 20, 2025' },
  { key: 'deliveredDate', label: 'Delivered Date', category: 'Shipping', example: 'January 18, 2025' },


  { key: 'refundAmount', label: 'Refund Amount', category: 'Refund', example: '$25.00' },
  { key: 'refundReason', label: 'Refund Reason', category: 'Refund', example: 'Customer request' },
  { key: 'refundDate', label: 'Refund Date', category: 'Refund', example: 'January 16, 2025' },


  { key: 'storeName', label: 'Store Name', category: 'Store', example: 'My Store' },
  { key: 'storeUrl', label: 'Store URL', category: 'Store', example: 'https://mystore.com' },
  { key: 'storeEmail', label: 'Store Email (from Email Config)', category: 'Store', example: 'support@mystore.com' },
  { key: 'storeLogo', label: 'Store Logo URL', category: 'Store', example: 'https://mystore.com/logo.png' },


  { key: 'checkoutUrl', label: 'Checkout URL (recall)', category: 'Recall', example: 'https://shop.example.com/checkout?anid=abc&recall=true' },
  { key: 'couponCode', label: 'Coupon Code', category: 'Recall', example: 'COMEBACK10' },
  { key: 'couponDiscount', label: 'Coupon Discount', category: 'Recall', example: '10%' },
  { key: 'intervalHours', label: 'Hours Since Order', category: 'Recall', example: '72' },
];


export const TEMPLATE_TYPE_VARIABLES: Record<EmailTemplateType, Array<keyof EmailTemplateVariables>> = {
  ORDER_RECEIPT: [
    'orderNumber', 'orderDate', 'orderTotal', 'orderSubtotal', 'orderShipping', 'orderTax', 'orderDiscount', 'currency',
    'couponCode', 'couponDiscount',
    'customerFirstName', 'customerLastName', 'customerFullName', 'customerEmail', 'customerPhone',
    'shippingAddress', 'shippingAddress2', 'shippingCity', 'shippingState', 'shippingPostalCode', 'shippingCountry',
    'storeName', 'storeUrl', 'storeEmail', 'storeLogo', 'items', 'orderItemsHtml',
  ],
  ORDER_SHIPPED: [
    'orderNumber', 'orderDate', 'customerFirstName', 'customerFullName',
    'trackingNumber', 'trackingUrl', 'carrierName', 'estimatedDelivery',
    'shippingAddress', 'shippingAddress2', 'shippingCity', 'shippingState', 'shippingPostalCode', 'shippingCountry',
    'storeName', 'storeUrl', 'storeEmail', 'storeLogo', 'items',
  ],
  ORDER_DELIVERED: [
    'orderNumber', 'customerFirstName', 'customerFullName',
    'deliveredDate', 'trackingNumber',
    'shippingAddress', 'shippingAddress2', 'shippingCity', 'shippingState', 'shippingPostalCode', 'shippingCountry',
    'storeName', 'storeUrl', 'storeEmail', 'storeLogo', 'items',
  ],
  ORDER_REFUNDED: [
    'orderNumber', 'orderDate', 'customerFirstName', 'customerFullName',
    'refundAmount', 'refundReason', 'refundDate', 'currency',
    'storeName', 'storeUrl', 'storeEmail', 'storeLogo',
  ],
  RECALL_1: [
    'orderNumber', 'orderDate', 'orderTotal', 'orderSubtotal', 'currency',
    'customerFirstName', 'customerLastName', 'customerFullName', 'customerEmail',
    'storeName', 'storeUrl', 'storeEmail', 'storeLogo',
    'items', 'orderItemsHtml',
    'checkoutUrl', 'couponCode', 'couponDiscount', 'intervalHours',
  ],
  RECALL_2: [
    'orderNumber', 'orderDate', 'orderTotal', 'orderSubtotal', 'currency',
    'customerFirstName', 'customerLastName', 'customerFullName', 'customerEmail',
    'storeName', 'storeUrl', 'storeEmail', 'storeLogo',
    'items', 'orderItemsHtml',
    'checkoutUrl', 'couponCode', 'couponDiscount', 'intervalHours',
  ],
  RECALL_3: [
    'orderNumber', 'orderDate', 'orderTotal', 'orderSubtotal', 'currency',
    'customerFirstName', 'customerLastName', 'customerFullName', 'customerEmail',
    'storeName', 'storeUrl', 'storeEmail', 'storeLogo',
    'items', 'orderItemsHtml',
    'checkoutUrl', 'couponCode', 'couponDiscount', 'intervalHours',
  ],
};
