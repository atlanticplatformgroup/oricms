import type { Asset, FieldCapabilityInput, FieldCapabilityResult, SchemaField, ComponentSchema } from '@ori/shared';
import type { StructuredDragItem } from '../../lib/entries/types';
import { toLabel } from '../../lib/workspace/format';

export type { StructuredDragItem };


export interface StructuredDragContext {
  draggedItem: StructuredDragItem | null;
  dropTarget: StructuredDragItem | null;
  startDrag: (event: React.DragEvent<HTMLElement>, item: StructuredDragItem) => void;
  endDrag: () => void;
  dragOver: (event: React.DragEvent<HTMLElement>, item: StructuredDragItem) => void;
  dragLeave: (item: StructuredDragItem) => void;
  drop: (item: StructuredDragItem) => void;
}

export interface StructuredFieldActions {
  updateObjectField?: (fieldKey: string, embeddedFieldKey: string, nextValue: unknown) => void;
  addRepeatableComponent?: (fieldKey: string, componentId: string) => void;
  removeRepeatableComponent?: (fieldKey: string, index: number) => void;
  duplicateRepeatableComponent?: (fieldKey: string, index: number) => void;
  updateRepeatableComponentField?: (fieldKey: string, index: number, embeddedFieldKey: string, nextValue: unknown) => void;
  updateComponentField?: (fieldKey: string, embeddedFieldKey: string, nextValue: unknown) => void;
  addBlock?: (fieldKey: string, componentId: string) => void;
  removeBlock?: (fieldKey: string, index: number) => void;
  duplicateBlock?: (fieldKey: string, index: number) => void;
  updateBlockField?: (fieldKey: string, index: number, embeddedFieldKey: string, nextValue: unknown) => void;
  addArrayItem?: (fieldKey: string, sampleItem?: unknown) => void;
  removeArrayItem?: (fieldKey: string, index: number) => void;
  duplicateArrayItem?: (fieldKey: string, index: number) => void;
  updateArrayItem?: (fieldKey: string, index: number, nextValue: unknown) => void;
  toggleStructuredItemCollapsed?: (item: StructuredDragItem) => void;
}

export interface StructuredItemUiState {
  collapsed: boolean;
  changed: boolean;
  invalid: boolean;
}

export interface FieldRendererContext {
  assetOptions?: Array<{ value: string; label: string }>;
  assetMap?: Map<string, Asset>;
  assetsLoading?: boolean;
  relationOptionsByField?: Record<string, Array<{ value: string; label: string }>>;
  relationLabelMapByField?: Record<string, Record<string, string>>;
  relationPickerResults?: Array<{ value: string; label: string }>;
  activeSelectedRelationOptions?: Array<{ value: string; label: string }>;
  componentSchemaMap?: Map<string, ComponentSchema>;
  customFieldChoices?: Record<string, string[]>;
  onCustomFieldChoice?: (fieldKey: string, values: string[]) => void;
  onOpenAssetPicker?: (fieldKey: string) => void;
  onOpenRelationPicker?: (fieldKey: string) => void;
  canUpdate?: boolean;
  structuredDrag?: StructuredDragContext;
  structuredActions?: StructuredFieldActions;
  getStructuredItemState?: (item: StructuredDragItem) => StructuredItemUiState;
  renderEmbeddedFieldControl?: (field: SchemaField, value: unknown, onChange: (value: unknown) => void) => React.ReactNode;
  getStructuredItemTitle?: (value: unknown, fallback: string) => string;
  identifierStateByField?: Record<string, { auto: boolean; sourceLabel?: string }>;
  onResetIdentifierToAuto?: (fieldKey: string) => void;
}

export interface FieldRendererProps {
  field: SchemaField;
  value: unknown;
  error: string | null;
  disabled: boolean;
  onChange: (value: unknown) => void;
  context: FieldRendererContext;
}

export type FieldRendererPresentation = 'default' | 'toggle-row';

export interface FieldRendererRegistration {
  type: string;
  id: string;
  component: React.ComponentType<FieldRendererProps>;
  presentation?: FieldRendererPresentation;
  capabilities?: (input: FieldCapabilityInput) => FieldCapabilityResult;
  priority?: number;
}

export interface UnknownFieldDisplay {
  badge: string;
  message: string;
}

export function resolveFieldLabel(field?: Pick<SchemaField, 'label' | 'key'>): string {
  if (!field) return 'Value';
  return field.label || toLabel(field.key);
}

export function getUnknownFieldDisplay(type: string): UnknownFieldDisplay {
  return {
    badge: 'Unknown field type',
    message: `No registered field renderer was found for "${type}". Falling back to structured editing.`,
  };
}

export function getStructuredFallbackLabel(field?: Pick<SchemaField, 'label' | 'key'>): string {
  return `${resolveFieldLabel(field)} value`;
}

export type ReadonlyFieldValueContext = {
  relationLabels?: Record<string, string>;
};

export interface ReadonlyFieldValueProps {
  value: unknown;
  field?: SchemaField;
  context?: ReadonlyFieldValueContext;
  depth?: number;
}
