import type { FieldType, SchemaField } from '@ori/shared';
import type { SchemaMode } from './types';

export const EMPTY_SECONDARY = '__empty';
export const DEFAULT_SCHEMA_MODE: SchemaMode = 'types';
export const DEFAULT_SCHEMA_SECONDARY = 'overview';
export const SECONDARY_RAIL_STORAGE_KEY = 'ori.secondary-rail-collapsed';
export const PRIMARY_RAIL_WIDTH = 72;
export const SECONDARY_TOGGLE_WIDTH = 40;
export const SECONDARY_RAIL_WIDTH = 292;

export const SCHEMA_FIELD_TYPE_OPTIONS: Array<{ value: FieldType; label: string }> = [
  { value: 'string', label: 'Text' },
  { value: 'text', label: 'Long text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'richtext', label: 'Rich text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & time' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'uid', label: 'UID / slug' },
  { value: 'color', label: 'Color' },
  { value: 'select', label: 'Select' },
  { value: 'enum', label: 'Enum' },
  { value: 'media', label: 'Media' },
  { value: 'image', label: 'Image' },
  { value: 'reference', label: 'Reference' },
  { value: 'relation', label: 'Relation' },
  { value: 'json', label: 'JSON' },
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Object' },
  { value: 'component', label: 'Component' },
  { value: 'blocks', label: 'Blocks' },
  { value: 'password', label: 'Password' },
];

export const SCHEMA_FIELD_TYPE_GROUPS: Array<{ group: string; items: Array<{ value: FieldType; label: string }> }> = [
  {
    group: 'Content',
    items: [
      { value: 'string', label: 'Text' },
      { value: 'text', label: 'Long text' },
      { value: 'textarea', label: 'Textarea' },
      { value: 'markdown', label: 'Markdown' },
      { value: 'richtext', label: 'Rich text' },
      { value: 'number', label: 'Number' },
      { value: 'boolean', label: 'Boolean' },
      { value: 'date', label: 'Date' },
      { value: 'datetime', label: 'Date & time' },
    ],
  },
  {
    group: 'Metadata',
    items: [
      { value: 'uid', label: 'UID / slug' },
      { value: 'email', label: 'Email' },
      { value: 'url', label: 'URL' },
      { value: 'color', label: 'Color' },
      { value: 'password', label: 'Password' },
      { value: 'select', label: 'Select' },
      { value: 'enum', label: 'Enum' },
    ],
  },
  {
    group: 'Relations',
    items: [
      { value: 'reference', label: 'Reference' },
      { value: 'relation', label: 'Relation' },
    ],
  },
  {
    group: 'Structure',
    items: [
      { value: 'component', label: 'Component' },
      { value: 'blocks', label: 'Blocks' },
      { value: 'array', label: 'Array' },
      { value: 'object', label: 'Object' },
      { value: 'json', label: 'JSON' },
    ],
  },
  {
    group: 'Media',
    items: [
      { value: 'media', label: 'Media' },
      { value: 'image', label: 'Image' },
    ],
  },
];

export const DEFAULT_SCHEMA_FIELD_BY_TYPE: Record<FieldType, Partial<SchemaField>> = {
  string: {},
  text: {},
  textarea: {},
  markdown: {},
  richtext: {},
  number: { min: 0 },
  boolean: { default: false },
  datetime: {},
  date: {},
  media: { multiple: false, allowedTypes: ['image/*'] },
  image: { multiple: false, allowedTypes: ['image/*'] },
  relation: { relation: { target: '', type: 'manyToOne' } },
  reference: { relation: { target: '', type: 'manyToOne' } },
  json: { default: {} },
  array: { fields: [] },
  object: { fields: [] },
  enum: { enumValues: [] },
  select: { enumValues: [] },
  uid: { uidSource: 'title' },
  email: {},
  url: {},
  color: {},
  password: {},
  component: { component: '', repeatable: false },
  blocks: { options: { allowedComponents: [] } },
};
