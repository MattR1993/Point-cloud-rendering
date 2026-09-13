import { useMemo, useRef, useState } from 'react';
import type { EasingFunction, Keyframe, ProjectState } from '../common/types';
import { AssetPanel } from './components/AssetPanel';
import { AnimationPanel } from './components/AnimationPanel';
import { ExportPanel } from './components/ExportPanel';
import { Viewport3D, type ViewportHandle } from './scenes/Viewport3D';
import { buildImportedAsset } from './utils/importers';
import { initialProjectState } from './utils/projectState';

interface HistoryState {
  past: ProjectState[];
  present: ProjectState;
  future: ProjectState[];
}

function cloneProject(project: ProjectState): ProjectState {
  return JSON.parse(JSON.stringify(project)) as ProjectState;
}

function createKeyframe(index: number, keyframe: Keyframe): Keyframe {
  return {
    ...keyframe,
    label: `Keyframe ${index + 1}`
  };
}

export function App() {
  const viewportRef = useRef<ViewportHandle | null>(null);
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: cloneProject(initialProjectState),
    future: []
  });
  const [status, setStatus] = useState('Ready to build a flythrough scene.');
  const [busy, setBusy] = useState(false);

  const project = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const timelineDuration = useMemo(
    () => project.keyframes.slice(0, -1).reduce((total, keyframe) => total + Math.max(250, keyframe.durationMs), 0),
    [project.keyframes]
  );

  const updateProject = (updater: (current: ProjectState) => ProjectState, nextStatus?: string) => {
    setHistory((currentHistory) => {
      const nextProject = updater(cloneProject(currentHistory.present));
      return {
        past: [...currentHistory.past, cloneProject(currentHistory.present)],
        present: nextProject,
        future: []
      };
    });
    if (nextStatus) {
      setStatus(nextStatus);
    }
  };

  const replaceProject = (nextProject: ProjectState, nextStatus: string) => {
    setHistory({
      past: [],
      present: cloneProject(nextProject),
      future: []
    });
    setStatus(nextStatus);
  };

  const undo = () => {
    setHistory((currentHistory) => {
      if (currentHistory.past.length === 0) {
        return currentHistory;
      }
      const previous = currentHistory.past[currentHistory.past.length - 1];
      return {
        past: currentHistory.past.slice(0, -1),
        present: cloneProject(previous),
        future: [cloneProject(currentHistory.present), ...currentHistory.future]
      };
    });
    setStatus('Undid the last project edit.');
  };

  const redo = () => {
    setHistory((currentHistory) => {
      if (currentHistory.future.length === 0) {
        return currentHistory;
      }
      const [next, ...remaining] = currentHistory.future;
      return {
        past: [...currentHistory.past, cloneProject(currentHistory.present)],
        present: cloneProject(next),
        future: remaining
      };
    });
    setStatus('Reapplied the last undone edit.');
  };

  const importFiles = async () => {
    setBusy(true);
    try {
      const imported = await window.electronAPI.openImportFiles();
      if (imported.length === 0) {
        setStatus('Import canceled.');
        return;
      }

      const assets = imported.map(buildImportedAsset);
      const warnings = assets.flatMap((asset) => (asset.warning ? [asset.warning] : []));

      updateProject(
        (current) => ({
          ...current,
          assets: [...current.assets, ...assets],
          name: current.assets.length === 0 ? 'Imported flythrough project' : current.name
        }),
        warnings.length > 0
          ? `Imported ${assets.length} asset(s). ${warnings.join(' ')}`
          : `Imported ${assets.length} asset(s) into the scene.`
      );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addCurrentKeyframe = () => {
    if (!viewportRef.current) {
      return;
    }

    const snapshot = viewportRef.current.getCameraSnapshot();
    updateProject(
      (current) => ({
        ...current,
        keyframes: [
          ...current.keyframes,
          createKeyframe(current.keyframes.length, {
            id: crypto.randomUUID(),
            label: 'Keyframe',
            durationMs: 3000,
            easing: 'ease-in-out',
            camera: snapshot
          })
        ]
      }),
      'Added a camera keyframe from the current view.'
    );
  };

  const previewAnimation = async () => {
    if (!viewportRef.current || project.keyframes.length < 2) {
      setStatus('Add at least two keyframes before previewing animation.');
      return;
    }

    setBusy(true);
    setStatus('Previewing flythrough path.');
    try {
      await viewportRef.current.playKeyframes(project.keyframes);
      setStatus('Flythrough preview complete.');
    } finally {
      setBusy(false);
    }
  };

  const saveProject = async () => {
    setBusy(true);
    try {
      const saved = await window.electronAPI.saveProject(project);
      setStatus(saved ? `Project saved to ${saved.path}.` : 'Save canceled.');
    } catch (error) {
      setStatus(`Save failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const loadProject = async () => {
    setBusy(true);
    try {
      const loaded = await window.electronAPI.loadProject();
      if (!loaded) {
        setStatus('Open project canceled.');
        return;
      }
      replaceProject(loaded.project, `Loaded project from ${loaded.path}.`);
    } finally {
      setBusy(false);
    }
  };

  const exportVideo = async () => {
    if (!viewportRef.current || project.keyframes.length < 2) {
      setStatus('Create at least two keyframes before exporting a video.');
      return;
    }

    setBusy(true);
    try {
      const outputPath = await window.electronAPI.selectExportPath(project.name, project.exportSettings.format);
      if (!outputPath) {
        setStatus('Export canceled.');
        return;
      }

      setStatus('Rendering animation frames for FFmpeg export.');
      const frames = await viewportRef.current.captureFrames(project.keyframes, {
        width: project.exportSettings.width,
        height: project.exportSettings.height,
        fps: project.exportSettings.fps
      });

      await window.electronAPI.exportVideo({
        frames,
        options: {
          ...project.exportSettings,
          outputPath,
          backgroundColor: project.backgroundColor
        }
      });
      setStatus(`Video export complete: ${outputPath}`);
    } catch (error) {
      setStatus(`Export failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        height: '100vh',
        background: '#020617',
        color: '#e2e8f0'
      }}
    >
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid #1e293b',
          background: '#0f172a'
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Point Cloud Rendering</h1>
          <p style={{ margin: '4px 0 0', color: '#94a3b8' }}>
            Desktop flythrough editor with Three.js preview, project persistence, and FFmpeg export.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button onClick={importFiles} disabled={busy}>Import assets</button>
          <button onClick={addCurrentKeyframe} disabled={busy}>Add keyframe</button>
          <button onClick={previewAnimation} disabled={busy}>Preview path</button>
          <button onClick={saveProject} disabled={busy}>Save project</button>
          <button onClick={loadProject} disabled={busy}>Load project</button>
          <button onClick={exportVideo} disabled={busy}>Export video</button>
          <button onClick={undo} disabled={!canUndo || busy}>Undo</button>
          <button onClick={redo} disabled={!canRedo || busy}>Redo</button>
        </div>
      </header>

      <main style={{ display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', minHeight: 0 }}>
        <aside
          style={{
            borderRight: '1px solid #1e293b',
            background: '#0f172a',
            padding: 16,
            overflow: 'auto',
            display: 'grid',
            gap: 20,
            alignContent: 'start'
          }}
        >
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Project name</span>
            <input
              type="text"
              value={project.name}
              onChange={(event) => updateProject((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <AssetPanel
            assets={project.assets}
            onToggleVisibility={(assetId) =>
              updateProject((current) => ({
                ...current,
                assets: current.assets.map((asset) =>
                  asset.id === assetId ? { ...asset, visible: !asset.visible } : asset
                )
              }))
            }
          />
          <AnimationPanel
            keyframes={project.keyframes}
            onRemoveKeyframe={(keyframeId) =>
              updateProject((current) => ({
                ...current,
                keyframes: current.keyframes
                  .filter((keyframe) => keyframe.id !== keyframeId)
                  .map((keyframe, index) => createKeyframe(index, keyframe))
              }))
            }
            onDurationChange={(keyframeId, durationMs) =>
              updateProject((current) => ({
                ...current,
                keyframes: current.keyframes.map((keyframe) =>
                  keyframe.id === keyframeId ? { ...keyframe, durationMs: Math.max(250, durationMs) } : keyframe
                )
              }))
            }
            onEasingChange={(keyframeId, easing: EasingFunction) =>
              updateProject((current) => ({
                ...current,
                keyframes: current.keyframes.map((keyframe) =>
                  keyframe.id === keyframeId ? { ...keyframe, easing } : keyframe
                )
              }))
            }
          />
          <ExportPanel
            navigationMode={project.navigationMode}
            visualizationMode={project.visualizationMode}
            clipPlane={project.clipPlane}
            exportSettings={project.exportSettings}
            backgroundColor={project.backgroundColor}
            onNavigationModeChange={(navigationMode) =>
              updateProject((current) => ({ ...current, navigationMode }), `Switched to ${navigationMode} navigation.`)
            }
            onVisualizationModeChange={(visualizationMode) =>
              updateProject((current) => ({ ...current, visualizationMode }), `Switched to ${visualizationMode} rendering.`)
            }
            onClipPlaneChange={(clipPlane) =>
              updateProject((current) => ({ ...current, clipPlane }), 'Updated clipping plane settings.')
            }
            onBackgroundColorChange={(backgroundColor) =>
              updateProject((current) => ({
                ...current,
                backgroundColor,
                exportSettings: { ...current.exportSettings, backgroundColor }
              }))
            }
            onExportSettingsChange={(exportSettings) => updateProject((current) => ({ ...current, exportSettings }))}
          />
        </aside>

        <section style={{ display: 'grid', gridTemplateRows: '1fr auto', minWidth: 0, minHeight: 0, gap: 12, padding: 16 }}>
          <div style={{ minHeight: 0, background: '#0f172a', borderRadius: 18, padding: 12 }}>
            <Viewport3D
              ref={viewportRef}
              assets={project.assets}
              navigationMode={project.navigationMode}
              visualizationMode={project.visualizationMode}
              clipPlane={project.clipPlane}
              backgroundColor={project.backgroundColor}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              background: '#0f172a',
              borderRadius: 18,
              padding: 16,
              border: '1px solid #1e293b'
            }}
          >
            <div>
              <strong>Assets</strong>
              <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>{project.assets.length} loaded layer(s)</p>
            </div>
            <div>
              <strong>Animation</strong>
              <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
                {project.keyframes.length} keyframes · {(timelineDuration / 1000).toFixed(1)}s total
              </p>
            </div>
            <div>
              <strong>Export</strong>
              <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
                {project.exportSettings.width}×{project.exportSettings.height} @ {project.exportSettings.fps}fps
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer
        style={{
          padding: '12px 20px',
          borderTop: '1px solid #1e293b',
          background: '#0f172a',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          color: '#cbd5e1'
        }}
      >
        <span>{status}</span>
        <span>{busy ? 'Working…' : 'Idle'}</span>
      </footer>
    </div>
  );
}
