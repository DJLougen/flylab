import {
  BANC_V888_BUNDLE,
  BANC_V888_MDN_LBL40_TOTAL_CONTACTS,
  BANC_V888_MORPHOLOGY_BUNDLE,
  LUL130_BUNDLE_STATUS,
  MANC_V121_REFERENCE,
} from './mdn-banc.js';
import {
  motorMapForCircuit,
  type BodyPartId,
  type EmbodiedMotorMap,
} from './embodied-fly.js';

export {
  BODY_PART_IDS,
  EMBODIED_MOTOR_MAPS,
  EMBODIMENT_COVERAGE,
  embodimentCoverageForCircuits,
  motorMapForCircuit,
  motorMapsForQuery,
  type BodyPartId,
  type EmbodiedMotorMap,
  type MotorPathEdge,
  type MotorPathNode,
  type MotorProgramId,
} from './embodied-fly.js';

export {
  BANC_V888_BUNDLE,
  BANC_V888_CELLS,
  BANC_V888_EDGES,
  BANC_V888_MDN_LBL40_TOTAL_CONTACTS,
  BANC_V888_MORPHOLOGY_BUNDLE,
  BANC_V888_MORPHOLOGY_FILES,
  BANC_V888_SOURCE_FILES,
  LUL130_BUNDLE_STATUS,
  MANC_V121_REFERENCE,
  type BancRegion,
  type BancSide,
  type BancV888CellRecord,
  type BancV888EdgeRecord,
  type PinnedDataFile,
  type PinnedMorphologyFile,
} from './mdn-banc.js';

export type ProvenanceLabel =
  | 'measured'
  | 'derived'
  | 'connectome_inferred'
  | 'simulation_predicted'
  | 'agent_hypothesized';

export type EvidenceRole = 'hypothesis_support' | 'model_context' | 'catalog_context';
export type EvidenceSupportKind =
  | 'perturbation_effect'
  | 'structural_path'
  | 'specimen_inventory'
  | 'motor_context'
  | 'model_method'
  | 'catalog_context';

export interface EvidenceSourceSupport {
  sourceId: string;
  relation: 'claim_support' | 'dataset_basis' | 'method_definition' | 'embodiment_reference' | 'catalog_context';
  locator: string;
  supports: string;
}

export const PROVENANCE_DEFINITIONS: Record<ProvenanceLabel, string> = {
  measured: 'An empirical result reported under the cited study conditions; it is not automatically universal or reproduced by FlyLab.',
  derived: 'A deterministic filter, aggregation, or calculation from pinned source records; it is not a new wet-lab measurement.',
  connectome_inferred: 'An anatomical inference from EM reconstruction or annotations; it does not establish activity, physiological efficacy, or behavior.',
  simulation_predicted: 'An output conditional on the stated model, controller mapping, parameters, and seed; it is not biological validation.',
  agent_hypothesized: 'An untested proposal authored by an agent that must remain distinct from source evidence and simulation output.',
};

export type Laterality = 'bilateral' | 'left' | 'right' | 'none';
export const ANALYSIS_METRICS = [
  'backward_distance_mm',
  'signed_speed_mm_s',
  'response_latency_ms',
  'heading_change_deg',
  'stance_stability',
  'short_mode_escape_probability',
  'vertical_displacement_mm',
  'wing_recruitment',
  'leg_recruitment',
] as const;
export type MetricName = (typeof ANALYSIS_METRICS)[number];

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

export interface VisualReferenceRecord extends SourceRecord {
  kind: 'article';
  relation: 'visual_reference';
  hypothesisEligible: false;
  scope: string;
  boundary: string;
  provenance: 'derived';
}

export interface EvidenceRecord {
  id: string;
  label: string;
  claim: string;
  provenance: ProvenanceLabel;
  sourceIds: string[];
  context: string;
  caution: string;
  role: EvidenceRole;
  support: {
    kind: EvidenceSupportKind;
    perturbations?: Array<'activate' | 'silence'>;
    behaviors?: string[];
  };
  sourceSupport: EvidenceSourceSupport[];
}

export interface CircuitRecord {
  id: string;
  name: string;
  abbreviation: string;
  stage: 'adult';
  sex: 'source_specific';
  sexBoundary: string;
  laterality: 'bilateral_population';
  specimenInventory?: {
    dataset: 'BANC';
    snapshot: 'banc_888';
    specimen: string;
    mdnTotal: 4;
    mdnPerSide: { left: 2; right: 2 };
    evidenceId: 'E-BANC-MDN-INVENTORY-007';
    provenance: 'derived';
    boundary: string;
  };
  motorMapId: string;
  targetBodyParts: BodyPartId[];
  modelCoverage: 'mapped_reduced_order';
  behaviors: string[];
  evidenceIds: string[];
  summary: string;
  provenance: ['derived'];
}

export interface Hypothesis {
  id: string;
  circuitId: string;
  claim: string;
  predictedBehavior: string;
  perturbation: 'activate' | 'silence';
  evidenceIds: string[];
  causalEvidenceIds: string[];
  falsificationCriterion: string;
  provenance: 'agent_hypothesized';
}

export interface TrialCondition {
  id: string;
  label: string;
  kind: 'baseline' | 'sham' | 'perturbation';
  laterality: Laterality;
  nominalControlLevel: number;
  expectedModelEffect:
    | 'no_retreat_drive'
    | 'zero_effect_sham'
    | 'reference_retreat_drive'
    | 'reference_drive_sham'
    | 'activation_increases_retreat_drive'
    | 'suppression_reduces_reference_drive'
    | 'no_motor_drive'
    | 'reference_motor_drive'
    | 'activation_increases_motor_drive'
    | 'suppression_reduces_reference_motor_drive';
}

export interface Experiment {
  id: string;
  hypothesisId: string;
  targetCircuitId: string;
  behavior: string;
  motorMap: EmbodiedMotorMap;
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
  provenance: ['agent_hypothesized'];
}

export interface ExperimentProtocolSnapshot {
  experimentId: string;
  hypothesisId: string;
  targetCircuitId: string;
  behavior: string;
  motorMapId: string;
  perturbation: Experiment['perturbation'];
  activationLevel: number;
  primaryLaterality: Experiment['primaryLaterality'];
  onsetMs: number;
  durationMs: number;
  trialDurationMs: number;
  replicates: number;
  seed: number;
  conditions: TrialCondition[];
  assumptions: string[];
}

export interface TrajectoryPoint {
  t: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  active: boolean;
  motorOutputActive: boolean;
}

export interface ReplicateResult {
  id: string;
  conditionId: string;
  seed: number;
  reverseInitiated: boolean;
  responseInitiated: boolean;
  shortModeEscapeInitiated: boolean;
  backwardDistanceMm: number;
  signedSpeedMmS: number;
  responseLatencyMs: number | null;
  headingChangeDeg: number;
  stanceStability: number;
  verticalDisplacementMm: number;
  wingRecruitment: number;
  legRecruitment: number;
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
  targetCircuitId: string;
  behavior: string;
  motorMap: EmbodiedMotorMap;
  status: 'complete';
  conditionRuns: ConditionRun[];
  runHash: string;
  protocol: ExperimentProtocolSnapshot;
  model: typeof MODEL_MANIFEST;
  provenance: ['simulation_predicted'];
}

export interface ConditionAnalysis {
  conditionId: string;
  label: string;
  n: number;
  reverseInitiationProbability: number;
  responseInitiationProbability: number;
  shortModeEscapeProbability: number;
  backwardDistanceMm: number;
  signedSpeedMmS: number;
  responseLatencyMs: number | null;
  responsiveN: number;
  headingChangeDeg: number;
  stanceStability: number;
  verticalDisplacementMm: number;
  wingRecruitment: number;
  legRecruitment: number;
}

export interface Analysis {
  id: string;
  batchId: string;
  metrics: MetricName[];
  conditions: ConditionAnalysis[];
  windowMs: { start: number; end: number };
  methodVersion: 'flylab.behavior-metrics.v3';
  provenance: ['derived', 'simulation_predicted'];
  warning: string;
}

export interface Comparison {
  id: string;
  analysisIds: string[];
  objectiveMetric: MetricName;
  objective: 'maximize' | 'minimize' | 'target';
  targetValue?: number;
  rankedConditions: Array<{ conditionId: string; label: string; value: number | null }>;
  proposal: {
    id: string;
    rationale: string;
    activationLevels: number[];
    replicateBudget: number;
    provenance: 'agent_hypothesized';
  };
  limitations: string[];
  provenance: ['derived', 'simulation_predicted'];
}

