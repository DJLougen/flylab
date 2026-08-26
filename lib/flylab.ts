import {
  BANC_V888_BUNDLE,
  BANC_V888_MDN_LBL40_TOTAL_CONTACTS,
  LUL130_BUNDLE_STATUS,
  MANC_V121_REFERENCE,
} from './mdn-banc.js';

export {
  BANC_V888_BUNDLE,
  BANC_V888_CELLS,
  BANC_V888_EDGES,
  BANC_V888_MDN_LBL40_TOTAL_CONTACTS,
  BANC_V888_SOURCE_FILES,
  LUL130_BUNDLE_STATUS,
  MANC_V121_REFERENCE,
  type BancRegion,
  type BancSide,
  type BancV888CellRecord,
  type BancV888EdgeRecord,
  type PinnedDataFile,
} from './mdn-banc.js';

export type ProvenanceLabel =
  | 'measured'
  | 'derived'
  | 'connectome_inferred'
  | 'simulation_predicted'
  | 'agent_hypothesized';

export const PROVENANCE_DEFINITIONS: Record<ProvenanceLabel, string> = {
  measured: 'An empirical result reported under the cited study conditions; it is not automatically universal or reproduced by FlyLab.',
  derived: 'A deterministic filter, aggregation, or calculation from pinned source records; it is not a new wet-lab measurement.',
  connectome_inferred: 'An anatomical inference from EM reconstruction or annotations; it does not establish activity, physiological efficacy, or behavior.',
  simulation_predicted: 'An output conditional on the stated model, controller mapping, parameters, and seed; it is not biological validation.',
  agent_hypothesized: 'An untested proposal authored by an agent that must remain distinct from source evidence and simulation output.',
};

export type Laterality = 'bilateral' | 'left' | 'right' | 'none';
export type MetricName =
  | 'backward_distance_mm'
  | 'signed_speed_mm_s'
  | 'response_latency_ms'
  | 'heading_change_deg'
  | 'stance_stability';

export interface SourceRecord {
  id: string;
  kind: 'article' | 'dataset' | 'software' | 'project_page';
  title: string;
  url: string;
  doi?: string;
  citation: string;
  version: string;
  access: string;
  license: string;
  specimen: string;
  redistribution: string;
  notes?: string;
}

export interface EvidenceRecord {
  id: string;
  label: string;
  claim: string;
  provenance: ProvenanceLabel;
  sourceIds: string[];
  context: string;
  caution: string;
}

export interface CircuitRecord {
  id: string;
  name: string;
  abbreviation: string;
  stage: 'adult';
  sex: 'any';
  laterality: 'bilateral_pair';
  behaviors: string[];
  evidenceIds: string[];
  summary: string;
}

export interface Hypothesis {
  id: string;
  circuitId: string;
  claim: string;
  predictedBehavior: string;
  perturbation: 'activate' | 'silence';
  evidenceIds: string[];
  falsificationCriterion: string;
  provenance: 'agent_hypothesized';
}

export interface TrialCondition {
  id: string;
  label: string;
  kind: 'baseline' | 'sham' | 'perturbation';
  laterality: Laterality;
  activationLevel: number;
}

export interface Experiment {
  id: string;
  hypothesisId: string;
  targetCircuitId: string;
  perturbation: 'activate' | 'silence';
  primaryLaterality: Exclude<Laterality, 'none'>;
  activationLevel: number;
  onsetMs: number;
  durationMs: number;
  trialDurationMs: number;
  replicates: number;
  seed: number;
  conditions: TrialCondition[];
  approved: boolean;
  model: typeof MODEL_MANIFEST;
  assumptions: string[];
}

export interface TrajectoryPoint {
  t: number;
  x: number;
  y: number;
  heading: number;
  active: boolean;
}

export interface ReplicateResult {
  id: string;
  conditionId: string;
  seed: number;
  reverseInitiated: boolean;
  backwardDistanceMm: number;
  signedSpeedMmS: number;
  responseLatencyMs: number;
  headingChangeDeg: number;
  stanceStability: number;
}

export interface ConditionRun {
  conditionId: string;
  label: string;
  laterality: Laterality;
  runIds: string[];
  replicates: ReplicateResult[];
  trajectory: TrajectoryPoint[];
}

