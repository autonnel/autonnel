import { registerImageTraits } from './image-traits';
import { registerLinkTraits } from './link-traits';
import { registerMediaTraits } from './media-traits';
import { registerIframeTraits } from './iframe-traits';
import { registerFormTraits } from './form-traits';
import { registerIdentityTraits } from './identity-traits';

export function registerAllTraits(editor: any): void {
  registerImageTraits(editor);
  registerLinkTraits(editor);
  registerMediaTraits(editor);
  registerIframeTraits(editor);
  registerFormTraits(editor);
  registerIdentityTraits(editor);
}

export {
  registerImageTraits,
  registerLinkTraits,
  registerMediaTraits,
  registerIframeTraits,
  registerFormTraits,
  registerIdentityTraits,
};
