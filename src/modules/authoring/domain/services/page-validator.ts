import { allBlocks, isWellFormedDocument, type Block, type PuckDocument } from '../value-objects/puck-document';
import { isWellFormedBinding, type Binding } from '../value-objects/binding';

export interface ComponentSchema {
  type: string;
  allowedZones: string[]; // 'root' for top-level content
  requiredProps: string[];
}

export interface BindingValidation {
  bindings: Binding[];
  validRefs: Set<string>; // externalRefs Commerce Gateway confirmed resolvable
}

export interface ValidationResult {
  ok: boolean;
  issues: string[];
}

export class PageValidator {
  validate(doc: PuckDocument, schemas: ComponentSchema[], bindings: BindingValidation): ValidationResult {
    const issues: string[] = [];
    if (!isWellFormedDocument(doc)) {
      return { ok: false, issues: ['Malformed PuckDocument (root/content/zones)'] };
    }
    const byType = new Map(schemas.map((s) => [s.type, s]));

    const checkBlock = (block: Block, zone: string) => {
      const schema = byType.get(block.type);
      if (!schema) {
        issues.push(`Block "${block.type}" references an unregistered component`);
        return;
      }
      if (!schema.allowedZones.includes(zone)) {
        issues.push(`Block "${block.type}" not allowed in zone "${zone}"`);
      }
      for (const prop of schema.requiredProps) {
        if (block.props[prop] === undefined || block.props[prop] === null || block.props[prop] === '') {
          issues.push(`Block "${block.type}" missing required prop "${prop}"`);
        }
      }
    };

    for (const block of doc.content) checkBlock(block, 'root');
    for (const [zone, blocks] of Object.entries(doc.zones)) {
      for (const block of blocks) checkBlock(block, zone);
    }

    for (const binding of bindings.bindings) {
      if (!isWellFormedBinding(binding)) {
        issues.push(`Malformed binding (handle-only invariant violated)`);
        continue;
      }
      if (!bindings.validRefs.has(binding.externalRef)) {
        issues.push(`Binding "${binding.kind}" references unresolved externalRef`);
      }
    }

    void allBlocks(doc);
    return { ok: issues.length === 0, issues };
  }
}