export interface SimulationBatch extends Record<string, unknown> {
  id: string;
  experimentId: string;
  status: 'complete';
  conditionRuns: ConditionRun[];
  runHash: string;
  protocol: {
    onsetMs: number;
    durationMs: number;
    trialDurationMs: number;
    replicates: number;
    seed: number;
  };
  model: typeof MODEL_MANIFEST;
  provenance: ['simulation_predicted'];
}

export interface ConditionAnalysis {
  conditionId: string;
  label: string;
  n: number;
  reverseInitiationProbability: number;
  backwardDistanceMm: number;
  signedSpeedMmS: number;
  responseLatencyMs: number;
  headingChangeDeg: number;
  stanceStability: number;
}

export interface Analysis {
  id: string;
  batchId: string;
  metrics: MetricName[];
  conditions: ConditionAnalysis[];
  windowMs: { start: number; end: number };
  methodVersion: 'flylab.behavior-metrics.v1';
  provenance: ['derived', 'simulation_predicted'];
  warning: string;
}

export interface Comparison {
  id: string;
  analysisIds: string[];
  objectiveMetric: MetricName;
  rankedConditions: Array<{ conditionId: string; label: string; value: number }>;
  proposal: {
    id: string;
    rationale: string;
    activationLevels: number[];
    replicateBudget: number;
    provenance: 'agent_hypothesized';
  };
  limitations: string[];
}

export const MODEL_MANIFEST = {
  name: 'FlyLab reduced-order embodiment model',
  version: '0.1.1',
  controller: 'mdn-inspired-retreat-adapter.v1',
  environment: 'open-field-5mm.v1',
  controllerMapping: {
    provenance: 'agent_hypothesized',
    statement: 'The mapping from a unitless MDN-inspired drive to this controller is hand-authored and versioned; it is not an inferred firing rate or optogenetic dose.',
  },
  embodimentReference: {
    name: 'FlyGym',
    version: 'v2.1.0',
    commit: 'ca65a510c2afe6ac61c51df4f274c8d190c2f95f',
    releaseUrl: 'https://github.com/NeLy-EPFL/flygym/releases/tag/v2.1.0',
    license: 'Apache-2.0',
    browserStack: { mujocoWasm: '3.9.0', threeJs: '0.169.0' },
  },
  boundary: 'Reduced-order kinematic prediction only. It does not execute BANC neurons, model neural dynamics, reproduce a wet-lab perturbation, or constitute an independent biological validation.',
} as const;

export const DATASET_MANIFEST = {
  banc: {
    name: BANC_V888_BUNDLE.dataset,
    version: BANC_V888_BUNDLE.datasetVersion,
    snapshot: BANC_V888_BUNDLE.snapshot,
    license: BANC_V888_BUNDLE.license,
    staticDatasetDoi: BANC_V888_BUNDLE.staticDatasetDoi,
    specimen: BANC_V888_BUNDLE.specimen,
    stableSnapshotKey: BANC_V888_BUNDLE.stableSnapshotKey,
    limitations: BANC_V888_BUNDLE.limitations,
    files: BANC_V888_BUNDLE.files,
  },
  manc: MANC_V121_REFERENCE,
  cande: {
    name: 'Descending-neuron activation screen',
    articleVersion: 'Cande et al. 2018',
    datasetVersion: 'Dryad version 1 (2019-06-18)',
    datasetDoi: 'https://doi.org/10.5061/dryad.fr89c0c',
    license: 'CC0-1.0 (Dryad dataset)',
    scope: '130 sparse split-GAL4 lines targeting approximately 160 neurons across 58 anatomical types in solitary adult males.',
    boundary: 'Context for future descending-neuron expansion; it is not an MDN-specific causal source.',
  },
  flygym: MODEL_MANIFEST.embodimentReference,
} as const;

