import { PROVENANCE_DEFINITIONS } from './flylab.js';
import type { Sha256Digest } from './experiment-approval.js';

export type AgentPipelineStatus =
  | 'available'
  | 'recommended'
  | 'blocked'
  | 'human_required'
  | 'running'
  | 'complete';

export interface FlyLabAgentSnapshot {
  revision: number;
  stage: string;
  goal: string;
  simulationRunning: boolean;
  evidenceSaveRunning: boolean;
  discoveryDecisionId: string | null;
  selectedCircuitId: string | null;
  discoveredEvidenceIds: string[];
  hypothesisEligibleEvidenceIds: string[];
  causalEvidenceIdsByPerturbation: {
    activate: string[];
    silence: string[];
  };
  hypothesisId: string | null;
  hypothesisEvidenceIds: string[];
  hypothesisPredictedBehavior: string | null;
  hypothesisPerturbation: 'activate' | 'silence' | null;
  experimentId: string | null;
  experimentApproved: boolean;
  approvalExperimentId: string | null;
  approvedProtocolHash: Sha256Digest | null;
  approvedSeedManifestHash: Sha256Digest | null;
  approvalTimestamp: string | null;
  conditionIds: string[];
  batchId: string | null;
  analysisIds: string[];
  analysisMetricsById: Record<string, string[]>;
  comparisonId: string | null;
  comparisonAnalysisIds: string[];
  bundleId: string | null;
  nextTrialBudget: number;
  artifactManifest: Record<string, unknown>;
}

export interface AgentPipelineStep {
  name: string;
  title: string;
  kind: 'tool' | 'human_gate';
  status: AgentPipelineStatus;
  boundary: string;
}

export const FLYLAB_AGENT_CONTEXT_VERSION = 'flylab.agent-context.v3';

function hasBoundExperimentApproval(snapshot: FlyLabAgentSnapshot) {
  return snapshot.experimentApproved
    && snapshot.experimentId !== null
    && snapshot.approvalExperimentId === snapshot.experimentId
    && snapshot.approvedProtocolHash !== null
    && snapshot.approvedSeedManifestHash !== null
    && snapshot.approvalTimestamp !== null;
}

export function deriveFlyLabAgentStage(snapshot: FlyLabAgentSnapshot) {
  if (snapshot.bundleId) return 'saved';
  if (snapshot.comparisonId || snapshot.analysisIds.length > 0) return 'continue';
  if (snapshot.batchId) return 'analyze';
  if (snapshot.experimentId) return hasBoundExperimentApproval(snapshot) ? 'run' : 'design';
  if (snapshot.hypothesisId) return 'design';
  if (snapshot.selectedCircuitId) return 'hypothesize';
  return 'discover';
}

