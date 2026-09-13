import type { ProjectState } from '../../common/types';

export const initialProjectState: ProjectState = {
  version: 1,
  name: 'Untitled flythrough',
  navigationMode: 'orbit',
  visualizationMode: 'surface',
  backgroundColor: '#0b1120',
  clipPlane: {
    enabled: false,
    axis: 'z',
    offset: 0
  },
  exportSettings: {
    format: 'mp4',
    width: 1920,
    height: 1080,
    fps: 30,
    backgroundColor: '#0b1120',
    watermarkText: ''
  },
  assets: [],
  keyframes: []
};
