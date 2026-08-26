'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import {
  BANC_MORPHOLOGY_MANIFEST_URL,
  cellByBancId,
  circuitActivityFor,
  contactsForCell,
  type MorphologyManifest,
} from '@/lib/fly-brain';
import {
  BANC_V888_CELLS,
  BANC_V888_EDGES,
  type EmbodiedMotorMap,
  type Laterality,
} from '@/lib/flylab';

interface FlyBrain3DProps {
  laterality: Laterality;
  driveActive: boolean;
  perturbation: 'activate' | 'silence';
  conditionLabel: string;
  timeMs: number;
  circuitId: string;
  motorMap?: EmbodiedMotorMap;
}

type CameraPreset = 'whole' | 'brain' | 'vnc';
type ViewerProvenance = 'measured' | 'derived' | 'connectome_inferred' | 'agent_hypothesized';

interface NeuronRenderRecord {
  line: THREE.LineSegments;
  lineMaterial: THREE.LineBasicMaterial;
  glow: THREE.Points;
  glowMaterial: THREE.PointsMaterial;
}

interface ShellRenderRecord {
  mesh: THREE.Mesh;
  material: THREE.MeshPhongMaterial;
  baseColor: THREE.ColorRepresentation;
}

interface SceneVisualState {
  circuitId: string;
  activeMdnIds: string[];
  highlightedLbl40Ids: string[];
  activeSchematicIds: string[];
  selectedId: string | null;
  hoveredId: string | null;
  shellVisible: boolean;
}

interface SceneApi {
  focusNeuron: (id: string) => void;
  applyVisualState: (state: SceneVisualState) => void;
}

const cells = [...BANC_V888_CELLS].sort((left, right) => {
  if (left.cell_type !== right.cell_type) return left.cell_type === 'MDN' ? -1 : 1;
  if (left.side !== right.side) return left.side === 'left' ? -1 : 1;
  return left.banc_888_id.localeCompare(right.banc_888_id);
});

const cameraPositions: Record<CameraPreset, { position: [number, number, number]; target: [number, number, number] }> = {
  whole: { position: [9.2, 1.2, 15.5], target: [0, 0, 0] },
  brain: { position: [7.2, 5.4, 10.2], target: [0, 4.25, 0] },
  vnc: { position: [6.6, -3.1, 9.4], target: [0, -3.45, 0] },
};

function compactId(id: string) {
  return `${id.slice(0, 7)}…${id.slice(-5)}`;
}

function ViewerProvenanceTag({ kind }: { kind: ViewerProvenance }) {
  const label = kind === 'measured' ? 'Measured' : kind === 'derived' ? 'Derived' : kind === 'connectome_inferred' ? 'Connectome inferred' : 'Agent hypothesis';
  return <b className={`brain-provenance ${kind}`}>{label}</b>;
}

function makeTextSprite(text: string, color: string, position: [number, number, number]) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '600 28px Inter, system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, 56);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.72 });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(...position);
  sprite.scale.set(2.7, 0.67, 1);
  sprite.userData.labelTexture = texture;
  return sprite;
}

