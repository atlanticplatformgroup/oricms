import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, FileInput, Group, Modal, SegmentedControl, Select, Stack, TagsInput, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { WorkspaceFieldGrid } from '../../ui/WorkspacePrimitives';

export type UploadAssetScope = 'project' | 'global';

interface UploadAssetModalProps {
  opened: boolean;
  onClose: () => void;
  loading: boolean;
  defaultLibraryFolder: 'images' | 'documents';
  defaultTag: string;
  defaultScope?: UploadAssetScope;
  allowedScopes?: UploadAssetScope[];
  onUpload: (input: {
    filename: string;
    content: string;
    libraryFolder: 'images' | 'documents';
    tags: string[];
    scope: UploadAssetScope;
  }) => Promise<void>;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function UploadAssetModal({
  opened,
  onClose,
  loading,
  defaultLibraryFolder,
  defaultTag,
  defaultScope = 'project',
  allowedScopes = ['project', 'global'],
  onUpload,
}: UploadAssetModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [file, setFile] = useState<File | null>(null);
  const [scope, setScope] = useState<UploadAssetScope>(defaultScope);
  const [libraryFolder, setLibraryFolder] = useState<'images' | 'documents'>(defaultLibraryFolder);
  const [tags, setTags] = useState<string[]>(defaultTag ? [defaultTag] : []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setFile(null);
    setScope(defaultScope);
    setLibraryFolder(defaultLibraryFolder);
    setTags(defaultTag ? [defaultTag] : []);
    setError(null);
  }, [opened, defaultLibraryFolder, defaultTag, defaultScope]);

  const canChooseScope = allowedScopes.length > 1;
  const resolvedScope = allowedScopes.includes(scope) ? scope : allowedScopes[0] || 'project';

  const helperText = useMemo(() => {
    const scopeLabel = resolvedScope === 'global' ? 'the shared global library' : 'this project library';

    if (!file) {
      return canChooseScope
        ? scope === 'global'
          ? 'Choose an image or document asset to add to the shared global library.'
          : 'Choose an image or document asset to add to this project library.'
        : `Choose an image or document asset to add to ${scopeLabel}.`;
    }

    return `${file.name} will upload to ${scopeLabel} under ${libraryFolder}${tags.length ? ` with tags ${tags.join(', ')}` : ''}.`;
  }, [canChooseScope, file, libraryFolder, resolvedScope, scope, tags]);

  return (
    <Modal opened={opened} onClose={onClose} title="Upload asset" centered size="md" fullScreen={isMobile}>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Choose whether this upload should stay branch-aware in the current project or become a shared global asset. If a tag is selected in the browser, it is prefilled here.
        </Text>
        {canChooseScope ? (
          <SegmentedControl
            value={resolvedScope}
            onChange={(value) => setScope((value as UploadAssetScope) || 'project')}
            data={allowedScopes.map((option) => ({
              value: option,
              label: option === 'global' ? 'Global library' : 'Project library',
            }))}
          />
        ) : null}
        {resolvedScope === 'global' ? (
          <Alert color="teal" title="Shared across projects">
            Global assets are not branch-specific. Use this for shared brand files and reusable documents that should be available everywhere.
          </Alert>
        ) : null}
        <FileInput label="Asset file" placeholder="Choose file" value={file} onChange={setFile} clearable accept="image/*,.pdf" />
        <WorkspaceFieldGrid>
          <Select
            label="Library bucket"
            data={[{ value: 'images', label: 'Images' }, { value: 'documents', label: 'Documents' }]}
            value={libraryFolder}
            onChange={(value) => setLibraryFolder((value as 'images' | 'documents') || defaultLibraryFolder)}
          />
          <TagsInput label="Tags" value={tags} onChange={setTags} placeholder="Optional" />
        </WorkspaceFieldGrid>
        {error ? <Alert color="red" title="Upload failed">{error}</Alert> : null}
        <Text size="sm" c="dimmed">{helperText}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button
            loading={loading}
            disabled={!file}
            onClick={async () => {
                if (!file) return;
              try {
                setError(null);
                const content = await readFileAsDataUrl(file);
                await onUpload({ filename: file.name, content, libraryFolder, tags, scope: resolvedScope });
                onClose();
              } catch (uploadError) {
                setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
              }
            }}
          >
            Upload asset
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
