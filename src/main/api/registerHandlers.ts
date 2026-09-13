import { dialog, ipcMain } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ExportVideoRequest, ProjectState } from '../../common/types';

const projectFilter = [{ name: 'Point Cloud Rendering Project', extensions: ['json'] }];
const importFilters = [
  {
    name: 'Initial starter import formats',
    extensions: ['pts', 'xyz', 'obj']
  }
];
const textImportExtensions = new Set(['.pts', '.xyz', '.obj']);

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'flythrough';
}

function decodeFrame(frameDataUrl: string): Buffer {
  return Buffer.from(frameDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
}

function escapeDrawText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

async function encodeVideo(request: ExportVideoRequest): Promise<void> {
  const tempDir = path.join(tmpdir(), `point-cloud-rendering-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    await Promise.all(
      request.frames.map((frame, index) => {
        const fileName = `frame-${String(index).padStart(5, '0')}.png`;
        return writeFile(path.join(tempDir, fileName), decodeFrame(frame));
      })
    );

    const codecArgs =
      request.options.format === 'webm'
        ? ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p']
        : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p'];

    const filterArgs = request.options.watermarkText
      ? [
          '-vf',
          `drawtext=text='${escapeDrawText(request.options.watermarkText)}':fontcolor=white:fontsize=26:box=1:boxcolor=black@0.45:boxborderw=8:x=w-tw-28:y=h-th-28`
        ]
      : [];

    const args = [
      '-y',
      '-framerate',
      String(request.options.fps),
      '-i',
      path.join(tempDir, 'frame-%05d.png'),
      ...filterArgs,
      ...codecArgs,
      request.options.outputPath
    ];

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';

      ffmpeg.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      ffmpeg.on('error', (error) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new Error('FFmpeg is not installed or is not available on PATH.'));
          return;
        }

        reject(error);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr || `FFmpeg exited with code ${code}`));
      });
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function registerHandlers(): void {
  ipcMain.handle('dialog:openImportFiles', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import point cloud or 3D model files',
      properties: ['openFile', 'multiSelections'],
      filters: importFilters
    });

    if (result.canceled) {
      return [];
    }

    return Promise.all(
      result.filePaths.map(async (filePath) => {
        const extension = path.extname(filePath).toLowerCase();
        return {
          name: path.basename(filePath),
          path: filePath,
          content: textImportExtensions.has(extension) ? await readFile(filePath, 'utf8') : ''
        };
      })
    );
  });

  ipcMain.handle('project:save', async (_, project: ProjectState) => {
    const result = await dialog.showSaveDialog({
      title: 'Save project',
      defaultPath: `${sanitizeFileName(project.name)}.pcr.json`,
      filters: projectFilter
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    await writeFile(result.filePath, JSON.stringify(project, null, 2), 'utf8');
    return { path: result.filePath };
  });

  ipcMain.handle('project:load', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open project',
      properties: ['openFile'],
      filters: projectFilter
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const project = JSON.parse(await readFile(result.filePaths[0], 'utf8')) as ProjectState;
    return { path: result.filePaths[0], project };
  });

  ipcMain.handle('file:readText', async (_, filePath: string) => readFile(filePath, 'utf8'));

  ipcMain.handle('dialog:selectExportPath', async (_, projectName: string, format: 'mp4' | 'webm') => {
    const result = await dialog.showSaveDialog({
      title: 'Choose export file',
      defaultPath: `${sanitizeFileName(projectName)}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }]
    });

    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('video:export', async (_, request: ExportVideoRequest) => {
    await encodeVideo(request);
    return { outputPath: request.options.outputPath };
  });
}
