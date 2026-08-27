'use client';

import Link from 'next/link';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANALYSIS_METRICS,
  BANC_V888_CELLS,
  BANC_V888_EDGES,
  BANC_V888_MDN_LBL40_TOTAL_CONTACTS,
  CIRCUITS,
  DATASET_MANIFEST,
  DEFAULT_GOAL,
  EVIDENCE,
  EMBODIED_MOTOR_MAPS,
  HYPOTHESIS_CONTROL_IDS,
  METRIC_DEFINITIONS,
  METRIC_LABELS,
  MODEL_MANIFEST,
  RESPONSE_INITIATION_SUMMARY_DEFINITION,
  SOURCES,
  analyzeBatch,
  circuitSupportsBehavior,
  conditionMetricValue,
  compareAnalyses,
  deterministicSha256Hex,
  designExperiment,
  embodimentCoverageForCircuits,
  evidenceBundleTitle,
  makeHypothesis,
  metricsForCircuit,
  motorMapForCircuit,
  rankCircuitsForSearch,
  reviseExperiment,
  round,
  sha256,
  sharedAvailableObjectiveMetrics,
  simulateExperiment,
  stableHash,
  takeRankedMatchesWithTies,
  type Analysis,
  type Comparison,
  type Experiment,
  type Hypothesis,
  type MetricName,
  type ProvenanceLabel,
  type SimulationBatch,
} from '@/lib/flylab';
import { buildDiscoveryDecision, type DiscoveryDecision } from '@/lib/discovery-decision';
import {
  createExperimentApproval,
  verifyExperimentApproval,
  type ExperimentApproval,
} from '@/lib/experiment-approval';
import {
  FlyLabDomainError,
  canonicalOperationInput,
  detectFlyLabWebMCPRuntime,
  diagnosticFromWebMCPError,
  installFlyLabWebMCP,
  prepareCancellableCommit,
  requireCurrentStateRevision,
  verifyAtCurrentStateRevision,
  validateToolInput,
  type FlyLabActionActor,
  type FlyLabProvenanceManifestEntry,
  type ToolActionResult,
  type FlyLabToolAction,
} from '@/lib/webmcp';
import {
  EVIDENCE_EXPORT_MEDIA_TYPE,
  createEvidenceExportEnvelope,
  evidenceExportFilename,
  serializeEvidenceExport,
  type EvidenceBundleMetadata,
  type EvidenceExportEnvelope,
} from '@/lib/evidence-export';
import { buildFlyLabAgentContext, type FlyLabAgentSnapshot } from '@/lib/agent-context';
import {
  CHECKING_WEBMCP_CAPABILITY_DIAGNOSTIC,
  buildFlyLabAgentHandoff,
  type FlyLabWebMCPCapabilityDiagnostic,
  type FlyLabWebMCPStatus,
} from '@/lib/agent-handoff';

type Stage = 'discover' | 'hypothesize' | 'design' | 'run' | 'analyze' | 'continue' | 'saved';

const FlyBrain3D = lazy(() => import('@/components/FlyBrain3D').then((module) => ({ default: module.FlyBrain3D })));
const FlyArena3D = lazy(() => import('@/components/FlyArena3D').then((module) => ({ default: module.FlyArena3D })));

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  status: 'complete' | 'running' | 'waiting' | 'cancelled' | 'failed';
  actor?: FlyLabActionActor | 'system';
  toolName?: string;
  revision?: number;
  timestamp?: string;
  createdArtifactIds?: string[];
}

interface LabState {
  revision: number;
  stage: Stage;
  goal: string;
  discoveryDecision: DiscoveryDecision | null;
  selectedCircuitId: string | null;
  discoveredEvidenceIds: string[];
  filteredEvidenceIds: string[];
  nextTrialBudget: number;
  hypothesis: Hypothesis | null;
  experiment: Experiment | null;
  approval: ExperimentApproval | null;
  batch: SimulationBatch | null;
  analyses: Analysis[];
  comparison: Comparison | null;
  bundle: EvidenceBundleMetadata | null;
  evidenceExport: EvidenceExportEnvelope | null;
  activity: ActivityItem[];
}

interface CompletedOperation {
  canonicalInput: string;
  result: ToolActionResult;
}

const initialState: LabState = {
  revision: 1,
  stage: 'discover',
  goal: DEFAULT_GOAL,
  discoveryDecision: null,
  selectedCircuitId: null,
  discoveredEvidenceIds: [],
  filteredEvidenceIds: [],
  nextTrialBudget: 2,
  hypothesis: null,
  experiment: null,
  approval: null,
  batch: null,
  analyses: [],
  comparison: null,
  bundle: null,
  evidenceExport: null,
  activity: [
    {
      id: 'activity_ready',
      title: 'Laboratory ready',
      detail: 'Waiting for a behavior goal or a WebMCP tool call.',
      status: 'waiting',
      actor: 'system',
      revision: 1,
    },
  ],
};

const provenanceMeta: Record<ProvenanceLabel, { label: string; short: string }> = {
  measured: { label: 'Measured', short: 'M' },
  derived: { label: 'Derived', short: 'D' },
  connectome_inferred: { label: 'Connectome inferred', short: 'C' },
  simulation_predicted: { label: 'Simulation predicted', short: 'S' },
  agent_hypothesized: { label: 'Agent hypothesis', short: 'A' },
};

const DATASET_MANIFEST_SOURCE_IDS = [
  'SRC-BANC-DATAVERSE-V3',
  'SRC-MANC-V121',
  'SRC-CANDE-ELIFE-2018',
  'SRC-CANDE-DRYAD-V1',
  'SRC-AZEVEDO-NATURE-2024',
  'SRC-FLYGYM-NM-2024',
  'SRC-FLYGYM-CODE-V210',
  'SRC-JURGENS-GENETICS-2024',
  'SRC-CHUN-ELIFE-2021',
];
const DATASET_MANIFEST_ARTIFACT_ID = 'flylab_dataset_manifest_v24';

function Badge({ kind, compact = false }: { kind: ProvenanceLabel; compact?: boolean }) {
  const meta = provenanceMeta[kind];
  return <span className={`provenance-badge ${kind}`}><i>{meta.short}</i>{compact ? meta.short : meta.label}</span>;
}

function waitFor(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Cancelled', 'AbortError'));
    }, { once: true });
  });
}

function numberInput(input: Record<string, unknown>, key: string, fallback: number) {
  return typeof input[key] === 'number' ? input[key] as number : fallback;
}

function stringInput(input: Record<string, unknown>, key: string, fallback = '') {
  return typeof input[key] === 'string' ? input[key] as string : fallback;
}

function stringArrayInput(input: Record<string, unknown>, key: string) {
  return Array.isArray(input[key]) ? (input[key] as unknown[]).filter((value): value is string => typeof value === 'string') : [];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function requireMutationContext(
  input: Record<string, unknown>,
  current: LabState,
  pageSessionId: string | null,
) {
  const requestedSessionId = stringInput(input, 'page_session_id');
  if (!pageSessionId || requestedSessionId !== pageSessionId) {
    throw new FlyLabDomainError(
      'STALE_STATE',
      'This mutation targets a different or uninitialized FlyLab page session. Inspect this open page before retrying.',
      false,
      {
        expected_page_session_id: pageSessionId,
        received_page_session_id: requestedSessionId || null,
        actual_state_revision: current.revision,
        recovery_tool: 'inspect_flylab_state',
      },
    );
  }
  requireCurrentStateRevision(numberInput(input, 'expected_state_revision', -1), current.revision, {
    page_session_id: pageSessionId,
  });
}

function evidenceRecordsForIds(ids: string[]) {
  return ids
    .map((id) => EVIDENCE.find((record) => record.id === id))
    .filter((record): record is (typeof EVIDENCE)[number] => Boolean(record));
}

function sourceIdsForEvidence(ids: string[]) {
  return uniqueStrings(evidenceRecordsForIds(ids).flatMap((record) => record.sourceIds));
}

function buildArtifactManifest(current: LabState) {
  const circuit = CIRCUITS.find((record) => record.id === current.selectedCircuitId) ?? null;
  const discoveredEvidence = evidenceRecordsForIds(current.discoveredEvidenceIds);
  const hypothesisSourceIds = current.hypothesis ? sourceIdsForEvidence(current.hypothesis.evidenceIds) : [];
  const modelSourceIds = ['SRC-FLYLAB-MODEL-CARD', 'SRC-FLYGYM-NM-2024', 'SRC-FLYGYM-CODE-V210'];
  return {
    discovery_decision: current.discoveryDecision ? {
      id: current.discoveryDecision.id,
      artifact_type: 'discovery_decision',
      provenance: current.discoveryDecision.provenance,
      parent_ids: current.discoveryDecision.candidates.map((candidate) => candidate.circuitId),
      evidence_ids: uniqueStrings(current.discoveryDecision.candidates.flatMap((candidate) => candidate.catalogEvidenceIds)),
      source_ids: sourceIdsForEvidence(current.discoveryDecision.candidates.flatMap((candidate) => candidate.catalogEvidenceIds)),
      mission_goal: current.discoveryDecision.missionGoal,
      selection_status: current.discoveryDecision.selectionStatus,
      selected_circuit_id: current.discoveryDecision.selectedCircuitId,
      recommendation: current.discoveryDecision.recommendation,
      rejected_alternatives: current.discoveryDecision.rejectedAlternatives,
      excluded_evidence: current.discoveryDecision.excludedEvidence,
      coverage_warning: current.discoveryDecision.coverageWarning,
    } : null,
    selected_circuit: circuit ? {
      id: circuit.id,
      artifact_type: 'circuit',
      provenance: circuit.provenance,
      parent_ids: [],
      evidence_ids: circuit.evidenceIds,
      source_ids: sourceIdsForEvidence(circuit.evidenceIds),
      stage: circuit.stage,
      sex_boundary: circuit.sexBoundary,
      laterality: circuit.laterality,
      specimen_inventory: circuit.specimenInventory,
      summary: circuit.summary,
    } : null,
    discovered_evidence: discoveredEvidence.map((record) => ({
      id: record.id,
      artifact_type: 'evidence_record',
      provenance: [record.provenance],
      parent_ids: circuit ? [circuit.id] : [],
      evidence_ids: [],
      source_ids: record.sourceIds,
      role: record.role,
      support_kind: record.support.kind,
      claim: record.claim,
      caution: record.caution,
    })),
    hypothesis: current.hypothesis ? {
      id: current.hypothesis.id,
      artifact_type: 'hypothesis',
      provenance: [current.hypothesis.provenance],
      parent_ids: [current.hypothesis.circuitId, ...current.hypothesis.evidenceIds],
      evidence_ids: current.hypothesis.evidenceIds,
      causal_evidence_ids: current.hypothesis.causalEvidenceIds,
      source_ids: hypothesisSourceIds,
      claim: current.hypothesis.claim,
      predicted_behavior: current.hypothesis.predictedBehavior,
      perturbation: current.hypothesis.perturbation,
      primary_outcome: current.hypothesis.primaryOutcome,
      expected_direction: current.hypothesis.expectedDirection,
      controls: current.hypothesis.controls,
      evidence_limitations: current.hypothesis.evidenceLimitations,
      falsification_criterion: current.hypothesis.falsificationCriterion,
    } : null,
    experiment: current.experiment ? {
      id: current.experiment.id,
      artifact_type: 'experiment',
      provenance: current.experiment.provenance,
      parent_ids: [current.experiment.hypothesisId, current.experiment.targetCircuitId],
      evidence_ids: current.hypothesis?.evidenceIds ?? [],
      source_ids: uniqueStrings([...hypothesisSourceIds, ...modelSourceIds]),
      approved: current.experiment.approved,
      target_circuit_id: current.experiment.targetCircuitId,
      behavior: current.experiment.behavior,
      motor_map: {
        id: current.experiment.motorMap.id,
        motor_program: current.experiment.motorMap.motorProgram,
        target_body_parts: current.experiment.motorMap.targetBodyParts,
        recommended_metrics: current.experiment.motorMap.recommendedMetrics,
        boundary: current.experiment.motorMap.simulationBoundary,
      },
      perturbation: current.experiment.perturbation,
      primary_laterality: current.experiment.primaryLaterality,
      protocol: {
        activation_level: current.experiment.activationLevel,
        onset_ms: current.experiment.onsetMs,
        duration_ms: current.experiment.durationMs,
        trial_duration_ms: current.experiment.trialDurationMs,
        replicates: current.experiment.replicates,
        seed: current.experiment.seed,
        seed_policy: current.experiment.seedPolicy,
        metric_method_version: current.experiment.metricMethodVersion,
      },
      condition_ids: current.experiment.conditions.map((condition) => condition.id),
      model: {
        name: current.experiment.model.name,
        version: current.experiment.model.version,
        controller: current.experiment.model.controller,
        environment: current.experiment.model.environment,
        provenance: ['derived'],
        controller_mapping_provenance: ['agent_hypothesized'],
        boundary: current.experiment.model.boundary,
      },
    } : null,
    approval: current.approval ? {
      id: current.approval.protocol_hash,
      artifact_type: 'experiment_approval',
      provenance: ['agent_hypothesized'] as ProvenanceLabel[],
      parent_ids: [current.approval.experiment_id],
      evidence_ids: current.hypothesis?.evidenceIds ?? [],
      source_ids: hypothesisSourceIds,
      ...current.approval,
      boundary: 'Visible human authorization for this exact virtual protocol and seed manifest; not scientific evidence or wet-lab approval.',
    } : null,
    batch: current.batch ? {
      id: current.batch.id,
      artifact_type: 'simulation_batch',
      provenance: current.batch.provenance,
      parent_ids: [current.batch.experimentId],
      evidence_ids: current.hypothesis?.evidenceIds ?? [],
      source_ids: uniqueStrings([...hypothesisSourceIds, ...modelSourceIds]),
      experiment_id: current.batch.experimentId,
      target_circuit_id: current.batch.targetCircuitId,
      behavior: current.batch.behavior,
      motor_map_id: current.batch.motorMap.id,
      run_hash: current.batch.runHash,
      protocol: current.batch.protocol,
      protocol_provenance: ['agent_hypothesized'],
      condition_ids: current.batch.conditionRuns.map((run) => run.conditionId),
      run_ids: current.batch.conditionRuns.flatMap((run) => run.runIds),
      per_run_trajectory_ids: current.batch.conditionRuns.flatMap((run) => run.replicates.map((replicate) => replicate.trajectoryId)),
      illustrative_trajectory_ids: current.batch.conditionRuns.map((run) => run.trajectoryId),
      model: {
        name: current.batch.model.name,
        version: current.batch.model.version,
        controller: current.batch.model.controller,
        environment: current.batch.model.environment,
        provenance: ['derived'],
        controller_mapping_provenance: ['agent_hypothesized'],
        boundary: current.batch.model.boundary,
      },
    } : null,
    analyses: current.analyses.map((analysis) => ({
      id: analysis.id,
      artifact_type: 'behavior_analysis',
      provenance: analysis.provenance,
      parent_ids: [analysis.batchId],
      evidence_ids: current.hypothesis?.evidenceIds ?? [],
      source_ids: uniqueStrings([...hypothesisSourceIds, ...modelSourceIds]),
      batch_id: analysis.batchId,
      method_version: analysis.methodVersion,
      window_ms: analysis.windowMs,
      metrics: analysis.metrics,
      metric_definitions: analysis.metricDefinitions,
      response_initiation_summary_definition: analysis.responseInitiationSummaryDefinition,
      condition_ids: analysis.conditions.map((condition) => condition.conditionId),
    })),
    comparison: current.comparison ? {
      id: current.comparison.id,
      artifact_type: 'trial_comparison',
      provenance: current.comparison.provenance,
      parent_ids: current.comparison.analysisIds,
      evidence_ids: current.hypothesis?.evidenceIds ?? [],
      source_ids: uniqueStrings([...hypothesisSourceIds, ...modelSourceIds]),
      analysis_ids: current.comparison.analysisIds,
      objective_metric: current.comparison.objectiveMetric,
      objective: current.comparison.objective,
      ranked_condition_ids: current.comparison.rankedConditions.map((condition) => condition.conditionId),
      proposal: {
        id: current.comparison.proposal.id,
        artifact_type: 'follow_up_proposal',
        provenance: [current.comparison.proposal.provenance],
        parent_ids: [current.comparison.id],
        evidence_ids: current.hypothesis?.evidenceIds ?? [],
        source_ids: hypothesisSourceIds,
        rationale: current.comparison.proposal.rationale,
        activation_levels: current.comparison.proposal.activationLevels,
        replicate_budget: current.comparison.proposal.replicateBudget,
        execution_authorized: false,
      },
    } : null,
    evidence_bundle: current.bundle ? {
      id: current.bundle.id,
      artifact_type: 'evidence_bundle',
      scope: current.bundle.scope,
      provenance: current.bundle.provenance,
      parent_ids: current.bundle.includedIds,
      evidence_ids: uniqueStrings([
        ...current.bundle.supportingEvidenceIds,
        ...current.bundle.contextEvidenceIds,
        ...current.bundle.methodEvidenceIds,
      ]),
      source_ids: uniqueStrings([
        ...current.bundle.supportingSourceIds,
        ...current.bundle.contextSourceIds,
        ...current.bundle.methodSourceIds,
        ...current.bundle.catalogSourceIds,
      ]),
      manifest_hash: current.bundle.manifestHash,
      saved_at: current.bundle.savedAt,
      provenance_index: current.bundle.provenanceIndex,
      lineage_edges: current.bundle.lineageEdges,
    } : null,
  };
}

function provenanceEntry(
  path: string,
  artifactId: string | null,
  artifactType: string,
  scope: FlyLabProvenanceManifestEntry['scope'],
  labels: ProvenanceLabel[],
  parentIds: string[],
  evidenceIds: string[],
  sourceIds: string[],
  boundary: string,
): FlyLabProvenanceManifestEntry {
  return {
    path,
    artifact_id: artifactId,
    artifact_type: artifactType,
    scope,
    labels,
    parent_ids: uniqueStrings(parentIds),
    evidence_ids: uniqueStrings(evidenceIds),
    source_ids: uniqueStrings(sourceIds),
    boundary,
  };
}

function motorMapEvidenceIds(map: Experiment['motorMap']) {
  return uniqueStrings([...map.nodes, ...map.edges].flatMap((item) => item.evidenceIds));
}

function motorMapProvenanceEntries(
  map: Experiment['motorMap'],
  prefix: string,
  parentIds: string[],
) {
  return [
    provenanceEntry(
      prefix,
      map.id,
      'embodied_motor_map',
      'artifact',
      ['derived'],
      parentIds,
      motorMapEvidenceIds(map),
      sourceIdsForEvidence(motorMapEvidenceIds(map)),
      `${map.evidenceBoundary} Node and edge records below override this container label with their exact scientific provenance.`,
    ),
    ...['controller', 'motorProgram', 'responseMode', 'supportedLaterality', 'targetBodyParts', 'recommendedMetrics', 'simulationBoundary'].map((field) => provenanceEntry(
      `${prefix}/${field}`,
      null,
      'controller_mapping_field',
      'record',
      ['agent_hypothesized'],
      [map.id],
      ['E-FLYLAB-MODEL-004'],
      ['SRC-FLYLAB-MODEL-CARD'],
      map.simulationBoundary,
    )),
    ...map.nodes.map((node, index) => provenanceEntry(
      `${prefix}/nodes/${index}`,
      node.id,
      'motor_path_node',
      'record',
      [node.provenance],
      [map.id],
      node.evidenceIds,
      node.sourceIds ?? sourceIdsForEvidence(node.evidenceIds),
      node.provenance === 'agent_hypothesized' ? map.simulationBoundary : map.evidenceBoundary,
    )),
    ...map.edges.map((edge, index) => provenanceEntry(
      `${prefix}/edges/${index}`,
      edge.id,
      'motor_path_edge',
      'record',
      [edge.provenance],
      [map.id, edge.from, edge.to],
      edge.evidenceIds,
      edge.sourceIds ?? sourceIdsForEvidence(edge.evidenceIds),
      edge.boundary,
    )),
  ];
}

function compactMotorMapProvenanceEntries(
  map: Experiment['motorMap'],
  prefix: string,
  parentIds: string[],
) {
  return [
    provenanceEntry(prefix, map.id, 'embodied_motor_map_summary', 'container', ['derived'], parentIds, motorMapEvidenceIds(map), sourceIdsForEvidence(motorMapEvidenceIds(map)), 'Compact motor-map identity plus controller-facing fields; inspect the discovery or experiment result for node- and edge-level records.'),
    ...['motor_program', 'target_body_parts', 'recommended_metrics', 'boundary'].map((field) => provenanceEntry(
      `${prefix}/${field}`,
      null,
      'controller_mapping_field',
      'record',
      ['agent_hypothesized'],
      [map.id],
      ['E-FLYLAB-MODEL-004'],
      ['SRC-FLYLAB-MODEL-CARD'],
      map.simulationBoundary,
    )),
  ];
}

function buildCurrentLineageProvenanceEntries(current: LabState, prefix: string) {
  const entries: FlyLabProvenanceManifestEntry[] = [];
  const circuit = CIRCUITS.find((record) => record.id === current.selectedCircuitId) ?? null;
  const discoveredEvidence = evidenceRecordsForIds(current.discoveredEvidenceIds);
  if (current.discoveryDecision) entries.push(provenanceEntry(
    `${prefix}/discovery_decision`,
    current.discoveryDecision.id,
    'discovery_decision',
    'artifact',
    current.discoveryDecision.provenance,
    current.discoveryDecision.candidates.map((candidate) => candidate.circuitId),
    uniqueStrings(current.discoveryDecision.candidates.flatMap((candidate) => candidate.catalogEvidenceIds)),
    sourceIdsForEvidence(current.discoveryDecision.candidates.flatMap((candidate) => candidate.catalogEvidenceIds)),
    current.discoveryDecision.coverageWarning,
  ));
  if (circuit) entries.push(provenanceEntry(`${prefix}/selected_circuit`, circuit.id, 'circuit', 'artifact', circuit.provenance, [], circuit.evidenceIds, sourceIdsForEvidence(circuit.evidenceIds), 'Derived catalog record; not a neural activity measurement.'));
  discoveredEvidence.forEach((record, index) => entries.push(provenanceEntry(`${prefix}/discovered_evidence/${index}`, record.id, 'evidence_record', 'record', [record.provenance], circuit ? [circuit.id] : [], [], record.sourceIds, record.caution)));
  if (current.hypothesis) entries.push(provenanceEntry(`${prefix}/hypothesis`, current.hypothesis.id, 'hypothesis', 'artifact', [current.hypothesis.provenance], [current.hypothesis.circuitId, ...current.hypothesis.evidenceIds], current.hypothesis.evidenceIds, sourceIdsForEvidence(current.hypothesis.evidenceIds), 'Agent-authored falsifiable proposal; not evidence.'));
  if (current.experiment) {
    entries.push(provenanceEntry(`${prefix}/experiment`, current.experiment.id, 'experiment', 'artifact', current.experiment.provenance, [current.experiment.hypothesisId, current.experiment.targetCircuitId], current.hypothesis?.evidenceIds ?? [], sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []), 'Human-reviewable virtual protocol; not a wet-lab protocol or biological dose.'));
    entries.push(...compactMotorMapProvenanceEntries(current.experiment.motorMap, `${prefix}/experiment/motor_map`, [current.experiment.targetCircuitId, current.experiment.id]));
    entries.push(provenanceEntry(`${prefix}/experiment/model`, null, 'model_manifest', 'container', ['derived'], [current.experiment.id], ['E-FLYLAB-MODEL-004'], ['SRC-FLYLAB-MODEL-CARD', 'SRC-FLYGYM-NM-2024', 'SRC-FLYGYM-CODE-V210'], MODEL_MANIFEST.boundary));
    entries.push(provenanceEntry(`${prefix}/experiment/model/controller_mapping_provenance`, null, 'controller_mapping', 'record', ['agent_hypothesized'], [current.experiment.id], ['E-FLYLAB-MODEL-004'], ['SRC-FLYLAB-MODEL-CARD'], MODEL_MANIFEST.controllerMapping.statement));
  }
  if (current.approval) entries.push(provenanceEntry(
    `${prefix}/approval`,
    current.approval.protocol_hash,
    'experiment_approval',
    'artifact',
    ['agent_hypothesized'],
    [current.approval.experiment_id],
    current.hypothesis?.evidenceIds ?? [],
    sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []),
    'Visible human authorization for the exact virtual protocol and seed manifest; not scientific evidence or wet-lab approval.',
  ));
  if (current.batch) {
    entries.push(provenanceEntry(`${prefix}/batch`, current.batch.id, 'simulation_batch', 'artifact', current.batch.provenance, [current.batch.experimentId], current.hypothesis?.evidenceIds ?? [], sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []), current.batch.model.boundary));
    entries.push(provenanceEntry(`${prefix}/batch/motor_map_id`, current.batch.motorMap.id, 'embodied_motor_map_reference', 'record', ['derived'], [current.batch.targetCircuitId, current.batch.id], motorMapEvidenceIds(current.batch.motorMap), sourceIdsForEvidence(motorMapEvidenceIds(current.batch.motorMap)), current.batch.motorMap.evidenceBoundary));
    entries.push(provenanceEntry(`${prefix}/batch/protocol`, null, 'approved_virtual_protocol_snapshot', 'container', ['agent_hypothesized'], [current.batch.experimentId, current.batch.id], current.hypothesis?.evidenceIds ?? [], sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []), 'Snapshot of a human-approved virtual protocol; not a wet-lab protocol or biological dose.'));
    entries.push(provenanceEntry(`${prefix}/batch/protocol_provenance`, null, 'protocol_provenance_label', 'record', ['agent_hypothesized'], [current.batch.experimentId, current.batch.id], [], [], 'Explicit provenance label for the compact protocol snapshot.'));
    entries.push(provenanceEntry(`${prefix}/batch/model`, null, 'model_manifest', 'container', ['derived'], [current.batch.id], ['E-FLYLAB-MODEL-004'], ['SRC-FLYLAB-MODEL-CARD', 'SRC-FLYGYM-NM-2024', 'SRC-FLYGYM-CODE-V210'], MODEL_MANIFEST.boundary));
    entries.push(provenanceEntry(`${prefix}/batch/model/controller_mapping_provenance`, null, 'controller_mapping', 'record', ['agent_hypothesized'], [current.batch.id], ['E-FLYLAB-MODEL-004'], ['SRC-FLYLAB-MODEL-CARD'], MODEL_MANIFEST.controllerMapping.statement));
  }
  current.analyses.forEach((analysis, index) => entries.push(provenanceEntry(`${prefix}/analyses/${index}`, analysis.id, 'behavior_analysis', 'artifact', analysis.provenance, [analysis.batchId], current.hypothesis?.evidenceIds ?? [], sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []), analysis.warning)));
  if (current.comparison) {
    entries.push(provenanceEntry(`${prefix}/comparison`, current.comparison.id, 'trial_comparison', 'artifact', current.comparison.provenance, current.comparison.analysisIds, current.hypothesis?.evidenceIds ?? [], sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []), 'Ranking of simulation-derived analyses; not biological evidence.'));
    entries.push(provenanceEntry(`${prefix}/comparison/proposal`, current.comparison.proposal.id, 'follow_up_proposal', 'artifact', [current.comparison.proposal.provenance], [current.comparison.id], current.hypothesis?.evidenceIds ?? [], sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []), 'Proposal only; execution is not authorized.'));
  }
  if (current.bundle) entries.push(provenanceEntry(`${prefix}/evidence_bundle`, current.bundle.id, 'evidence_bundle', 'artifact', current.bundle.provenance, current.bundle.includedIds, uniqueStrings([...current.bundle.supportingEvidenceIds, ...current.bundle.contextEvidenceIds, ...current.bundle.methodEvidenceIds]), uniqueStrings([...current.bundle.supportingSourceIds, ...current.bundle.contextSourceIds, ...current.bundle.methodSourceIds, ...current.bundle.catalogSourceIds]), current.bundle.boundary));
  return entries;
}

