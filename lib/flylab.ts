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

export const METRIC_METHOD_VERSION = 'flylab.behavior-metrics.v5' as const;

export interface MetricDefinition {
  id: MetricName;
  label: string;
  formula: string;
  unit: string;
  signConvention: string;
  aggregation: string;
  nullRule: string;
  windowSemantics: string;
  methodVersion: typeof METRIC_METHOD_VERSION;
  provenance: readonly ['derived', 'simulation_predicted'];
  boundary: string;
}

export interface ResponseInitiationSummaryDefinition {
  id: 'response_initiation_probability';
  label: string;
  formula: string;
  unit: string;
  signConvention: string;
  aggregation: string;
  nullRule: string;
  windowSemantics: string;
  methodVersion: typeof METRIC_METHOD_VERSION;
  provenance: readonly ['derived', 'simulation_predicted'];
  boundary: string;
}

export interface ResponseObservationSummaryDefinition {
  id: 'response_threshold_and_censoring_summary';
  label: string;
  fields: Record<'thresholdCrossingProbability' | 'thresholdCrossedN' | 'censoredN', {
    formula: string;
    unit: string;
    aggregation: string;
    nullRule: string;
  }>;
  windowSemantics: string;
  methodVersion: typeof METRIC_METHOD_VERSION;
  provenance: readonly ['derived', 'simulation_predicted'];
  boundary: string;
}

export const HYPOTHESIS_CONTROL_IDS = [
  'condition_baseline',
  'condition_sham',
] as const;
export type HypothesisControlId = (typeof HYPOTHESIS_CONTROL_IDS)[number];

export const EXPERIMENT_SEED_POLICY = {
  version: 'flylab.seed-policy.v2',
  generator: 'mulberry32',
  design: 'common_random_numbers_by_replicate',
  pairingRule: 'Replicate index r uses the same metric and trajectory seeds in every condition arm; equivalent effective drives are therefore exactly paired, and differing drives reuse the same latent draws.',
  replicateFormula: 'baseSeed + replicateIndex * 37',
  trajectoryFormula: 'replicateSeed + 104729',
  illustrativeTrajectoryFormula: 'baseSeed + 130363',
  replicateStride: 37,
  trajectoryOffset: 104729,
  illustrativeTrajectoryOffset: 130363,
} as const;
export type ExperimentSeedPolicy = typeof EXPERIMENT_SEED_POLICY;

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
  primaryOutcome: MetricName;
  expectedDirection: 'increase' | 'decrease';
  controls: HypothesisControlId[];
  evidenceIds: string[];
  causalEvidenceIds: string[];
  evidenceLimitations: string[];
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

export interface MotorDriveDerivation {
  conditionId: string;
  perturbation: Experiment['perturbation'];
  nominalControlLevel: number;
  durationMs: number;
  durationReferenceMs: number;
  rawDurationGain: number;
  boundedDurationGain: number;
  durationGainBounds: readonly [number, number];
  laterality: Laterality;
  lateralityGain: number;
  adapterAmount: number;
  referenceMotorDrive: number;
  suppressionFraction: number;
  effectiveMotorDrive: number;
  formula: string;
  provenance: 'agent_hypothesized';
  boundary: string;
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
  seedPolicy: ExperimentSeedPolicy;
  metricMethodVersion: typeof METRIC_METHOD_VERSION;
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
  seedPolicy: ExperimentSeedPolicy;
  metricMethodVersion: typeof METRIC_METHOD_VERSION;
  conditions: TrialCondition[];
  driveDerivations: MotorDriveDerivation[];
  assumptions: string[];
}

export type EmbodiedBehaviorState =
  | 'stance'
  | 'preparation'
  | 'reverse_walk'
  | 'jump'
  | 'wing_deployment'
  | 'airborne'
  | 'recovery';

export interface EmbodiedEventTimeline {
  responseInitiated: boolean;
  responseDisposition: 'not_crossed' | 'censored' | 'expressed';
  thresholdCrossed: boolean;
  stimulusOnsetMs: number;
  candidateMovementOnsetMs: number | null;
  controllerThresholdMs: number | null;
  movementOnsetMs: number | null;
  groundReleaseMs: number | null;
  wingDeploymentMs: number | null;
  recoveryMs: number | null;
  sourceConstraint: string;
  provenance: readonly ['simulation_predicted'];
  boundary: string;
}

export interface TrajectoryPoint {
  t: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  active: boolean;
  motorOutputActive: boolean;
  state: EmbodiedBehaviorState;
  groundContact: boolean;
  legExtension: number;
  wingDeployment: number;
  bodyPitchDeg: number;
  bodyRollDeg: number;
  premotorDriveIndex: number;
  stanceStability: number;
}

export interface ReplicateResult {
  id: string;
  status: 'complete';
  conditionId: string;
  seed: number;
  effectiveMotorDrive: number;
  driveDerivation: MotorDriveDerivation;
  premotorDriveIndex: number;
  responseThresholdProbability: number;
  responseThresholdCrossed: boolean;
  responseDisposition: 'not_crossed' | 'censored' | 'expressed';
  candidateResponseLatencyMs: number | null;
  reverseInitiated: boolean;
  responseInitiated: boolean;
  shortModeEscapeInitiated: boolean;
  backwardDistanceMm: number;
  backwardDistanceScale: number;
  signedSpeedMmS: number;
  responseLatencyMs: number | null;
  headingChangeDeg: number;
  stanceStability: number;
  verticalDisplacementMm: number;
  wingRecruitment: number;
  legRecruitment: number;
  takeoffSuccess: boolean;
  eventTimeline: EmbodiedEventTimeline;
  trajectoryId: string;
  trajectorySeed: number;
  trajectoryRole: 'per_run_simulated_trajectory';
  trajectory: TrajectoryPoint[];
  provenance: ['simulation_predicted'];
}

export interface ConditionRun {
  conditionId: string;
  label: string;
  laterality: Laterality;
  status: 'complete';
  effectiveMotorDrive: number;
  driveDerivation: MotorDriveDerivation;
  runIds: string[];
  replicates: ReplicateResult[];
  trajectoryId: string;
  trajectorySeed: number;
  trajectoryStatus: 'complete';
  trajectoryRole: 'illustrative_condition_replay';
  trajectoryBoundary: string;
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
  runHashScope: 'run_and_trajectory_ids_only';
  runHashSerialization: 'FNV-1a(JSON.stringify([{ runId, trajectoryId }]))';
  runContentHash: `sha256:${string}`;
  runContentHashScope: 'protocol_model_and_complete_condition_runs';
  runContentHashSerialization: 'SHA-256(JSON.stringify({ protocol, model, conditionRuns }))';
  protocol: ExperimentProtocolSnapshot;
  model: typeof MODEL_MANIFEST;
  provenance: ['simulation_predicted'];
}

export interface ConditionAnalysis {
  conditionId: string;
  label: string;
  n: number;
  reverseInitiationProbability: number;
  thresholdCrossingProbability: number;
  thresholdCrossedN: number;
  censoredN: number;
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
  batchRunContentHash: `sha256:${string}`;
  metrics: MetricName[];
  metricDefinitions: Partial<Record<MetricName, MetricDefinition>>;
  responseInitiationSummaryDefinition: ResponseInitiationSummaryDefinition;
  responseObservationSummaryDefinition: ResponseObservationSummaryDefinition;
  conditions: ConditionAnalysis[];
  windowMs: { start: number; end: number };
  methodVersion: typeof METRIC_METHOD_VERSION;
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
  name: 'flylab.mapped-motor-parameters.v3',
  provenance: 'agent_hypothesized',
  calibration: 'State-transition order and approximate GF event intervals are constrained by cited adult escape measurements; probabilities, amplitudes, controller gains, recovery timing and dynamics, and MDN dynamics remain hand-authored and are not fitted to held-out data.',
  calibrationStatus: 'literature_constrained_event_order_unfitted_amplitudes',
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
    responseLatency: { interceptMs: 1.4, inverseDriveGainMs: 3.2, jitterScaleMs: 0.4, minimumClampMs: 1.4 },
    eventTiming: {
      controllerLeadMs: 0.6,
      groundReleaseDelayMs: 1.1,
      wingDelayAfterGroundReleaseMs: 1.5,
      recoveryBaseMs: 180,
      recoveryDriveGainMs: 120,
      recoveryJitterScaleMs: 20,
      sourceIds: ['SRC-GAITANIDIS-PLOS-BIOLOGY-2025'],
      boundary: 'The order and approximate millisecond intervals are literature-constrained calibration targets across distinct direct-GF and light-off paradigms; they are not a fitted equivalence to FlyLab unitless drive.',
    },
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
  stateTrajectory: {
    protocolWindowSemantics: '[onset_ms, min(trial_duration_ms, onset_ms + duration_ms))',
    distanceScale: { minimum: 0.98, range: 0.04 },
    eventSamplingBoundaryEpsilonMs: 0.001,
    reverseControllerLead: { latencyFraction: 0.2, maximumMs: 60 },
    stanceStability: {
      preparationPenalty: 0.05,
      reverseWalkPenalty: 0.1,
      jump: 0.35,
      wingDeployment: 0.25,
      airborne: 0.5,
    },
    takeoffPose: {
      jumpPitchDeg: -14,
      wingDeploymentPitchDeltaDeg: 20,
      airborneRecoveryPitchDeg: 6,
      wingDeploymentLegDecayFraction: 0.75,
      airborneLegRetentionFraction: 0.2,
      unilateralBodyRollPerHeading: 0.2,
    },
    illustrativeCompatibilityPose: {
      takeoffPitchDeg: 10,
      airborneStanceStability: 0.6,
    },
  },
} as const;

