import { contextBridge, ipcRenderer } from 'electron';
import type { ExportVideoRequest, ImportFilePayload, ProjectState } from '../common/types';

const electronAPI = {
  openImportFiles: (): Promise<ImportFilePayload[]> => ipcRenderer.invoke('dialog:openImportFiles'),
  saveProject: (project: ProjectState): Promise<{ path: string } | null> => ipcRenderer.invoke('project:save', project),
  loadProject: (): Promise<{ path: string; project: ProjectState } | null> => ipcRenderer.invoke('project:load'),
  readTextFile: (filePath: string): Promise<string> => ipcRenderer.invoke('file:readText', filePath),
  selectExportPath: (projectName: string, format: 'mp4' | 'webm'): Promise<string | null> =>
    ipcRenderer.invoke('dialog:selectExportPath', projectName, format),
  exportVideo: (request: ExportVideoRequest): Promise<{ outputPath: string }> => ipcRenderer.invoke('video:export', request)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
