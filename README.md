# Point Cloud Rendering

Point Cloud Rendering is a desktop Electron application for building flythrough videos from point cloud and 3D model data. This starter implementation focuses on an end-to-end workflow with:

- Electron + React + TypeScript desktop scaffolding
- Three.js powered 3D viewport
- OBJ, XYZ, and PTS import for initial visualization
- Orbit, fly, and walk navigation modes
- Keyframe-based camera path creation and preview
- Scene clipping plane controls and visualization modes
- Project save/load with undo and redo history
- FFmpeg-backed MP4/WebM export pipeline

## Getting started

```bash
npm install
npm run dev
```

## Available scripts

- `npm run dev` starts the TypeScript compiler, webpack dev server, and Electron shell together.
- `npm run build` builds the Electron main process and renderer bundle into `dist/`.
- `npm run typecheck` runs TypeScript checks for both the main and renderer code.

## Current import support

The app is scaffolded for LAS, E57, PTS, XYZ, OBJ, FBX, GLTF/GLB, and DAE workflows. The initial parser implementations are intentionally focused on:

- `OBJ` for polygonal models
- `XYZ` and `PTS` for point clouds

Additional listed formats appear in the import dialog so the desktop workflow and roadmap are visible, and unsupported formats are clearly surfaced in the UI as planned work.

## Export notes

Video export shells out to `ffmpeg`, so FFmpeg must be installed and available on your system `PATH` for MP4 or WebM rendering.
