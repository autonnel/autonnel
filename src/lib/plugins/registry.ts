import type {
  AuthProvider,
  ComponentRef,
  MenuItem,
  PolicyHooks,
  SingleValueSlotId,
  ListSlotId,
} from './types';
import { DEFAULT_POLICY_HOOKS } from '@/lib/hooks/policy/defaults';

interface PluginRegistryState {
  activeAuthProvider: AuthProvider | undefined;
  loginExtras: Array<() => Promise<string | undefined> | string | undefined>;
  activePolicyHooks: Required<PolicyHooks>;
  activeSingleSlots: Partial<Record<SingleValueSlotId, ComponentRef>>;
  activeMenuAppend: MenuItem[];
  activeSidebarSystemAppend: MenuItem[];
  activeNavHidden: string[];
}

const STATE_KEY = Symbol.for('autonnel.plugins.registry.state');

function getState(): PluginRegistryState {
  const g = globalThis as unknown as { [k: symbol]: PluginRegistryState | undefined };
  let state = g[STATE_KEY];
  if (!state) {
    state = {
      activeAuthProvider: undefined,
      loginExtras: [],
      activePolicyHooks: DEFAULT_POLICY_HOOKS,
      activeSingleSlots: {},
      activeMenuAppend: [],
      activeSidebarSystemAppend: [],
      activeNavHidden: [],
    };
    g[STATE_KEY] = state;
  }
  return state;
}

export function setActiveAuthProvider(provider: AuthProvider | undefined): void {
  getState().activeAuthProvider = provider;
}

export function getActiveAuthProvider(): AuthProvider | undefined {
  return getState().activeAuthProvider;
}

export function registerLoginExtras(
  fn: () => Promise<string | undefined> | string | undefined,
): void {
  getState().loginExtras.push(fn);
}

export async function getLoginExtras(): Promise<string> {
  const out: string[] = [];
  for (const fn of getState().loginExtras) {
    try {
      const html = await fn();
      if (html) out.push(html);
    } catch {
      // Never block the login page on a broken extra.
    }
  }
  return out.join('\n');
}

export function setActivePolicyHooks(hooks: Required<PolicyHooks>): void {
  getState().activePolicyHooks = hooks;
}

export function getPolicyHooks(): Required<PolicyHooks> {
  return getState().activePolicyHooks;
}

export interface ActiveUiSlots {
  single: Partial<Record<SingleValueSlotId, ComponentRef>>;
  menuAppend: MenuItem[];
  sidebarSystemAppend: MenuItem[];
  navHidden: string[];
}

export function setActiveUiSlots(parts: ActiveUiSlots): void {
  const state = getState();
  state.activeSingleSlots = parts.single;
  state.activeMenuAppend = parts.menuAppend;
  state.activeSidebarSystemAppend = parts.sidebarSystemAppend;
  state.activeNavHidden = parts.navHidden;
}

export function getUiSlot(id: SingleValueSlotId): ComponentRef | undefined {
  return getState().activeSingleSlots[id];
}

export function getUiSlotList(id: ListSlotId): MenuItem[] {
  if (id === 'settings.menu.append') return getState().activeMenuAppend;
  if (id === 'sidebar.system.append') return getState().activeSidebarSystemAppend;
  return [];
}

export function getSidebarSystemAppend(): MenuItem[] {
  return getState().activeSidebarSystemAppend;
}

export function getNavHidden(): string[] {
  return getState().activeNavHidden;
}

export function resetUiAndPolicyRegistry(): void {
  const state = getState();
  state.activePolicyHooks = DEFAULT_POLICY_HOOKS;
  state.activeSingleSlots = {};
  state.activeMenuAppend = [];
  state.activeSidebarSystemAppend = [];
  state.activeNavHidden = [];
}