export const MODEL_PARAMETERS = {
  name: 'flylab.mapped-motor-parameters.v2',
  provenance: 'agent_hypothesized',
  calibration: 'Hand-authored for deterministic challenge demonstration; not fitted to the cited fly assays, BANC contact counts, neural recordings, or FlyGym output.',
  unitBoundary: 'Distances and speeds use declared model-scale millimeter units. They are internally consistent but are not biologically calibrated effect sizes.',
  durationReferenceMs: 1800,
  durationGainBounds: [0.35, 1.2],
  unilateralGain: 0.72,
  maximumMotorDrive: 1.1,
  silencingReferenceMotorDrive: 0.72,
  maximumSuppressionFraction: 0.92,
  reverseProbability: { baseline: 0.08, driveGain: 0.79, minimum: 0.02, maximum: 0.97 },
  signedSpeed: { forwardBaselineMmS: 0.92, forwardDrivePenaltyMmS: 0.25, reverseInterceptMmS: 0.62, reverseDriveGainMmS: 2.25, jitterScaleMmS: 0.36, forwardJitterScaleMmS: 0.28 },
  responseLatency: { interceptMs: 540, inverseDriveGainMs: 1320, jitterScaleMs: 260, minimumClampMs: 180 },
  backwardDistanceScale: { minimum: 0.72, maximum: 0.92 },
  heading: { baseDeg: 11, driveGainDeg: 34, bilateralJitterScaleDeg: 7, unilateralJitterScaleDeg: 12 },
  stanceStability: { baseline: 0.91, drivePenalty: 0.08, jitterScale: 0.06, minimum: 0.62, maximum: 0.98 },
  reverseWalk: {
    legRecruitment: { baseline: 0.18, driveGain: 0.72, jitterScale: 0.06 },
  },
  escapeTakeoff: {
    responseProbability: { baseline: 0.04, driveGain: 0.9, minimum: 0.01, maximum: 0.98 },
    responseLatency: { interceptMs: 165, inverseDriveGainMs: 510, jitterScaleMs: 90, minimumClampMs: 55 },
    verticalDisplacement: { interceptModelMm: 0.42, driveGainModelMm: 2.6, jitterScaleModelMm: 0.24 },
    wingRecruitment: { baseline: 0.05, driveGain: 0.9, jitterScale: 0.08 },
    legRecruitment: { baseline: 0.06, driveGain: 0.92, jitterScale: 0.08 },
    forwardSpeedGainModelMmS: 0.7,
    trajectoryLiftGainModelMm: 0.035,
    trajectoryForwardGainModelMm: 0.018,
  },
  trajectory: {
    steps: 80,
    reverseDriveThreshold: 0.12,
    baseStepModelMm: 0.018,
    driveStepGainModelMm: 0.036,
    positionJitterScaleModelMm: 0.006,
    headingJitterScaleDeg: 0.08,
    activeTurnBaseDegPerStep: 0.32,
    activeTurnGainDegPerStep: 0.34,
  },
} as const;

export const MODEL_MANIFEST = {
  name: 'FlyLab mapped-motor embodiment model',
  version: '0.2.0',
  controller: 'mapped-circuit-to-body-adapter.v1',
  environment: 'open-field-model-scale.v2',
  controllerMapping: {
    provenance: 'agent_hypothesized',
    statement: 'Each mapping from a source-backed circuit path to a body controller is hand-authored and versioned; it is not an inferred firing rate, synaptic simulation, muscle model, or optogenetic dose.',
  },
  embodimentReference: {
    name: 'FlyGym',
    version: 'v2.1.0',
    commit: 'ca65a510c2afe6ac61c51df4f274c8d190c2f95f',
    releaseUrl: 'https://github.com/NeLy-EPFL/flygym/releases/tag/v2.1.0',
    license: 'Apache-2.0',
    browserStack: { mujocoWasm: '3.9.0', threeJs: '0.169.0' },
  },
  parameterization: MODEL_PARAMETERS,
  boundary: 'Hand-authored, uncalibrated reduced-order body-controller prediction only. It does not execute connectome neurons, electrical or chemical synapses, neural dynamics, muscles, aerodynamics, FlyGym, or a wet-lab perturbation, and it is not independent biological validation.',
} as const;

