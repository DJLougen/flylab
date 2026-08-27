'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import type { BodyPartId, MotorProgramId, TrajectoryPoint } from '@/lib/flylab';

interface FlyArena3DProps {
  point: TrajectoryPoint | null;
  conditionLabel: string;
  timeMs: number;
  playing?: boolean;
  traceMode?: boolean;
  motorProgram?: MotorProgramId;
  targetBodyParts?: BodyPartId[];
}

const WING_BODY_PARTS: BodyPartId[] = ['left_wing', 'right_wing'];
const LEG_BODY_PARTS: BodyPartId[] = [
  'left_foreleg',
  'left_midleg',
  'left_hindleg',
  'right_foreleg',
  'right_midleg',
  'right_hindleg',
];

function makeAppendageMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x5e452d, roughness: 0.86 });
}

function makeWingMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xd8eee8,
    transparent: true,
    opacity: 0.3,
    roughness: 0.18,
    transmission: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

function segmentBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.82, direction.length(), 10),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  return mesh;
}

function makeWing(material: THREE.Material, side: -1 | 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.42, -0.12, 0.8, -0.64, 0.7, -1.55);
  shape.bezierCurveTo(0.56, -2.12, 0.12, -2.18, -0.08, -1.58);
  shape.bezierCurveTo(-0.2, -0.92, -0.16, -0.26, 0, 0);
  const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), material);
  // The fly faces +Z, so the wing blade folds rearward toward -Z.
  wing.rotation.x = Math.PI / 2;
  wing.position.set(side * 0.28, 0.22, -0.14);
  wing.scale.x = side;
  return wing;
}

