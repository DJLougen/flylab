'use client';

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
  METRIC_LABELS,
  MODEL_MANIFEST,
  SOURCES,
  analyzeBatch,
  circuitSupportsBehavior,
  conditionMetricValue,
  compareAnalyses,
  designExperiment,
  evidenceBundleTitle,
  makeHypothesis,
  round,
  sha256,
  simulateExperiment,
  stableHash,
  type Analysis,
  type Comparison,
  type Experiment,
  type Hypothesis,
  type MetricName,
  type ProvenanceLabel,
  type SimulationBatch,
} from '@/lib/flylab';
import {
  FlyLabDomainError,
  installFlyLabWebMCP,
  prepareCancellableCommit,
  requireCurrentStateRevision,
  validateToolInput,
  type FlyLabActionActor,
  type FlyLabProvenanceManifestEntry,
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
import { buildFlyLabAgentHandoff, type FlyLabWebMCPStatus } from '@/lib/agent-handoff';

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
}

interface LabState {
  revision: number;
  stage: Stage;
  goal: string;
  selectedCircuitId: string | null;
  discoveredEvidenceIds: string[];
  nextTrialBudget: number;
  hypothesis: Hypothesis | null;
  experiment: Experiment | null;
  batch: SimulationBatch | null;
  analyses: Analysis[];
  comparison: Comparison | null;
  bundle: EvidenceBundleMetadata | null;
  evidenceExport: EvidenceExportEnvelope | null;
  activity: ActivityItem[];
}