export const VISUAL_REFERENCES: readonly VisualReferenceRecord[] = [
  {
    id: 'SRC-JURGENS-GENETICS-2024',
    kind: 'article',
    relation: 'visual_reference',
    title: 'An anatomical atlas of Drosophila melanogaster—the wild-type',
    url: 'https://doi.org/10.1093/genetics/iyae129',
    doi: '10.1093/genetics/iyae129',
    citation: 'Jürgens KJJ, Drechsler M, Paululat A. Genetics 228:iyae129 (2024).',
    version: 'Version of record (2024)',
    access: 'Open primary article.',
    license: 'CC-BY-4.0',
    specimen: 'Wild-type Drosophila larvae and adults; FlyLab uses only the adult external-anatomy reference.',
    redistribution: 'No article text or figures are bundled.',
    scope: 'Reference for the major adult external landmarks in FlyLab’s procedural Three.js animal.',
    boundary: 'Visual reference only. The FlyLab mesh is not a scan, specimen reconstruction, segmentation, or morphometric derivative of this atlas.',
    hypothesisEligible: false,
    provenance: 'derived',
  },
  {
    id: 'SRC-CHUN-ELIFE-2021',
    kind: 'article',
    relation: 'visual_reference',
    title: 'Drosophila uses a tripod gait across all walking speeds, and the geometry of the tripod is important for speed control',
    url: 'https://doi.org/10.7554/eLife.65878',
    doi: '10.7554/eLife.65878',
    citation: 'Chun C, Biswas T, Bhandawat V. eLife 10:e65878 (2021).',
    version: 'Version of record (2021)',
    access: 'Open primary article.',
    license: 'CC-BY-4.0',
    specimen: 'Adult Drosophila measured during straight forward walking.',
    redistribution: 'No article text, figures, or measured trajectories are bundled.',
    scope: 'Display-level reference for an alternating modified-tripod motion cue.',
    boundary: 'Visual reference only. The study concerns forward walking, not backward-gait biomechanics, and it does not support FlyLab trajectory values, foot contacts, forces, or joint dynamics.',
    hypothesisEligible: false,
    provenance: 'derived',
  },
] as const;

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
    morphology: BANC_V888_MORPHOLOGY_BUNDLE,
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
  fanc: {
    name: 'Female Adult Nerve Cord connectome',
    articleVersion: 'Azevedo et al. 2024',
    articleDoi: 'https://doi.org/10.1038/s41586-024-07389-x',
    specimen: 'One adult-female ventral nerve cord reconstructed by electron microscopy.',
    scope: 'Claim-level structural context for the giant-fiber leg-and-wing escape branches.',
    bundled: false,
    boundary: 'No FANC cell or edge is bundled, executed, or represented as a BANC identity in FlyLab.',
  },
  flygym: MODEL_MANIFEST.embodimentReference,
  visualReferences: VISUAL_REFERENCES,
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
    access: 'Primary article (open access).',
    license: 'CC-BY-4.0',
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
    access: 'The two cited Feather inputs are unrestricted; the broader deposit has mixed file-level access.',
    license: 'CC-BY-4.0',
    specimen: BANC_V888_BUNDLE.specimen,
    redistribution: 'Attribution required; exact source-file identifiers and hashes are retained.',
    notes: 'Incomplete reconstruction: the lamina and ocellar ganglion are absent, and other reconstruction limitations remain. FlyLab uses the v3 future-work edge product (postsynapse size ≥10 voxels); the Bates et al. paper analyses use v2 (≥5).',
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
    id: 'SRC-VONREYN-NN-2014',
    kind: 'article',
    title: 'A spike-timing mechanism for action selection',
    url: 'https://doi.org/10.1038/nn.3741',
    doi: '10.1038/nn.3741',
    citation: 'von Reyn CR et al. Nature Neuroscience 17, 962–970 (2014).',
    version: 'Version of record (2014)',
    access: 'Primary publication record; cite and paraphrase.',
    license: 'Publisher copyright',
    specimen: 'Adult Drosophila in looming-evoked escape, targeted GF activation and GF silencing assays, with intracellular recordings.',
    redistribution: 'No article text, figures, or videos are bundled.',
    notes: 'Supports assay-scoped necessity and sufficiency of giant fibers for short-mode escape; it does not define FlyLab controller parameters.',
  },
  {
    id: 'SRC-KING-JNEUROCYTOL-1980',
    kind: 'article',
    title: 'Anatomy of the giant fibre pathway in Drosophila. I. Three thoracic components of the pathway',
    url: 'https://doi.org/10.1007/BF01205017',
    doi: '10.1007/BF01205017',
    citation: 'King DG, Wyman RJ. Journal of Neurocytology 9, 753–770 (1980).',
    version: 'Version of record (1980)',
    access: 'Primary publication record; cite and paraphrase.',
    license: 'Publisher copyright',
    specimen: 'Adult Drosophila giant-fiber pathway anatomy and stimulated motor output.',
    redistribution: 'No article text or figures are bundled.',
    notes: 'Supports the GF→TTMn jump-muscle and GF→PSI→DLMn flight-muscle pathway at the level reported by the study.',
  },
  {
    id: 'SRC-ALLEN-EJN-2007',
    kind: 'article',
    title: 'The chemical component of the mixed GF-TTMn synapse in Drosophila melanogaster uses acetylcholine as its neurotransmitter',
    url: 'https://doi.org/10.1111/j.1460-9568.2007.05686.x',
    doi: '10.1111/j.1460-9568.2007.05686.x',
    citation: 'Allen MJ, Murphey RK. European Journal of Neuroscience 26, 439–445 (2007).',
    version: 'Version of record (2007)',
    access: 'Open primary article; cite and paraphrase.',
    license: 'CC BY-NC 2.5 article terms; no source content is bundled.',
    specimen: 'Adult Drosophila GF-to-TTMn electrophysiology and genetic perturbation preparations.',
    redistribution: 'FlyLab stores citation and claim metadata only.',
    notes: 'Supports the mixed electrical/chemical modality of the GF–TTMn synapse and the functional cholinergic chemical component; it does not calibrate FlyLab controller gains.',
  },
  {
    id: 'SRC-AZEVEDO-NATURE-2024',
    kind: 'article',
    title: 'Connectomic reconstruction of a female Drosophila ventral nerve cord',
    url: 'https://doi.org/10.1038/s41586-024-07389-x',
    doi: '10.1038/s41586-024-07389-x',
    citation: 'Azevedo A et al. Nature 631, 360–368 (2024).',
    version: 'Version of record (2024)',
    access: 'Open primary article and freely accessible FANC reconstruction resources.',
    license: 'Article and dataset terms apply; no source content is bundled.',
    specimen: 'One adult-female ventral nerve cord reconstructed by electron microscopy.',
    redistribution: 'FlyLab stores claim-level citations only and does not redistribute FANC data.',
    notes: 'Supports structural context for leg-and-wing coordination during escape. FlyLab does not import its FANC neurons as BANC records or treat electrical coupling as ordinary chemical synapse counts.',
  },
  {
    id: 'SRC-FLYLAB-MODEL-CARD',
    kind: 'software',
    title: 'FlyLab reduced-order model card',
    url: 'https://github.com/DJLougen/flylab/blob/main/docs/MODEL_CARD.md',
    citation: 'FlyLab contributors. FlyLab mapped-motor model card, version 0.2.0 (2026).',
    version: '0.2.0 / mapped-circuit-to-body-adapter.v1',
    access: 'Open source model definition and equations.',
    license: 'Apache-2.0',
    specimen: 'No biological specimen; local deterministic software method.',
    redistribution: 'Reuse under Apache-2.0 with required notices.',
    notes: 'The repository model card is the authoritative source for FlyLab equations. FlyGym is a separate embodiment reference and does not define the local controllers.',
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
  ...VISUAL_REFERENCES,
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
    role: 'hypothesis_support',
    support: { kind: 'perturbation_effect', perturbations: ['activate'], behaviors: ['backward_walking', 'retreat'] },
    sourceSupport: [
      { sourceId: 'SRC-BIDAYE-SCIENCE-2014', relation: 'claim_support', locator: 'Abstract (PMID 24700860); Science 344:97–101', supports: 'MDN activity was reported sufficient to trigger backward walking under the cited activation conditions.' },
      { sourceId: 'SRC-SEN-CURRENT-BIOLOGY-2017', relation: 'claim_support', locator: 'Fig. 1 and Movie S1; Current Biology 27:766–771', supports: 'Acute bilateral MDN activation elicited backward locomotion under the cited adult assay.' },
    ],
  },
  {
    id: 'E-DN-SCREEN-002',
    label: 'Broad descending-neuron screen context',
    claim: 'Cande et al. screened 130 sparse split-GAL4 lines targeting approximately 160 neurons across 58 anatomical types in solitary adult males.',
    provenance: 'measured',
    sourceIds: ['SRC-CANDE-ELIFE-2018', 'SRC-CANDE-DRYAD-V1'],
    context: 'Broad screen context for future descending-neuron expansion, not an MDN-specific result.',
    caution: 'Do not cite this screen as validating MDN causality or automatically assign a driver-line phenotype to one BANC neuron.',
    role: 'catalog_context',
    support: { kind: 'catalog_context' },
    sourceSupport: [
      { sourceId: 'SRC-CANDE-ELIFE-2018', relation: 'catalog_context', locator: 'Introduction screen-design paragraph for 130 lines/~160 neurons/58 types; Discussion limitations paragraph for male-only, solitary-fly scope; Methods—Fly stocks and fly handling for assay details', supports: 'Reports the line, neuron, and anatomical-type counts plus the sex and social-context limits used for broad catalog context.' },
      { sourceId: 'SRC-CANDE-DRYAD-V1', relation: 'catalog_context', locator: 'Dryad dataset version 1 metadata', supports: 'Identifies the associated released screen dataset and version.' },
    ],
  },
  {
    id: 'E-BANC-PATH-003',
    label: 'Pinned MDN-to-LBL40 v3 predicted links',
    claim: `The pinned BANC v888 v3 edge list contains four directed MDN→LBL40 rows totaling ${BANC_V888_MDN_LBL40_TOTAL_CONTACTS} v3-predicted synaptic links after the postsynapse-size ≥10-voxel filter.`,
    provenance: 'connectome_inferred',
    sourceIds: ['SRC-BANC-NATURE-2026', 'SRC-BANC-DATAVERSE-V3'],
    context: 'Four selected edge rows from the v3 future-work directed edge product in one adult female BANC specimen; Bates et al.’s paper analyses use v2 with a postsynapse-size ≥5-voxel filter.',
    caution: 'The v3-predicted synaptic-link counts are not physiological weights, connection probabilities, activity measurements, or causal efficacy. FlyLab preserves norm without assigning it a biological interpretation.',
    role: 'hypothesis_support',
    support: { kind: 'structural_path', behaviors: ['backward_walking', 'retreat'] },
    sourceSupport: [
      { sourceId: 'SRC-BANC-NATURE-2026', relation: 'dataset_basis', locator: 'Data availability; final-print materialization v888 and static edge-list resources', supports: 'Identifies the adult female BANC specimen, v888 materialization, and released connectivity resources.' },
      { sourceId: 'SRC-BANC-DATAVERSE-V3', relation: 'dataset_basis', locator: 'banc_888_edgelist_simple_v3.feather; v3 postsynapse-size ≥10-voxel filter; Dataverse file 13918810; SHA-256 8c296e946f3c69a8c7222f30ad75fa8a98eeb189124fec6df829c9125f4be64b; rows 720575941491012809→720575941669069043 count 52, 720575941491065653→720575941669069043 count 51, 720575941499708745→720575941669107187 count 26, 720575941614906387→720575941669107187 count 24', supports: 'Provides the exact pinned rows and count field used for the four-row, 153-v3-predicted-link record; v3 is the future-work product rather than the paper’s v2 analysis product.' },
    ],
  },
  {
    id: 'E-FLYLAB-MODEL-004',
    label: 'FlyLab reduced-order model method',
    claim: 'FlyLab converts a hand-authored, unitless mapped-circuit controller drive into seeded reduced-order body outputs, trajectories, and behavior-specific metrics.',
    provenance: 'derived',
    sourceIds: ['SRC-FLYLAB-MODEL-CARD', 'SRC-FLYGYM-NM-2024', 'SRC-FLYGYM-CODE-V210'],
    context: 'FlyGym v2.1.0 is the pinned embodied simulation reference; the current FlyLab browser model is not a FlyGym execution or a neural simulation.',
    caution: `${MODEL_MANIFEST.boundary} This record describes the method; only a generated batch is labeled simulation_predicted.`,
    role: 'model_context',
    support: { kind: 'model_method' },
    sourceSupport: [
      { sourceId: 'SRC-FLYLAB-MODEL-CARD', relation: 'method_definition', locator: 'Mapped motor programs; seeded replicate summaries; illustrative condition trajectories', supports: 'Defines the local equations, constants, seed derivation, units, and interpretation boundary.' },
      { sourceId: 'SRC-FLYGYM-NM-2024', relation: 'embodiment_reference', locator: 'Article abstract and methods overview', supports: 'Provides scientific context for an adult-fly embodied simulation framework; it does not define FlyLab equations.' },
      { sourceId: 'SRC-FLYGYM-CODE-V210', relation: 'embodiment_reference', locator: 'Release v2.1.0 at pinned commit ca65a510…', supports: 'Pins the separate embodiment software reference and license; FlyLab does not execute it.' },
    ],
  },
  {
    id: 'E-MDN-SILENCING-005',
    label: 'MDN silencing and barrier-evoked retreat',
    claim: 'Silencing MDNs impaired backward walking when flies encountered an impassable barrier in Bidaye et al.’s assay.',
    provenance: 'measured',
    sourceIds: ['SRC-BIDAYE-SCIENCE-2014'],
    context: 'Adult Drosophila under the reported targeted-silencing and barrier assay conditions.',
    caution: 'This is an assay-specific impairment result, not a claim that MDNs are the only route to every form of backward locomotion.',
    role: 'hypothesis_support',
    support: { kind: 'perturbation_effect', perturbations: ['silence'], behaviors: ['backward_walking', 'retreat'] },
    sourceSupport: [
      { sourceId: 'SRC-BIDAYE-SCIENCE-2014', relation: 'claim_support', locator: 'Abstract (PMID 24700860); Science 344:97–101', supports: 'MDN activity was reported required for barrier-evoked backward walking under the cited silencing assay.' },
    ],
  },
  {
    id: 'E-MDN-LATERALITY-006',
    label: 'MDN recruitment and turning bias',
    claim: 'In Sen et al.’s stochastic activation assay, total MDN recruitment tracked backward translation, while asymmetric recruitment biased backward turning.',
    provenance: 'measured',
    sourceIds: ['SRC-SEN-CURRENT-BIOLOGY-2017'],
    context: 'Stochastic activation in adult Drosophila; asymmetric activation favored contralateral backward turning in the reported assay.',
    caution: 'Do not restate this as a universal rule that symmetric recruitment always yields straight retreat or that one simulator control unit equals one recruited neuron.',
    role: 'hypothesis_support',
    support: { kind: 'perturbation_effect', perturbations: ['activate'], behaviors: ['backward_walking', 'retreat', 'turning'] },
    sourceSupport: [
      { sourceId: 'SRC-SEN-CURRENT-BIOLOGY-2017', relation: 'claim_support', locator: 'Fig. 4A–C and Movie S4; Current Biology 27:766–771', supports: 'Supports activation-linked retreat and asymmetric left/right MDN recruitment as a turning mechanism in the reported assay.' },
    ],
  },
  {
    id: 'E-BANC-MDN-INVENTORY-007',
    label: 'Pinned BANC MDN inventory',
    claim: 'The pinned BANC v888 metadata contains four proofread rows with cell_type == MDN: two left and two right.',
    provenance: 'derived',
    sourceIds: ['SRC-BANC-DATAVERSE-V3'],
    context: 'A deterministic filter of banc_888_meta.feather in one adult female specimen.',
    caution: 'This is a specimen-level inventory, not a universal MDN count across flies. Use banc_888_id as the pinned join key; live root IDs can change.',
    role: 'hypothesis_support',
    support: { kind: 'specimen_inventory' },
    sourceSupport: [
      { sourceId: 'SRC-BANC-DATAVERSE-V3', relation: 'dataset_basis', locator: 'banc_888_meta.feather; Dataverse file 14033740; SHA-256 819bbcff476e52702d6f8d8604ce1f12d1d7b11942281df2f49df2a73a6f15a5; rows cell_type == MDN: 720575941491012809 left, 720575941491065653 left, 720575941499708745 right, 720575941614906387 right; all proofread == true', supports: 'Provides the exact four specimen rows, stable banc_888_id keys, and left/right metadata used by FlyLab.' },
    ],
  },
  {
    id: 'E-FENG-LBL40-008',
    label: 'LBL40 function in backward walking',
    claim: 'LBL40 contributes to hindleg tibia flexion—the power stroke during stance—in MDN-induced backward walking.',
    provenance: 'measured',
    sourceIds: ['SRC-FENG-NCOMMS-2020'],
    context: 'Adult Drosophila motor-circuit experiments reported by Feng et al.',
    caution: 'The BANC MDN→LBL40 rows are separate anatomical evidence and do not quantify this physiological contribution.',
    role: 'hypothesis_support',
    support: { kind: 'motor_context', behaviors: ['backward_walking'] },
    sourceSupport: [
      { sourceId: 'SRC-FENG-NCOMMS-2020', relation: 'claim_support', locator: 'Results, LBL40 functional analysis; Figs. 5 and 7', supports: 'Reports LBL40 contribution to the hindleg power stroke during MDN-induced backward walking.' },
    ],
  },
  {
    id: 'E-FENG-LUL130-009',
    label: 'LUL130 function without a bundled BANC node',
    claim: 'LUL130 facilitates leg lifting at the end of stance to initiate swing during MDN-induced backward walking.',
    provenance: 'measured',
    sourceIds: ['SRC-FENG-NCOMMS-2020'],
    context: LUL130_BUNDLE_STATUS.statement,
    caution: 'No LUL130 annotation was found in the pinned BANC v888 metadata, so FlyLab must not invent or assign a BANC node ID for it.',
    role: 'hypothesis_support',
    support: { kind: 'motor_context', behaviors: ['backward_walking'] },
    sourceSupport: [
      { sourceId: 'SRC-FENG-NCOMMS-2020', relation: 'claim_support', locator: 'Results, LUL130 functional analysis; Figs. 6 and 7', supports: 'Reports LUL130 contribution to leg lifting at the end of stance during MDN-induced backward walking.' },
    ],
  },
  {
    id: 'E-GF-CAUSAL-010',
    label: 'Giant fibers causally bias short-mode escape',
    claim: 'Under the cited adult assays, targeted giant-fiber activation elicited short-mode escape and giant-fiber silencing reduced the short-mode escape response; spike timing selected the fast takeoff pathway relative to parallel escape circuits.',
    provenance: 'measured',
    sourceIds: ['SRC-VONREYN-NN-2014'],
    context: 'Adult Drosophila exposed to looming stimuli, with targeted GF activation/silencing and intracellular recording in source-specific preparations.',
    caution: 'This does not imply every natural takeoff uses the GF pathway, does not calibrate a continuous activation dose, and does not support a whole-brain simulation.',
    role: 'hypothesis_support',
    support: { kind: 'perturbation_effect', perturbations: ['activate', 'silence'], behaviors: ['short_mode_escape'] },
    sourceSupport: [
      { sourceId: 'SRC-VONREYN-NN-2014', relation: 'claim_support', locator: 'Abstract; Figs. 2–4; Supplementary Video 3', supports: 'Reports GF necessity/sufficiency and spike-timing control for short-mode escape in the cited assays.' },
    ],
  },
  {
    id: 'E-GF-PATH-011',
    label: 'Giant-fiber branches reach jump-leg and wing motor output',
    claim: 'The adult giant fiber reaches the tergotrochanteral jump-muscle motor neuron through a mixed electrical/chemical synapse and also contacts an interneuron branch that relays to dorsal longitudinal flight-muscle motor neurons.',
    provenance: 'measured',
    sourceIds: ['SRC-KING-JNEUROCYTOL-1980', 'SRC-ALLEN-EJN-2007'],
    context: 'Adult Drosophila thoracic components of the bilaterally organized giant-fiber pathway.',
    caution: 'The cited anatomy and physiology do not provide a complete sensorimotor connectome, continuous weights, muscle mechanics, or aerodynamic parameters.',
    role: 'hypothesis_support',
    support: { kind: 'motor_context', behaviors: ['short_mode_escape'] },
    sourceSupport: [
      { sourceId: 'SRC-KING-JNEUROCYTOL-1980', relation: 'claim_support', locator: 'Abstract and thoracic-pathway reconstruction', supports: 'Identifies the GF contacts to the jump-muscle motor axon and the interneuron relay to flight-muscle motor neurons.' },
      { sourceId: 'SRC-ALLEN-EJN-2007', relation: 'claim_support', locator: 'Abstract and GF–TTMn electrophysiology', supports: 'Reports functional electrical and cholinergic chemical components at the mixed GF–TTMn synapse.' },
    ],
  },
  {
    id: 'E-FANC-ESCAPE-012',
    label: 'FANC structural context for coordinated leg and wing escape output',
    claim: 'The adult-female FANC reconstruction supplies structural hypotheses for giant-fiber-coupled premotor pathways coordinating leg and wing motor neurons during escape takeoff.',
    provenance: 'connectome_inferred',
    sourceIds: ['SRC-AZEVEDO-NATURE-2024'],
    context: 'One adult-female ventral nerve cord EM reconstruction; reconstruction and proofreading were incomplete at publication.',
    caution: 'Structural connectivity is not activity or causal efficacy. FANC is a different specimen and dataset from BANC; FlyLab does not assign FANC identities to bundled BANC nodes.',
    role: 'hypothesis_support',
    support: { kind: 'structural_path', behaviors: ['short_mode_escape'] },
    sourceSupport: [
      { sourceId: 'SRC-AZEVEDO-NATURE-2024', relation: 'claim_support', locator: 'Results, Coordination of legs and wings during take-off; Fig. 6', supports: 'Reports connectome-derived hypotheses linking GF-coupled premotor neurons to leg and wing motor output.' },
    ],
  },
];

