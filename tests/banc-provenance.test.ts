import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { circuitActivityFor, contactsForCell } from '../lib/fly-brain.js';
import {
  BANC_V888_CELLS,
  BANC_V888_EDGES,
  BANC_V888_MDN_LBL40_TOTAL_CONTACTS,
  BANC_V888_SOURCE_FILES,
  type BancV888CellRecord,
  type BancV888EdgeRecord,
  type Laterality,
  type PinnedDataFile,
} from '../lib/flylab.js';

interface CanonicalBancSlice {
  schema: 'flylab.banc-v888-mdn-lbl40-slice.v1';
  snapshot: 'banc_888';
  selection: {
    cells: string;
    edges: string;
    cell_sort: string;
    edge_sort: string;
  };
  source_files: PinnedDataFile[];
  cells: BancV888CellRecord[];
  edges: BancV888EdgeRecord[];
  total_contacts: number;
}

function findCanonicalSlice(): string {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = join(directory, 'data/banc-v888-mdn-lbl40-slice.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) throw new Error('Could not locate the canonical BANC slice');
    directory = parent;
  }
}

function readCanonicalSlice(): CanonicalBancSlice {
  return JSON.parse(
    readFileSync(findCanonicalSlice(), 'utf8'),
  ) as CanonicalBancSlice;
}

describe('BANC v888 slice provenance', () => {
  test('the checked-in extraction agrees exactly with the runtime records', () => {
    const slice = readCanonicalSlice();

    assert.equal(slice.schema, 'flylab.banc-v888-mdn-lbl40-slice.v1');
    assert.equal(slice.snapshot, 'banc_888');
    assert.deepEqual(slice.selection, {
      cells: 'cell_type is MDN or LBL40',
      edges: 'pre is an extracted MDN and post is an extracted LBL40',
      cell_sort: 'cell_type (MDN, LBL40), side (left, right), banc_888_id',
      edge_sort: 'pre, post',
    });
    assert.deepEqual(slice.source_files, BANC_V888_SOURCE_FILES);
    assert.deepEqual(slice.cells, BANC_V888_CELLS);
    assert.deepEqual(slice.edges, BANC_V888_EDGES);
    assert.equal(slice.cells.length, 6);
    assert.equal(slice.edges.length, 4);
    assert.equal(slice.total_contacts, 153);
    assert.equal(slice.total_contacts, BANC_V888_MDN_LBL40_TOTAL_CONTACTS);
  });

  test('fly-brain selections and contact sums are derived from that exact slice', () => {
    const slice = readCanonicalSlice();
    const cases: Array<Exclude<Laterality, 'none'>> = ['left', 'right', 'bilateral'];

    for (const laterality of cases) {
      const expectedMdnIds = slice.cells
        .filter((cell) => (
          cell.cell_type === 'MDN'
          && (laterality === 'bilateral' || cell.side === laterality)
        ))
        .map((cell) => cell.banc_888_id);
      const expectedEdges = slice.edges.filter((edge) => expectedMdnIds.includes(edge.pre));
      const expectedLbl40Ids = [...new Set(expectedEdges.map((edge) => edge.post))];

      assert.deepEqual(circuitActivityFor(laterality, true), {
        activeMdnIds: expectedMdnIds,
        highlightedLbl40Ids: expectedLbl40Ids,
        highlightedEdges: expectedEdges,
      });
    }

    for (const cell of slice.cells) {
      const expectedContacts = slice.edges
        .filter((edge) => edge.pre === cell.banc_888_id || edge.post === cell.banc_888_id)
        .reduce((total, edge) => total + edge.count, 0);
      assert.equal(contactsForCell(cell.banc_888_id), expectedContacts);
    }
  });
});
