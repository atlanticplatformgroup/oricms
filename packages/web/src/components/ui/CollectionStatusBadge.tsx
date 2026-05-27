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

  return (
    <Badge variant="light" color={meta.color}>
      {meta.label}
    </Badge>
  );
}