export const CIRCUITS: CircuitRecord[] = [
  {
    id: 'circuit_mdn_adult',
    name: 'Moonwalker descending neurons',
    abbreviation: 'MDN',
    stage: 'adult',
    sex: 'source_specific',
    sexBoundary: 'Evidence spans source-specific adult assay populations and one adult-female BANC specimen; this catalog record does not establish sex generality.',
    laterality: 'bilateral_population',
    motorMapId: 'motor_map_mdn_legs_v1',
    targetBodyParts: ['left_foreleg', 'right_foreleg', 'left_midleg', 'right_midleg', 'left_hindleg', 'right_hindleg'],
    modelCoverage: 'mapped_reduced_order',
    specimenInventory: {
      dataset: 'BANC',
      snapshot: 'banc_888',
      specimen: BANC_V888_BUNDLE.specimen,
      mdnTotal: 4,
      mdnPerSide: { left: 2, right: 2 },
      evidenceId: 'E-BANC-MDN-INVENTORY-007',
      provenance: 'derived',
      boundary: 'Four MDNs—two metadata-left and two metadata-right—is a deterministic inventory of one adult-female BANC v888 specimen, not a universal adult Drosophila cell count.',
    },
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
    summary: 'A derived adult MDN catalog entry linking assay-scoped literature records to a pinned BANC specimen inventory and separate MDN→LBL40 structural records.',
    provenance: ['derived'],
  },
  {
    id: 'circuit_gf_adult',
    name: 'Giant fiber escape pathway',
    abbreviation: 'GF / DNp01',
    stage: 'adult',
    sex: 'source_specific',
    sexBoundary: 'Evidence spans source-specific adult assays plus one adult-female FANC specimen; this catalog record does not establish sex generality or cross-specimen identity.',
    laterality: 'bilateral_population',
    motorMapId: 'motor_map_gf_escape_v1',
    targetBodyParts: ['left_midleg', 'right_midleg', 'left_wing', 'right_wing'],
    modelCoverage: 'mapped_reduced_order',
    behaviors: ['short_mode_escape'],
    evidenceIds: [
      'E-GF-CAUSAL-010',
      'E-GF-PATH-011',
      'E-FANC-ESCAPE-012',
      'E-FLYLAB-MODEL-004',
    ],
    summary: 'A derived adult giant-fiber catalog entry linking causal short-mode escape assays to established TTM jump-leg and PSI/DLM wing branches, with separately labeled FANC structural context and a schematic reduced-order body controller.',
    provenance: ['derived'],
  },
];

