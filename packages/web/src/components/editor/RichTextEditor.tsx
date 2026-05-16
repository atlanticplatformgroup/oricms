import { useEffect, useRef } from 'react';
import { Paper } from '@mantine/core';
import { RichTextEditor as MantineRichTextEditor, Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { htmlToMarkdown, markdownToHtml, normalizeRichTextMarkdown } from './richTextMarkdown';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onStructuredChange?: (document: Record<string, unknown>) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  onStructuredChange,
  placeholder,
  disabled = false,
}: RichTextEditorProps) {
  const lastMarkdownRef = useRef(normalizeRichTextMarkdown(value || ''));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
      }),
      Link.configure({
        autolink: true,
        openOnClick: false,
        linkOnPaste: true,
      }),
    ],
    content: markdownToHtml(value || ''),
    editable: !disabled,
    onUpdate: ({ editor: nextEditor }) => {
      const markdown = htmlToMarkdown(nextEditor.getHTML());
      if (markdown === lastMarkdownRef.current) return;

      lastMarkdownRef.current = markdown;
      onChange(markdown);
      onStructuredChange?.(nextEditor.getJSON() as Record<string, unknown>);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const normalizedIncoming = normalizeRichTextMarkdown(value || '');
    if (normalizedIncoming === lastMarkdownRef.current) return;

    editor.commands.setContent(markdownToHtml(normalizedIncoming), { emitUpdate: false });
    lastMarkdownRef.current = normalizedIncoming;
  }, [editor, value]);

  return (
    <Paper
      withBorder
      radius="md"
      p={0}
      style={{
        overflow: 'hidden',
        backgroundColor: 'var(--ori-form-input-bg)',
        borderColor: 'var(--ori-form-input-border)',
      }}
    >
      <MantineRichTextEditor
        editor={editor}
        styles={{
          root: {
            border: 0,
            backgroundColor: 'var(--ori-form-input-bg)',
          },
          toolbar: {
            padding: 'var(--mantine-spacing-xs)',
            backgroundColor: 'var(--ori-form-section-header-bg)',
            borderBottom: '1px solid var(--ori-form-input-border)',
          },
          content: {
            backgroundColor: 'var(--ori-form-input-bg)',
          },
        }}
      >
        <MantineRichTextEditor.Toolbar>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Bold />
            <MantineRichTextEditor.Italic />
            <MantineRichTextEditor.Strikethrough />
            <MantineRichTextEditor.ClearFormatting />
          </MantineRichTextEditor.ControlsGroup>

          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.H1 />
            <MantineRichTextEditor.H2 />
            <MantineRichTextEditor.H3 />
          </MantineRichTextEditor.ControlsGroup>

          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.BulletList />
            <MantineRichTextEditor.OrderedList />
            <MantineRichTextEditor.Blockquote />
            <MantineRichTextEditor.Hr />
          </MantineRichTextEditor.ControlsGroup>

          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Code />
            <MantineRichTextEditor.CodeBlock />
            <MantineRichTextEditor.Link />
            <MantineRichTextEditor.Unlink />
          </MantineRichTextEditor.ControlsGroup>

          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Undo />
            <MantineRichTextEditor.Redo />
          </MantineRichTextEditor.ControlsGroup>
        </MantineRichTextEditor.Toolbar>

        <MantineRichTextEditor.Content
          style={{ minHeight: 240, padding: 'var(--mantine-spacing-sm)' }}
          aria-label={placeholder || 'Rich text editor'}
        />
      </MantineRichTextEditor>
    </Paper>
  );
}
