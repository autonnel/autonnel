/// <reference types="astro/client" />

// Build-time injected by Vite `define` in the autonnel integration / astro configs.
// Undefined when the build host has no git checkout.
declare const __AUTONNEL_COMMIT__: string | undefined;

declare module 'grapesjs-preset-webpage';
declare module 'grapesjs-blocks-basic';

declare namespace App {
  interface Locals {
    tenantId?: string;

    isStorefront?: boolean;

    principal?: import('./modules/shared-kernel/principal').Principal | null;
  }
}

interface Env {
  CACHE_KV: KVNamespace;
  HYPERDRIVE: Hyperdrive;

  [key: string]: unknown;
}