export function circuitSupportsBehavior(circuitId: string, behavior: string) {
  return CIRCUITS.find((circuit) => circuit.id === circuitId)?.behaviors.includes(behavior) ?? false;
}

const CIRCUIT_QUERY_STOP_WORDS = new Set([
  'a', 'an', 'and', 'adult', 'agent', 'brain', 'circuit', 'control', 'create', 'experiment',
  'find', 'fly', 'for', 'fruit', 'in', 'make', 'map', 'model', 'of', 'on', 'research', 'show',
  'simulate', 'simulation', 'the', 'to', 'use', 'with',
]);

function normalizedTerms(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').split(/[^a-z0-9]+/).filter(Boolean);
}

function singularTerm(value: string) {
  return value.length > 3 && value.endsWith('s') ? value.slice(0, -1) : value;
}

function normalizeCircuitSearchText(value: string) {
  return value.toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b(?:middle|mid|t2|mesothoracic)[ -]?leg\b/g, 'midleg')
    .replace(/\s+/g, ' ')
    .trim();
}

function circuitSearchText(circuit: CircuitRecord) {
  const motorMap = motorMapForCircuit(circuit.id);
  const searchable = [
    circuit.name,
    circuit.abbreviation,
    circuit.summary,
    ...circuit.behaviors,
    ...circuit.targetBodyParts,
    ...(motorMap?.nodes.flatMap((node) => [node.id, node.label, node.role]) ?? []),
  ].join(' ');
  return normalizeCircuitSearchText(searchable);
}

function meaningfulCircuitQueryTerms(query: string) {
  return [...new Set(normalizedTerms(normalizeCircuitSearchText(query))
    .map(singularTerm)
    .filter((term) => (term.length >= 3 || term === 'gf') && !CIRCUIT_QUERY_STOP_WORDS.has(term)))];
}

function circuitTermMatches(queryTerm: string, searchTerms: string[]) {
  return searchTerms.some((searchTerm) => (
    searchTerm === queryTerm
    || (queryTerm.length >= 3 && searchTerm.endsWith(queryTerm))
    || (searchTerm.length >= 3 && queryTerm.endsWith(searchTerm))
  ));
}

export interface CircuitSearchMatch {
  circuit: CircuitRecord;
  score: number;
  matchedTerms: string[];
  unmatchedTerms: string[];
}

export function rankCircuitsForSearch(
  query: string,
  behavior = 'any',
  bodyPart = 'any',
): CircuitSearchMatch[] {
  const normalizedQuery = normalizeCircuitSearchText(query);
  const queryTerms = meaningfulCircuitQueryTerms(normalizedQuery);
  const eligible = CIRCUITS.filter((circuit) => (
    (behavior === 'any' || circuit.behaviors.includes(behavior))
    && (bodyPart === 'any' || circuit.targetBodyParts.includes(bodyPart as BodyPartId))
  ));
  const documents = new Map(eligible.map((circuit) => {
    const text = circuitSearchText(circuit);
    return [circuit.id, { text, terms: normalizedTerms(text).map(singularTerm) }];
  }));

  return eligible.flatMap((circuit): CircuitSearchMatch[] => {
    const document = documents.get(circuit.id)!;
    if (!normalizedQuery) return [{ circuit, score: 1, matchedTerms: [], unmatchedTerms: [] }];
    if (!queryTerms.length) {
      return behavior !== 'any' || bodyPart !== 'any'
        ? [{ circuit, score: 1, matchedTerms: [], unmatchedTerms: [] }]
        : [];
    }
    const matchedTerms = queryTerms.filter((term) => circuitTermMatches(term, document.terms));
    if (!matchedTerms.length) return [];
    const unmatchedTerms = queryTerms.filter((term) => !matchedTerms.includes(term));
    const specificityScore = matchedTerms.reduce((score, term) => {
      const documentFrequency = eligible.filter((candidate) => (
        circuitTermMatches(term, documents.get(candidate.id)!.terms)
      )).length;
      return score + (documentFrequency === 1 ? 6 : 1);
    }, 0);
    const phraseBonus = document.text.includes(normalizedQuery) ? 20 : 0;
    const filterBonus = (behavior !== 'any' ? 20 : 0) + (bodyPart !== 'any' ? 20 : 0);
    return [{
      circuit,
      score: matchedTerms.length * 10 + specificityScore + phraseBonus + filterBonus,
      matchedTerms,
      unmatchedTerms,
    }];
  }).sort((left, right) => right.score - left.score || left.circuit.id.localeCompare(right.circuit.id));
}

export function circuitMatchesSearch(
  circuit: CircuitRecord,
  query: string,
  behavior = 'any',
  bodyPart = 'any',
) {
  return rankCircuitsForSearch(query, behavior, bodyPart).some((match) => match.circuit.id === circuit.id);
}

export function evidenceBundleTitle(
  perturbation: Experiment['perturbation'],
  predictedBehavior: string,
) {
  return `Mapped-circuit ${perturbation === 'silence' ? 'suppression' : 'drive'} and predicted ${predictedBehavior.replaceAll('_', ' ')}`;
}

export const DEFAULT_GOAL = 'Reproduce an adult fly behavior by tracing a source-backed brain circuit into mapped leg or wing controllers.';

export const METRIC_LABELS: Record<MetricName, { label: string; unit: string }> = {
  backward_distance_mm: { label: 'Backward distance', unit: 'model mm' },
  signed_speed_mm_s: { label: 'Signed speed', unit: 'model mm/s' },
  response_latency_ms: { label: 'Response latency', unit: 'ms' },
  heading_change_deg: { label: 'Heading change', unit: '°' },
  stance_stability: { label: 'Stance stability', unit: 'index' },
  short_mode_escape_probability: { label: 'Short-mode escape probability', unit: 'fraction' },
  vertical_displacement_mm: { label: 'Vertical displacement', unit: 'model mm' },
  wing_recruitment: { label: 'Wing recruitment', unit: 'index' },
  leg_recruitment: { label: 'Leg recruitment', unit: 'index' },
};

export function metricsForCircuit(circuitId: string): MetricName[] {
  const map = motorMapForCircuit(circuitId);
  if (!map) throw new RangeError(`No embodied motor map exists for circuit ${circuitId}.`);
  return map.recommendedMetrics.filter((metric): metric is MetricName => ANALYSIS_METRICS.includes(metric as MetricName));
}

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

