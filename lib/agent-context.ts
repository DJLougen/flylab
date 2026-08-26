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
  selectedCircuitId: string | null;
  hypothesisId: string | null;
  experimentId: string | null;
  experimentApproved: boolean;
  conditionIds: string[];
  batchId: string | null;
  analysisIds: string[];
  comparisonId: string | null;
  bundleId: string | null;
  nextTrialBudget: number;
}

export interface AgentPipelineStep {
  name: string;
  title: string;
  kind: 'tool' | 'human_gate';
  status: AgentPipelineStatus;
  boundary: string;
}

export const FLYLAB_AGENT_CONTEXT_VERSION = 'flylab.agent-context.v1';

export function buildFlyLabAgentContext(snapshot: FlyLabAgentSnapshot) {
  const hasCircuit = Boolean(snapshot.selectedCircuitId);
  const hasHypothesis = Boolean(snapshot.hypothesisId);
  const hasExperiment = Boolean(snapshot.experimentId);
  const hasBatch = Boolean(snapshot.batchId);
  const hasAnalysis = snapshot.analysisIds.length > 0;
  const hasComparison = Boolean(snapshot.comparisonId);
  const hasBundle = Boolean(snapshot.bundleId);

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
      title: 'Person reviews exact protocol',
      kind: 'human_gate',
      status: snapshot.experimentApproved ? 'complete' : hasExperiment ? 'human_required' : 'blocked',
      boundary: 'Intentionally not a WebMCP tool. Any protocol edit revokes approval and clears downstream work.',
    },
    {
      name: 'run_fly_simulation',
      title: 'Run the approved virtual batch',
      kind: 'tool',
      status: hasBatch ? 'complete' : snapshot.simulationRunning ? 'running' : snapshot.experimentApproved ? 'recommended' : 'blocked',
      boundary: 'Reduced-order simulation only; no wet-lab action or neural dynamics.',
    },
    {
      name: 'analyze_fly_behavior',
      title: 'Quantify simulated behavior',
      kind: 'tool',
      status: hasAnalysis ? 'complete' : hasBatch ? 'recommended' : 'blocked',
      boundary: 'Metrics are derived from simulation-predicted trajectories.',
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
      status: hasBundle ? 'complete' : hasComparison ? 'recommended' : 'blocked',
      boundary: 'Creates a provenance-rich browser-local bundle and portable JSON export.',
    },
  ];

  const next = snapshot.simulationRunning
    ? {
        kind: 'wait' as const,
        name: null,
        callable: false,
        blocked_by: 'run_fly_simulation is still running',
        reason: 'Wait for completion or use the visible human cancel control.',
        input_refs: {},
      }
    : !hasCircuit
      ? { kind: 'tool' as const, name: 'find_fly_circuits', callable: true, blocked_by: null, reason: 'Begin with the bounded source-backed circuit search.', input_refs: {} }
      : !hasHypothesis
        ? { kind: 'tool' as const, name: 'draft_fly_hypothesis', callable: true, blocked_by: null, reason: 'Create a falsifiable claim linked to returned evidence IDs.', input_refs: { circuit_id: snapshot.selectedCircuitId } }
        : !hasExperiment
          ? { kind: 'tool' as const, name: 'design_stimulation_trial', callable: true, blocked_by: null, reason: 'Create visible controls and a reproducible seed manifest.', input_refs: { hypothesis_id: snapshot.hypothesisId, target_circuit_id: snapshot.selectedCircuitId } }
          : !snapshot.experimentApproved
            ? { kind: 'human_gate' as const, name: null, callable: false, blocked_by: 'human_approval', reason: 'A person must review and approve the exact visible protocol.', input_refs: { experiment_id: snapshot.experimentId } }
            : !hasBatch
              ? { kind: 'tool' as const, name: 'run_fly_simulation', callable: true, blocked_by: null, reason: 'The exact current experiment is approved for virtual execution.', input_refs: { experiment_id: snapshot.experimentId } }
              : !hasAnalysis
                ? { kind: 'tool' as const, name: 'analyze_fly_behavior', callable: true, blocked_by: null, reason: 'Quantify the completed simulation batch.', input_refs: { batch_id: snapshot.batchId } }
                : !hasComparison
                  ? { kind: 'tool' as const, name: 'compare_fly_trials', callable: true, blocked_by: null, reason: 'Rank conditions and propose one bounded follow-up.', input_refs: { analysis_ids: snapshot.analysisIds } }
                  : !hasBundle
                    ? { kind: 'tool' as const, name: 'save_fly_evidence', callable: true, blocked_by: null, reason: 'Commit the complete source-to-result lineage.', input_refs: { hypothesis_id: snapshot.hypothesisId, experiment_id: snapshot.experimentId, batch_ids: snapshot.batchId ? [snapshot.batchId] : [], analysis_ids: snapshot.analysisIds, comparison_id: snapshot.comparisonId } }
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
      stage: snapshot.stage,
      goal: snapshot.goal,
    },
    artifacts: {
      selected_circuit_id: snapshot.selectedCircuitId,
      hypothesis_id: snapshot.hypothesisId,
      experiment_id: snapshot.experimentId,
      experiment_approved: snapshot.experimentApproved,
      condition_ids: snapshot.conditionIds,
      batch_id: snapshot.batchId,
      analysis_ids: snapshot.analysisIds,
      comparison_id: snapshot.comparisonId,
      evidence_bundle_id: snapshot.bundleId,
    },
    next_action: next,
    next_tool: next.kind === 'tool' ? next.name : null,
    human_controls: {
      next_trial_budget: snapshot.nextTrialBudget,
    },
    human_gate: {
      id: 'approve_experiment',
      status: !hasExperiment ? 'not_applicable' : snapshot.experimentApproved ? 'satisfied' : 'required',
      subject_experiment_id: snapshot.experimentId,
      blocks_tool: 'run_fly_simulation',
      agent_can_satisfy: false,
      human_control_label: snapshot.experimentApproved ? 'Approved' : 'Approve experiment',
      follow_up_execution: 'not_authorized',
    },
    pipeline,
    interpretation_policy: {
      structural_wiring: 'connectome_inferred',
      generated_trajectories: 'simulation_predicted',
      calculated_metrics: ['derived', 'simulation_predicted'],
      proposed_claims_and_follow_ups: 'agent_hypothesized',
    },
    session_warning: 'Tool artifact IDs belong to this open page session. Inspect state again after interruption, edits, cancellation, or navigation.',
  };
}
