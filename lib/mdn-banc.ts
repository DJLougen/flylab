/**
 * Pinned, reviewable records for FlyLab's adult MDN backward-walking slice.
 *
 * IDs are strings because BANC root IDs exceed JavaScript's safe integer range.
 * `banc_888_id` is the stable join key for this snapshot; `root_id` is retained
 * only as the value exported in the pinned metadata file and may change after
 * later proofreading edits.
 */

export type BancSide = 'left' | 'right';
export type BancRegion = 'central_brain' | 'ventral_nerve_cord';

export interface BancV888CellRecord {
  banc_888_id: string;
  root_id: string;
  nucleus_id: string;
  side: BancSide;
  proofread: true;
  roughly_proofread: false;
  status: string;
  cell_type: 'MDN' | 'LBL40';
  manc_cell_type: 'MDN' | 'LBL40';
  malecns_cell_type: 'MDN' | 'LBL40';
  fanc_cell_type: string | null;
  fafb_match: string | null;
  manc_match: string;
  malecns_match: string;
  neurotransmitter_predicted: 'acetylcholine';
  neurotransmitter_score: number;
  neurotransmitter_verified: 'acetylcholine';
  root_region: string;
  region: BancRegion;
  flow: 'intrinsic';
  super_class: 'descending' | 'ventral_nerve_cord_intrinsic';
  cell_class: 'descending_neuron' | null;
  flylab_provenance: 'derived';
}

export interface BancV888EdgeRecord {
  pre: string;
  post: string;
  count: number;
  norm: number;
  post_count: number;
  pre_count: number;
  flylab_provenance: 'connectome_inferred';
}

export interface PinnedDataFile {
  name: string;
  dataverse_datafile_id: string;
  md5: string;
  sha256: string;
  bytes: number;
  raw_rows: number;
  role: string;
}

export interface PinnedMorphologyFile {
  banc_888_id: string;
  format: 'SWC';
  sha256: string;
  source_url: string;
}

export const BANC_V888_SOURCE_FILES: readonly PinnedDataFile[] = [
  {
    name: 'banc_888_meta.feather',
    dataverse_datafile_id: '14033740',
    md5: '6275eda42f98c49539d1ab513d979d09',
    sha256: '819bbcff476e52702d6f8d8604ce1f12d1d7b11942281df2f49df2a73a6f15a5',
    bytes: 57_550_610,
    raw_rows: 188_508,
    role: 'Per-neuron annotations and pinned cross-dataset matches.',
  },
  {
    name: 'banc_888_edgelist_simple_v3.feather',
    dataverse_datafile_id: '13918810',
    md5: '08542b0771db7418ed474be60dc9886c',
    sha256: '8c296e946f3c69a8c7222f30ad75fa8a98eeb189124fec6df829c9125f4be64b',
    bytes: 359_161_658,
    raw_rows: 13_620_865,
    role: 'Directed neuron-to-neuron edge list rolled up from the v3 synapse set.',
  },
] as const;

