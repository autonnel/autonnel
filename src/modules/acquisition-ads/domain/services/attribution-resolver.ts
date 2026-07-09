import type { AttributionTouch } from '../value-objects/attribution-touch';
import type { ClickIdentifier, AdPlatform } from '../value-objects/click-identifier';

export class AttributionResolver {
  identifiersFor(touch: AttributionTouch, platform: AdPlatform): ClickIdentifier[] {
    return touch.identifiersForPlatform(platform);
  }
}