export const SOURCES: SourceRecord[] = [
  {
    id: 'SRC-BIDAYE-SCIENCE-2014',
    kind: 'article',
    title: 'Neuronal control of Drosophila walking direction',
    url: 'https://doi.org/10.1126/science.1249964',
    doi: '10.1126/science.1249964',
    citation: 'Bidaye SS, Machacek C, Wu Y, Dickson BJ. Science 344, 97–101 (2014).',
    version: 'Version of record (2014)',
    access: 'Primary publication record; cite and paraphrase.',
    license: 'Publisher copyright',
    specimen: 'Adult Drosophila in targeted genetic activation and silencing assays.',
    redistribution: 'No article text or figures are bundled.',
    notes: 'Use the pinned DOI above; a previously associated Science DOI referred to a different article.',
  },
  {
    id: 'SRC-SEN-CURRENT-BIOLOGY-2017',
    kind: 'article',
    title: 'Moonwalker Descending Neurons Mediate Visually Evoked Retreat in Drosophila',
    url: 'https://doi.org/10.1016/j.cub.2017.02.008',
    doi: '10.1016/j.cub.2017.02.008',
    citation: 'Sen R, Wu M, Branson K, Robie A, Rubin GM, Dickson BJ. Current Biology 27, 766–771 (2017).',
    version: 'Version of record (2017)',
    access: 'Primary publication record; cite and paraphrase.',
    license: 'Elsevier copyright',
    specimen: 'Adult Drosophila in acute and stochastic MDN activation assays.',
    redistribution: 'No article text or figures are bundled.',
  },
  {
    id: 'SRC-FENG-NCOMMS-2020',
    kind: 'article',
    title: 'Distributed control of motor circuits for backward walking in Drosophila',
    url: 'https://doi.org/10.1038/s41467-020-19936-x',
    doi: '10.1038/s41467-020-19936-x',
    citation: 'Feng K et al. Nature Communications 11, 6166 (2020).',
    version: 'Version of record (2020)',
    access: 'Open primary article.',
    license: 'CC-BY-4.0',
    specimen: 'Adult Drosophila in MDN-induced backward-walking assays.',
    redistribution: 'Attribution required for reused article material.',
  },
  {
    id: 'SRC-CANDE-ELIFE-2018',
    kind: 'article',
    title: 'Optogenetic dissection of descending behavioral control in Drosophila',
    url: 'https://doi.org/10.7554/eLife.34275',
    doi: '10.7554/eLife.34275',
    citation: 'Cande et al., eLife 7:e34275 (2018)',
    version: 'Version of record (2018)',
    access: 'Open primary article.',
    license: 'CC-BY-4.0',
    specimen: 'Solitary adult males; 130 sparse split-GAL4 lines targeting approximately 160 neurons across 58 anatomical types.',
    redistribution: 'Attribution required for reused article material.',
    notes: 'Useful as broad screen context, but the article text does not explicitly validate MDN as the target of its screen.',
  },
  {
    id: 'SRC-CANDE-DRYAD-V1',
    kind: 'dataset',
    title: 'Data from: Optogenetic dissection of descending behavioral control in Drosophila',
    url: 'https://doi.org/10.5061/dryad.fr89c0c',
    doi: '10.5061/dryad.fr89c0c',
    citation: 'Cande et al. Dryad dataset, version 1 (published 2019-06-18).',
    version: '1',
    access: 'Open dataset (2.21 GB).',
    license: 'CC0-1.0',
    specimen: 'Source data associated with the adult-male descending-neuron screen.',
    redistribution: 'Dataset may be reused under CC0; retain source provenance.',
  },
  {
    id: 'SRC-BANC-NATURE-2026',
    kind: 'article',
    title: 'Distributed control circuits across a brain-and-cord connectome',
    url: 'https://doi.org/10.1038/s41586-026-10735-w',
    doi: '10.1038/s41586-026-10735-w',
    citation: 'Bates et al., Nature (2026)',
    version: 'Version of record (2026)',
    access: 'Primary article.',
    license: 'Article terms; static BANC data are CC-BY-4.0',
    specimen: 'One adult female central nervous system reconstructed by electron microscopy.',
    redistribution: 'FlyLab bundles factual records and links to the static dataset, not article text.',
  },
  {
    id: 'SRC-BANC-DATAVERSE-V3',
    kind: 'dataset',
    title: 'BANC static dataset',
    url: 'https://doi.org/10.7910/DVN/7WTH1N',
    doi: '10.7910/DVN/7WTH1N',
    citation: 'BANC static dataset, Dataverse version 3.0, snapshot banc_888.',
    version: '3.0 / banc_888',
    access: 'Open static data snapshot with file-level checksums.',
    license: 'CC-BY-4.0',
    specimen: BANC_V888_BUNDLE.specimen,
    redistribution: 'Attribution required; exact source-file identifiers and hashes are retained.',
    notes: 'Incomplete reconstruction: the lamina and ocellar ganglion are absent, and other reconstruction limitations remain.',
  },
  {
    id: 'SRC-MANC-V121',
    kind: 'dataset',
    title: 'Male Adult Nerve Cord connectome',
    url: MANC_V121_REFERENCE.sourceUrl,
    citation: 'FlyEM MANC release manc:v1.2.1.',
    version: MANC_V121_REFERENCE.datasetId,
    access: 'Open connectome release page.',
    license: MANC_V121_REFERENCE.license,
    specimen: MANC_V121_REFERENCE.specimen,
    redistribution: 'Attribution required.',
    notes: MANC_V121_REFERENCE.matchSemantics,
  },
  {
    id: 'SRC-FLYGYM-NM-2024',
    kind: 'article',
    title: 'NeuroMechFly v2: simulating embodied sensorimotor control in adult Drosophila',
    url: 'https://doi.org/10.1038/s41592-024-02497-y',
    doi: '10.1038/s41592-024-02497-y',
    citation: 'Wang-Chen et al., Nature Methods (2024)',
    version: 'Version of record (2024)',
    access: 'Primary publication.',
    license: 'Article terms',
    specimen: 'Adult-fly embodied neuromechanical model; not a whole-brain or neuron-dynamics simulation.',
    redistribution: 'No article text or figures are bundled.',
  },
  {
    id: 'SRC-FLYGYM-CODE-V210',
    kind: 'software',
    title: 'FlyGym v2.1.0',
    url: 'https://github.com/NeLy-EPFL/flygym/releases/tag/v2.1.0',
    citation: 'NeLy-EPFL FlyGym release v2.1.0.',
    version: 'v2.1.0 / ca65a510c2afe6ac61c51df4f274c8d190c2f95f',
    access: 'Open source release and browser README.',
    license: 'Apache-2.0',
    specimen: 'Software body, physics, sensors, and controller framework; no biological specimen.',
    redistribution: 'Reuse under Apache-2.0 with required notices.',
    notes: 'Pinned browser dependencies: MuJoCo-WASM 3.9.0 and Three.js 0.169.0.',
  },
];

