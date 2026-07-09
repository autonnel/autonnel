import { registerComponentSchema } from '@/modules/platform/infra/registries';
import { BUILT_IN_COMPONENT_SCHEMAS } from '@/components/builder/built-in-schemas';

export function registerAuthoringComponents(): void {
  for (const schema of BUILT_IN_COMPONENT_SCHEMAS) registerComponentSchema(schema);
}
