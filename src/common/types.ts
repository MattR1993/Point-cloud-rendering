export type SupportedImportFormat =
  | 'las'
  | 'e57'
  | 'pts'
  | 'xyz'
  | 'obj'
  | 'fbx'
  | 'gltf'
  | 'glb'
  | 'dae';

export type AssetKind = 'point-cloud' | 'model';
export type AssetStatus = 'ready' | 'planned';
export type NavigationMode = 'orbit' | 'fly' | 'walk';
export type VisualizationMode = 'surface' | 'x-ray' | 'wireframe';
export type EasingFunction = 'linear' | 'ease-in-out' | 'ease-out';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export interface ImportedAsset {
  id: string;
  name: string;
  sourcePath?: string;
  sourceText?: string;
  kind: AssetKind;
  format: SupportedImportFormat;
  status: AssetStatus;
  visible: boolean;
  pointCount?: number;
  vertexCount?: number;
  bounds?: Bounds;
  warning?: string;
}

export interface CameraSnapshot {
  position: Vec3;
  target: Vec3;
}

export interface Keyframe {
  id: string;
  label: string;
  durationMs: number;
  easing: EasingFunction;
  camera: CameraSnapshot;
}

export interface ClipPlaneState {
  enabled: boolean;
  axis: 'x' | 'y' | 'z';
  offset: number;
}

export interface ExportSettings {
  format: 'mp4' | 'webm';
  width: number;
  height: number;
  fps: number;
  backgroundColor: string;
  watermarkText: string;
}

export interface ProjectState {
  version: number;
  name: string;
  navigationMode: NavigationMode;
  visualizationMode: VisualizationMode;
  backgroundColor: string;
  clipPlane: ClipPlaneState;
  exportSettings: ExportSettings;
  assets: ImportedAsset[];
  keyframes: Keyframe[];
}

export interface ImportFilePayload {
  name: string;
  path: string;
  content: string;
}

export interface ExportVideoRequest {
  frames: string[];
  options: ExportSettings & { outputPath: string };
}
