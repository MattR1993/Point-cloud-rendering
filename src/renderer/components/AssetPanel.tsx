import type { ImportedAsset } from '../../common/types';

interface AssetPanelProps {
  assets: ImportedAsset[];
  onToggleVisibility: (assetId: string) => void;
}

export function AssetPanel({ assets, onToggleVisibility }: AssetPanelProps) {
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>Scene Layers</h3>
      {assets.length === 0 ? (
        <p style={{ margin: 0, color: '#94a3b8' }}>Import OBJ, XYZ, or PTS data to populate the viewport.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {assets.map((asset) => (
            <div
              key={asset.id}
              style={{
                border: '1px solid #1e293b',
                borderRadius: 10,
                padding: 10,
                background: '#111827'
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                <input type="checkbox" checked={asset.visible} onChange={() => onToggleVisibility(asset.id)} />
                <span>{asset.name}</span>
              </label>
              <div style={{ marginTop: 8, display: 'grid', gap: 4, color: '#94a3b8', fontSize: 13 }}>
                <span>
                  {asset.kind} · {asset.format.toUpperCase()} · {asset.status === 'ready' ? 'renderable' : 'planned'}
                </span>
                {typeof asset.pointCount === 'number' && <span>{asset.pointCount.toLocaleString()} points</span>}
                {typeof asset.vertexCount === 'number' && <span>{asset.vertexCount.toLocaleString()} vertices</span>}
                {asset.warning && <span style={{ color: '#fbbf24' }}>{asset.warning}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
