import { CloseButton, TextInput } from '@mantine/core';
import { Search } from 'lucide-react';

interface WorkspaceSearchFieldProps {
  ariaLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  maw?: number | string;
}

export function WorkspaceSearchField({
  ariaLabel,
  placeholder,
  value,
  onChange,
  maw = 320,
}: WorkspaceSearchFieldProps) {
  return (
    <TextInput
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      leftSection={<Search size={14} />}
      rightSection={value ? <CloseButton aria-label={`Clear ${ariaLabel.toLowerCase()}`} onClick={() => onChange('')} /> : null}
      rightSectionPointerEvents="all"
      maw={maw}
      w="100%"
    />
  );
}
