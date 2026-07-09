import { builderExtensions } from 'virtual:autonnel/builder-ext';
import { collectComponentSchemas } from './merge-extensions';
import { BUILT_IN_COMPONENT_SCHEMAS } from './built-in-schemas';
import {
  getComponentSchemaRegistry,
  registerComponentSchema,
} from '@/modules/platform/infra/registries';

let populated = false;

// Registered from the app bundle (not the integration/config:setup context) so plugin
// schemas survive into the production runtime where the validator reads this same registry.
export function ensureComponentSchemasRegistered() {
  if (!populated) {
    for (const schema of BUILT_IN_COMPONENT_SCHEMAS) registerComponentSchema(schema);
    for (const schema of collectComponentSchemas(builderExtensions)) registerComponentSchema(schema);
    populated = true;
  }
  return getComponentSchemaRegistry();
}
