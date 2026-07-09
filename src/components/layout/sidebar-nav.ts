import type { NavChild, NavGroup } from '@/lib/dashboard/nav';

export interface VisibleChild extends NavChild {
  visible: boolean;
}

export interface VisibleItem {
  id: string;
  label: string;
  href?: string;
  visible: boolean;
  children?: VisibleChild[];
}

export function decorateGroup(
  group: NavGroup,
  visibility: Record<string, boolean>,
  hiddenIds: Set<string>,
  settingsAppend: VisibleChild[],
): VisibleItem {
  if (group.children && group.children.length > 0) {
    const decorated: VisibleChild[] = group.children.map((c) => ({
      ...c,
      visible: (visibility[c.id] ?? false) && !hiddenIds.has(c.id),
    }));
    if (group.id === 'settings' && settingsAppend.length > 0) {
      decorated.push(...settingsAppend);
    }
    return {
      id: group.id,
      label: group.label,
      href: group.href,
      visible: !hiddenIds.has(group.id) && decorated.some((c) => c.visible),
      children: decorated,
    };
  }
  return {
    id: group.id,
    label: group.label,
    href: group.href,
    visible: (visibility[group.id] ?? false) && !hiddenIds.has(group.id),
  };
}