function makeFly() {
  const fly = new THREE.Group();
  fly.name = 'procedural-adult-drosophila';

  const thoraxMaterial = new THREE.MeshStandardMaterial({ color: 0x493321, roughness: 0.7, metalness: 0.02 });
  const abdomenMaterial = new THREE.MeshStandardMaterial({ color: 0xa87935, roughness: 0.72, metalness: 0.02 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x261c17, roughness: 0.82 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x971f25, emissive: 0x310307, emissiveIntensity: 0.65, roughness: 0.48 });
  const ocellusMaterial = new THREE.MeshStandardMaterial({ color: 0xc96b28, emissive: 0x431505, emissiveIntensity: 0.42, roughness: 0.52 });
  const passiveAppendageMaterial = makeAppendageMaterial();
  const bodyPartMaterials = new Map<BodyPartId, THREE.MeshStandardMaterial>();
  WING_BODY_PARTS.forEach((part) => bodyPartMaterials.set(part, makeWingMaterial()));
  LEG_BODY_PARTS.forEach((part) => bodyPartMaterials.set(part, makeAppendageMaterial()));

  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), thoraxMaterial);
  head.name = 'head';
  head.scale.set(0.58, 0.47, 0.5);
  head.position.set(0, 0.06, 0.92);
  fly.add(head);

  for (const side of [-1, 1] as const) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 16), eyeMaterial);
    eye.name = side < 0 ? 'left-compound-eye' : 'right-compound-eye';
    eye.scale.set(0.22, 0.29, 0.31);
    eye.position.set(side * 0.49, 0.07, 1.02);
    fly.add(eye);
  }

  [
    new THREE.Vector3(0, 0.47, 1.13),
    new THREE.Vector3(-0.14, 0.45, 0.98),
    new THREE.Vector3(0.14, 0.45, 0.98),
  ].forEach((position, index) => {
    const ocellus = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), ocellusMaterial);
    ocellus.name = `ocellus-${index + 1}`;
    ocellus.position.copy(position);
    fly.add(ocellus);
  });

  const thorax = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 20), thoraxMaterial);
  thorax.name = 'thorax';
  thorax.scale.set(0.57, 0.52, 0.72);
  thorax.position.set(0, 0, -0.02);
  fly.add(thorax);

  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 22), abdomenMaterial);
  abdomen.name = 'segmented-abdomen';
  abdomen.scale.set(0.48, 0.4, 1.18);
  abdomen.position.set(0, -0.02, -1.08);
  fly.add(abdomen);

  const ringPositions = [-0.48, -0.83, -1.18, -1.5, -1.77];
  ringPositions.forEach((z, index) => {
    const taper = 1 - index * 0.075;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44 * taper, 0.035, 8, 32), darkMaterial);
    ring.name = `abdominal-segment-${index + 1}`;
    ring.scale.y = 0.78;
    ring.position.set(0, -0.02, z);
    fly.add(ring);
  });

  const wings = new THREE.Group();
  wings.name = 'paired-wings';
  wings.add(
    makeWing(bodyPartMaterials.get('left_wing')!, -1),
    makeWing(bodyPartMaterials.get('right_wing')!, 1),
  );
  fly.add(wings);

  for (const side of [-1, 1] as const) {
    const haltere = new THREE.Group();
    haltere.name = `${side < 0 ? 'left' : 'right'}-haltere`;
    const root = new THREE.Vector3(side * 0.31, 0.04, -0.45);
    const tip = new THREE.Vector3(side * 0.65, 0.06, -0.67);
    haltere.add(segmentBetween(root, tip, 0.022, passiveAppendageMaterial));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), passiveAppendageMaterial);
    knob.position.copy(tip);
    haltere.add(knob);
    fly.add(haltere);
  }

  const legRoots: THREE.Group[] = [];
  const legZ = [0.38, -0.05, -0.48];
  for (const side of [-1, 1] as const) {
    legZ.forEach((z, index) => {
      const leg = new THREE.Group();
      const bodyPart = LEG_BODY_PARTS[legRoots.length];
      const legMaterial = bodyPartMaterials.get(bodyPart)!;
      leg.name = `${side < 0 ? 'left' : 'right'}-leg-${index + 1}`;
      leg.position.set(side * 0.39, -0.12, z);
      const foreAft = index === 0 ? 0.42 : index === 2 ? -0.42 : 0;
      const knee = new THREE.Vector3(side * 0.48, -0.16, foreAft);
      const ankle = new THREE.Vector3(side * 0.86, -0.43, foreAft * 1.42);
      const foot = new THREE.Vector3(side * 1.08, -0.55, foreAft * 1.72);
      leg.add(
        segmentBetween(new THREE.Vector3(), knee, 0.045, legMaterial),
        segmentBetween(knee, ankle, 0.034, legMaterial),
        segmentBetween(ankle, foot, 0.024, legMaterial),
      );
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), legMaterial);
      joint.position.copy(knee);
      leg.add(joint);
      const ankleJoint = new THREE.Mesh(new THREE.SphereGeometry(0.047, 10, 8), legMaterial);
      ankleJoint.position.copy(ankle);
      leg.add(ankleJoint);
      legRoots.push(leg);
      fly.add(leg);
    });
  }

  const antennae = new THREE.Group();
  antennae.name = 'paired-branched-aristae';
  for (const side of [-1, 1] as const) {
    const antennaBase = new THREE.Vector3(side * 0.2, 0.12, 1.27);
    const antennaTip = new THREE.Vector3(side * 0.28, 0.13, 1.58);
    const aristaEnd = new THREE.Vector3(side * 0.49, 0.18, 1.84);
    antennae.add(segmentBetween(antennaBase, antennaTip, 0.025, passiveAppendageMaterial));
    antennae.add(segmentBetween(antennaTip, aristaEnd, 0.012, passiveAppendageMaterial));
    [0.22, 0.43, 0.64, 0.82].forEach((fraction, index) => {
      const branchRoot = antennaTip.clone().lerp(aristaEnd, fraction);
      const branchTip = branchRoot.clone().add(new THREE.Vector3(
        side * (0.07 + index * 0.012),
        index % 2 === 0 ? 0.1 : -0.065,
        0.025,
      ));
      antennae.add(segmentBetween(branchRoot, branchTip, 0.007, passiveAppendageMaterial));
    });
  }
  fly.add(antennae);

  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0xd49cff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.035, 10, 64), haloMaterial);
  halo.name = 'model-drive-selection-halo';
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.58;
  fly.add(halo);

  fly.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return { fly, wings, antennae, legRoots, halo, haloMaterial, bodyPartMaterials };
}

