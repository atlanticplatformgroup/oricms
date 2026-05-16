import { useState } from 'react';
import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';

interface AgentTokenModalProps {
  opened: boolean;
  token: string | null;
  onClose: () => void;
}

export function AgentTokenModal({ opened, token, onClose }: AgentTokenModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Agent token" centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">This token is shown once. Store it securely before closing this dialog.</Text>
        <Textarea value={token || ''} readOnly minRows={3} autosize aria-label="Generated agent token" />
        <Group justify="space-between">
          <Text size="sm" c={copied ? 'green' : 'dimmed'}>{copied ? 'Copied to clipboard' : 'Copy the token now'}</Text>
          <Group gap="xs">
            <Button variant="default" onClick={() => void handleCopy()}>Copy token</Button>
            <Button onClick={onClose}>Done</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
