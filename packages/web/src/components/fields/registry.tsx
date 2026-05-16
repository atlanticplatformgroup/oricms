import type { FieldCapabilityInput, FieldCapabilityResult } from '@ori/shared';
import { resolveFieldCapability } from '@ori/shared';
import type { FieldRendererPresentation, FieldRendererRegistration } from './contracts';
import { UnknownFieldRenderer } from './UnknownFieldRenderer';
import { ArrayField } from './renderers/ArrayField';
import { BlocksField } from './renderers/BlocksField';
import { BooleanField } from './renderers/BooleanField';
import { ComponentField } from './renderers/ComponentField';
import { DateField } from './renderers/DateField';
import { EnumField } from './renderers/EnumField';
import { MediaField } from './renderers/MediaField';
import { NumberField } from './renderers/NumberField';
import { ObjectField } from './renderers/ObjectField';
import { RelationField } from './renderers/RelationField';
import { RichTextField } from './renderers/RichTextField';
import { StringField } from './renderers/StringField';
import { TextareaField } from './renderers/TextareaField';

interface StoredRegistration extends FieldRendererRegistration {
  priority: number;
  order: number;
}

export interface FieldRegistry {
  register: (registration: FieldRendererRegistration) => void;
  get: (type: string) => FieldRendererRegistration['component'] | null;
  resolve: (type: string) => { component: FieldRendererRegistration['component']; isFallback: boolean; presentation: FieldRendererPresentation };
  resolveCapabilities: (type: string, input: FieldCapabilityInput) => FieldCapabilityResult;
  getAll: () => StoredRegistration[];
  has: (type: string) => boolean;
  reset: () => void;
  initBuiltins: () => void;
}

const BUILTIN_RENDERERS: FieldRendererRegistration[] = [
  { type: 'string', id: 'builtin:string', component: StringField, capabilities: resolveFieldCapability },
  { type: 'email', id: 'builtin:email', component: StringField, capabilities: resolveFieldCapability },
  { type: 'url', id: 'builtin:url', component: StringField, capabilities: resolveFieldCapability },
  { type: 'uid', id: 'builtin:uid', component: StringField, capabilities: resolveFieldCapability },
  { type: 'password', id: 'builtin:password', component: StringField, capabilities: resolveFieldCapability },
  { type: 'color', id: 'builtin:color', component: StringField, capabilities: resolveFieldCapability },
  { type: 'text', id: 'builtin:text', component: TextareaField, capabilities: resolveFieldCapability },
  { type: 'textarea', id: 'builtin:textarea', component: TextareaField, capabilities: resolveFieldCapability },
  { type: 'markdown', id: 'builtin:markdown', component: TextareaField, capabilities: resolveFieldCapability },
  { type: 'json', id: 'builtin:json', component: TextareaField, capabilities: resolveFieldCapability },
  { type: 'number', id: 'builtin:number', component: NumberField, capabilities: resolveFieldCapability },
  { type: 'boolean', id: 'builtin:boolean', component: BooleanField, presentation: 'toggle-row', capabilities: resolveFieldCapability },
  { type: 'date', id: 'builtin:date', component: DateField, capabilities: resolveFieldCapability },
  { type: 'datetime', id: 'builtin:datetime', component: DateField, capabilities: resolveFieldCapability },
  { type: 'object', id: 'builtin:object', component: ObjectField, capabilities: resolveFieldCapability },
  { type: 'richtext', id: 'builtin:richtext', component: RichTextField, capabilities: resolveFieldCapability },
  { type: 'enum', id: 'builtin:enum', component: EnumField, capabilities: resolveFieldCapability },
  { type: 'select', id: 'builtin:select', component: EnumField, capabilities: resolveFieldCapability },
  { type: 'relation', id: 'builtin:relation', component: RelationField, capabilities: resolveFieldCapability },
  { type: 'reference', id: 'builtin:reference', component: RelationField, capabilities: resolveFieldCapability },
  { type: 'media', id: 'builtin:media', component: MediaField, capabilities: resolveFieldCapability },
  { type: 'image', id: 'builtin:image', component: MediaField, capabilities: resolveFieldCapability },
  { type: 'component', id: 'builtin:component', component: ComponentField, capabilities: resolveFieldCapability },
  { type: 'blocks', id: 'builtin:blocks', component: BlocksField, capabilities: resolveFieldCapability },
  { type: 'array', id: 'builtin:array', component: ArrayField, capabilities: resolveFieldCapability },
];

export function createFieldRegistry(): FieldRegistry {
  const registrations = new Map<string, StoredRegistration>();
  let order = 0;
  let builtinsInitialized = false;

  const register = (registration: FieldRendererRegistration) => {
    const normalized: StoredRegistration = {
      ...registration,
      priority: registration.priority ?? 0,
      order: ++order,
    };
    const existing = registrations.get(normalized.type);
    if (!existing) {
      registrations.set(normalized.type, normalized);
      return;
    }
    const sameSource = existing.id === normalized.id;
    if (sameSource || normalized.priority > existing.priority || (normalized.priority === existing.priority && normalized.order > existing.order)) {
      if (!sameSource) {
        console.warn(`[fields] Replacing renderer for type "${normalized.type}" (${existing.id} -> ${normalized.id})`);
      }
      registrations.set(normalized.type, normalized);
    }
  };

  return {
    register,
    get: (type) => registrations.get(type)?.component ?? null,
    resolve: (type) => {
      const match = registrations.get(type);
      return {
        component: match?.component ?? UnknownFieldRenderer,
        isFallback: !match,
        presentation: match?.presentation ?? 'default',
      };
    },
    resolveCapabilities: (type, input) => registrations.get(type)?.capabilities?.(input) ?? resolveFieldCapability(input),
    getAll: () => Array.from(registrations.values()),
    has: (type) => registrations.has(type),
    reset: () => {
      registrations.clear();
      builtinsInitialized = false;
      order = 0;
    },
    initBuiltins: () => {
      if (builtinsInitialized) return;
      BUILTIN_RENDERERS.forEach(register);
      builtinsInitialized = true;
    },
  };
}

type GlobalState = typeof globalThis & { __oriFieldRegistry__?: FieldRegistry };
const globalState = globalThis as GlobalState;
export const fieldRegistry = globalState.__oriFieldRegistry__ ?? createFieldRegistry();
fieldRegistry.initBuiltins();
globalState.__oriFieldRegistry__ = fieldRegistry;

export function extendFieldRegistry(registry: FieldRegistry, registrations: FieldRendererRegistration[]): void {
  registrations.forEach((registration) => {
    registry.register(registration);
  });
}
