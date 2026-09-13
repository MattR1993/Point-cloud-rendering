import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { CameraSnapshot, ClipPlaneState, ImportedAsset, Keyframe, NavigationMode, VisualizationMode } from '../../common/types';
import { applyEasing } from '../utils/easing';

interface Viewport3DProps {
  assets: ImportedAsset[];
  navigationMode: NavigationMode;
  visualizationMode: VisualizationMode;
  clipPlane: ClipPlaneState;
  backgroundColor: string;
}

export interface ViewportHandle {
  getCameraSnapshot: () => CameraSnapshot;
  playKeyframes: (keyframes: Keyframe[]) => Promise<void>;
  captureFrames: (keyframes: Keyframe[], options: { width: number; height: number; fps: number }) => Promise<string[]>;
}

function lerp(start: number, end: number, value: number): number {
  return start + (end - start) * value;
}

function interpolateVector(start: THREE.Vector3, end: THREE.Vector3, value: number): THREE.Vector3 {
  return new THREE.Vector3(lerp(start.x, end.x, value), lerp(start.y, end.y, value), lerp(start.z, end.z, value));
}

function totalDuration(keyframes: Keyframe[]): number {
  return keyframes.slice(0, -1).reduce((total, keyframe) => total + Math.max(250, keyframe.durationMs), 0);
}

function sampleTimeline(keyframes: Keyframe[], elapsedMs: number): CameraSnapshot {
  if (keyframes.length === 0) {
    return {
      position: { x: 0, y: 0, z: 10 },
      target: { x: 0, y: 0, z: 0 }
    };
  }

  if (keyframes.length === 1) {
    return keyframes[0].camera;
  }

  let remaining = elapsedMs;

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index];
    const next = keyframes[index + 1];
    const segmentDuration = Math.max(250, current.durationMs);

    if (remaining <= segmentDuration || index === keyframes.length - 2) {
      const progress = applyEasing(current.easing, Math.min(1, remaining / segmentDuration));
      const position = interpolateVector(
        new THREE.Vector3(current.camera.position.x, current.camera.position.y, current.camera.position.z),
        new THREE.Vector3(next.camera.position.x, next.camera.position.y, next.camera.position.z),
        progress
      );
      const target = interpolateVector(
        new THREE.Vector3(current.camera.target.x, current.camera.target.y, current.camera.target.z),
        new THREE.Vector3(next.camera.target.x, next.camera.target.y, next.camera.target.z),
        progress
      );

      return {
        position: { x: position.x, y: position.y, z: position.z },
        target: { x: target.x, y: target.y, z: target.z }
      };
    }

    remaining -= segmentDuration;
  }

  return keyframes[keyframes.length - 1].camera;
}

function createClipPlanes(state: ClipPlaneState): THREE.Plane[] {
  if (!state.enabled) {
    return [];
  }

  const normal =
    state.axis === 'x'
      ? new THREE.Vector3(-1, 0, 0)
      : state.axis === 'y'
        ? new THREE.Vector3(0, -1, 0)
        : new THREE.Vector3(0, 0, -1);

  return [new THREE.Plane(normal, state.offset)];
}

function parsePointCloud(text: string): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
  const positions: number[] = [];
  const colors: number[] = [];
  let hasColor = false;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      continue;
    }

    const parts = trimmed.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) {
      continue;
    }

    const xyz = parts.slice(0, 3).map(Number);
    if (xyz.some(Number.isNaN)) {
      continue;
    }

    positions.push(xyz[0], xyz[1], xyz[2]);

    if (parts.length >= 6) {
      const rgb = parts.slice(3, 6).map(Number);
      if (!rgb.some(Number.isNaN)) {
        colors.push(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
        hasColor = true;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (hasColor && colors.length === positions.length) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geometry.computeBoundingSphere();

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: hasColor,
      color: hasColor ? undefined : '#93c5fd',
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true
    })
  );
}

function styleMaterial(material: THREE.Material, mode: VisualizationMode, clippingPlanes: THREE.Plane[]): void {
  const typed = material as THREE.MeshStandardMaterial & THREE.PointsMaterial;
  typed.clippingPlanes = clippingPlanes;
  typed.needsUpdate = true;

  if ('wireframe' in typed) {
    typed.wireframe = mode === 'wireframe';
  }

  typed.transparent = mode === 'x-ray';
  typed.opacity = mode === 'x-ray' ? 0.35 : 1;

  if ('size' in typed) {
    typed.size = mode === 'wireframe' ? 0.04 : mode === 'x-ray' ? 0.05 : 0.08;
    typed.opacity = mode === 'x-ray' ? 0.35 : 0.95;
    typed.transparent = true;
  }
}

