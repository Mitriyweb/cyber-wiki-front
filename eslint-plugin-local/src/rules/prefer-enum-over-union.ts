/**
 * @fileoverview Prefer enum over string-literal union types
 * @author CyberWiki Team
 *
 * Flags type aliases that are purely unions of string literals.
 * Example violation:  type ViewMode = 'dev' | 'documents';
 * Preferred:          enum ViewMode { Dev = 'dev', Documents = 'documents' }
 *
 * Inline union members in interfaces/types (e.g. `type: 'file' | 'dir'`)
 * are also flagged when they contain 2+ string-literal alternatives.
 */

import type { Rule } from 'eslint';
import type { Node } from 'estree';

/**
 * Return true when every branch of a union is a TSLiteralType whose
 * literal is a string.
 */
function isAllStringLiterals(types: Node[]): boolean {
  return (
    types.length >= 2 &&
    types.every(
      (t) =>
        ((t as unknown) as Record<string, unknown>).type === 'TSLiteralType' &&
        typeof (((t as unknown) as Record<string, unknown>).literal as Record<string, unknown>)?.value === 'string'
    )
  );
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer TypeScript enum over union of string literals for named type aliases and inline members with 2+ alternatives',
      category: 'TypeScript',
      recommended: true,
    },
    messages: {
      preferEnumAlias:
        'TYPE CONVENTION: Type alias "{{name}}" is a union of string literals. Use an enum instead.\n' +
        'Example: enum {{name}} { {{example}} }',
      preferEnumInline:
        'TYPE CONVENTION: Property "{{name}}" uses an inline union of string literals. ' +
        'Extract to an enum for reusability and auto-completion.',
    },
    schema: [],
  },

  create(context: Rule.RuleContext): Rule.RuleListener {
    return {
      // type Foo = 'a' | 'b' | 'c';
      TSTypeAliasDeclaration(node: Rule.Node) {
        const decl = node as unknown as {
          id: { name: string };
          typeAnnotation: { type: string; types?: Node[] };
        };

        const annotation = decl.typeAnnotation;
        if (annotation.type !== 'TSUnionType' || !annotation.types) return;
        if (!isAllStringLiterals(annotation.types)) return;

        const literals = annotation.types.map(
          (t) => ((t as unknown as Record<string, unknown>).literal as Record<string, unknown>).value as string
        );

        const exampleEntries = literals
          .slice(0, 3)
          .map((v) => {
            const key = v
              .split(/[_\-\s]+/)
              .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
              .join('');
            return `${key} = '${v}'`;
          })
          .join(', ');

        const example =
          literals.length > 3 ? `${exampleEntries}, ...` : exampleEntries;

        context.report({
          node,
          messageId: 'preferEnumAlias',
          data: { name: decl.id.name, example },
        });
      },

      // Inline: someField: 'a' | 'b'  (inside type / interface)
      TSPropertySignature(node: Rule.Node) {
        const prop = node as unknown as {
          key: { name?: string; value?: string };
          typeAnnotation?: {
            typeAnnotation?: { type: string; types?: Node[] };
          };
        };

        const annotation = prop.typeAnnotation?.typeAnnotation;
        if (!annotation || annotation.type !== 'TSUnionType' || !annotation.types) return;
        if (!isAllStringLiterals(annotation.types)) return;

        const name =
          prop.key.name ?? String(prop.key.value ?? 'unknown');

        context.report({
          node,
          messageId: 'preferEnumInline',
          data: { name },
        });
      },
    };
  },
};

export = rule;
