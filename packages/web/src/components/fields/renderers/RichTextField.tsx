import type { FieldRendererProps } from '../contracts';
import { RichTextEditor } from '../../editor/RichTextEditor';

export function RichTextField({ field, value, disabled, onChange }: FieldRendererProps) {
  return <RichTextEditor value={typeof value === 'string' ? value : ''} onChange={onChange} disabled={disabled} placeholder={field.description || field.label || field.key} />;
}