function batchFieldProvenanceEntries(
  batch: SimulationBatch,
  evidenceIds: string[],
  prefix = '',
  includeRoot = true,
) {
  const hypothesisSourceIds = sourceIdsForEvidence(evidenceIds);
  const modelSourceIds = ['SRC-FLYLAB-MODEL-CARD', 'SRC-FLYGYM-NM-2024', 'SRC-FLYGYM-CODE-V210'];
  const entries: FlyLabProvenanceManifestEntry[] = [];
  if (includeRoot) {
    entries.push(provenanceEntry(
      prefix,
      batch.id,
      'simulation_batch',
      'artifact',
      ['simulation_predicted'],
      [batch.experimentId],
      evidenceIds,
      uniqueStrings([...hypothesisSourceIds, ...modelSourceIds]),
      batch.model.boundary,
    ));
  }
  entries.push(
    ...motorMapProvenanceEntries(batch.motorMap, `${prefix}/motorMap`, [batch.targetCircuitId, batch.id]),
    provenanceEntry(
      `${prefix}/conditionRuns`,
      null,
      'simulation_run_collection',
      'container',
      ['simulation_predicted'],
      [batch.id],
      evidenceIds,
      uniqueStrings([...hypothesisSourceIds, ...modelSourceIds]),
      'Seeded reduced-order model outputs and illustrative replay trajectories; not observations from animals.',
    ),
    provenanceEntry(
      `${prefix}/protocol`,
      null,
      'approved_virtual_protocol_snapshot',
      'container',
      ['agent_hypothesized'],
      [batch.experimentId, batch.id],
      evidenceIds,
      hypothesisSourceIds,
      'Snapshot of a human-approved virtual protocol; not a wet-lab protocol or biological dose.',
    ),
    provenanceEntry(
      `${prefix}/model`,
      null,
      'model_manifest',
      'container',
      ['derived'],
      [batch.id],
      ['E-FLYLAB-MODEL-004'],
      modelSourceIds,
      MODEL_MANIFEST.boundary,
    ),
    provenanceEntry(
      `${prefix}/model/controllerMapping`,
      null,
      'controller_mapping',
      'container',
      ['agent_hypothesized'],
      [batch.id],
      ['E-FLYLAB-MODEL-004'],
      ['SRC-FLYLAB-MODEL-CARD'],
      MODEL_MANIFEST.controllerMapping.statement,
    ),
    provenanceEntry(
      `${prefix}/model/parameterization`,
      null,
      'hand_authored_model_parameterization',
      'container',
      ['agent_hypothesized'],
      [batch.id],
      ['E-FLYLAB-MODEL-004'],
      ['SRC-FLYLAB-MODEL-CARD'],
      'Hand-authored, uncalibrated constants and declared model-unit boundaries; not fitted biological measurements.',
    ),
    provenanceEntry(
      `${prefix}/boundary`,
      null,
      'interpretation_boundary',
      'record',
      ['derived'],
      [batch.id],
      ['E-FLYLAB-MODEL-004'],
      ['SRC-FLYLAB-MODEL-CARD'],
      'Method boundary copied from the versioned model manifest.',
    ),
  );
  return entries;
}

function agentSnapshot(current: LabState, simulationRunning: boolean, evidenceSaveRunning: boolean): FlyLabAgentSnapshot {
  return {
    revision: current.revision,
    stage: current.stage,
    goal: current.goal,
    simulationRunning,
    evidenceSaveRunning,
    discoveryDecisionId: current.discoveryDecision?.id ?? null,
    selectedCircuitId: current.selectedCircuitId,
    discoveredEvidenceIds: current.discoveredEvidenceIds,
    hypothesisEligibleEvidenceIds: current.filteredEvidenceIds.filter((id) => (
      EVIDENCE.find((record) => record.id === id)?.role === 'hypothesis_support'
    )),
    causalEvidenceIdsByPerturbation: {
      activate: current.filteredEvidenceIds.filter((id) => {
        const record = EVIDENCE.find((item) => item.id === id);
        return record?.role === 'hypothesis_support'
          && record.support.kind === 'perturbation_effect'
          && record.support.perturbations?.includes('activate');
      }),
      silence: current.filteredEvidenceIds.filter((id) => {
        const record = EVIDENCE.find((item) => item.id === id);
        return record?.role === 'hypothesis_support'
          && record.support.kind === 'perturbation_effect'
          && record.support.perturbations?.includes('silence');
      }),
    },
    hypothesisId: current.hypothesis?.id ?? null,
    hypothesisEvidenceIds: current.hypothesis?.evidenceIds ?? [],
    hypothesisPredictedBehavior: current.hypothesis?.predictedBehavior ?? null,
    hypothesisPerturbation: current.hypothesis?.perturbation ?? null,
    experimentId: current.experiment?.id ?? null,
    experimentApproved: Boolean(current.experiment?.approved),
    approvalExperimentId: current.approval?.experiment_id ?? null,
    approvedProtocolHash: current.approval?.protocol_hash ?? null,
    approvedSeedManifestHash: current.approval?.seed_manifest_hash ?? null,
    approvalTimestamp: current.approval?.approved_at ?? null,
    conditionIds: current.experiment?.conditions.map((condition) => condition.id) ?? [],
    batchId: current.batch?.id ?? null,
    analysisIds: current.analyses.map((analysis) => analysis.id),
    analysisMetricsById: Object.fromEntries(current.analyses.map((analysis) => [analysis.id, analysis.metrics])),
    comparisonId: current.comparison?.id ?? null,
    comparisonAnalysisIds: current.comparison?.analysisIds ?? [],
    bundleId: current.bundle?.id ?? null,
    nextTrialBudget: current.nextTrialBudget,
    artifactManifest: buildArtifactManifest(current),
  };
}

