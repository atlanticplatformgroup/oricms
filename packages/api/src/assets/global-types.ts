export interface CommitOptions {
  author: {
    name: string;
    email: string;
  };
  message: string;
}

export interface GlobalAssetMetadata {
  assetId?: string;
  altText?: string;
  caption?: string;
  tags?: string[];
  folder?: string; // @deprecated Legacy single-tag field. Use tags instead.
  [key: string]: unknown;
}