export const EVIDENCE: EvidenceRecord[] = [
  {
    id: 'E-MDN-ACTIVATION-001',
    label: 'MDN activation and backward locomotion',
    claim: 'Under Bidaye et al.’s adult genetic-activation conditions, activating MDNs was sufficient to elicit backward walking; acute bilateral optogenetic activation also elicited backward locomotion in Sen et al.’s reported assay.',
    provenance: 'measured',
    sourceIds: ['SRC-BIDAYE-SCIENCE-2014', 'SRC-SEN-CURRENT-BIOLOGY-2017'],
    context: 'Adult Drosophila under two MDN-specific perturbation protocols.',
    caution: 'These are assay- and protocol-specific sufficiency results, not a guarantee for every fly or a quantitative dose-response law for this simulator.',
  },
  {
    id: 'E-DN-SCREEN-002',
    label: 'Broad descending-neuron screen context',
    claim: 'Cande et al. screened 130 sparse split-GAL4 lines targeting approximately 160 neurons across 58 anatomical types in solitary adult males.',
    provenance: 'measured',
    sourceIds: ['SRC-CANDE-ELIFE-2018', 'SRC-CANDE-DRYAD-V1'],
    context: 'Broad screen context for future descending-neuron expansion, not an MDN-specific result.',
    caution: 'Do not cite this screen as validating MDN causality or automatically assign a driver-line phenotype to one BANC neuron.',
  },
  {
    id: 'E-BANC-PATH-003',
    label: 'Pinned MDN-to-LBL40 anatomical contacts',
    claim: `The pinned BANC v888 edge list contains four directed MDN→LBL40 rows totaling ${BANC_V888_MDN_LBL40_TOTAL_CONTACTS} predicted contacts.`,
    provenance: 'connectome_inferred',
    sourceIds: ['SRC-BANC-NATURE-2026', 'SRC-BANC-DATAVERSE-V3'],
    context: 'Four selected edge rows from the v3-derived directed edge list in one adult female BANC specimen.',
    caution: 'Putative anatomical contacts are not physiological weights, connection probabilities, activity measurements, or causal efficacy. FlyLab preserves norm without assigning it a biological interpretation.',
  },
  {
    id: 'E-FLYLAB-MODEL-004',
    label: 'FlyLab reduced-order model prediction',
    claim: 'FlyLab converts a hand-authored, unitless MDN-inspired controller drive into a seeded reduced-order trajectory and behavioral metrics.',
    provenance: 'simulation_predicted',
    sourceIds: ['SRC-FLYGYM-NM-2024', 'SRC-FLYGYM-CODE-V210'],
    context: 'FlyGym v2.1.0 is the pinned embodied simulation reference; the current FlyLab browser model is not a FlyGym execution or a neural simulation.',
    caution: MODEL_MANIFEST.boundary,
  },
  {
    id: 'E-MDN-SILENCING-005',
    label: 'MDN silencing and barrier-evoked retreat',
    claim: 'Silencing MDNs impaired backward walking when flies encountered an impassable barrier in Bidaye et al.’s assay.',
    provenance: 'measured',
    sourceIds: ['SRC-BIDAYE-SCIENCE-2014'],
    context: 'Adult Drosophila under the reported targeted-silencing and barrier assay conditions.',
    caution: 'This is an assay-specific impairment result, not a claim that MDNs are the only route to every form of backward locomotion.',
  },
  {
    id: 'E-MDN-LATERALITY-006',
    label: 'MDN recruitment and turning bias',
    claim: 'In Sen et al.’s stochastic activation assay, total MDN recruitment tracked backward translation, while asymmetric recruitment biased backward turning.',
    provenance: 'measured',
    sourceIds: ['SRC-SEN-CURRENT-BIOLOGY-2017'],
    context: 'Stochastic activation in adult Drosophila; asymmetric activation favored contralateral backward turning in the reported assay.',
    caution: 'Do not restate this as a universal rule that symmetric recruitment always yields straight retreat or that one simulator control unit equals one recruited neuron.',
  },
  {
    id: 'E-BANC-MDN-INVENTORY-007',
    label: 'Pinned BANC MDN inventory',
    claim: 'The pinned BANC v888 metadata contains four proofread rows with cell_type == MDN: two left and two right.',
    provenance: 'derived',
    sourceIds: ['SRC-BANC-DATAVERSE-V3'],
    context: 'A deterministic filter of banc_888_meta.feather in one adult female specimen.',
    caution: 'This is a specimen-level inventory, not a universal MDN count across flies. Use banc_888_id as the pinned join key; live root IDs can change.',
  },
  {
    id: 'E-FENG-LBL40-008',
    label: 'LBL40 function in backward walking',
    claim: 'LBL40 contributes to hindleg tibia flexion—the power stroke during stance—in MDN-induced backward walking.',
    provenance: 'measured',
    sourceIds: ['SRC-FENG-NCOMMS-2020'],
    context: 'Adult Drosophila motor-circuit experiments reported by Feng et al.',
    caution: 'The BANC MDN→LBL40 rows are separate anatomical evidence and do not quantify this physiological contribution.',
  },
  {
    id: 'E-FENG-LUL130-009',
    label: 'LUL130 function without a bundled BANC node',
    claim: 'LUL130 facilitates leg lifting at the end of stance to initiate swing during MDN-induced backward walking.',
    provenance: 'measured',
    sourceIds: ['SRC-FENG-NCOMMS-2020'],
    context: LUL130_BUNDLE_STATUS.statement,
    caution: 'No LUL130 annotation was found in the pinned BANC v888 metadata, so FlyLab must not invent or assign a BANC node ID for it.',
  },
];

