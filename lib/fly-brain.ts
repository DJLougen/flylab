import {
  BANC_V888_CELLS,
  BANC_V888_EDGES,
  type BancSide,
  type BancV888CellRecord,
  type BancV888EdgeRecord,
  type Laterality,
} from './flylab.js';

export interface CircuitActivity {
  activeMdnIds: string[];
  highlightedLbl40Ids: string[];
  highlightedEdges: BancV888EdgeRecord[];
}

export interface MorphologyAssetRecord {
  id: string;
  asset: string;
  vertexCount: number;
  simplifiedSegmentCount: number;
  sourceNodeCount: number;
  sourceBytes: number;
  sourceSha256: string;
  sourceUrl: string;
}

export interface MorphologyManifest {
  schema: 'flylab.banc-morphology.v1';
  snapshot: 'banc_888';
  sourceSnapshotDate: string;
  sourceLicense: 'CC-BY-4.0';
  sourceArticle: string;
  sourceArticleDoi: string;
  sourceDatasetDoi: string;
  sourceFormat: string;
  renderFormat: string;
  transform: {
    sourceBounds: { minimum: number[]; maximum: number[] };
    sourceCenter: number[];
    scale: number;
    mapping: string;
  };
  simplification: {
    method: string;
    nodeSpacingInSourceUnits: number;
  };
  neurons: MorphologyAssetRecord[];
  boundaries: string[];
}

export const BANC_MORPHOLOGY_MANIFEST_URL = '/data/banc-v888-skeletons/manifest.json';

function sideMatches(side: BancSide, laterality: Laterality) {
  return laterality === 'bilateral' || laterality === side;
}

export function circuitActivityFor(laterality: Laterality, driveActive: boolean): CircuitActivity {
  if (!driveActive || laterality === 'none') {
    return { activeMdnIds: [], highlightedLbl40Ids: [], highlightedEdges: [] };
  }

  const activeMdnIds = BANC_V888_CELLS
    .filter((cell) => cell.cell_type === 'MDN' && sideMatches(cell.side, laterality))
    .map((cell) => cell.banc_888_id);
  const activeSet = new Set(activeMdnIds);
  const highlightedEdges = BANC_V888_EDGES.filter((edge) => activeSet.has(edge.pre));
  const highlightedLbl40Ids = [...new Set(highlightedEdges.map((edge) => edge.post))];

  return { activeMdnIds, highlightedLbl40Ids, highlightedEdges };
}

export function cellByBancId(id: string): BancV888CellRecord | undefined {
  return BANC_V888_CELLS.find((cell) => cell.banc_888_id === id);
}

export function contactsForCell(id: string) {
  return BANC_V888_EDGES
    .filter((edge) => edge.pre === id || edge.post === id)
    .reduce((total, edge) => total + edge.count, 0);
}
