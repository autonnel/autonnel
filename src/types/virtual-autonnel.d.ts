declare module 'virtual:autonnel/builder-ext' {
  export const builderExtensions: import('@/lib/plugins/types').BuilderExtension[];
}

declare module 'virtual:autonnel/runtime-plugins' {
  export const onRequest: import('astro').MiddlewareHandler;
}
