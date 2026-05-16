export interface CommitOptions {
  message: string;
  author: {
    name: string;
    email: string;
  };
}

export interface ConflictResolution {
  path: string;
  strategy: 'source' | 'target' | 'manual';
  content?: string;
}