export function FlyArena3D({ point, conditionLabel, timeMs, playing = false, traceMode = false, motorProgram = 'reverse_walk', targetBodyParts = [] }: FlyArena3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ point, timeMs, playing, motorProgram, targetBodyParts });
  const [renderState, setRenderState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    stateRef.current = { point, timeMs, playing, motorProgram, targetBodyParts };
  }, [motorProgram, point, targetBodyParts, timeMs, playing]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let animationFrame = 0;
    let disposed = false;

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 30);
      camera.position.set(0, 4.5, 6.3);
      camera.lookAt(0, -0.12, -0.3);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xc9fff3, 0x130d0a, 2.4));
      const key = new THREE.DirectionalLight(0xffe8c5, 3.1);
      key.position.set(-3.5, 6.2, 4.6);
      key.castShadow = true;
      scene.add(key);
      const rim = new THREE.PointLight(0x6ee7d2, 2.6, 16);
      rim.position.set(3.2, 2.4, -2.8);
      scene.add(rim);

      const { fly, wings, antennae, legRoots, halo, haloMaterial, bodyPartMaterials } = makeFly();
      fly.rotation.x = -0.07;
      scene.add(fly);

      const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
      const contactShadow = new THREE.Mesh(new THREE.CircleGeometry(1.18, 48), shadowMaterial);
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.set(0, -0.6, -0.36);
      contactShadow.scale.set(1, 0.62, 1);
      scene.add(contactShadow);

      const resize = () => {
        const width = Math.max(1, mount.clientWidth);
        const height = Math.max(1, mount.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(mount);
      resize();

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let reportedReady = false;
      const animate = (now: number) => {
        if (disposed) return;
        const current = stateRef.current;
        const active = Boolean(current.point?.active);
        const motorOutputActive = Boolean(current.point?.motorOutputActive);
        const targetedBodyParts = new Set(current.targetBodyParts);
        const phase = current.timeMs * 0.009;
        const animateGait = current.playing && !reducedMotion;
        const takeoff = current.motorProgram === 'short_mode_escape';
        const gait = animateGait ? Math.sin(phase) : 0;
        const oppositeGait = animateGait ? Math.sin(phase + Math.PI) : 0;
        fly.rotation.y = THREE.MathUtils.degToRad(-(current.point?.heading ?? 4));
        fly.position.y = 0.02 + Math.min(1.9, (current.point?.z ?? 0) * 0.55) + (animateGait && !takeoff ? Math.sin(now * 0.0045) * 0.024 : 0);
        wings.children.forEach((wing, index) => {
          const targeted = targetedBodyParts.has(WING_BODY_PARTS[index]);
          wing.rotation.z = takeoff && motorOutputActive && targeted && animateGait ? (index === 0 ? -1 : 1) * (0.22 + Math.sin(phase * 2.6) * 0.32) : 0;
        });
        bodyPartMaterials.forEach((material, bodyPart) => {
          const targeted = active && targetedBodyParts.has(bodyPart);
          material.emissive.set(targeted ? bodyPart.includes('wing') ? 0x4f9f91 : 0x4a1e63 : 0x000000);
          material.emissiveIntensity = targeted ? bodyPart.includes('wing') ? 0.8 : 0.45 : 0;
        });
        antennae.rotation.y = animateGait ? Math.sin(now * 0.0035) * 0.025 : 0;
        legRoots.forEach((leg, index) => {
          const targeted = targetedBodyParts.has(LEG_BODY_PARTS[index]);
          const tripodA = index === 0 || index === 4 || index === 2;
          const midleg = index === 1 || index === 4;
          leg.rotation.z = takeoff
            ? motorOutputActive && targeted && midleg ? (index < 3 ? -1 : 1) * 0.34 : 0
            : motorOutputActive && targeted ? (tripodA ? gait : oppositeGait) * 0.11 : 0;
        });
        haloMaterial.opacity = active ? 0.72 + Math.sin(now * 0.008) * 0.18 : 0;
        halo.scale.setScalar(active ? 1 + Math.sin(now * 0.006) * 0.08 : 1);
        renderer.render(scene, camera);
        if (!reportedReady) {
          reportedReady = true;
          setRenderState('ready');
        }
        animationFrame = requestAnimationFrame(animate);
      };
      animationFrame = requestAnimationFrame(animate);

      return () => {
        disposed = true;
        cancelAnimationFrame(animationFrame);
        observer.disconnect();
        const geometries = new Set<THREE.BufferGeometry>();
        const materials = new Set<THREE.Material>();
        scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
          geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.forEach((material) => materials.add(material));
        });
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    } catch {
      const failureFrame = requestAnimationFrame(() => setRenderState('failed'));
      return () => cancelAnimationFrame(failureFrame);
    }
  }, []);

  const active = Boolean(point?.active);
  return (
    <section
      className={`fly-3d-agent ${active ? 'activated' : ''} ${traceMode ? 'trace-mode' : ''}`}
      data-renderer="three-js"
      style={{
        left: `calc(50% + ${(point?.x ?? 0) * 95}px)`,
        top: `calc(50% - ${(point?.y ?? 0) * 95}px)`,
      }}
      role="img"
      aria-label={`${conditionLabel} Three.js 3D adult fruit-fly model at ${timeMs} milliseconds${active ? `; ${motorProgram.replaceAll('_', ' ')} model target selected for ${targetBodyParts.map((part) => part.replaceAll('_', ' ')).join(', ')}` : ''}. External morphology is schematic; appendage motion is also schematic.`}
    >
      <div className="fly-3d-canvas" ref={mountRef} aria-hidden="true" />
      {renderState === 'loading' && <span className="fly-3d-load">Loading 3D fly…</span>}
      {renderState === 'failed' && <span className="fly-3d-load failed">3D renderer unavailable</span>}
    </section>
  );
}