export function makeHypothesis(input: Omit<Hypothesis, 'id' | 'provenance' | 'causalEvidenceIds'>): Hypothesis {
  const canonicalInput = {
    ...input,
    evidenceIds: [...input.evidenceIds].sort(),
  };
  const causalEvidenceIds = canonicalInput.evidenceIds.filter((id) => {
    const evidence = EVIDENCE.find((record) => record.id === id);
    return evidence?.support.kind === 'perturbation_effect'
      && evidence.support.perturbations?.includes(input.perturbation)
      && evidence.support.behaviors?.includes(input.predictedBehavior);
  });
  if (!causalEvidenceIds.length) {
    throw new RangeError(`Hypothesis evidence must include a perturbation_effect record matching ${input.perturbation} and ${input.predictedBehavior}.`);
  }
  return {
    ...canonicalInput,
    causalEvidenceIds,
    id: `hyp_${stableHash(canonicalInput)}`,
    provenance: 'agent_hypothesized',
  };
}

export function designExperiment(input: {
  hypothesisId: string;
  targetCircuitId: string;
  behavior?: string;
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
  const circuit = CIRCUITS.find((record) => record.id === input.targetCircuitId);
  const motorMap = motorMapForCircuit(input.targetCircuitId);
  if (!circuit || !motorMap) throw new RangeError(`The target circuit ${input.targetCircuitId} has no mapped motor program.`);
  const behavior = input.behavior ?? circuit.behaviors[0];
  if (!circuit.behaviors.includes(behavior) || !motorMap.behaviors.includes(behavior)) {
    throw new RangeError(`Behavior ${behavior} is not supported by ${input.targetCircuitId}.`);
  }
  if (!motorMap.supportedLaterality.includes(input.laterality)) {
    throw new RangeError(`${input.laterality} laterality is not supported by motor map ${motorMap.id}; supported laterality: ${motorMap.supportedLaterality.join(', ')}.`);
  }
  const targetLabel = circuit.abbreviation;
  const programLabel = motorMap.motorProgram.replaceAll('_', ' ');
  if (!Number.isFinite(input.activationLevel) || input.activationLevel < 0 || input.activationLevel > 1) {
    throw new RangeError('activationLevel must be a finite unitless value from 0 to 1.');
  }
  if (!Number.isInteger(input.onsetMs) || input.onsetMs < 0 || input.onsetMs > 5000
    || !Number.isInteger(input.durationMs) || input.durationMs < 50 || input.durationMs > 5000
    || !Number.isInteger(input.trialDurationMs) || input.trialDurationMs < 1000 || input.trialDurationMs > 10000
    || input.onsetMs + input.durationMs > input.trialDurationMs) {
    throw new RangeError('Experiment timing must use integer milliseconds within the published onset (0–5000), duration (50–5000), and trial (1000–10000) bounds, with onset + duration inside the trial.');
  }
  if (!Number.isInteger(input.replicates) || input.replicates < 1 || input.replicates > 20) {
    throw new RangeError('replicates must be an integer from 1 to 20.');
  }
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 2147483647) {
    throw new RangeError('seed must be an integer from 0 to 2147483647.');
  }
  if (!input.includeBaseline || !input.includeShamControl) {
    throw new RangeError('The validated FlyLab vertical slice requires baseline and model-sham controls.');
  }
  const conditions: TrialCondition[] = [];
  if (input.includeBaseline) {
    conditions.push(input.perturbation === 'silence'
      ? {
          id: 'condition_baseline',
          label: `Reference ${programLabel} · no model suppression`,
          kind: 'baseline',
          laterality: 'none',
          nominalControlLevel: 0,
          expectedModelEffect: motorMap.responseMode === 'reverse' ? 'reference_retreat_drive' : 'reference_motor_drive',
        }
      : {
          id: 'condition_baseline',
          label: 'Baseline · no mapped motor drive',
          kind: 'baseline',
          laterality: 'none',
          nominalControlLevel: 0,
          expectedModelEffect: motorMap.responseMode === 'reverse' ? 'no_retreat_drive' : 'no_motor_drive',
        });
  }
  if (input.includeShamControl) {
    conditions.push(input.perturbation === 'silence'
      ? {
          id: 'condition_sham',
          label: `Suppression sham · reference ${programLabel} retained`,
          kind: 'sham',
          laterality: 'none',
          nominalControlLevel: input.activationLevel,
          expectedModelEffect: motorMap.responseMode === 'reverse' ? 'reference_drive_sham' : 'reference_motor_drive',
        }
      : {
          id: 'condition_sham',
          label: 'Model sham · nominal control, zero effect',
          kind: 'sham',
          laterality: 'none',
          nominalControlLevel: input.activationLevel,
          expectedModelEffect: 'zero_effect_sham',
        });
  }
  conditions.push({
    id: `condition_${input.laterality}`,
    label: `${input.laterality[0].toUpperCase()}${input.laterality.slice(1)} ${targetLabel} model ${input.perturbation === 'activate' ? 'drive' : 'suppression'}`,
    kind: 'perturbation',
    laterality: input.laterality,
    nominalControlLevel: input.activationLevel,
    expectedModelEffect: input.perturbation === 'activate'
      ? motorMap.responseMode === 'reverse' ? 'activation_increases_retreat_drive' : 'activation_increases_motor_drive'
      : motorMap.responseMode === 'reverse' ? 'suppression_reduces_reference_drive' : 'suppression_reduces_reference_motor_drive',
  });
  if (input.laterality === 'bilateral'
    && motorMap.supportedLaterality.includes('left')
    && motorMap.supportedLaterality.includes('right')) {
    const modeLabel = input.perturbation === 'activate' ? 'drive' : 'suppression';
    conditions.push(
      {
        id: 'condition_left',
        label: `Left-only ${targetLabel} model ${modeLabel}`,
        kind: 'perturbation',
        laterality: 'left',
        nominalControlLevel: input.activationLevel,
        expectedModelEffect: input.perturbation === 'activate'
          ? motorMap.responseMode === 'reverse' ? 'activation_increases_retreat_drive' : 'activation_increases_motor_drive'
          : motorMap.responseMode === 'reverse' ? 'suppression_reduces_reference_drive' : 'suppression_reduces_reference_motor_drive',
      },
      {
        id: 'condition_right',
        label: `Right-only ${targetLabel} model ${modeLabel}`,
        kind: 'perturbation',
        laterality: 'right',
        nominalControlLevel: input.activationLevel,
        expectedModelEffect: input.perturbation === 'activate'
          ? motorMap.responseMode === 'reverse' ? 'activation_increases_retreat_drive' : 'activation_increases_motor_drive'
          : motorMap.responseMode === 'reverse' ? 'suppression_reduces_reference_drive' : 'suppression_reduces_reference_motor_drive',
      },
    );
  }

  const identity = {
    ...input,
    behavior,
    conditions: conditions.map((condition) => condition.id),
    motorMapId: motorMap.id,
    modelVersion: MODEL_MANIFEST.version,
    controller: MODEL_MANIFEST.controller,
  };
  return {
    id: `exp_${stableHash(identity)}`,
    hypothesisId: input.hypothesisId,
    targetCircuitId: input.targetCircuitId,
    behavior,
    motorMap,
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
      `The ${targetLabel}-to-${motorMap.motorProgram} controller mapping is hand-authored and versioned; it is not fitted neural dynamics.`,
      'Connectome identities, paths, and contact counts are provenance records, not executable neurons, activity measurements, or physiological weights.',
      'FlyGym v2.1.0 is an embodied simulation reference; this reduced-order browser model does not execute FlyGym.',
      'Simulator intervals describe seeded model variation, not biological population inference.',
      ...(input.perturbation === 'silence'
        ? [`Silencing trials apply a hand-authored reference ${programLabel} drive to baseline and sham conditions, then reduce it in suppression arms; this is not a measurement of endogenous circuit activity.`]
        : []),
    ],
    provenance: ['agent_hypothesized'],
  };
}

export function reviseExperiment(
  source: Experiment,
  field: 'activationLevel' | 'durationMs' | 'replicates',
  value: number,
) {
  return designExperiment({
    hypothesisId: source.hypothesisId,
    targetCircuitId: source.targetCircuitId,
    behavior: source.behavior,
    perturbation: source.perturbation,
    laterality: source.primaryLaterality,
    activationLevel: field === 'activationLevel' ? value : source.activationLevel,
    onsetMs: source.onsetMs,
    durationMs: field === 'durationMs' ? value : source.durationMs,
    trialDurationMs: source.trialDurationMs,
    replicates: field === 'replicates' ? value : source.replicates,
    includeBaseline: source.conditions.some((condition) => condition.kind === 'baseline'),
    includeShamControl: source.conditions.some((condition) => condition.kind === 'sham'),
    seed: source.seed,
  });
}

export function snapshotExperimentProtocol(experiment: Experiment): ExperimentProtocolSnapshot {
  return {
    experimentId: experiment.id,
    hypothesisId: experiment.hypothesisId,
    targetCircuitId: experiment.targetCircuitId,
    behavior: experiment.behavior,
    motorMapId: experiment.motorMap.id,
    perturbation: experiment.perturbation,
    activationLevel: experiment.activationLevel,
    primaryLaterality: experiment.primaryLaterality,
    onsetMs: experiment.onsetMs,
    durationMs: experiment.durationMs,
    trialDurationMs: experiment.trialDurationMs,
    replicates: experiment.replicates,
    seed: experiment.seed,
    conditions: experiment.conditions.map((condition) => ({ ...condition })),
    assumptions: [...experiment.assumptions],
  };
}

