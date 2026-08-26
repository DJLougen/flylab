import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SNAPSHOT = 'banc_888';
const SOURCE_PREFIX = 'https://storage.googleapis.com/lee-lab_brain-and-nerve-cord-fly-connectome/compiled_data/banc_888/banc_banc_space_split_swc';
const OUTPUT_DIR = new URL('../public/data/banc-v888-skeletons/', import.meta.url);
const NODE_SPACING = 1_800;
const SCENE_SPAN = 12;

const neuronIds = [
  '720575941491012809',
  '720575941491065653',
  '720575941499708745',
  '720575941614906387',
  '720575941669107187',
  '720575941669069043',
];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function parseSwc(text) {
  const nodes = new Map();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const values = line.trim().split(/\s+/);
    if (values.length < 7) continue;
    const [id, label, x, y, z, radius, parent] = values.map(Number);
    nodes.set(id, { id, label, x, y, z, radius, parent, children: [] });
  }
  for (const node of nodes.values()) {
    const parent = nodes.get(node.parent);
    if (parent) parent.children.push(node.id);
  }
  return nodes;
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

function simplifyTree(nodes) {
  const segments = [];
  const roots = [...nodes.values()].filter((node) => node.parent === -1 || !nodes.has(node.parent));
  const stack = roots.map((root) => ({ node: root, retained: root, walked: 0 }));

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const forced = current.node !== current.retained && current.node.children.length !== 1;
    const retain = forced || current.walked >= NODE_SPACING;
    const nextRetained = retain ? current.node : current.retained;
    const nextWalked = retain ? 0 : current.walked;

    if (retain) {
      segments.push([
        current.retained.x, current.retained.y, current.retained.z,
        current.node.x, current.node.y, current.node.z,
      ]);
    }

    for (const childId of current.node.children) {
      const child = nodes.get(childId);
      if (!child) continue;
      stack.push({
        node: child,
        retained: nextRetained,
        walked: nextWalked + distance(current.node, child),
      });
    }
  }

  return segments;
}

async function fetchSource(id, temporaryDirectory) {
  const sourceUrl = `${SOURCE_PREFIX}/${id}_split.swc`;
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Could not download ${id}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const temporaryPath = join(temporaryDirectory, `${id}.swc`);
  await writeFile(temporaryPath, buffer);
  return { sourceUrl, buffer, temporaryPath };
}

await mkdir(OUTPUT_DIR, { recursive: true });
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'flylab-banc-'));

// Download once, then use one global transform so all six cells stay registered.
const sources = [];
const globalMin = [Infinity, Infinity, Infinity];
const globalMax = [-Infinity, -Infinity, -Infinity];

for (const id of neuronIds) {
  const source = await fetchSource(id, temporaryDirectory);
  const text = (await readFile(source.temporaryPath)).toString('utf8');
  const nodes = parseSwc(text);
  for (const node of nodes.values()) {
    const coordinates = [node.x, node.y, node.z];
    for (let axis = 0; axis < 3; axis += 1) {
      globalMin[axis] = Math.min(globalMin[axis], coordinates[axis]);
      globalMax[axis] = Math.max(globalMax[axis], coordinates[axis]);
    }
  }
  sources.push({ ...source, id, nodes });
}

const center = globalMin.map((minimum, axis) => (minimum + globalMax[axis]) / 2);
const scale = SCENE_SPAN / Math.max(...globalMax.map((maximum, axis) => maximum - globalMin[axis]));
const manifestNeurons = [];

for (const source of sources) {
  const simplified = simplifyTree(source.nodes);
  const positions = new Float32Array(simplified.length * 6);
  let offset = 0;
  for (const segment of simplified) {
    for (let point = 0; point < 2; point += 1) {
      const sourceOffset = point * 3;
      // BANC X remains lateral; longitudinal Y becomes scene vertical; Z remains depth.
      positions[offset] = (segment[sourceOffset] - center[0]) * scale;
      positions[offset + 1] = -(segment[sourceOffset + 1] - center[1]) * scale;
      positions[offset + 2] = (segment[sourceOffset + 2] - center[2]) * scale;
      offset += 3;
    }
  }
  const outputName = `${source.id}.bin`;
  await writeFile(new URL(outputName, OUTPUT_DIR), Buffer.from(positions.buffer));
  manifestNeurons.push({
    id: source.id,
    asset: `/data/banc-v888-skeletons/${outputName}`,
    vertexCount: positions.length / 3,
    simplifiedSegmentCount: simplified.length,
    sourceNodeCount: source.nodes.size,
    sourceBytes: source.buffer.byteLength,
    sourceSha256: sha256(source.buffer),
    sourceUrl: source.sourceUrl,
  });
}

const manifest = {
  schema: 'flylab.banc-morphology.v1',
  snapshot: SNAPSHOT,
  sourceSnapshotDate: '2026-04-17',
  sourceLicense: 'CC-BY-4.0',
  sourceArticle: 'Bates AS, Phelps JS, Kim M, Yang HHJ, et al. (2026). Distributed control circuits across a brain-and-cord connectome.',
  sourceArticleDoi: 'https://doi.org/10.1038/s41586-026-10735-w',
  sourceDatasetDoi: 'https://doi.org/10.7910/DVN/7WTH1N',
  sourceFormat: 'SWC L2 skeletons in BANC voxel space',
  renderFormat: 'Float32 line-segment endpoints',
  transform: {
    sourceBounds: { minimum: globalMin, maximum: globalMax },
    sourceCenter: center,
    scale,
    mapping: 'sceneX=(X-centerX)*scale; sceneY=-(Y-centerY)*scale; sceneZ=(Z-centerZ)*scale',
  },
  simplification: {
    method: 'Preserve roots, branch points, and endpoints; retain intermediate nodes by cumulative path distance.',
    nodeSpacingInSourceUnits: NODE_SPACING,
  },
  neurons: manifestNeurons,
  boundaries: [
    'Lines are reconstruction-derived BANC v888 L2 skeletons, not live neural activity.',
    'Playback glow indicates the selected FlyLab model target, not voltage, calcium, firing rate, or signal propagation.',
    'Contextual CNS surfaces in the viewer are schematic orientation geometry and are not BANC neuropil meshes.',
  ],
};

await writeFile(new URL('manifest.json', OUTPUT_DIR), `${JSON.stringify(manifest, null, 2)}\n`);
await rm(temporaryDirectory, { recursive: true, force: true });
console.log(`Wrote ${manifestNeurons.length} morphology assets to ${OUTPUT_DIR.pathname}`);
