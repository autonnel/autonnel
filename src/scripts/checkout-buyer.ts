export interface CheckoutState {
  customerInfo: CustomerInfo | null;
  shippingAddress: ShippingAddress | null;
  currentOrderId: string | null;
}

export interface CustomerInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface ShippingAddress {
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface BuyerBody {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    countryCode: string;
    postalCode: string;
  };
}

function getFormValue(name: string): string {
  const el = document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null;
  return el ? (el.value || '').trim() : '';
}

export function readCustomerFromForm(): CustomerInfo | null {
  const email = getFormValue('email');
  const firstName = getFormValue('firstName');
  const lastName = getFormValue('lastName');
  if (!email || !firstName || !lastName) return null;
  return { email, firstName, lastName, phone: getFormValue('phone') || undefined };
}

export function readAddressFromForm(): ShippingAddress | null {
  const address1 = getFormValue('address1');
  const city = getFormValue('city');
  const postalCode = getFormValue('postalCode');
  if (!address1 || !city || !postalCode) return null;
  return {
    address1,
    address2: getFormValue('address2') || undefined,
    city,
    state: getFormValue('state') || undefined,
    postalCode,
    country: getFormValue('country') || 'US',
  };
}

export function buyerFromState(state: CheckoutState): BuyerBody {
  const info = state.customerInfo;
  const addr = state.shippingAddress;
  const fullName = info ? `${info.firstName} ${info.lastName}`.trim() : '';
  const buyer: BuyerBody = {
    fullName: fullName || undefined,
    email: info?.email,
    phone: info?.phone,
  };
  if (addr) {
    buyer.address = {
      line1: addr.address1,
      line2: addr.address2,
      city: addr.city,
      region: addr.state,
      countryCode: addr.country || 'US',
      postalCode: addr.postalCode,
    };
  }
  return buyer;
}