export const CIRCUITS: CircuitRecord[] = [
  {
    id: 'circuit_mdn_adult',
    name: 'Moonwalker descending neurons',
    abbreviation: 'MDN',
    stage: 'adult',
    sex: 'any',
    laterality: 'bilateral_pair',
    behaviors: ['backward_walking', 'retreat'],
    evidenceIds: [
      'E-MDN-ACTIVATION-001',
      'E-DN-SCREEN-002',
      'E-BANC-PATH-003',
      'E-FLYLAB-MODEL-004',
      'E-MDN-SILENCING-005',
      'E-MDN-LATERALITY-006',
      'E-BANC-MDN-INVENTORY-007',
      'E-FENG-LBL40-008',
      'E-FENG-LUL130-009',
    ],
    summary: 'An adult descending-neuron target with assay-specific activation and silencing evidence. The pinned BANC v888 specimen contributes four proofread MDN rows—two on each side—and predicted MDN→LBL40 anatomy.',
  },
];

export const DEFAULT_GOAL = 'Explore whether a unitless MDN-inspired model drive predicts adult-fly retreat.';

export const METRIC_LABELS: Record<MetricName, { label: string; unit: string }> = {
  backward_distance_mm: { label: 'Backward distance', unit: 'mm' },
  signed_speed_mm_s: { label: 'Signed speed', unit: 'mm/s' },
  response_latency_ms: { label: 'Response latency', unit: 'ms' },
  heading_change_deg: { label: 'Heading change', unit: '°' },
  stance_stability: { label: 'Stance stability', unit: 'index' },
};

