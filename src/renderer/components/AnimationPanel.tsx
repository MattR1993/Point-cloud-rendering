import type { EasingFunction, Keyframe } from '../../common/types';

interface AnimationPanelProps {
  keyframes: Keyframe[];
  onRemoveKeyframe: (keyframeId: string) => void;
  onDurationChange: (keyframeId: string, durationMs: number) => void;
  onEasingChange: (keyframeId: string, easing: EasingFunction) => void;
}

const easingOptions: EasingFunction[] = ['linear', 'ease-in-out', 'ease-out'];

export function AnimationPanel({ keyframes, onRemoveKeyframe, onDurationChange, onEasingChange }: AnimationPanelProps) {
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>Camera Path</h3>
      {keyframes.length === 0 ? (
        <p style={{ margin: 0, color: '#94a3b8' }}>Capture the current viewport camera to start a flythrough sequence.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {keyframes.map((keyframe, index) => (
            <div
              key={keyframe.id}
              style={{ border: '1px solid #1e293b', borderRadius: 10, padding: 10, background: '#111827' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <strong>{index + 1}. {keyframe.label}</strong>
                <button onClick={() => onRemoveKeyframe(keyframe.id)}>Remove</button>
              </div>
              <div style={{ marginTop: 10, display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Transition (ms)</span>
                  <input
                    type="number"
                    min={250}
                    step={250}
                    value={keyframe.durationMs}
                    onChange={(event) => onDurationChange(keyframe.id, Number(event.target.value))}
                  />
                </label>
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Easing</span>
                  <select value={keyframe.easing} onChange={(event) => onEasingChange(keyframe.id, event.target.value as EasingFunction)}>
                    {easingOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