function conditionMotorDrive(condition: TrialCondition, experiment: Experiment) {
  if (condition.kind !== 'perturbation') {
    return experiment.perturbation === 'silence' ? MODEL_PARAMETERS.silencingReferenceMotorDrive : 0;
  }
  const durationGain = clamp(
    experiment.durationMs / MODEL_PARAMETERS.durationReferenceMs,
    MODEL_PARAMETERS.durationGainBounds[0],
    MODEL_PARAMETERS.durationGainBounds[1],
  );
  const lateralityGain = condition.laterality === 'bilateral' ? 1 : MODEL_PARAMETERS.unilateralGain;
  const adapterAmount = condition.nominalControlLevel * durationGain * lateralityGain;
  if (experiment.perturbation === 'activate') {
    return clamp(adapterAmount, 0, MODEL_PARAMETERS.maximumMotorDrive);
  }
  const suppressionFraction = clamp(adapterAmount, 0, MODEL_PARAMETERS.maximumSuppressionFraction);
  return MODEL_PARAMETERS.silencingReferenceMotorDrive * (1 - suppressionFraction);
}

function simulateTrajectory(condition: TrialCondition, experiment: Experiment, motorDrive: number, seed: number): TrajectoryPoint[] {
  const random = mulberry32(seed);
  const points: TrajectoryPoint[] = [];
  let x = 0;
  let y = 0;
  let z = 0;
  let heading = 0;
  const steps = MODEL_PARAMETERS.trajectory.steps;
  for (let step = 0; step <= steps; step += 1) {
    const t = (experiment.trialDurationMs * step) / steps;
    const inProtocolWindow = t >= experiment.onsetMs && t <= experiment.onsetMs + experiment.durationMs;
    const active = condition.kind === 'perturbation' && inProtocolWindow;
    const drive = inProtocolWindow ? motorDrive : 0;
    const takeoffMode = experiment.motorMap.responseMode === 'takeoff';
    const motorOutputActive = inProtocolWindow && drive > MODEL_PARAMETERS.trajectory.reverseDriveThreshold;
    const direction = !takeoffMode && drive > MODEL_PARAMETERS.trajectory.reverseDriveThreshold ? -1 : 1;
    const lateralSign = condition.laterality === 'left' ? -1 : condition.laterality === 'right' ? 1 : 0;
    const lateralModeSign = experiment.perturbation === 'silence' ? -1 : 1;
    const lateralEffect = experiment.perturbation === 'silence'
      ? MODEL_PARAMETERS.silencingReferenceMotorDrive - drive
      : drive;
    heading += active
      ? lateralSign * lateralModeSign * (
          MODEL_PARAMETERS.trajectory.activeTurnBaseDegPerStep
          + lateralEffect * MODEL_PARAMETERS.trajectory.activeTurnGainDegPerStep
        )
      : jitter(random, MODEL_PARAMETERS.trajectory.headingJitterScaleDeg);
    const speed = takeoffMode
      ? MODEL_PARAMETERS.trajectory.baseStepModelMm + drive * MODEL_PARAMETERS.escapeTakeoff.trajectoryForwardGainModelMm
      : MODEL_PARAMETERS.trajectory.baseStepModelMm + drive * MODEL_PARAMETERS.trajectory.driveStepGainModelMm;
    x += Math.sin((heading * Math.PI) / 180) * speed + jitter(random, MODEL_PARAMETERS.trajectory.positionJitterScaleModelMm);
    y += direction * Math.cos((heading * Math.PI) / 180) * speed + jitter(random, MODEL_PARAMETERS.trajectory.positionJitterScaleModelMm);
    if (takeoffMode && motorOutputActive) z += drive * MODEL_PARAMETERS.escapeTakeoff.trajectoryLiftGainModelMm;
    points.push({ t: Math.round(t), x, y, z, heading, active, motorOutputActive });
  }
  return points;
}