export function buildFlyLabAgentContext(snapshot: FlyLabAgentSnapshot) {
  const hasCircuit = Boolean(snapshot.selectedCircuitId);
  const hasHypothesis = Boolean(snapshot.hypothesisId);
  const hasExperiment = Boolean(snapshot.experimentId);
  const hasBatch = Boolean(snapshot.batchId);
  const hasAnalysis = snapshot.analysisIds.length > 0;
  const hasComparison = Boolean(snapshot.comparisonId);
  const hasBundle = Boolean(snapshot.bundleId);
  const hasApproval = hasBoundExperimentApproval(snapshot);

  const pipeline: AgentPipelineStep[] = [
    {
      name: 'inspect_flylab_state',
      title: 'Inspect shared state',
      kind: 'tool',
      status: 'available',
      boundary: 'Read-only recovery of this page session, artifact IDs, blockers, and the next valid action.',
    },
    {
      name: 'find_fly_circuits',
      title: 'Search source-backed evidence',
      kind: 'tool',
      status: hasCircuit ? 'complete' : 'recommended',
      boundary: 'Curated adult evidence only; no simulation is run.',
    },
    {
      name: 'draft_fly_hypothesis',
      title: 'Draft a falsifiable hypothesis',
      kind: 'tool',
      status: hasHypothesis ? 'complete' : hasCircuit ? 'recommended' : 'blocked',
      boundary: 'Creates an agent_hypothesized claim, not evidence.',
    },
    {
      name: 'design_stimulation_trial',
      title: 'Design controlled conditions',
      kind: 'tool',
      status: hasExperiment ? 'complete' : hasHypothesis ? 'recommended' : 'blocked',
      boundary: 'Creates a visible draft protocol with controls, timing, replicates, and seed.',
    },
    {
      name: 'human_approval',
      title: 'Operator reviews exact protocol',
      kind: 'human_gate',
      status: hasApproval ? 'complete' : hasExperiment ? 'human_required' : 'blocked',
      boundary: 'Intentionally not a WebMCP tool. Any protocol edit revokes approval and clears downstream work.',
    },
    {
      name: 'run_fly_simulation',
      title: 'Run the approved virtual batch',
      kind: 'tool',
      status: hasBatch ? 'complete' : snapshot.simulationRunning ? 'running' : hasApproval ? 'recommended' : 'blocked',
      boundary: 'Reduced-order simulation only; no wet-lab action or neural dynamics.',
    },
    {
      name: 'analyze_fly_behavior',
      title: 'Quantify simulated behavior',
      kind: 'tool',
      status: hasAnalysis ? 'complete' : hasBatch ? 'recommended' : 'blocked',
      boundary: 'Metrics aggregate summaries derived from complete seeded state trajectories. The arena replays the exact selected run; the separately serialized condition illustration is compatibility-only and excluded from analysis.',
    },
    {
      name: 'compare_fly_trials',
      title: 'Rank and propose a follow-up',
      kind: 'tool',
      status: hasComparison ? 'complete' : hasAnalysis ? 'recommended' : 'blocked',
      boundary: 'May propose one bounded follow-up; execution is not authorized.',
    },
    {
      name: 'save_fly_evidence',
      title: 'Save the complete lineage',
      kind: 'tool',
      status: snapshot.evidenceSaveRunning ? 'running' : hasBundle ? 'complete' : hasComparison ? 'recommended' : 'blocked',
      boundary: 'Creates a provenance-rich browser-local bundle and portable JSON export.',
    },
  ];

  const next = snapshot.simulationRunning
    ? {
        kind: 'wait' as const,
        name: null,
        callable: false,
        blocked_by: 'run_fly_simulation is still running',
        reason: 'Wait for completion or use the visible operator cancel control.',
        input_refs: {},
      }
    : snapshot.evidenceSaveRunning
      ? {
          kind: 'wait' as const,
          name: null,
          callable: false,
          blocked_by: 'save_fly_evidence is still preparing',
          reason: 'Wait for the evidence bundle commit or cancellation before invoking another save.',
          input_refs: {},
        }
    : !hasCircuit
      ? { kind: 'tool' as const, name: 'find_fly_circuits', callable: true, blocked_by: null, reason: 'Begin with the bounded source-backed circuit search.', input_refs: {} }
      : !hasHypothesis
        ? { kind: 'tool' as const, name: 'draft_fly_hypothesis', callable: true, blocked_by: null, reason: 'Create a falsifiable claim using only discovered records marked hypothesis_support.', input_refs: { circuit_id: snapshot.selectedCircuitId, evidence_ids: snapshot.hypothesisEligibleEvidenceIds } }
        : !hasExperiment
          ? { kind: 'tool' as const, name: 'design_stimulation_trial', callable: true, blocked_by: null, reason: 'Create visible controls and a reproducible seed manifest.', input_refs: { hypothesis_id: snapshot.hypothesisId, target_circuit_id: snapshot.selectedCircuitId, perturbation: snapshot.hypothesisPerturbation } }
          : !hasApproval
            ? { kind: 'human_gate' as const, name: null, callable: false, blocked_by: 'human_approval', reason: 'The operator must review and authorize the exact visible protocol.', input_refs: { experiment_id: snapshot.experimentId } }
            : !hasBatch
              ? { kind: 'tool' as const, name: 'run_fly_simulation', callable: true, blocked_by: null, reason: 'The exact current experiment is approved for virtual execution.', input_refs: { experiment_id: snapshot.experimentId, approved_protocol_hash: snapshot.approvedProtocolHash } }
              : !hasAnalysis
                ? { kind: 'tool' as const, name: 'analyze_fly_behavior', callable: true, blocked_by: null, reason: 'Quantify the completed simulation batch.', input_refs: { batch_id: snapshot.batchId } }
                : !hasComparison
                  ? { kind: 'tool' as const, name: 'compare_fly_trials', callable: true, blocked_by: null, reason: 'Rank conditions and propose one bounded follow-up.', input_refs: { analysis_ids: snapshot.analysisIds, metrics_by_analysis_id: snapshot.analysisMetricsById } }
                  : !hasBundle
                    ? { kind: 'tool' as const, name: 'save_fly_evidence', callable: true, blocked_by: null, reason: 'Commit the complete source-to-result lineage.', input_refs: { scope: 'mission' as const, hypothesis_id: snapshot.hypothesisId, experiment_id: snapshot.experimentId, batch_ids: snapshot.batchId ? [snapshot.batchId] : [], analysis_ids: snapshot.comparisonAnalysisIds, comparison_id: snapshot.comparisonId } }
                    : { kind: 'complete' as const, name: null, callable: false, blocked_by: null, reason: 'Workflow complete. Review or download the saved evidence bundle.', input_refs: { evidence_bundle_id: snapshot.bundleId } };

  return {
    schema_version: FLYLAB_AGENT_CONTEXT_VERSION,
    page_session_scope: 'current_open_page',
    agent_status: next.kind === 'human_gate'
      ? 'waiting_for_human'
      : next.kind === 'wait'
        ? 'running'
      : next.kind === 'complete'
          ? 'complete'
          : 'ready',
    state: {
      revision: snapshot.revision,
      stage: deriveFlyLabAgentStage(snapshot),
      goal: snapshot.goal,
    },
    artifacts: {
      discovery_decision_id: snapshot.discoveryDecisionId,
      selected_circuit_id: snapshot.selectedCircuitId,
      discovered_evidence_ids: snapshot.discoveredEvidenceIds,
      hypothesis_eligible_evidence_ids: snapshot.hypothesisEligibleEvidenceIds,
      causal_evidence_ids_by_perturbation: snapshot.causalEvidenceIdsByPerturbation,
      hypothesis_id: snapshot.hypothesisId,
      hypothesis_evidence_ids: snapshot.hypothesisEvidenceIds,
      hypothesis_predicted_behavior: snapshot.hypothesisPredictedBehavior,
      hypothesis_perturbation: snapshot.hypothesisPerturbation,
      experiment_id: snapshot.experimentId,
      experiment_approved: hasApproval,
      approval_binding_complete: hasApproval,
      approval_experiment_id: snapshot.approvalExperimentId,
      approved_protocol_hash: snapshot.approvedProtocolHash,
      approved_seed_manifest_hash: snapshot.approvedSeedManifestHash,
      approval_timestamp: snapshot.approvalTimestamp,
      condition_ids: snapshot.conditionIds,
      batch_id: snapshot.batchId,
      analysis_ids: snapshot.analysisIds,
      analysis_metrics_by_id: snapshot.analysisMetricsById,
      comparison_id: snapshot.comparisonId,
      comparison_analysis_ids: snapshot.comparisonAnalysisIds,
      evidence_bundle_id: snapshot.bundleId,
    },
    artifact_manifest: snapshot.artifactManifest,
    next_action: next,
    next_tool: next.kind === 'tool' ? next.name : null,
    human_controls: {
      next_trial_budget: snapshot.nextTrialBudget,
    },
    human_gate: {
      id: 'approve_experiment',
      status: !hasExperiment ? 'not_applicable' : hasApproval ? 'satisfied' : 'required',
      subject_experiment_id: snapshot.experimentId,
      blocks_tool: 'run_fly_simulation',
      agent_can_satisfy: false,
      webmcp_tool_can_satisfy: false,
      scope: 'webmcp_site_tools',
      authorization_boundary: 'Approval is absent from the WebMCP tool surface and requires visible UI interaction. It is not identity-authenticated against general browser automation.',
      human_control_label: hasApproval ? 'Approved' : 'Approve experiment',
      approval_experiment_id: snapshot.approvalExperimentId,
      approved_protocol_hash: snapshot.approvedProtocolHash,
      approved_seed_manifest_hash: snapshot.approvedSeedManifestHash,
      approval_timestamp: snapshot.approvalTimestamp,
      follow_up_execution: 'not_authorized',
    },
    pipeline,
    interpretation_policy: {
      reported_empirical_observations: 'measured',
      deterministic_catalog_and_method_records: 'derived',
      structural_wiring: 'connectome_inferred',
      generated_trajectories: 'simulation_predicted',
      draft_protocols: 'agent_hypothesized',
      calculated_metrics: ['derived', 'simulation_predicted'],
      proposed_claims_and_follow_ups: 'agent_hypothesized',
    },
    provenance_policy: {
      definitions: PROVENANCE_DEFINITIONS,
      inheritance: 'Each artifact_manifest record labels its complete scientific subtree unless a more specific nested record provides its own provenance.',
      operational_boundary: 'State revisions, blockers, next actions, UI labels, and storage references are operational metadata rather than scientific evidence.',
      untrusted_annotation: 'Caller-supplied goals, titles, and notes are administrative input and are never counted as scientific provenance.',
    },
    session_warning: 'Tool artifact IDs belong to this open page session. Inspect state again after interruption, edits, cancellation, or navigation.',
  };
}
