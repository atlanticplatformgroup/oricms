import type { GitService } from '../../git/service';

export interface SchemaMutationActor {
  id?: string;
  name?: string;
  email?: string;
}

export interface SchemaMutationContext {
  projectId: string;
  path: string;
  actor: SchemaMutationActor;
}

export interface SchemaMutationDeps {
  gitService: Pick<GitService, 'writeFile' | 'deleteFile'>;
}
