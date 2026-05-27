export interface Page {
  $id: string;
  $schema: string;
  $status?: 'draft' | 'published';
  $createdAt?: string;
  $updatedAt?: string;
  $publishedAt?: string;
  metadata: {
    title: string;
    description?: string;
    slug?: string;
    publishedAt?: string;
    collectionId?: string;
    contentType?: string;
    sourceEntryId?: string;
    [key: string]: unknown;
  };
  components: Component[];
  content?: string;
}

export interface Component {
  $id: string;
  $type: string;
  props: Record<string, unknown>;
}

export interface Schema {
  $id: string;
  $schema: string;
  name: string;
  description?: string;
  fields: SchemaField[];
}

export interface SchemaField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: Record<string, unknown>;
  fields?: SchemaField[];
}

export interface Asset {
  path: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface ContentCollection {
  pages: Page[];
  schemas: Schema[];
  assets: Asset[];
  templates?: Template[];
}

export interface Template {
  $id: string;
  $schema: 'template-v1';
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  components: Component[];
}

export interface LoadOptions {
  repoUrl?: string;
  localPath?: string;
  branch?: string;
  token?: string;
}