export const MODEL_MANIFEST = {
  name: 'FlyLab mapped-motor embodiment model',
  version: '0.3.0',
  controller: 'state-coherent-mapped-circuit-adapter.v2',
  environment: 'stateful-open-field-model-scale.v3',
  calibrationStatus: MODEL_PARAMETERS.calibrationStatus,
  calibrationSummary: MODEL_PARAMETERS.calibration,
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
  boundary: 'Literature-constrained GF event order and selected approximate intervals with hand-authored, unfitted reduced-order probabilities, amplitudes, body-controller gains, and recovery timing and dynamics. It does not execute connectome neurons, electrical or chemical synapses, neural dynamics, muscles, aerodynamics, FlyGym, or a wet-lab perturbation, and it is not independent biological validation.',
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
    id: 'SRC-GAITANIDIS-PLOS-BIOLOGY-2025',
    kind: 'article',
    title: 'The Drosophila escape motor circuit shows differential vulnerability to aging linked to functional decay',
    url: 'https://doi.org/10.1371/journal.pbio.3003553',
    doi: '10.1371/journal.pbio.3003553',
    citation: 'Gaitanidis A et al. PLOS Biology 23:e3003553 (2025).',
    version: 'Version of record (2025)',
    access: 'Open primary article.',
    license: 'CC-BY-4.0',
    specimen: 'Adult Drosophila in light-off escape behavior and giant-fiber pathway electrophysiology across age groups.',
    redistribution: 'Attribution required for reused article material; FlyLab bundles citation and claim metadata only.',
    notes: 'Provides event-order and timing context: representative light-off escape began moving at about 3.4 ms, became airborne at about 4.5 ms, and extended/beating wings within another 1–2 ms; direct GF stimulation produced an approximately 1.4 ms DLM short-latency response. These are distinct paradigms and are calibration targets, not a fitted FlyLab dose law.',
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
    citation: 'FlyLab contributors. FlyLab mapped-motor model card, version 0.3.0 (2026).',
    version: '0.3.0 / state-coherent-mapped-circuit-adapter.v2',
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
  {
    id: 'E-GF-SEQUENCE-013',
    label: 'Measured giant-fiber escape event order and timing context',
    claim: 'In the cited adult light-off assay, a representative escape first moved at about 3.4 ms, became airborne at about 4.5 ms, and extended and beat its wings within another 1–2 ms; direct GF stimulation produced an approximately 1.4 ms DLM short-latency response.',
    provenance: 'measured',
    sourceIds: ['SRC-GAITANIDIS-PLOS-BIOLOGY-2025'],
    context: 'Adult Drosophila light-off escape behavior and direct giant-fiber pathway electrophysiology reported in distinct assay preparations.',
    caution: 'These timings are event-order and calibration targets across distinct paradigms. They do not identify a FlyLab unitless drive dose, fit the model amplitudes, or make the reduced-order controller a biological replica.',
    role: 'model_context',
    support: { kind: 'motor_context', behaviors: ['short_mode_escape'] },
    sourceSupport: [
      { sourceId: 'SRC-GAITANIDIS-PLOS-BIOLOGY-2025', relation: 'claim_support', locator: 'Results, Fig. 1A and Fig. 2; DLM SLR/LLR electrophysiology section', supports: 'Reports the measured jump-to-airborne-to-wing sequence and the direct-GF-to-DLM short-latency response used only as bounded timing context.' },
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
      'E-GF-SEQUENCE-013',
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

export function takeRankedMatchesWithTies<T extends { score: number }>(
  matches: readonly T[],
  limit: number,
) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('ranked match limit must be a positive integer.');
  }
  const limitedMatches = matches.slice(0, limit);
  const cutoffScore = limitedMatches.at(-1)?.score;
  return cutoffScore === undefined
    ? []
    : matches.filter((match, index) => index < limit || match.score === cutoffScore);
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

export const DEFAULT_GOAL = 'Investigate how the adult fruit-fly brain coordinates leg and wing output during rapid escape. Separate measured findings from connectome inference and simulation assumptions, draft a falsifiable hypothesis, and design a controlled experiment. Stop for my approval, then continue, analyze every metric, compare conditions, and save the complete evidence bundle.';

const SIMULATED_METRIC_BOUNDARY = 'Derived only from seeded outputs of the reduced-order FlyLab model. GF event order and approximate timing are literature-constrained; amplitudes, probabilities, controller gains, recovery, and MDN dynamics remain hand-authored and unfitted. It is not a measured biological quantity, confidence interval, or independent validation.';
const FULL_TRIAL_WINDOW_SEMANTICS = 'Protocol-full-trial scalar. Method v5 supports the analysis window [0, trial_duration_ms] only; exact state-event timestamps are retained independently of the display samples.';

export const METRIC_DEFINITIONS = {
  backward_distance_mm: {
    id: 'backward_distance_mm',
    label: 'Backward distance',
    formula: 'run = max over the authoritative per-run state trajectory of max(0, -y_model_mm); condition = sum(run) / n',
    unit: 'model mm',
    signConvention: 'Nonnegative distance in the backward direction; zero means no modeled backward displacement during the response window.',
    aggregation: 'Arithmetic mean across all seeded runs, including zero for runs without reverse initiation.',
    nullRule: 'Never null; a nonresponsive or non-reverse run contributes 0.',
    windowSemantics: FULL_TRIAL_WINDOW_SEMANTICS,
    methodVersion: METRIC_METHOD_VERSION,
    provenance: ['derived', 'simulation_predicted'],
    boundary: SIMULATED_METRIC_BOUNDARY,
  },
  signed_speed_mm_s: {
    id: 'signed_speed_mm_s',
    label: 'Signed speed',
    formula: 'run = reverse mode ? -(maximum backward-axis displacement / movement_onset→recovery duration) : (start-to-end planar displacement / movement_onset→recovery duration); condition = reverse_mode ? mean(runs with backward distance > 0) : mean(all runs)',
    unit: 'model mm/s',
    signConvention: 'Negative is backward, positive is forward, and zero is stationary. Any run or reverse-mode condition with positive backward distance has negative signed speed.',
    aggregation: 'For reverse maps, arithmetic mean across runs with positive backward distance, or 0 when none move backward; for takeoff maps, arithmetic mean across all seeded runs.',
    nullRule: 'Never null.',
    windowSemantics: FULL_TRIAL_WINDOW_SEMANTICS,
    methodVersion: METRIC_METHOD_VERSION,
    provenance: ['derived', 'simulation_predicted'],
    boundary: SIMULATED_METRIC_BOUNDARY,
  },
  response_latency_ms: {
    id: 'response_latency_ms',
    label: 'Response latency',
    formula: 'candidate = threshold_crossed ? max(minimum_ms, intercept_ms + (1 - effective_motor_drive) * inverse_drive_gain_ms + paired_latency_noise) : null; run = complete body sequence fits before trial end ? candidate : null; condition = responsive_n > 0 ? sum(expressed run latency) / responsive_n : null',
    unit: 'ms',
    signConvention: 'Nonnegative elapsed time measured from nominal protocol onset; smaller values are earlier responses.',
    aggregation: 'Arithmetic mean across responsive runs only; responsive_n is reported separately.',
    nullRule: 'Run value is null when the threshold is not crossed or the candidate response is right-censored by the trial boundary; condition value is null when responsive_n is 0.',
    windowSemantics: FULL_TRIAL_WINDOW_SEMANTICS,
    methodVersion: METRIC_METHOD_VERSION,
    provenance: ['derived', 'simulation_predicted'],
    boundary: SIMULATED_METRIC_BOUNDARY,
  },
  heading_change_deg: {
    id: 'heading_change_deg',
    label: 'Heading change',
    formula: 'run_signed = final trajectory heading - initial trajectory heading; condition = abs(sum(run_signed) / n)',
    unit: '°',
    signConvention: 'Per-run negative is leftward and positive is rightward; the stable condition metric is the nonnegative magnitude of the mean signed change.',
    aggregation: 'Absolute value of the arithmetic mean of signed per-run heading changes.',
    nullRule: 'Never null.',
    windowSemantics: FULL_TRIAL_WINDOW_SEMANTICS,
    methodVersion: METRIC_METHOD_VERSION,
    provenance: ['derived', 'simulation_predicted'],
    boundary: SIMULATED_METRIC_BOUNDARY,
  },
  stance_stability: {
    id: 'stance_stability',
    label: 'Stance stability',
    formula: 'run = left-continuous time integral of stance_stability across the authoritative per-run state trajectory divided by full trace duration; condition = sum(run) / n',
    unit: 'index',
    signConvention: 'Larger values indicate greater modeled stance stability.',
    aggregation: 'Time-weighted full-trial mean within each run, then arithmetic mean across seeded runs.',
    nullRule: 'Never null.',
    windowSemantics: FULL_TRIAL_WINDOW_SEMANTICS,
    methodVersion: METRIC_METHOD_VERSION,
    provenance: ['derived', 'simulation_predicted'],
    boundary: SIMULATED_METRIC_BOUNDARY,
  },
  short_mode_escape_probability: {
    id: 'short_mode_escape_probability',
    label: 'Short-mode escape probability',
    formula: 'condition = sum(I(per-run state trajectory contains an airborne point with ground_contact=false)) / n',
    unit: 'fraction',
    signConvention: 'Larger values indicate a larger fraction of seeded runs completing the model-defined jump-to-airborne state sequence.',
    aggregation: 'Bernoulli sample mean across all seeded runs.',
    nullRule: 'Never null; runs without an airborne state contribute 0.',
    windowSemantics: FULL_TRIAL_WINDOW_SEMANTICS,
    methodVersion: METRIC_METHOD_VERSION,
    provenance: ['derived', 'simulation_predicted'],
    boundary: SIMULATED_METRIC_BOUNDARY,
  },
  vertical_displacement_mm: {
    id: 'vertical_displacement_mm',
    label: 'Vertical displacement',
    formula: 'run = max over the authoritative per-run state trajectory of max(0, z_model_mm); condition = sum(run) / n',
    unit: 'model mm',
    signConvention: 'Nonnegative upward modeled displacement; zero means no modeled lift.',
    aggregation: 'Arithmetic mean across all seeded runs, including zero for runs without short-mode escape initiation.',
    nullRule: 'Never null.',
    windowSemantics: FULL_TRIAL_WINDOW_SEMANTICS,
    methodVersion: METRIC_METHOD_VERSION,
    provenance: ['derived', 'simulation_predicted'],
    boundary: SIMULATED_METRIC_BOUNDARY,
  },
  wing_recruitment: {
    id: 'wing_recruitment',
    label: 'Wing recruitment',
    formula: 'run = max wing_deployment across the authoritative per-run state trajectory; nonresponding and non-takeoff runs remain 0; condition = sum(run) / n',
    unit: 'index',
    signConvention: 'Larger values indicate greater modeled expressed wing deployment after the wing-deployment state transition.',
    aggregation: 'Arithmetic mean across all seeded runs.',
    nullRule: 'Never null; non-takeoff motor maps contribute 0.',
    windowSemantics: FULL_TRIAL_WINDOW_SEMANTICS,
    methodVersion: METRIC_METHOD_VERSION,
    provenance: ['derived', 'simulation_predicted'],
    boundary: SIMULATED_METRIC_BOUNDARY,
  },
  leg_recruitment: {
    id: 'leg_recruitment',
    label: 'Leg recruitment',
    formula: 'run = max leg_extension across the authoritative per-run state trajectory; nonresponding runs remain 0 even when premotor drive is nonzero; condition = sum(run) / n',
    unit: 'index',
    signConvention: 'Larger values indicate greater modeled expressed leg extension after a body-state transition.',
    aggregation: 'Arithmetic mean across all seeded runs.',
    nullRule: 'Never null.',
    windowSemantics: FULL_TRIAL_WINDOW_SEMANTICS,
    methodVersion: METRIC_METHOD_VERSION,
    provenance: ['derived', 'simulation_predicted'],
    boundary: SIMULATED_METRIC_BOUNDARY,
  },
} as const satisfies Record<MetricName, MetricDefinition>;

export const RESPONSE_INITIATION_SUMMARY_DEFINITION = {
  id: 'response_initiation_probability',
  label: 'Response initiation probability',
  formula: 'condition = sum(I(response_initiated)) / n',
  unit: 'fraction',
  signConvention: 'Larger values indicate a larger fraction of seeded runs initiating the motor-map response mode.',
  aggregation: 'Bernoulli sample mean across all seeded runs; the event is reverse initiation for reverse maps and short-mode escape initiation for takeoff maps.',
  nullRule: 'Never null.',
  windowSemantics: FULL_TRIAL_WINDOW_SEMANTICS,
  methodVersion: METRIC_METHOD_VERSION,
  provenance: ['derived', 'simulation_predicted'],
  boundary: `${SIMULATED_METRIC_BOUNDARY} This is a separately declared result summary and is not one of the nine stable objective metrics.`,
} as const satisfies ResponseInitiationSummaryDefinition;

export const RESPONSE_OBSERVATION_SUMMARY_DEFINITION = {
  id: 'response_threshold_and_censoring_summary',
  label: 'Seeded threshold and censoring summaries',
  fields: {
    thresholdCrossingProbability: {
      formula: 'condition = sum(I(response_threshold_crossed)) / n',
      unit: 'fraction',
      aggregation: 'Seeded empirical fraction across all runs; distinct from each run’s model responseThresholdProbability.',
      nullRule: 'Never null.',
    },
    thresholdCrossedN: {
      formula: 'condition = sum(I(response_threshold_crossed))',
      unit: 'runs',
      aggregation: 'Integer count across all seeded runs.',
      nullRule: 'Never null.',
    },
    censoredN: {
      formula: "condition = sum(I(response_disposition = 'censored'))",
      unit: 'runs',
      aggregation: 'Integer count of threshold-crossing candidates whose complete declared body transition does not fit inside the trial window.',
      nullRule: 'Never null.',
    },
  },
  windowSemantics: FULL_TRIAL_WINDOW_SEMANTICS,
  methodVersion: METRIC_METHOD_VERSION,
  provenance: ['derived', 'simulation_predicted'],
  boundary: `${SIMULATED_METRIC_BOUNDARY} These are seeded model-observation summaries, not biological response rates or survival-analysis estimates.`,
} as const satisfies ResponseObservationSummaryDefinition;

export const METRIC_LABELS = ANALYSIS_METRICS.reduce<Record<MetricName, { label: string; unit: string }>>(
  (labels, metric) => {
    labels[metric] = {
      label: METRIC_DEFINITIONS[metric].label,
      unit: METRIC_DEFINITIONS[metric].unit,
    };
    return labels;
  },
  {} as Record<MetricName, { label: string; unit: string }>,
);

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

const SHA256_ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight32(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits));
}