export const BANC_V888_CELLS: readonly BancV888CellRecord[] = [
  {
    banc_888_id: '720575941491012809',
    root_id: '720575941491012809',
    nucleus_id: '73043032676500920',
    side: 'left',
    proofread: true,
    roughly_proofread: false,
    status: 'REVIEW_MATCH_AN_DN,SENT_TO_AELYSIA_TRACING,FAFB_MATCH_MANUALLY_CHECKED,IN_VIGNETTE,MANC_MATCH_MANUALLY_CHECKED',
    cell_type: 'MDN',
    manc_cell_type: 'MDN',
    malecns_cell_type: 'MDN',
    fanc_cell_type: 'auto:MDN, MDN4, moonwalker descending neuron',
    fafb_match: '720575940616026939',
    manc_match: '13809',
    malecns_match: '11288',
    neurotransmitter_predicted: 'acetylcholine',
    neurotransmitter_score: 0.9477,
    neurotransmitter_verified: 'acetylcholine',
    root_region: 'ITO_midbrain_SMP_L',
    region: 'central_brain',
    flow: 'intrinsic',
    super_class: 'descending',
    cell_class: 'descending_neuron',
    flylab_provenance: 'derived',
  },
  {
    banc_888_id: '720575941491065653',
    root_id: '720575941690515574',
    nucleus_id: '73043032676500795',
    side: 'left',
    proofread: true,
    roughly_proofread: false,
    status: 'REVIEW_MATCH_AN_DN,SENT_TO_AELYSIA_TRACING,FAFB_MATCH_MANUALLY_CHECKED,IN_VIGNETTE,MANC_MATCH_MANUALLY_CHECKED',
    cell_type: 'MDN',
    manc_cell_type: 'MDN',
    malecns_cell_type: 'MDN',
    fanc_cell_type: null,
    fafb_match: '720575940631082808',
    manc_match: '14419',
    malecns_match: '12348',
    neurotransmitter_predicted: 'acetylcholine',
    neurotransmitter_score: 0.9452,
    neurotransmitter_verified: 'acetylcholine',
    root_region: 'ITO_midbrain_FB',
    region: 'central_brain',
    flow: 'intrinsic',
    super_class: 'descending',
    cell_class: 'descending_neuron',
    flylab_provenance: 'derived',
  },
  {
    banc_888_id: '720575941499708745',
    root_id: '720575941597827697',
    nucleus_id: '73042963957023018',
    side: 'right',
    proofread: true,
    roughly_proofread: false,
    status: 'REVIEW_MATCH_AN_DN,SENT_TO_AELYSIA_TRACING,FAFB_MATCH_MANUALLY_CHECKED,IN_VIGNETTE,MANC_MATCH_MANUALLY_CHECKED',
    cell_type: 'MDN',
    manc_cell_type: 'MDN',
    malecns_cell_type: 'MDN',
    fanc_cell_type: null,
    fafb_match: '720575940610236514',
    manc_match: '13438',
    malecns_match: '11332',
    neurotransmitter_predicted: 'acetylcholine',
    neurotransmitter_score: 0.9107,
    neurotransmitter_verified: 'acetylcholine',
    root_region: 'ITO_midbrain_SMP_R',
    region: 'central_brain',
    flow: 'intrinsic',
    super_class: 'descending',
    cell_class: 'descending_neuron',
    flylab_provenance: 'derived',
  },
  {
    banc_888_id: '720575941614906387',
    root_id: '720575941592674814',
    nucleus_id: '73043032743610501',
    side: 'right',
    proofread: true,
    roughly_proofread: false,
    status: 'TRACING_ISSUE_RESOLVED,REVIEW_MATCH_AN_DN,SENT_TO_AELYSIA_TRACING,FAFB_MATCH_MANUALLY_CHECKED,IN_VIGNETTE,MANC_MATCH_MANUALLY_CHECKED',
    cell_type: 'MDN',
    manc_cell_type: 'MDN',
    malecns_cell_type: 'MDN',
    fanc_cell_type: 'auto:MDN, MDN4, moonwalker descending neuron',
    fafb_match: '720575940610236514',
    manc_match: '14523',
    malecns_match: '11332',
    neurotransmitter_predicted: 'acetylcholine',
    neurotransmitter_score: 0.9359,
    neurotransmitter_verified: 'acetylcholine',
    root_region: 'ITO_midbrain_SMP_R',
    region: 'central_brain',
    flow: 'intrinsic',
    super_class: 'descending',
    cell_class: 'descending_neuron',
    flylab_provenance: 'derived',
  },
  {
    banc_888_id: '720575941669107187',
    root_id: '720575941615554268',
    nucleus_id: '73044612956029131',
    side: 'left',
    proofread: true,
    roughly_proofread: false,
    status: 'IN_VIGNETTE,SENT_TO_AELYSIA_TRACING',
    cell_type: 'LBL40',
    manc_cell_type: 'LBL40',
    malecns_cell_type: 'LBL40',
    fanc_cell_type: 'auto:LBL40',
    fafb_match: null,
    manc_match: '11493',
    malecns_match: '801246',
    neurotransmitter_predicted: 'acetylcholine',
    neurotransmitter_score: 0.9691,
    neurotransmitter_verified: 'acetylcholine',
    root_region: 'COURT_vnc_MetaNM-T3',
    region: 'ventral_nerve_cord',
    flow: 'intrinsic',
    super_class: 'ventral_nerve_cord_intrinsic',
    cell_class: null,
    flylab_provenance: 'derived',
  },
  {
    banc_888_id: '720575941669069043',
    root_id: '720575941506535874',
    nucleus_id: '72974312864219160',
    side: 'right',
    proofread: true,
    roughly_proofread: false,
    status: 'IN_VIGNETTE,SENT_TO_AELYSIA_TRACING',
    cell_type: 'LBL40',
    manc_cell_type: 'LBL40',
    malecns_cell_type: 'LBL40',
    fanc_cell_type: null,
    fafb_match: null,
    manc_match: '10994',
    malecns_match: '801214',
    neurotransmitter_predicted: 'acetylcholine',
    neurotransmitter_score: 0.9674,
    neurotransmitter_verified: 'acetylcholine',
    root_region: 'MANC_vnc_LNp_T3_R',
    region: 'ventral_nerve_cord',
    flow: 'intrinsic',
    super_class: 'ventral_nerve_cord_intrinsic',
    cell_class: null,
    flylab_provenance: 'derived',
  },
] as const;

