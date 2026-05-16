import { Badge } from '@mantine/core';

type CollectionStatus = 'draft' | 'published' | string | null | undefined;

function getCollectionStatusMeta(status: CollectionStatus) {
  switch (status) {
    case 'draft':
      return { color: 'yellow', label: 'Draft' };
    case 'published':
      return { color: 'blue', label: 'Published' };
    default:
      return {
        color: 'gray',
        label: status ? `${status}`.charAt(0).toUpperCase() + `${status}`.slice(1) : 'Unknown',
      };
  }
}

export function CollectionStatusBadge({ status }: { status: CollectionStatus }) {
  const meta = getCollectionStatusMeta(status);
  const tone = meta.color === 'blue'
    ? { background: 'rgba(138, 174, 212, 0.14)', border: 'rgba(138, 174, 212, 0.2)', text: '#d0dce8' }
    : meta.color === 'yellow'
      ? { background: 'rgba(212, 184, 106, 0.14)', border: 'rgba(212, 184, 106, 0.22)', text: '#f0e8d0' }
      : { background: 'rgba(148, 160, 198, 0.14)', border: 'rgba(148, 160, 198, 0.2)', text: '#d0d4dc' };

  return (
    <Badge
      variant="transparent"
      color={meta.color}
      style={{
        backgroundColor: tone.background,
        border: `1px solid ${tone.border}`,
        color: tone.text,
      }}
    >
      {meta.label}
    </Badge>
  );
}
