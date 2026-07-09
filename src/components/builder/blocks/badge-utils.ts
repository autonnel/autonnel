import type { ReactNode, CSSProperties } from 'react';
import type { SelectedItem } from './product-selection-types';

export interface BadgeDefaults {
  badgeColor: string;
  badgeTextContent: ReactNode;
  badgeTextStyle: CSSProperties;
}

export interface ResolvedBadge {
  label: ReactNode;
  backgroundColor: string;
  textStyle: CSSProperties;
}

function buildBadge(
  label: ReactNode,
  backgroundColor: string,
  textStyle: CSSProperties
): ResolvedBadge {
  return { label, backgroundColor, textStyle };
}

export function resolveItemBadge(
  item: SelectedItem,
  defaults: BadgeDefaults
): ResolvedBadge | null {
  const { badgeColor, badgeTextContent, badgeTextStyle } = defaults;

  const custom = item.badgeLabel;
  if (custom) {
    const tint = item.badgeColor ?? '';
    return buildBadge(custom, tint || badgeColor, badgeTextStyle);
  }

  if (item.isMostPopular === true) {
    return buildBadge(badgeTextContent, badgeColor, badgeTextStyle);
  }

  return null;
}

export function anyItemHasBadge(
  items: SelectedItem[],
  defaults: BadgeDefaults
): boolean {
  for (const entry of items) {
    if (resolveItemBadge(entry, defaults)) return true;
  }
  return false;
}
