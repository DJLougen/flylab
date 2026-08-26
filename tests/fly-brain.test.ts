import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { describe, test } from 'node:test';
import { join } from 'node:path';

import { circuitActivityFor } from '../lib/fly-brain.js';
import { BANC_V888_MORPHOLOGY_FILES } from '../lib/flylab.js';

describe('FlyLab 3D circuit mapping', () => {
  const viewerSource = readFileSync(join(process.cwd(), 'components/FlyBrain3D.tsx'), 'utf8');
  test('left-only model drive selects two left MDNs and their right LBL40 structural target', () => {
    const activity = circuitActivityFor('left', true);

    assert.deepEqual(activity.activeMdnIds, [
      '720575941491012809',
      '720575941491065653',
    ]);
    assert.deepEqual(activity.highlightedLbl40Ids, ['720575941669069043']);
    assert.deepEqual(activity.highlightedEdges.map((edge) => edge.count), [52, 51]);
  });

  test('right-only model drive selects two right MDNs and their left LBL40 structural target', () => {
    const activity = circuitActivityFor('right', true);

    assert.deepEqual(activity.activeMdnIds, [
      '720575941499708745',
      '720575941614906387',
    ]);
    assert.deepEqual(activity.highlightedLbl40Ids, ['720575941669107187']);
    assert.deepEqual(activity.highlightedEdges.map((edge) => edge.count), [26, 24]);
  });

  test('bilateral drive exposes all four source-backed edges and controls remain dark', () => {
    const bilateral = circuitActivityFor('bilateral', true);

    assert.equal(bilateral.activeMdnIds.length, 4);
    assert.equal(bilateral.highlightedLbl40Ids.length, 2);
    assert.equal(bilateral.highlightedEdges.length, 4);
    assert.equal(bilateral.highlightedEdges.reduce((total, edge) => total + edge.count, 0), 153);
    assert.deepEqual(circuitActivityFor('none', true), {
      activeMdnIds: [],
      highlightedLbl40Ids: [],
      highlightedEdges: [],
    });
    assert.deepEqual(circuitActivityFor('bilateral', false), {
      activeMdnIds: [],
      highlightedLbl40Ids: [],
      highlightedEdges: [],
    });
  });

  test('bundled morphology assets retain the pinned source checksums and declared sizes', () => {
    const assetDirectory = join(process.cwd(), 'public/data/banc-v888-skeletons');
    const manifest = JSON.parse(readFileSync(join(assetDirectory, 'manifest.json'), 'utf8')) as {
      neurons: Array<{ id: string; asset: string; vertexCount: number; sourceSha256: string }>;
    };
    const pinnedChecksums = new Map(BANC_V888_MORPHOLOGY_FILES.map((file) => [file.banc_888_id, file.sha256]));

    assert.equal(manifest.neurons.length, 6);
    for (const neuron of manifest.neurons) {
      assert.equal(neuron.sourceSha256, pinnedChecksums.get(neuron.id));
      assert.equal(statSync(join(process.cwd(), 'public', neuron.asset)).size, neuron.vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT);
    }
  });

  test('renders the giant-fiber branches as a labeled schematic rather than invented BANC neurons', () => {
    assert.match(viewerSource, /addSchematicPath\('gf_left'/);
    assert.match(viewerSource, /addSchematicPath\('gf_left_leg'/);
    assert.match(viewerSource, /addSchematicPath\('gf_left_wing'/);
    assert.match(viewerSource, /GF literature schematic · no bundled reconstruction/);
    assert.match(viewerSource, /not a dataset ID/);
    assert.match(viewerSource, /THORACIC VNC · SCHEMATIC SHELL/);
    assert.match(viewerSource, /addShell\('leftT2'/);
    assert.match(viewerSource, /render\.line\.visible = pathVisible/);
    assert.match(viewerSource, /filter\(\(record\) => record\.line\.visible\)/);
  });
});
