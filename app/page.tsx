'use client';

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BANC_V888_CELLS,
  BANC_V888_EDGES,
  BANC_V888_MDN_LBL40_TOTAL_CONTACTS,
  CIRCUITS,
  DATASET_MANIFEST,
  DEFAULT_GOAL,
  EVIDENCE,
  MODEL_MANIFEST,
  SOURCES,
  analyzeBatch,
  compareAnalyses,
  designExperiment,
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
  type FlyLabToolAction,
} from '@/lib/webmcp';

type Stage = 'discover' | 'hypothesize' | 'design' | 'run' | 'analyze' | 'continue' | 'saved';

const FlyBrain3D = lazy(() => import('@/components/FlyBrain3D').then((module) => ({ default: module.FlyBrain3D })));

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  status: 'complete' | 'running' | 'waiting';
}

interface EvidenceBundle {
  id: string;
  title: string;
  manifestHash: string;
  savedAt: string;
  includedIds: string[];
  provenanceCounts: Record<ProvenanceLabel, number>;
  boundary: string;
}

interface LabState {
  revision: number;
  stage: Stage;
  goal: string;
  selectedCircuitId: string | null;
  hypothesis: Hypothesis | null;
  experiment: Experiment | null;
  batch: SimulationBatch | null;
  analyses: Analysis[];
  comparison: Comparison | null;
  bundle: EvidenceBundle | null;
  activity: ActivityItem[];
}

const initialState: LabState = {
  revision: 1,
  stage: 'discover',
  goal: DEFAULT_GOAL,
  selectedCircuitId: null,
  hypothesis: null,
  experiment: null,
  batch: null,
  analyses: [],
  comparison: null,
  bundle: null,
  activity: [
    {
      id: 'activity_ready',
      title: 'Laboratory ready',
      detail: 'Waiting for a behavior goal or a WebMCP tool call.',
      status: 'waiting',
    },
  ],
};

const stages: Array<{ id: Exclude<Stage, 'saved'>; label: string }> = [
  { id: 'discover', label: 'Discover' },
  { id: 'hypothesize', label: 'Hypothesize' },
  { id: 'design', label: 'Design' },
  { id: 'run', label: 'Run' },
  { id: 'analyze', label: 'Analyze' },
  { id: 'continue', label: 'Continue' },
];

const provenanceMeta: Record<ProvenanceLabel, { label: string; short: string }> = {
  measured: { label: 'Measured', short: 'M' },
  derived: { label: 'Derived', short: 'D' },
  connectome_inferred: { label: 'Connectome inferred', short: 'C' },
  simulation_predicted: { label: 'Simulation predicted', short: 'S' },
  agent_hypothesized: { label: 'Agent hypothesis', short: 'A' },
};

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