/**
 * Browser-safe synchronous SHA-256 used only for deterministic artifact identity.
 * Approval commitments continue to use Web Crypto and fail closed when it is absent.
 */
export function deterministicSha256Hex(value: unknown): string {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('SHA-256 identity input must be JSON serializable.');
  const bytes = new TextEncoder().encode(serialized);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const state = new Uint32Array([
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ]);
  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const prior15 = schedule[index - 15];
      const prior2 = schedule[index - 2];
      const sigma0 = rotateRight32(prior15, 7) ^ rotateRight32(prior15, 18) ^ (prior15 >>> 3);
      const sigma1 = rotateRight32(prior2, 17) ^ rotateRight32(prior2, 19) ^ (prior2 >>> 10);
      schedule[index] = (schedule[index - 16] + sigma0 + schedule[index - 7] + sigma1) >>> 0;
    }

    let a = state[0];
    let b = state[1];
    let c = state[2];
    let d = state[3];
    let e = state[4];
    let f = state[5];
    let g = state[6];
    let h = state[7];
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight32(e, 6) ^ rotateRight32(e, 11) ^ rotateRight32(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + SHA256_ROUND_CONSTANTS[index] + schedule[index]) >>> 0;
      const sum0 = rotateRight32(a, 2) ^ rotateRight32(a, 13) ^ rotateRight32(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }
  return [...state].map((word) => word.toString(16).padStart(8, '0')).join('');
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
  if (!ANALYSIS_METRICS.includes(input.primaryOutcome)) {
    throw new RangeError(`Hypothesis primaryOutcome must be one of: ${ANALYSIS_METRICS.join(', ')}.`);
  }
  if (input.expectedDirection !== 'increase' && input.expectedDirection !== 'decrease') {
    throw new RangeError('Hypothesis expectedDirection must be increase or decrease.');
  }
  if (!Array.isArray(input.controls)
    || input.controls.length !== HYPOTHESIS_CONTROL_IDS.length
    || new Set(input.controls).size !== HYPOTHESIS_CONTROL_IDS.length
    || input.controls.some((control) => !HYPOTHESIS_CONTROL_IDS.includes(control))) {
    throw new RangeError(`Hypothesis controls must include exactly: ${HYPOTHESIS_CONTROL_IDS.join(', ')}.`);
  }
  if (!Array.isArray(input.evidenceLimitations)
    || input.evidenceLimitations.length === 0
    || input.evidenceLimitations.some((limitation) => typeof limitation !== 'string' || limitation.trim().length === 0)) {
    throw new RangeError('Hypothesis evidenceLimitations must contain at least one nonempty string.');
  }
  const canonicalInput = {
    circuitId: input.circuitId,
    claim: input.claim,
    predictedBehavior: input.predictedBehavior,
    perturbation: input.perturbation,
    primaryOutcome: input.primaryOutcome,
    expectedDirection: input.expectedDirection,
    controls: [...HYPOTHESIS_CONTROL_IDS],
    evidenceIds: [...input.evidenceIds].sort(),
    evidenceLimitations: [...new Set(input.evidenceLimitations.map((limitation) => limitation.trim()))].sort(),
    falsificationCriterion: input.falsificationCriterion,
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
    id: `hyp_${deterministicSha256Hex(canonicalInput)}`,
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
    seedPolicy: EXPERIMENT_SEED_POLICY,
    metricMethodVersion: METRIC_METHOD_VERSION,
  };
  return {
    id: `exp_${deterministicSha256Hex(identity)}`,
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
    seedPolicy: EXPERIMENT_SEED_POLICY,
    metricMethodVersion: METRIC_METHOD_VERSION,
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
    seedPolicy: { ...experiment.seedPolicy },
    metricMethodVersion: experiment.metricMethodVersion,
    conditions: experiment.conditions.map((condition) => ({ ...condition })),
    driveDerivations: experiment.conditions.map((condition) => deriveConditionMotorDrive(condition, experiment)),
    assumptions: [...experiment.assumptions],
  };
}

export function deriveConditionMotorDrive(
  condition: TrialCondition,
  experiment: Pick<Experiment, 'perturbation' | 'durationMs'>,
): MotorDriveDerivation {
  const rawDurationGain = experiment.durationMs / MODEL_PARAMETERS.durationReferenceMs;
  const boundedDurationGain = clamp(
    rawDurationGain,
    MODEL_PARAMETERS.durationGainBounds[0],
    MODEL_PARAMETERS.durationGainBounds[1],
  );
  const lateralityGain = condition.laterality === 'bilateral' ? 1 : MODEL_PARAMETERS.unilateralGain;
  const isPerturbation = condition.kind === 'perturbation';
  const adapterAmount = isPerturbation
    ? condition.nominalControlLevel * boundedDurationGain * lateralityGain
    : 0;
  const referenceMotorDrive = experiment.perturbation === 'silence'
    ? MODEL_PARAMETERS.silencingReferenceMotorDrive
    : 0;
  const suppressionFraction = experiment.perturbation === 'silence' && isPerturbation
    ? clamp(adapterAmount, 0, MODEL_PARAMETERS.maximumSuppressionFraction)
    : 0;
  const effectiveMotorDrive = !isPerturbation
    ? referenceMotorDrive
    : experiment.perturbation === 'activate'
      ? clamp(adapterAmount, 0, MODEL_PARAMETERS.maximumMotorDrive)
      : referenceMotorDrive * (1 - suppressionFraction);
  const formula = !isPerturbation
    ? experiment.perturbation === 'silence'
      ? `reference drive ${referenceMotorDrive} (control arm; no suppression applied)`
      : '0 (baseline/model-sham arm; no mapped activation drive applied)'
    : experiment.perturbation === 'activate'
      ? `clamp(${condition.nominalControlLevel} × clamp(${experiment.durationMs} / ${MODEL_PARAMETERS.durationReferenceMs}, ${MODEL_PARAMETERS.durationGainBounds[0]}, ${MODEL_PARAMETERS.durationGainBounds[1]}) × ${lateralityGain}, 0, ${MODEL_PARAMETERS.maximumMotorDrive}) = ${effectiveMotorDrive}`
      : `${referenceMotorDrive} × (1 - clamp(${condition.nominalControlLevel} × clamp(${experiment.durationMs} / ${MODEL_PARAMETERS.durationReferenceMs}, ${MODEL_PARAMETERS.durationGainBounds[0]}, ${MODEL_PARAMETERS.durationGainBounds[1]}) × ${lateralityGain}, 0, ${MODEL_PARAMETERS.maximumSuppressionFraction})) = ${effectiveMotorDrive}`;
  return {
    conditionId: condition.id,
    perturbation: experiment.perturbation,
    nominalControlLevel: condition.nominalControlLevel,
    durationMs: experiment.durationMs,
    durationReferenceMs: MODEL_PARAMETERS.durationReferenceMs,
    rawDurationGain,
    boundedDurationGain,
    durationGainBounds: MODEL_PARAMETERS.durationGainBounds,
    laterality: condition.laterality,
    lateralityGain,
    adapterAmount,
    referenceMotorDrive,
    suppressionFraction,
    effectiveMotorDrive,
    formula,
    provenance: 'agent_hypothesized',
    boundary: 'Versioned FlyLab controller arithmetic only. Nominal control and effective motor drive are unitless model quantities, not optical power, firing rate, synaptic weight, muscle activation, or a biological dose.',
  };
}