export const BANC_V888_EDGES: readonly BancV888EdgeRecord[] = [
  {
    pre: '720575941491012809',
    post: '720575941669069043',
    count: 52,
    norm: 0.04062,
    post_count: 1280,
    pre_count: 1485,
    flylab_provenance: 'connectome_inferred',
  },
  {
    pre: '720575941491065653',
    post: '720575941669069043',
    count: 51,
    norm: 0.03984,
    post_count: 1280,
    pre_count: 1530,
    flylab_provenance: 'connectome_inferred',
  },
  {
    pre: '720575941499708745',
    post: '720575941669107187',
    count: 26,
    norm: 0.02405,
    post_count: 1081,
    pre_count: 1417,
    flylab_provenance: 'connectome_inferred',
  },
  {
    pre: '720575941614906387',
    post: '720575941669107187',
    count: 24,
    norm: 0.0222,
    post_count: 1081,
    pre_count: 1492,
    flylab_provenance: 'connectome_inferred',
  },
] as const;

export const BANC_V888_MDN_LBL40_TOTAL_CONTACTS = BANC_V888_EDGES.reduce(
  (total, edge) => total + edge.count,
  0,
);

export const BANC_V888_MORPHOLOGY_FILES: readonly PinnedMorphologyFile[] = [
  ['720575941491012809', '1bdcc7ff77ccffd95628437c9d47bdce1cc01dd5893eb8249c52a19acdece689'],
  ['720575941491065653', '15fd58ea59e56b19e5ed69469561876b153accd6a4e4fe202f6f1c6a102a3f2a'],
  ['720575941499708745', 'f7394c2d5f9c7e5b65cd75df3098bc207d3ccabe36a9f5d4de9d59ac0cf31361'],
  ['720575941614906387', '3d8d4cff8f6765efe67cc0622eec8a7210f1a245bc95686f449c839a2450bb6a'],
  ['720575941669107187', '48f9ad4127f3ddd2bcc85b6730f3def6c2c3b52a3dbce1cda43575064de380c5'],
  ['720575941669069043', '219ee955b38e21e5b933c2fbb38e99bc7aea1f1eecc6fbc11e1f67e50b01f76b'],
].map(([banc_888_id, checksum]) => ({
  banc_888_id,
  format: 'SWC' as const,
  sha256: checksum,
  source_url: `https://storage.googleapis.com/lee-lab_brain-and-nerve-cord-fly-connectome/compiled_data/banc_888/banc_banc_space_split_swc/${banc_888_id}_split.swc`,
}));

export const BANC_V888_MORPHOLOGY_BUNDLE = {
  snapshot: 'banc_888',
  snapshotDate: '2026-04-17',
  dataProduct: 'BANC L2 SWC skeletons in BANC voxel space',
  license: 'CC-BY-4.0',
  bundledManifest: '/data/banc-v888-skeletons/manifest.json',
  files: BANC_V888_MORPHOLOGY_FILES,
  displayBoundary: 'Neuron lines are reconstruction-derived. Playback glow is a FlyLab model selection, not recorded activity, voltage, calcium, firing rate, or signal propagation. The surrounding CNS shell is schematic.',
} as const;

export const BANC_V888_BUNDLE = {
  dataset: 'BANC',
  datasetVersion: '3.0',
  snapshot: 'banc_888',
  articleDoi: 'https://doi.org/10.1038/s41586-026-10735-w',
  staticDatasetDoi: 'https://doi.org/10.7910/DVN/7WTH1N',
  license: 'CC-BY-4.0',
  specimen: 'One adult female Drosophila central nervous system.',
  stableSnapshotKey: 'banc_888_id',
  edgeJoin: 'pre/post join to banc_888_id',
  edgeSource: 'v3 future-work predicted synaptic links, postsynapse size ≥10 voxels, rolled up to directed neuron pairs; Bates et al. paper analyses use v2 (≥5)',
  limitations: [
    'This is one specimen, not a population estimate or a universal cell count.',
    'The reconstruction is incomplete; the lamina and ocellar ganglion are absent and other reconstruction limitations remain.',
    'Directed counts are v3-predicted synaptic links after the postsynapse-size ≥10-voxel filter, not recordings of activity, causal efficacy, or physiological weights; the paper analyses use v2 (≥5).',
    'The raw norm field is preserved for provenance but is not assigned a biological interpretation by FlyLab.',
  ],
  files: BANC_V888_SOURCE_FILES,
} as const;

export const MANC_V121_REFERENCE = {
  dataset: 'MANC',
  datasetId: 'manc:v1.2.1',
  version: 'v1.2.1',
  sourceUrl: 'https://www.janelia.org/project-team/flyem/manc-connectome',
  license: 'CC-BY-4.0',
  specimen: 'A separate adult male ventral nerve cord specimen.',
  matchField: 'manc_match',
  matchSemantics: 'Corresponding fragments or cell types across datasets; never the same physical cells as the female BANC specimen.',
} as const;

export const LUL130_BUNDLE_STATUS = {
  cellType: 'LUL130',
  bancV888NodeId: null,
  provenance: 'measured',
  statement: 'LUL130 has literature-supported function, but the pinned BANC v888 metadata contains no LUL130 annotation and FlyLab assigns no BANC node ID.',
} as const;