export default function Home() {
  const [lab, setLab] = useState<LabState>(initialState);
  const labRef = useRef(lab);
  const [webmcpStatus, setWebmcpStatus] = useState<'checking' | 'active' | 'unsupported' | 'failed'>('checking');
  const [notice, setNotice] = useState('State a behavior goal, then ask the agent to investigate.');
  const [selectedConditionId, setSelectedConditionId] = useState('condition_bilateral');
  const [playhead, setPlayhead] = useState(0);
  const playheadRef = useRef(playhead);
  const [playing, setPlaying] = useState(false);
  const [arenaView, setArenaView] = useState<'body' | 'circuit' | 'trace'>('body');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(EVIDENCE[0].id);
  const [autoBudget, setAutoBudget] = useState(2);

  const commit = useCallback((producer: (current: LabState) => LabState) => {
    const next = producer(labRef.current);
    labRef.current = next;
    setLab(next);
    return next;
  }, []);

  const pushActivity = useCallback((current: LabState, item: Omit<ActivityItem, 'id'>) => ({
    ...current,
    revision: current.revision + 1,
    activity: [
      { ...item, id: `activity_${current.revision + 1}_${stableHash(item)}` },
      ...current.activity.map((entry) => entry.status === 'running' ? { ...entry, status: 'complete' as const } : entry),
    ].slice(0, 5),
  }), []);

  const actions = useMemo<Record<string, FlyLabToolAction>>(() => ({
    find_fly_circuits: async (input) => {
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
      const next = commit((current) => pushActivity({
        ...current,
        stage: matches.length ? 'hypothesize' : 'discover',
        selectedCircuitId: matches[0]?.id ?? current.selectedCircuitId,
      }, {
        title: matches.length ? 'Circuit evidence found' : 'No curated circuit matched',
        detail: matches.length ? `MDN selected with ${evidence.length} source-backed evidence records.` : 'Try MDN, backward walking, or retreat.',
        status: 'complete',
      }));
      setNotice(matches.length ? 'MDN is highlighted. The next step is a falsifiable hypothesis.' : 'No match in the bounded challenge catalog.');
      return {
        summary: matches.length ? `Found ${matches.length} curated adult circuit.` : 'No circuit matched the bounded catalog.',
        data: {
          circuits: matches,
          evidence: evidence.map((record) => ({ ...record, sources: SOURCES.filter((source) => record.sourceIds.includes(source.id)) })),
          connectome_records: {
            snapshot: 'banc_888',
            cells: BANC_V888_CELLS,
            edges: BANC_V888_EDGES,
            interpretation: `${BANC_V888_EDGES.length} directed MDN→LBL40 cell pairs total ${BANC_V888_MDN_LBL40_TOTAL_CONTACTS} putative anatomical contacts; they are not physiological weights or causal efficacy.`,
          },
          dataset_versions: DATASET_MANIFEST,
          coverage_warning: 'FlyLab challenge release currently exposes the validated adult MDN vertical slice.',
        },
        provenance: [...new Set(evidence.map((record) => record.provenance))],
        stateRevision: next.revision,
      };
    },

    draft_fly_hypothesis: async (input) => {
      const circuitId = stringInput(input, 'circuit_id');
      const circuit = CIRCUITS.find((item) => item.id === circuitId);
      if (!circuit) throw new FlyLabDomainError('NOT_FOUND', `Circuit ${circuitId} is not in the curated catalog.`);
      const evidenceIds = stringArrayInput(input, 'evidence_ids');
      const invalidEvidence = evidenceIds.filter((id) => !circuit.evidenceIds.includes(id));
      if (invalidEvidence.length) throw new FlyLabDomainError('EVIDENCE_MISMATCH', 'One or more evidence IDs are not linked to the selected circuit.', false, { invalidEvidence });
      const hypothesis = makeHypothesis({
        circuitId,
        claim: stringInput(input, 'claim'),
        predictedBehavior: stringInput(input, 'predicted_behavior'),
        perturbation: stringInput(input, 'perturbation') as 'activate' | 'silence',
        evidenceIds,
        falsificationCriterion: stringInput(input, 'falsification_criterion'),
      });
      const next = commit((current) => pushActivity({ ...current, stage: 'design', hypothesis, selectedCircuitId: circuitId }, {
        title: 'Hypothesis drafted',
        detail: 'The claim is marked as an agent hypothesis and remains editable.',
        status: 'complete',
      }));
      setNotice('Hypothesis created without upgrading it to measured evidence.');
      return {
        summary: 'Created an editable, falsifiable MDN hypothesis.',
        data: { hypothesis, next_actions: ['design_stimulation_trial'] },
        provenance: ['agent_hypothesized'],
        stateRevision: next.revision,
      };
    },

    design_stimulation_trial: async (input) => {
      const current = labRef.current;
      if (!current.hypothesis || current.hypothesis.id !== stringInput(input, 'hypothesis_id')) {
        throw new FlyLabDomainError('NOT_FOUND', 'Create or select the referenced hypothesis first.');
      }
      if (!CIRCUITS.some((circuit) => circuit.id === stringInput(input, 'target_circuit_id'))) {
        throw new FlyLabDomainError('UNSUPPORTED_TARGET', 'The requested circuit is outside the validated challenge catalog.');
      }
      const experiment = designExperiment({
        hypothesisId: current.hypothesis.id,
        targetCircuitId: stringInput(input, 'target_circuit_id'),
        perturbation: stringInput(input, 'perturbation') as 'activate' | 'silence',
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
      const next = commit((state) => pushActivity({
        ...state,
        stage: 'design',
        experiment,
        batch: null,
        analyses: [],
        comparison: null,
        bundle: null,
      }, {
        title: 'Controlled trial designed',
        detail: `${experiment.conditions.length} arms · ${experiment.replicates} replicates each · awaiting human approval.`,
        status: 'waiting',
      }));
      setSelectedConditionId(experiment.conditions.find((condition) => condition.laterality === experiment.primaryLaterality)?.id ?? experiment.conditions[0].id);
      setNotice('Protocol is ready for human review. The agent cannot run it until you approve.');
      return {
        summary: 'Created a controlled MDN perturbation experiment that requires human approval.',
        data: { experiment, approval_required: true, next_actions: ['human_approval', 'run_fly_simulation'] },
        provenance: ['agent_hypothesized', 'connectome_inferred'],
        stateRevision: next.revision,
      };
    },

    run_fly_simulation: async (input, { signal }) => {
      const current = labRef.current;
      if (!current.experiment || current.experiment.id !== stringInput(input, 'experiment_id')) {
        throw new FlyLabDomainError('NOT_FOUND', 'The requested experiment does not exist in this page session.');
      }
      if (!current.experiment.approved) {
        throw new FlyLabDomainError('APPROVAL_REQUIRED', 'A person must approve the visible protocol before the simulation can run.', true, { experiment_id: current.experiment.id });
      }
      if (current.batch?.experimentId === current.experiment.id) {
        return {
          summary: 'Returned the existing deterministic simulation batch.',
          data: current.batch,
          provenance: ['simulation_predicted'],
          stateRevision: current.revision,
        };
      }
      const requestedConditionIds = stringArrayInput(input, 'condition_ids');
      const experiment = requestedConditionIds.length
        ? { ...current.experiment, conditions: current.experiment.conditions.filter((condition) => requestedConditionIds.includes(condition.id)) }
        : current.experiment;
      if (!experiment.conditions.length) throw new FlyLabDomainError('NOT_FOUND', 'No requested condition IDs belong to this experiment.');

      commit((state) => pushActivity({ ...state, stage: 'run' }, {
        title: 'Simulation batch running',
        detail: `${experiment.conditions.length * experiment.replicates} deterministic virtual trials are being evaluated.`,
        status: 'running',
      }));
      setNotice('Running the seeded FlyLab model. All resulting claims remain simulation predictions.');
      try {
        await waitFor(650, signal);
      } catch (error) {
        commit((state) => pushActivity({ ...state, stage: 'run' }, {
          title: 'Simulation cancelled',
          detail: 'No completed batch or result record was committed.',
          status: 'waiting',
        }));
        setNotice('Simulation cancelled. No results were committed.');
        throw error;
      }
      const batch = simulateExperiment(experiment);
      const next = commit((state) => pushActivity({ ...state, stage: 'analyze', batch }, {
        title: 'Simulation batch complete',
        detail: `${batch.conditionRuns.reduce((count, run) => count + run.replicates.length, 0)} runs · ${batch.runHash}`,
        status: 'complete',
      }));
      setPlayhead(0);
      setPlaying(true);
      setNotice('Simulation complete. Inspect the replay, then quantify the behavior.');
      return {
        summary: 'Completed the approved deterministic simulation batch.',
        data: { ...batch, boundary: MODEL_MANIFEST.boundary, next_actions: ['analyze_fly_behavior'] },
        provenance: ['simulation_predicted'],
        stateRevision: next.revision,
      };
    },

    analyze_fly_behavior: async (input) => {
      const current = labRef.current;
      if (!current.batch || current.batch.id !== stringInput(input, 'batch_id')) {
        throw new FlyLabDomainError('INCOMPLETE_BATCH', 'Run the referenced simulation batch before analysis.');
      }
      const metrics = stringArrayInput(input, 'metrics') as MetricName[];
      const analysisStartMs = numberInput(input, 'analysis_start_ms', 0);
      const analysisEndMs = numberInput(input, 'analysis_end_ms', current.batch.protocol.trialDurationMs);
      if (analysisStartMs !== 0 || analysisEndMs !== current.batch.protocol.trialDurationMs) {
        throw new FlyLabDomainError('METRIC_UNAVAILABLE', 'The challenge model currently exposes only full-trial aggregate metrics.', false, {
          supported_window_ms: { start: 0, end: current.batch.protocol.trialDurationMs },
        });
      }
      const analysis = analyzeBatch(current.batch, metrics, analysisStartMs, analysisEndMs);
      const next = commit((state) => pushActivity({ ...state, stage: 'continue', analyses: [analysis] }, {
        title: 'Behavior quantified',
        detail: `${metrics.length} preregistered metrics analyzed across ${analysis.conditions.length} conditions.`,
        status: 'complete',
      }));
      setNotice('Behavior summaries are derived from simulated trajectories, not measured flies.');
      return {
        summary: 'Computed method-versioned behavioral metrics from the completed simulation batch.',
        data: { analysis, next_actions: ['compare_fly_trials'] },
        provenance: ['derived', 'simulation_predicted'],
        stateRevision: next.revision,
      };
    },

    compare_fly_trials: async (input) => {
      const ids = stringArrayInput(input, 'analysis_ids');
      const analyses = labRef.current.analyses.filter((analysis) => ids.includes(analysis.id));
      if (!analyses.length || analyses.length !== ids.length) {
        throw new FlyLabDomainError('INCOMPARABLE_ANALYSES', 'One or more analysis IDs are missing from this page session.');
      }
      const comparison = compareAnalyses(
        analyses,
        stringInput(input, 'objective_metric') as MetricName,
        stringInput(input, 'objective') as 'maximize' | 'minimize' | 'target',
        typeof input.target_value === 'number' ? input.target_value : undefined,
        numberInput(input, 'next_experiment_budget', autoBudget),
      );
      const next = commit((state) => pushActivity({ ...state, stage: 'continue', comparison }, {
        title: 'Next experiment proposed',
        detail: 'Conditions ranked; a bounded model-drive follow-up awaits human direction.',
        status: 'waiting',
      }));
      setNotice('The agent selected a next experiment but did not run it automatically.');
      return {
        summary: 'Ranked simulated conditions and proposed one bounded follow-up experiment.',
        data: { comparison, execution_authorized: false, next_actions: ['save_fly_evidence', 'human_review'] },
        provenance: ['derived', 'simulation_predicted', 'agent_hypothesized'],
        stateRevision: next.revision,
      };
    },

    save_fly_evidence: async (input) => {
      const current = labRef.current;
      const hypothesisId = stringInput(input, 'hypothesis_id');
      const experimentId = stringInput(input, 'experiment_id');
      const batchIds = stringArrayInput(input, 'batch_ids');
      const analysisIds = stringArrayInput(input, 'analysis_ids');
      if (!current.hypothesis || current.hypothesis.id !== hypothesisId || !current.experiment || current.experiment.id !== experimentId || !current.batch || !batchIds.includes(current.batch.id) || !current.comparison || current.comparison.id !== stringInput(input, 'comparison_id')) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'The evidence bundle must reference the complete visible FlyLab lineage.');
      }
      if (!analysisIds.every((id) => current.analyses.some((analysis) => analysis.id === id))) {
        throw new FlyLabDomainError('INCOMPLETE_PROVENANCE', 'One or more analysis IDs are missing.');
      }
      const payload = {
        format: 'flylab.evidence-bundle.v1',
        title: stringInput(input, 'title'),
        note: stringInput(input, 'note'),
        sources: SOURCES,
        evidence: EVIDENCE,
        hypothesis: current.hypothesis,
        experiment: current.experiment,
        batch: current.batch,
        analyses: current.analyses,
        comparison: current.comparison,
        datasets: DATASET_MANIFEST,
        model: MODEL_MANIFEST,
      };
      const manifestHash = await sha256(payload);
      const provenanceCounts: Record<ProvenanceLabel, number> = {
        measured: 0,
        derived: 0,
        connectome_inferred: 0,
        simulation_predicted: 0,
        agent_hypothesized: 0,
      };
      EVIDENCE.forEach((record) => { provenanceCounts[record.provenance] += 1; });
      provenanceCounts.agent_hypothesized += 1;
      provenanceCounts.simulation_predicted += 1;
      current.analyses.forEach((record) => record.provenance.forEach((kind) => { provenanceCounts[kind] += 1; }));
      provenanceCounts.derived += 1;
      provenanceCounts.simulation_predicted += 1;
      provenanceCounts.agent_hypothesized += 1;
      const bundle: EvidenceBundle = {
        id: `evidence_${stableHash({ manifestHash, title: payload.title })}`,
        title: payload.title,
        manifestHash,
        savedAt: new Date().toISOString(),
        includedIds: [...SOURCES.map((record) => record.id), ...EVIDENCE.map((record) => record.id), hypothesisId, experimentId, current.batch.id, ...analysisIds, current.comparison.id],
        provenanceCounts,
        boundary: 'Simulation evidence bundle; not a new biological experiment.',
      };
      try { localStorage.setItem(`flylab:${bundle.id}`, JSON.stringify({ bundle, payload })); } catch { /* local persistence is best effort */ }
      const next = commit((state) => pushActivity({ ...state, stage: 'saved', bundle }, {
        title: 'Evidence bundle saved',
        detail: `${bundle.id} · reproducible lineage committed locally.`,
        status: 'complete',
      }));
      setNotice('Evidence bundle saved with sources, assumptions, versions, seeds, runs, and results.');
      return {
        summary: 'Saved a manifest-hashed, provenance-rich FlyLab evidence snapshot.',
        data: { bundle, local_reference: bundle.id, storage_scope: 'this browser origin' },
        provenance: ['measured', 'derived', 'connectome_inferred', 'simulation_predicted', 'agent_hypothesized'],
        stateRevision: next.revision,
      };
    },
  }), [autoBudget, commit, pushActivity]);

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
    playheadRef.current = playhead;
  }, [playhead]);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now() - playheadRef.current * 5000;
    const timer = window.setInterval(() => {
      const next = (performance.now() - startedAt) / 5000;
      if (next >= 1) {
        setPlayhead(1);
        setPlaying(false);
      } else {
        setPlayhead(next);
      }
    }, 40);
    return () => window.clearInterval(timer);
  }, [playing]);

  const invoke = useCallback(async (name: string, input: Record<string, unknown>) => {
    const controller = new AbortController();
    try {
      return await actions[name](input, { signal: controller.signal });
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
    });
    if (!found) return;
    const hypothesisResult = await invoke('draft_fly_hypothesis', {
      circuit_id: 'circuit_mdn_adult',
      claim: 'In FlyLab, a bilateral MDN-inspired model drive will increase predicted backward-walking initiation relative to baseline and sham conditions.',
      predicted_behavior: 'backward_walking',
      perturbation: 'activate',
      evidence_ids: ['E-MDN-ACTIVATION-001', 'E-MDN-LATERALITY-006', 'E-BANC-PATH-003'],
      falsification_criterion: 'The model shows no increase in reverse initiation or backward distance relative to both controls.',
    });
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
    });
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
    }));
    setNotice('Approved. The simulation tool can now run the exact visible protocol.');
    return next;
  }, [commit, pushActivity]);

  const runExperiment = useCallback(async () => {
    const experiment = labRef.current.experiment;
    if (!experiment) return;
    await invoke('run_fly_simulation', { experiment_id: experiment.id });
  }, [invoke]);

  const analyzeExperiment = useCallback(async () => {
    const batch = labRef.current.batch;
    if (!batch) return;
    await invoke('analyze_fly_behavior', {
      batch_id: batch.id,
      metrics: ['backward_distance_mm', 'signed_speed_mm_s', 'response_latency_ms', 'heading_change_deg', 'stance_stability'],
      analysis_start_ms: 0,
      analysis_end_ms: 5000,
    });
  }, [invoke]);

  const compareExperiment = useCallback(async () => {
    const analysis = labRef.current.analyses[0];
    if (!analysis) return;
    await invoke('compare_fly_trials', {
      analysis_ids: [analysis.id],
      objective_metric: 'backward_distance_mm',
      objective: 'maximize',
      next_experiment_budget: autoBudget,
    });
  }, [autoBudget, invoke]);

  const saveEvidence = useCallback(async () => {
    const current = labRef.current;
    if (!current.hypothesis || !current.experiment || !current.batch || !current.analyses.length || !current.comparison) return;
    await invoke('save_fly_evidence', {
      title: 'MDN-inspired drive and predicted backward walking',
      hypothesis_id: current.hypothesis.id,
      experiment_id: current.experiment.id,
      batch_ids: [current.batch.id],
      analysis_ids: current.analyses.map((analysis) => analysis.id),
      comparison_id: current.comparison.id,
      note: 'Challenge demonstration bundle. Interpret as model evidence only.',
    });
  }, [invoke]);

  const editExperiment = useCallback((field: 'activationLevel' | 'durationMs' | 'replicates', value: number) => {
    commit((current) => {
      if (!current.experiment) return current;
      const updated = { ...current.experiment, [field]: value, approved: false };
      updated.conditions = updated.conditions.map((condition) => condition.kind === 'perturbation' ? { ...condition, activationLevel: field === 'activationLevel' ? value : condition.activationLevel } : condition);
      updated.id = `exp_${stableHash({ hypothesis: updated.hypothesisId, field, value, seed: updated.seed, conditions: updated.conditions })}`;
      return pushActivity({ ...current, stage: 'design', experiment: updated, batch: null, analyses: [], comparison: null, bundle: null }, {
        title: 'Human edited protocol',
        detail: `${field} updated; prior approval and downstream runs were cleared.`,
        status: 'waiting',
      });
    });
    setNotice('Protocol changed. Review and approve the revised experiment before running.');
  }, [commit, pushActivity]);

  const primaryAction = useMemo(() => {
    if (!lab.hypothesis || !lab.experiment) return { label: 'Ask agent to investigate', action: investigate, detail: 'research → hypothesis → protocol' };
    if (!lab.experiment.approved) return { label: 'Approve experiment', action: approveExperiment, detail: `${lab.experiment.conditions.length} arms · ${lab.experiment.replicates} each` };
    if (!lab.batch) return { label: 'Run MDN-inspired drive', action: runExperiment, detail: `seed ${lab.experiment.seed.toLocaleString()}` };
    if (!lab.analyses.length) return { label: 'Analyze behavior', action: analyzeExperiment, detail: '5 preregistered metrics' };
    if (!lab.comparison) return { label: 'Choose next experiment', action: compareExperiment, detail: `bounded to ${autoBudget} proposed replicates` };
    if (!lab.bundle) return { label: 'Save evidence bundle', action: saveEvidence, detail: 'sources · assumptions · seeds · results' };
    return { label: 'Replay representative trial', action: () => { setPlayhead(0); setPlaying(true); }, detail: lab.bundle.id };
  }, [analyzeExperiment, approveExperiment, autoBudget, compareExperiment, investigate, lab, runExperiment, saveEvidence]);

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

  const stageIndex = stages.findIndex((stage) => stage.id === (lab.stage === 'saved' ? 'continue' : lab.stage));
  const selectedEvidence = EVIDENCE.find((record) => record.id === selectedEvidenceId) ?? EVIDENCE[0];
  const selectedSources = SOURCES.filter((source) => selectedEvidence.sourceIds.includes(source.id));
  const analysis = lab.analyses[0] ?? null;
  const bestResult = analysis?.conditions.find((condition) => condition.conditionId === 'condition_bilateral') ?? analysis?.conditions[0] ?? null;
  const siteToolStatus = {
    checking: 'checking site tools',
    active: '7 tools live',
    unsupported: 'browser API unavailable',
    failed: 'tool registration failed',
  }[webmcpStatus];

  return (
    <main className="lab-shell">
      <header className="topbar">
        <a className="brand" href="#workspace" aria-label="FlyLab home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>FlyLab</span>
          <small>virtual neuroethology</small>
        </a>
        <div className="top-status" aria-label="Laboratory versions">
          <span className="live-dot" /> Adult · BANC v888 · model {MODEL_MANIFEST.version}
        </div>
        <button className="quiet-button" type="button" onClick={() => setEvidenceOpen(true)}>
          Evidence ledger <span>{EVIDENCE.length + (lab.bundle ? 1 : 0)}</span>
        </button>
      </header>

      <section className="workspace" id="workspace">
        <aside className="workflow-rail">
          <div className="goal-block">
            <p className="eyebrow">Behavior objective</p>
            <label className="sr-only" htmlFor="behavior-goal">Behavior goal</label>
            <textarea
              id="behavior-goal"
              value={lab.goal}
              onChange={(event) => commit((current) => ({ ...current, goal: event.target.value, revision: current.revision + 1 }))}
              rows={3}
            />
            <p className="goal-hint">The agent searches curated evidence before making a prediction.</p>
          </div>

          <nav className="stage-list" aria-label="Experiment workflow">
            {stages.map((stage, index) => (
              <div className={index < stageIndex ? 'done' : index === stageIndex ? 'active' : ''} key={stage.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{stage.label}</strong>
                <i />
              </div>
            ))}
          </nav>

          <section className="agent-activity" aria-labelledby="agent-activity-title">
            <div className="section-title-row">
              <p className="eyebrow" id="agent-activity-title">Agent activity</p>
              <span className={`tool-status ${webmcpStatus === 'active' ? 'live' : ''}`}>{siteToolStatus}</span>
            </div>
            {lab.activity.slice(0, 3).map((item) => (
              <article className={`activity-row ${item.status}`} key={item.id}>
                <i />
                <div><strong>{item.title}</strong><p>{item.detail}</p></div>
              </article>
            ))}
          </section>

          <div className="primary-action-wrap">
            <button className="primary-action" type="button" onClick={() => void primaryAction.action()}>
              <span>{primaryAction.label}</span><b aria-hidden="true">→</b>
            </button>
            <small>{primaryAction.detail}</small>
          </div>
        </aside>

        <section className="main-stage" aria-labelledby="arena-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Shared simulation arena</p>
              <h1 id="arena-title">{arenaView === 'circuit' ? <>BANC v888 circuit <span>· reconstruction view</span></> : <>Open-field trial <span>· dorsal view</span></>}</h1>
            </div>
            <div className="view-switch" aria-label="Arena view">
              {(['body', 'circuit', 'trace'] as const).map((view) => (
                <button className={arenaView === view ? 'active' : ''} type="button" onClick={() => setArenaView(view)} key={view}>{view}</button>
              ))}
            </div>
          </div>

          <div className={`arena arena-${arenaView}`}>
            <span className="axis axis-y">posterior</span>
            <span className="axis axis-x">right</span>
            <span className="arena-scale">5 mm</span>
            <div className="arena-data">
              <span>{activeCondition?.label ?? 'Awaiting protocol'}</span>
              <strong>{activePoint?.active ? 'unitless MDN-inspired drive' : lab.batch ? 'replay' : 'preview'}</strong>
            </div>

            {arenaView !== 'circuit' && (activeCondition?.trajectory ?? []).slice(0, Math.max(1, Math.floor(playhead * 80))).filter((_, index) => index % 3 === 0).map((point, index) => (
              <i
                className="trail-point"
                key={`${point.t}-${index}`}
                style={{ left: `calc(50% + ${point.x * 95}px)`, top: `calc(50% - ${point.y * 95}px)`, opacity: 0.15 + index / 35 }}
              />
            ))}

            {arenaView !== 'circuit' && <div
              className={`fly ${activePoint?.active ? 'activated' : ''}`}
              style={{
                left: `calc(50% + ${(activePoint?.x ?? 0) * 95}px)`,
                top: `calc(50% - ${(activePoint?.y ?? 0) * 95}px)`,
                transform: `translate(-50%, -50%) rotate(${activePoint?.heading ?? 4}deg)`,
              }}
              role="img"
              aria-label={activeCondition ? `Representative ${activeCondition.label} virtual fly at ${Math.round(playhead * 5000)} milliseconds` : 'Stylized adult virtual fruit fly awaiting an experiment'}
            >
              <span className="wing wing-left" /><span className="wing wing-right" />
              <span className="fly-head" /><span className="fly-body" />
              <span className="leg l1" /><span className="leg l2" /><span className="leg l3" />
              <span className="leg r1" /><span className="leg r2" /><span className="leg r3" />
              <span className="activation-halo" />
            </div>}

            {arenaView === 'circuit' && (
              <Suspense fallback={<div className="brain-viewer-fallback"><span className="agent-pulse" /> Loading the BANC v888 reconstruction viewer…</div>}>
                <FlyBrain3D
                  laterality={activeCondition?.laterality ?? selectedCondition?.laterality ?? 'bilateral'}
                  driveActive={Boolean(activePoint?.active)}
                  conditionLabel={activeCondition?.label ?? selectedCondition?.label ?? 'Circuit orientation preview'}
                  timeMs={Math.round(playhead * 5000)}
                />
              </Suspense>
            )}

            {!lab.batch && arenaView !== 'circuit' && <p className="arena-empty">Design and approve an experiment to generate seeded trajectories.</p>}
          </div>

          <div className="playback-row">
            <button type="button" onClick={() => { setPlayhead(0); setPlaying(false); }} aria-label="Restart replay">↺</button>
            <button className="play-button" type="button" onClick={() => setPlaying((value) => !value)} disabled={!lab.batch} aria-label={playing ? 'Pause replay' : 'Play replay'}>{playing ? 'Ⅱ' : '▶'}</button>
            <span>{Math.round(playhead * 5000)} ms</span>
            <div className="timeline-track" aria-label="Five-second trial timeline">
              <i className="stimulus-window" />
              <b style={{ left: `${playhead * 100}%` }} />
            </div>
            <span>5,000 ms</span>
          </div>
          <div className="timeline-labels"><span>baseline</span><strong>unitless MDN-inspired drive</strong><span>recovery</span></div>

          <section className="trial-queue" aria-labelledby="trial-queue-title">
            <div className="section-title-row">
              <div><p className="eyebrow" id="trial-queue-title">Experiment queue</p><h2>{lab.experiment ? `${lab.experiment.conditions.length} controlled arms` : 'No protocol yet'}</h2></div>
              {lab.batch && <Badge kind="simulation_predicted" />}
            </div>
            <div className="condition-tabs">
              {(lab.experiment?.conditions ?? []).map((condition) => (
                <button className={activeCondition?.conditionId === condition.id || (!lab.batch && selectedConditionId === condition.id) ? 'active' : ''} type="button" key={condition.id} onClick={() => { setSelectedConditionId(condition.id); setPlayhead(0); setPlaying(false); }}>
                  <i className={condition.kind} />
                  <span>{condition.label}</span>
                  <small>{lab.batch ? 'complete' : lab.experiment?.approved ? 'approved' : 'draft'}</small>
                </button>
              ))}
              {!lab.experiment && <p className="empty-inline">The agent will add baseline, sham, bilateral, left-only, and right-only arms.</p>}
            </div>
          </section>

          {analysis && (
            <section className="results-panel" aria-labelledby="results-title">
              <div className="section-title-row"><div><p className="eyebrow">Behavior analysis</p><h2 id="results-title">Bilateral MDN condition</h2></div><div className="badge-pair"><Badge kind="derived" /><Badge kind="simulation_predicted" /></div></div>
              <div className="metric-grid">
                <article><span>Reverse initiation</span><strong>{Math.round((bestResult?.reverseInitiationProbability ?? 0) * 100)}%</strong><small>of seeded runs</small></article>
                <article><span>Backward distance</span><strong>{round(bestResult?.backwardDistanceMm ?? 0)} <i>mm</i></strong><small>condition mean</small></article>
                <article><span>Signed speed</span><strong>{round(bestResult?.signedSpeedMmS ?? 0)} <i>mm/s</i></strong><small>negative = backward</small></article>
                <article><span>Response latency</span><strong>{Math.round(bestResult?.responseLatencyMs ?? 0)} <i>ms</i></strong><small>responsive runs</small></article>
              </div>
              <p className="analysis-warning">{analysis.warning}</p>
            </section>
          )}
        </section>

        <aside className="inspector-panel">
          <section className="hypothesis-card">
            <div className="section-title-row"><p className="eyebrow">Current hypothesis</p><Badge kind="agent_hypothesized" /></div>
            <h2>{lab.hypothesis?.claim ?? 'A bilateral MDN-inspired model drive may increase predicted backward-walking initiation.'}</h2>
            <p>{lab.hypothesis?.falsificationCriterion ?? 'Falsified here if the model shows no increase relative to both controls.'}</p>
          </section>

          <section className="target-card">
            <div className="neuron-orbit" aria-hidden="true"><i /><i /><i /></div>
            <div><div className="target-card-heading"><span>Neural target</span><Badge kind="derived" /></div><strong>Moonwalker descending neurons</strong><small>BANC v888 · 4 proofread MDNs · 2 per side</small></div>
          </section>

          <section className="protocol-controls" aria-labelledby="protocol-title">
            <div className="section-title-row"><p className="eyebrow" id="protocol-title">Visible protocol</p><span className={`approval-chip ${lab.experiment?.approved ? 'approved' : ''}`}>{lab.experiment?.approved ? 'Approved' : 'Draft'}</span></div>
            <label>
              <span>Unitless model drive <b>{lab.experiment?.activationLevel.toFixed(2) ?? '0.65'}</b></span>
              <input type="range" min="0" max="1" step="0.05" value={lab.experiment?.activationLevel ?? 0.65} disabled={!lab.experiment} onChange={(event) => editExperiment('activationLevel', Number(event.target.value))} />
            </label>
            <label>
              <span>Duration <b>{lab.experiment?.durationMs ?? 2000} ms</b></span>
              <input type="range" min="250" max="3500" step="250" value={lab.experiment?.durationMs ?? 2000} disabled={!lab.experiment} onChange={(event) => editExperiment('durationMs', Number(event.target.value))} />
            </label>
            <label>
              <span>Replicates / arm <b>{lab.experiment?.replicates ?? 8}</b></span>
              <input type="range" min="3" max="20" step="1" value={lab.experiment?.replicates ?? 8} disabled={!lab.experiment} onChange={(event) => editExperiment('replicates', Number(event.target.value))} />
            </label>
            <dl className="protocol-meta">
              <div><dt>Onset</dt><dd>{lab.experiment?.onsetMs ?? 1000} ms</dd></div>
              <div><dt>Seed</dt><dd>{(lab.experiment?.seed ?? 73142).toLocaleString()}</dd></div>
              <div><dt>Controller</dt><dd>{MODEL_MANIFEST.controller}</dd></div>
            </dl>
          </section>

          <section className="evidence-summary">
            <div className="section-title-row"><p className="eyebrow">Evidence boundaries</p><button type="button" onClick={() => setEvidenceOpen(true)}>inspect all ↗</button></div>
            <div className="evidence-badges">
              {(Object.keys(provenanceMeta) as ProvenanceLabel[]).map((kind) => <Badge key={kind} kind={kind} />)}
            </div>
            <p>{MODEL_MANIFEST.boundary}</p>
          </section>

          <section className="autonomy-card">
            <div className="section-title-row"><p className="eyebrow">Bounded autoresearch</p><span>propose only</span></div>
            <label><span>Next-trial budget</span><select value={autoBudget} onChange={(event) => setAutoBudget(Number(event.target.value))}><option value="2">2 replicates</option><option value="5">5 replicates</option><option value="10">10 replicates</option></select></label>
            <p>The agent may rank and propose a follow-up. It cannot execute a new batch without approval.</p>
            {lab.comparison && <div className="proposal"><Badge kind="agent_hypothesized" /><strong>{lab.comparison.proposal.rationale}</strong><small>levels {lab.comparison.proposal.activationLevels.join(' / ')} · budget {lab.comparison.proposal.replicateBudget}</small></div>}
          </section>
        </aside>
      </section>

      <footer className="lab-footer" aria-live="polite">
        <p><span className="agent-pulse" /> {notice}</p>
        <p>{lab.bundle ? `${lab.bundle.id} · ${lab.bundle.manifestHash.slice(0, 22)}…` : `state revision ${lab.revision}`}</p>
        <div className="footer-tools"><span>{webmcpStatus === 'active' ? 'WebMCP active' : 'WebMCP contracts wired'}</span><span>7 scientific tools</span></div>
      </footer>

      {evidenceOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEvidenceOpen(false); }}>
          <section className="evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
            <header><div><p className="eyebrow">Provenance ledger</p><h2 id="evidence-title">Every claim keeps its boundary</h2></div><button type="button" onClick={() => setEvidenceOpen(false)} aria-label="Close evidence ledger">×</button></header>
            <div className="evidence-modal-grid">
              <nav aria-label="Evidence records">
                {EVIDENCE.map((record) => (
                  <button className={selectedEvidence.id === record.id ? 'active' : ''} type="button" onClick={() => setSelectedEvidenceId(record.id)} key={record.id}>
                    <Badge kind={record.provenance} /><strong>{record.label}</strong><small>{record.id}</small>
                  </button>
                ))}
                {lab.bundle && <button className="bundle-record" type="button"><Badge kind="derived" /><strong>{lab.bundle.title}</strong><small>{lab.bundle.id}</small></button>}
              </nav>
              <article className="evidence-detail">
                <Badge kind={selectedEvidence.provenance} />
                <h3>{selectedEvidence.claim}</h3>
                <dl><div><dt>Context</dt><dd>{selectedEvidence.context}</dd></div><div><dt>Boundary</dt><dd>{selectedEvidence.caution}</dd></div></dl>
                <h4>Primary source</h4>
                {selectedSources.map((source) => (
                  <a href={source.url} target="_blank" rel="noreferrer" key={source.id}><strong>{source.title}</strong><span>{source.citation}</span><small>{source.specimen} · {source.license}</small></a>
                ))}
              </article>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