function simulateIllustrativeTrajectory(condition: TrialCondition, experiment: Experiment, motorDrive: number, seed: number): TrajectoryPoint[] {
  const random = mulberry32(seed);
  const points: TrajectoryPoint[] = [];
  let x = 0;
  let y = 0;
  let z = 0;
  let heading = 0;
  const steps = MODEL_PARAMETERS.trajectory.steps;
  for (let step = 0; step <= steps; step += 1) {
    const t = (experiment.trialDurationMs * step) / steps;
    const protocolOffsetMs = Math.min(experiment.trialDurationMs, experiment.onsetMs + experiment.durationMs);
    const inProtocolWindow = t >= experiment.onsetMs && t < protocolOffsetMs;
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
    const lateralEffectFraction = clamp(
      Math.abs(lateralEffect) / MODEL_PARAMETERS.silencingReferenceMotorDrive,
      0,
      1,
    );
    if (motorOutputActive) {
      heading += active && lateralSign !== 0 && lateralEffectFraction > 0
        ? lateralSign * lateralModeSign * (
            MODEL_PARAMETERS.trajectory.activeTurnBaseDegPerStep * lateralEffectFraction
            + lateralEffect * MODEL_PARAMETERS.trajectory.activeTurnGainDegPerStep
          )
        : jitter(random, MODEL_PARAMETERS.trajectory.headingJitterScaleDeg);
    }
    const speed = takeoffMode
      ? MODEL_PARAMETERS.trajectory.baseStepModelMm + drive * MODEL_PARAMETERS.escapeTakeoff.trajectoryForwardGainModelMm
      : MODEL_PARAMETERS.trajectory.baseStepModelMm + drive * MODEL_PARAMETERS.trajectory.driveStepGainModelMm;
    if (motorOutputActive) {
      x += Math.sin((heading * Math.PI) / 180) * speed
        + (lateralEffectFraction > 0 ? lateralSign || 1 : 1)
          * jitter(random, MODEL_PARAMETERS.trajectory.positionJitterScaleModelMm);
      y += direction * Math.cos((heading * Math.PI) / 180) * speed
        + jitter(random, MODEL_PARAMETERS.trajectory.positionJitterScaleModelMm);
      if (takeoffMode) z += drive * MODEL_PARAMETERS.escapeTakeoff.trajectoryLiftGainModelMm;
    } else if (takeoffMode) {
      z = 0;
    }
    points.push({
      t: Math.round(t),
      x,
      y,
      z,
      heading,
      active,
      motorOutputActive,
      state: motorOutputActive ? takeoffMode ? 'airborne' : 'reverse_walk' : 'stance',
      groundContact: !takeoffMode || !motorOutputActive,
      legExtension: motorOutputActive ? clamp(drive, 0, 1) : 0,
      wingDeployment: motorOutputActive && takeoffMode ? clamp(drive, 0, 1) : 0,
      bodyPitchDeg: motorOutputActive && takeoffMode
        ? MODEL_PARAMETERS.stateTrajectory.illustrativeCompatibilityPose.takeoffPitchDeg
        : 0,
      bodyRollDeg: 0,
      premotorDriveIndex: drive,
      stanceStability: motorOutputActive && takeoffMode
        ? MODEL_PARAMETERS.stateTrajectory.illustrativeCompatibilityPose.airborneStanceStability
        : MODEL_PARAMETERS.stanceStability.baseline,
    });
  }
  return points;
}

export function replicateSeedFromPolicy(
  policy: ExperimentSeedPolicy,
  baseSeed: number,
  replicateIndex: number,
) {
  return baseSeed + replicateIndex * policy.replicateStride;
}

export function runTrajectorySeedFromPolicy(
  policy: ExperimentSeedPolicy,
  replicateSeed: number,
) {
  return replicateSeed + policy.trajectoryOffset;
}

export function illustrativeTrajectorySeedFromPolicy(
  policy: ExperimentSeedPolicy,
  baseSeed: number,
) {
  return baseSeed + policy.illustrativeTrajectoryOffset;
}

interface PairedReplicateDraws {
  responseUniform: number;
  speedNoise: number;
  latencyNoise: number;
  backwardDistanceUniform: number;
  verticalNoise: number;
  wingNoise: number;
  legNoise: number;
  headingNoise: number;
  stanceNoise: number;
  recoveryNoise: number;
}

function pairedReplicateDraws(seed: number): PairedReplicateDraws {
  const random = mulberry32(seed);
  return {
    responseUniform: random(),
    speedNoise: jitter(random),
    latencyNoise: jitter(random),
    backwardDistanceUniform: random(),
    verticalNoise: jitter(random),
    wingNoise: jitter(random),
    legNoise: jitter(random),
    headingNoise: jitter(random),
    stanceNoise: jitter(random),
    recoveryNoise: jitter(random),
  };
}

interface RunTrajectoryInputs {
  eventTimeline: EmbodiedEventTimeline;
  targetSignedSpeedMmS: number;
  backwardDistanceScale: number;
  targetHeadingChangeDeg: number;
  targetBodyRollChangeDeg: number;
  targetVerticalDisplacementMm: number;
  targetWingRecruitment: number;
  targetLegRecruitment: number;
  baselineStanceStability: number;
  targetStanceStability: number;
}

function buildEmbodiedEventTimeline(
  experiment: Pick<Experiment, 'motorMap' | 'onsetMs' | 'trialDurationMs'>,
  motorDrive: number,
  responseDisposition: ReplicateResult['responseDisposition'],
  responseLatencyMs: number | null,
  candidateResponseLatencyMs: number | null,
  recoveryNoise: number,
): EmbodiedEventTimeline {
  const takeoffMode = experiment.motorMap.responseMode === 'takeoff';
  if (responseDisposition !== 'expressed' || responseLatencyMs === null) {
    const thresholdCrossed = responseDisposition === 'censored';
    return {
      responseInitiated: false,
      responseDisposition,
      thresholdCrossed,
      stimulusOnsetMs: experiment.onsetMs,
      candidateMovementOnsetMs: candidateResponseLatencyMs === null
        ? null
        : experiment.onsetMs + candidateResponseLatencyMs,
      controllerThresholdMs: null,
      movementOnsetMs: null,
      groundReleaseMs: null,
      wingDeploymentMs: null,
      recoveryMs: null,
      sourceConstraint: takeoffMode
        ? MODEL_PARAMETERS.escapeTakeoff.eventTiming.boundary
        : 'MDN event timing remains hand-authored and unfitted.',
      provenance: ['simulation_predicted'],
      boundary: thresholdCrossed
        ? 'The seeded response threshold was crossed, but the complete declared body transition could not fit inside the trial window; the run is censored and expressed appendage recruitment remains absent.'
        : 'No modeled response crossed threshold; body-state transitions and expressed appendage recruitment remain absent even when premotor drive is nonzero.',
    };
  }

  const movementOnsetMs = clamp(
    experiment.onsetMs + responseLatencyMs,
    experiment.onsetMs,
    experiment.trialDurationMs,
  );
  if (!takeoffMode) {
    return {
      responseInitiated: true,
      responseDisposition: 'expressed',
      thresholdCrossed: true,
      stimulusOnsetMs: experiment.onsetMs,
      candidateMovementOnsetMs: movementOnsetMs,
      controllerThresholdMs: Math.max(
        experiment.onsetMs,
        movementOnsetMs - Math.min(
          MODEL_PARAMETERS.stateTrajectory.reverseControllerLead.maximumMs,
          responseLatencyMs * MODEL_PARAMETERS.stateTrajectory.reverseControllerLead.latencyFraction,
        ),
      ),
      movementOnsetMs,
      groundReleaseMs: null,
      wingDeploymentMs: null,
      recoveryMs: experiment.trialDurationMs,
      sourceConstraint: 'MDN event timing remains hand-authored and unfitted.',
      provenance: ['simulation_predicted'],
      boundary: 'Versioned reduced-order retreat-state timing; not measured neural, joint, or contact timing.',
    };
  }

  const timing = MODEL_PARAMETERS.escapeTakeoff.eventTiming;
  const controllerThresholdMs = Math.max(experiment.onsetMs, movementOnsetMs - timing.controllerLeadMs);
  const groundReleaseMs = Math.min(experiment.trialDurationMs, movementOnsetMs + timing.groundReleaseDelayMs);
  const wingDeploymentMs = Math.min(experiment.trialDurationMs, groundReleaseMs + timing.wingDelayAfterGroundReleaseMs);
  const recoveryDurationMs = Math.max(
    1,
    timing.recoveryBaseMs
      + motorDrive * timing.recoveryDriveGainMs
      + recoveryNoise * timing.recoveryJitterScaleMs,
  );
  const recoveryMs = Math.min(experiment.trialDurationMs, wingDeploymentMs + recoveryDurationMs);
  return {
    responseInitiated: true,
    responseDisposition: 'expressed',
    thresholdCrossed: true,
    stimulusOnsetMs: experiment.onsetMs,
    candidateMovementOnsetMs: movementOnsetMs,
    controllerThresholdMs,
    movementOnsetMs,
    groundReleaseMs,
    wingDeploymentMs,
    recoveryMs,
    sourceConstraint: timing.boundary,
    provenance: ['simulation_predicted'],
    boundary: 'Literature-constrained event order with hand-authored, unfitted controller-to-body amplitudes and recovery duration; not a direct replay of any animal trial.',
  };
}

function trajectorySampleTimes(experiment: Experiment, timeline: EmbodiedEventTimeline) {
  const times = new Set<number>();
  const steps = MODEL_PARAMETERS.trajectory.steps;
  for (let step = 0; step <= steps; step += 1) {
    times.add(Number(((experiment.trialDurationMs * step) / steps).toFixed(6)));
  }
  const epsilon = MODEL_PARAMETERS.stateTrajectory.eventSamplingBoundaryEpsilonMs;
  const protocolBoundaries = [
    experiment.onsetMs,
    Math.min(experiment.trialDurationMs, experiment.onsetMs + experiment.durationMs),
  ];
  for (const boundary of protocolBoundaries) {
    times.add(boundary);
    if (boundary > 0) times.add(Math.max(0, boundary - epsilon));
    if (boundary < experiment.trialDurationMs) times.add(Math.min(experiment.trialDurationMs, boundary + epsilon));
  }
  const events = [
    timeline.controllerThresholdMs,
    timeline.movementOnsetMs,
    timeline.groundReleaseMs,
    timeline.wingDeploymentMs,
    timeline.recoveryMs,
  ].filter((value): value is number => value !== null);
  events.forEach((eventTime, index) => {
    times.add(eventTime);
    if (eventTime > 0) times.add(Math.max(
      0,
      eventTime - epsilon,
    ));
    if (eventTime < experiment.trialDurationMs) times.add(Math.min(
      experiment.trialDurationMs,
      eventTime + epsilon,
    ));
    const next = events[index + 1];
    if (next !== undefined && next > eventTime) times.add((eventTime + next) / 2);
  });
  return [...times].sort((left, right) => left - right);
}