export default function Home() {
  const [lab, setLab] = useState<LabState>(initialState);
  const [goalDraft, setGoalDraft] = useState(initialState.goal);
  const labRef = useRef(lab);
  const [webmcpStatus, setWebmcpStatus] = useState<FlyLabWebMCPStatus>('checking');
  const [webmcpDiagnostic, setWebmcpDiagnostic] = useState<FlyLabWebMCPCapabilityDiagnostic>(CHECKING_WEBMCP_CAPABILITY_DIAGNOSTIC);
  const [webmcpDetectionAttempt, setWebmcpDetectionAttempt] = useState(0);
  const [webmcpInvocationObserved, setWebmcpInvocationObserved] = useState(false);
  const [pageSessionId, setPageSessionId] = useState<string | null>(null);
  const pageSessionIdRef = useRef<string | null>(null);
  const completedOperationsRef = useRef(new Map<string, CompletedOperation>());
  const [notice, setNotice] = useState(`Mission published at r${initialState.revision}. Agent should inspect fresh state.`);
  const [selectedConditionId, setSelectedConditionId] = useState('condition_bilateral');
  const [playhead, setPlayhead] = useState(0);
  const playheadRef = useRef(playhead);
  const [playing, setPlaying] = useState(false);
  const [arenaView, setArenaView] = useState<'body' | 'circuit' | 'trace'>('body');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceDialogRef = useRef<HTMLElement | null>(null);
  const runtimeDiagnosticRef = useRef<HTMLDetailsElement | null>(null);
  const evidenceReturnFocusRef = useRef<HTMLElement | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(EVIDENCE[0].id);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [evidenceSaveRunning, setEvidenceSaveRunning] = useState(false);
  const [approvalPreparing, setApprovalPreparing] = useState(false);
  const activeSimulationControllerRef = useRef<AbortController | null>(null);
  const activeEvidenceSaveControllerRef = useRef<AbortController | null>(null);
  const chromeCancellationRequestedRef = useRef(new WeakSet<AbortController>());
  const getAgentContext = useCallback((current: LabState) => buildFlyLabAgentContext(agentSnapshot(
    current,
    Boolean(activeSimulationControllerRef.current),
    Boolean(activeEvidenceSaveControllerRef.current),
  )), []);

  useEffect(() => {
    if (!evidenceOpen) return;
    evidenceReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusDialog = window.setTimeout(() => evidenceDialogRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setEvidenceOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !evidenceDialogRef.current) return;
      const focusable = [...evidenceDialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusDialog);
      document.removeEventListener('keydown', onKeyDown);
      window.setTimeout(() => evidenceReturnFocusRef.current?.focus(), 0);
    };
  }, [evidenceOpen]);

  const commit = useCallback((producer: (current: LabState) => LabState) => {
    const next = producer(labRef.current);
    labRef.current = next;
    setLab(next);
    return next;
  }, []);

  const pushActivity = useCallback((current: LabState, item: Omit<ActivityItem, 'id' | 'revision'>) => ({
    ...current,
    revision: current.revision + 1,
    activity: [
      {
        ...item,
        timestamp: item.timestamp ?? new Date().toISOString(),
        createdArtifactIds: item.createdArtifactIds ?? [],
        revision: current.revision + 1,
        id: `activity_${current.revision + 1}_${stableHash(item)}`,
      },
      ...current.activity.filter((entry) => entry.status !== 'running'),
    ].slice(0, 5),
  }), []);

  const startNewMission = useCallback(() => {
    const nextGoal = goalDraft.trim();
    if (!nextGoal) {
      setNotice('Enter a behavior goal before starting a new mission.');
      return;
    }
    commit((current) => pushActivity({
      ...current,
      stage: 'discover',
      goal: nextGoal,
      discoveryDecision: null,
      selectedCircuitId: null,
      discoveredEvidenceIds: [],
      filteredEvidenceIds: [],
      hypothesis: null,
      experiment: null,
      approval: null,
      batch: null,
      analyses: [],
      comparison: null,
      bundle: null,
      evidenceExport: null,
    }, {
      title: 'New mission started',
      detail: 'The supervisor committed a new goal; prior scientific artifacts were cleared while the activity trail was retained.',
      status: 'complete',
      actor: 'human_ui',
    }));
    setSelectedConditionId('condition_bilateral');
    setPlayhead(0);
    setPlaying(false);
    setNotice('New mission committed. The agent should inspect the new revision before discovery.');
  }, [commit, goalDraft, pushActivity]);

  const actions = useMemo<Record<string, FlyLabToolAction>>(() => ({
    inspect_flylab_state: async () => {
      const current = labRef.current;
      const agentContext = buildFlyLabAgentContext(agentSnapshot(
        current,
        Boolean(activeSimulationControllerRef.current),
        Boolean(activeEvidenceSaveControllerRef.current),
      ));
      const provenanceEntries = buildCurrentLineageProvenanceEntries(current, '/agent_context/artifact_manifest');
      return {
        summary: `FlyLab is ${agentContext.agent_status}; ${agentContext.next_tool ? `next call ${agentContext.next_tool}` : agentContext.next_action.reason}`,
        data: { page_session_id: pageSessionIdRef.current, agent_context: agentContext },
        provenance: [...new Set(provenanceEntries.flatMap((entry) => entry.labels))],
        provenanceManifest: {
          entries: provenanceEntries,
          operationalPaths: [
            '/page_session_id',
            '/agent_context/state',
            '/agent_context/artifacts',
            '/agent_context/next_action',
            '/agent_context/next_tool',
            '/agent_context/human_controls',
            '/agent_context/human_gate',
            '/agent_context/pipeline',
            '/agent_context/session_warning',
            ...(current.discoveryDecision ? ['/agent_context/artifact_manifest/discovery_decision/mission_goal'] : []),
            ...(current.experiment ? ['/agent_context/artifact_manifest/experiment/approved'] : []),
            ...(current.approval ? [
              '/agent_context/artifact_manifest/approval/approved_at',
              '/agent_context/artifact_manifest/approval/protocol_hash',
              '/agent_context/artifact_manifest/approval/seed_manifest_hash',
            ] : []),
            ...(current.comparison ? ['/agent_context/artifact_manifest/comparison/proposal/execution_authorized'] : []),
          ],
        },
        stateRevision: current.revision,
        previousStateRevision: current.revision,
        createdArtifactIds: [],
        verification: {
          selector: '#flylab-agent-context',
          description: 'Live read-only state for this exact page session and revision.',
        },
      };
    },

    find_fly_circuits: async (input, { actor }) => {
      const entryState = labRef.current;
      requireMutationContext(input, entryState, pageSessionIdRef.current);
      const query = stringInput(input, 'query').toLowerCase();
      const behavior = stringInput(input, 'behavior', 'any');
      const bodyPart = stringInput(input, 'body_part', 'any');
      const requestedLabels = stringArrayInput(input, 'evidence_labels');
      const limit = numberInput(input, 'limit', 8);
      const allRankedMatches = rankCircuitsForSearch(query, behavior, bodyPart);
      const rankedMatches = takeRankedMatchesWithTies(allRankedMatches, limit);
      const matches = rankedMatches.map((match) => match.circuit);
      const bestMatchIsAmbiguous = allRankedMatches.length > 1 && allRankedMatches[0]?.score === allRankedMatches[1]?.score;
      const bestMatch = bestMatchIsAmbiguous ? null : allRankedMatches[0] ?? null;
      const selectedCircuit = bestMatch && EVIDENCE.some((record) => (
        bestMatch.circuit.evidenceIds.includes(record.id)
        && record.role === 'hypothesis_support'
        && record.support.kind === 'perturbation_effect'
        && (!requestedLabels.length || requestedLabels.includes(record.provenance))
      )) ? bestMatch.circuit : null;
      const evidence = EVIDENCE.filter((record) => Boolean(selectedCircuit?.evidenceIds.includes(record.id)));
      const filteredEvidence = evidence.filter((record) => !requestedLabels.length || requestedLabels.includes(record.provenance));
      const evidenceIds = evidence.map((record) => record.id);
      const filteredEvidenceIds = filteredEvidence.map((record) => record.id);
      const hypothesisEvidenceIds = filteredEvidence
        .filter((record) => record.role === 'hypothesis_support')
        .map((record) => record.id);
      const causalEvidenceIdsByPerturbation = {
        activate: filteredEvidence.filter((record) => record.support.kind === 'perturbation_effect'
          && record.support.perturbations?.includes('activate')).map((record) => record.id),
        silence: filteredEvidence.filter((record) => record.support.kind === 'perturbation_effect'
          && record.support.perturbations?.includes('silence')).map((record) => record.id),
      };
      const evidenceWithSources = evidence.map((record) => {
        const sources = record.sourceIds
          .map((id) => SOURCES.find((source) => source.id === id))
          .filter((source): source is (typeof SOURCES)[number] => Boolean(source));
        if (sources.length !== record.sourceIds.length) {
          throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'A discovered evidence record has an unresolved source reference.', false, {
            evidence_id: record.id,
            required_source_ids: record.sourceIds,
            resolved_source_ids: sources.map((source) => source.id),
          });
        }
        return {
          ...record,
          matches_requested_evidence_labels: !requestedLabels.length || requestedLabels.includes(record.provenance),
          sources,
        };
      });
      const candidateCircuitRecords = rankedMatches.map((match) => ({
        circuit: match.circuit,
        motor_map: motorMapForCircuit(match.circuit.id),
        evidence: EVIDENCE.filter((record) => match.circuit.evidenceIds.includes(record.id)).map((record) => ({
          ...record,
          sources: record.sourceIds
            .map((id) => SOURCES.find((source) => source.id === id))
            .filter((source): source is (typeof SOURCES)[number] => Boolean(source)),
        })),
      }));
      const discoveryDecision = buildDiscoveryDecision({
        missionGoal: entryState.goal,
        search: {
          query,
          behavior,
          bodyPart,
          evidenceLabels: requestedLabels,
          limit,
        },
        rankedMatches,
        selectedCircuitId: selectedCircuit?.id ?? null,
        circuits: CIRCUITS,
        evidence: EVIDENCE,
        motorMaps: EMBODIED_MOTOR_MAPS,
      });
      const returnedCircuits = selectedCircuit ? [selectedCircuit] : [];
      const embodimentCoverage = embodimentCoverageForCircuits(returnedCircuits.map((circuit) => circuit.id));
      const prior = entryState;
      const preservesLineage = selectedCircuit?.id === prior.selectedCircuitId
        && discoveryDecision.id === prior.discoveryDecision?.id
        && evidenceIds.length === prior.discoveredEvidenceIds.length
        && evidenceIds.every((id) => prior.discoveredEvidenceIds.includes(id))
        && filteredEvidenceIds.length === prior.filteredEvidenceIds.length
        && filteredEvidenceIds.every((id) => prior.filteredEvidenceIds.includes(id));
      const next = commit((current) => pushActivity({
          ...current,
          stage: preservesLineage ? current.stage : selectedCircuit ? 'hypothesize' : 'discover',
          discoveryDecision,
          selectedCircuitId: selectedCircuit?.id ?? null,
          discoveredEvidenceIds: selectedCircuit ? evidenceIds : [],
          filteredEvidenceIds: selectedCircuit ? filteredEvidenceIds : [],
          hypothesis: preservesLineage ? current.hypothesis : null,
          experiment: preservesLineage ? current.experiment : null,
          approval: preservesLineage ? current.approval : null,
          batch: preservesLineage ? current.batch : null,
          analyses: preservesLineage ? current.analyses : [],
          comparison: preservesLineage ? current.comparison : null,
          bundle: preservesLineage ? current.bundle : null,
          evidenceExport: preservesLineage ? current.evidenceExport : null,
        }, {
          title: selectedCircuit ? 'Circuit evidence found' : bestMatchIsAmbiguous ? 'Search needs a more specific target' : matches.length ? 'Evidence filter returned no records' : 'No curated circuit matched',
          detail: selectedCircuit ? `${selectedCircuit.abbreviation} selected with ${evidence.length} source-backed evidence records and motor map ${selectedCircuit.motorMapId}.${preservesLineage ? ' Existing lineage remains exact.' : ' Any prior lineage was invalidated.'}` : bestMatchIsAmbiguous ? `${allRankedMatches.length} circuits tied at the top rank. Add a behavior, body part, neuron, or pathway term before drafting.` : matches.length ? 'The best circuit matched, but no causal evidence matched the requested provenance filter.' : 'Try a neuron, behavior, leg, wing, or body-part target.',
          status: 'complete',
          actor,
          toolName: 'find_fly_circuits',
          createdArtifactIds: preservesLineage ? [] : [discoveryDecision.id],
        }));
      const postContext = getAgentContext(next);
      setNotice(selectedCircuit
        ? preservesLineage
          ? 'The same evidence selection was returned; the existing artifact lineage remains intact.'
          : `${selectedCircuit?.abbreviation ?? 'Circuit'} is selected. The next step is a falsifiable hypothesis.`
        : bestMatchIsAmbiguous ? 'That search matches multiple circuits equally. Refine it with a behavior, body part, neuron, or pathway term.' : matches.length ? 'No causal evidence matched that filter. Broaden the evidence labels before drafting.' : 'No match in the bounded challenge catalog.');
      const includesBundledBancSlice = returnedCircuits.some((circuit) => circuit.id === 'circuit_mdn_adult');
      const includesGfExternalContext = returnedCircuits.some((circuit) => circuit.id === 'circuit_gf_adult');
      const connectomeCells = (includesBundledBancSlice ? BANC_V888_CELLS : []).map((cell) => ({
        banc_888_id: cell.banc_888_id,
        root_id: cell.root_id,
        side: cell.side,
        proofread: cell.proofread,
        cell_type: cell.cell_type,
        region: cell.region,
        root_region: cell.root_region,
        super_class: cell.super_class,
        flylab_provenance: cell.flylab_provenance,
      }));
      const provenanceEntries: FlyLabProvenanceManifestEntry[] = [
        provenanceEntry(
          '/discovery_decision',
          discoveryDecision.id,
          'discovery_decision',
          'artifact',
          discoveryDecision.provenance,
          discoveryDecision.candidates.map((candidate) => candidate.circuitId),
          uniqueStrings(discoveryDecision.candidates.flatMap((candidate) => candidate.catalogEvidenceIds)),
          sourceIdsForEvidence(discoveryDecision.candidates.flatMap((candidate) => candidate.catalogEvidenceIds)),
          discoveryDecision.coverageWarning,
        ),
        ...candidateCircuitRecords.flatMap((candidate, candidateIndex) => [
          provenanceEntry(
            `/candidate_circuit_records/${candidateIndex}/circuit`,
            candidate.circuit.id,
            'circuit',
            'artifact',
            candidate.circuit.provenance,
            [],
            candidate.circuit.evidenceIds,
            sourceIdsForEvidence(candidate.circuit.evidenceIds),
            'Derived source catalog entry; not neural activity or a biological measurement.',
          ),
          ...(candidate.motor_map ? motorMapProvenanceEntries(
            candidate.motor_map,
            `/candidate_circuit_records/${candidateIndex}/motor_map`,
            [candidate.circuit.id],
          ) : []),
          ...candidate.evidence.flatMap((record, evidenceIndex) => [
            provenanceEntry(
              `/candidate_circuit_records/${candidateIndex}/evidence/${evidenceIndex}`,
              record.id,
              'evidence_record',
              'record',
              [record.provenance],
              [candidate.circuit.id],
              [],
              record.sourceIds,
              record.caution,
            ),
            ...record.sources.map((source, sourceIndex) => provenanceEntry(
              `/candidate_circuit_records/${candidateIndex}/evidence/${evidenceIndex}/sources/${sourceIndex}`,
              source.id,
              'source_record',
              'record',
              ['derived'],
              [record.id],
              [],
              [source.id],
              'Citation, access, rights, and specimen metadata; not itself a biological measurement.',
            )),
          ]),
        ]),
        ...returnedCircuits.map((record, index) => provenanceEntry(
          `/circuits/${index}`,
          record.id,
          'circuit',
          'artifact',
          record.provenance,
          [],
          record.evidenceIds,
          sourceIdsForEvidence(record.evidenceIds),
          'Derived source catalog entry; not neural activity or a biological measurement.',
        )),
        ...returnedCircuits.flatMap((record, index) => {
          const motorMap = motorMapForCircuit(record.id)!;
          return motorMapProvenanceEntries(motorMap, `/circuits/${index}/motor_map`, [record.id]);
        }),
        ...evidenceWithSources.flatMap((record, index) => [
          provenanceEntry(
            `/evidence/${index}`,
            record.id,
            'evidence_record',
            'record',
            [record.provenance],
            selectedCircuit ? [selectedCircuit.id] : [],
            [],
            record.sourceIds,
            record.caution,
          ),
          ...record.sources.map((source, sourceIndex) => provenanceEntry(
            `/evidence/${index}/sources/${sourceIndex}`,
            source.id,
            'source_record',
            'record',
            ['derived'],
            [record.id],
            [],
            [source.id],
            'Citation, access, rights, and specimen metadata; not itself a biological measurement or connectome inference.',
          )),
        ]),
        provenanceEntry(
          '/connectome_records/snapshot',
          'banc_888',
          'dataset_snapshot_identifier',
          'record',
          ['derived'],
          [],
          ['E-BANC-PATH-003', 'E-BANC-MDN-INVENTORY-007'],
          ['SRC-BANC-DATAVERSE-V3'],
          'Exact pinned dataset snapshot identifier for the returned cells and edges.',
        ),
        provenanceEntry(
          '/connectome_records/cells',
          'banc_888_mdn_lbl40_cells',
          'connectome_cell_metadata',
          'container',
          ['derived'],
          selectedCircuit ? [selectedCircuit.id] : [],
          ['E-BANC-MDN-INVENTORY-007'],
          ['SRC-BANC-DATAVERSE-V3'],
          'Deterministically selected metadata from the pinned BANC v888 specimen; classifier, literature-curated neurotransmitter, and cross-dataset-match fields are intentionally omitted.',
        ),
        provenanceEntry(
          '/connectome_records/edges',
          'banc_888_mdn_lbl40_edges_v3',
          'connectome_edge_predictions',
          'container',
          ['connectome_inferred'],
          selectedCircuit ? [selectedCircuit.id] : [],
          ['E-BANC-PATH-003'],
          ['SRC-BANC-NATURE-2026', 'SRC-BANC-DATAVERSE-V3'],
          'Four v3 MDN→LBL40 rows totaling 153 predicted synaptic links after the released postsynapse-size ≥10-voxel filter. This future-work v3 product differs from the Nature paper analyses, which use v2 (≥5); neither establishes activity, physiology, or causal efficacy.',
        ),
        provenanceEntry(
          '/connectome_records/field_semantics',
          null,
          'connectome_field_semantics',
          'container',
          ['derived'],
          [],
          ['E-BANC-PATH-003', 'E-BANC-MDN-INVENTORY-007'],
          ['SRC-BANC-DATAVERSE-V3'],
          'Machine-readable interpretation rules for the curated BANC fields.',
        ),
        provenanceEntry(
          '/connectome_records/interpretation',
          null,
          'connectome_interpretation_boundary',
          'record',
          ['derived'],
          [],
          ['E-BANC-PATH-003'],
          ['SRC-BANC-NATURE-2026', 'SRC-BANC-DATAVERSE-V3'],
          'Explicit method and biological interpretation boundary for this pinned slice.',
        ),
        provenanceEntry(
          '/dataset_versions',
          null,
          'dataset_manifest',
          'container',
          ['derived'],
          [],
          [],
          DATASET_MANIFEST_SOURCE_IDS,
          'Pinned dataset, software-reference, and visual-reference identity, version, license, scope, and limitations metadata. Visual references are explicitly ineligible for hypothesis support.',
        ),
        provenanceEntry(
          '/embodiment_coverage',
          null,
          'body_part_coverage_registry',
          'container',
          ['derived'],
          returnedCircuits.map((record) => record.id),
          [],
          [],
          'Deterministic coverage registry for reduced-order controller bindings; mapped does not mean complete, calibrated, or physiologically executed.',
        ),
      ];
      if (!includesBundledBancSlice) {
        for (let index = provenanceEntries.length - 1; index >= 0; index -= 1) {
          if (provenanceEntries[index].path.startsWith('/connectome_records/')) provenanceEntries.splice(index, 1);
        }
        provenanceEntries.push(provenanceEntry(
          '/connectome_records',
          null,
          'empty_connectome_result',
          'container',
          ['derived'],
          includesGfExternalContext ? ['circuit_gf_adult'] : [],
          [],
          [],
          includesGfExternalContext
            ? 'No connectome cell or edge rows are bundled for the selected GF circuit; narrower external context remains separately attributed.'
            : 'No curated circuit matched, so no connectome cell or edge rows are returned.',
        ));
      }
      if (includesGfExternalContext) {
        provenanceEntries.push(provenanceEntry(
          '/connectome_records/external_structural_context',
          'fanc_gf_escape_context',
          'external_connectome_context',
          'container',
          ['connectome_inferred'],
          ['circuit_gf_adult'],
          ['E-FANC-ESCAPE-012'],
          ['SRC-AZEVEDO-NATURE-2024'],
          'Claim-level FANC structural context only; no FANC nodes or edges are bundled or substituted for BANC identities.',
        ));
      }
      return {
        summary: selectedCircuit ? `Selected ${selectedCircuit.abbreviation} from ${allRankedMatches.length} matching circuit${allRankedMatches.length === 1 ? '' : 's'} with ${evidence.length} source-closed evidence records.` : bestMatchIsAmbiguous ? `${allRankedMatches.length} circuits tied at the top search rank; refine the query before creating a hypothesis.` : matches.length ? 'The best circuit matched, but the evidence filter returned no usable causal record.' : 'No circuit matched the bounded catalog.',
        data: {
          discovery_decision: discoveryDecision,
          candidate_circuit_records: candidateCircuitRecords,
          candidate_circuits: rankedMatches.map((match) => ({
            id: match.circuit.id,
            name: match.circuit.name,
            abbreviation: match.circuit.abbreviation,
            behaviors: match.circuit.behaviors,
            target_body_parts: match.circuit.targetBodyParts,
            score: match.score,
            matched_terms: match.matchedTerms,
            unmatched_terms: match.unmatchedTerms,
            selected: match.circuit.id === selectedCircuit?.id,
          })),
          selection_status: selectedCircuit ? 'selected' : bestMatchIsAmbiguous ? 'ambiguous' : allRankedMatches.length ? 'evidence_filtered' : 'no_match',
          disambiguation: bestMatchIsAmbiguous ? {
            required: true,
            reason: 'The top circuits matched the same number and specificity of meaningful query terms.',
            suggested_queries: ['MDN backward walking', 'giant fiber short-mode escape', 'wing output', 'jump-leg pathway'],
          } : {
            required: false,
          },
          circuits: returnedCircuits.map((circuit) => ({ ...circuit, motor_map: motorMapForCircuit(circuit.id) })),
          evidence: evidenceWithSources,
          connectome_records: {
            snapshot: includesBundledBancSlice ? 'banc_888' : null,
            cells: connectomeCells,
            edges: includesBundledBancSlice ? BANC_V888_EDGES : [],
            external_structural_context: returnedCircuits.filter((circuit) => circuit.id === 'circuit_gf_adult').map(() => ({
              dataset: 'FANC',
              specimen: 'one adult-female ventral nerve cord',
              source_id: 'SRC-AZEVEDO-NATURE-2024',
              bundled: false,
              boundary: 'Claim-level structural context only. No FANC node or edge is represented as a bundled BANC record.',
            })),
            field_semantics: includesBundledBancSlice ? {
              cells: 'Deterministically selected BANC v888 metadata. Neurotransmitter classifier, literature-curated neurotransmitter, and cross-dataset-match fields are intentionally omitted from the agent result.',
              edges: 'Rows come from banc_888_edgelist_simple_v3.feather, a future-work v3 predicted-synapse product filtered to postsynapse size ≥10 voxels. The Nature paper analyses use v2 with threshold ≥5.',
              count: 'Number of v3 predicted synaptic links represented by the directed row; not a physiological weight.',
              norm: 'Raw released normalization value preserved for auditability; FlyLab assigns it no biological or causal interpretation.',
            } : includesGfExternalContext ? {
              external_structural_context: 'Claim-level source metadata only; no connectome cell or edge rows are returned for this circuit.',
            } : {
              empty_result: 'No curated circuit matched the query, so no connectome records or external structural context are returned.',
            },
            interpretation: includesBundledBancSlice
              ? `${BANC_V888_EDGES.length} directed MDN→LBL40 rows total ${BANC_V888_MDN_LBL40_TOTAL_CONTACTS} v3 predicted synaptic links after the released postsynapse-size ≥10-voxel filter; they are not physiological weights, activity measurements, or causal efficacy.`
              : includesGfExternalContext
                ? 'No bundled connectome rows are returned for this selection. The GF motor path is a literature schematic, with FANC retained only as separately labeled claim-level structural context.'
                : 'No curated circuit matched the query, so there is no connectome interpretation for this result.',
          },
          dataset_versions: DATASET_MANIFEST,
          embodiment_coverage: embodimentCoverage,
          selected_circuit_id: selectedCircuit?.id ?? null,
          candidate_match_count: allRankedMatches.length,
          hypothesis_eligible_evidence_ids: hypothesisEvidenceIds,
          causal_evidence_ids_by_perturbation: causalEvidenceIdsByPerturbation,
          evidence_role_policy: 'The evidence array remains source-closed over the selected circuit and motor map. matches_requested_evidence_labels identifies records satisfying the optional search filter; only those filtered IDs appear in the hypothesis-eligible and causal-ID lists. A valid claim requires at least one matching perturbation_effect record, while structural, inventory, and motor-context records may only supplement it.',
          coverage_warning: 'This release maps adult MDN retreat to six legs and adult GF short-mode escape to middle legs and wings. It is a reduced-order milestone, not a complete fly nervous system, muscle system, or behavior repertoire.',
          next_action: postContext.next_action,
        },
        provenance: [...new Set(provenanceEntries.flatMap((entry) => entry.labels))],
        provenanceManifest: {
          entries: provenanceEntries,
          operationalPaths: [
            '/discovery_decision/missionGoal',
            '/discovery_decision/search',
            '/candidate_circuits',
            '/selection_status',
            '/disambiguation',
            ...evidenceWithSources.map((_, index) => `/evidence/${index}/matches_requested_evidence_labels`),
            '/hypothesis_eligible_evidence_ids',
            '/causal_evidence_ids_by_perturbation',
            '/evidence_role_policy',
            '/coverage_warning',
            '/selected_circuit_id',
            '/candidate_match_count',
            '/next_action',
          ],
        },
        stateRevision: next.revision,
        previousStateRevision: entryState.revision,
        createdArtifactIds: preservesLineage ? [] : [discoveryDecision.id],
        verification: {
          selector: '#flylab-agent-context',
          description: 'Confirm the selected circuit, discovery evidence IDs, and resulting next action.',
        },
      };
    },

    draft_fly_hypothesis: async (input, { actor }) => {
      const entryState = labRef.current;
      requireMutationContext(input, entryState, pageSessionIdRef.current);
      const circuitId = stringInput(input, 'circuit_id');
      const circuit = CIRCUITS.find((item) => item.id === circuitId);
      if (!circuit) throw new FlyLabDomainError('NOT_FOUND', `Circuit ${circuitId} is not in the curated catalog.`);
      const current = entryState;
      if (current.selectedCircuitId !== circuitId) {
        throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'Inspect or discover the selected circuit in this page session before drafting a hypothesis.', false, {
          selected_circuit_id: current.selectedCircuitId,
          requested_circuit_id: circuitId,
          recovery_tool: 'inspect_flylab_state',
        });
      }
      const evidenceIds = stringArrayInput(input, 'evidence_ids');
      const invalidEvidence = evidenceIds.filter((id) => !circuit.evidenceIds.includes(id) || !current.filteredEvidenceIds.includes(id));
      if (invalidEvidence.length) throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'One or more evidence IDs are not linked to the selected circuit.', false, { invalidEvidence });
      const ineligibleEvidence = evidenceIds
        .map((id) => EVIDENCE.find((record) => record.id === id))
        .filter((record): record is (typeof EVIDENCE)[number] => record !== undefined && record.role !== 'hypothesis_support');
      if (ineligibleEvidence.length) {
        throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'Context-only evidence cannot be promoted into hypothesis support.', false, {
          rejected_evidence: ineligibleEvidence.map((record) => ({ id: record.id, role: record.role })),
          hypothesis_eligible_evidence_ids: current.filteredEvidenceIds.filter((id) => (
            EVIDENCE.find((record) => record.id === id)?.role === 'hypothesis_support'
          )),
          recovery_tool: 'find_fly_circuits',
        });
      }
      const predictedBehavior = stringInput(input, 'predicted_behavior');
      if (!circuitSupportsBehavior(circuitId, predictedBehavior)) {
        throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'The predicted behavior must be supported by the selected circuit record.', false, {
          circuit_id: circuitId,
          requested_behavior: predictedBehavior,
          supported_behaviors: circuit.behaviors,
          recovery_tool: 'find_fly_circuits',
        });
      }
      const perturbation = stringInput(input, 'perturbation') as 'activate' | 'silence';
      const primaryOutcome = stringInput(input, 'primary_outcome') as MetricName;
      const availableOutcomes = metricsForCircuit(circuitId);
      if (!availableOutcomes.includes(primaryOutcome)) {
        throw new FlyLabDomainError('METRIC_UNAVAILABLE', 'The primary outcome must belong to the selected circuit motor map.', false, {
          circuit_id: circuitId,
          requested_primary_outcome: primaryOutcome,
          available_primary_outcomes: availableOutcomes,
        });
      }
      const causalEvidence = evidenceIds
        .map((id) => EVIDENCE.find((record) => record.id === id))
        .filter((record): record is (typeof EVIDENCE)[number] => record !== undefined
          && record.support.kind === 'perturbation_effect'
          && record.support.perturbations?.includes(perturbation) === true
          && record.support.behaviors?.includes(predictedBehavior) === true);
      if (!causalEvidence.length) {
        throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'The hypothesis needs at least one perturbation-effect record matching its perturbation and behavior.', false, {
          required_support: { kind: 'perturbation_effect', perturbation, behavior: predictedBehavior },
          matching_discovered_evidence_ids: current.filteredEvidenceIds.filter((id) => {
            const record = EVIDENCE.find((item) => item.id === id);
            return record?.role === 'hypothesis_support'
              && record.support.kind === 'perturbation_effect'
              && record.support.perturbations?.includes(perturbation)
              && record.support.behaviors?.includes(predictedBehavior);
          }),
          recovery_tool: 'find_fly_circuits',
        });
      }
      const hypothesis = makeHypothesis({
        circuitId,
        claim: stringInput(input, 'claim'),
        predictedBehavior,
        perturbation,
        primaryOutcome,
        expectedDirection: stringInput(input, 'expected_direction') as 'increase' | 'decrease',
        controls: [...HYPOTHESIS_CONTROL_IDS],
        evidenceIds,
        evidenceLimitations: stringArrayInput(input, 'evidence_limitations'),
        falsificationCriterion: stringInput(input, 'falsification_criterion'),
      });
      const preservesLineage = current.hypothesis?.id === hypothesis.id;
      const next = commit((current) => pushActivity({
        ...current,
        stage: preservesLineage ? current.stage : 'design',
        hypothesis,
        selectedCircuitId: circuitId,
        experiment: preservesLineage ? current.experiment : null,
        approval: preservesLineage ? current.approval : null,
        batch: preservesLineage ? current.batch : null,
        analyses: preservesLineage ? current.analyses : [],
        comparison: preservesLineage ? current.comparison : null,
        bundle: preservesLineage ? current.bundle : null,
        evidenceExport: preservesLineage ? current.evidenceExport : null,
      }, {
        title: 'Hypothesis drafted',
        detail: 'The claim is marked as an agent hypothesis and remains editable.',
        status: 'complete',
        actor,
        toolName: 'draft_fly_hypothesis',
        createdArtifactIds: preservesLineage ? [] : [hypothesis.id],
      }));
      const postContext = getAgentContext(next);
      setNotice(preservesLineage
        ? 'The identical hypothesis was returned; later artifacts remain intact.'
        : 'Hypothesis created without upgrading it to measured evidence.');
      return {
        summary: `Created an editable, falsifiable ${circuit.abbreviation} hypothesis.`,
        data: {
          hypothesis,
          next_action: postContext.next_action,
        },
        provenance: ['agent_hypothesized'],
        provenanceManifest: {
          entries: [provenanceEntry(
            '/hypothesis',
            hypothesis.id,
            'hypothesis',
            'artifact',
            ['agent_hypothesized'],
            [hypothesis.circuitId, ...hypothesis.evidenceIds],
            hypothesis.evidenceIds,
            sourceIdsForEvidence(hypothesis.evidenceIds),
            'Agent-authored falsifiable proposal; not source evidence, biological validation, or execution authority.',
          )],
          operationalPaths: ['/next_action'],
        },
        stateRevision: next.revision,
        previousStateRevision: entryState.revision,
        createdArtifactIds: preservesLineage ? [] : [hypothesis.id],
        verification: {
          selector: '#flylab-agent-context',
          description: 'Confirm the hypothesis ID and that design_stimulation_trial is the next callable action.',
        },
      };
    },

    design_stimulation_trial: async (input, { actor }) => {
      const current = labRef.current;
      requireMutationContext(input, current, pageSessionIdRef.current);
      if (!current.hypothesis || current.hypothesis.id !== stringInput(input, 'hypothesis_id')) {
        throw new FlyLabDomainError('NOT_FOUND', 'Create or select the referenced hypothesis first.');
      }
      if (!CIRCUITS.some((circuit) => circuit.id === stringInput(input, 'target_circuit_id'))) {
        throw new FlyLabDomainError('UNSUPPORTED_TARGET', 'The requested circuit is outside the validated challenge catalog.');
      }
      const targetCircuitId = stringInput(input, 'target_circuit_id');
      const perturbation = stringInput(input, 'perturbation') as 'activate' | 'silence';
      const laterality = stringInput(input, 'laterality') as 'bilateral' | 'left' | 'right';
      if (current.hypothesis.circuitId !== targetCircuitId || current.hypothesis.perturbation !== perturbation) {
        throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'The trial target and perturbation must match the saved hypothesis.', false, {
          hypothesis_circuit_id: current.hypothesis.circuitId,
          requested_circuit_id: targetCircuitId,
          hypothesis_perturbation: current.hypothesis.perturbation,
          requested_perturbation: perturbation,
        });
      }
      const motorMap = motorMapForCircuit(targetCircuitId)!;
      if (!motorMap.supportedLaterality.includes(laterality)) {
        throw new FlyLabDomainError('UNSUPPORTED_TARGET', 'The requested laterality is not represented by this circuit motor map.', false, {
          circuit_id: targetCircuitId,
          motor_map_id: motorMap.id,
          requested_laterality: laterality,
          supported_lateralities: motorMap.supportedLaterality,
        });
      }
      const experiment = designExperiment({
        hypothesisId: current.hypothesis.id,
        targetCircuitId,
        behavior: current.hypothesis.predictedBehavior,
        perturbation,
        laterality,
        activationLevel: numberInput(input, 'activation_level', 0.65),
        onsetMs: numberInput(input, 'onset_ms', 1000),
        durationMs: numberInput(input, 'duration_ms', 2000),
        trialDurationMs: numberInput(input, 'trial_duration_ms', 5000),
        replicates: numberInput(input, 'replicates', 5),
        includeBaseline: input.include_baseline !== false,
        includeShamControl: input.include_sham_control !== false,
        seed: numberInput(input, 'seed', 73142),
      });
      const preservesLineage = current.experiment?.id === experiment.id;
      const next = commit((state) => pushActivity({
        ...state,
        stage: preservesLineage ? state.stage : 'design',
        experiment: preservesLineage ? state.experiment : experiment,
        approval: preservesLineage ? state.approval : null,
        batch: preservesLineage ? state.batch : null,
        analyses: preservesLineage ? state.analyses : [],
        comparison: preservesLineage ? state.comparison : null,
        bundle: preservesLineage ? state.bundle : null,
        evidenceExport: preservesLineage ? state.evidenceExport : null,
      }, {
        title: 'Controlled trial designed',
        detail: preservesLineage
          ? `${experiment.id} already exists; its approval and downstream lineage remain intact.`
          : `${experiment.conditions.length} arms · ${experiment.replicates} replicates each · awaiting human approval.`,
        status: preservesLineage ? 'complete' : 'waiting',
        actor,
        toolName: 'design_stimulation_trial',
        createdArtifactIds: preservesLineage ? [] : [experiment.id, ...experiment.conditions.map((condition) => condition.id)],
      }));
      const persistedExperiment = next.experiment ?? experiment;
      const postContext = getAgentContext(next);
      setSelectedConditionId(persistedExperiment.conditions.find((condition) => condition.laterality === persistedExperiment.primaryLaterality)?.id ?? persistedExperiment.conditions[0].id);
      setNotice(preservesLineage
        ? 'The identical protocol was returned; approval and later artifacts remain intact.'
        : 'Protocol is ready for human review. The agent cannot run it until you approve.');
      const designProvenanceEntries = [
        provenanceEntry(
          '/experiment',
          persistedExperiment.id,
          'experiment',
          'artifact',
          [...persistedExperiment.provenance],
          [persistedExperiment.hypothesisId, persistedExperiment.targetCircuitId],
          current.hypothesis.evidenceIds,
          sourceIdsForEvidence(current.hypothesis.evidenceIds),
          'Human-reviewable virtual protocol with a unitless model control; not a wet-lab protocol or biological dose.',
        ),
        ...motorMapProvenanceEntries(persistedExperiment.motorMap, '/experiment/motorMap', [persistedExperiment.targetCircuitId, persistedExperiment.id]),
        provenanceEntry(
          '/experiment/model',
          null,
          'model_manifest',
          'container',
          ['derived'],
          [persistedExperiment.id],
          ['E-FLYLAB-MODEL-004'],
          ['SRC-FLYLAB-MODEL-CARD', 'SRC-FLYGYM-NM-2024', 'SRC-FLYGYM-CODE-V210'],
          MODEL_MANIFEST.boundary,
        ),
        provenanceEntry(
          '/experiment/model/controllerMapping',
          null,
          'controller_mapping',
          'container',
          ['agent_hypothesized'],
          [persistedExperiment.id],
          ['E-FLYLAB-MODEL-004'],
          ['SRC-FLYLAB-MODEL-CARD'],
          MODEL_MANIFEST.controllerMapping.statement,
        ),
        provenanceEntry(
          '/experiment/model/parameterization',
          null,
          'hand_authored_model_parameterization',
          'container',
          ['agent_hypothesized'],
          [persistedExperiment.id],
          ['E-FLYLAB-MODEL-004'],
          ['SRC-FLYLAB-MODEL-CARD'],
          'Hand-authored, uncalibrated constants and declared model-unit boundaries; not fitted biological measurements.',
        ),
      ];
      const designProvenance = [...new Set(designProvenanceEntries.flatMap((entry) => entry.labels))];
      const targetCircuit = CIRCUITS.find((circuit) => circuit.id === persistedExperiment.targetCircuitId)!;
      return {
        summary: preservesLineage
          ? `Returned the existing controlled ${targetCircuit.abbreviation} perturbation experiment without regressing its lineage.`
          : `Created a controlled ${targetCircuit.abbreviation} perturbation experiment that requires human approval.`,
        data: {
          experiment: persistedExperiment,
          approval_required: !persistedExperiment.approved,
          agent_status: postContext.agent_status,
          blocked_by: postContext.next_action.blocked_by,
          agent_actionable: postContext.next_action.callable,
          human_gate: postContext.human_gate,
          next_action: postContext.next_action,
        },
        provenance: designProvenance,
        provenanceManifest: {
          entries: designProvenanceEntries,
          operationalPaths: ['/experiment/approved', '/approval_required', '/agent_status', '/blocked_by', '/agent_actionable', '/human_gate', '/next_action'],
        },
        stateRevision: next.revision,
        previousStateRevision: current.revision,
        createdArtifactIds: preservesLineage ? [] : [persistedExperiment.id, ...persistedExperiment.conditions.map((condition) => condition.id)],
        verification: {
          selector: '.protocol-controls',
          description: 'Review the exact visible protocol; only the human approval control can unlock execution.',
        },
      };
    },

    run_fly_simulation: async (input, { signal, actor }) => {
      const current = labRef.current;
      const operationId = stringInput(input, 'operation_id');
      const requestedSessionId = stringInput(input, 'page_session_id');
      const operationKey = `${requestedSessionId}:run_fly_simulation:${operationId}`;
      const canonicalInput = canonicalOperationInput(input);
      requireMutationContext(input, current, pageSessionIdRef.current);
      const priorOperation = completedOperationsRef.current.get(operationKey);
      if (priorOperation) {
        if (priorOperation.canonicalInput !== canonicalInput) {
          throw new FlyLabDomainError('INVALID_INPUT', 'operation_id was already used with different simulation input.', false, {
            operation_id: operationId,
            conflict: 'operation_id_input_mismatch',
            recovery: 'Generate a new operation_id for a different logical operation.',
          });
        }
        const cachedBatchId = typeof priorOperation.result.data.id === 'string'
          ? priorOperation.result.data.id
          : null;
        const cachedApproval = priorOperation.result.data.approval as { protocol_hash?: unknown } | undefined;
        if (!cachedBatchId
          || current.batch?.id !== cachedBatchId
          || current.experiment?.id !== stringInput(input, 'experiment_id')
          || current.approval?.protocol_hash !== stringInput(input, 'approved_protocol_hash')
          || cachedApproval?.protocol_hash !== current.approval.protocol_hash) {
          throw new FlyLabDomainError('INVALID_INPUT', 'operation_id belongs to a completed simulation whose approved lineage is no longer current.', false, {
            operation_id: operationId,
            conflict: 'operation_id_input_mismatch',
            lineage_status: 'invalidated_or_replaced',
            cached_batch_id: cachedBatchId,
            current_batch_id: current.batch?.id ?? null,
            recovery: 'Generate a new operation_id after inspecting and approving the current experiment.',
          });
        }
        return {
          ...priorOperation.result,
          summary: `${priorOperation.result.summary} Replayed without another simulation or state mutation.`,
          data: {
            ...priorOperation.result.data,
            next_action: getAgentContext(current).next_action,
          },
          stateRevision: current.revision,
          previousStateRevision: current.revision,
          createdArtifactIds: [],
          idempotentReplay: true,
          operationId,
        };
      }
      if (!current.experiment || current.experiment.id !== stringInput(input, 'experiment_id')) {
        throw new FlyLabDomainError('NOT_FOUND', 'The requested experiment does not exist in this page session.');
      }
      const experiment = current.experiment;
      if (!current.experiment.approved || !current.approval) {
        throw new FlyLabDomainError('APPROVAL_REQUIRED', 'A supervisor must approve the visible protocol before the simulation can run.', false, {
          experiment_id: current.experiment.id,
          state_revision: current.revision,
          blocked_by: 'human_approval',
          agent_actionable: false,
          human_gate: {
            id: 'approve_experiment',
            status: 'required',
            subject_experiment_id: current.experiment.id,
            blocks_tool: 'run_fly_simulation',
            agent_can_satisfy: false,
            webmcp_tool_can_satisfy: false,
            scope: 'webmcp_site_tools',
          },
          next_action: {
            kind: 'human_gate',
            name: null,
            callable: false,
            blocked_by: 'human_approval',
            input_refs: { experiment_id: current.experiment.id },
          },
        });
      }
      const approval = current.approval;
      const requestedProtocolHash = stringInput(input, 'approved_protocol_hash');
      if (requestedProtocolHash !== approval.protocol_hash) {
        throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'The supplied approved_protocol_hash does not authorize the current experiment.', false, {
          experiment_id: current.experiment.id,
          expected_protocol_hash: approval.protocol_hash,
          received_protocol_hash: requestedProtocolHash,
          recovery_tool: 'inspect_flylab_state',
        });
      }
      const approvalMatchesCurrentSnapshot = await verifyAtCurrentStateRevision({
        expectedRevision: current.revision,
        getCurrentRevision: () => labRef.current.revision,
        verify: () => verifyExperimentApproval(approval, experiment),
        details: () => ({
          expected_experiment_id: experiment.id,
          actual_experiment_id: labRef.current.experiment?.id ?? null,
          expected_protocol_hash: approval.protocol_hash,
          actual_protocol_hash: labRef.current.approval?.protocol_hash ?? null,
        }),
      });
      if (!approvalMatchesCurrentSnapshot) {
        throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'The stored approval no longer matches the exact protocol, model, metric method, or seed manifest.', false, {
          experiment_id: current.experiment.id,
          approved_protocol_hash: approval.protocol_hash,
          approved_seed_manifest_hash: approval.seed_manifest_hash,
          recovery: 'Review and approve the current visible experiment again.',
        });
      }
      const approvalEntry = provenanceEntry(
        '/approval',
        approval.protocol_hash,
        'experiment_approval',
        'artifact',
        ['agent_hypothesized'],
        [approval.experiment_id],
        current.hypothesis?.evidenceIds ?? [],
        sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []),
        'Visible human authorization for the exact virtual protocol and seed manifest; not scientific evidence or wet-lab approval.',
      );
      if (current.batch?.experimentId === current.experiment.id) {
        const postContext = getAgentContext(current);
        const provenanceEntries = [
          ...batchFieldProvenanceEntries(current.batch, current.hypothesis?.evidenceIds ?? []),
          approvalEntry,
        ];
        const result: ToolActionResult = {
          summary: 'Returned the existing deterministic simulation batch.',
          data: {
            ...current.batch,
            approval,
            boundary: MODEL_MANIFEST.boundary,
            next_action: postContext.next_action,
          },
          provenance: [...new Set(provenanceEntries.flatMap((entry) => entry.labels))],
          provenanceManifest: {
            entries: provenanceEntries,
            operationalPaths: ['/status', '/approval/approved_at', '/approval/protocol_hash', '/approval/seed_manifest_hash', '/next_action'],
          },
          stateRevision: current.revision,
          previousStateRevision: current.revision,
          createdArtifactIds: [],
          idempotentReplay: false,
          operationId,
          verification: {
            selector: '.trial-queue',
            description: 'Confirm the completed batch and its exact run IDs in the shared page state.',
          },
        };
        completedOperationsRef.current.set(operationKey, { canonicalInput, result });
        return result;
      }
      if (activeSimulationControllerRef.current) {
        throw new FlyLabDomainError('SIMULATION_UNAVAILABLE', 'A FlyLab simulation batch is already running.', true);
      }

      const runController = new AbortController();
      activeSimulationControllerRef.current = runController;
      const runSignal = AbortSignal.any([signal, runController.signal]);
      setSimulationRunning(true);

      const runningState = commit((state) => pushActivity({ ...state, stage: 'run' }, {
        title: 'Simulation batch running',
        detail: `${experiment.conditions.length * experiment.replicates} deterministic virtual trials are being evaluated.`,
        status: 'running',
        actor,
        toolName: 'run_fly_simulation',
      }));
      setNotice('Running the seeded FlyLab model. All resulting claims remain simulation predictions.');
      let completed: { batch: SimulationBatch; stateRevision: number };
      try {
        completed = await prepareCancellableCommit({
          signal: runSignal,
          cancellationRequested: () => chromeCancellationRequestedRef.current.has(runController),
          prepare: async (runSignal) => {
            await waitFor(650, runSignal);
            return simulateExperiment(experiment);
          },
          commit: (batch) => {
            requireCurrentStateRevision(
              runningState.revision,
              labRef.current.revision,
              {
                expected_experiment_id: experiment.id,
                actual_experiment_id: labRef.current.experiment?.id ?? null,
              },
            );
            const next = commit((state) => pushActivity({ ...state, stage: 'analyze', batch }, {
              title: 'Simulation batch complete',
              detail: `${batch.conditionRuns.reduce((count, run) => count + run.replicates.length, 0)} runs · ${batch.runHash}`,
              status: 'complete',
              actor,
              toolName: 'run_fly_simulation',
              createdArtifactIds: [
                batch.id,
                ...batch.conditionRuns.flatMap((condition) => condition.runIds),
                ...batch.conditionRuns.flatMap((condition) => condition.replicates.map((replicate) => replicate.trajectoryId)),
                ...batch.conditionRuns.map((condition) => condition.trajectoryId),
              ],
            }));
            return { batch, stateRevision: next.revision };
          },
        });
      } catch (error) {
        const cancelled = runSignal.aborted || chromeCancellationRequestedRef.current.has(runController);
        commit((state) => pushActivity(state, {
          title: cancelled ? 'Simulation cancelled' : 'Simulation failed safely',
          detail: cancelled ? 'No completed batch or result record was committed.' : 'Prepared work was not published. Inspect the current revision before retrying.',
          status: cancelled ? 'cancelled' : 'failed',
          actor,
          toolName: 'run_fly_simulation',
        }));
        setNotice(cancelled ? 'Simulation cancelled. No results were committed.' : 'Simulation did not commit. Inspect the shared state before continuing.');
        throw error;
      } finally {
        chromeCancellationRequestedRef.current.delete(runController);
        if (activeSimulationControllerRef.current === runController) {
          activeSimulationControllerRef.current = null;
          setSimulationRunning(false);
        }
      }
      const { batch, stateRevision } = completed;
      setPlayhead(0);
      setPlaying(true);
      setNotice('Simulation complete. Inspect the replay, then quantify the behavior.');
      const provenanceEntries = [
        ...batchFieldProvenanceEntries(batch, current.hypothesis?.evidenceIds ?? []),
        approvalEntry,
      ];
      const result: ToolActionResult = {
        summary: 'Completed the approved deterministic simulation batch.',
        data: {
          ...batch,
          approval,
          boundary: MODEL_MANIFEST.boundary,
          next_action: getAgentContext(labRef.current).next_action,
        },
        provenance: [...new Set(provenanceEntries.flatMap((entry) => entry.labels))],
        provenanceManifest: {
          entries: provenanceEntries,
          operationalPaths: ['/status', '/approval/approved_at', '/approval/protocol_hash', '/approval/seed_manifest_hash', '/next_action'],
        },
        stateRevision,
        previousStateRevision: current.revision,
        createdArtifactIds: [
          batch.id,
          ...batch.conditionRuns.flatMap((condition) => condition.runIds),
          ...batch.conditionRuns.flatMap((condition) => condition.replicates.map((replicate) => replicate.trajectoryId)),
          ...batch.conditionRuns.map((condition) => condition.trajectoryId),
        ],
        idempotentReplay: false,
        operationId,
        verification: {
          selector: '.trial-queue',
          description: 'Confirm the completed batch, condition arms, and exact seeded run IDs.',
        },
      };
        completedOperationsRef.current.set(operationKey, { canonicalInput, result });
      return result;
    },

    analyze_fly_behavior: async (input, { actor }) => {
      const current = labRef.current;
      requireMutationContext(input, current, pageSessionIdRef.current);
      if (!current.batch || current.batch.id !== stringInput(input, 'batch_id')) {
        throw new FlyLabDomainError('INCOMPLETE_BATCH', 'Run the referenced simulation batch before analysis.');
      }
      const requestedMetrics = stringArrayInput(input, 'metrics') as MetricName[];
      const metrics = ANALYSIS_METRICS.filter((metric) => requestedMetrics.includes(metric));
      const requiredMetrics = metricsForCircuit(current.batch.targetCircuitId);
      if (metrics.length !== requiredMetrics.length || requiredMetrics.some((metric) => !metrics.includes(metric))) {
        throw new FlyLabDomainError('METRIC_UNAVAILABLE', 'The requested metrics do not match this circuit motor map.', false, {
          circuit_id: current.batch.targetCircuitId,
          behavior: current.batch.behavior,
          required_metrics: requiredMetrics,
        });
      }
      const analysis = analyzeBatch(current.batch, metrics);
      const perRunResults = current.batch.conditionRuns.map((condition) => ({
        condition_id: condition.conditionId,
        label: condition.label,
        runs: condition.replicates.map(({ trajectory, ...replicate }) => ({
          ...replicate,
          trajectory_point_count: trajectory.length,
        })),
      }));
      const changesAnalysisLineage = !current.analyses.some((item) => item.id === analysis.id);
      const next = commit((state) => pushActivity({
        ...state,
        stage: changesAnalysisLineage ? 'continue' : state.stage,
        analyses: [...state.analyses.filter((item) => item.id !== analysis.id), analysis],
        comparison: changesAnalysisLineage ? null : state.comparison,
        bundle: changesAnalysisLineage ? null : state.bundle,
        evidenceExport: changesAnalysisLineage ? null : state.evidenceExport,
      }, {
        title: 'Behavior quantified',
          detail: `${metrics.length} motor-map metrics analyzed across ${analysis.conditions.length} conditions.`,
        status: 'complete',
        actor,
        toolName: 'analyze_fly_behavior',
        createdArtifactIds: changesAnalysisLineage ? [analysis.id] : [],
      }));
      const postContext = getAgentContext(next);
      setNotice('Simulation predicted — not a biological measurement. Every aggregate remains traceable to exact per-run seeds and trajectory IDs.');
      return {
        summary: 'Computed method-versioned behavioral metrics from the completed simulation batch.',
        data: {
          analysis,
          metric_definitions: analysis.metricDefinitions,
          response_initiation_summary_definition: analysis.responseInitiationSummaryDefinition,
          per_run_results: perRunResults,
          unit_boundary: MODEL_MANIFEST.parameterization.unitBoundary,
          next_action: postContext.next_action,
        },
        provenance: ['derived', 'simulation_predicted'],
        provenanceManifest: {
          entries: [
            provenanceEntry(
              '/analysis',
              analysis.id,
              'behavior_analysis',
              'artifact',
              ['derived', 'simulation_predicted'],
              [analysis.batchId],
              current.hypothesis?.evidenceIds ?? [],
              uniqueStrings([
                ...sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []),
                'SRC-FLYLAB-MODEL-CARD',
              ]),
              analysis.warning,
            ),
            provenanceEntry(
              '/metric_definitions',
              null,
              'analysis_method_metadata',
              'container',
              ['derived'],
              [analysis.id],
              [],
              ['SRC-FLYLAB-MODEL-CARD'],
              'Method definitions for simulation-derived metrics; not biological effect-size definitions.',
            ),
            provenanceEntry(
              '/response_initiation_summary_definition',
              null,
              'analysis_summary_method_metadata',
              'record',
              ['derived'],
              [analysis.id],
              [],
              ['SRC-FLYLAB-MODEL-CARD'],
              RESPONSE_INITIATION_SUMMARY_DEFINITION.boundary,
            ),
            provenanceEntry(
              '/per_run_results',
              null,
              'simulation_run_collection',
              'container',
              ['simulation_predicted'],
              [current.batch.id, analysis.id],
              current.hypothesis?.evidenceIds ?? [],
              uniqueStrings([
                ...sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []),
                'SRC-FLYLAB-MODEL-CARD',
              ]),
              'Exact seeded reduced-order run outputs; not measurements from animals.',
            ),
            provenanceEntry(
              '/unit_boundary',
              null,
              'model_unit_boundary',
              'record',
              ['derived'],
              [analysis.id],
              [],
              ['SRC-FLYLAB-MODEL-CARD'],
              MODEL_MANIFEST.parameterization.unitBoundary,
            ),
          ],
          operationalPaths: ['/next_action'],
        },
        stateRevision: next.revision,
        previousStateRevision: current.revision,
        createdArtifactIds: changesAnalysisLineage ? [analysis.id] : [],
        verification: {
          selector: '.results-panel',
          description: 'Confirm the analysis ID, all five required metrics, formal definitions, per-run records, and the simulation-only boundary.',
        },
      };
    },

    compare_fly_trials: async (input, { actor }) => {
      const current = labRef.current;
      requireMutationContext(input, current, pageSessionIdRef.current);
      const ids = stringArrayInput(input, 'analysis_ids');
      const analyses = current.analyses.filter((analysis) => ids.includes(analysis.id));
      if (!analyses.length || analyses.length !== ids.length) {
        throw new FlyLabDomainError('INCOMPARABLE_ANALYSES', 'One or more analysis IDs are missing from this page session.');
      }
      const batchIds = new Set(analyses.map((analysis) => analysis.batchId));
      if (batchIds.size !== 1) {
        throw new FlyLabDomainError('INCOMPARABLE_ANALYSES', 'Selected analyses must describe the same simulation batch.', false, {
          batch_ids: [...batchIds],
        });
      }
      const objectiveMetric = stringInput(input, 'objective_metric') as MetricName;
      const missingMetric = analyses.filter((analysis) => !analysis.metrics.includes(objectiveMetric));
      if (missingMetric.length) {
        throw new FlyLabDomainError('METRIC_UNAVAILABLE', 'The objective metric must be present in every selected analysis.', false, {
          objective_metric: objectiveMetric,
          analyses_missing_metric: missingMetric.map((analysis) => analysis.id),
        });
      }
      if (analyses.flatMap((analysis) => analysis.conditions).every((condition) => conditionMetricValue(condition, objectiveMetric) === null)) {
        const availableObjectiveMetrics = sharedAvailableObjectiveMetrics(analyses);
        throw new FlyLabDomainError('METRIC_UNAVAILABLE', 'The selected objective has no responsive values to rank. Choose a metric with observed simulation values.', false, {
          objective_metric: objectiveMetric,
          available_objective_metrics: availableObjectiveMetrics,
          recovery_tool: 'compare_fly_trials',
        });
      }
      const comparison = compareAnalyses(
        analyses,
        objectiveMetric,
        stringInput(input, 'objective') as 'maximize' | 'minimize',
        undefined,
        current.nextTrialBudget,
        current.experiment ?? undefined,
      );
      const changesComparisonLineage = labRef.current.comparison?.id !== comparison.id;
      const next = commit((state) => pushActivity({
        ...state,
        stage: changesComparisonLineage ? 'continue' : state.stage,
        comparison,
        bundle: changesComparisonLineage ? null : state.bundle,
        evidenceExport: changesComparisonLineage ? null : state.evidenceExport,
      }, {
        title: 'Next experiment proposed',
        detail: `Conditions ranked; a bounded model-${current.experiment?.perturbation === 'silence' ? 'suppression' : 'drive'} follow-up awaits human direction.`,
        status: 'waiting',
        actor,
        toolName: 'compare_fly_trials',
        createdArtifactIds: changesComparisonLineage ? [comparison.id, comparison.proposal.id] : [],
      }));
      const postContext = getAgentContext(next);
      setNotice('The agent selected a next experiment but did not run it automatically.');
      return {
        summary: 'Ranked simulated conditions and proposed one bounded follow-up experiment.',
        data: {
          comparison,
          execution_authorized: false,
          next_action: postContext.next_action,
        },
        provenance: ['derived', 'simulation_predicted', 'agent_hypothesized'],
        provenanceManifest: {
          entries: [
            provenanceEntry(
              '/comparison',
              comparison.id,
              'trial_comparison',
              'artifact',
              ['derived', 'simulation_predicted'],
              comparison.analysisIds,
              current.hypothesis?.evidenceIds ?? [],
              uniqueStrings([
                ...sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []),
                'SRC-FLYLAB-MODEL-CARD',
              ]),
              'Ranking of simulation-derived analyses; not biological evidence.',
            ),
            provenanceEntry(
              '/comparison/proposal',
              comparison.proposal.id,
              'follow_up_proposal',
              'artifact',
              ['agent_hypothesized'],
              [comparison.id],
              current.hypothesis?.evidenceIds ?? [],
              sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []),
              'Agent-authored proposal only; execution is not authorized.',
            ),
          ],
          operationalPaths: ['/execution_authorized', '/next_action'],
        },
        stateRevision: next.revision,
        previousStateRevision: current.revision,
        createdArtifactIds: changesComparisonLineage ? [comparison.id, comparison.proposal.id] : [],
        verification: {
          selector: '.comparison-ranking',
          description: 'Confirm the ranked conditions and that the follow-up remains proposal-only.',
        },
      };
    },

    save_fly_evidence: async (input, { actor, signal }) => {
      const current = labRef.current;
      const operationId = stringInput(input, 'operation_id');
      const requestedSessionId = stringInput(input, 'page_session_id');
      const operationKey = `${requestedSessionId}:save_fly_evidence:${operationId}`;
      const canonicalInput = canonicalOperationInput(input);
      requireMutationContext(input, current, pageSessionIdRef.current);
      const priorOperation = completedOperationsRef.current.get(operationKey);
      if (priorOperation) {
        if (priorOperation.canonicalInput !== canonicalInput) {
          throw new FlyLabDomainError('INVALID_INPUT', 'operation_id was already used with different evidence-save input.', false, {
            operation_id: operationId,
            conflict: 'operation_id_input_mismatch',
            recovery: 'Generate a new operation_id for a different logical operation.',
          });
        }
        const cachedBundle = priorOperation.result.data.bundle as { id?: unknown; manifestHash?: unknown } | undefined;
        if (typeof cachedBundle?.id !== 'string'
          || typeof cachedBundle.manifestHash !== 'string'
          || current.bundle?.id !== cachedBundle.id
          || current.bundle.manifestHash !== cachedBundle.manifestHash
          || current.evidenceExport?.bundle.id !== cachedBundle.id
          || current.experiment?.id !== stringInput(input, 'experiment_id')) {
          throw new FlyLabDomainError('INVALID_INPUT', 'operation_id belongs to a completed evidence save whose lineage is no longer current.', false, {
            operation_id: operationId,
            conflict: 'operation_id_input_mismatch',
            lineage_status: 'invalidated_or_replaced',
            cached_bundle_id: typeof cachedBundle?.id === 'string' ? cachedBundle.id : null,
            current_bundle_id: current.bundle?.id ?? null,
            recovery: 'Generate a new operation_id after inspecting the current complete lineage.',
          });
        }
        return {
          ...priorOperation.result,
          summary: `${priorOperation.result.summary} Replayed without another save, activity entry, or state mutation.`,
          data: {
            ...priorOperation.result.data,
            next_action: getAgentContext(current).next_action,
          },
          stateRevision: current.revision,
          previousStateRevision: current.revision,
          createdArtifactIds: [],
          idempotentReplay: true,
          operationId,
        };
      }
      const bundleScope = stringInput(input, 'scope') as 'experiment' | 'mission';
      const hypothesisId = stringInput(input, 'hypothesis_id');
      const experimentId = stringInput(input, 'experiment_id');
      const batchIds = stringArrayInput(input, 'batch_ids');
      const analysisIds = stringArrayInput(input, 'analysis_ids');
      if (!current.hypothesis
        || current.hypothesis.id !== hypothesisId
        || !current.experiment
        || current.experiment.id !== experimentId
        || !current.batch
        || current.batch.experimentId !== experimentId
        || batchIds.length !== 1
        || batchIds[0] !== current.batch.id
        || !current.comparison
        || current.comparison.id !== stringInput(input, 'comparison_id')) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'The evidence bundle must reference the complete visible FlyLab lineage.');
      }
      const hypothesis = current.hypothesis;
      const circuit = CIRCUITS.find((record) => record.id === hypothesis.circuitId);
      if (!circuit) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'The hypothesis circuit record is no longer available in the pinned catalog.', false, {
          required_circuit_id: hypothesis.circuitId,
        });
      }
      const experiment = current.experiment;
      const approval = current.approval;
      if (!experiment.approved || !approval) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'The evidence bundle requires the immutable approval record for the exact executed protocol and seed manifest.', false, {
          experiment_id: experiment.id,
          approval_present: Boolean(approval),
          recovery: 'Review and approve the current protocol, then run it before saving evidence.',
        });
      }
      const approvalMatchesCurrentSnapshot = await verifyAtCurrentStateRevision({
        expectedRevision: current.revision,
        getCurrentRevision: () => labRef.current.revision,
        verify: () => verifyExperimentApproval(approval, experiment),
        details: () => ({
          expected_experiment_id: experiment.id,
          actual_experiment_id: labRef.current.experiment?.id ?? null,
          expected_protocol_hash: approval.protocol_hash,
          actual_protocol_hash: labRef.current.approval?.protocol_hash ?? null,
        }),
      });
      if (!approvalMatchesCurrentSnapshot) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'The evidence bundle requires the immutable approval record for the exact executed protocol and seed manifest.', false, {
          experiment_id: experiment.id,
          approval_present: Boolean(approval),
          recovery: 'Review and approve the current protocol, then run it before saving evidence.',
        });
      }
      const batch = current.batch;
      const comparison = current.comparison;
      const selectedAnalyses = analysisIds.map((id) => current.analyses.find((analysis) => analysis.id === id));
      const comparisonAnalysisIds = new Set(comparison.analysisIds);
      if (selectedAnalyses.some((analysis) => !analysis)
        || selectedAnalyses.some((analysis) => analysis?.batchId !== batch.id)
        || analysisIds.length !== comparisonAnalysisIds.size
        || !analysisIds.every((id) => comparisonAnalysisIds.has(id))) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'Analysis IDs must match the complete saved comparison lineage.', false, {
          required_analysis_ids: comparison.analysisIds,
        });
      }
      const lineageAnalyses = comparison.analysisIds
        .map((id) => current.analyses.find((analysis) => analysis.id === id))
        .filter((analysis): analysis is Analysis => Boolean(analysis));
      const lineageAnalysisIds = lineageAnalyses.map((analysis) => analysis.id);
      const supportingEvidence = hypothesis.evidenceIds
        .map((id) => EVIDENCE.find((record) => record.id === id))
        .filter((record): record is (typeof EVIDENCE)[number] => Boolean(record));
      if (supportingEvidence.length !== hypothesis.evidenceIds.length) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'One or more hypothesis evidence records are no longer available in the pinned catalog.', false, {
          required_evidence_ids: hypothesis.evidenceIds,
        });
      }
      const supportingSourceIds = [...new Set(supportingEvidence.flatMap((record) => record.sourceIds))];
      const supportingSources = supportingSourceIds
        .map((id) => SOURCES.find((record) => record.id === id))
        .filter((record): record is (typeof SOURCES)[number] => Boolean(record));
      if (supportingSources.length !== supportingSourceIds.length) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'One or more hypothesis-supporting source records are missing from the pinned catalog.', false, {
          required_source_ids: supportingSourceIds,
          resolved_source_ids: supportingSources.map((record) => record.id),
        });
      }
      const methodEvidence = circuit.evidenceIds
        .map((id) => EVIDENCE.find((record) => record.id === id))
        .filter((record): record is (typeof EVIDENCE)[number] => record !== undefined && record.role === 'model_context');
      if (!methodEvidence.length) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'The selected model has no linked method-context evidence record.', false, {
          required_evidence_role: 'model_context',
          circuit_id: circuit.id,
        });
      }
      const methodEvidenceIds = methodEvidence.map((record) => record.id);
      const methodSourceIds = [...new Set(methodEvidence.flatMap((record) => record.sourceIds))];
      const methodSources = methodSourceIds
        .map((id) => SOURCES.find((record) => record.id === id))
        .filter((record): record is (typeof SOURCES)[number] => Boolean(record));
      if (methodSources.length !== methodSourceIds.length) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'One or more model-method source records are missing from the pinned catalog.', false, {
          required_source_ids: methodSourceIds,
          resolved_source_ids: methodSources.map((record) => record.id),
        });
      }
      const claimedEvidenceIds = new Set([...hypothesis.evidenceIds, ...methodEvidenceIds]);
      const contextEvidence = circuit.evidenceIds
        .filter((id) => !claimedEvidenceIds.has(id))
        .map((id) => EVIDENCE.find((record) => record.id === id))
        .filter((record): record is (typeof EVIDENCE)[number] => Boolean(record));
      const expectedContextEvidenceIds = circuit.evidenceIds.filter((id) => !claimedEvidenceIds.has(id));
      if (contextEvidence.length !== expectedContextEvidenceIds.length) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'One or more circuit-context evidence records are missing from the pinned catalog.', false, {
          required_evidence_ids: expectedContextEvidenceIds,
          resolved_evidence_ids: contextEvidence.map((record) => record.id),
        });
      }
      const contextEvidenceIds = contextEvidence.map((record) => record.id);
      const contextSourceIds = uniqueStrings(contextEvidence.flatMap((record) => record.sourceIds));
      const contextSources = contextSourceIds
        .map((id) => SOURCES.find((record) => record.id === id))
        .filter((record): record is (typeof SOURCES)[number] => Boolean(record));
      if (contextSources.length !== contextSourceIds.length) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'One or more circuit-context source records are missing from the pinned catalog.', false, {
          required_source_ids: contextSourceIds,
          resolved_source_ids: contextSources.map((record) => record.id),
        });
      }
      const catalogSources = DATASET_MANIFEST_SOURCE_IDS
        .map((id) => SOURCES.find((source) => source.id === id))
        .filter((source): source is (typeof SOURCES)[number] => Boolean(source));
      if (catalogSources.length !== DATASET_MANIFEST_SOURCE_IDS.length) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'One or more dataset-manifest source records are missing from the pinned catalog.', false, {
          required_source_ids: DATASET_MANIFEST_SOURCE_IDS,
          resolved_source_ids: catalogSources.map((source) => source.id),
        });
      }
      if (bundleScope === 'mission' && !current.discoveryDecision) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'A mission bundle requires the persisted circuit-discovery decision.', false, {
          required_artifact: 'discovery_decision',
          recovery_tool: 'find_fly_circuits',
        });
      }
      const missionCandidateCircuitIds = bundleScope === 'mission'
        ? current.discoveryDecision?.candidates.map((candidate) => candidate.circuitId) ?? []
        : [];
      const missionCandidateCircuits = CIRCUITS.filter((candidate) => missionCandidateCircuitIds.includes(candidate.id)).map((candidate) => ({
        ...candidate,
        motor_map: motorMapForCircuit(candidate.id),
      }));
      const missionEvidenceIds = uniqueStrings(missionCandidateCircuits.flatMap((candidate) => candidate.evidenceIds));
      const missionEvidence = missionEvidenceIds
        .map((id) => EVIDENCE.find((record) => record.id === id))
        .filter((record): record is (typeof EVIDENCE)[number] => Boolean(record));
      const missionSourceIds = sourceIdsForEvidence(missionEvidenceIds);
      const missionSources = missionSourceIds
        .map((id) => SOURCES.find((source) => source.id === id))
        .filter((source): source is (typeof SOURCES)[number] => Boolean(source));
      if (missionEvidence.length !== missionEvidenceIds.length || missionSources.length !== missionSourceIds.length) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'The mission discovery artifact is not source-closed over every considered candidate.', false, {
          required_evidence_ids: missionEvidenceIds,
          resolved_evidence_ids: missionEvidence.map((record) => record.id),
          required_source_ids: missionSourceIds,
          resolved_source_ids: missionSources.map((source) => source.id),
        });
      }
      const systemTitle = evidenceBundleTitle(experiment.perturbation, hypothesis.predictedBehavior);
      const callerTitle = stringInput(input, 'title').trim();
      const callerNote = stringInput(input, 'note').trim();
      const annotation = callerTitle || callerNote ? {
        id: `annotation_${deterministicSha256Hex({ title: callerTitle, note: callerNote })}`,
        title: callerTitle,
        note: callerNote,
        author: 'caller_input' as const,
        trust: 'untrusted_annotation' as const,
        purpose: 'administrative_annotation_not_evidence' as const,
        boundary: 'Caller-entered title and note are untrusted administrative annotations, not scientific evidence or a validated biological claim.',
      } : null;
      const systemMetadata = {
        title: systemTitle,
        generated_by: 'flylab',
        purpose: 'display_and_filename_metadata',
        boundary: 'Deterministic system metadata derived from the selected perturbation and behavior; it is operational rather than scientific evidence.',
      };
      const modelSourceIds = ['SRC-FLYLAB-MODEL-CARD', 'SRC-FLYGYM-NM-2024', 'SRC-FLYGYM-CODE-V210'];
      const payloadProvenanceEntries: FlyLabProvenanceManifestEntry[] = [
        ...(bundleScope === 'mission' && current.discoveryDecision ? [
          provenanceEntry('/mission/discoveryDecision', current.discoveryDecision.id, 'discovery_decision', 'artifact', current.discoveryDecision.provenance, missionCandidateCircuitIds, missionEvidenceIds, missionSourceIds, current.discoveryDecision.coverageWarning),
          provenanceEntry('/mission/candidateCircuits', null, 'candidate_circuit_collection', 'container', ['derived'], [current.discoveryDecision.id], missionEvidenceIds, missionSourceIds, 'All circuits considered by the persisted discovery decision, including rejected alternatives and reduced-order motor-map boundaries.'),
          ...missionCandidateCircuits.flatMap((candidate, index) => [
            provenanceEntry(`/mission/candidateCircuits/${index}`, candidate.id, 'circuit', 'artifact', candidate.provenance, [current.discoveryDecision!.id], candidate.evidenceIds, sourceIdsForEvidence(candidate.evidenceIds), 'Derived circuit catalog record considered during mission discovery; not a biological measurement.'),
            ...(candidate.motor_map ? motorMapProvenanceEntries(candidate.motor_map, `/mission/candidateCircuits/${index}/motor_map`, [candidate.id, current.discoveryDecision!.id]) : []),
          ]),
          ...missionEvidence.map((record, index) => provenanceEntry(`/mission/evidence/${index}`, record.id, 'evidence_record', 'record', [record.provenance], missionCandidateCircuitIds.filter((id) => CIRCUITS.find((candidate) => candidate.id === id)?.evidenceIds.includes(record.id)), [], record.sourceIds, record.caution)),
          ...missionSources.map((source, index) => provenanceEntry(`/mission/sources/${index}`, source.id, 'source_record', 'record', ['derived'], missionEvidence.filter((record) => record.sourceIds.includes(source.id)).map((record) => record.id), [], [source.id], 'Citation and source metadata for candidate evidence; not itself biological evidence.')),
        ] : []),
        ...supportingSources.map((source, index) => provenanceEntry(`/supportingSources/${index}`, source.id, 'source_record', 'record', ['derived'], [], [], [source.id], 'Citation and source metadata; it does not itself reproduce the cited experiment.')),
        ...supportingEvidence.map((record, index) => provenanceEntry(`/supportingEvidence/${index}`, record.id, 'evidence_record', 'record', [record.provenance], [circuit.id], [], record.sourceIds, record.caution)),
        ...contextSources.map((source, index) => provenanceEntry(`/contextSources/${index}`, source.id, 'source_record', 'record', ['derived'], [], [], [source.id], 'Citation and source metadata retained as circuit context, not promoted to hypothesis support.')),
        ...contextEvidence.map((record, index) => provenanceEntry(`/contextEvidence/${index}`, record.id, 'evidence_record', 'record', [record.provenance], [circuit.id], [], record.sourceIds, `${record.caution} This record is contextual and is not promoted to hypothesis support in this bundle.`)),
        ...methodSources.map((source, index) => provenanceEntry(`/methodSources/${index}`, source.id, 'source_record', 'record', ['derived'], [], [], [source.id], 'Method-definition or embodiment-reference metadata; not a measured fly result.')),
        ...methodEvidence.map((record, index) => provenanceEntry(`/methodEvidence/${index}`, record.id, 'evidence_record', 'record', [record.provenance], [circuit.id], [], record.sourceIds, record.caution)),
        ...catalogSources.map((source, index) => provenanceEntry(`/catalogSources/${index}`, source.id, 'source_record', 'record', ['derived'], [DATASET_MANIFEST_ARTIFACT_ID], [], [source.id], 'Pinned dataset, software, or display-reference metadata. Inclusion does not promote this source to hypothesis support.')),
        provenanceEntry('/circuit', circuit.id, 'circuit', 'artifact', circuit.provenance, [], circuit.evidenceIds, sourceIdsForEvidence(circuit.evidenceIds), 'Derived source catalog entry; not neural activity or a biological measurement.'),
        provenanceEntry('/hypothesis', hypothesis.id, 'hypothesis', 'artifact', [hypothesis.provenance], [hypothesis.circuitId, ...hypothesis.evidenceIds], hypothesis.evidenceIds, supportingSourceIds, 'Agent-authored falsifiable proposal; not evidence.'),
        provenanceEntry('/experiment', experiment.id, 'experiment', 'artifact', experiment.provenance, [experiment.hypothesisId, experiment.targetCircuitId], hypothesis.evidenceIds, uniqueStrings([...supportingSourceIds, ...modelSourceIds]), 'Human-approved virtual protocol; activation level is a unitless model control, not a biological dose.'),
        provenanceEntry('/approval', approval.protocol_hash, 'experiment_approval', 'artifact', ['agent_hypothesized'], [approval.experiment_id], hypothesis.evidenceIds, supportingSourceIds, 'Visible human authorization for this exact virtual protocol and seed manifest; not scientific evidence or wet-lab approval.'),
        ...motorMapProvenanceEntries(experiment.motorMap, '/experiment/motorMap', [experiment.targetCircuitId, experiment.id]),
        provenanceEntry('/experiment/model', null, 'model_manifest', 'container', ['derived'], [experiment.id], methodEvidenceIds, methodSourceIds, MODEL_MANIFEST.boundary),
        provenanceEntry('/experiment/model/controllerMapping', null, 'controller_mapping', 'container', ['agent_hypothesized'], [experiment.id], methodEvidenceIds, methodSourceIds, MODEL_MANIFEST.controllerMapping.statement),
        provenanceEntry('/experiment/model/parameterization', null, 'hand_authored_model_parameterization', 'container', ['agent_hypothesized'], [experiment.id], methodEvidenceIds, ['SRC-FLYLAB-MODEL-CARD'], 'Hand-authored, uncalibrated constants and declared model-unit boundaries; not fitted biological measurements.'),
        provenanceEntry('/batch', batch.id, 'simulation_batch', 'artifact', batch.provenance, [batch.experimentId], hypothesis.evidenceIds, uniqueStrings([...supportingSourceIds, ...modelSourceIds]), batch.model.boundary),
        ...motorMapProvenanceEntries(batch.motorMap, '/batch/motorMap', [batch.targetCircuitId, batch.id]),
        provenanceEntry('/batch/protocol', null, 'approved_virtual_protocol_snapshot', 'container', ['agent_hypothesized'], [experiment.id, batch.id], hypothesis.evidenceIds, supportingSourceIds, 'Snapshot of the approved virtual protocol; not a wet-lab protocol.'),
        provenanceEntry('/batch/model', null, 'model_manifest', 'container', ['derived'], [batch.id], methodEvidenceIds, methodSourceIds, MODEL_MANIFEST.boundary),
        provenanceEntry('/batch/model/controllerMapping', null, 'controller_mapping', 'container', ['agent_hypothesized'], [batch.id], methodEvidenceIds, methodSourceIds, MODEL_MANIFEST.controllerMapping.statement),
        provenanceEntry('/batch/model/parameterization', null, 'hand_authored_model_parameterization', 'container', ['agent_hypothesized'], [batch.id], methodEvidenceIds, ['SRC-FLYLAB-MODEL-CARD'], 'Hand-authored, uncalibrated constants and declared model-unit boundaries; not fitted biological measurements.'),
        provenanceEntry('/batch/conditionRuns', null, 'simulation_run_collection', 'container', ['simulation_predicted'], [batch.id], hypothesis.evidenceIds, uniqueStrings([...supportingSourceIds, ...modelSourceIds]), 'Seeded model outputs; not measurements from animals.'),
        ...lineageAnalyses.map((analysis, index) => provenanceEntry(`/analyses/${index}`, analysis.id, 'behavior_analysis', 'artifact', analysis.provenance, [analysis.batchId], hypothesis.evidenceIds, uniqueStrings([...supportingSourceIds, ...modelSourceIds]), analysis.warning)),
        provenanceEntry('/comparison', comparison.id, 'trial_comparison', 'artifact', comparison.provenance, comparison.analysisIds, hypothesis.evidenceIds, uniqueStrings([...supportingSourceIds, ...modelSourceIds]), 'Ranking of simulation-derived analyses; not biological evidence.'),
        provenanceEntry('/comparison/proposal', comparison.proposal.id, 'follow_up_proposal', 'artifact', [comparison.proposal.provenance], [comparison.id], hypothesis.evidenceIds, supportingSourceIds, 'Proposal only; execution is not authorized.'),
        provenanceEntry('/datasets', DATASET_MANIFEST_ARTIFACT_ID, 'dataset_manifest', 'artifact', ['derived'], [], [], DATASET_MANIFEST_SOURCE_IDS, 'Pinned dataset, software-reference, and visual-reference metadata. Visual references are explicitly ineligible for hypothesis support.'),
        provenanceEntry('/model', null, 'model_manifest', 'container', ['derived'], [], methodEvidenceIds, methodSourceIds, MODEL_MANIFEST.boundary),
        provenanceEntry('/model/controllerMapping', null, 'controller_mapping', 'container', ['agent_hypothesized'], [], methodEvidenceIds, methodSourceIds, MODEL_MANIFEST.controllerMapping.statement),
        provenanceEntry('/model/parameterization', null, 'hand_authored_model_parameterization', 'container', ['agent_hypothesized'], [], methodEvidenceIds, ['SRC-FLYLAB-MODEL-CARD'], 'Hand-authored, uncalibrated constants and declared model-unit boundaries; not fitted biological measurements.'),
      ];
      const payload = {
        format: bundleScope === 'mission'
          ? 'flylab.mission-evidence-bundle.v3'
          : 'flylab.experiment-evidence-bundle.v3',
        scope: bundleScope,
        mission: bundleScope === 'mission' ? {
          goal: current.goal,
          discoveryDecision: current.discoveryDecision,
          candidateCircuits: missionCandidateCircuits,
          evidence: missionEvidence,
          sources: missionSources,
          boundary: 'The mission goal is untrusted caller input retained for reproducibility; it is not scientific evidence.',
        } : null,
        systemMetadata,
        annotation,
        supportingSources,
        supportingEvidence,
        contextSources,
        contextEvidence,
        methodSources,
        methodEvidence,
        catalogSources,
        circuit,
        hypothesis,
        experiment,
        approval,
        batch,
        analyses: lineageAnalyses,
        comparison,
        datasets: DATASET_MANIFEST,
        model: MODEL_MANIFEST,
        provenanceManifest: {
          schema_version: 'flylab.provenance-manifest.v1',
          path_scope: 'JSON Pointer paths relative to this payload; each entry labels its complete subtree unless a narrower entry overrides it.',
          entries: payloadProvenanceEntries,
          operational_paths: [
            '/scope',
            ...(bundleScope === 'mission' ? ['/mission/goal', '/mission/boundary', '/mission/discoveryDecision/missionGoal', '/mission/discoveryDecision/search'] : []),
            '/systemMetadata',
            '/annotation',
            '/experiment/approved',
            '/approval/approved_at',
            '/approval/protocol_hash',
            '/approval/seed_manifest_hash',
            '/batch/status',
            '/provenanceManifest',
          ],
          untrusted_annotation_boundary: annotation?.boundary ?? 'No caller-supplied administrative annotation was included.',
        },
      };
      if (activeEvidenceSaveControllerRef.current) {
        throw new FlyLabDomainError('SIMULATION_UNAVAILABLE', 'An evidence bundle is already being prepared.', true);
      }
      const saveController = new AbortController();
      activeEvidenceSaveControllerRef.current = saveController;
      const saveSignal = AbortSignal.any([signal, saveController.signal]);
      setEvidenceSaveRunning(true);
      const savingState = commit((state) => pushActivity({ ...state, stage: state.bundle ? state.stage : 'continue' }, {
        title: 'Evidence bundle preparing',
        detail: `Hashing the exact ${comparison.analysisIds.length}-analysis comparison lineage for ${experiment.id}.`,
        status: 'running',
        actor,
        toolName: 'save_fly_evidence',
      }));
      const expectedRevision = savingState.revision;
      setNotice('Preparing the exact evidence lineage. A stale shared revision cannot commit.');
      let completed: { bundle: EvidenceBundleMetadata; evidenceExport: EvidenceExportEnvelope; stateRevision: number };
      try {
        completed = await prepareCancellableCommit({
          signal: saveSignal,
          cancellationRequested: () => chromeCancellationRequestedRef.current.has(saveController),
          prepare: async () => {
            await waitFor(320, saveSignal);
            const manifestHash = await sha256(payload);
            if (current.bundle?.manifestHash === manifestHash && current.evidenceExport) {
              return {
                bundle: current.bundle,
                evidenceExport: current.evidenceExport,
                serializedExport: serializeEvidenceExport(current.evidenceExport),
                reused: true,
              };
            }
            const provenanceSets: Record<ProvenanceLabel, Set<string>> = {
              measured: new Set(),
              derived: new Set(),
              connectome_inferred: new Set(),
              simulation_predicted: new Set(),
              agent_hypothesized: new Set(),
            };
            const indexProvenance = (id: string, labels: readonly ProvenanceLabel[]) => labels.forEach((label) => provenanceSets[label].add(id));
            missionSources.forEach((source) => indexProvenance(source.id, ['derived']));
            missionEvidence.forEach((record) => indexProvenance(record.id, [record.provenance]));
            missionCandidateCircuits.forEach((candidate) => {
              indexProvenance(candidate.id, candidate.provenance);
              if (candidate.motor_map) {
                indexProvenance(candidate.motor_map.id, ['derived']);
                [...candidate.motor_map.nodes, ...candidate.motor_map.edges].forEach((item) => indexProvenance(item.id, [item.provenance]));
              }
            });
            if (bundleScope === 'mission' && current.discoveryDecision) indexProvenance(current.discoveryDecision.id, current.discoveryDecision.provenance);
            [...supportingSources, ...contextSources, ...methodSources, ...catalogSources].forEach((source) => indexProvenance(source.id, ['derived']));
            [...supportingEvidence, ...contextEvidence, ...methodEvidence].forEach((record) => indexProvenance(record.id, [record.provenance]));
            indexProvenance(circuit.id, circuit.provenance);
            indexProvenance(hypothesis.id, [hypothesis.provenance]);
            indexProvenance(experiment.id, experiment.provenance);
            indexProvenance(approval.protocol_hash, ['agent_hypothesized']);
            indexProvenance(approval.seed_manifest_hash, ['agent_hypothesized']);
            experiment.conditions.forEach((condition) => indexProvenance(condition.id, experiment.provenance));
            indexProvenance(experiment.motorMap.id, ['derived']);
            [...experiment.motorMap.nodes, ...experiment.motorMap.edges].forEach((item) => indexProvenance(item.id, [item.provenance]));
            indexProvenance(batch.id, batch.provenance);
            batch.conditionRuns.flatMap((run) => run.runIds).forEach((id) => indexProvenance(id, batch.provenance));
            batch.conditionRuns.forEach((run) => {
              indexProvenance(run.trajectoryId, batch.provenance);
              run.replicates.forEach((replicate) => indexProvenance(replicate.trajectoryId, replicate.provenance));
            });
            lineageAnalyses.forEach((record) => indexProvenance(record.id, record.provenance));
            indexProvenance(comparison.id, comparison.provenance);
            indexProvenance(comparison.proposal.id, [comparison.proposal.provenance]);
            indexProvenance(DATASET_MANIFEST_ARTIFACT_ID, ['derived']);
            const bundleId = `evidence_${deterministicSha256Hex({ manifestHash })}`;
            indexProvenance(bundleId, ['derived']);
            const provenanceIndex = Object.fromEntries(
              (Object.entries(provenanceSets) as Array<[ProvenanceLabel, Set<string>]>).map(([label, ids]) => [label, [...ids].sort()]),
            ) as Record<ProvenanceLabel, string[]>;
            const provenanceCounts = Object.fromEntries(
              (Object.entries(provenanceIndex) as Array<[ProvenanceLabel, string[]]>).map(([label, ids]) => [label, ids.length]),
            ) as Record<ProvenanceLabel, number>;
            const allEvidence = [...new Map([
              ...missionEvidence,
              ...supportingEvidence,
              ...contextEvidence,
              ...methodEvidence,
            ].map((record) => [record.id, record])).values()];
            const baseLineageEdges = [
              ...allEvidence.flatMap((record) => record.sourceIds.map((sourceId) => ({ from: record.id, relation: 'supported_by', to: sourceId }))),
              ...DATASET_MANIFEST_SOURCE_IDS.map((sourceId) => ({ from: DATASET_MANIFEST_ARTIFACT_ID, relation: 'catalogs_source', to: sourceId })),
              ...(bundleScope === 'mission' && current.discoveryDecision ? [
                ...(current.discoveryDecision.selectedCircuitId ? [{ from: current.discoveryDecision.id, relation: 'recommends', to: current.discoveryDecision.selectedCircuitId }] : []),
                ...current.discoveryDecision.candidates.map((candidate) => ({ from: current.discoveryDecision!.id, relation: 'considered_circuit', to: candidate.circuitId })),
                ...current.discoveryDecision.rejectedAlternatives.map((candidate) => ({ from: current.discoveryDecision!.id, relation: 'rejected_alternative', to: candidate.circuitId })),
                ...missionEvidenceIds.map((evidenceId) => ({ from: current.discoveryDecision!.id, relation: 'considered_evidence', to: evidenceId })),
                ...missionCandidateCircuits.flatMap((candidate) => candidate.evidenceIds.map((evidenceId) => ({ from: candidate.id, relation: 'catalogs_evidence', to: evidenceId }))),
                ...missionCandidateCircuits.flatMap((candidate) => candidate.motor_map ? [
                  { from: candidate.id, relation: 'maps_to_motor_map', to: candidate.motor_map.id },
                  ...[...candidate.motor_map.nodes, ...candidate.motor_map.edges].map((item) => ({ from: candidate.motor_map!.id, relation: 'contains_mapped_element', to: item.id })),
                ] : []),
              ] : []),
              ...circuit.evidenceIds.map((evidenceId) => ({ from: circuit.id, relation: 'catalogs_evidence', to: evidenceId })),
              { from: hypothesis.id, relation: 'targets_circuit', to: circuit.id },
              ...hypothesis.evidenceIds.map((evidenceId) => ({ from: hypothesis.id, relation: 'cites_hypothesis_support', to: evidenceId })),
              { from: experiment.id, relation: 'tests_hypothesis', to: hypothesis.id },
              { from: experiment.id, relation: 'targets_circuit', to: circuit.id },
              { from: experiment.id, relation: 'uses_motor_map', to: experiment.motorMap.id },
              { from: approval.protocol_hash, relation: 'authorizes_exact_experiment', to: experiment.id },
              { from: approval.protocol_hash, relation: 'commits_seed_manifest', to: approval.seed_manifest_hash },
              ...[...experiment.motorMap.nodes, ...experiment.motorMap.edges].map((item) => ({ from: experiment.motorMap.id, relation: 'contains_mapped_element', to: item.id })),
              ...experiment.conditions.map((condition) => ({ from: experiment.id, relation: 'has_condition', to: condition.id })),
              { from: batch.id, relation: 'executes_experiment', to: experiment.id },
              { from: batch.id, relation: 'uses_motor_map', to: batch.motorMap.id },
              ...batch.conditionRuns.flatMap((run) => run.runIds.map((runId) => ({ from: batch.id, relation: `contains_run_for:${run.conditionId}`, to: runId }))),
              ...batch.conditionRuns.flatMap((run) => run.replicates.map((replicate) => ({ from: replicate.id, relation: 'has_per_run_trajectory', to: replicate.trajectoryId }))),
              ...batch.conditionRuns.map((run) => ({ from: batch.id, relation: `has_illustrative_replay_for:${run.conditionId}`, to: run.trajectoryId })),
              ...lineageAnalyses.map((analysis) => ({ from: analysis.id, relation: 'analyzes_batch', to: batch.id })),
              ...comparison.analysisIds.map((analysisId) => ({ from: comparison.id, relation: 'compares_analysis', to: analysisId })),
              { from: comparison.proposal.id, relation: 'proposed_from_comparison', to: comparison.id },
            ];
            const includedIds = uniqueStrings([
              ...missionSourceIds,
              ...missionEvidenceIds,
              ...(bundleScope === 'mission' && current.discoveryDecision ? [current.discoveryDecision.id] : []),
              ...missionCandidateCircuits.flatMap((candidate) => [
                candidate.id,
                ...(candidate.motor_map ? [
                  candidate.motor_map.id,
                  ...candidate.motor_map.nodes.map((node) => node.id),
                  ...candidate.motor_map.edges.map((edge) => edge.id),
                ] : []),
              ]),
              ...supportingSourceIds,
              ...contextSourceIds,
              ...methodSourceIds,
              ...DATASET_MANIFEST_SOURCE_IDS,
              DATASET_MANIFEST_ARTIFACT_ID,
              ...hypothesis.evidenceIds,
              ...contextEvidenceIds,
              ...methodEvidenceIds,
              circuit.id,
              hypothesisId,
              experimentId,
              approval.protocol_hash,
              approval.seed_manifest_hash,
              experiment.motorMap.id,
              ...experiment.motorMap.nodes.map((node) => node.id),
              ...experiment.motorMap.edges.map((edge) => edge.id),
              ...experiment.conditions.map((condition) => condition.id),
              batch.id,
              ...batch.conditionRuns.flatMap((run) => run.runIds),
              ...batch.conditionRuns.flatMap((run) => run.replicates.map((replicate) => replicate.trajectoryId)),
              ...batch.conditionRuns.map((run) => run.trajectoryId),
              ...lineageAnalysisIds,
              comparison.id,
              comparison.proposal.id,
              ...(annotation ? [annotation.id] : []),
            ]);
            const uniqueBaseLineageEdges = [...new Map(baseLineageEdges.map((edge) => [
              `${edge.from}\u0000${edge.relation}\u0000${edge.to}`,
              edge,
            ])).values()];
            const lineageEdges = [
              ...uniqueBaseLineageEdges,
              ...includedIds
                .filter((id) => id !== annotation?.id && id !== bundleId)
                .map((id) => ({ from: bundleId, relation: 'includes', to: id })),
            ];
            const bundle: EvidenceBundleMetadata = {
              id: bundleId,
              scope: bundleScope,
              title: systemTitle,
              manifestHash,
              savedAt: new Date().toISOString(),
              includedIds,
              supportingEvidenceIds: hypothesis.evidenceIds,
              supportingSourceIds,
              contextEvidenceIds,
              contextSourceIds,
              methodEvidenceIds,
              methodSourceIds,
              catalogSourceIds: [...DATASET_MANIFEST_SOURCE_IDS],
              provenanceCounts,
              provenanceIndex,
              lineageEdges,
              boundary: 'Simulation evidence bundle; not a new biological experiment.',
              provenance: ['derived'],
              annotation,
            };
            const evidenceExport = createEvidenceExportEnvelope(bundle, payload);
            return { bundle, evidenceExport, serializedExport: serializeEvidenceExport(evidenceExport), reused: false };
          },
          commit: ({ bundle, evidenceExport, serializedExport, reused }) => {
            requireCurrentStateRevision(expectedRevision, labRef.current.revision, {
              expected_comparison_id: comparison.id,
              actual_comparison_id: labRef.current.comparison?.id ?? null,
            });
            try { localStorage.setItem(`flylab:${bundle.id}`, serializedExport); } catch { /* local persistence is best effort */ }
            const next = commit((state) => pushActivity({ ...state, stage: 'saved', bundle, evidenceExport }, {
              title: reused ? 'Evidence bundle already current' : 'Evidence bundle saved',
              detail: reused
                ? `${bundle.id} already matches this exact payload; its stable metadata was reused.`
                : `${bundle.id} · portable JSON ready in the evidence ledger.`,
              status: 'complete',
              actor,
              toolName: 'save_fly_evidence',
              createdArtifactIds: reused ? [] : [bundle.id],
            }));
            setSelectedEvidenceId(bundle.id);
            setNotice('Evidence bundle saved. Download the portable JSON from the evidence ledger.');
            return { bundle, evidenceExport, stateRevision: next.revision };
          },
        });
      } catch (error) {
        const cancelled = saveSignal.aborted || chromeCancellationRequestedRef.current.has(saveController);
        commit((state) => pushActivity(state, {
          title: cancelled ? 'Evidence save cancelled' : 'Evidence save failed safely',
          detail: cancelled ? 'No evidence bundle or local-storage record was committed.' : 'Prepared evidence was not published. Inspect the current revision before retrying.',
          status: cancelled ? 'cancelled' : 'failed',
          actor,
          toolName: 'save_fly_evidence',
        }));
        setNotice(cancelled ? 'Evidence save cancelled. No bundle was committed.' : 'Evidence save did not commit. Inspect the shared state before continuing.');
        throw error;
      } finally {
        chromeCancellationRequestedRef.current.delete(saveController);
        if (activeEvidenceSaveControllerRef.current === saveController) {
          activeEvidenceSaveControllerRef.current = null;
        }
        setEvidenceSaveRunning(false);
      }
      const result: ToolActionResult = {
        summary: 'Saved a manifest-hashed, provenance-rich FlyLab evidence snapshot.',
        data: {
          bundle: completed.bundle,
          evidence_export: completed.evidenceExport,
          export_media_type: EVIDENCE_EXPORT_MEDIA_TYPE,
          export_filename: evidenceExportFilename(completed.bundle.id),
          local_reference: completed.bundle.id,
          storage_scope: 'best-effort browser origin',
          next_action: getAgentContext(labRef.current).next_action,
        },
        provenance: (Object.entries(completed.bundle.provenanceCounts) as Array<[ProvenanceLabel, number]>)
          .filter(([, count]) => count > 0)
          .map(([kind]) => kind),
        provenanceManifest: {
          entries: [
            provenanceEntry(
              '/bundle',
              completed.bundle.id,
              'evidence_bundle',
              'artifact',
              completed.bundle.provenance,
              completed.bundle.includedIds,
              uniqueStrings([
                ...completed.bundle.supportingEvidenceIds,
                ...completed.bundle.contextEvidenceIds,
                ...completed.bundle.methodEvidenceIds,
              ]),
              uniqueStrings([
                ...completed.bundle.supportingSourceIds,
                ...completed.bundle.contextSourceIds,
                ...completed.bundle.methodSourceIds,
                ...completed.bundle.catalogSourceIds,
              ]),
              completed.bundle.boundary,
            ),
            ...payloadProvenanceEntries.map((entry) => ({
              ...entry,
              path: `/evidence_export/payload${entry.path}`,
            })),
          ],
          operationalPaths: [
            '/bundle/scope',
            '/bundle/title',
            '/bundle/annotation',
            '/evidence_export/schema',
            '/evidence_export/schemaVersion',
            '/evidence_export/bundle',
            '/evidence_export/integrity',
            '/evidence_export/payload/annotation',
            '/evidence_export/payload/experiment/approved',
            '/evidence_export/payload/approval/approved_at',
            '/evidence_export/payload/approval/protocol_hash',
            '/evidence_export/payload/approval/seed_manifest_hash',
            '/evidence_export/payload/batch/status',
            '/evidence_export/payload/provenanceManifest',
            '/export_media_type',
            '/export_filename',
            '/local_reference',
            '/storage_scope',
            '/next_action',
          ],
        },
        stateRevision: completed.stateRevision,
        previousStateRevision: current.revision,
        createdArtifactIds: current.bundle?.id === completed.bundle.id ? [] : [completed.bundle.id],
        idempotentReplay: false,
        operationId,
        verification: {
          selector: '#flylab-agent-context',
          description: 'Confirm the bundle ID and manifest hash in the live artifact manifest, then open the evidence ledger for its portable export.',
        },
      };
      completedOperationsRef.current.set(operationKey, { canonicalInput, result });
      return result;
    },
  }), [commit, getAgentContext, pushActivity]);

  useEffect(() => {
    const nonce = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replaceAll('-', '')
      : stableHash({ startedAt: Date.now(), random: Math.random() });
    const sessionId = `session_${nonce.slice(0, 16)}`;
    pageSessionIdRef.current = sessionId;
    // Browser-only session identity must exist before WebMCP registration; it cannot be safely server-rendered.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageSessionId(sessionId);
  }, []);

  useEffect(() => {
    if (lab.revision <= initialState.revision) return undefined;
    const protectPageScopedWork = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectPageScopedWork);
    return () => window.removeEventListener('beforeunload', protectPageScopedWork);
  }, [lab.revision]);

  useEffect(() => {
    if (!pageSessionId) return undefined;
    let disposed = false;
    let registration: Awaited<ReturnType<typeof installFlyLabWebMCP>> | null = null;
    installFlyLabWebMCP(actions, {
      onToolInvocation: () => setWebmcpInvocationObserved(true),
      getRuntimeMetadata: () => ({
        pageSessionId: pageSessionIdRef.current,
        stateRevision: labRef.current.revision,
      }),
    }).then((result) => {
      if (disposed) {
        result.dispose();
        return;
      }
      registration = result;
      setWebmcpDiagnostic(result.diagnostic);
      setWebmcpStatus(result.supported ? 'active' : 'unsupported');
    }).catch((error) => {
      console.error('FlyLab WebMCP registration failed', error);
      if (!disposed) {
        const detail = error instanceof Error ? error.message : 'WebMCP registration failed with an unknown browser error.';
        setWebmcpDiagnostic(diagnosticFromWebMCPError(error) ?? {
          ...detectFlyLabWebMCPRuntime(),
          registration_attempted: true,
          registration_error_name: error instanceof Error ? error.name || 'Error' : 'NonErrorThrow',
          registration_error: detail,
          availability_reason: 'registration_failed',
        });
        setWebmcpStatus('failed');
      }
    });
    return () => {
      disposed = true;
      registration?.dispose();
    };
  }, [actions, pageSessionId, webmcpDetectionAttempt]);

  useEffect(() => {
    const cancelWebMCPTool = (event: Event) => {
      const toolName = (event as Event & { toolName?: unknown }).toolName;
      const controller = toolName === 'run_fly_simulation'
        ? activeSimulationControllerRef.current
        : toolName === 'save_fly_evidence'
          ? activeEvidenceSaveControllerRef.current
          : null;
      if (!controller) return;
      chromeCancellationRequestedRef.current.add(controller);
      // Chrome 151 dispatches this event from inside CancelTool. Defer the
      // abort so Chrome can remove its pending invocation without re-entrant
      // promise settlement changing cancelInvocation's protocol result.
      window.setTimeout(() => {
        if (activeSimulationControllerRef.current === controller || activeEvidenceSaveControllerRef.current === controller) {
          controller.abort(new DOMException(`WebMCP ${String(toolName)} invocation cancelled`, 'AbortError'));
        }
      }, 0);
    };
    // Chrome 151 dispatches `toolcancel`; the evolving draft tracks the
    // equivalent future event as `toolcanceled` while execution signals land.
    window.addEventListener('toolcancel', cancelWebMCPTool);
    window.addEventListener('toolcanceled', cancelWebMCPTool);
    return () => {
      window.removeEventListener('toolcancel', cancelWebMCPTool);
      window.removeEventListener('toolcanceled', cancelWebMCPTool);
    };
  }, []);

  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  const playbackDurationMs = lab.batch?.protocol.trialDurationMs ?? lab.experiment?.trialDurationMs ?? 5000;

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now() - playheadRef.current * playbackDurationMs;
    const timer = window.setInterval(() => {
      const next = (performance.now() - startedAt) / playbackDurationMs;
      if (next >= 1) {
        setPlayhead(1);
        setPlaying(false);
      } else {
        setPlayhead(next);
      }
    }, 40);
    return () => window.clearInterval(timer);
  }, [playing, playbackDurationMs]);

  const invoke = useCallback(async (name: string, input: Record<string, unknown>, actor: FlyLabActionActor = 'human_ui') => {
    const controller = new AbortController();
    try {
      const mutationContext = name === 'inspect_flylab_state' ? {} : {
        page_session_id: pageSessionIdRef.current,
        expected_state_revision: labRef.current.revision,
      };
      const operationContext = (name === 'run_fly_simulation' || name === 'save_fly_evidence')
        ? {
          operation_id: input.operation_id ?? `${actor}_${name}_${typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`,
        }
        : {};
      const validatedInput = validateToolInput(name, { ...input, ...mutationContext, ...operationContext });
      return await actions[name](validatedInput, { signal: controller.signal, actor });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The action could not complete.');
      return null;
    }
  }, [actions]);

  const investigate = useCallback(async () => {
    const found = await invoke('find_fly_circuits', {
      query: labRef.current.goal,
      behavior: 'any',
      evidence_labels: ['measured', 'derived', 'connectome_inferred'],
      limit: 5,
    }, 'guided_example');
    if (!found) return;
    const hypothesisResult = await invoke('draft_fly_hypothesis', {
      circuit_id: 'circuit_gf_adult',
      claim: 'In FlyLab, bilateral giant-fiber model drive will increase predicted short-mode escape relative to baseline and model-sham conditions.',
      predicted_behavior: 'short_mode_escape',
      perturbation: 'activate',
      primary_outcome: 'short_mode_escape_probability',
      expected_direction: 'increase',
      controls: ['condition_baseline', 'condition_sham'],
      evidence_ids: ['E-GF-CAUSAL-010', 'E-GF-PATH-011', 'E-FANC-ESCAPE-012'],
      evidence_limitations: [
        'The cited assays do not calibrate the reduced-order FlyLab effect size.',
        'The mapped brain-to-leg-and-wing controller is a model assumption rather than a measured transfer function.',
      ],
      falsification_criterion: 'The model shows no increase in short-mode escape probability relative to both controls.',
    }, 'guided_example');
    if (!hypothesisResult || !labRef.current.hypothesis) return;
    await invoke('design_stimulation_trial', {
      hypothesis_id: labRef.current.hypothesis.id,
      target_circuit_id: 'circuit_gf_adult',
      perturbation: 'activate',
      laterality: 'bilateral',
      activation_level: 0.75,
      onset_ms: 500,
      duration_ms: 900,
      trial_duration_ms: 3000,
      replicates: 8,
      include_baseline: true,
      include_sham_control: true,
      seed: 91827,
    }, 'guided_example');
  }, [invoke]);

  const approveExperiment = useCallback(async () => {
    const source = labRef.current.experiment;
    if (!source || approvalPreparing) return;
    setApprovalPreparing(true);
    setNotice('Committing the exact visible protocol and complete seed manifest…');
    try {
      const approval = await createExperimentApproval(source, new Date());
      const currentExperiment = labRef.current.experiment;
      if (!currentExperiment
        || currentExperiment.id !== source.id
        || !(await verifyExperimentApproval(approval, currentExperiment))) {
        setNotice('The protocol changed before approval completed. Review the current draft and approve it again.');
        return;
      }
      const next = commit((current) => {
        if (!current.experiment || current.experiment.id !== source.id) return current;
        return pushActivity({
          ...current,
          stage: 'run',
          experiment: { ...current.experiment, approved: true },
          approval,
        }, {
          title: 'Exact protocol approved by human',
          detail: `${approval.protocol_hash} · seed manifest ${approval.seed_manifest_hash}`,
          status: 'complete',
          actor: 'human_ui',
          createdArtifactIds: [approval.protocol_hash, approval.seed_manifest_hash],
        });
      });
      if (next.approval?.protocol_hash === approval.protocol_hash) {
        setNotice('Approved. The simulation tool is bound to the displayed protocol hash and seed manifest.');
      }
      return next;
    } catch (error) {
      setNotice(error instanceof Error ? `Approval could not be committed: ${error.message}` : 'Approval could not be committed.');
      return undefined;
    } finally {
      setApprovalPreparing(false);
    }
  }, [approvalPreparing, commit, pushActivity]);

  const runExperiment = useCallback(async () => {
    const experiment = labRef.current.experiment;
    const approval = labRef.current.approval;
    if (!experiment || !approval) return;
    await invoke('run_fly_simulation', {
      experiment_id: experiment.id,
      approved_protocol_hash: approval.protocol_hash,
    });
  }, [invoke]);

  const cancelRunningSimulation = useCallback(() => {
    activeSimulationControllerRef.current?.abort(
      new DOMException('Simulation cancelled by human', 'AbortError'),
    );
  }, []);

  const analyzeExperiment = useCallback(async () => {
    const batch = labRef.current.batch;
    if (!batch) return;
    await invoke('analyze_fly_behavior', {
      batch_id: batch.id,
      metrics: metricsForCircuit(batch.targetCircuitId),
    });
  }, [invoke]);

  const compareExperiment = useCallback(async () => {
    const analysis = labRef.current.analyses[0];
    if (!analysis) return;
    const circuitId = labRef.current.batch?.targetCircuitId ?? 'circuit_mdn_adult';
    const objectiveMetric = metricsForCircuit(circuitId)[0];
    await invoke('compare_fly_trials', {
      analysis_ids: [analysis.id],
      objective_metric: objectiveMetric,
      objective: 'maximize',
    });
  }, [invoke]);

  const saveEvidence = useCallback(async () => {
    const current = labRef.current;
    if (!current.hypothesis || !current.experiment || !current.batch || !current.analyses.length || !current.comparison) return;
    await invoke('save_fly_evidence', {
      scope: 'mission',
      hypothesis_id: current.hypothesis.id,
      experiment_id: current.experiment.id,
      batch_ids: [current.batch.id],
      analysis_ids: current.comparison.analysisIds,
      comparison_id: current.comparison.id,
    });
  }, [invoke]);

  const agentContext = buildFlyLabAgentContext(agentSnapshot(lab, simulationRunning, evidenceSaveRunning));
  const agentHandoff = buildFlyLabAgentHandoff(
    agentContext,
    webmcpStatus,
    webmcpDiagnostic,
    webmcpInvocationObserved,
    pageSessionId,
  );
  const agentRuntime = agentHandoff.transport;
  const pageToolsRegistered = agentRuntime.page_invocation_handler_available;
  const agentBrief = JSON.stringify(agentHandoff, null, 2);

  const copyAgentBrief = async () => {
    try {
      await navigator.clipboard.writeText(agentBrief);
      setNotice('Versioned JSON recovery packet copied. It is scoped to this open FlyLab page.');
    } catch {
      if (runtimeDiagnosticRef.current) {
        runtimeDiagnosticRef.current.open = true;
        runtimeDiagnosticRef.current.scrollIntoView({ block: 'nearest' });
      }
      setNotice('Clipboard access was unavailable. Select the visible recovery packet in Runtime diagnostic.');
    }
  };

  const downloadEvidence = useCallback(() => {
    const current = labRef.current;
    if (!current.bundle || !current.evidenceExport) {
      setNotice('Save an evidence bundle before downloading it.');
      return;
    }
    const objectUrl = URL.createObjectURL(new Blob(
      [serializeEvidenceExport(current.evidenceExport)],
      { type: EVIDENCE_EXPORT_MEDIA_TYPE },
    ));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = evidenceExportFilename(current.bundle.id);
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    setNotice(`Download requested for ${link.download}. If the browser blocked it, use Copy bundle JSON.`);
  }, []);

  const copyEvidence = useCallback(async () => {
    const current = labRef.current;
    if (!current.evidenceExport) {
      setNotice('Save an evidence bundle before copying it.');
      return;
    }
    try {
      await navigator.clipboard.writeText(serializeEvidenceExport(current.evidenceExport));
      setNotice('Complete bundle JSON copied, including the payload manifest hash.');
    } catch {
      setNotice('Clipboard access was blocked. Expand Select bundle JSON manually in the evidence ledger.');
    }
  }, []);

  const editExperiment = useCallback((field: 'activationLevel' | 'durationMs' | 'replicates', value: number) => {
    commit((current) => {
      if (!current.experiment) return current;
      const source = current.experiment;
      const updated = reviseExperiment(source, field, value);
      return pushActivity({ ...current, stage: 'design', experiment: updated, approval: null, batch: null, analyses: [], comparison: null, bundle: null, evidenceExport: null }, {
        title: 'Human edited protocol',
        detail: `${field} updated; prior approval and downstream runs were cleared.`,
        status: 'waiting',
        actor: 'human_ui',
      });
    });
    setNotice('Protocol changed. Review and approve the revised experiment before running.');
  }, [commit, pushActivity]);

  const changeNextTrialBudget = useCallback((value: number) => {
    commit((current) => {
      if (current.nextTrialBudget === value) return current;
      return pushActivity({
        ...current,
        stage: current.analyses.length ? 'continue' : current.stage,
        nextTrialBudget: value,
        comparison: null,
        bundle: null,
        evidenceExport: null,
      }, {
        title: 'Human changed follow-up budget',
        detail: `Next proposal is bounded to ${value} replicates; prior comparison and saved bundle were cleared.`,
        status: 'waiting',
        actor: 'human_ui',
      });
    });
    setNotice('Follow-up budget changed. Re-run comparison before saving evidence.');
  }, [commit, pushActivity]);

  const primaryAction = useMemo(() => {
    if (simulationRunning) return { label: 'Cancel running simulation', action: cancelRunningSimulation, detail: 'discard prepared work · keep protocol approved' };
    if (!lab.hypothesis || !lab.experiment) return { label: 'Start manual recovery walkthrough', action: investigate, detail: 'fallback using the same validated actions' };
    if (!lab.experiment.approved || !lab.approval) return {
      label: 'Review exact protocol',
      action: () => document.getElementById('protocol-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      detail: `approval is beside all ${lab.experiment.conditions.length} arms and exact identifiers`,
    };
    if (!lab.batch) return { label: `Run ${CIRCUITS.find((record) => record.id === lab.experiment?.targetCircuitId)?.abbreviation ?? 'mapped circuit'} ${lab.experiment.perturbation === 'silence' ? 'suppression' : 'drive'}`, action: runExperiment, detail: `seed ${lab.experiment.seed.toLocaleString()}` };
    if (!lab.analyses.length) return { label: 'Analyze behavior', action: analyzeExperiment, detail: `${metricsForCircuit(lab.experiment.targetCircuitId).length} motor-map metrics` };
    if (!lab.comparison) return { label: 'Compare conditions and propose follow-up', action: compareExperiment, detail: `next-experiment replicate budget: ${lab.nextTrialBudget}` };
    if (!lab.bundle) return { label: 'Save evidence bundle', action: saveEvidence, detail: 'sources · assumptions · seeds · results' };
    return { label: 'Replay representative trial', action: () => { setPlayhead(0); setPlaying(true); }, detail: lab.bundle.id };
  }, [analyzeExperiment, cancelRunningSimulation, compareExperiment, investigate, lab, runExperiment, saveEvidence, simulationRunning]);

  const activeCondition = useMemo(() => {
    const run = lab.batch?.conditionRuns.find((condition) => condition.conditionId === selectedConditionId);
    return run ?? lab.batch?.conditionRuns[0] ?? null;
  }, [lab.batch, selectedConditionId]);

  const selectedCondition = useMemo(() => (
    lab.experiment?.conditions.find((condition) => condition.id === selectedConditionId)
    ?? lab.experiment?.conditions[0]
    ?? null
  ), [lab.experiment, selectedConditionId]);

  const activePoint = useMemo(() => {
    if (!activeCondition?.trajectory.length) return null;
    return activeCondition.trajectory[Math.min(activeCondition.trajectory.length - 1, Math.floor(playhead * (activeCondition.trajectory.length - 1)))];
  }, [activeCondition, playhead]);

  const selectedBundle = lab.bundle?.id === selectedEvidenceId ? lab.bundle : null;
  const selectedCircuit = CIRCUITS.find((record) => record.id === lab.selectedCircuitId) ?? null;
  const selectedEvidence = EVIDENCE.find((record) => record.id === selectedEvidenceId) ?? (selectedBundle ? null : EVIDENCE[0]);
  const selectedSources = selectedEvidence ? SOURCES.filter((source) => selectedEvidence.sourceIds.includes(source.id)) : [];
  const comparisonAnalysisId = lab.comparison?.analysisIds[0];
  const analysis = (comparisonAnalysisId
    ? lab.analyses.find((item) => item.id === comparisonAnalysisId)
    : lab.analyses.at(-1)) ?? null;
  const primaryConditionId = lab.experiment ? `condition_${lab.experiment.primaryLaterality}` : null;
  const bestResult = analysis?.conditions.find((condition) => condition.conditionId === selectedConditionId)
    ?? analysis?.conditions.find((condition) => condition.conditionId === primaryConditionId)
    ?? analysis?.conditions[0]
    ?? null;
  const siteToolStatus = {
    checking: 'checking site tools',
    active: 'Site Tools connected · 8/8',
    unsupported: '0 tools · browser API absent',
    failed: '0 tools · registration failed',
  }[webmcpStatus];
  const formatCapability = (value: boolean | null) => value === null ? 'not exposed' : value ? 'yes' : 'no';
  const agentNextDisplay = agentContext.next_tool
    ?? (agentContext.next_action.blocked_by ? `blocked · ${agentContext.next_action.blocked_by}` : agentContext.agent_status);
  const humanGate = !lab.experiment
    ? 'not applicable · required after design'
    : lab.experiment.approved && lab.approval
      ? `approved · ${lab.approval.protocol_hash.slice(0, 18)}…`
      : 'waiting for protocol approval';

  return (
    <main className="lab-shell">
      <script id="flylab-agent-context" type="application/json">{JSON.stringify(agentHandoff.agent_context).replaceAll('<', '\\u003c')}</script>
      <script id="flylab-agent-runtime" type="application/json">{JSON.stringify(agentRuntime).replaceAll('<', '\\u003c')}</script>
      <script id="flylab-agent-handoff" type="application/json">{JSON.stringify(agentHandoff).replaceAll('<', '\\u003c')}</script>
      <h1 className="sr-only">FlyLab agent workspace</h1>
      <header className="topbar">
        <a className="brand" href="#workspace" aria-label="FlyLab home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>FlyLab</span>
          <small>agent-native neuroethology</small>
        </a>
        <div className="top-status" aria-label="Laboratory versions">
          <span className="live-dot" /> Adult · BANC v888 · model {MODEL_MANIFEST.version}
        </div>
        <button className="quiet-button" type="button" onClick={() => setEvidenceOpen(true)}>
          Evidence ledger <span>{EVIDENCE.length + (lab.bundle ? 1 : 0)}</span>
        </button>
      </header>

      <section
        className="agent-bridge"
        aria-label="WebMCP agent control plane"
        data-state-revision={lab.revision}
        data-agent-status={agentContext.agent_status}
        data-next-action={agentRuntime.invocable_next_tool ?? ''}
        data-workflow-next-action={agentContext.next_tool ?? ''}
        data-agent-context-version={agentContext.schema_version}
        data-next-input-refs={pageToolsRegistered && webmcpInvocationObserved ? JSON.stringify(agentContext.next_action.input_refs) : '{}'}
        data-workflow-next-input-refs={JSON.stringify(agentContext.next_action.input_refs)}
        data-webmcp-status={webmcpStatus}
        data-page-tools-registered={pageToolsRegistered}
        data-webmcp-invocation-observed={webmcpInvocationObserved}
      >
        <div className="agent-bridge-identity">
          <span><i /> Agent runtime</span>
          <strong>{siteToolStatus} · r{lab.revision}</strong>
        </div>
        <div className="agent-bridge-next">
          <span>{pageToolsRegistered && webmcpInvocationObserved ? 'Next WebMCP tool' : pageToolsRegistered ? 'Page-registered next tool' : 'Recommended when connected'}</span>
          <code>{agentNextDisplay}</code>
        </div>
        <div className="agent-bridge-gate">
          <span>Human gate</span>
          <strong>{humanGate}</strong>
        </div>
      </section>

      <section className={`workspace ${lab.experiment && !lab.experiment.approved ? 'human-review-mode' : ''}`} id="workspace">
        <aside className="workflow-rail" aria-label="Agent operator panel">
          <section className="agent-handoff-rail" aria-labelledby="agent-handoff-title">
            <div className="section-title-row"><p className="eyebrow" id="agent-handoff-title">Agent handoff</p><span>r{lab.revision}</span></div>
            <strong>{pageToolsRegistered ? webmcpInvocationObserved ? 'WebMCP tool invocation observed' : '8 page tools registered' : 'Read-only in this browser'}</strong>
            <small>{pageToolsRegistered && !webmcpInvocationObserved
              ? 'The page accepted all registrations. Current client, model, account, workspace, permission, and rollout availability are not observable here.'
              : 'Copy the current revision, exact input references, and recovery path as one machine-readable packet.'}</small>
            {(webmcpStatus === 'unsupported' || webmcpStatus === 'failed') && (
              <p className="agent-runtime-fallback">
                {webmcpStatus === 'unsupported'
                  ? webmcpDiagnostic.availability_reason === 'register_tool_missing'
                    ? 'This browser exposed document.modelContext, but registerTool was not callable, so registration was not attempted. '
                    : 'This browser did not expose document.modelContext, so registration was not attempted. '
                  : 'The browser exposed WebMCP, but registration failed and all partial registrations were rolled back. '}
                <a href="#agent-diagnostics">Inspect the exact runtime diagnostic</a> or open the <Link href="/agent" target="_blank" rel="noopener">browser-readable agent guide in a new tab</Link>.
              </p>
            )}
            <button type="button" onClick={() => void copyAgentBrief()}>Copy live agent handoff</button>
            <details
              className="runtime-diagnostic"
              id="agent-diagnostics"
              ref={runtimeDiagnosticRef}
              open={webmcpStatus === 'unsupported' || webmcpStatus === 'failed' ? true : undefined}
            >
              <summary><span>Runtime diagnostic</span><b>{webmcpDiagnostic.availability_reason}</b></summary>
              <dl>
                <div><dt>Document ready</dt><dd>{webmcpDiagnostic.document_ready_state ?? 'not exposed'}</dd></div>
                <div><dt>Secure context</dt><dd>{formatCapability(webmcpDiagnostic.secure_context)}</dd></div>
                <div><dt>Origin-keyed cluster</dt><dd>{formatCapability(webmcpDiagnostic.origin_agent_cluster)}</dd></div>
                <div><dt>Tools policy</dt><dd>{formatCapability(webmcpDiagnostic.permissions_policy_tools_allowed)}</dd></div>
                <div><dt>modelContext present</dt><dd>{formatCapability(webmcpDiagnostic.document_model_context_present)}</dd></div>
                <div><dt>registerTool type</dt><dd>{webmcpDiagnostic.register_tool_type ?? 'not checked'}</dd></div>
                <div><dt>Registration attempted</dt><dd>{webmcpDiagnostic.registration_attempted ? 'yes' : 'no'}</dd></div>
                <div><dt>Declared tools</dt><dd>8</dd></div>
                <div><dt>Registered now</dt><dd>{agentRuntime.registered_tool_count ?? 'checking'}</dd></div>
                <div><dt>{webmcpStatus === 'failed' ? 'Accepted before rollback' : 'Registrations accepted'}</dt><dd>{webmcpDiagnostic.registrations_accepted_before_rollback}/8</dd></div>
                <div><dt>Failed tool</dt><dd>{webmcpDiagnostic.failed_tool_name ?? 'none'}</dd></div>
                <div><dt>WebMCP invocation observed</dt><dd>{webmcpInvocationObserved ? 'yes' : 'no'}</dd></div>
                <div><dt>Page session</dt><dd>{pageSessionId}</dd></div>
                <div><dt>State revision</dt><dd>r{lab.revision}</dd></div>
                <div><dt>Recommended next tool</dt><dd>{agentContext.next_tool ?? 'none'}</dd></div>
              </dl>
              <p className="runtime-exception"><span>Registration exception</span><code>{webmcpDiagnostic.registration_error
                ? `${webmcpDiagnostic.registration_error_name ?? 'Error'}: ${webmcpDiagnostic.registration_error}`
                : webmcpDiagnostic.registration_attempted
                  ? 'none'
                  : 'not applicable · API unavailable before registration'}</code></p>
              {(webmcpStatus === 'unsupported' || webmcpStatus === 'failed') && (
                <button type="button" onClick={() => {
                  setWebmcpStatus('checking');
                  setWebmcpDiagnostic(CHECKING_WEBMCP_CAPABILITY_DIAGNOSTIC);
                  setWebmcpDetectionAttempt((attempt) => attempt + 1);
                }}>Retry Site Tool detection</button>
              )}
              <label htmlFor="agent-recovery-packet">Visible recovery packet</label>
              <textarea id="agent-recovery-packet" value={agentBrief} readOnly rows={10} spellCheck={false} />
              <small>Raw machine endpoints remain <code>/flylab-agent-manifest.json</code> and <code>/flylab-tool-contracts.json</code>. Some in-app browsers block top-level JSON navigation; <Link href="/agent" target="_blank" rel="noopener">the HTML guide</Link> carries the same static documentation without leaving this page session.</small>
            </details>
          </section>

          <div className="goal-block">
            <div className="section-title-row"><p className="eyebrow">Mission boundary</p><span>Human-owned</span></div>
            <label className="sr-only" htmlFor="behavior-goal">Behavior goal</label>
            <textarea
              id="behavior-goal"
              value={goalDraft}
              onChange={(event) => setGoalDraft(event.target.value)}
              rows={3}
            />
            <button className="mission-commit" type="button" onClick={startNewMission} disabled={!goalDraft.trim() || goalDraft.trim() === lab.goal}>
              {lab.hypothesis || lab.experiment || lab.batch ? 'Publish new mission · clear artifacts' : 'Publish mission to agent state'}
            </button>
            <p className="goal-hint">{goalDraft.trim() === lab.goal ? <>Published at r{lab.revision}. The agent should call <code>inspect_flylab_state</code> before acting.</> : <>This is only a draft until published; publishing creates a new revision for <code>inspect_flylab_state</code>.</>}</p>
          </div>

          <details className="rail-disclosure">
            <summary><span>Local workflow</span><b>{agentContext.pipeline.filter((step) => step.status === 'complete').length}/{agentContext.pipeline.length - 1}</b></summary>
            <nav className="agent-run-graph" role="list" aria-label="Agent tool pipeline">
              {agentContext.pipeline.map((step, index) => (
                <div className={`agent-run-step ${step.status} ${step.kind}`} role="listitem" aria-label={`${step.title}: ${step.status.replace('_', ' ')}. ${step.boundary}`} key={step.name}>
                  <span>{step.kind === 'human_gate' ? 'H' : String(index).padStart(2, '0')}</span>
                  <div><strong>{step.title}</strong><code>{step.name}</code><small className="agent-step-status">{step.status.replace('_', ' ')}</small></div>
                  <i />
                </div>
              ))}
            </nav>
          </details>

          <details className="rail-disclosure" open={simulationRunning || evidenceSaveRunning ? true : undefined}>
            <summary><span>Activity</span><b>{lab.activity.length}</b></summary>
            <section className="agent-activity" aria-labelledby="agent-activity-title">
              <div className="section-title-row">
                <p className="eyebrow" id="agent-activity-title">Shared audit activity</p>
                <span className={`tool-status ${webmcpStatus === 'active' ? 'live' : ''}`}>{siteToolStatus}</span>
              </div>
              {lab.activity.map((item) => (
                <article className={`activity-row ${item.status}`} key={item.id}>
                  <i />
                  <div>
                    <strong>{item.title}</strong>
                    {(item.toolName || item.actor) && <small className="activity-contract">{item.toolName && <code>{item.toolName}</code>}<span>{item.actor?.replace('_', ' ')} · r{item.revision}{item.timestamp ? ` · ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</span></small>}
                    <p>{item.detail}</p>
                    {Boolean(item.createdArtifactIds?.length) && <small>Created <code>{item.createdArtifactIds?.join(' · ')}</code></small>}
                  </div>
                </article>
              ))}
            </section>
          </details>

          <details className="rail-disclosure" open={simulationRunning ? true : undefined}>
            <summary><span>Manual recovery walkthrough</span></summary>
            <div className="manual-action-wrap">
              <button className="manual-action" type="button" onClick={() => void primaryAction.action()}>
                <span>{primaryAction.label}</span><b aria-hidden="true">→</b>
              </button>
              <small>{primaryAction.detail}. This uses the same local action handlers and validation rules. It does not exercise Site Tool discovery, registration, or agent invocation.</small>
              <p className="manual-transport-status"><b>Local lab workflow {agentContext.pipeline.filter((step) => step.status === 'complete').length}/{agentContext.pipeline.length - 1}</b><span>WebMCP transport {agentRuntime.registered_tool_count ?? 0}/8 · {webmcpDiagnostic.registration_attempted ? webmcpDiagnostic.availability_reason : `not attempted · ${webmcpDiagnostic.availability_reason}`}</span></p>
            </div>
          </details>
        </aside>

        <section className="main-stage" aria-labelledby="arena-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Optional visual audit</p>
              <h2 id="arena-title">{arenaView === 'circuit' ? selectedCircuit?.id === 'circuit_gf_adult' ? <>GF motor path <span>· Three.js literature schematic</span></> : <>BANC v888 circuit <span>· Three.js reconstruction</span></> : <>Open-field trial <span>· Three.js 3D fly</span></>}</h2>
            </div>
            <div className="view-switch" aria-label="Arena view">
              {(['body', 'circuit', 'trace'] as const).map((view) => (
                <button className={arenaView === view ? 'active' : ''} type="button" aria-pressed={arenaView === view} onClick={() => setArenaView(view)} key={view}>{{ body: '3D fly', circuit: '3D brain', trace: 'trajectory' }[view]}</button>
              ))}
            </div>
          </div>

          <div className={`arena arena-${arenaView}`}>
            <span className="axis axis-y">posterior</span>
            <span className="axis axis-x">right</span>
            <span className="arena-scale">5 model mm</span>
            <div className="arena-data">
              <span>{activeCondition?.label ?? 'Awaiting protocol'}</span>
              <strong>{activePoint?.active ? `unitless ${selectedCircuit?.abbreviation ?? 'mapped-circuit'} ${lab.experiment?.perturbation === 'silence' ? 'suppression' : 'drive'}` : lab.batch ? 'replay' : 'preview'}</strong>
            </div>
            {arenaView !== 'circuit' && <div className="arena-render-mode"><i /> Three.js WebGL <small>schematic external morphology</small></div>}

            {arenaView !== 'circuit' && (activeCondition?.trajectory ?? []).slice(0, Math.max(1, Math.ceil(playhead * (activeCondition?.trajectory.length ?? 0)))).filter((_, index) => index % 3 === 0).map((point, index) => (
              <i
                className="trail-point"
                key={`${point.t}-${index}`}
                style={{ left: `calc(50% + ${point.x * 95}px)`, top: `calc(50% - ${point.y * 95}px)`, opacity: 0.15 + index / 35 }}
              />
            ))}

            {arenaView !== 'circuit' && (
              <Suspense fallback={<div className="fly-3d-fallback"><span className="agent-pulse" /> Loading Three.js fly…</div>}>
                <FlyArena3D
                  point={activePoint}
                  conditionLabel={activeCondition?.label ?? 'Arena orientation preview'}
                  timeMs={Math.round(playhead * playbackDurationMs)}
                  playing={playing}
                  traceMode={arenaView === 'trace'}
                  motorProgram={lab.experiment?.motorMap.motorProgram}
                  targetBodyParts={lab.experiment?.motorMap.targetBodyParts}
                />
              </Suspense>
            )}

            {arenaView === 'circuit' && (
              <Suspense fallback={<div className="brain-viewer-fallback"><span className="agent-pulse" /> Loading the BANC v888 reconstruction viewer…</div>}>
                <FlyBrain3D
                  laterality={activeCondition?.laterality ?? selectedCondition?.laterality ?? 'bilateral'}
                  driveActive={Boolean(activePoint?.active)}
                  perturbation={lab.experiment?.perturbation ?? 'activate'}
                  conditionLabel={activeCondition?.label ?? selectedCondition?.label ?? 'Circuit orientation preview'}
                  timeMs={Math.round(playhead * playbackDurationMs)}
                  circuitId={lab.experiment?.targetCircuitId ?? selectedCircuit?.id ?? 'circuit_mdn_adult'}
                  motorMap={lab.experiment?.motorMap ?? (selectedCircuit ? motorMapForCircuit(selectedCircuit.id) : undefined)}
                />
              </Suspense>
            )}

            {!lab.batch && arenaView !== 'circuit' && <p className="arena-empty">Design and approve an experiment to generate seeded trajectories.</p>}
          </div>

          <div className="playback-row">
            <button type="button" onClick={() => { setPlayhead(0); setPlaying(false); }} aria-label="Restart replay">↺</button>
            <button className="play-button" type="button" onClick={() => setPlaying((value) => !value)} disabled={!lab.batch} aria-label={playing ? 'Pause replay' : 'Play replay'}>{playing ? 'Ⅱ' : '▶'}</button>
            <span>{Math.round(playhead * playbackDurationMs)} ms</span>
            <div className="timeline-track" aria-label={`${playbackDurationMs}-millisecond trial timeline`}>
              {lab.experiment && <i className="stimulus-window" style={{ left: `${(lab.experiment.onsetMs / lab.experiment.trialDurationMs) * 100}%`, width: `${(lab.experiment.durationMs / lab.experiment.trialDurationMs) * 100}%` }} />}
              <b style={{ left: `${playhead * 100}%` }} />
            </div>
            <span>{playbackDurationMs.toLocaleString()} ms</span>
          </div>
          <div className="timeline-labels"><span>{lab.experiment ? 'baseline' : 'no protocol'}</span><strong>{lab.experiment ? `unitless ${selectedCircuit?.abbreviation ?? 'mapped-circuit'} ${lab.experiment.perturbation === 'silence' ? 'suppression' : 'drive'}` : 'no model target window'}</strong><span>{lab.experiment ? 'recovery' : 'awaiting design'}</span></div>

          <section className="trial-queue" aria-labelledby="trial-queue-title">
            <div className="section-title-row">
              <div><p className="eyebrow" id="trial-queue-title">Experiment queue</p><h2>{lab.experiment ? `${lab.experiment.conditions.length} controlled arms` : 'No protocol yet'}</h2></div>
              {lab.batch && <Badge kind="simulation_predicted" />}
            </div>
            <div className="condition-tabs">
              {(lab.experiment?.conditions ?? []).map((condition) => (
                <button className={activeCondition?.conditionId === condition.id || (!lab.batch && selectedConditionId === condition.id) ? 'active' : ''} type="button" aria-pressed={activeCondition?.conditionId === condition.id || (!lab.batch && selectedConditionId === condition.id)} key={condition.id} onClick={() => { setSelectedConditionId(condition.id); setPlayhead(0); setPlaying(false); }}>
                  <i className={condition.kind} />
                  <span>{condition.label}</span>
                  <small>{lab.batch ? 'complete' : lab.experiment?.approved ? 'approved' : 'draft'}</small>
                </button>
              ))}
              {!lab.experiment && <p className="empty-inline">No condition artifacts exist yet. A valid design must add baseline and model-sham controls plus the requested perturbation arm; bilateral designs add left-only and right-only comparisons only when the selected motor map supports them.</p>}
            </div>
          </section>

          {analysis && (
            <section className="results-panel" aria-labelledby="results-title">
              <div className="section-title-row"><div><p className="eyebrow">Behavior analysis</p><h2 id="results-title">{bestResult?.label ?? 'Selected model condition'}</h2></div><div className="badge-pair"><Badge kind="derived" /><Badge kind="simulation_predicted" /></div></div>
              <div className="metric-grid">
                <article><span>Response initiation</span><strong>{Math.round((bestResult?.responseInitiationProbability ?? 0) * 100)}%</strong><small>{bestResult?.responsiveN ?? 0}/{bestResult?.n ?? 0} seeded runs</small></article>
                {analysis.metrics.map((metric) => {
                  const value = bestResult ? conditionMetricValue(bestResult, metric) : null;
                  const meta = METRIC_LABELS[metric];
                  const probabilityLike = metric === 'short_mode_escape_probability';
                  return (
                    <article key={metric}>
                      <span>{meta.label}</span>
                      <strong>{value === null || value === undefined ? 'n/a' : probabilityLike ? `${Math.round(value * 100)}%` : <>{round(value, metric.includes('recruitment') || metric === 'stance_stability' ? 3 : 2)} <i>{meta.unit}</i></>}</strong>
                      <small>{metric === 'response_latency_ms' ? 'from nominal onset; responsive runs only' : 'uncalibrated simulated condition mean'}</small>
                    </article>
                  );
                })}
              </div>
              <p className="analysis-warning"><strong>Simulation predicted — not a biological measurement.</strong> {analysis.warning}</p>
              <details className="inspector-disclosure">
                <summary><span>Formal metric definitions</span><b>{analysis.methodVersion}</b></summary>
                <dl className="protocol-meta">
                  {analysis.metrics.map((metric) => {
                    const definition = METRIC_DEFINITIONS[metric];
                    return <div key={metric}><dt><code>{metric}</code></dt><dd>{definition.formula}<br /><small>{definition.unit} · {definition.aggregation} · {definition.nullRule}</small></dd></div>;
                  })}
                  <div><dt><code>{RESPONSE_INITIATION_SUMMARY_DEFINITION.id}</code></dt><dd>{RESPONSE_INITIATION_SUMMARY_DEFINITION.formula}<br /><small>separate declared summary · not an objective metric</small></dd></div>
                </dl>
              </details>
              <details className="inspector-disclosure">
                <summary><span>Exact per-run outputs</span><b>{activeCondition?.replicates.length ?? 0} runs · {activeCondition?.label ?? 'select an arm'}</b></summary>
                <div className="per-run-table-wrap">
                  <table>
                    <thead><tr><th>Run / seed</th><th>Response</th><th>Speed / distance</th><th>Body output</th><th>Trajectory</th></tr></thead>
                    <tbody>
                      {(activeCondition?.replicates ?? []).map((run) => (
                        <tr key={run.id}>
                          <td><code>{run.id}</code><small>seed {run.seed} · drive {round(run.effectiveMotorDrive, 3)}</small></td>
                          <td>{run.responseInitiated ? 'initiated' : 'not initiated'}<small>{run.responseLatencyMs === null ? 'latency n/a' : `${round(run.responseLatencyMs, 2)} ms from onset`} · p {round(run.responseProbability, 3)}</small></td>
                          <td>{round(run.signedSpeedMmS, 3)} model mm/s<small>{round(run.backwardDistanceMm, 3)} model mm backward · heading {round(run.headingChangeDeg, 2)}°</small></td>
                          <td>leg {round(run.legRecruitment, 3)} · wing {round(run.wingRecruitment, 3)}<small>lift {round(run.verticalDisplacementMm, 3)} model mm · stance {round(run.stanceStability, 3)}</small></td>
                          <td><code>{run.trajectoryId}</code><small>seed {run.trajectorySeed} · {run.trajectory.length} points · {run.trajectoryRole}</small></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          )}
        </section>

        <aside className={`inspector-panel ${lab.experiment && !lab.batch ? 'protocol-review-active' : ''}`} aria-label="Run details">
          <details className="inspector-disclosure protocol-disclosure" key={`protocol-${lab.experiment?.id ?? 'empty'}`} open={Boolean(lab.experiment)}>
            <summary><span>Exact protocol</span><b>{!lab.experiment ? 'Not created' : lab.experiment.approved ? 'Approved' : 'Human approval required'}</b></summary>
            <section className="protocol-controls" aria-labelledby="protocol-title">
            <div className="section-title-row"><p className="eyebrow" id="protocol-title">Exact protocol for human review</p><div className="badge-pair">{lab.experiment && <Badge kind={lab.experiment.provenance[0]} />}<span className={`approval-chip ${lab.experiment?.approved ? 'approved' : ''}`}>{!lab.experiment ? 'Not created' : lab.experiment.approved ? 'Approved' : 'Draft'}</span></div></div>
            {!lab.experiment ? (
              <p className="empty-protocol">No protocol artifact exists. The design tool must create a hypothesis-linked, controlled protocol before approval becomes available.</p>
            ) : (
              <>
                <dl className="protocol-meta protocol-identity">
                  <div><dt>Experiment ID</dt><dd><code>{lab.experiment.id}</code></dd></div>
                  <div><dt>Hypothesis ID</dt><dd><code>{lab.experiment.hypothesisId}</code></dd></div>
                  <div><dt>Target</dt><dd><code>{lab.experiment.targetCircuitId}</code></dd></div>
                  <div><dt>Behavior</dt><dd><code>{lab.experiment.behavior}</code></dd></div>
                  <div><dt>Motor map</dt><dd><code>{lab.experiment.motorMap.id}</code></dd></div>
                  <div><dt>Body targets</dt><dd>{lab.experiment.motorMap.targetBodyParts.map((part) => part.replaceAll('_', ' ')).join(' · ')}</dd></div>
                  <div><dt>Perturbation</dt><dd>{lab.experiment.perturbation}</dd></div>
                  <div><dt>Laterality</dt><dd>{lab.experiment.primaryLaterality}</dd></div>
                  <div><dt>Trial duration</dt><dd>{lab.experiment.trialDurationMs.toLocaleString()} ms</dd></div>
                  <div><dt>Required controls</dt><dd>{lab.experiment.conditions.some((condition) => condition.kind === 'baseline') ? 'baseline' : 'missing'} · {lab.experiment.conditions.some((condition) => condition.kind === 'sham') ? 'model-sham' : 'missing'}</dd></div>
                  <div><dt>Arms</dt><dd>{lab.experiment.conditions.map((condition) => condition.id).join(' · ')}</dd></div>
                </dl>
                <label>
                  <span>Unitless model {lab.experiment.perturbation === 'silence' ? 'suppression' : 'drive'} <b>{String(lab.experiment.activationLevel)}</b></span>
                  <input type="range" min="0" max="1" step="any" value={lab.experiment.activationLevel} disabled={simulationRunning} onChange={(event) => editExperiment('activationLevel', Number(event.target.value))} />
                </label>
                <label>
                  <span>Duration <b>{lab.experiment.durationMs} ms</b></span>
                  <input type="range" min="50" max={Math.min(5000, lab.experiment.trialDurationMs - lab.experiment.onsetMs)} step="1" value={lab.experiment.durationMs} disabled={simulationRunning} onChange={(event) => editExperiment('durationMs', Number(event.target.value))} />
                </label>
                <label>
                  <span>Replicates / arm <b>{lab.experiment.replicates}</b></span>
                  <input type="range" min="1" max="20" step="1" value={lab.experiment.replicates} disabled={simulationRunning} onChange={(event) => editExperiment('replicates', Number(event.target.value))} />
                </label>
                <dl className="protocol-meta">
                  <div><dt>Onset</dt><dd>{lab.experiment.onsetMs} ms</dd></div>
                  <div><dt>Seed</dt><dd>{lab.experiment.seed.toLocaleString()}</dd></div>
                  <div><dt>Controller</dt><dd>{MODEL_MANIFEST.controller}</dd></div>
                </dl>
                {!lab.experiment.approved ? (
                  <button className="protocol-approval-action" type="button" onClick={() => void approveExperiment()} disabled={simulationRunning || approvalPreparing}>
                    <strong>{approvalPreparing ? 'Committing exact protocol…' : 'Approve this exact experiment'}</strong>
                    <small>{lab.experiment.id} · {lab.experiment.conditions.length} arms · {lab.experiment.replicates} replicates each</small>
                  </button>
                ) : lab.approval ? (
                  <div className="protocol-approved-note">
                    <p>Human approval applies only to <code>{lab.experiment.id}</code>. Any edit revokes it and clears downstream artifacts.</p>
                    <dl className="protocol-meta">
                      <div><dt>Protocol hash</dt><dd><code>{lab.approval.protocol_hash}</code></dd></div>
                      <div><dt>Seed manifest hash</dt><dd><code>{lab.approval.seed_manifest_hash}</code></dd></div>
                      <div><dt>Approved</dt><dd><time dateTime={lab.approval.approved_at}>{new Date(lab.approval.approved_at).toLocaleString()}</time></dd></div>
                    </dl>
                  </div>
                ) : <p className="protocol-approved-note">Approval state is inconsistent. Edit or redesign the protocol before running.</p>}
              </>
            )}
            </section>
          </details>

          {lab.hypothesis && (
            <details className="inspector-disclosure" open={!lab.experiment ? true : undefined}>
              <summary><span>Hypothesis</span><b>{lab.hypothesis.id}</b></summary>
              <section className="hypothesis-card">
                <div className="section-title-row"><p className="eyebrow">Current hypothesis</p><Badge kind="agent_hypothesized" /></div>
                <h2>{lab.hypothesis.claim}</h2>
                <p>{lab.hypothesis.falsificationCriterion}</p>
                <small className="artifact-lineage">Causal support <code>{lab.hypothesis.causalEvidenceIds.join(' · ')}</code><br />Full cited set <code>{lab.hypothesis.evidenceIds.join(' · ')}</code></small>
              </section>
            </details>
          )}

          {selectedCircuit && (
            <details className="inspector-disclosure">
              <summary><span>Neural target</span><b>{selectedCircuit.id}</b></summary>
              <section className="target-card">
                <div><div className="target-card-heading"><span>Neural target</span><Badge kind={selectedCircuit.provenance[0]} /></div><strong>{selectedCircuit.name}</strong><small>{selectedCircuit.id} · {selectedCircuit.summary}</small></div>
                <div><div className="target-card-heading"><span>Mapped body output</span><Badge kind="agent_hypothesized" /></div><strong>{selectedCircuit.targetBodyParts.map((part) => part.replaceAll('_', ' ')).join(' · ')}</strong><small>{motorMapForCircuit(selectedCircuit.id)?.simulationBoundary}</small></div>
              </section>
            </details>
          )}

          <details className="inspector-disclosure" key={`autoresearch-${lab.comparison?.id ?? analysis?.id ?? 'empty'}`} open={Boolean(analysis || lab.comparison)}>
            <summary><span>Bounded autoresearch</span><b>{lab.comparison ? 'Proposal ready' : `Next-experiment replicate budget · ${lab.nextTrialBudget}`}</b></summary>
            <section className="autonomy-card">
              <div className="section-title-row"><p className="eyebrow">Bounded autoresearch</p>{lab.comparison ? <div className="badge-pair">{lab.comparison.provenance.map((kind) => <Badge key={kind} kind={kind} />)}</div> : <span>propose only</span>}</div>
              <label><span>Next-experiment replicate budget</span><select value={lab.nextTrialBudget} onChange={(event) => changeNextTrialBudget(Number(event.target.value))}><option value="2">2 replicates</option><option value="5">5 replicates</option><option value="10">10 replicates</option></select></label>
              <p>The agent may rank and propose a follow-up. It cannot execute a new batch without approval.</p>
              {lab.comparison && (
                <div className="comparison-ranking">
                  <span>Ranked to <code>{lab.comparison.objective}</code> <code>{lab.comparison.objectiveMetric}</code></span>
                  <ol>
                    {lab.comparison.rankedConditions.map((condition) => (
                      <li key={condition.conditionId}><strong>{condition.label}</strong><b>{condition.value === null ? 'n/a' : round(condition.value, 3)}</b></li>
                    ))}
                  </ol>
                </div>
              )}
              {lab.comparison && <div className="proposal"><Badge kind="agent_hypothesized" /><strong>{lab.comparison.proposal.rationale}</strong><small>levels {lab.comparison.proposal.activationLevels.join(' / ')} · budget {lab.comparison.proposal.replicateBudget}</small></div>}
            </section>
          </details>

          <details className="inspector-disclosure">
            <summary><span>Artifact state</span><b>r{lab.revision}</b></summary>
            <section className="agent-context-card" aria-labelledby="agent-brief-title">
              <div className="section-title-row"><p className="eyebrow" id="agent-brief-title">Agent runtime contract</p><span>{pageToolsRegistered && webmcpInvocationObserved ? agentContext.agent_status : pageToolsRegistered ? 'registered' : webmcpStatus === 'checking' ? 'checking' : 'read-only'}</span></div>
              <div className="agent-next-card">
                <span>{pageToolsRegistered ? (agentContext.next_tool ? 'Page-registered next tool' : 'Workflow is blocked') : 'Workflow recommendation only'}</span>
                <code>{agentNextDisplay}</code>
                <small>{pageToolsRegistered && webmcpInvocationObserved
                  ? agentContext.next_action.reason
                  : pageToolsRegistered
                    ? 'Page registration succeeded; current client availability is unknown to the page. Start with inspect_flylab_state when Site Tools exposes it.'
                    : 'Not callable in this browser. Use a compatible WebMCP runtime, then inspect fresh state.'}</small>
              </div>
              <dl className="agent-artifact-ids">
                <div><dt>State</dt><dd>r{lab.revision}</dd></div>
                {agentContext.artifacts.selected_circuit_id && <div><dt>Circuit</dt><dd>{agentContext.artifacts.selected_circuit_id}</dd></div>}
                {agentContext.artifacts.experiment_id && <div><dt>Experiment</dt><dd>{agentContext.artifacts.experiment_id}</dd></div>}
                {agentContext.artifacts.batch_id && <div><dt>Batch</dt><dd>{agentContext.artifacts.batch_id}</dd></div>}
                {agentContext.artifacts.analysis_ids.length > 0 && <div><dt>Analysis</dt><dd>{agentContext.artifacts.analysis_ids.join(' · ')}</dd></div>}
                {agentContext.artifacts.comparison_id && <div><dt>Comparison</dt><dd>{agentContext.artifacts.comparison_id}</dd></div>}
                {agentContext.artifacts.evidence_bundle_id && <div><dt>Bundle</dt><dd>{agentContext.artifacts.evidence_bundle_id}</dd></div>}
              </dl>
              <button type="button" onClick={() => void copyAgentBrief()}>Copy live recovery packet</button>
            </section>
          </details>

          <details className="inspector-disclosure">
            <summary><span>Evidence boundaries</span><b>{EVIDENCE.length + (lab.bundle ? 1 : 0)} records</b></summary>
            <section className="evidence-summary">
              <div className="section-title-row"><p className="eyebrow">Evidence boundaries</p><button type="button" onClick={() => setEvidenceOpen(true)}>inspect all ↗</button></div>
              <div className="evidence-badges">
                {(Object.keys(provenanceMeta) as ProvenanceLabel[]).map((kind) => <Badge key={kind} kind={kind} />)}
              </div>
              <p>{MODEL_MANIFEST.boundary}</p>
            </section>
          </details>

        </aside>
      </section>

      <footer className="lab-footer" aria-live="polite">
        <p><span className="agent-pulse" /> {notice}</p>
        <p>{lab.bundle ? `${lab.bundle.id} · ${lab.bundle.manifestHash.slice(0, 22)}…` : `state revision ${lab.revision}`}{lab.revision > initialState.revision && <span className="session-scope-warning"> · page-scoped; export before leaving</span>}</p>
        <div className="footer-tools"><span>{webmcpStatus === 'active' ? 'WebMCP page registration active' : 'WebMCP contracts published'}</span><span>{webmcpStatus === 'active' ? '8 page-registered tools' : '8 published contracts'}</span><Link href="/agent" target="_blank" rel="noopener">agent guide</Link><a href="/THIRD_PARTY_LICENSES.txt">licenses</a></div>
      </footer>

      {evidenceOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEvidenceOpen(false); }}>
          <section className="evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-title" ref={evidenceDialogRef} tabIndex={-1}>
            <header><div><p className="eyebrow">Provenance ledger</p><h2 id="evidence-title">Every claim keeps its boundary</h2></div><button type="button" onClick={() => setEvidenceOpen(false)} aria-label="Close evidence ledger">×</button></header>
            <div className="evidence-modal-grid">
              <nav aria-label="Evidence records">
                {EVIDENCE.map((record) => (
                  <button className={selectedEvidence?.id === record.id ? 'active' : ''} type="button" aria-current={selectedEvidence?.id === record.id ? 'true' : undefined} onClick={() => setSelectedEvidenceId(record.id)} key={record.id}>
                    <Badge kind={record.provenance} /><strong>{record.label}</strong><small>{record.id}</small>
                  </button>
                ))}
                {lab.bundle && <button className={`bundle-record ${selectedBundle ? 'active' : ''}`} type="button" aria-current={selectedBundle ? 'true' : undefined} onClick={() => setSelectedEvidenceId(lab.bundle?.id ?? EVIDENCE[0].id)}><div className="badge-pair"><Badge kind={lab.bundle.provenance[0]} />{lab.bundle.annotation && <span className="provenance-badge untrusted_annotation"><i>U</i>Untrusted annotation</span>}</div><strong>{lab.bundle.title}</strong><small>{lab.bundle.id}</small></button>}
              </nav>
              {selectedBundle ? (
                <article className="evidence-detail bundle-detail">
                  <div className="badge-pair"><Badge kind={selectedBundle.provenance[0]} />{selectedBundle.annotation && <span className="provenance-badge untrusted_annotation"><i>U</i>Untrusted annotation</span>}</div>
                  <h3>{selectedBundle.title}</h3>
                  <p className="bundle-boundary">{selectedBundle.boundary}</p>
                  <dl>
                    <div><dt>Bundle ID</dt><dd><code>{selectedBundle.id}</code></dd></div>
                    <div><dt>Bundle scope</dt><dd><code>{selectedBundle.scope}</code>{selectedBundle.scope === 'mission' ? ' · includes goal and circuit-selection reasoning' : ' · exact selected experiment lineage'}</dd></div>
                    <div><dt>Saved</dt><dd><time dateTime={selectedBundle.savedAt}>{new Date(selectedBundle.savedAt).toLocaleString()}</time></dd></div>
                    <div><dt>Manifest hash</dt><dd><code>{selectedBundle.manifestHash}</code></dd></div>
                    <div><dt>Supporting evidence</dt><dd><code>{selectedBundle.supportingEvidenceIds.join(' · ')}</code></dd></div>
                    <div><dt>Supporting sources</dt><dd><code>{selectedBundle.supportingSourceIds.join(' · ')}</code></dd></div>
                    <div><dt>Circuit-context evidence</dt><dd><code>{selectedBundle.contextEvidenceIds.join(' · ') || 'none'}</code></dd></div>
                    <div><dt>Circuit-context sources</dt><dd><code>{selectedBundle.contextSourceIds.join(' · ') || 'none'}</code></dd></div>
                    <div><dt>Model-method evidence</dt><dd><code>{selectedBundle.methodEvidenceIds.join(' · ')}</code></dd></div>
                    <div><dt>Model-method sources</dt><dd><code>{selectedBundle.methodSourceIds.join(' · ')}</code></dd></div>
                    <div><dt>Dataset catalog sources</dt><dd><code>{selectedBundle.catalogSourceIds.join(' · ')}</code></dd></div>
                    <div><dt>Exact lineage</dt><dd>{selectedBundle.includedIds.length} identifiers: causal/supporting sources and evidence, separately scoped model-method sources and evidence, the selected circuit, hypothesis, experiment, batch, complete analysis set, comparison, and any bounded caller annotation</dd></div>
                    <div><dt>Provenance counts</dt><dd>{(Object.entries(selectedBundle.provenanceCounts) as Array<[ProvenanceLabel, number]>).filter(([, count]) => count > 0).map(([kind, count]) => `${kind} ${count}`).join(' · ')}</dd></div>
                    <div><dt>Display title</dt><dd>{selectedBundle.title} · deterministic FlyLab system metadata</dd></div>
                    <div><dt>Administrative annotation</dt><dd>{selectedBundle.annotation ? <><code>{selectedBundle.annotation.id}</code> · {selectedBundle.annotation.author.replace('_', ' ')} · {selectedBundle.annotation.trust} · {selectedBundle.annotation.boundary}{selectedBundle.annotation.note ? ` Note: ${selectedBundle.annotation.note}` : ''}</> : 'none · no caller-entered title or note'}</dd></div>
                  </dl>
                  <section className="evidence-download" aria-labelledby="evidence-download-title">
                    <h4 id="evidence-download-title">Portable export</h4>
                    <p>The versioned JSON contains this metadata and the complete payload used to calculate the manifest hash.</p>
                    <button type="button" onClick={downloadEvidence} disabled={!lab.evidenceExport}>
                      <strong>Download evidence JSON</strong>
                      <small>{evidenceExportFilename(selectedBundle.id)}</small>
                    </button>
                    <button type="button" onClick={() => void copyEvidence()} disabled={!lab.evidenceExport}>
                      <strong>Copy bundle JSON</strong>
                      <small>Clipboard fallback with the same manifest-hashed payload</small>
                    </button>
                    <details>
                      <summary>Select bundle JSON manually</summary>
                      <textarea readOnly aria-label="Complete bundle JSON" value={lab.evidenceExport ? serializeEvidenceExport(lab.evidenceExport) : ''} rows={12} />
                    </details>
                    <p className="integrity-note">The manifest hash is a payload integrity check, not a digital signature or guarantee of immutability. Browser-local storage remains a best-effort convenience copy.</p>
                  </section>
                </article>
              ) : selectedEvidence && (
                <article className="evidence-detail">
                  <Badge kind={selectedEvidence.provenance} />
                  <h3>{selectedEvidence.claim}</h3>
                  <dl>
                    <div><dt>Evidence role</dt><dd>{selectedEvidence.role}</dd></div>
                    <div><dt>Claim support scope</dt><dd>{selectedEvidence.support.kind}{selectedEvidence.support.perturbations?.length ? ` · ${selectedEvidence.support.perturbations.join(' / ')}` : ''}{selectedEvidence.support.behaviors?.length ? ` · ${selectedEvidence.support.behaviors.join(' / ')}` : ''}</dd></div>
                    <div><dt>Context</dt><dd>{selectedEvidence.context}</dd></div>
                    <div><dt>Boundary</dt><dd>{selectedEvidence.caution}</dd></div>
                  </dl>
                  <h4>Sources and support roles</h4>
                  {selectedSources.map((source) => {
                    const mapping = selectedEvidence.sourceSupport.find((item) => item.sourceId === source.id);
                    return (
                      <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
                        <strong>{source.title}</strong>
                        <span>{mapping?.supports ?? source.citation}</span>
                        <small>{source.kind} · {mapping?.relation ?? 'source'} · {mapping?.locator ?? source.version}</small>
                        <small>{source.citation} · {source.version} · {source.specimen} · {source.license}</small>
                      </a>
                    );
                  })}
                  <p className="evidence-coverage-note">Catalog coverage: adult MDN leg-retreat and adult giant-fiber leg/wing escape pathways. Unmapped cells, body parts, and behaviors remain explicit gaps rather than inferred connections.</p>
                </article>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
