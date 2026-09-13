import type { ExportVideoRequest, ImportFilePayload, ProjectState } from '../common/types';

declare global {
  interface Window {
    electronAPI: {
      openImportFiles: () => Promise<ImportFilePayload[]>;
      saveProject: (project: ProjectState) => Promise<{ path: string } | null>;
      loadProject: () => Promise<{ path: string; project: ProjectState } | null>;
      readTextFile: (filePath: string) => Promise<string>;
      selectExportPath: (projectName: string, format: 'mp4' | 'webm') => Promise<string | null>;
      exportVideo: (request: ExportVideoRequest) => Promise<{ outputPath: string }>;
    };
  }
}

export {};
