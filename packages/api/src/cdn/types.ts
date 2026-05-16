export interface ExportJob {
  id: string;
  projectId: string;
  status: 'pending' | 'uploading' | 'invalidating' | 'completed' | 'failed';
  sourcePath: string;
  destinationPrefix: string;
  totalFiles: number;
  uploadedFiles: number;
  failedFiles: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}

export interface ExportOptions {
  sourcePath: string;
  destinationPrefix?: string;
  exclude?: string[];
  include?: string[];
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportProgress {
  totalFiles: number;
  uploadedFiles: number;
  failedFiles: number;
  currentFile?: string;
  percentComplete: number;
}

export interface ExportResult {
  success: boolean;
  uploaded: number;
  failed: number;
  errors: string[];
  urls: string[];
}