export function stableHash(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function jitter(random: () => number, scale = 1) {
  return ((random() + random() + random() + random()) / 4 - 0.5) * scale;
}

export function makeHypothesis(input: Omit<Hypothesis, 'id' | 'provenance'>): Hypothesis {
  return {
    ...input,
    id: `hyp_${stableHash(input)}`,
    provenance: 'agent_hypothesized',
  };
}

export function designExperiment(input: {
  hypothesisId: string;
  targetCircuitId: string;
  perturbation: 'activate' | 'silence';
  laterality: Exclude<Laterality, 'none'>;
  activationLevel: number;
  onsetMs: number;
  durationMs: number;
  trialDurationMs: number;
  replicates: number;
  includeBaseline: boolean;
  includeShamControl: boolean;
  seed: number;
}): Experiment {
  const conditions: TrialCondition[] = [];
  if (input.includeBaseline) {
    conditions.push({ id: 'condition_baseline', label: 'Baseline · no model drive', kind: 'baseline', laterality: 'none', activationLevel: 0 });
  }
  if (input.includeShamControl) {
    conditions.push({ id: 'condition_sham', label: 'Model sham control', kind: 'sham', laterality: 'none', activationLevel: input.activationLevel });
  }
  conditions.push({
    id: `condition_${input.laterality}`,
    label: `${input.laterality[0].toUpperCase()}${input.laterality.slice(1)} MDN-inspired ${input.perturbation === 'activate' ? 'drive' : 'suppression'}`,
    kind: 'perturbation',
    laterality: input.laterality,
    activationLevel: input.activationLevel,
  });
  if (input.laterality === 'bilateral') {
    conditions.push(
      { id: 'condition_left', label: 'Left-only MDN-inspired model drive', kind: 'perturbation', laterality: 'left', activationLevel: input.activationLevel },
      { id: 'condition_right', label: 'Right-only MDN-inspired model drive', kind: 'perturbation', laterality: 'right', activationLevel: input.activationLevel },
    );
  }

  const identity = { ...input, conditions: conditions.map((condition) => condition.id) };
  return {
    id: `exp_${stableHash(identity)}`,
    hypothesisId: input.hypothesisId,
    targetCircuitId: input.targetCircuitId,
    perturbation: input.perturbation,
    primaryLaterality: input.laterality,
    activationLevel: clamp(input.activationLevel, 0, 1),
    onsetMs: input.onsetMs,
    durationMs: input.durationMs,
    trialDurationMs: input.trialDurationMs,
    replicates: input.replicates,
    seed: input.seed,
    conditions,
    approved: false,
    model: MODEL_MANIFEST,
    assumptions: [
      'Activation level is a unitless model control, not optical power or firing rate.',
      'The MDN-to-controller mapping is hand-authored and versioned; it is not fitted neural dynamics.',
      'BANC snapshot IDs and anatomical contacts are provenance records, not executable neurons or physiological weights.',
      'FlyGym v2.1.0 is an embodied simulation reference; this reduced-order browser model does not execute FlyGym.',
      'Simulator intervals describe seeded model variation, not biological population inference.',
    ],
  };
}

function conditionEffect(condition: TrialCondition, experiment: Experiment) {
  if (condition.kind === 'baseline') return 0;
  if (condition.kind === 'sham') return 0;
  const durationGain = clamp(experiment.durationMs / 1800, 0.35, 1.2);
  const lateralityGain = condition.laterality === 'bilateral' ? 1 : 0.72;
  const perturbationDirection = experiment.perturbation === 'activate' ? 1 : -0.55;
  return clamp(condition.activationLevel * durationGain * lateralityGain * perturbationDirection, -0.6, 1.1);
}

function simulateTrajectory(condition: TrialCondition, experiment: Experiment, effect: number, seed: number): TrajectoryPoint[] {
  const random = mulberry32(seed);
  const points: TrajectoryPoint[] = [];
  let x = 0;
  let y = 0;
  let heading = 0;
  const steps = 80;
  for (let step = 0; step <= steps; step += 1) {
    const t = (experiment.trialDurationMs * step) / steps;
    const active = condition.kind === 'perturbation' && t >= experiment.onsetMs && t <= experiment.onsetMs + experiment.durationMs;
    const drive = active ? effect : 0;
    const direction = drive > 0.12 ? -1 : 1;
    const lateralSign = condition.laterality === 'left' ? -1 : condition.laterality === 'right' ? 1 : 0;
    heading += active ? lateralSign * (0.32 + drive * 0.34) : jitter(random, 0.08);
    const speed = 0.018 + Math.abs(drive) * 0.036;
    x += Math.sin((heading * Math.PI) / 180) * speed + jitter(random, 0.006);
    y += direction * Math.cos((heading * Math.PI) / 180) * speed + jitter(random, 0.006);
    points.push({ t: Math.round(t), x, y, heading, active });
  }
  return points;
}

export function simulateExperiment(experiment: Experiment): SimulationBatch {
  const conditionRuns = experiment.conditions.map((condition, conditionIndex): ConditionRun => {
    const effect = conditionEffect(condition, experiment);
    const replicates = Array.from({ length: experiment.replicates }, (_, replicateIndex): ReplicateResult => {
      const seed = experiment.seed + conditionIndex * 1009 + replicateIndex * 37;
      const random = mulberry32(seed);
      const reverseProbability = clamp(0.08 + Math.max(0, effect) * 0.79, 0.02, 0.97);
      const reverseInitiated = random() < reverseProbability;
      const signedSpeedMmS = reverseInitiated
        ? -(0.62 + Math.max(0, effect) * 2.25 + jitter(random, 0.36))
        : 0.92 - Math.max(0, effect) * 0.25 + jitter(random, 0.28);
      const responseLatencyMs = reverseInitiated
        ? clamp(540 + (1 - Math.max(0, effect)) * 1320 + jitter(random, 260), 180, experiment.trialDurationMs)
        : experiment.trialDurationMs;
      const activeSeconds = Math.max(0, experiment.trialDurationMs - responseLatencyMs) / 1000;
      const backwardDistanceMm = reverseInitiated ? Math.abs(signedSpeedMmS) * activeSeconds * (0.72 + random() * 0.2) : 0;
      const lateralSign = condition.laterality === 'left' ? -1 : condition.laterality === 'right' ? 1 : 0;
      const headingChangeDeg = lateralSign * (11 + Math.max(0, effect) * 34) + jitter(random, condition.laterality === 'bilateral' ? 7 : 12);
      const stanceStability = clamp(0.91 - Math.max(0, effect) * 0.08 + jitter(random, 0.06), 0.62, 0.98);
      return {
        id: `run_${stableHash({ experiment: experiment.id, condition: condition.id, replicateIndex, seed })}`,
        conditionId: condition.id,
        seed,
        reverseInitiated,
        backwardDistanceMm,
        signedSpeedMmS,
        responseLatencyMs,
        headingChangeDeg,
        stanceStability,
      };
    });

    return {
      conditionId: condition.id,
      label: condition.label,
      laterality: condition.laterality,
      runIds: replicates.map((replicate) => replicate.id),
      replicates,
      trajectory: simulateTrajectory(condition, experiment, effect, experiment.seed + conditionIndex * 1009),
    };
  });

  const identity = conditionRuns.flatMap((condition) => condition.runIds);
  return {
    id: `batch_${stableHash({ experiment: experiment.id, identity })}`,
    experimentId: experiment.id,
    status: 'complete',
    conditionRuns,
    runHash: `fnv1a:${stableHash(identity)}`,
    protocol: {
      onsetMs: experiment.onsetMs,
      durationMs: experiment.durationMs,
      trialDurationMs: experiment.trialDurationMs,
      replicates: experiment.replicates,
      seed: experiment.seed,
    },
    model: MODEL_MANIFEST,
    provenance: ['simulation_predicted'],
  };
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

export function analyzeBatch(
  batch: SimulationBatch,
  metrics: MetricName[],
  analysisStartMs = 0,
  analysisEndMs = batch.protocol.trialDurationMs,
): Analysis {
  const conditions = batch.conditionRuns.map((run): ConditionAnalysis => {
    const responsive = run.replicates.filter((replicate) => replicate.reverseInitiated);
    return {
      conditionId: run.conditionId,
      label: run.label,
      n: run.replicates.length,
      reverseInitiationProbability: mean(run.replicates.map((replicate) => replicate.reverseInitiated ? 1 : 0)),
      backwardDistanceMm: mean(run.replicates.map((replicate) => replicate.backwardDistanceMm)),
      signedSpeedMmS: mean(run.replicates.map((replicate) => replicate.signedSpeedMmS)),
      responseLatencyMs: responsive.length ? mean(responsive.map((replicate) => replicate.responseLatencyMs)) : 5000,
      headingChangeDeg: mean(run.replicates.map((replicate) => replicate.headingChangeDeg)),
      stanceStability: mean(run.replicates.map((replicate) => replicate.stanceStability)),
    };
  });
  return {
    id: `analysis_${stableHash({ batch: batch.id, metrics, analysisStartMs, analysisEndMs })}`,
    batchId: batch.id,
    metrics,
    conditions,
    windowMs: { start: analysisStartMs, end: analysisEndMs },
    methodVersion: 'flylab.behavior-metrics.v1',
    provenance: ['derived', 'simulation_predicted'],
    warning: 'These estimates summarize seeded simulator variation. They are not biological confidence intervals or new experimental evidence.',
  };
}

function metricValue(condition: ConditionAnalysis, metric: MetricName) {
  switch (metric) {
    case 'backward_distance_mm': return condition.backwardDistanceMm;
    case 'signed_speed_mm_s': return condition.signedSpeedMmS;
    case 'response_latency_ms': return condition.responseLatencyMs;
    case 'heading_change_deg': return Math.abs(condition.headingChangeDeg);
    case 'stance_stability': return condition.stanceStability;
  }
}

export function compareAnalyses(analyses: Analysis[], objectiveMetric: MetricName, objective: 'maximize' | 'minimize' | 'target', targetValue: number | undefined, budget: number): Comparison {
  const uniqueConditions = new Map<string, ConditionAnalysis>();
  analyses.flatMap((analysis) => analysis.conditions).forEach((condition) => uniqueConditions.set(condition.conditionId, condition));
  const rows = [...uniqueConditions.values()].map((condition) => ({
    conditionId: condition.conditionId,
    label: condition.label,
    value: metricValue(condition, objectiveMetric),
  }));
  rows.sort((a, b) => {
    if (objective === 'minimize') return a.value - b.value;
    if (objective === 'target') return Math.abs(a.value - (targetValue ?? 0)) - Math.abs(b.value - (targetValue ?? 0));
    return b.value - a.value;
  });
  return {
    id: `comparison_${stableHash({ analyses: analyses.map((analysis) => analysis.id), objectiveMetric, objective, targetValue, budget })}`,
    analysisIds: analyses.map((analysis) => analysis.id),
    objectiveMetric,
    rankedConditions: rows,
    proposal: {
      id: `proposal_${stableHash({ objectiveMetric, winner: rows[0]?.conditionId, budget })}`,
      rationale: 'Probe a lower and higher unitless model-drive level around the current bilateral condition to test whether the predicted response is drive-sensitive.',
      activationLevels: [0.45, 0.8],
      replicateBudget: budget,
      provenance: 'agent_hypothesized',
    },
    limitations: [
      'Ranking is conditional on the selected FlyLab model and objective metric.',
      'The proposed follow-up is an information-seeking simulation, not a biological protocol recommendation.',
    ],
  };
}

export function round(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

export async function sha256(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  return `fnv1a:${stableHash(text)}`;
}