const initialState: LabState = {
  revision: 1,
  stage: 'discover',
  goal: DEFAULT_GOAL,
  selectedCircuitId: null,
  discoveredEvidenceIds: [],
  nextTrialBudget: 2,
  hypothesis: null,
  experiment: null,
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
  'SRC-FLYGYM-NM-2024',
  'SRC-FLYGYM-CODE-V210',
  'SRC-JURGENS-GENETICS-2024',
  'SRC-CHUN-ELIFE-2021',
];

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
      perturbation: current.experiment.perturbation,
      primary_laterality: current.experiment.primaryLaterality,
      protocol: {
        activation_level: current.experiment.activationLevel,
        onset_ms: current.experiment.onsetMs,
        duration_ms: current.experiment.durationMs,
        trial_duration_ms: current.experiment.trialDurationMs,
        replicates: current.experiment.replicates,
        seed: current.experiment.seed,
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
    batch: current.batch ? {
      id: current.batch.id,
      artifact_type: 'simulation_batch',
      provenance: current.batch.provenance,
      parent_ids: [current.batch.experimentId],
      evidence_ids: current.hypothesis?.evidenceIds ?? [],
      source_ids: uniqueStrings([...hypothesisSourceIds, ...modelSourceIds]),
      experiment_id: current.batch.experimentId,
      run_hash: current.batch.runHash,
      protocol: current.batch.protocol,
      protocol_provenance: ['agent_hypothesized'],
      condition_ids: current.batch.conditionRuns.map((run) => run.conditionId),
      run_ids: current.batch.conditionRuns.flatMap((run) => run.runIds),
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

function buildCurrentLineageProvenanceEntries(current: LabState, prefix: string) {
  const entries: FlyLabProvenanceManifestEntry[] = [];
  const circuit = CIRCUITS.find((record) => record.id === current.selectedCircuitId) ?? null;
  const discoveredEvidence = evidenceRecordsForIds(current.discoveredEvidenceIds);
  if (circuit) entries.push(provenanceEntry(`${prefix}/selected_circuit`, circuit.id, 'circuit', 'artifact', circuit.provenance, [], circuit.evidenceIds, sourceIdsForEvidence(circuit.evidenceIds), 'Derived catalog record; not a neural activity measurement.'));
  discoveredEvidence.forEach((record, index) => entries.push(provenanceEntry(`${prefix}/discovered_evidence/${index}`, record.id, 'evidence_record', 'record', [record.provenance], circuit ? [circuit.id] : [], [], record.sourceIds, record.caution)));
  if (current.hypothesis) entries.push(provenanceEntry(`${prefix}/hypothesis`, current.hypothesis.id, 'hypothesis', 'artifact', [current.hypothesis.provenance], [current.hypothesis.circuitId, ...current.hypothesis.evidenceIds], current.hypothesis.evidenceIds, sourceIdsForEvidence(current.hypothesis.evidenceIds), 'Agent-authored falsifiable proposal; not evidence.'));
  if (current.experiment) {
    entries.push(provenanceEntry(`${prefix}/experiment`, current.experiment.id, 'experiment', 'artifact', current.experiment.provenance, [current.experiment.hypothesisId, current.experiment.targetCircuitId], current.hypothesis?.evidenceIds ?? [], sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []), 'Human-reviewable virtual protocol; not a wet-lab protocol or biological dose.'));
    entries.push(provenanceEntry(`${prefix}/experiment/model`, null, 'model_manifest', 'container', ['derived'], [current.experiment.id], ['E-FLYLAB-MODEL-004'], ['SRC-FLYLAB-MODEL-CARD', 'SRC-FLYGYM-NM-2024', 'SRC-FLYGYM-CODE-V210'], MODEL_MANIFEST.boundary));
    entries.push(provenanceEntry(`${prefix}/experiment/model/controllerMapping`, null, 'controller_mapping', 'container', ['agent_hypothesized'], [current.experiment.id], ['E-FLYLAB-MODEL-004'], ['SRC-FLYLAB-MODEL-CARD'], MODEL_MANIFEST.controllerMapping.statement));
  }
  if (current.batch) {
    entries.push(provenanceEntry(`${prefix}/batch`, current.batch.id, 'simulation_batch', 'artifact', current.batch.provenance, [current.batch.experimentId], current.hypothesis?.evidenceIds ?? [], sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []), current.batch.model.boundary));
    entries.push(...batchFieldProvenanceEntries(current.batch, current.hypothesis?.evidenceIds ?? [], `${prefix}/batch`, false));
  }
  current.analyses.forEach((analysis, index) => entries.push(provenanceEntry(`${prefix}/analyses/${index}`, analysis.id, 'behavior_analysis', 'artifact', analysis.provenance, [analysis.batchId], current.hypothesis?.evidenceIds ?? [], sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []), analysis.warning)));
  if (current.comparison) {
    entries.push(provenanceEntry(`${prefix}/comparison`, current.comparison.id, 'trial_comparison', 'artifact', current.comparison.provenance, current.comparison.analysisIds, current.hypothesis?.evidenceIds ?? [], sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []), 'Ranking of simulation-derived analyses; not biological evidence.'));
    entries.push(provenanceEntry(`${prefix}/comparison/proposal`, current.comparison.proposal.id, 'follow_up_proposal', 'artifact', [current.comparison.proposal.provenance], [current.comparison.id], current.hypothesis?.evidenceIds ?? [], sourceIdsForEvidence(current.hypothesis?.evidenceIds ?? []), 'Proposal only; execution is not authorized.'));
  }
  if (current.bundle) entries.push(provenanceEntry(`${prefix}/evidence_bundle`, current.bundle.id, 'evidence_bundle', 'artifact', current.bundle.provenance, current.bundle.includedIds, uniqueStrings([...current.bundle.supportingEvidenceIds, ...current.bundle.contextEvidenceIds, ...current.bundle.methodEvidenceIds]), uniqueStrings([...current.bundle.supportingSourceIds, ...current.bundle.contextSourceIds, ...current.bundle.methodSourceIds]), current.bundle.boundary));
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
    selectedCircuitId: current.selectedCircuitId,
    discoveredEvidenceIds: current.discoveredEvidenceIds,
    hypothesisEligibleEvidenceIds: current.discoveredEvidenceIds.filter((id) => (
      EVIDENCE.find((record) => record.id === id)?.role === 'hypothesis_support'
    )),
    causalEvidenceIdsByPerturbation: {
      activate: current.discoveredEvidenceIds.filter((id) => {
        const record = EVIDENCE.find((item) => item.id === id);
        return record?.role === 'hypothesis_support'
          && record.support.kind === 'perturbation_effect'
          && record.support.perturbations?.includes('activate');
      }),
      silence: current.discoveredEvidenceIds.filter((id) => {
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
  const [notice, setNotice] = useState('State a behavior goal, then ask the agent to investigate.');
  const [selectedConditionId, setSelectedConditionId] = useState('condition_bilateral');
  const [playhead, setPlayhead] = useState(0);
  const playheadRef = useRef(playhead);
  const [playing, setPlaying] = useState(false);
  const [arenaView, setArenaView] = useState<'body' | 'circuit' | 'trace'>('body');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceDialogRef = useRef<HTMLElement | null>(null);
  const evidenceReturnFocusRef = useRef<HTMLElement | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(EVIDENCE[0].id);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [evidenceSaveRunning, setEvidenceSaveRunning] = useState(false);
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
      { ...item, revision: current.revision + 1, id: `activity_${current.revision + 1}_${stableHash(item)}` },
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
      selectedCircuitId: null,
      discoveredEvidenceIds: [],
      hypothesis: null,
      experiment: null,
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
        data: { agent_context: agentContext },
        provenance: [...new Set(provenanceEntries.flatMap((entry) => entry.labels))],
        provenanceManifest: {
          entries: provenanceEntries,
          operationalPaths: [
            '/agent_context/state',
            '/agent_context/artifacts',
            '/agent_context/next_action',
            '/agent_context/next_tool',
            '/agent_context/human_controls',
            '/agent_context/human_gate',
            '/agent_context/pipeline',
            '/agent_context/session_warning',
          ],
        },
        stateRevision: current.revision,
      };
    },

    find_fly_circuits: async (input, { actor }) => {
      const query = stringInput(input, 'query').toLowerCase();
      const behavior = stringInput(input, 'behavior', 'any');
      const requestedLabels = stringArrayInput(input, 'evidence_labels');
      const limit = numberInput(input, 'limit', 8);
      const matches = CIRCUITS.filter((circuit) => {
        const searchable = `${circuit.name} ${circuit.abbreviation} ${circuit.summary} ${circuit.behaviors.join(' ')}`.toLowerCase();
        const textMatch = searchable.includes(query) || query.includes('retreat') || query.includes('backward');
        const behaviorMatch = behavior === 'any' || circuit.behaviors.includes(behavior);
        return textMatch && behaviorMatch;
      }).slice(0, limit);

      const evidence = EVIDENCE.filter((record) => {
        const selected = matches.some((circuit) => circuit.evidenceIds.includes(record.id));
        return selected && (!requestedLabels.length || requestedLabels.includes(record.provenance));
      });
      const evidenceIds = evidence.map((record) => record.id);
      const hypothesisEvidenceIds = evidence
        .filter((record) => record.role === 'hypothesis_support')
        .map((record) => record.id);
      const causalEvidenceIdsByPerturbation = {
        activate: evidence.filter((record) => record.support.kind === 'perturbation_effect'
          && record.support.perturbations?.includes('activate')).map((record) => record.id),
        silence: evidence.filter((record) => record.support.kind === 'perturbation_effect'
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
        return { ...record, sources };
      });
      const selectedCircuit = matches.find((circuit) => circuit.evidenceIds.some((id) => evidenceIds.includes(id))) ?? null;
      const prior = labRef.current;
      const preservesLineage = selectedCircuit?.id === prior.selectedCircuitId
        && evidenceIds.length === prior.discoveredEvidenceIds.length
        && evidenceIds.every((id) => prior.discoveredEvidenceIds.includes(id));
      const next = commit((current) => pushActivity({
          ...current,
          stage: preservesLineage ? current.stage : selectedCircuit ? 'hypothesize' : 'discover',
          selectedCircuitId: selectedCircuit?.id ?? null,
          discoveredEvidenceIds: selectedCircuit ? evidenceIds : [],
          hypothesis: preservesLineage ? current.hypothesis : null,
          experiment: preservesLineage ? current.experiment : null,
          batch: preservesLineage ? current.batch : null,
          analyses: preservesLineage ? current.analyses : [],
          comparison: preservesLineage ? current.comparison : null,
          bundle: preservesLineage ? current.bundle : null,
          evidenceExport: preservesLineage ? current.evidenceExport : null,
        }, {
          title: selectedCircuit ? 'Circuit evidence found' : matches.length ? 'Evidence filter returned no records' : 'No curated circuit matched',
          detail: selectedCircuit ? `MDN selected with ${evidence.length} source-backed evidence records.${preservesLineage ? ' Existing lineage remains exact.' : ' Any prior lineage was invalidated.'}` : matches.length ? 'The circuit matched, but no evidence matched the requested provenance filter.' : 'Try MDN, backward walking, or retreat.',
          status: 'complete',
          actor,
          toolName: 'find_fly_circuits',
        }));
      const postContext = getAgentContext(next);
      setNotice(selectedCircuit
        ? preservesLineage
          ? 'The same evidence selection was returned; the existing artifact lineage remains intact.'
          : 'MDN is highlighted. The next step is a falsifiable hypothesis.'
        : matches.length ? 'No evidence matched that filter. Broaden the evidence labels before drafting.' : 'No match in the bounded challenge catalog.');
      const connectomeCells = BANC_V888_CELLS.map((cell) => ({
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
        ...matches.map((record, index) => provenanceEntry(
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
        ...evidence.map((record, index) => provenanceEntry(
          `/evidence/${index}`,
          record.id,
          'evidence_record',
          'record',
          [record.provenance],
          selectedCircuit ? [selectedCircuit.id] : [],
          [],
          record.sourceIds,
          record.caution,
        )),
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
      ];
      return {
        summary: selectedCircuit ? `Found ${matches.length} curated adult circuit with ${evidence.length} matching evidence records.` : matches.length ? 'A circuit matched, but the evidence filter returned no usable records.' : 'No circuit matched the bounded catalog.',
        data: {
          circuits: matches,
          evidence: evidenceWithSources,
          connectome_records: {
            snapshot: 'banc_888',
            cells: connectomeCells,
            edges: BANC_V888_EDGES,
            field_semantics: {
              cells: 'Deterministically selected BANC v888 metadata. Neurotransmitter classifier, literature-curated neurotransmitter, and cross-dataset-match fields are intentionally omitted from the agent result.',
              edges: 'Rows come from banc_888_edgelist_simple_v3.feather, a future-work v3 predicted-synapse product filtered to postsynapse size ≥10 voxels. The Nature paper analyses use v2 with threshold ≥5.',
              count: 'Number of v3 predicted synaptic links represented by the directed row; not a physiological weight.',
              norm: 'Raw released normalization value preserved for auditability; FlyLab assigns it no biological or causal interpretation.',
            },
            interpretation: `${BANC_V888_EDGES.length} directed MDN→LBL40 rows total ${BANC_V888_MDN_LBL40_TOTAL_CONTACTS} v3 predicted synaptic links after the released postsynapse-size ≥10-voxel filter; they are not physiological weights, activity measurements, or causal efficacy.`,
          },
          dataset_versions: DATASET_MANIFEST,
          hypothesis_eligible_evidence_ids: hypothesisEvidenceIds,
          causal_evidence_ids_by_perturbation: causalEvidenceIdsByPerturbation,
          evidence_role_policy: 'Only records with role hypothesis_support may be cited. A valid claim also requires at least one perturbation_effect record whose perturbation and behavior match the proposed hypothesis; structural, inventory, and motor-context records may only supplement it.',
          coverage_warning: 'FlyLab challenge release currently exposes the validated adult MDN vertical slice.',
          next_action: postContext.next_action,
        },
        provenance: [...new Set(provenanceEntries.flatMap((entry) => entry.labels))],
        provenanceManifest: {
          entries: provenanceEntries,
          operationalPaths: [
            '/hypothesis_eligible_evidence_ids',
            '/causal_evidence_ids_by_perturbation',
            '/evidence_role_policy',
            '/coverage_warning',
            '/next_action',
          ],
        },
        stateRevision: next.revision,
      };
    },

    draft_fly_hypothesis: async (input, { actor }) => {
      const circuitId = stringInput(input, 'circuit_id');
      const circuit = CIRCUITS.find((item) => item.id === circuitId);
      if (!circuit) throw new FlyLabDomainError('NOT_FOUND', `Circuit ${circuitId} is not in the curated catalog.`);
      const current = labRef.current;
      if (current.selectedCircuitId !== circuitId) {
        throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'Inspect or discover the selected circuit in this page session before drafting a hypothesis.', false, {
          selected_circuit_id: current.selectedCircuitId,
          requested_circuit_id: circuitId,
          recovery_tool: 'inspect_flylab_state',
        });
      }
      const evidenceIds = stringArrayInput(input, 'evidence_ids');
      const invalidEvidence = evidenceIds.filter((id) => !circuit.evidenceIds.includes(id) || !current.discoveredEvidenceIds.includes(id));
      if (invalidEvidence.length) throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'One or more evidence IDs are not linked to the selected circuit.', false, { invalidEvidence });
      const ineligibleEvidence = evidenceIds
        .map((id) => EVIDENCE.find((record) => record.id === id))
        .filter((record): record is (typeof EVIDENCE)[number] => Boolean(record) && record.role !== 'hypothesis_support');
      if (ineligibleEvidence.length) {
        throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'Context-only evidence cannot be promoted into hypothesis support.', false, {
          rejected_evidence: ineligibleEvidence.map((record) => ({ id: record.id, role: record.role })),
          hypothesis_eligible_evidence_ids: current.discoveredEvidenceIds.filter((id) => (
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
      const causalEvidence = evidenceIds
        .map((id) => EVIDENCE.find((record) => record.id === id))
        .filter((record): record is (typeof EVIDENCE)[number] => Boolean(record)
          && record.support.kind === 'perturbation_effect'
          && record.support.perturbations?.includes(perturbation) === true
          && record.support.behaviors?.includes(predictedBehavior) === true);
      if (!causalEvidence.length) {
        throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'The hypothesis needs at least one perturbation-effect record matching its perturbation and behavior.', false, {
          required_support: { kind: 'perturbation_effect', perturbation, behavior: predictedBehavior },
          matching_discovered_evidence_ids: current.discoveredEvidenceIds.filter((id) => {
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
        evidenceIds,
        falsificationCriterion: stringInput(input, 'falsification_criterion'),
      });
      const preservesLineage = current.hypothesis?.id === hypothesis.id;
      const next = commit((current) => pushActivity({
        ...current,
        stage: preservesLineage ? current.stage : 'design',
        hypothesis,
        selectedCircuitId: circuitId,
        experiment: preservesLineage ? current.experiment : null,
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
      }));
      const postContext = getAgentContext(next);
      setNotice(preservesLineage
        ? 'The identical hypothesis was returned; later artifacts remain intact.'
        : 'Hypothesis created without upgrading it to measured evidence.');
      return {
        summary: 'Created an editable, falsifiable MDN hypothesis.',
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
      };
    },

    design_stimulation_trial: async (input, { actor }) => {
      const current = labRef.current;
      if (!current.hypothesis || current.hypothesis.id !== stringInput(input, 'hypothesis_id')) {
        throw new FlyLabDomainError('NOT_FOUND', 'Create or select the referenced hypothesis first.');
      }
      if (!CIRCUITS.some((circuit) => circuit.id === stringInput(input, 'target_circuit_id'))) {
        throw new FlyLabDomainError('UNSUPPORTED_TARGET', 'The requested circuit is outside the validated challenge catalog.');
      }
      const targetCircuitId = stringInput(input, 'target_circuit_id');
      const perturbation = stringInput(input, 'perturbation') as 'activate' | 'silence';
      if (current.hypothesis.circuitId !== targetCircuitId || current.hypothesis.perturbation !== perturbation) {
        throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'The trial target and perturbation must match the saved hypothesis.', false, {
          hypothesis_circuit_id: current.hypothesis.circuitId,
          requested_circuit_id: targetCircuitId,
          hypothesis_perturbation: current.hypothesis.perturbation,
          requested_perturbation: perturbation,
        });
      }
      const experiment = designExperiment({
        hypothesisId: current.hypothesis.id,
        targetCircuitId,
        perturbation,
        laterality: stringInput(input, 'laterality') as 'bilateral' | 'left' | 'right',
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
      }));
      const persistedExperiment = next.experiment ?? experiment;
      const postContext = getAgentContext(next);
      setSelectedConditionId(persistedExperiment.conditions.find((condition) => condition.laterality === persistedExperiment.primaryLaterality)?.id ?? persistedExperiment.conditions[0].id);
      setNotice(preservesLineage
        ? 'The identical protocol was returned; approval and later artifacts remain intact.'
        : 'Protocol is ready for human review. The agent cannot run it until you approve.');
      return {
        summary: preservesLineage
          ? 'Returned the existing controlled MDN perturbation experiment without regressing its lineage.'
          : 'Created a controlled MDN perturbation experiment that requires human approval.',
        data: {
          experiment: persistedExperiment,
          approval_required: !persistedExperiment.approved,
          agent_status: postContext.agent_status,
          blocked_by: postContext.next_action.blocked_by,
          agent_actionable: postContext.next_action.callable,
          human_gate: postContext.human_gate,
          next_action: postContext.next_action,
        },
        provenance: [...persistedExperiment.provenance, 'derived'],
        provenanceManifest: {
          entries: [
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
          ],
          operationalPaths: ['/experiment/approved', '/approval_required', '/agent_status', '/blocked_by', '/agent_actionable', '/human_gate', '/next_action'],
        },
        stateRevision: next.revision,
      };
    },

    run_fly_simulation: async (input, { signal, actor }) => {
      const current = labRef.current;
      if (!current.experiment || current.experiment.id !== stringInput(input, 'experiment_id')) {
        throw new FlyLabDomainError('NOT_FOUND', 'The requested experiment does not exist in this page session.');
      }
      if (!current.experiment.approved) {
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
      if (current.batch?.experimentId === current.experiment.id) {
        const postContext = getAgentContext(current);
        return {
          summary: 'Returned the existing deterministic simulation batch.',
          data: {
            ...current.batch,
            boundary: MODEL_MANIFEST.boundary,
            next_action: postContext.next_action,
          },
          provenance: ['simulation_predicted', 'agent_hypothesized', 'derived'],
          provenanceManifest: {
            entries: batchFieldProvenanceEntries(current.batch, current.hypothesis?.evidenceIds ?? []),
            operationalPaths: ['/next_action'],
          },
          stateRevision: current.revision,
        };
      }
      const experiment = current.experiment;
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
      return {
        summary: 'Completed the approved deterministic simulation batch.',
        data: {
          ...batch,
          boundary: MODEL_MANIFEST.boundary,
          next_action: getAgentContext(labRef.current).next_action,
        },
        provenance: ['simulation_predicted', 'agent_hypothesized', 'derived'],
        provenanceManifest: {
          entries: batchFieldProvenanceEntries(batch, current.hypothesis?.evidenceIds ?? []),
          operationalPaths: ['/next_action'],
        },
        stateRevision,
      };
    },

    analyze_fly_behavior: async (input, { actor }) => {
      const current = labRef.current;
      if (!current.batch || current.batch.id !== stringInput(input, 'batch_id')) {
        throw new FlyLabDomainError('INCOMPLETE_BATCH', 'Run the referenced simulation batch before analysis.');
      }
      const requestedMetrics = stringArrayInput(input, 'metrics') as MetricName[];
      const metrics = ANALYSIS_METRICS.filter((metric) => requestedMetrics.includes(metric));
      const analysis = analyzeBatch(current.batch, metrics);
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
          detail: `${metrics.length} predefined required metrics analyzed across ${analysis.conditions.length} conditions.`,
        status: 'complete',
        actor,
        toolName: 'analyze_fly_behavior',
      }));
      const postContext = getAgentContext(next);
      setNotice('Behavior cards aggregate simulation-generated per-run summaries, not measured flies; the replay path is illustrative and separate.');
      return {
        summary: 'Computed method-versioned behavioral metrics from the completed simulation batch.',
        data: {
          analysis,
          metric_definitions: Object.fromEntries(metrics.map((metric) => [metric, METRIC_LABELS[metric]])),
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
              '/unit_boundary',
              null,
              'model_unit_boundary',
              'container',
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
      };
    },

    compare_fly_trials: async (input, { actor }) => {
      const current = labRef.current;
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
        const availableObjectiveMetrics = ANALYSIS_METRICS.filter((metric) => (
          analyses.flatMap((analysis) => analysis.conditions).some((condition) => conditionMetricValue(condition, metric) !== null)
        ));
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
      };
    },

    save_fly_evidence: async (input, { actor, signal }) => {
      const current = labRef.current;
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
        .filter((record): record is (typeof EVIDENCE)[number] => Boolean(record) && record.role === 'model_context');
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
      const annotation = {
        id: `annotation_${stableHash({
          title: stringInput(input, 'title'),
          note: stringInput(input, 'note'),
          author: actor,
        })}`,
        title: stringInput(input, 'title'),
        note: stringInput(input, 'note'),
        author: actor,
        trust: 'untrusted_annotation' as const,
        purpose: 'administrative_annotation_not_evidence' as const,
        boundary: 'Caller-supplied title and note are untrusted administrative annotations, not scientific evidence or a validated biological claim.',
      };
      const modelSourceIds = ['SRC-FLYLAB-MODEL-CARD', 'SRC-FLYGYM-NM-2024', 'SRC-FLYGYM-CODE-V210'];
      const payloadProvenanceEntries: FlyLabProvenanceManifestEntry[] = [
        ...supportingSources.map((source, index) => provenanceEntry(`/supportingSources/${index}`, source.id, 'source_record', 'record', ['derived'], [], [], [source.id], 'Citation and source metadata; it does not itself reproduce the cited experiment.')),
        ...supportingEvidence.map((record, index) => provenanceEntry(`/supportingEvidence/${index}`, record.id, 'evidence_record', 'record', [record.provenance], [circuit.id], [], record.sourceIds, record.caution)),
        ...contextSources.map((source, index) => provenanceEntry(`/contextSources/${index}`, source.id, 'source_record', 'record', ['derived'], [], [], [source.id], 'Citation and source metadata retained as circuit context, not promoted to hypothesis support.')),
        ...contextEvidence.map((record, index) => provenanceEntry(`/contextEvidence/${index}`, record.id, 'evidence_record', 'record', [record.provenance], [circuit.id], [], record.sourceIds, `${record.caution} This record is contextual and is not promoted to hypothesis support in this bundle.`)),
        ...methodSources.map((source, index) => provenanceEntry(`/methodSources/${index}`, source.id, 'source_record', 'record', ['derived'], [], [], [source.id], 'Method-definition or embodiment-reference metadata; not a measured fly result.')),
        ...methodEvidence.map((record, index) => provenanceEntry(`/methodEvidence/${index}`, record.id, 'evidence_record', 'record', [record.provenance], [circuit.id], [], record.sourceIds, record.caution)),
        provenanceEntry('/circuit', circuit.id, 'circuit', 'artifact', circuit.provenance, [], circuit.evidenceIds, sourceIdsForEvidence(circuit.evidenceIds), 'Derived source catalog entry; not neural activity or a biological measurement.'),
        provenanceEntry('/hypothesis', hypothesis.id, 'hypothesis', 'artifact', [hypothesis.provenance], [hypothesis.circuitId, ...hypothesis.evidenceIds], hypothesis.evidenceIds, supportingSourceIds, 'Agent-authored falsifiable proposal; not evidence.'),
        provenanceEntry('/experiment', experiment.id, 'experiment', 'artifact', experiment.provenance, [experiment.hypothesisId, experiment.targetCircuitId], hypothesis.evidenceIds, uniqueStrings([...supportingSourceIds, ...modelSourceIds]), 'Human-approved virtual protocol; activation level is a unitless model control, not a biological dose.'),
        provenanceEntry('/experiment/model', null, 'model_manifest', 'container', ['derived'], [experiment.id], methodEvidenceIds, methodSourceIds, MODEL_MANIFEST.boundary),
        provenanceEntry('/experiment/model/controllerMapping', null, 'controller_mapping', 'container', ['agent_hypothesized'], [experiment.id], methodEvidenceIds, methodSourceIds, MODEL_MANIFEST.controllerMapping.statement),
        provenanceEntry('/batch', batch.id, 'simulation_batch', 'artifact', batch.provenance, [batch.experimentId], hypothesis.evidenceIds, uniqueStrings([...supportingSourceIds, ...modelSourceIds]), batch.model.boundary),
        provenanceEntry('/batch/protocol', null, 'approved_virtual_protocol_snapshot', 'container', ['agent_hypothesized'], [experiment.id, batch.id], hypothesis.evidenceIds, supportingSourceIds, 'Snapshot of the approved virtual protocol; not a wet-lab protocol.'),
        provenanceEntry('/batch/model', null, 'model_manifest', 'container', ['derived'], [batch.id], methodEvidenceIds, methodSourceIds, MODEL_MANIFEST.boundary),
        provenanceEntry('/batch/model/controllerMapping', null, 'controller_mapping', 'container', ['agent_hypothesized'], [batch.id], methodEvidenceIds, methodSourceIds, MODEL_MANIFEST.controllerMapping.statement),
        provenanceEntry('/batch/conditionRuns', null, 'simulation_run_collection', 'container', ['simulation_predicted'], [batch.id], hypothesis.evidenceIds, uniqueStrings([...supportingSourceIds, ...modelSourceIds]), 'Seeded model outputs; not measurements from animals.'),
        ...lineageAnalyses.map((analysis, index) => provenanceEntry(`/analyses/${index}`, analysis.id, 'behavior_analysis', 'artifact', analysis.provenance, [analysis.batchId], hypothesis.evidenceIds, uniqueStrings([...supportingSourceIds, ...modelSourceIds]), analysis.warning)),
        provenanceEntry('/comparison', comparison.id, 'trial_comparison', 'artifact', comparison.provenance, comparison.analysisIds, hypothesis.evidenceIds, uniqueStrings([...supportingSourceIds, ...modelSourceIds]), 'Ranking of simulation-derived analyses; not biological evidence.'),
        provenanceEntry('/comparison/proposal', comparison.proposal.id, 'follow_up_proposal', 'artifact', [comparison.proposal.provenance], [comparison.id], hypothesis.evidenceIds, supportingSourceIds, 'Proposal only; execution is not authorized.'),
        provenanceEntry('/datasets', null, 'dataset_manifest', 'container', ['derived'], [], [], DATASET_MANIFEST_SOURCE_IDS, 'Pinned dataset, software-reference, and visual-reference metadata. Visual references are explicitly ineligible for hypothesis support.'),
        provenanceEntry('/model', null, 'model_manifest', 'container', ['derived'], [], methodEvidenceIds, methodSourceIds, MODEL_MANIFEST.boundary),
        provenanceEntry('/model/controllerMapping', null, 'controller_mapping', 'container', ['agent_hypothesized'], [], methodEvidenceIds, methodSourceIds, MODEL_MANIFEST.controllerMapping.statement),
      ];
      const payload = {
        format: 'flylab.evidence-bundle.v2',
        annotation,
        supportingSources,
        supportingEvidence,
        contextSources,
        contextEvidence,
        methodSources,
        methodEvidence,
        circuit,
        hypothesis,
        experiment,
        batch,
        analyses: lineageAnalyses,
        comparison,
        datasets: DATASET_MANIFEST,
        model: MODEL_MANIFEST,
        provenanceManifest: {
          schema_version: 'flylab.provenance-manifest.v1',
          path_scope: 'JSON Pointer paths relative to this payload; each entry labels its complete subtree unless a narrower entry overrides it.',
          entries: payloadProvenanceEntries,
          operational_paths: ['/annotation', '/provenanceManifest'],
          untrusted_annotation_boundary: annotation.boundary,
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
            [...supportingSources, ...contextSources, ...methodSources].forEach((source) => indexProvenance(source.id, ['derived']));
            [...supportingEvidence, ...contextEvidence, ...methodEvidence].forEach((record) => indexProvenance(record.id, [record.provenance]));
            indexProvenance(circuit.id, circuit.provenance);
            indexProvenance(hypothesis.id, [hypothesis.provenance]);
            indexProvenance(experiment.id, experiment.provenance);
            experiment.conditions.forEach((condition) => indexProvenance(condition.id, experiment.provenance));
            indexProvenance(batch.id, batch.provenance);
            batch.conditionRuns.flatMap((run) => run.runIds).forEach((id) => indexProvenance(id, batch.provenance));
            lineageAnalyses.forEach((record) => indexProvenance(record.id, record.provenance));
            indexProvenance(comparison.id, comparison.provenance);
            indexProvenance(comparison.proposal.id, [comparison.proposal.provenance]);
            const bundleId = `evidence_${stableHash({ manifestHash, title: annotation.title })}`;
            indexProvenance(bundleId, ['derived']);
            const provenanceIndex = Object.fromEntries(
              (Object.entries(provenanceSets) as Array<[ProvenanceLabel, Set<string>]>).map(([label, ids]) => [label, [...ids].sort()]),
            ) as Record<ProvenanceLabel, string[]>;
            const provenanceCounts = Object.fromEntries(
              (Object.entries(provenanceIndex) as Array<[ProvenanceLabel, string[]]>).map(([label, ids]) => [label, ids.length]),
            ) as Record<ProvenanceLabel, number>;
            const allEvidence = [...supportingEvidence, ...contextEvidence, ...methodEvidence];
            const baseLineageEdges = [
              ...allEvidence.flatMap((record) => record.sourceIds.map((sourceId) => ({ from: record.id, relation: 'supported_by', to: sourceId }))),
              ...circuit.evidenceIds.map((evidenceId) => ({ from: circuit.id, relation: 'catalogs_evidence', to: evidenceId })),
              { from: hypothesis.id, relation: 'targets_circuit', to: circuit.id },
              ...hypothesis.evidenceIds.map((evidenceId) => ({ from: hypothesis.id, relation: 'cites_hypothesis_support', to: evidenceId })),
              { from: experiment.id, relation: 'tests_hypothesis', to: hypothesis.id },
              { from: experiment.id, relation: 'targets_circuit', to: circuit.id },
              ...experiment.conditions.map((condition) => ({ from: experiment.id, relation: 'has_condition', to: condition.id })),
              { from: batch.id, relation: 'executes_experiment', to: experiment.id },
              ...batch.conditionRuns.flatMap((run) => run.runIds.map((runId) => ({ from: batch.id, relation: `contains_run_for:${run.conditionId}`, to: runId }))),
              ...lineageAnalyses.map((analysis) => ({ from: analysis.id, relation: 'analyzes_batch', to: batch.id })),
              ...comparison.analysisIds.map((analysisId) => ({ from: comparison.id, relation: 'compares_analysis', to: analysisId })),
              { from: comparison.proposal.id, relation: 'proposed_from_comparison', to: comparison.id },
            ];
            const includedIds = uniqueStrings([
              ...supportingSourceIds,
              ...contextSourceIds,
              ...methodSourceIds,
              ...hypothesis.evidenceIds,
              ...contextEvidenceIds,
              ...methodEvidenceIds,
              circuit.id,
              hypothesisId,
              experimentId,
              ...experiment.conditions.map((condition) => condition.id),
              batch.id,
              ...batch.conditionRuns.flatMap((run) => run.runIds),
              ...lineageAnalysisIds,
              comparison.id,
              comparison.proposal.id,
              annotation.id,
            ]);
            const lineageEdges = [
              ...baseLineageEdges,
              ...includedIds
                .filter((id) => id !== annotation.id && id !== bundleId)
                .map((id) => ({ from: bundleId, relation: 'includes', to: id })),
            ];
            const bundle: EvidenceBundleMetadata = {
              id: bundleId,
              title: annotation.title,
              manifestHash,
              savedAt: new Date().toISOString(),
              includedIds,
              supportingEvidenceIds: hypothesis.evidenceIds,
              supportingSourceIds,
              contextEvidenceIds,
              contextSourceIds,
              methodEvidenceIds,
              methodSourceIds,
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
      return {
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
              ]),
              completed.bundle.boundary,
            ),
            ...payloadProvenanceEntries.map((entry) => ({
              ...entry,
              path: `/evidence_export/payload${entry.path}`,
            })),
          ],
          operationalPaths: [
            '/evidence_export/schema',
            '/evidence_export/schemaVersion',
            '/evidence_export/bundle',
            '/evidence_export/integrity',
            '/evidence_export/payload/annotation',
            '/evidence_export/payload/provenanceManifest',
            '/export_media_type',
            '/export_filename',
            '/local_reference',
            '/storage_scope',
            '/next_action',
          ],
        },
        stateRevision: completed.stateRevision,
      };
    },
  }), [commit, getAgentContext, pushActivity]);

  useEffect(() => {
    let disposed = false;
    let registration: { supported: boolean; dispose(): void } | null = null;
    installFlyLabWebMCP(actions).then((result) => {
      if (disposed) {
        result.dispose();
        return;
      }
      registration = result;
      setWebmcpStatus(result.supported ? 'active' : 'unsupported');
    }).catch((error) => {
      console.error('FlyLab WebMCP registration failed', error);
      if (!disposed) setWebmcpStatus('failed');
    });
    return () => {
      disposed = true;
      registration?.dispose();
    };
  }, [actions]);

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
      const validatedInput = validateToolInput(name, input);
      return await actions[name](validatedInput, { signal: controller.signal, actor });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The action could not complete.');
      return null;
    }
  }, [actions]);

  const investigate = useCallback(async () => {
    const found = await invoke('find_fly_circuits', {
      query: labRef.current.goal,
      behavior: 'backward_walking',
      evidence_labels: ['measured', 'derived', 'connectome_inferred'],
      limit: 5,
    }, 'guided_example');
    if (!found) return;
    const hypothesisResult = await invoke('draft_fly_hypothesis', {
      circuit_id: 'circuit_mdn_adult',
      claim: 'In FlyLab, a bilateral MDN-inspired model drive will increase predicted backward-walking initiation relative to baseline and sham conditions.',
      predicted_behavior: 'backward_walking',
      perturbation: 'activate',
      evidence_ids: ['E-MDN-ACTIVATION-001', 'E-MDN-LATERALITY-006', 'E-BANC-PATH-003'],
      falsification_criterion: 'The model shows no increase in reverse initiation or backward distance relative to both controls.',
    }, 'guided_example');
    if (!hypothesisResult || !labRef.current.hypothesis) return;
    await invoke('design_stimulation_trial', {
      hypothesis_id: labRef.current.hypothesis.id,
      target_circuit_id: 'circuit_mdn_adult',
      perturbation: 'activate',
      laterality: 'bilateral',
      activation_level: 0.65,
      onset_ms: 1000,
      duration_ms: 2000,
      trial_duration_ms: 5000,
      replicates: 8,
      include_baseline: true,
      include_sham_control: true,
      seed: 73142,
    }, 'guided_example');
  }, [invoke]);

  const approveExperiment = useCallback(() => {
    if (!labRef.current.experiment) return;
    const next = commit((current) => pushActivity({
      ...current,
      stage: 'run',
      experiment: current.experiment ? { ...current.experiment, approved: true } : null,
    }, {
      title: 'Protocol approved by human',
      detail: 'The agent may now execute this exact experiment and seed manifest.',
      status: 'complete',
      actor: 'human_ui',
    }));
    setNotice('Approved. The simulation tool can now run the exact visible protocol.');
    return next;
  }, [commit, pushActivity]);

  const runExperiment = useCallback(async () => {
    const experiment = labRef.current.experiment;
    if (!experiment) return;
    await invoke('run_fly_simulation', { experiment_id: experiment.id });
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
      metrics: ['backward_distance_mm', 'signed_speed_mm_s', 'response_latency_ms', 'heading_change_deg', 'stance_stability'],
    });
  }, [invoke]);

  const compareExperiment = useCallback(async () => {
    const analysis = labRef.current.analyses[0];
    if (!analysis) return;
    await invoke('compare_fly_trials', {
      analysis_ids: [analysis.id],
      objective_metric: 'backward_distance_mm',
      objective: 'maximize',
    });
  }, [invoke]);

  const saveEvidence = useCallback(async () => {
    const current = labRef.current;
    if (!current.hypothesis || !current.experiment || !current.batch || !current.analyses.length || !current.comparison) return;
    await invoke('save_fly_evidence', {
      title: evidenceBundleTitle(current.experiment.perturbation, current.hypothesis.predictedBehavior),
      hypothesis_id: current.hypothesis.id,
      experiment_id: current.experiment.id,
      batch_ids: [current.batch.id],
      analysis_ids: current.comparison.analysisIds,
      comparison_id: current.comparison.id,
      note: 'Challenge demonstration bundle. Interpret as model evidence only.',
    });
  }, [invoke]);

  const agentContext = buildFlyLabAgentContext(agentSnapshot(lab, simulationRunning, evidenceSaveRunning));
  const agentHandoff = buildFlyLabAgentHandoff(agentContext, webmcpStatus);
  const agentRuntime = agentHandoff.transport;
  const toolsCallable = agentRuntime.agent_invocation_available;
  const agentBrief = JSON.stringify(agentHandoff, null, 2);

  const copyAgentBrief = async () => {
    try {
      await navigator.clipboard.writeText(agentBrief);
      setNotice('Versioned JSON recovery packet copied. It is scoped to this open FlyLab page.');
    } catch {
      setNotice('Clipboard access was unavailable. The same packet remains embedded at #flylab-agent-handoff.');
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
    setNotice(`Downloaded ${link.download}. Keep it with the analysis it supports.`);
  }, []);

  const editExperiment = useCallback((field: 'activationLevel' | 'durationMs' | 'replicates', value: number) => {
    commit((current) => {
      if (!current.experiment) return current;
      const source = current.experiment;
      const updated = designExperiment({
        hypothesisId: source.hypothesisId,
        targetCircuitId: source.targetCircuitId,
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
      return pushActivity({ ...current, stage: 'design', experiment: updated, batch: null, analyses: [], comparison: null, bundle: null, evidenceExport: null }, {
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
    if (!lab.hypothesis || !lab.experiment) return { label: 'Run guided example', action: investigate, detail: 'local walkthrough using the same validated actions' };
    if (!lab.experiment.approved) return {
      label: 'Review exact protocol',
      action: () => document.getElementById('protocol-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      detail: `approval is beside all ${lab.experiment.conditions.length} arms and exact identifiers`,
    };
    if (!lab.batch) return { label: `Run MDN-inspired ${lab.experiment.perturbation === 'silence' ? 'suppression' : 'drive'}`, action: runExperiment, detail: `seed ${lab.experiment.seed.toLocaleString()}` };
    if (!lab.analyses.length) return { label: 'Analyze behavior', action: analyzeExperiment, detail: '5 predefined required metrics' };
    if (!lab.comparison) return { label: 'Choose next experiment', action: compareExperiment, detail: `bounded to ${lab.nextTrialBudget} proposed replicates` };
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
    active: '8 tools live',
    unsupported: 'unavailable in this browser',
    failed: 'tool registration failed',
  }[webmcpStatus];
  const agentNextDisplay = agentContext.next_tool
    ?? (agentContext.next_action.blocked_by ? `blocked · ${agentContext.next_action.blocked_by}` : agentContext.agent_status);
  const humanGate = !lab.experiment
    ? 'required before any simulation'
    : lab.experiment.approved
      ? 'approved for this exact protocol'
      : 'waiting for protocol approval';
  const handoffStatus = webmcpStatus === 'checking'
    ? 'Checking whether this browser can call site tools'
    : webmcpStatus === 'unsupported'
      ? 'Tool calls are unavailable in this browser'
      : webmcpStatus === 'failed'
        ? 'Tool registration failed safely'
        : agentContext.next_tool
          ? 'Agent has a callable next tool'
          : agentContext.next_action.kind === 'human_gate'
            ? 'Agent is correctly paused'
            : agentContext.agent_status;

  return (
    <main className="lab-shell">
      <script id="flylab-agent-context" type="application/json">{JSON.stringify(agentContext).replaceAll('<', '\\u003c')}</script>
      <script id="flylab-agent-runtime" type="application/json">{JSON.stringify(agentRuntime).replaceAll('<', '\\u003c')}</script>
      <script id="flylab-agent-handoff" type="application/json">{JSON.stringify(agentHandoff).replaceAll('<', '\\u003c')}</script>
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
        data-next-input-refs={toolsCallable ? JSON.stringify(agentContext.next_action.input_refs) : '{}'}
        data-workflow-next-input-refs={JSON.stringify(agentContext.next_action.input_refs)}
        data-webmcp-status={webmcpStatus}
        data-tools-callable={webmcpStatus === 'active'}
      >
        <div className="agent-bridge-identity">
          <span><i /> WebMCP site tools</span>
          <strong>{siteToolStatus}</strong>
          {webmcpStatus !== 'active' && <a className="agent-contract-link" href="/flylab-tool-contracts.json">exact contracts ↗</a>}
        </div>
        <div>
          <span>Shared page session</span>
          <strong>r{lab.revision} · {agentContext.agent_status}</strong>
        </div>
        <div>
          <span>Next workflow action</span>
          <code>{agentNextDisplay}</code>
        </div>
        <div className="agent-bridge-gate">
          <span>Supervisor review gate</span>
          <strong>{humanGate}</strong>
        </div>
      </section>

      <section className="workspace" id="workspace">
        <aside className="workflow-rail">
          <div className="goal-block">
            <p className="eyebrow">Supervisor mission boundary</p>
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
            <p className="goal-hint">Drafting does not change agent state. Commit once; then <code>inspect_flylab_state</code> exposes the new revision.</p>
          </div>

          <nav className="agent-run-graph" role="list" aria-label="Agent tool pipeline">
            <div className="section-title-row agent-run-heading">
              <p className="eyebrow">Agent run graph</p>
              <span>{agentContext.pipeline.filter((step) => step.status === 'complete').length}/{agentContext.pipeline.length - 1} complete</span>
            </div>
            {agentContext.pipeline.map((step, index) => (
              <div className={`agent-run-step ${step.status} ${step.kind}`} role="listitem" aria-label={`${step.title}: ${step.status.replace('_', ' ')}. ${step.boundary}`} key={step.name}>
                <span>{step.kind === 'human_gate' ? 'H' : String(index).padStart(2, '0')}</span>
                <div><strong>{step.title}</strong><code>{step.name}</code><small className="agent-step-status">{step.status.replace('_', ' ')}</small></div>
                <i />
              </div>
            ))}
          </nav>

          <section className="agent-activity" aria-labelledby="agent-activity-title">
            <div className="section-title-row">
              <p className="eyebrow" id="agent-activity-title">Shared audit activity</p>
              <span className={`tool-status ${webmcpStatus === 'active' ? 'live' : ''}`}>{siteToolStatus}</span>
            </div>
            {lab.activity.slice(0, 3).map((item) => (
              <article className={`activity-row ${item.status}`} key={item.id}>
                <i />
                <div>
                  <strong>{item.title}</strong>
                  {(item.toolName || item.actor) && <small className="activity-contract">{item.toolName && <code>{item.toolName}</code>}<span>{item.actor?.replace('_', ' ')} · r{item.revision}</span></small>}
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </section>

          <section className="agent-handoff-rail" aria-labelledby="agent-handoff-title">
            <div className="section-title-row"><p className="eyebrow" id="agent-handoff-title">Primary interface</p><span>WebMCP</span></div>
            <strong>{handoffStatus}</strong>
            <code>{agentNextDisplay}</code>
            <small>Fresh state first: <b>inspect_flylab_state</b> · r{lab.revision}</small>
            {webmcpStatus === 'unsupported' && (
              <p className="agent-runtime-fallback">
                This page still exposes its <a href="/flylab-agent-manifest.json">agent manifest</a>, <a href="/flylab-tool-contracts.json">exact tool schemas</a>, and inline state for inspection. Those references do not make tools callable; execution requires a compatible WebMCP runtime.
              </p>
            )}
            <button type="button" onClick={() => void copyAgentBrief()}>Copy live agent handoff</button>
          </section>

          <div className="manual-action-wrap">
            <span>Optional local UI test</span>
            <button className="manual-action" type="button" onClick={() => void primaryAction.action()}>
              <span>{primaryAction.label}</span><b aria-hidden="true">→</b>
            </button>
            <small>{primaryAction.detail}. This optional walkthrough mirrors the tool workflow for a supervisor; it is not the primary agent interface.</small>
          </div>
        </aside>

        <section className="main-stage" aria-labelledby="arena-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Human audit viewport</p>
              <h1 id="arena-title">{arenaView === 'circuit' ? <>BANC v888 circuit <span>· Three.js reconstruction</span></> : <>Open-field trial <span>· Three.js 3D fly</span></>}</h1>
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
              <strong>{activePoint?.active ? `unitless MDN-inspired ${lab.experiment?.perturbation === 'silence' ? 'suppression' : 'drive'}` : lab.batch ? 'replay' : 'preview'}</strong>
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
          <div className="timeline-labels"><span>{lab.experiment ? 'baseline' : 'no protocol'}</span><strong>{lab.experiment ? `unitless MDN-inspired ${lab.experiment.perturbation === 'silence' ? 'suppression' : 'drive'}` : 'no model target window'}</strong><span>{lab.experiment ? 'recovery' : 'awaiting design'}</span></div>

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
              {!lab.experiment && <p className="empty-inline">No condition artifacts exist yet. A valid design must add baseline and model-sham controls plus the requested perturbation arm; bilateral designs also add left-only and right-only comparisons.</p>}
            </div>
          </section>

          {analysis && (
            <section className="results-panel" aria-labelledby="results-title">
              <div className="section-title-row"><div><p className="eyebrow">Behavior analysis</p><h2 id="results-title">{bestResult?.label ?? 'Selected model condition'}</h2></div><div className="badge-pair"><Badge kind="derived" /><Badge kind="simulation_predicted" /></div></div>
              <div className="metric-grid">
                <article><span>Reverse initiation</span><strong>{Math.round((bestResult?.reverseInitiationProbability ?? 0) * 100)}%</strong><small>of seeded runs</small></article>
                <article><span>Backward distance</span><strong>{round(bestResult?.backwardDistanceMm ?? 0)} <i>model mm</i></strong><small>uncalibrated condition mean</small></article>
                <article><span>Signed speed</span><strong>{round(bestResult?.signedSpeedMmS ?? 0)} <i>model mm/s</i></strong><small>uncalibrated · negative = backward</small></article>
                <article><span>Response latency</span><strong>{bestResult?.responseLatencyMs === null || bestResult?.responseLatencyMs === undefined ? 'n/a' : <>{Math.round(bestResult.responseLatencyMs)} <i>ms</i></>}</strong><small>from nominal onset · {bestResult?.responsiveN ?? 0}/{bestResult?.n ?? 0} responsive runs</small></article>
                <article><span>Heading change</span><strong>{round(Math.abs(bestResult?.headingChangeDeg ?? 0))} <i>deg</i></strong><small>absolute condition mean</small></article>
                <article><span>Stance stability</span><strong>{round(bestResult?.stanceStability ?? 0, 3)}</strong><small>unitless model index</small></article>
              </div>
              <p className="analysis-warning">{analysis.warning}</p>
            </section>
          )}
        </section>

        <aside className={`inspector-panel ${lab.experiment && !lab.batch ? 'protocol-review-active' : ''}`}>
          <section className="agent-context-card" aria-labelledby="agent-brief-title">
            <div className="section-title-row"><p className="eyebrow" id="agent-brief-title">Agent runtime contract</p><span>{toolsCallable ? agentContext.agent_status : webmcpStatus === 'checking' ? 'checking' : 'read-only'}</span></div>
            <h2>{toolsCallable ? 'WebMCP-operable. Supervisor-auditable. Scientifically bounded.' : webmcpStatus === 'checking' ? 'Checking WebMCP availability.' : 'Contracts present. WebMCP invocation unavailable here.'}</h2>
            <p>{toolsCallable ? 'The agent works through typed site tools and exact artifact references. This visual surface exists for supervision, approval, and scientific audit.' : webmcpStatus === 'checking' ? 'FlyLab assumes zero callable tools until all eight registrations succeed.' : 'This browser has zero registered FlyLab tools. The page exposes read-only contract, runtime, and workflow-state JSON without pretending those documents are an alternate execution transport.'}</p>
            <div className="agent-next-card">
              <span>{toolsCallable ? (agentContext.next_tool ? 'Invocable site tool' : 'Agent is blocked') : 'Workflow recommendation only'}</span>
              <code>{agentNextDisplay}</code>
              <small>{toolsCallable ? agentContext.next_action.reason : 'Not callable in this browser. Use a compatible WebMCP runtime, then inspect fresh state.'}</small>
            </div>
            <dl className="agent-artifact-ids">
              <div><dt>State</dt><dd>r{lab.revision}</dd></div>
              <div><dt>Circuit</dt><dd>{agentContext.artifacts.selected_circuit_id ?? 'not created'}</dd></div>
              <div><dt>Experiment</dt><dd>{agentContext.artifacts.experiment_id ?? 'not created'}</dd></div>
              <div><dt>Batch</dt><dd>{agentContext.artifacts.batch_id ?? 'not created'}</dd></div>
              <div><dt>Analysis</dt><dd>{agentContext.artifacts.analysis_ids.join(' · ') || 'not created'}</dd></div>
              <div><dt>Comparison</dt><dd>{agentContext.artifacts.comparison_id ?? 'not created'}</dd></div>
              <div><dt>Bundle</dt><dd>{agentContext.artifacts.evidence_bundle_id ?? 'not created'}</dd></div>
            </dl>
            <button type="button" onClick={() => void copyAgentBrief()}>Copy live recovery packet</button>
          </section>

          <section className="autonomy-card">
            <div className="section-title-row"><p className="eyebrow">Bounded autoresearch</p>{lab.comparison ? <div className="badge-pair">{lab.comparison.provenance.map((kind) => <Badge key={kind} kind={kind} />)}</div> : <span>propose only</span>}</div>
            <label><span>Next-trial budget</span><select value={lab.nextTrialBudget} onChange={(event) => changeNextTrialBudget(Number(event.target.value))}><option value="2">2 replicates</option><option value="5">5 replicates</option><option value="10">10 replicates</option></select></label>
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

          <section className={`hypothesis-card ${lab.hypothesis ? '' : 'empty-artifact'}`}>
            <div className="section-title-row"><p className="eyebrow">Current hypothesis</p>{lab.hypothesis && <Badge kind="agent_hypothesized" />}</div>
            <h2>{lab.hypothesis?.claim ?? 'No hypothesis artifact'}</h2>
            <p>{lab.hypothesis?.falsificationCriterion ?? 'Call draft_fly_hypothesis after discovery. FlyLab will not display a claim before the agent creates one.'}</p>
            {lab.hypothesis && <small className="artifact-lineage">Causal support <code>{lab.hypothesis.causalEvidenceIds.join(' · ')}</code><br />Full cited set <code>{lab.hypothesis.evidenceIds.join(' · ')}</code></small>}
          </section>

          <section className={`target-card ${selectedCircuit ? '' : 'empty-artifact'}`}>
            <div className="neuron-orbit" aria-hidden="true"><i /><i /><i /></div>
            <div><div className="target-card-heading"><span>Neural target</span>{selectedCircuit && <Badge kind={selectedCircuit.provenance[0]} />}</div><strong>{selectedCircuit?.name ?? 'No circuit selected'}</strong><small>{selectedCircuit ? `${selectedCircuit.id} · ${selectedCircuit.summary}` : 'Call find_fly_circuits to create the selected-circuit artifact.'}</small></div>
          </section>

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
                  <button className="protocol-approval-action" type="button" onClick={approveExperiment} disabled={simulationRunning}>
                    <strong>Approve this exact experiment</strong>
                    <small>{lab.experiment.id} · {lab.experiment.conditions.length} arms · {lab.experiment.replicates} replicates each</small>
                  </button>
                ) : <p className="protocol-approved-note">Human approval applies only to <code>{lab.experiment.id}</code>. Any edit revokes it and clears downstream artifacts.</p>}
              </>
            )}
          </section>

          <section className="evidence-summary">
            <div className="section-title-row"><p className="eyebrow">Evidence boundaries</p><button type="button" onClick={() => setEvidenceOpen(true)}>inspect all ↗</button></div>
            <div className="evidence-badges">
              {(Object.keys(provenanceMeta) as ProvenanceLabel[]).map((kind) => <Badge key={kind} kind={kind} />)}
            </div>
            <p>{MODEL_MANIFEST.boundary}</p>
          </section>

        </aside>
      </section>

      <footer className="lab-footer" aria-live="polite">
        <p><span className="agent-pulse" /> {notice}</p>
        <p>{lab.bundle ? `${lab.bundle.id} · ${lab.bundle.manifestHash.slice(0, 22)}…` : `state revision ${lab.revision}`}</p>
        <div className="footer-tools"><span>{webmcpStatus === 'active' ? 'WebMCP active' : 'WebMCP contracts published'}</span><span>{webmcpStatus === 'active' ? '8 callable tools' : '8 published contracts'}</span><a href="/flylab-tool-contracts.json">agent contracts</a><a href="/THIRD_PARTY_LICENSES.txt">licenses</a></div>
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
                {lab.bundle && <button className={`bundle-record ${selectedBundle ? 'active' : ''}`} type="button" aria-current={selectedBundle ? 'true' : undefined} onClick={() => setSelectedEvidenceId(lab.bundle?.id ?? EVIDENCE[0].id)}><div className="badge-pair"><Badge kind={lab.bundle.provenance[0]} /><span className="provenance-badge untrusted_annotation"><i>U</i>Untrusted annotation</span></div><strong>{lab.bundle.title}</strong><small>{lab.bundle.id}</small></button>}
              </nav>
              {selectedBundle ? (
                <article className="evidence-detail bundle-detail">
                  <div className="badge-pair"><Badge kind={selectedBundle.provenance[0]} /><span className="provenance-badge untrusted_annotation"><i>U</i>Untrusted annotation</span></div>
                  <h3>{selectedBundle.title}</h3>
                  <p className="bundle-boundary">{selectedBundle.boundary}</p>
                  <dl>
                    <div><dt>Bundle ID</dt><dd><code>{selectedBundle.id}</code></dd></div>
                    <div><dt>Saved</dt><dd><time dateTime={selectedBundle.savedAt}>{new Date(selectedBundle.savedAt).toLocaleString()}</time></dd></div>
                    <div><dt>Manifest hash</dt><dd><code>{selectedBundle.manifestHash}</code></dd></div>
                    <div><dt>Supporting evidence</dt><dd><code>{selectedBundle.supportingEvidenceIds.join(' · ')}</code></dd></div>
                    <div><dt>Supporting sources</dt><dd><code>{selectedBundle.supportingSourceIds.join(' · ')}</code></dd></div>
                    <div><dt>Circuit-context evidence</dt><dd><code>{selectedBundle.contextEvidenceIds.join(' · ') || 'none'}</code></dd></div>
                    <div><dt>Circuit-context sources</dt><dd><code>{selectedBundle.contextSourceIds.join(' · ') || 'none'}</code></dd></div>
                    <div><dt>Model-method evidence</dt><dd><code>{selectedBundle.methodEvidenceIds.join(' · ')}</code></dd></div>
                    <div><dt>Model-method sources</dt><dd><code>{selectedBundle.methodSourceIds.join(' · ')}</code></dd></div>
                    <div><dt>Exact lineage</dt><dd>{selectedBundle.includedIds.length} identifiers: causal/supporting sources and evidence, separately scoped model-method sources and evidence, the selected circuit, hypothesis, experiment, batch, complete analysis set, comparison, and bounded administrative annotation</dd></div>
                    <div><dt>Provenance counts</dt><dd>{(Object.entries(selectedBundle.provenanceCounts) as Array<[ProvenanceLabel, number]>).filter(([, count]) => count > 0).map(([kind, count]) => `${kind} ${count}`).join(' · ')}</dd></div>
                    <div><dt>Administrative annotation</dt><dd><code>{selectedBundle.annotation.id}</code> · {selectedBundle.annotation.author.replace('_', ' ')} · {selectedBundle.annotation.trust} · {selectedBundle.annotation.boundary}{selectedBundle.annotation.note ? ` Note: ${selectedBundle.annotation.note}` : ''}</dd></div>
                  </dl>
                  <section className="evidence-download" aria-labelledby="evidence-download-title">
                    <h4 id="evidence-download-title">Portable export</h4>
                    <p>The versioned JSON contains this metadata and the complete payload used to calculate the manifest hash.</p>
                    <button type="button" onClick={downloadEvidence} disabled={!lab.evidenceExport}>
                      <strong>Download evidence JSON</strong>
                      <small>{evidenceExportFilename(selectedBundle.id)}</small>
                    </button>
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
                  <p className="evidence-coverage-note">Catalog coverage: validated adult MDN vertical slice. Records outside this release remain undiscoverable rather than inferred.</p>
                </article>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