function embodiedStateAtTime(
  timeline: EmbodiedEventTimeline,
  takeoffMode: boolean,
  timeMs: number,
): EmbodiedBehaviorState {
  if (!timeline.responseInitiated || timeline.controllerThresholdMs === null || timeline.movementOnsetMs === null) return 'stance';
  if (timeMs < timeline.controllerThresholdMs) return 'stance';
  if (timeMs < timeline.movementOnsetMs) return 'preparation';
  if (!takeoffMode) return timeline.recoveryMs !== null && timeMs >= timeline.recoveryMs ? 'recovery' : 'reverse_walk';
  if (timeline.groundReleaseMs === null || timeline.wingDeploymentMs === null || timeline.recoveryMs === null) return 'stance';
  if (timeMs < timeline.groundReleaseMs) return 'jump';
  if (timeMs < timeline.wingDeploymentMs) return 'wing_deployment';
  if (timeMs < timeline.recoveryMs) return 'airborne';
  return 'recovery';
}

function stateProgress(timeMs: number, startMs: number | null, endMs: number | null) {
  if (startMs === null || endMs === null || endMs <= startMs) return 0;
  return clamp((timeMs - startMs) / (endMs - startMs), 0, 1);
}

function simulateRunTrajectory(
  condition: TrialCondition,
  experiment: Experiment,
  motorDrive: number,
  seed: number,
  outcome: RunTrajectoryInputs,
): TrajectoryPoint[] {
  const trajectoryRandom = mulberry32(seed);
  const trajectoryDistanceScale = MODEL_PARAMETERS.stateTrajectory.distanceScale.minimum
    + trajectoryRandom() * MODEL_PARAMETERS.stateTrajectory.distanceScale.range;
  const points: TrajectoryPoint[] = [];
  const takeoffMode = experiment.motorMap.responseMode === 'takeoff';
  let x = 0;
  let y = 0;
  let priorTimeMs = 0;

  for (const t of trajectorySampleTimes(experiment, outcome.eventTimeline)) {
    const protocolOffsetMs = Math.min(experiment.trialDurationMs, experiment.onsetMs + experiment.durationMs);
    const inProtocolWindow = t >= experiment.onsetMs && t < protocolOffsetMs;
    const active = condition.kind === 'perturbation' && inProtocolWindow;
    const state = embodiedStateAtTime(outcome.eventTimeline, takeoffMode, t);
    const motorOutputActive = state === 'reverse_walk'
      || state === 'jump'
      || state === 'wing_deployment'
      || state === 'airborne';
    const movementStartMs = outcome.eventTimeline.movementOnsetMs;
    const movementEndMs = outcome.eventTimeline.recoveryMs;
    const movementProgress = stateProgress(t, movementStartMs, movementEndMs);
    const heading = movementProgress === 0 ? 0 : outcome.targetHeadingChangeDeg * movementProgress;
    const movementIntervalStartMs = movementStartMs === null
      ? t
      : Math.max(priorTimeMs, movementStartMs);
    const movementIntervalEndMs = movementEndMs === null
      ? movementIntervalStartMs
      : Math.min(t, movementEndMs);
    const elapsedSeconds = Math.max(0, movementIntervalEndMs - movementIntervalStartMs) / 1000;
    if (elapsedSeconds > 0) {
      const speedMagnitude = Math.abs(outcome.targetSignedSpeedMmS);
      const reverse = !takeoffMode && outcome.targetSignedSpeedMmS < 0;
      const distanceScale = reverse ? outcome.backwardDistanceScale : 1;
      const distance = speedMagnitude * elapsedSeconds * distanceScale * trajectoryDistanceScale;
      x += Math.sin((heading * Math.PI) / 180) * distance;
      y += (reverse ? -1 : 1) * Math.cos((heading * Math.PI) / 180) * distance;
    }

    let z = 0;
    let legExtension = 0;
    let wingDeployment = 0;
    let bodyPitchDeg = 0;
    if (takeoffMode) {
      const jumpProgress = stateProgress(t, outcome.eventTimeline.movementOnsetMs, outcome.eventTimeline.groundReleaseMs);
      const wingProgress = stateProgress(t, outcome.eventTimeline.groundReleaseMs, outcome.eventTimeline.wingDeploymentMs);
      const airborneProgress = stateProgress(t, outcome.eventTimeline.wingDeploymentMs, outcome.eventTimeline.recoveryMs);
      if (state === 'jump') {
        legExtension = outcome.targetLegRecruitment * Math.sin(jumpProgress * Math.PI / 2);
        bodyPitchDeg = MODEL_PARAMETERS.stateTrajectory.takeoffPose.jumpPitchDeg * jumpProgress;
      }
      if (state === 'wing_deployment') {
        legExtension = outcome.targetLegRecruitment * (
          1 - wingProgress * MODEL_PARAMETERS.stateTrajectory.takeoffPose.wingDeploymentLegDecayFraction
        );
        wingDeployment = outcome.targetWingRecruitment * wingProgress;
        bodyPitchDeg = MODEL_PARAMETERS.stateTrajectory.takeoffPose.jumpPitchDeg
          + MODEL_PARAMETERS.stateTrajectory.takeoffPose.wingDeploymentPitchDeltaDeg * wingProgress;
      }
      if (state === 'airborne') {
        legExtension = outcome.targetLegRecruitment
          * MODEL_PARAMETERS.stateTrajectory.takeoffPose.airborneLegRetentionFraction;
        wingDeployment = outcome.targetWingRecruitment;
        bodyPitchDeg = MODEL_PARAMETERS.stateTrajectory.takeoffPose.airborneRecoveryPitchDeg
          * (1 - airborneProgress);
      }
      if (outcome.eventTimeline.groundReleaseMs !== null && outcome.eventTimeline.recoveryMs !== null
        && t >= outcome.eventTimeline.groundReleaseMs && t < outcome.eventTimeline.recoveryMs) {
        const flightProgress = stateProgress(t, outcome.eventTimeline.groundReleaseMs, outcome.eventTimeline.recoveryMs);
        z = outcome.targetVerticalDisplacementMm * Math.sin(Math.PI * flightProgress);
      }
    } else if (state === 'reverse_walk') {
      legExtension = outcome.targetLegRecruitment;
    }

    const groundContact = !takeoffMode || (state !== 'wing_deployment' && state !== 'airborne');
    const stanceStability = state === 'stance' || state === 'recovery'
      ? outcome.baselineStanceStability
      : state === 'preparation'
        ? clamp(
            outcome.baselineStanceStability
              - MODEL_PARAMETERS.stateTrajectory.stanceStability.preparationPenalty,
            0,
            1,
          )
        : takeoffMode
          ? state === 'jump'
            ? MODEL_PARAMETERS.stateTrajectory.stanceStability.jump
            : state === 'wing_deployment'
              ? MODEL_PARAMETERS.stateTrajectory.stanceStability.wingDeployment
              : MODEL_PARAMETERS.stateTrajectory.stanceStability.airborne
          : clamp(
              outcome.targetStanceStability
                - MODEL_PARAMETERS.stateTrajectory.stanceStability.reverseWalkPenalty,
              0,
              1,
            );
    points.push({
      t,
      x,
      y,
      z,
      heading,
      active,
      motorOutputActive,
      state,
      groundContact,
      legExtension,
      wingDeployment,
      bodyPitchDeg,
      bodyRollDeg: movementProgress === 0 ? 0 : outcome.targetBodyRollChangeDeg * movementProgress,
      premotorDriveIndex: inProtocolWindow ? motorDrive : 0,
      stanceStability,
    });
    priorTimeMs = t;
  }
  return points;
}

function summarizeRunTrajectory(
  trajectory: TrajectoryPoint[],
  timeline: EmbodiedEventTimeline,
  takeoffMode: boolean,
) {
  const first = trajectory[0];
  const last = trajectory.at(-1);
  const movementDurationSeconds = timeline.movementOnsetMs === null || timeline.recoveryMs === null
    ? 0
    : Math.max(0, timeline.recoveryMs - timeline.movementOnsetMs) / 1000;
  const backwardDistanceMm = Math.max(0, ...trajectory.map((point) => -point.y));
  const planarDistanceMm = first && last ? Math.hypot(last.x - first.x, last.y - first.y) : 0;
  const signedSpeedMmS = movementDurationSeconds > 0
    ? takeoffMode
      ? planarDistanceMm / movementDurationSeconds
      : backwardDistanceMm > 0 ? -(backwardDistanceMm / movementDurationSeconds) : 0
    : 0;
  let stanceArea = 0;
  for (let index = 1; index < trajectory.length; index += 1) {
    const previous = trajectory[index - 1]!;
    const current = trajectory[index]!;
    stanceArea += previous.stanceStability * Math.max(0, current.t - previous.t);
  }
  const traceDurationMs = first && last ? Math.max(0, last.t - first.t) : 0;
  return {
    backwardDistanceMm,
    signedSpeedMmS,
    headingChangeDeg: first && last ? last.heading - first.heading : 0,
    stanceStability: traceDurationMs > 0 ? stanceArea / traceDurationMs : first?.stanceStability ?? 0,
    verticalDisplacementMm: Math.max(0, ...trajectory.map((point) => point.z)),
    wingRecruitment: Math.max(0, ...trajectory.map((point) => point.wingDeployment)),
    legRecruitment: Math.max(0, ...trajectory.map((point) => point.legExtension)),
    takeoffSuccess: trajectory.some((point) => point.state === 'airborne' && !point.groundContact),
  };
}

function numericallyEqual(left: number, right: number) {
  return Math.abs(left - right) <= 1e-12;
}

