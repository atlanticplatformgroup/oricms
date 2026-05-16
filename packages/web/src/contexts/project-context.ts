import { createContext } from 'react';
import type {
  Action,
  CollectionConfig,
  ExtendedPermissionSet,
  Project,
  ProjectMember,
  ProjectRole,
  Resource,
} from '@ori/shared';

export type ProjectWithRole = Project & { role: ProjectRole };

export type GitStatus = {
  ahead: number;
  behind: number;
  modified: string[];
};

export interface ProjectContextType {
  projects: ProjectWithRole[];
  isLoadingProjects: boolean;
  refreshProjects: () => Promise<void>;
  currentProject: ProjectWithRole | null;
  setCurrentProject: (project: ProjectWithRole | null) => void;
  members: ProjectMember[];
  isLoadingMembers: boolean;
  refreshMembers: () => Promise<void>;
  permissions: ExtendedPermissionSet;
  hasPermission: (resource: Resource, action: Action) => boolean;
  gitStatus: GitStatus | null;
  refreshGitStatus: () => Promise<void>;
  schemas: { name: string; path: string }[];
  isLoadingSchemas: boolean;
  schemasError: string | null;
  refreshSchemas: () => Promise<void>;
  collections: CollectionConfig[];
  isLoadingCollections: boolean;
  refreshCollections: () => Promise<void>;
}

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined);