function buildRenderableAsset(asset: ImportedAsset, visualizationMode: VisualizationMode, clippingPlanes: THREE.Plane[]): THREE.Object3D | null {
  if (!asset.visible || asset.status !== 'ready' || !asset.sourceText) {
    return null;
  }

  if (asset.format === 'xyz' || asset.format === 'pts') {
    const points = parsePointCloud(asset.sourceText);
    points.name = asset.name;
    styleMaterial(points.material, visualizationMode, clippingPlanes);
    return points;
  }

  if (asset.format === 'obj') {
    const object = new OBJLoader().parse(asset.sourceText);
    object.name = asset.name;
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          styleMaterial(material, visualizationMode, clippingPlanes);
        }
      }
    });
    return object;
  }

  return null;
}

export const Viewport3D = forwardRef<ViewportHandle, Viewport3DProps>(function Viewport3D(
  { assets, navigationMode, visualizationMode, clipPlane, backgroundColor },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameLoopRef = useRef<number | null>(null);
  const contentGroupRef = useRef(new THREE.Group());
  const currentTargetRef = useRef(new THREE.Vector3());
  const pressedKeysRef = useRef(new Set<string>());
  const pointerStateRef = useRef({ active: false, x: 0, y: 0 });
  const navigationModeRef = useRef<NavigationMode>(navigationMode);
  const clippingPlanes = useMemo(() => createClipPlanes(clipPlane), [clipPlane]);

  useEffect(() => {
    navigationModeRef.current = navigationMode;
  }, [navigationMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, Math.max(container.clientWidth / Math.max(container.clientHeight, 1), 1), 0.1, 5000);
    camera.position.set(12, 10, 18);
    camera.rotation.order = 'YXZ';
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.copy(currentTargetRef.current);
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight('#ffffff', 0.9));
    const directional = new THREE.DirectionalLight('#ffffff', 1.25);
    directional.position.set(20, 30, 15);
    scene.add(directional);
    scene.add(new THREE.GridHelper(200, 50, '#334155', '#1e293b'));
    scene.add(new THREE.AxesHelper(6));
    scene.add(contentGroupRef.current);

    let lastFrame = performance.now();
    const tick = () => {
      const now = performance.now();
      const delta = (now - lastFrame) / 1000;
      lastFrame = now;

      const activeNavigationMode = navigationModeRef.current;
      const activeCamera = cameraRef.current;
      if (activeCamera && activeNavigationMode !== 'orbit') {
        const forward = new THREE.Vector3();
        activeCamera.getWorldDirection(forward);
        if (activeNavigationMode === 'walk') {
          forward.y = 0;
          forward.normalize();
        }
        const right = new THREE.Vector3().crossVectors(forward, activeCamera.up).normalize().multiplyScalar(-1);
        const movement = new THREE.Vector3();

        if (pressedKeysRef.current.has('w')) movement.add(forward);
        if (pressedKeysRef.current.has('s')) movement.sub(forward);
        if (pressedKeysRef.current.has('a')) movement.sub(right);
        if (pressedKeysRef.current.has('d')) movement.add(right);
        if (activeNavigationMode === 'fly') {
          if (pressedKeysRef.current.has('q')) movement.y -= 1;
          if (pressedKeysRef.current.has('e')) movement.y += 1;
        }

        if (movement.lengthSq() > 0) {
          const speed = pressedKeysRef.current.has('shift') ? 20 : 8;
          movement.normalize().multiplyScalar(speed * delta);
          activeCamera.position.add(movement);
          currentTargetRef.current.add(movement);
        }
      }

      controls.enabled = activeNavigationMode === 'orbit';
      if (controls.enabled) {
        controls.update();
        currentTargetRef.current.copy(controls.target);
      }

      renderer.render(scene, camera);
      frameLoopRef.current = window.requestAnimationFrame(tick);
    };

    const resize = () => {
      const nextContainer = containerRef.current;
      const nextRenderer = rendererRef.current;
      const nextCamera = cameraRef.current;
      if (!nextContainer || !nextRenderer || !nextCamera) {
        return;
      }

      nextRenderer.setSize(nextContainer.clientWidth, nextContainer.clientHeight);
      nextCamera.aspect = nextContainer.clientWidth / Math.max(nextContainer.clientHeight, 1);
      nextCamera.updateProjectionMatrix();
    };

    const onKeyDown = (event: KeyboardEvent) => pressedKeysRef.current.add(event.key.toLowerCase());
    const onKeyUp = (event: KeyboardEvent) => pressedKeysRef.current.delete(event.key.toLowerCase());
    const onPointerDown = (event: PointerEvent) => {
      if (navigationModeRef.current === 'orbit') {
        return;
      }
      pointerStateRef.current = { active: true, x: event.clientX, y: event.clientY };
    };
    const onPointerMove = (event: PointerEvent) => {
      const activeCamera = cameraRef.current;
      if (!pointerStateRef.current.active || !activeCamera || navigationModeRef.current === 'orbit') {
        return;
      }

      const deltaX = event.clientX - pointerStateRef.current.x;
      const deltaY = event.clientY - pointerStateRef.current.y;
      pointerStateRef.current = { active: true, x: event.clientX, y: event.clientY };

      activeCamera.rotation.y -= deltaX * 0.003;
      activeCamera.rotation.x = THREE.MathUtils.clamp(activeCamera.rotation.x - deltaY * 0.003, -Math.PI / 2, Math.PI / 2);
      const direction = new THREE.Vector3();
      activeCamera.getWorldDirection(direction);
      currentTargetRef.current.copy(activeCamera.position).add(direction.multiplyScalar(10));
    };
    const onPointerUp = () => {
      pointerStateRef.current.active = false;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    resize();
    tick();

    return () => {
      if (frameLoopRef.current !== null) {
        window.cancelAnimationFrame(frameLoopRef.current);
      }
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(backgroundColor);
    }
  }, [backgroundColor]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    contentGroupRef.current.clear();
    const bounds = new THREE.Box3();

    for (const asset of assets) {
      const renderable = buildRenderableAsset(asset, visualizationMode, clippingPlanes);
      if (!renderable) {
        continue;
      }
      contentGroupRef.current.add(renderable);
      bounds.expandByObject(renderable);
    }

    if (!bounds.isEmpty()) {
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3()).length() || 10;
      currentTargetRef.current.copy(center);
      controls.target.copy(center);
      camera.position.copy(center.clone().add(new THREE.Vector3(size * 0.9, size * 0.6, size * 0.9)));
      camera.lookAt(center);
    }
  }, [assets, clippingPlanes, visualizationMode]);

  useImperativeHandle(ref, () => ({
    getCameraSnapshot: () => {
      const camera = cameraRef.current;
      if (!camera) {
        throw new Error('Viewport camera is not ready.');
      }

      return {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: currentTargetRef.current.x, y: currentTargetRef.current.y, z: currentTargetRef.current.z }
      };
    },
    playKeyframes: async (keyframes) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || keyframes.length < 2) {
        return;
      }

      const duration = totalDuration(keyframes);
      const startedAt = performance.now();

      await new Promise<void>((resolve) => {
        const animate = (now: number) => {
          const elapsed = now - startedAt;
          const sample = sampleTimeline(keyframes, elapsed);
          camera.position.set(sample.position.x, sample.position.y, sample.position.z);
          currentTargetRef.current.set(sample.target.x, sample.target.y, sample.target.z);
          camera.lookAt(currentTargetRef.current);
          if (controls) {
            controls.target.copy(currentTargetRef.current);
          }

          if (elapsed >= duration) {
            resolve();
            return;
          }

          window.requestAnimationFrame(animate);
        };

        window.requestAnimationFrame(animate);
      });
    },
    captureFrames: async (keyframes, options) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      if (!camera || !renderer || !scene || keyframes.length < 2) {
        return [];
      }

      const originalSize = renderer.getSize(new THREE.Vector2());
      const originalPixelRatio = renderer.getPixelRatio();
      const originalPosition = camera.position.clone();
      const originalTarget = currentTargetRef.current.clone();
      const duration = totalDuration(keyframes);
      const frameCount = Math.max(2, Math.ceil((duration / 1000) * options.fps) + 1);
      const frames: string[] = [];

      renderer.setPixelRatio(1);
      renderer.setSize(options.width, options.height, false);
      camera.aspect = options.width / Math.max(options.height, 1);
      camera.updateProjectionMatrix();

      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const elapsed = (frameIndex / Math.max(frameCount - 1, 1)) * duration;
        const sample = sampleTimeline(keyframes, elapsed);
        camera.position.set(sample.position.x, sample.position.y, sample.position.z);
        currentTargetRef.current.set(sample.target.x, sample.target.y, sample.target.z);
        camera.lookAt(currentTargetRef.current);
        if (controls) {
          controls.target.copy(currentTargetRef.current);
        }
        renderer.render(scene, camera);
        frames.push(renderer.domElement.toDataURL('image/png'));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }

      renderer.setPixelRatio(originalPixelRatio);
      renderer.setSize(originalSize.x, originalSize.y, false);
      camera.aspect = originalSize.x / Math.max(originalSize.y, 1);
      camera.position.copy(originalPosition);
      currentTargetRef.current.copy(originalTarget);
      camera.lookAt(currentTargetRef.current);
      camera.updateProjectionMatrix();
      if (controls) {
        controls.target.copy(originalTarget);
      }

      return frames;
    }
  }));

  return <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden' }} />;
});