export function validateSimulationBatch(batch: SimulationBatch): void {
  const expectedMotorMap = motorMapForCircuit(batch.protocol.targetCircuitId);
  const conditionIds = batch.conditionRuns.map((condition) => condition.conditionId);
  const protocolConditionIds = batch.protocol.conditions.map((condition) => condition.id);
  const identity = batch.conditionRuns.flatMap((condition) => condition.replicates.map((replicate) => ({
    runId: replicate.id,
    trajectoryId: replicate.trajectoryId,
  })));
  if (batch.experimentId !== batch.protocol.experimentId
    || batch.targetCircuitId !== batch.protocol.targetCircuitId
    || batch.behavior !== batch.protocol.behavior
    || batch.motorMap.id !== batch.protocol.motorMapId
    || !expectedMotorMap
    || JSON.stringify(batch.motorMap) !== JSON.stringify(expectedMotorMap)
    || batch.protocol.metricMethodVersion !== METRIC_METHOD_VERSION
    || JSON.stringify(batch.model) !== JSON.stringify(MODEL_MANIFEST)
    || batch.runHash !== `fnv1a:${stableHash(identity)}`
    || batch.runHashScope !== 'run_and_trajectory_ids_only'
    || batch.runHashSerialization !== 'FNV-1a(JSON.stringify([{ runId, trajectoryId }]))'
    || batch.runContentHash !== computeSimulationRunContentHash(batch.protocol, batch.model, batch.conditionRuns)
    || batch.runContentHashScope !== 'protocol_model_and_complete_condition_runs'
    || batch.runContentHashSerialization !== 'SHA-256(JSON.stringify({ protocol, model, conditionRuns }))'
    || batch.id !== `batch_${deterministicSha256Hex({ experiment: batch.protocol.experimentId, identity })}`
    || conditionIds.length !== protocolConditionIds.length
    || new Set(conditionIds).size !== conditionIds.length
    || conditionIds.some((conditionId, index) => conditionId !== protocolConditionIds[index])) {
    throw new RangeError(`Simulation batch ${batch.id} contradicts its protocol, model, condition, or identity manifest.`);
  }
  const takeoffMode = batch.motorMap.responseMode === 'takeoff';
  for (const condition of batch.conditionRuns) {
    const protocolCondition = batch.protocol.conditions.find((item) => item.id === condition.conditionId);
    if (!protocolCondition) {
      throw new RangeError(`Simulation condition ${condition.conditionId} is absent from the protocol snapshot.`);
    }
    const expectedDriveDerivation = deriveConditionMotorDrive(protocolCondition, batch.protocol);
    if (condition.label !== protocolCondition.label
      || condition.laterality !== protocolCondition.laterality
      || condition.effectiveMotorDrive !== expectedDriveDerivation.effectiveMotorDrive
      || JSON.stringify(condition.driveDerivation) !== JSON.stringify(expectedDriveDerivation)
      || condition.replicates.length !== batch.protocol.replicates) {
      throw new RangeError(`Simulation condition ${condition.conditionId} contradicts its protocol drive or replicate manifest.`);
    }
    if (condition.runIds.length !== condition.replicates.length
      || condition.runIds.some((runId, index) => runId !== condition.replicates[index]?.id)) {
      throw new RangeError(`Simulation condition ${condition.conditionId} has an inconsistent run-ID manifest.`);
    }
    for (const [replicateIndex, replicate] of condition.replicates.entries()) {
      const expectedSeed = replicateSeedFromPolicy(batch.protocol.seedPolicy, batch.protocol.seed, replicateIndex);
      const expectedTrajectorySeed = runTrajectorySeedFromPolicy(batch.protocol.seedPolicy, expectedSeed);
      const expectedRunId = `run_${deterministicSha256Hex({
        experiment: batch.protocol.experimentId,
        condition: condition.conditionId,
        replicateIndex,
        seed: expectedSeed,
      })}`;
      const expectedTrajectoryId = `trajectory_${deterministicSha256Hex({
        run: expectedRunId,
        seed: expectedTrajectorySeed,
        method: 'flylab.per-run-state-trajectory.v2',
      })}`;
      const draws = pairedReplicateDraws(expectedSeed);
      const responseParameters = takeoffMode
        ? MODEL_PARAMETERS.escapeTakeoff.responseProbability
        : MODEL_PARAMETERS.reverseProbability;
      const expectedResponseThresholdProbability = clamp(
        responseParameters.baseline + condition.effectiveMotorDrive * responseParameters.driveGain,
        responseParameters.minimum,
        responseParameters.maximum,
      );
      const expectedThresholdCrossed = draws.responseUniform < expectedResponseThresholdProbability;
      const latencyParameters = takeoffMode
        ? MODEL_PARAMETERS.escapeTakeoff.responseLatency
        : MODEL_PARAMETERS.responseLatency;
      const expectedCandidateLatencyMs = expectedThresholdCrossed
        ? Math.max(
            latencyParameters.minimumClampMs,
            latencyParameters.interceptMs
              + (1 - condition.effectiveMotorDrive) * latencyParameters.inverseDriveGainMs
              + draws.latencyNoise * latencyParameters.jitterScaleMs,
          )
        : null;
      const requiredPostMovementMs = takeoffMode
        ? MODEL_PARAMETERS.escapeTakeoff.eventTiming.groundReleaseDelayMs
          + MODEL_PARAMETERS.escapeTakeoff.eventTiming.wingDelayAfterGroundReleaseMs
        : 0;
      const responseWindowMs = Math.max(0, batch.protocol.trialDurationMs - batch.protocol.onsetMs);
      const expectedResponseInitiated = expectedCandidateLatencyMs !== null
        && expectedCandidateLatencyMs + requiredPostMovementMs < responseWindowMs;
      const expectedDisposition: ReplicateResult['responseDisposition'] = !expectedThresholdCrossed
        ? 'not_crossed'
        : expectedResponseInitiated
          ? 'expressed'
          : 'censored';
      const expectedBackwardDistanceScale = MODEL_PARAMETERS.backwardDistanceScale.minimum
        + draws.backwardDistanceUniform * (
          MODEL_PARAMETERS.backwardDistanceScale.maximum - MODEL_PARAMETERS.backwardDistanceScale.minimum
        );
      if (replicate.id !== expectedRunId
        || replicate.conditionId !== condition.conditionId
        || replicate.seed !== expectedSeed
        || replicate.trajectorySeed !== expectedTrajectorySeed
        || replicate.trajectoryId !== expectedTrajectoryId
        || replicate.effectiveMotorDrive !== condition.effectiveMotorDrive
        || replicate.premotorDriveIndex !== condition.effectiveMotorDrive
        || JSON.stringify(replicate.driveDerivation) !== JSON.stringify(expectedDriveDerivation)
        || replicate.responseThresholdProbability !== expectedResponseThresholdProbability
        || replicate.responseThresholdCrossed !== expectedThresholdCrossed
        || replicate.candidateResponseLatencyMs !== expectedCandidateLatencyMs
        || replicate.responseInitiated !== expectedResponseInitiated
        || replicate.responseDisposition !== expectedDisposition
        || replicate.backwardDistanceScale !== expectedBackwardDistanceScale) {
        throw new RangeError(`Simulation run ${replicate.id} contradicts its seeded common-random-number record.`);
      }
      const timeline = replicate.eventTimeline;
      const expectedTimeline = buildEmbodiedEventTimeline(
        {
          motorMap: batch.motorMap,
          onsetMs: batch.protocol.onsetMs,
          trialDurationMs: batch.protocol.trialDurationMs,
        },
        condition.effectiveMotorDrive,
        expectedDisposition,
        expectedResponseInitiated ? expectedCandidateLatencyMs : null,
        expectedCandidateLatencyMs,
        draws.recoveryNoise,
      );
      if (JSON.stringify(timeline) !== JSON.stringify(expectedTimeline)) {
        throw new RangeError(`Simulation run ${replicate.id} event timeline contradicts its seeded response record.`);
      }
      const summary = summarizeRunTrajectory(replicate.trajectory, timeline, takeoffMode);
      const numericSummaries = [
        ['backwardDistanceMm', replicate.backwardDistanceMm, summary.backwardDistanceMm],
        ['signedSpeedMmS', replicate.signedSpeedMmS, summary.signedSpeedMmS],
        ['headingChangeDeg', replicate.headingChangeDeg, summary.headingChangeDeg],
        ['stanceStability', replicate.stanceStability, summary.stanceStability],
        ['verticalDisplacementMm', replicate.verticalDisplacementMm, summary.verticalDisplacementMm],
        ['wingRecruitment', replicate.wingRecruitment, summary.wingRecruitment],
        ['legRecruitment', replicate.legRecruitment, summary.legRecruitment],
      ] as const;
      for (const [field, recorded, recomputed] of numericSummaries) {
        if (!numericallyEqual(recorded, recomputed)) {
          throw new RangeError(
            `Simulation run ${replicate.id} field ${field} contradicts its authoritative state trajectory.`,
          );
        }
      }
      if (replicate.takeoffSuccess !== summary.takeoffSuccess) {
        throw new RangeError(`Simulation run ${replicate.id} takeoffSuccess contradicts its authoritative state trajectory.`);
      }
      if (replicate.responseInitiated !== timeline.responseInitiated
        || replicate.responseDisposition !== timeline.responseDisposition
        || replicate.responseThresholdCrossed !== timeline.thresholdCrossed) {
        throw new RangeError(`Simulation run ${replicate.id} response fields contradict its event timeline.`);
      }
      const expectedCandidateMovementOnsetMs = replicate.candidateResponseLatencyMs === null
        ? null
        : batch.protocol.onsetMs + replicate.candidateResponseLatencyMs;
      if (timeline.candidateMovementOnsetMs !== expectedCandidateMovementOnsetMs) {
        throw new RangeError(`Simulation run ${replicate.id} candidate response timing contradicts its event timeline.`);
      }
      const expectedReverseInitiated = !takeoffMode && replicate.responseInitiated;
      const expectedShortModeInitiated = takeoffMode && replicate.responseInitiated;
      if (replicate.reverseInitiated !== expectedReverseInitiated
        || replicate.shortModeEscapeInitiated !== expectedShortModeInitiated) {
        throw new RangeError(`Simulation run ${replicate.id} response-mode flags are inconsistent.`);
      }
      if (replicate.responseDisposition === 'expressed') {
        if (!replicate.responseThresholdCrossed
          || !replicate.responseInitiated
          || replicate.responseLatencyMs === null
          || replicate.candidateResponseLatencyMs !== replicate.responseLatencyMs
          || timeline.movementOnsetMs !== batch.protocol.onsetMs + replicate.responseLatencyMs) {
          throw new RangeError(`Simulation run ${replicate.id} has an incoherent expressed-response record.`);
        }
      } else if (replicate.responseInitiated
        || replicate.responseLatencyMs !== null
        || timeline.movementOnsetMs !== null
        || (replicate.responseDisposition === 'censored') !== replicate.responseThresholdCrossed
        || (replicate.responseDisposition === 'censored' && replicate.candidateResponseLatencyMs === null)
        || (replicate.responseDisposition === 'not_crossed' && replicate.candidateResponseLatencyMs !== null)) {
        throw new RangeError(`Simulation run ${replicate.id} has an incoherent absent or censored response record.`);
      }
      if (!replicate.trajectory.length) {
        throw new RangeError(`Simulation run ${replicate.id} has no authoritative state trajectory.`);
      }
      let previousTime = -Infinity;
      for (const point of replicate.trajectory) {
        const numericPointFields = [
          point.t,
          point.x,
          point.y,
          point.z,
          point.heading,
          point.legExtension,
          point.wingDeployment,
          point.bodyPitchDeg,
          point.bodyRollDeg,
          point.premotorDriveIndex,
          point.stanceStability,
        ];
        if (numericPointFields.some((value) => !Number.isFinite(value))
          || point.t < 0
          || point.t > batch.protocol.trialDurationMs
          || point.t <= previousTime
          || point.z < 0
          || point.legExtension < 0
          || point.legExtension > 1
          || point.wingDeployment < 0
          || point.wingDeployment > 1
          || point.stanceStability < 0
          || point.stanceStability > 1) {
          throw new RangeError(`Simulation run ${replicate.id} has an invalid trajectory sample at ${point.t} ms.`);
        }
        previousTime = point.t;
        const protocolOffsetMs = Math.min(
          batch.protocol.trialDurationMs,
          batch.protocol.onsetMs + batch.protocol.durationMs,
        );
        const inProtocolWindow = point.t >= batch.protocol.onsetMs && point.t < protocolOffsetMs;
        const expectedActive = protocolCondition.kind === 'perturbation' && inProtocolWindow;
        const expectedPremotorDrive = inProtocolWindow ? replicate.effectiveMotorDrive : 0;
        if (point.active !== expectedActive || point.premotorDriveIndex !== expectedPremotorDrive) {
          throw new RangeError(`Simulation run ${replicate.id} contradicts the exact protocol window at ${point.t} ms.`);
        }
        const expectedState = embodiedStateAtTime(timeline, takeoffMode, point.t);
        const expectedMotorOutput = expectedState === 'reverse_walk'
          || expectedState === 'jump'
          || expectedState === 'wing_deployment'
          || expectedState === 'airborne';
        const expectedGroundContact = !takeoffMode
          || (expectedState !== 'wing_deployment' && expectedState !== 'airborne');
        if (point.state !== expectedState
          || point.motorOutputActive !== expectedMotorOutput
          || point.groundContact !== expectedGroundContact) {
          throw new RangeError(`Simulation run ${replicate.id} contains a state/contact contradiction at ${point.t} ms.`);
        }
        if ((expectedState === 'stance' || expectedState === 'preparation')
          && (point.x !== 0
            || point.y !== 0
            || point.z !== 0
            || point.heading !== 0
            || point.legExtension !== 0
            || point.wingDeployment !== 0
            || point.bodyPitchDeg !== 0
            || point.bodyRollDeg !== 0)) {
          throw new RangeError(`Simulation run ${replicate.id} expresses body output before movement at ${point.t} ms.`);
        }
        if (replicate.responseDisposition !== 'expressed'
          && (point.x !== 0
            || point.y !== 0
            || point.z !== 0
            || point.heading !== 0
            || point.legExtension !== 0
            || point.wingDeployment !== 0
            || point.bodyPitchDeg !== 0
            || point.bodyRollDeg !== 0
            || point.motorOutputActive)) {
          throw new RangeError(`Simulation run ${replicate.id} expresses body output without an expressed response.`);
        }
      }
      if (replicate.trajectory[0]?.t !== 0
        || replicate.trajectory.at(-1)?.t !== batch.protocol.trialDurationMs) {
        throw new RangeError(`Simulation run ${replicate.id} does not span the complete trial window.`);
      }
      const requiredSampleTimes = [
        batch.protocol.onsetMs,
        Math.min(batch.protocol.trialDurationMs, batch.protocol.onsetMs + batch.protocol.durationMs),
        timeline.controllerThresholdMs,
        timeline.movementOnsetMs,
        timeline.groundReleaseMs,
        timeline.wingDeploymentMs,
        timeline.recoveryMs,
      ].filter((value): value is number => value !== null);
      if (requiredSampleTimes.some((timeMs) => !replicate.trajectory.some((point) => point.t === timeMs))) {
        throw new RangeError(`Simulation run ${replicate.id} omits an exact protocol or body-event sample.`);
      }
    }
  }
  const regeneratedBatch = simulateExperiment({
    id: batch.protocol.experimentId,
    hypothesisId: batch.protocol.hypothesisId,
    targetCircuitId: batch.protocol.targetCircuitId,
    behavior: batch.protocol.behavior,
    motorMap: batch.motorMap,
    perturbation: batch.protocol.perturbation,
    primaryLaterality: batch.protocol.primaryLaterality,
    activationLevel: batch.protocol.activationLevel,
    onsetMs: batch.protocol.onsetMs,
    durationMs: batch.protocol.durationMs,
    trialDurationMs: batch.protocol.trialDurationMs,
    replicates: batch.protocol.replicates,
    seed: batch.protocol.seed,
    seedPolicy: batch.protocol.seedPolicy,
    metricMethodVersion: batch.protocol.metricMethodVersion,
    conditions: batch.protocol.conditions,
    approved: true,
    model: MODEL_MANIFEST,
    assumptions: batch.protocol.assumptions,
    provenance: ['agent_hypothesized'],
  });
  if (JSON.stringify(batch) !== JSON.stringify(regeneratedBatch)) {
    throw new RangeError(
      `Simulation batch ${batch.id} does not exactly reproduce from its protocol, seed policy, and versioned generator.`,
    );
  }
}

