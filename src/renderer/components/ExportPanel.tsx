import type { ClipPlaneState, ExportSettings, NavigationMode, VisualizationMode } from '../../common/types';

interface ExportPanelProps {
  navigationMode: NavigationMode;
  visualizationMode: VisualizationMode;
  clipPlane: ClipPlaneState;
  exportSettings: ExportSettings;
  backgroundColor: string;
  onNavigationModeChange: (mode: NavigationMode) => void;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
  onClipPlaneChange: (clipPlane: ClipPlaneState) => void;
  onBackgroundColorChange: (color: string) => void;
  onExportSettingsChange: (exportSettings: ExportSettings) => void;
}

export function ExportPanel({
  navigationMode,
  visualizationMode,
  clipPlane,
  exportSettings,
  backgroundColor,
  onNavigationModeChange,
  onVisualizationModeChange,
  onClipPlaneChange,
  onBackgroundColorChange,
  onExportSettingsChange
}: ExportPanelProps) {
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>Viewport & Export</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Navigation mode</span>
          <select value={navigationMode} onChange={(event) => onNavigationModeChange(event.target.value as NavigationMode)}>
            <option value="orbit">Orbit</option>
            <option value="fly">Fly</option>
            <option value="walk">Walk</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Visualization mode</span>
          <select value={visualizationMode} onChange={(event) => onVisualizationModeChange(event.target.value as VisualizationMode)}>
            <option value="surface">Surface</option>
            <option value="x-ray">X-ray</option>
            <option value="wireframe">Wireframe</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Background color</span>
          <input type="color" value={backgroundColor} onChange={(event) => onBackgroundColorChange(event.target.value)} />
        </label>
      </div>

      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12, display: 'grid', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={clipPlane.enabled}
            onChange={(event) => onClipPlaneChange({ ...clipPlane, enabled: event.target.checked })}
          />
          <span>Enable clipping plane</span>
        </label>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Axis</span>
            <select value={clipPlane.axis} onChange={(event) => onClipPlaneChange({ ...clipPlane, axis: event.target.value as ClipPlaneState['axis'] })}>
              <option value="x">X</option>
              <option value="y">Y</option>
              <option value="z">Z</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Offset</span>
            <input
              type="number"
              step={0.5}
              value={clipPlane.offset}
              onChange={(event) => onClipPlaneChange({ ...clipPlane, offset: Number(event.target.value) })}
            />
          </label>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12, display: 'grid', gap: 8 }}>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Format</span>
            <select
              value={exportSettings.format}
              onChange={(event) => onExportSettingsChange({ ...exportSettings, format: event.target.value as ExportSettings['format'] })}
            >
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>FPS</span>
            <input
              type="number"
              min={1}
              max={120}
              value={exportSettings.fps}
              onChange={(event) => onExportSettingsChange({ ...exportSettings, fps: Number(event.target.value) })}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Width</span>
            <input
              type="number"
              min={320}
              value={exportSettings.width}
              onChange={(event) => onExportSettingsChange({ ...exportSettings, width: Number(event.target.value) })}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Height</span>
            <input
              type="number"
              min={240}
              value={exportSettings.height}
              onChange={(event) => onExportSettingsChange({ ...exportSettings, height: Number(event.target.value) })}
            />
          </label>
        </div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Watermark text</span>
          <input
            type="text"
            value={exportSettings.watermarkText}
            onChange={(event) => onExportSettingsChange({ ...exportSettings, watermarkText: event.target.value })}
            placeholder="Optional export watermark"
          />
        </label>
      </div>
    </section>
  );
}
