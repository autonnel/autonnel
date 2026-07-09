export interface OrderItem {
  id: string;
  productId?: string;
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface Address {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  currency?: string;
  couponCode?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  paymentMethod?: {
    type: string;
    last4?: string;
    brand?: string;
    email?: string;
  };
  customerEmail?: string;
  paymentPending?: boolean;
  paymentPendingMessage?: string;
}
