import { ContactHandle } from './contact-handle';

export interface AddressProps {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  countryCode: string;
  postalCode: string;
}

export class Address {
  private constructor(private readonly props: AddressProps) {}

  static create(props: AddressProps): Address {
    if (!props.countryCode) throw new Error('Address requires a countryCode');
    if (!props.line1) throw new Error('Address requires line1');
    return new Address({ ...props });
  }

  get line1() { return this.props.line1; }
  get line2() { return this.props.line2; }
  get city() { return this.props.city; }
  get region() { return this.props.region; }
  get countryCode() { return this.props.countryCode; }
  get postalCode() { return this.props.postalCode; }
  toJSON(): AddressProps { return { ...this.props }; }
}

export interface BuyerContactProps {
  fullName: string;
  handle: ContactHandle;
  address: Address;
}

export class BuyerContact {
  private constructor(private readonly props: BuyerContactProps) {}

  static create(props: BuyerContactProps): BuyerContact {
    if (!props.handle) throw new Error('BuyerContact requires a handle');
    return new BuyerContact({ ...props });
  }

  get fullName() { return this.props.fullName; }
  get handle() { return this.props.handle; }
  get address() { return this.props.address; }
}