export function computeSimulationRunContentHash(
  protocol: ExperimentProtocolSnapshot,
  model: typeof MODEL_MANIFEST,
  conditionRuns: ConditionRun[],
): `sha256:${string}` {
  return `sha256:${deterministicSha256Hex({ protocol, model, conditionRuns })}`;
}

export function simulateExperiment(experiment: Experiment): SimulationBatch {
  const conditionRuns = experiment.conditions.map((condition): ConditionRun => {
    const driveDerivation = deriveConditionMotorDrive(condition, experiment);
    const motorDrive = driveDerivation.effectiveMotorDrive;
    const takeoffMode = experiment.motorMap.responseMode === 'takeoff';
    const replicates = Array.from({ length: experiment.replicates }, (_, replicateIndex): ReplicateResult => {
      const seed = replicateSeedFromPolicy(experiment.seedPolicy, experiment.seed, replicateIndex);
      const draws = pairedReplicateDraws(seed);
      const responseThresholdProbability = takeoffMode
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
      const responseWindowMs = Math.max(0, experiment.trialDurationMs - experiment.onsetMs);
      const responseLatencyParameters = takeoffMode ? MODEL_PARAMETERS.escapeTakeoff.responseLatency : MODEL_PARAMETERS.responseLatency;
      const responseThresholdCrossed = draws.responseUniform < responseThresholdProbability;
      const candidateResponseLatencyMs = responseThresholdCrossed
        ? Math.max(
            responseLatencyParameters.minimumClampMs,
            responseLatencyParameters.interceptMs
              + (1 - motorDrive) * responseLatencyParameters.inverseDriveGainMs
              + draws.latencyNoise * responseLatencyParameters.jitterScaleMs,
          )
        : null;
      const requiredPostMovementMs = takeoffMode
        ? MODEL_PARAMETERS.escapeTakeoff.eventTiming.groundReleaseDelayMs
          + MODEL_PARAMETERS.escapeTakeoff.eventTiming.wingDelayAfterGroundReleaseMs
        : 0;
      const responseInitiated = candidateResponseLatencyMs !== null
        && candidateResponseLatencyMs + requiredPostMovementMs < responseWindowMs;
      const responseDisposition: ReplicateResult['responseDisposition'] = !responseThresholdCrossed
        ? 'not_crossed'
        : responseInitiated
          ? 'expressed'
          : 'censored';
      const responseLatencyMs = responseInitiated ? candidateResponseLatencyMs : null;
      const reverseInitiated = !takeoffMode && responseInitiated;
      const shortModeEscapeInitiated = takeoffMode && responseInitiated;
      const targetSignedSpeedMmS = reverseInitiated
        ? -Math.max(
            Number.EPSILON,
            MODEL_PARAMETERS.signedSpeed.reverseInterceptMmS
            + motorDrive * MODEL_PARAMETERS.signedSpeed.reverseDriveGainMmS
            + draws.speedNoise * MODEL_PARAMETERS.signedSpeed.jitterScaleMmS,
          )
        : responseInitiated
          ? Math.max(
              0,
              MODEL_PARAMETERS.signedSpeed.forwardBaselineMmS
                + (takeoffMode ? motorDrive * MODEL_PARAMETERS.escapeTakeoff.forwardSpeedGainModelMmS : -motorDrive * MODEL_PARAMETERS.signedSpeed.forwardDrivePenaltyMmS)
                + draws.speedNoise * MODEL_PARAMETERS.signedSpeed.forwardJitterScaleMmS,
            )
          : 0;
      const backwardDistanceScale = MODEL_PARAMETERS.backwardDistanceScale.minimum
        + draws.backwardDistanceUniform * (
          MODEL_PARAMETERS.backwardDistanceScale.maximum - MODEL_PARAMETERS.backwardDistanceScale.minimum
        );
      const targetVerticalDisplacementMm = shortModeEscapeInitiated
        ? Math.max(0, MODEL_PARAMETERS.escapeTakeoff.verticalDisplacement.interceptModelMm
          + motorDrive * MODEL_PARAMETERS.escapeTakeoff.verticalDisplacement.driveGainModelMm
          + draws.verticalNoise * MODEL_PARAMETERS.escapeTakeoff.verticalDisplacement.jitterScaleModelMm)
        : 0;
      const targetWingRecruitment = takeoffMode
        ? clamp(MODEL_PARAMETERS.escapeTakeoff.wingRecruitment.baseline
          + motorDrive * MODEL_PARAMETERS.escapeTakeoff.wingRecruitment.driveGain
          + draws.wingNoise * MODEL_PARAMETERS.escapeTakeoff.wingRecruitment.jitterScale, 0, 1)
        : 0;
      const targetLegRecruitment = clamp(
        (takeoffMode ? MODEL_PARAMETERS.escapeTakeoff.legRecruitment.baseline : MODEL_PARAMETERS.reverseWalk.legRecruitment.baseline)
          + motorDrive * (takeoffMode ? MODEL_PARAMETERS.escapeTakeoff.legRecruitment.driveGain : MODEL_PARAMETERS.reverseWalk.legRecruitment.driveGain)
          + draws.legNoise * (takeoffMode ? MODEL_PARAMETERS.escapeTakeoff.legRecruitment.jitterScale : MODEL_PARAMETERS.reverseWalk.legRecruitment.jitterScale),
        0,
        1,
      );
      const lateralSign = condition.laterality === 'left' ? -1 : condition.laterality === 'right' ? 1 : 0;
      const lateralModeSign = experiment.perturbation === 'silence' ? -1 : 1;
      const lateralEffect = experiment.perturbation === 'silence'
        ? MODEL_PARAMETERS.silencingReferenceMotorDrive - motorDrive
        : motorDrive;
      const lateralEffectFraction = clamp(
        Math.abs(lateralEffect) / MODEL_PARAMETERS.silencingReferenceMotorDrive,
        0,
        1,
      );
      const bilateralHeadingNoise = draws.headingNoise * MODEL_PARAMETERS.heading.bilateralJitterScaleDeg;
      const unilateralHeading = lateralSign * (
        lateralModeSign * (
          MODEL_PARAMETERS.heading.baseDeg + lateralEffect * MODEL_PARAMETERS.heading.driveGainDeg
        )
        + draws.headingNoise * MODEL_PARAMETERS.heading.unilateralJitterScaleDeg
      );
      const targetHeadingChangeDeg = lateralSign === 0
        ? bilateralHeadingNoise
        : (1 - lateralEffectFraction) * bilateralHeadingNoise
          + lateralEffectFraction * unilateralHeading;
      const targetBodyRollChangeDeg = lateralSign === 0 || lateralEffectFraction === 0
        ? 0
        : lateralEffectFraction * unilateralHeading
          * MODEL_PARAMETERS.stateTrajectory.takeoffPose.unilateralBodyRollPerHeading;
      const baselineStanceStability = clamp(
        MODEL_PARAMETERS.stanceStability.baseline
          + draws.stanceNoise * MODEL_PARAMETERS.stanceStability.jitterScale,
        MODEL_PARAMETERS.stanceStability.minimum,
        MODEL_PARAMETERS.stanceStability.maximum,
      );
      const targetStanceStability = clamp(
        MODEL_PARAMETERS.stanceStability.baseline
          - motorDrive * MODEL_PARAMETERS.stanceStability.drivePenalty
          + draws.stanceNoise * MODEL_PARAMETERS.stanceStability.jitterScale,
        MODEL_PARAMETERS.stanceStability.minimum,
        MODEL_PARAMETERS.stanceStability.maximum,
      );
      const id = `run_${deterministicSha256Hex({ experiment: experiment.id, condition: condition.id, replicateIndex, seed })}`;
      const trajectorySeed = runTrajectorySeedFromPolicy(experiment.seedPolicy, seed);
      const eventTimeline = buildEmbodiedEventTimeline(
        experiment,
        motorDrive,
        responseDisposition,
        responseLatencyMs,
        candidateResponseLatencyMs,
        draws.recoveryNoise,
      );
      const trajectoryId = `trajectory_${deterministicSha256Hex({
        run: id,
        seed: trajectorySeed,
        method: 'flylab.per-run-state-trajectory.v2',
      })}`;
      const trajectory = simulateRunTrajectory(
        condition,
        experiment,
        motorDrive,
        trajectorySeed,
        {
          eventTimeline,
          targetSignedSpeedMmS,
          backwardDistanceScale,
          targetHeadingChangeDeg,
          targetBodyRollChangeDeg,
          targetVerticalDisplacementMm,
          targetWingRecruitment,
          targetLegRecruitment,
          baselineStanceStability,
          targetStanceStability,
        },
      );
      const summary = summarizeRunTrajectory(trajectory, eventTimeline, takeoffMode);
      return {
        id,
        status: 'complete',
        conditionId: condition.id,
        seed,
        effectiveMotorDrive: motorDrive,
        driveDerivation,
        premotorDriveIndex: motorDrive,
        responseThresholdProbability,
        responseThresholdCrossed,
        responseDisposition,
        candidateResponseLatencyMs,
        reverseInitiated,
        responseInitiated,
        shortModeEscapeInitiated,
        backwardDistanceMm: summary.backwardDistanceMm,
        backwardDistanceScale,
        signedSpeedMmS: summary.signedSpeedMmS,
        responseLatencyMs,
        headingChangeDeg: summary.headingChangeDeg,
        stanceStability: summary.stanceStability,
        verticalDisplacementMm: summary.verticalDisplacementMm,
        wingRecruitment: summary.wingRecruitment,
        legRecruitment: summary.legRecruitment,
        takeoffSuccess: summary.takeoffSuccess,
        eventTimeline,
        trajectoryId,
        trajectorySeed,
        trajectoryRole: 'per_run_simulated_trajectory',
        trajectory,
        provenance: ['simulation_predicted'],
      };
    });

    const trajectorySeed = illustrativeTrajectorySeedFromPolicy(experiment.seedPolicy, experiment.seed);
    const trajectoryId = `trajectory_${deterministicSha256Hex({
      experiment: experiment.id,
      condition: condition.id,
      seed: trajectorySeed,
      method: 'flylab.illustrative-condition-replay.v1',
    })}`;
    return {
      conditionId: condition.id,
      label: condition.label,
      laterality: condition.laterality,
      status: 'complete',
      effectiveMotorDrive: motorDrive,
      driveDerivation,
      runIds: replicates.map((replicate) => replicate.id),
      replicates,
      trajectoryId,
      trajectorySeed,
      trajectoryStatus: 'complete',
      trajectoryRole: 'illustrative_condition_replay',
      trajectoryBoundary: 'Condition-level controller replay for display only. It is not any replicate trajectory and must not be used to calculate run or condition metrics.',
      trajectory: simulateIllustrativeTrajectory(condition, experiment, motorDrive, trajectorySeed),
    };
  });

  const identity = conditionRuns.flatMap((condition) => condition.replicates.map((replicate) => ({
    runId: replicate.id,
    trajectoryId: replicate.trajectoryId,
  })));
  return {
    id: `batch_${deterministicSha256Hex({ experiment: experiment.id, identity })}`,
    experimentId: experiment.id,
    targetCircuitId: experiment.targetCircuitId,
    behavior: experiment.behavior,
    motorMap: experiment.motorMap,
    status: 'complete',
    conditionRuns,
    runHash: `fnv1a:${stableHash(identity)}`,
    runHashScope: 'run_and_trajectory_ids_only',
    runHashSerialization: 'FNV-1a(JSON.stringify([{ runId, trajectoryId }]))',
    runContentHash: computeSimulationRunContentHash(
      snapshotExperimentProtocol(experiment),
      MODEL_MANIFEST,
      conditionRuns,
    ),
    runContentHashScope: 'protocol_model_and_complete_condition_runs',
    runContentHashSerialization: 'SHA-256(JSON.stringify({ protocol, model, conditionRuns }))',
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
  const recomputedRunContentHash = computeSimulationRunContentHash(
    batch.protocol,
    batch.model,
    batch.conditionRuns,
  );
  if (recomputedRunContentHash !== batch.runContentHash) {
    throw new RangeError(`Simulation batch ${batch.id} content does not match its recorded SHA-256 digest.`);
  }
  validateSimulationBatch(batch);
  if (analysisStartMs !== 0 || analysisEndMs !== batch.protocol.trialDurationMs) {
    throw new RangeError(
      `${batch.protocol.metricMethodVersion} supports only the full-trial analysis window [0, ${batch.protocol.trialDurationMs}] ms.`,
    );
  }
  const canonicalMetrics = ANALYSIS_METRICS.filter((metric) => metrics.includes(metric));
  const metricDefinitions = canonicalMetrics.reduce<Partial<Record<MetricName, MetricDefinition>>>((definitions, metric) => {
    definitions[metric] = METRIC_DEFINITIONS[metric];
    return definitions;
  }, {});
  const conditions = batch.conditionRuns.map((run): ConditionAnalysis => {
    const traceDerived = run.replicates.map((replicate) => ({
      replicate,
      summary: summarizeRunTrajectory(
        replicate.trajectory,
        replicate.eventTimeline,
        batch.motorMap.responseMode === 'takeoff',
      ),
    }));
    const responsive = traceDerived.filter(
      (item): item is typeof item & { replicate: ReplicateResult & { responseLatencyMs: number } } => (
        item.replicate.responseInitiated && item.replicate.responseLatencyMs !== null
      ),
    );
    const signedSpeedContributors = batch.motorMap.responseMode === 'takeoff'
      ? traceDerived
      : traceDerived.filter((item) => item.summary.backwardDistanceMm > 0);
    return {
      conditionId: run.conditionId,
      label: run.label,
      n: run.replicates.length,
      reverseInitiationProbability: mean(run.replicates.map((replicate) => replicate.reverseInitiated ? 1 : 0)),
      thresholdCrossingProbability: mean(run.replicates.map((replicate) => replicate.responseThresholdCrossed ? 1 : 0)),
      thresholdCrossedN: run.replicates.filter((replicate) => replicate.responseThresholdCrossed).length,
      censoredN: run.replicates.filter((replicate) => replicate.responseDisposition === 'censored').length,
      responseInitiationProbability: mean(run.replicates.map((replicate) => replicate.responseInitiated ? 1 : 0)),
      shortModeEscapeProbability: mean(traceDerived.map((item) => item.summary.takeoffSuccess ? 1 : 0)),
      backwardDistanceMm: mean(traceDerived.map((item) => item.summary.backwardDistanceMm)),
      signedSpeedMmS: signedSpeedContributors.length
        ? mean(signedSpeedContributors.map((item) => item.summary.signedSpeedMmS))
        : 0,
      responseLatencyMs: responsive.length
        ? mean(responsive.map((item) => item.replicate.responseLatencyMs))
        : null,
      responsiveN: responsive.length,
      headingChangeDeg: Math.abs(mean(traceDerived.map((item) => item.summary.headingChangeDeg))),
      stanceStability: mean(traceDerived.map((item) => item.summary.stanceStability)),
      verticalDisplacementMm: mean(traceDerived.map((item) => item.summary.verticalDisplacementMm)),
      wingRecruitment: mean(traceDerived.map((item) => item.summary.wingRecruitment)),
      legRecruitment: mean(traceDerived.map((item) => item.summary.legRecruitment)),
    };
  });
  return {
    id: `analysis_${deterministicSha256Hex({ batch: batch.id, batchRunContentHash: batch.runContentHash, metrics: canonicalMetrics, analysisStartMs, analysisEndMs })}`,
    batchId: batch.id,
    batchRunContentHash: batch.runContentHash,
    metrics: canonicalMetrics,
    metricDefinitions,
    responseInitiationSummaryDefinition: RESPONSE_INITIATION_SUMMARY_DEFINITION,
    responseObservationSummaryDefinition: RESPONSE_OBSERVATION_SUMMARY_DEFINITION,
    conditions,
    windowMs: { start: analysisStartMs, end: analysisEndMs },
    methodVersion: batch.protocol.metricMethodVersion,
    provenance: ['derived', 'simulation_predicted'],
    warning: 'These full-trial estimates summarize common-random-number-paired simulator variation. Threshold crossing and censoring are separately exposed from expressed response initiation. Response latency is a simulated delay from nominal onset and is null when no threshold is crossed, a candidate is right-censored, or no seeded run expresses the response. Values are not biological confidence intervals or new experimental evidence.',
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
    id: `comparison_${deterministicSha256Hex({ analyses: analyses.map((analysis) => analysis.id), objectiveMetric, objective, targetValue, budget })}`,
    analysisIds: analyses.map((analysis) => analysis.id),
    objectiveMetric,
    objective,
    ...(objective === 'target' ? { targetValue } : {}),
    rankedConditions: rows,
    proposal: {
      id: `proposal_${deterministicSha256Hex(proposalIdentity)}`,
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