export function simulateExperiment(experiment: Experiment): SimulationBatch {
  const conditionRuns = experiment.conditions.map((condition, conditionIndex): ConditionRun => {
    const motorDrive = conditionMotorDrive(condition, experiment);
    const takeoffMode = experiment.motorMap.responseMode === 'takeoff';
    const replicates = Array.from({ length: experiment.replicates }, (_, replicateIndex): ReplicateResult => {
      const seed = experiment.seed + conditionIndex * 1009 + replicateIndex * 37;
      const random = mulberry32(seed);
      const responseProbability = takeoffMode
        ? clamp(
            MODEL_PARAMETERS.escapeTakeoff.responseProbability.baseline + motorDrive * MODEL_PARAMETERS.escapeTakeoff.responseProbability.driveGain,
            MODEL_PARAMETERS.escapeTakeoff.responseProbability.minimum,
            MODEL_PARAMETERS.escapeTakeoff.responseProbability.maximum,
          )
        : clamp(
            MODEL_PARAMETERS.reverseProbability.baseline + motorDrive * MODEL_PARAMETERS.reverseProbability.driveGain,
            MODEL_PARAMETERS.reverseProbability.minimum,
            MODEL_PARAMETERS.reverseProbability.maximum,
          );
      const responseInitiated = random() < responseProbability;
      const reverseInitiated = !takeoffMode && responseInitiated;
      const shortModeEscapeInitiated = takeoffMode && responseInitiated;
      const signedSpeedMmS = reverseInitiated
        ? -(
            MODEL_PARAMETERS.signedSpeed.reverseInterceptMmS
            + motorDrive * MODEL_PARAMETERS.signedSpeed.reverseDriveGainMmS
            + jitter(random, MODEL_PARAMETERS.signedSpeed.jitterScaleMmS)
          )
        : MODEL_PARAMETERS.signedSpeed.forwardBaselineMmS
          + (takeoffMode ? motorDrive * MODEL_PARAMETERS.escapeTakeoff.forwardSpeedGainModelMmS : -motorDrive * MODEL_PARAMETERS.signedSpeed.forwardDrivePenaltyMmS)
          + jitter(random, MODEL_PARAMETERS.signedSpeed.forwardJitterScaleMmS);
      const responseWindowMs = Math.max(0, experiment.trialDurationMs - experiment.onsetMs);
      const responseLatencyParameters = takeoffMode ? MODEL_PARAMETERS.escapeTakeoff.responseLatency : MODEL_PARAMETERS.responseLatency;
      const responseLatencyMs = responseInitiated
        ? clamp(
            responseLatencyParameters.interceptMs
              + (1 - motorDrive) * responseLatencyParameters.inverseDriveGainMs
              + jitter(random, responseLatencyParameters.jitterScaleMs),
            Math.min(responseLatencyParameters.minimumClampMs, responseWindowMs),
            responseWindowMs,
          )
        : null;
      const reverseSeconds = responseLatencyMs === null
        ? 0
        : Math.max(0, responseWindowMs - responseLatencyMs) / 1000;
      const backwardDistanceMm = reverseInitiated
        ? Math.abs(signedSpeedMmS) * reverseSeconds * (
            MODEL_PARAMETERS.backwardDistanceScale.minimum
            + random() * (MODEL_PARAMETERS.backwardDistanceScale.maximum - MODEL_PARAMETERS.backwardDistanceScale.minimum)
          )
        : 0;
      const verticalDisplacementMm = shortModeEscapeInitiated
        ? Math.max(0, MODEL_PARAMETERS.escapeTakeoff.verticalDisplacement.interceptModelMm
          + motorDrive * MODEL_PARAMETERS.escapeTakeoff.verticalDisplacement.driveGainModelMm
          + jitter(random, MODEL_PARAMETERS.escapeTakeoff.verticalDisplacement.jitterScaleModelMm))
        : 0;
      const wingRecruitment = takeoffMode
        ? clamp(MODEL_PARAMETERS.escapeTakeoff.wingRecruitment.baseline
          + motorDrive * MODEL_PARAMETERS.escapeTakeoff.wingRecruitment.driveGain
          + jitter(random, MODEL_PARAMETERS.escapeTakeoff.wingRecruitment.jitterScale), 0, 1)
        : 0;
      const legRecruitment = clamp(
        (takeoffMode ? MODEL_PARAMETERS.escapeTakeoff.legRecruitment.baseline : MODEL_PARAMETERS.reverseWalk.legRecruitment.baseline)
          + motorDrive * (takeoffMode ? MODEL_PARAMETERS.escapeTakeoff.legRecruitment.driveGain : MODEL_PARAMETERS.reverseWalk.legRecruitment.driveGain)
          + jitter(random, takeoffMode ? MODEL_PARAMETERS.escapeTakeoff.legRecruitment.jitterScale : MODEL_PARAMETERS.reverseWalk.legRecruitment.jitterScale),
        0,
        1,
      );
      const lateralSign = condition.laterality === 'left' ? -1 : condition.laterality === 'right' ? 1 : 0;
      const lateralModeSign = experiment.perturbation === 'silence' ? -1 : 1;
      const lateralEffect = experiment.perturbation === 'silence'
        ? MODEL_PARAMETERS.silencingReferenceMotorDrive - motorDrive
        : motorDrive;
      const headingChangeDeg = lateralSign * lateralModeSign * (
        MODEL_PARAMETERS.heading.baseDeg + lateralEffect * MODEL_PARAMETERS.heading.driveGainDeg
      ) + jitter(
        random,
        condition.laterality === 'bilateral'
          ? MODEL_PARAMETERS.heading.bilateralJitterScaleDeg
          : MODEL_PARAMETERS.heading.unilateralJitterScaleDeg,
      );
      const stanceStability = clamp(
        MODEL_PARAMETERS.stanceStability.baseline
          - motorDrive * MODEL_PARAMETERS.stanceStability.drivePenalty
          + jitter(random, MODEL_PARAMETERS.stanceStability.jitterScale),
        MODEL_PARAMETERS.stanceStability.minimum,
        MODEL_PARAMETERS.stanceStability.maximum,
      );
      return {
        id: `run_${stableHash({ experiment: experiment.id, condition: condition.id, replicateIndex, seed })}`,
        conditionId: condition.id,
        seed,
        reverseInitiated,
        responseInitiated,
        shortModeEscapeInitiated,
        backwardDistanceMm,
        signedSpeedMmS,
        responseLatencyMs,
        headingChangeDeg,
        stanceStability,
        verticalDisplacementMm,
        wingRecruitment,
        legRecruitment,
      };
    });

    return {
      conditionId: condition.id,
      label: condition.label,
      laterality: condition.laterality,
      runIds: replicates.map((replicate) => replicate.id),
      replicates,
      trajectory: simulateTrajectory(condition, experiment, motorDrive, experiment.seed + conditionIndex * 1009),
    };
  });

  const identity = conditionRuns.flatMap((condition) => condition.runIds);
  return {
    id: `batch_${stableHash({ experiment: experiment.id, identity })}`,
    experimentId: experiment.id,
    targetCircuitId: experiment.targetCircuitId,
    behavior: experiment.behavior,
    motorMap: experiment.motorMap,
    status: 'complete',
    conditionRuns,
    runHash: `fnv1a:${stableHash(identity)}`,
    protocol: snapshotExperimentProtocol(experiment),
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
  const canonicalMetrics = ANALYSIS_METRICS.filter((metric) => metrics.includes(metric));
  const conditions = batch.conditionRuns.map((run): ConditionAnalysis => {
    const responsive = run.replicates.filter(
      (replicate): replicate is ReplicateResult & { responseLatencyMs: number } => (
        (batch.motorMap.responseMode === 'takeoff' ? replicate.shortModeEscapeInitiated : replicate.reverseInitiated)
        && replicate.responseLatencyMs !== null
      ),
    );
    return {
      conditionId: run.conditionId,
      label: run.label,
      n: run.replicates.length,
      reverseInitiationProbability: mean(run.replicates.map((replicate) => replicate.reverseInitiated ? 1 : 0)),
      responseInitiationProbability: mean(run.replicates.map((replicate) => replicate.responseInitiated ? 1 : 0)),
      shortModeEscapeProbability: mean(run.replicates.map((replicate) => replicate.shortModeEscapeInitiated ? 1 : 0)),
      backwardDistanceMm: mean(run.replicates.map((replicate) => replicate.backwardDistanceMm)),
      signedSpeedMmS: mean(run.replicates.map((replicate) => replicate.signedSpeedMmS)),
      responseLatencyMs: responsive.length ? mean(responsive.map((replicate) => replicate.responseLatencyMs)) : null,
      responsiveN: responsive.length,
      headingChangeDeg: Math.abs(mean(run.replicates.map((replicate) => replicate.headingChangeDeg))),
      stanceStability: mean(run.replicates.map((replicate) => replicate.stanceStability)),
      verticalDisplacementMm: mean(run.replicates.map((replicate) => replicate.verticalDisplacementMm)),
      wingRecruitment: mean(run.replicates.map((replicate) => replicate.wingRecruitment)),
      legRecruitment: mean(run.replicates.map((replicate) => replicate.legRecruitment)),
    };
  });
  return {
    id: `analysis_${stableHash({ batch: batch.id, metrics: canonicalMetrics, analysisStartMs, analysisEndMs })}`,
    batchId: batch.id,
    metrics: canonicalMetrics,
    conditions,
    windowMs: { start: analysisStartMs, end: analysisEndMs },
    methodVersion: 'flylab.behavior-metrics.v3',
    provenance: ['derived', 'simulation_predicted'],
    warning: 'These estimates summarize seeded simulator variation. Response latency is a simulated delay from the nominal protocol onset and is null when no seeded run responds. Values are not biological confidence intervals or new experimental evidence.',
  };
}

export function conditionMetricValue(condition: ConditionAnalysis, metric: MetricName) {
  switch (metric) {
    case 'backward_distance_mm': return condition.backwardDistanceMm;
    case 'signed_speed_mm_s': return condition.signedSpeedMmS;
    case 'response_latency_ms': return condition.responseLatencyMs;
    case 'heading_change_deg': return Math.abs(condition.headingChangeDeg);
    case 'stance_stability': return condition.stanceStability;
    case 'short_mode_escape_probability': return condition.shortModeEscapeProbability;
    case 'vertical_displacement_mm': return condition.verticalDisplacementMm;
    case 'wing_recruitment': return condition.wingRecruitment;
    case 'leg_recruitment': return condition.legRecruitment;
  }
}

export function sharedAvailableObjectiveMetrics(analyses: Analysis[]): MetricName[] {
  return ANALYSIS_METRICS.filter((metric) => (
    analyses.length > 0
    && analyses.every((analysis) => analysis.metrics.includes(metric))
    && analyses.some((analysis) => analysis.conditions.some((condition) => conditionMetricValue(condition, metric) !== null))
  ));
}

export function compareAnalyses(
  analyses: Analysis[],
  objectiveMetric: MetricName,
  objective: 'maximize' | 'minimize' | 'target',
  targetValue: number | undefined,
  budget: number,
  experimentContext?: Pick<Experiment, 'activationLevel' | 'primaryLaterality' | 'perturbation'>,
): Comparison {
  const uniqueConditions = new Map<string, ConditionAnalysis>();
  analyses.flatMap((analysis) => analysis.conditions).forEach((condition) => uniqueConditions.set(condition.conditionId, condition));
  const rows = [...uniqueConditions.values()].map((condition) => ({
    conditionId: condition.conditionId,
    label: condition.label,
    value: conditionMetricValue(condition, objectiveMetric),
  }));
  rows.sort((a, b) => {
    if (a.value === null && b.value === null) return a.conditionId.localeCompare(b.conditionId);
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    if (objective === 'minimize') return a.value - b.value;
    if (objective === 'target') return Math.abs(a.value - (targetValue ?? 0)) - Math.abs(b.value - (targetValue ?? 0));
    return b.value - a.value;
  });
  const center = experimentContext?.activationLevel ?? 0.65;
  const activationLevels = [...new Set([
    Math.round(clamp(center - 0.15, 0, 1) * 100) / 100,
    Math.round(clamp(center + 0.15, 0, 1) * 100) / 100,
  ])];
  const modeLabel = experimentContext?.perturbation === 'silence' ? 'suppression' : 'drive';
  const lateralityLabel = experimentContext?.primaryLaterality ?? 'selected';
  const rationale = `Probe bounded unitless model-${modeLabel} levels near ${center.toFixed(2)} for the ${lateralityLabel} condition to test whether the predicted response is control-sensitive.`;
  const proposalIdentity = {
    analysisIds: analyses.map((analysis) => analysis.id),
    objectiveMetric,
    objective,
    targetValue,
    winner: rows[0]?.conditionId,
    rationale,
    activationLevels,
    replicateBudget: budget,
  };
  return {
    id: `comparison_${stableHash({ analyses: analyses.map((analysis) => analysis.id), objectiveMetric, objective, targetValue, budget })}`,
    analysisIds: analyses.map((analysis) => analysis.id),
    objectiveMetric,
    objective,
    ...(objective === 'target' ? { targetValue } : {}),
    rankedConditions: rows,
    proposal: {
      id: `proposal_${stableHash(proposalIdentity)}`,
      rationale,
      activationLevels,
      replicateBudget: budget,
      provenance: 'agent_hypothesized',
    },
    limitations: [
      'Ranking is conditional on the selected FlyLab model and objective metric.',
      'The proposed follow-up is an information-seeking simulation, not a biological protocol recommendation.',
    ],
    provenance: ['derived', 'simulation_predicted'],
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
