import type { Bounds, ImportFilePayload, ImportedAsset, SupportedImportFormat, Vec3 } from '../../common/types';

const supportedFormats = new Set<SupportedImportFormat>(['las', 'e57', 'pts', 'xyz', 'obj', 'fbx', 'gltf', 'glb', 'dae']);

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createBounds(): Bounds {
  return {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  };
}

function includePoint(bounds: Bounds, point: Vec3): void {
  bounds.min.x = Math.min(bounds.min.x, point.x);
  bounds.min.y = Math.min(bounds.min.y, point.y);
  bounds.min.z = Math.min(bounds.min.z, point.z);
  bounds.max.x = Math.max(bounds.max.x, point.x);
  bounds.max.y = Math.max(bounds.max.y, point.y);
  bounds.max.z = Math.max(bounds.max.z, point.z);
}

function finalizeBounds(bounds: Bounds): Bounds | undefined {
  return Number.isFinite(bounds.min.x) ? bounds : undefined;
}

function getFormat(fileName: string): SupportedImportFormat | null {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension || !supportedFormats.has(extension as SupportedImportFormat)) {
    return null;
  }

  return extension as SupportedImportFormat;
}

function parseDelimitedPointStats(content: string): { pointCount: number; bounds?: Bounds } {
  const bounds = createBounds();
  let pointCount = 0;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      continue;
    }

    const parts = trimmed.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) {
      continue;
    }

    const point = {
      x: Number(parts[0]),
      y: Number(parts[1]),
      z: Number(parts[2])
    };

    if ([point.x, point.y, point.z].some(Number.isNaN)) {
      continue;
    }

    includePoint(bounds, point);
    pointCount += 1;
  }

  return { pointCount, bounds: finalizeBounds(bounds) };
}

function parseObjStats(content: string): { vertexCount: number; bounds?: Bounds } {
  const bounds = createBounds();
  let vertexCount = 0;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('v ')) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    const point = {
      x: Number(parts[1]),
      y: Number(parts[2]),
      z: Number(parts[3])
    };

    if ([point.x, point.y, point.z].some(Number.isNaN)) {
      continue;
    }

    includePoint(bounds, point);
    vertexCount += 1;
  }

  return { vertexCount, bounds: finalizeBounds(bounds) };
}

export function buildImportedAsset(file: ImportFilePayload): ImportedAsset {
  const format = getFormat(file.name);

  if (!format) {
    throw new Error(`Unsupported file type for ${file.name}`);
  }

  if (format === 'xyz' || format === 'pts') {
    const { pointCount, bounds } = parseDelimitedPointStats(file.content);
    return {
      id: createId('asset'),
      name: file.name,
      sourcePath: file.path,
      sourceText: file.content,
      kind: 'point-cloud',
      format,
      status: 'ready',
      visible: true,
      pointCount,
      bounds
    };
  }

  if (format === 'obj') {
    const { vertexCount, bounds } = parseObjStats(file.content);
    return {
      id: createId('asset'),
      name: file.name,
      sourcePath: file.path,
      sourceText: file.content,
      kind: 'model',
      format,
      status: 'ready',
      visible: true,
      vertexCount,
      bounds
    };
  }

  return {
    id: createId('asset'),
    name: file.name,
    sourcePath: file.path,
    kind: format === 'fbx' || format === 'dae' || format === 'gltf' || format === 'glb' ? 'model' : 'point-cloud',
    format,
    status: 'planned',
    visible: true,
    warning: `${format.toUpperCase()} import is listed in the roadmap but this starter build only parses OBJ, XYZ, and PTS files.`
  };
}