export function FlyBrain3D({ laterality, driveActive, perturbation, conditionLabel, timeMs, circuitId, motorMap }: FlyBrain3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneApiRef = useRef<SceneApi | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [shellVisible, setShellVisible] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('whole');
  const activity = useMemo(() => circuitId === 'circuit_mdn_adult'
    ? circuitActivityFor(laterality, driveActive)
    : { activeMdnIds: [], highlightedLbl40Ids: [], highlightedEdges: [] }, [circuitId, laterality, driveActive]);
  const activeSchematicIds = useMemo(() => {
    if (circuitId !== 'circuit_gf_adult' || !driveActive) return [];
    const sidePrefixes = laterality === 'bilateral' || laterality === 'none' ? ['left', 'right'] : [laterality];
    return sidePrefixes.flatMap((side) => [`gf_${side}`, `gf_${side}_leg`, `gf_${side}_wing`]);
  }, [circuitId, driveActive, laterality]);
  const activeMdnSet = useMemo(() => new Set(activity.activeMdnIds), [activity.activeMdnIds]);
  const highlightedLbl40Set = useMemo(() => new Set(activity.highlightedLbl40Ids), [activity.highlightedLbl40Ids]);
  const selectedCell = selectedId ? cellByBancId(selectedId) : undefined;
  const targetModeLabel = perturbation === 'silence' ? 'suppression' : 'drive';

  const applyCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const view = cameraPositions[preset];
    camera.position.set(...view.position);
    controls.target.set(...view.target);
    controls.update();
  }, []);

  const selectNeuron = useCallback((id: string) => {
    setSelectedId((current) => current === id ? null : id);
    sceneApiRef.current?.focusNeuron(id);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let animationFrame = 0;
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const neuronRenders = new Map<string, NeuronRenderRecord>();
    const shellRenders = new Map<string, ShellRenderRecord>();

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x061013, 0.035);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    camera.position.set(...cameraPositions.whole.position);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x061013, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 4.2;
    controls.maxDistance = 28;
    controls.target.set(...cameraPositions.whole.target);
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0x9beee0, 0x071013, 1.55));
    const keyLight = new THREE.DirectionalLight(0xd9fff7, 1.3);
    keyLight.position.set(7, 10, 12);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xd49cff, 12, 28, 2);
    rimLight.position.set(-6, 2, -4);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(15, 15, 0x254246, 0x173035);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -2.5;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => { material.transparent = true; material.opacity = 0.24; });
    scene.add(grid);

    const shellGroup = new THREE.Group();
    scene.add(shellGroup);
    const sphereGeometry = new THREE.SphereGeometry(1, 36, 24);
    const cylinderGeometry = new THREE.CapsuleGeometry(0.34, 3.2, 8, 18);

    const addShell = (
      id: string,
      geometry: THREE.BufferGeometry,
      position: [number, number, number],
      scale: [number, number, number],
      color: THREE.ColorRepresentation,
      opacity = 0.075,
    ) => {
      const material = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        shininess: 80,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      shellGroup.add(mesh);
      shellRenders.set(id, { mesh, material, baseColor: color });
    };

    addShell('leftBrain', sphereGeometry, [-0.95, 4.65, 0], [1.62, 1.34, 1.28], 0x6ee7d2);
    addShell('rightBrain', sphereGeometry, [0.95, 4.65, 0], [1.62, 1.34, 1.28], 0x6ee7d2);
    addShell('leftOptic', sphereGeometry, [-2.35, 4.68, 0], [0.72, 0.92, 0.8], 0x74c7f5, 0.05);
    addShell('rightOptic', sphereGeometry, [2.35, 4.68, 0], [0.72, 0.92, 0.8], 0x74c7f5, 0.05);
    addShell('midline', sphereGeometry, [0, 4.2, 0.05], [0.78, 0.9, 0.82], 0xd49cff, 0.055);
    addShell('connective', cylinderGeometry, [0, 1.7, 0], [1, 1, 1], 0x6ee7d2, 0.06);
    addShell('vnc', sphereGeometry, [0, -3.45, 0.1], [1.3, 2.65, 1.02], 0x74c7f5, 0.065);
    addShell('leftT2', sphereGeometry, [-0.5, -3.35, 0.13], [0.62, 0.68, 0.56], 0x74c7f5, 0.05);
    addShell('rightT2', sphereGeometry, [0.5, -3.35, 0.13], [0.62, 0.68, 0.56], 0x74c7f5, 0.05);
    addShell('leftT3', sphereGeometry, [-0.52, -4.85, 0.13], [0.66, 0.72, 0.58], 0x6ee7d2, 0.055);
    addShell('rightT3', sphereGeometry, [0.52, -4.85, 0.13], [0.66, 0.72, 0.58], 0x6ee7d2, 0.055);

    const labels = [
      makeTextSprite('CENTRAL BRAIN · SCHEMATIC SHELL', '#819397', [0, 6.45, 0]),
      makeTextSprite('CERVICAL CONNECTIVE', '#6f8589', [0, 1.55, 1.15]),
      makeTextSprite('THORACIC VNC · SCHEMATIC SHELL', '#819397', [0, -6.55, 0]),
    ].filter((label): label is THREE.Sprite => Boolean(label));
    labels.forEach((label) => scene.add(label));

    const addSchematicPath = (id: string, points: Array<[number, number, number]>) => {
      const coordinates: number[] = [];
      points.slice(1).forEach((point, index) => coordinates.push(...points[index], ...point));
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(coordinates), 3));
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x6ee7d2, transparent: true, opacity: 0 });
      const line = new THREE.LineSegments(geometry, lineMaterial);
      line.userData.neuronId = id;
      line.renderOrder = 5;
      scene.add(line);
      const glowMaterial = new THREE.PointsMaterial({ color: 0xd49cff, size: 0.075, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const glow = new THREE.Points(geometry, glowMaterial);
      glow.renderOrder = 6;
      scene.add(glow);
      neuronRenders.set(id, { line, lineMaterial, glow, glowMaterial });
    };
    addSchematicPath('gf_left', [[-0.72, 5.15, 0], [-0.48, 3.3, 0], [-0.42, 0.6, 0], [-0.45, -2.55, 0]]);
    addSchematicPath('gf_right', [[0.72, 5.15, 0], [0.48, 3.3, 0], [0.42, 0.6, 0], [0.45, -2.55, 0]]);
    addSchematicPath('gf_left_leg', [[-0.45, -2.55, 0], [-0.62, -3.05, 0.05], [-0.98, -3.45, 0.1]]);
    addSchematicPath('gf_right_leg', [[0.45, -2.55, 0], [0.62, -3.05, 0.05], [0.98, -3.45, 0.1]]);
    addSchematicPath('gf_left_wing', [[-0.45, -2.55, 0], [-0.9, -2.95, 0.5], [-1.28, -3.25, 0.72]]);
    addSchematicPath('gf_right_wing', [[0.45, -2.55, 0], [0.9, -2.95, 0.5], [1.28, -3.25, 0.72]]);

    sceneApiRef.current = {
      focusNeuron: (id) => {
        const render = neuronRenders.get(id);
        if (!render) return;
        render.line.geometry.computeBoundingSphere();
        const sphere = render.line.geometry.boundingSphere;
        if (!sphere) return;
        controls.target.copy(sphere.center);
        camera.position.copy(sphere.center).add(new THREE.Vector3(5.4, 1.2, 8.2));
        controls.update();
      },
      applyVisualState: (state) => {
        const activeMdnIds = new Set(state.activeMdnIds);
        const highlightedLbl40Ids = new Set(state.highlightedLbl40Ids);
        const activeSchematicIds = new Set(state.activeSchematicIds);
        for (const [id, render] of neuronRenders) {
          const cell = cellByBancId(id);
          const activeMdn = activeMdnIds.has(id);
          const structuralTarget = highlightedLbl40Ids.has(id);
          const schematic = id.startsWith('gf_');
          const schematicVisible = schematic && state.circuitId === 'circuit_gf_adult';
          const pathVisible = schematic ? schematicVisible : state.circuitId === 'circuit_mdn_adult';
          const schematicActive = activeSchematicIds.has(id);
          render.line.visible = pathVisible;
          render.glow.visible = pathVisible;
          const selected = state.selectedId === id || state.hoveredId === id;
          const color = activeMdn || schematicActive ? 0xd49cff : structuralTarget || schematicVisible ? 0x6ee7d2 : selected ? 0xf2ffff : cell?.cell_type === 'MDN' ? 0x6a9696 : 0x6d86a6;
          render.lineMaterial.color.set(color);
          render.lineMaterial.opacity = schematic
            ? schematicVisible ? schematicActive ? 0.98 : 0.55 : 0
            : state.circuitId === 'circuit_mdn_adult' ? activeMdn ? 0.98 : structuralTarget ? 0.88 : selected ? 0.82 : 0.22 : 0.035;
          render.glowMaterial.color.set(color);
          render.glowMaterial.size = schematicActive ? 0.08 : activeMdn ? 0.055 : structuralTarget ? 0.047 : 0.04;
          const glowOpacity = schematicActive ? 0.62 : activeMdn ? 0.48 : structuralTarget ? 0.3 : selected ? 0.2 : 0;
          render.glow.userData.baseOpacity = glowOpacity;
          render.glowMaterial.opacity = glowOpacity;
        }

        const activeSides = new Set(state.activeMdnIds.map((id) => cellByBancId(id)?.side));
        if (state.circuitId === 'circuit_gf_adult') {
          if (state.activeSchematicIds.some((id) => id.includes('left'))) activeSides.add('left');
          if (state.activeSchematicIds.some((id) => id.includes('right'))) activeSides.add('right');
        }
        const targetSides = new Set(state.highlightedLbl40Ids.map((id) => cellByBancId(id)?.side));
        for (const [id, shell] of shellRenders) {
          const isBrainTarget = (id === 'leftBrain' && activeSides.has('left')) || (id === 'rightBrain' && activeSides.has('right'));
          const isT3Path = (id === 'leftT3' && targetSides.has('left')) || (id === 'rightT3' && targetSides.has('right'));
          const isGfPath = state.circuitId === 'circuit_gf_adult' && (id === 'connective' || id === 'vnc' || id === 'leftT2' || id === 'rightT2');
          shell.mesh.visible = state.shellVisible;
          shell.material.color.set(isBrainTarget ? 0xd49cff : isT3Path || isGfPath ? 0x6ee7d2 : shell.baseColor);
          shell.material.opacity = isBrainTarget ? 0.15 : isT3Path || isGfPath ? 0.17 : id.includes('Optic') ? 0.045 : 0.065;
        }
      },
    };

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0.1;
    const pointer = new THREE.Vector2();
    const findHit = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects([...neuronRenders.values()].filter((record) => record.line.visible).map((record) => record.line), false)[0]?.object.userData.neuronId as string | undefined;
    };
    const onPointerMove = (event: PointerEvent) => {
      const id = findHit(event) ?? null;
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      setHoveredId(id);
    };
    const onPointerLeave = () => setHoveredId(null);
    const onPointerClick = (event: PointerEvent) => {
      const id = findHit(event);
      if (id) selectNeuron(id);
    };
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('click', onPointerClick);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      controls.enableDamping = !reducedMotion;
    };
    motionQuery.addEventListener('change', onMotionChange);

    const loadMorphologies = async () => {
      try {
        const manifestResponse = await fetch(BANC_MORPHOLOGY_MANIFEST_URL);
        if (!manifestResponse.ok) throw new Error(`Morphology manifest returned ${manifestResponse.status}`);
        const manifest = await manifestResponse.json() as MorphologyManifest;
        const assets = await Promise.all(manifest.neurons.map(async (record) => {
          const response = await fetch(record.asset);
          if (!response.ok) throw new Error(`Morphology ${record.id} returned ${response.status}`);
          return { record, buffer: await response.arrayBuffer() };
        }));
        if (disposed) return;

        for (const { record, buffer } of assets) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer), 3));
          const cell = cellByBancId(record.id);
          const baseColor = cell?.cell_type === 'MDN' ? 0x6a9696 : 0x6d86a6;
          const lineMaterial = new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.24 });
          const line = new THREE.LineSegments(geometry, lineMaterial);
          line.userData.neuronId = record.id;
          line.renderOrder = 3;
          scene.add(line);

          const glowMaterial = new THREE.PointsMaterial({
            color: baseColor,
            size: 0.036,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const glow = new THREE.Points(geometry, glowMaterial);
          glow.renderOrder = 4;
          scene.add(glow);
          neuronRenders.set(record.id, { line, lineMaterial, glow, glowMaterial });
        }
        setLoadState('ready');
      } catch (error) {
        console.error('Could not load BANC v888 morphology assets.', error);
        if (!disposed) setLoadState('failed');
      }
    };
    void loadMorphologies();

    const clock = new THREE.Clock();
    const render = () => {
      if (disposed) return;
      controls.update();
      const elapsed = clock.getElapsedTime();
      if (!reducedMotion) {
        for (const renderRecord of neuronRenders.values()) {
          const baseOpacity = Number(renderRecord.glow.userData.baseOpacity ?? 0);
          renderRecord.glowMaterial.opacity = baseOpacity ? baseOpacity * (0.86 + Math.sin(elapsed * 2.2) * 0.14) : 0;
        }
      }
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      motionQuery.removeEventListener('change', onMotionChange);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onPointerClick);
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Sprite) {
          const texture = object.userData.labelTexture as THREE.Texture | undefined;
          texture?.dispose();
          object.material.dispose();
        }
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      neuronRenders.clear();
      shellRenders.clear();
      sceneApiRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [selectNeuron]);

  useEffect(() => {
    sceneApiRef.current?.applyVisualState({
      circuitId,
      activeMdnIds: activity.activeMdnIds,
      highlightedLbl40Ids: activity.highlightedLbl40Ids,
      activeSchematicIds,
      selectedId,
      hoveredId,
      shellVisible,
    });
  }, [activeSchematicIds, activity.activeMdnIds, activity.highlightedLbl40Ids, circuitId, hoveredId, loadState, selectedId, shellVisible]);

  return (
    <section className="fly-brain-viewer" aria-label={circuitId === 'circuit_mdn_adult' ? 'Interactive BANC v888 MDN and LBL40 circuit viewer' : 'Interactive literature-schematic giant-fiber brain-to-leg-and-wing motor-path viewer'}>
      <div className="brain-canvas-wrap">
        <div className="brain-canvas" ref={mountRef} />
        <div className="brain-viewer-status">
          <span className={`viewer-load ${loadState}`}>{circuitId === 'circuit_mdn_adult' ? loadState === 'loading' ? 'loading reconstructions' : loadState === 'ready' ? 'BANC v888 reconstructions' : '3D assets unavailable' : 'GF literature schematic · no bundled reconstruction'}</span>
          <strong>{conditionLabel}</strong>
          <small>{timeMs.toLocaleString()} ms · {driveActive ? `${laterality} model-${targetModeLabel} target selected` : 'no active model target'}</small>
        </div>
        <div className="brain-camera-controls" aria-label="3D camera controls">
          {(['whole', 'brain', 'vnc'] as CameraPreset[]).map((preset) => (
            <button className={cameraPreset === preset ? 'active' : ''} type="button" aria-pressed={cameraPreset === preset} onClick={() => applyCameraPreset(preset)} key={preset}>{preset}</button>
          ))}
          <button className={shellVisible ? 'active' : ''} type="button" aria-pressed={shellVisible} onClick={() => setShellVisible((visible) => !visible)}>shell</button>
        </div>
        <div className="brain-orientation" aria-hidden="true"><span>L</span><i /><span>R</span></div>
        {hoveredId && <div className="brain-hover-card"><strong>{cellByBancId(hoveredId)?.cell_type ?? hoveredId.replaceAll('_', ' ')}</strong><span>{cellByBancId(hoveredId)?.side ?? 'schematic path'} · {cellByBancId(hoveredId) ? compactId(hoveredId) : 'not a dataset ID'}</span></div>}
        <div className="brain-legend">
          <span><i className="model-target" /><ViewerProvenanceTag kind="agent_hypothesized" /> model-{targetModeLabel} target</span>
          <span><i className="structural-target" /><ViewerProvenanceTag kind={circuitId === 'circuit_mdn_adult' ? 'connectome_inferred' : 'measured'} /> linked path</span>
          <span><i className="reconstruction" /><ViewerProvenanceTag kind="derived" /> BANC reconstruction</span>
        </div>
      </div>

      {circuitId === 'circuit_mdn_adult' ? <aside className="brain-neuron-panel" aria-label="BANC neuron records">
        <header><div><p className="eyebrow">Pinned cells</p><h2>4 MDNs · 2 LBL40s</h2></div><span>{BANC_V888_EDGES.length} rows</span></header>
        <div className="brain-neuron-list">
          {cells.map((cell) => {
            const isActive = activeMdnSet.has(cell.banc_888_id);
            const isLinked = highlightedLbl40Set.has(cell.banc_888_id);
            return (
              <button
                className={`${selectedId === cell.banc_888_id ? 'selected' : ''} ${isActive ? 'model-active' : ''} ${isLinked ? 'path-active' : ''}`}
                type="button"
                aria-pressed={selectedId === cell.banc_888_id}
                onClick={() => selectNeuron(cell.banc_888_id)}
                key={cell.banc_888_id}
              >
                <i />
                <span><strong>{cell.cell_type} · {cell.side}</strong><small>{compactId(cell.banc_888_id)}</small></span>
                <b>{isActive ? targetModeLabel : isLinked ? 'path' : 'view'}</b>
              </button>
            );
          })}
        </div>
        <div className="brain-cell-detail" aria-live="polite">
          {selectedCell ? (
            <>
              <p><strong>{selectedCell.cell_type} · {selectedCell.side}</strong><ViewerProvenanceTag kind="derived" /></p>
              <dl>
                <div><dt>BANC v888 ID</dt><dd>{selectedCell.banc_888_id}</dd></div>
                <div><dt>Metadata region</dt><dd>{selectedCell.root_region}</dd></div>
                <div><dt>Structural v3 links</dt><dd>{contactsForCell(selectedCell.banc_888_id)} predicted synaptic links across bundled MDN→LBL40 rows</dd></div>
              </dl>
            </>
          ) : (
            <p className="brain-select-hint">Drag to orbit. Select any reconstruction for its stable ID and metadata.</p>
          )}
        </div>
        <div className="brain-edge-summary">
          <span><ViewerProvenanceTag kind="connectome_inferred" /> selected structural path</span>
          <strong>{activity.highlightedEdges.length ? `${activity.highlightedEdges.length} rows · ${activity.highlightedEdges.reduce((total, edge) => total + edge.count, 0)} v3-predicted links` : 'none during baseline / sham / rest'}</strong>
        </div>
      </aside> : (
        <aside className="brain-neuron-panel" aria-label="Giant-fiber literature motor path">
          <header><div><p className="eyebrow">Mapped path</p><h2>GF → legs + wings</h2></div><span>schematic</span></header>
          <div className="brain-neuron-list">
            {(motorMap?.nodes ?? []).filter((node) => node.level !== 'body').map((node) => (
              <div className={driveActive ? 'path-active' : ''} key={node.id}>
                <i />
                <span><strong>{node.label}</strong><small>{node.level.replaceAll('_', ' ')} · {node.role}</small></span>
                <b>{node.provenance.replaceAll('_', ' ')}</b>
              </div>
            ))}
          </div>
          <div className="brain-cell-detail">
            <p><strong>Body targets</strong><ViewerProvenanceTag kind="agent_hypothesized" /></p>
            <dl><div><dt>Mapped output</dt><dd>{motorMap?.targetBodyParts.map((part) => part.replaceAll('_', ' ')).join(' · ')}</dd></div></dl>
          </div>
          <div className="brain-edge-summary">
            <span><ViewerProvenanceTag kind="measured" /> literature path</span>
            <strong>GF → TTMn / TTM jump branch · GF → PSI → DLMn / DLM wing branch</strong>
          </div>
        </aside>
      )}

      <footer className="brain-viewer-boundary">
        <span>{circuitId === 'circuit_mdn_adult' ? <><ViewerProvenanceTag kind="derived" /> neuron lines from BANC v888 SWCs</> : <><ViewerProvenanceTag kind="measured" /> path labels paraphrase cited primary studies</>}</span>
        <span>Not evidence · schematic orientation shell{circuitId === 'circuit_gf_adult' ? ' and GF path geometry' : ''}</span>
        <strong><ViewerProvenanceTag kind="agent_hypothesized" /> glow is model selection, not measured activity; wiring records are not physiology.</strong>
      </footer>
    </section>
  );
}
