import { Kind, parse, type SelectionSetNode, type ValueNode, type DocumentNode, type FragmentDefinitionNode } from 'graphql';
import crypto from 'crypto';

export interface GraphQlGuardOptions {
  maxQueryLength: number;
  maxDepth: number;
  maxCost: number;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export function validateGraphQlDocument(
  query: string,
  options: GraphQlGuardOptions
): { valid: true; cost: number } | { valid: false; message: string } {
  if (query.length > options.maxQueryLength) {
    return {
      valid: false,
      message: `GraphQL query exceeds maximum length (${options.maxQueryLength} characters)`,
    };
  }

  try {
    const document = parse(query);
    const maxObservedDepth = estimateDepth(document);

    if (maxObservedDepth > options.maxDepth) {
      return {
        valid: false,
        message: `GraphQL query exceeds maximum depth (${options.maxDepth})`,
      };
    }

    const cost = estimateCost(document, options.variables, options.operationName);
    if (cost > options.maxCost) {
      return {
        valid: false,
        message: `GraphQL query exceeds maximum cost (${options.maxCost})`,
      };
    }

    return { valid: true, cost };
  } catch {
    return {
      valid: false,
      message: 'GraphQL query parse failed',
    };
  }
}

export function hashGraphQlQuery(query: string): string {
  return crypto.createHash('sha256').update(query).digest('hex');
}

function estimateDepth(document: DocumentNode): number {
  const fragments = buildFragmentMap(document);

  function walkSelectionSet(selectionSet: SelectionSetNode, depth: number, stack: Set<string>): number {
    let maxDepth = depth;
    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        const fieldDepth = depth + 1;
        maxDepth = Math.max(maxDepth, fieldDepth);
        if (selection.selectionSet) {
          maxDepth = Math.max(maxDepth, walkSelectionSet(selection.selectionSet, fieldDepth, stack));
        }
      }

      if (selection.kind === Kind.INLINE_FRAGMENT) {
        maxDepth = Math.max(maxDepth, walkSelectionSet(selection.selectionSet, depth, stack));
      }

      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragment = fragments.get(selection.name.value);
        if (!fragment || stack.has(fragment.name.value)) continue;
        const nextStack = new Set(stack);
        nextStack.add(fragment.name.value);
        maxDepth = Math.max(maxDepth, walkSelectionSet(fragment.selectionSet, depth, nextStack));
      }
    }
    return maxDepth;
  }

  let maxDepth = 0;
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      maxDepth = Math.max(maxDepth, walkSelectionSet(definition.selectionSet, 0, new Set()));
    }
  }
  return maxDepth;
}

function estimateCost(
  document: DocumentNode,
  variables: Record<string, unknown> | undefined,
  operationName: string | undefined
): number {
  const fragments = buildFragmentMap(document);
  let totalCost = 0;

  function walkSelectionSet(selectionSet: SelectionSetNode, multiplier: number, stack: Set<string>): void {
    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        const listMultiplier = isLikelyListField(selection.name.value)
          ? resolveListLimit(selection.arguments || [], variables)
          : 1;
        const nextMultiplier = multiplier * listMultiplier;
        totalCost += nextMultiplier;
        if (selection.selectionSet) {
          walkSelectionSet(selection.selectionSet, nextMultiplier, stack);
        }
      }

      if (selection.kind === Kind.INLINE_FRAGMENT) {
        walkSelectionSet(selection.selectionSet, multiplier, stack);
      }

      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragment = fragments.get(selection.name.value);
        if (!fragment || stack.has(fragment.name.value)) continue;
        const nextStack = new Set(stack);
        nextStack.add(fragment.name.value);
        walkSelectionSet(fragment.selectionSet, multiplier, nextStack);
      }
    }
  }

  for (const definition of document.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) continue;
    if (operationName && definition.name?.value && definition.name.value !== operationName) continue;
    walkSelectionSet(definition.selectionSet, 1, new Set());
  }

  return totalCost;
}

function buildFragmentMap(document: DocumentNode): Map<string, FragmentDefinitionNode> {
  const map = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      map.set(definition.name.value, definition);
    }
  }
  return map;
}

function isLikelyListField(fieldName: string): boolean {
  if (fieldName === 'records' || fieldName === 'contentTypes') return true;
  if (fieldName === 'edges' || fieldName === 'nodes') return true;
  return fieldName.length > 1 && fieldName.endsWith('s');
}

function resolveListLimit(
  args: ReadonlyArray<{ name: { value: string }; value: ValueNode }>,
  variables: Record<string, unknown> | undefined
): number {
  const arg = args.find((item) => item.name.value === 'limit' || item.name.value === 'first' || item.name.value === 'last');
  if (!arg) return 20;

  if (arg.value.kind === Kind.INT) {
    return clampLimit(Number(arg.value.value));
  }

  if (arg.value.kind === Kind.VARIABLE && variables) {
    const raw = variables[arg.value.name.value];
    if (typeof raw === 'number') {
      return clampLimit(raw);
    }
    if (typeof raw === 'string' && raw.trim() && !Number.isNaN(Number(raw))) {
      return clampLimit(Number(raw));
    }
  }

  return 20;
}

function clampLimit(raw: number): number {
  if (!Number.isFinite(raw)) return 20;
  const rounded = Math.floor(raw);
  if (rounded < 1) return 1;
  if (rounded > 100) return 100;
  return rounded;
}
