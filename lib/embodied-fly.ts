export const BODY_PART_IDS = [
  'left_foreleg',
  'right_foreleg',
  'left_midleg',
  'right_midleg',
  'left_hindleg',
  'right_hindleg',
  'left_wing',
  'right_wing',
] as const;

export type BodyPartId = (typeof BODY_PART_IDS)[number];
export type MotorProgramId = 'reverse_walk' | 'short_mode_escape';
export type MotorPathLevel = 'brain' | 'descending' | 'vnc' | 'motor_neuron' | 'muscle' | 'body';
export type MotorPathProvenance = 'measured' | 'connectome_inferred' | 'agent_hypothesized';

export interface MotorPathNode {
  id: string;
  label: string;
  level: MotorPathLevel;
  side: 'left' | 'right' | 'bilateral' | 'midline';
  role: string;
  pathStatus: 'mapped' | 'context_only_unconnected';
  provenance: MotorPathProvenance;
  evidenceIds: string[];
  sourceIds?: string[];
}

export interface MotorPathEdge {
  id: string;
  from: string;
  to: string;
  relation: 'electrical' | 'mixed_electrochemical' | 'chemical' | 'functional' | 'model_adapter';
  provenance: MotorPathProvenance;
  evidenceIds: string[];
  sourceIds?: string[];
  boundary: string;
}

export interface EmbodiedMotorMap {
  id: string;
  circuitId: string;
  motorProgram: MotorProgramId;
  controller: string;
  responseMode: 'reverse' | 'takeoff';
  supportedLaterality: Array<'left' | 'right' | 'bilateral'>;
  behaviors: string[];
  targetBodyParts: BodyPartId[];
  recommendedMetrics: string[];
  nodes: MotorPathNode[];
  edges: MotorPathEdge[];
  summary: string;
  evidenceBoundary: string;
  simulationBoundary: string;
}

const mdnLegNodes: MotorPathNode[] = [
  { id: 'mdn_brain', label: 'Moonwalker descending neurons', level: 'brain', side: 'bilateral', role: 'descending command population', pathStatus: 'mapped', provenance: 'measured', evidenceIds: ['E-MDN-ACTIVATION-001', 'E-MDN-SILENCING-005'] },
  { id: 'mdn_descending', label: 'MDN descending axons', level: 'descending', side: 'bilateral', role: 'brain-to-VNC path', pathStatus: 'mapped', provenance: 'connectome_inferred', evidenceIds: ['E-BANC-PATH-003'] },
  { id: 'lbl40', label: 'LBL40', level: 'vnc', side: 'bilateral', role: 'hindleg power-stroke context', pathStatus: 'mapped', provenance: 'measured', evidenceIds: ['E-FENG-LBL40-008'] },
  { id: 'lul130', label: 'LUL130', level: 'vnc', side: 'bilateral', role: 'leg-lifting context; no bundled BANC node or path', pathStatus: 'context_only_unconnected', provenance: 'measured', evidenceIds: ['E-FENG-LUL130-009'] },
  ...BODY_PART_IDS.filter((part) => part.includes('leg')).map((part): MotorPathNode => ({
    id: part,
    label: part.replaceAll('_', ' '),
    level: 'body',
    side: part.startsWith('left') ? 'left' : 'right',
    role: 'modeled walking appendage',
    pathStatus: 'mapped',
    provenance: 'agent_hypothesized',
    evidenceIds: ['E-FLYLAB-MODEL-004'],
  })),
];

const gfNodes: MotorPathNode[] = [
  { id: 'gf_brain', label: 'Giant fiber / DNp01', level: 'brain', side: 'bilateral', role: 'short-mode escape descending neurons', pathStatus: 'mapped', provenance: 'measured', evidenceIds: ['E-GF-CAUSAL-010'], sourceIds: ['SRC-VONREYN-NN-2014'] },
  { id: 'gf_descending', label: 'Giant fiber descending axons', level: 'descending', side: 'bilateral', role: 'brain-to-thorax escape command', pathStatus: 'mapped', provenance: 'measured', evidenceIds: ['E-GF-PATH-011'], sourceIds: ['SRC-KING-JNEUROCYTOL-1980'] },
  { id: 'ttmn', label: 'Tergotrochanteral motor neurons', level: 'motor_neuron', side: 'bilateral', role: 'mesothoracic jump-muscle motor output', pathStatus: 'mapped', provenance: 'measured', evidenceIds: ['E-GF-PATH-011'], sourceIds: ['SRC-KING-JNEUROCYTOL-1980', 'SRC-ALLEN-EJN-2007'] },
  { id: 'ttm', label: 'Tergotrochanteral jump muscles', level: 'muscle', side: 'bilateral', role: 'T2 leg extension', pathStatus: 'mapped', provenance: 'measured', evidenceIds: ['E-GF-PATH-011'], sourceIds: ['SRC-KING-JNEUROCYTOL-1980'] },
  { id: 'psi', label: 'Peripherally synapsing interneurons', level: 'vnc', side: 'bilateral', role: 'interneuron relay to flight motor neurons', pathStatus: 'mapped', provenance: 'measured', evidenceIds: ['E-GF-PATH-011'], sourceIds: ['SRC-KING-JNEUROCYTOL-1980'] },
  { id: 'dlmn', label: 'Dorsal longitudinal motor neurons', level: 'motor_neuron', side: 'bilateral', role: 'wing-depressor motor output', pathStatus: 'mapped', provenance: 'measured', evidenceIds: ['E-GF-PATH-011'], sourceIds: ['SRC-KING-JNEUROCYTOL-1980'] },
  { id: 'dlm', label: 'Dorsal longitudinal flight muscles', level: 'muscle', side: 'bilateral', role: 'wing downstroke / tuck output', pathStatus: 'mapped', provenance: 'measured', evidenceIds: ['E-GF-PATH-011'], sourceIds: ['SRC-KING-JNEUROCYTOL-1980'] },
  ...(['left_midleg', 'right_midleg', 'left_wing', 'right_wing'] as BodyPartId[]).map((part): MotorPathNode => ({
    id: part,
    label: part.replaceAll('_', ' '),
    level: 'body',
    side: part.startsWith('left') ? 'left' : 'right',
    role: part.includes('wing') ? 'modeled wing output' : 'modeled jump-leg output',
    pathStatus: 'mapped',
    provenance: 'agent_hypothesized',
    evidenceIds: ['E-FLYLAB-MODEL-004'],
  })),
];

export const EMBODIED_MOTOR_MAPS: EmbodiedMotorMap[] = [
  {
    id: 'motor_map_mdn_legs_v1',
    circuitId: 'circuit_mdn_adult',
    motorProgram: 'reverse_walk',
    controller: 'mapped-motor-adapter.mdn-reverse.v1',
    responseMode: 'reverse',
    supportedLaterality: ['left', 'right', 'bilateral'],
    behaviors: ['backward_walking', 'retreat'],
    targetBodyParts: ['left_foreleg', 'right_foreleg', 'left_midleg', 'right_midleg', 'left_hindleg', 'right_hindleg'],
    recommendedMetrics: ['backward_distance_mm', 'signed_speed_mm_s', 'response_latency_ms', 'heading_change_deg', 'stance_stability'],
    nodes: mdnLegNodes,
    edges: [
      { id: 'edge_mdn_functional_descent', from: 'mdn_brain', to: 'mdn_descending', relation: 'functional', provenance: 'measured', evidenceIds: ['E-MDN-ACTIVATION-001'], boundary: 'Assay-scoped causal evidence for MDN recruitment and backward locomotion.' },
      { id: 'edge_mdn_lbl40', from: 'mdn_descending', to: 'lbl40', relation: 'chemical', provenance: 'connectome_inferred', evidenceIds: ['E-BANC-PATH-003'], boundary: 'Pinned BANC v888 structural rows; contact counts are not physiological weights.' },
      { id: 'edge_lbl40_left_hindleg', from: 'lbl40', to: 'left_hindleg', relation: 'functional', provenance: 'measured', evidenceIds: ['E-FENG-LBL40-008'], boundary: 'LBL40 contributes to a hindleg power-stroke component under the cited MDN-induced assay.' },
      { id: 'edge_lbl40_right_hindleg', from: 'lbl40', to: 'right_hindleg', relation: 'functional', provenance: 'measured', evidenceIds: ['E-FENG-LBL40-008'], boundary: 'LBL40 contributes to a hindleg power-stroke component under the cited MDN-induced assay.' },
      ...BODY_PART_IDS.filter((part) => part.includes('leg')).map((part): MotorPathEdge => ({ id: `edge_mdn_model_${part}`, from: 'mdn_descending', to: part, relation: 'model_adapter', provenance: 'agent_hypothesized', evidenceIds: ['E-FLYLAB-MODEL-004'], boundary: 'FlyLab controller mapping only; it is not a claimed direct biological edge.' })),
    ],
    summary: 'Adult MDN retreat evidence is routed into a six-leg reduced-order walking program, with pinned MDN→LBL40 structure and separately labeled downstream functional context.',
    evidenceBoundary: 'Only MDN→LBL40 has bundled BANC v888 structural rows. LUL130 and body-level routing remain separately labeled; no missing cell or synapse is invented.',
    simulationBoundary: 'The six-leg controller is hand-authored and does not execute the connectome, neural dynamics, muscles, contacts, or FlyGym.',
  },
  {
    id: 'motor_map_gf_escape_v1',
    circuitId: 'circuit_gf_adult',
    motorProgram: 'short_mode_escape',
    controller: 'mapped-motor-adapter.gf-short-mode-escape.v1',
    responseMode: 'takeoff',
    supportedLaterality: ['bilateral'],
    behaviors: ['short_mode_escape'],
    targetBodyParts: ['left_midleg', 'right_midleg', 'left_wing', 'right_wing'],
    recommendedMetrics: ['short_mode_escape_probability', 'response_latency_ms', 'vertical_displacement_mm', 'wing_recruitment', 'leg_recruitment'],
    nodes: gfNodes,
    edges: [
      { id: 'edge_gf_functional_descent', from: 'gf_brain', to: 'gf_descending', relation: 'functional', provenance: 'measured', evidenceIds: ['E-GF-CAUSAL-010'], sourceIds: ['SRC-VONREYN-NN-2014'], boundary: 'Adult short-mode escape evidence from targeted activation, silencing, recording, and behavior.' },
      { id: 'edge_gf_ttmn', from: 'gf_descending', to: 'ttmn', relation: 'mixed_electrochemical', provenance: 'measured', evidenceIds: ['E-GF-PATH-011'], sourceIds: ['SRC-KING-JNEUROCYTOL-1980', 'SRC-ALLEN-EJN-2007'], boundary: 'Established mixed electrical/chemical giant-fiber output to the jump-muscle motor neuron; not a bundled BANC edge or a simulated synapse.' },
      { id: 'edge_ttmn_ttm', from: 'ttmn', to: 'ttm', relation: 'chemical', provenance: 'measured', evidenceIds: ['E-GF-PATH-011'], sourceIds: ['SRC-KING-JNEUROCYTOL-1980'], boundary: 'Motor-neuron-to-jump-muscle output as reported in the cited primary anatomy.' },
      { id: 'edge_gf_psi', from: 'gf_descending', to: 'psi', relation: 'electrical', provenance: 'measured', evidenceIds: ['E-GF-PATH-011'], sourceIds: ['SRC-KING-JNEUROCYTOL-1980'], boundary: 'Established giant-fiber pathway anatomy/physiology; not a bundled BANC edge.' },
      { id: 'edge_psi_dlmn', from: 'psi', to: 'dlmn', relation: 'chemical', provenance: 'measured', evidenceIds: ['E-GF-PATH-011'], sourceIds: ['SRC-KING-JNEUROCYTOL-1980'], boundary: 'Established relay to dorsal longitudinal flight motor neurons.' },
      { id: 'edge_dlmn_dlm', from: 'dlmn', to: 'dlm', relation: 'chemical', provenance: 'measured', evidenceIds: ['E-GF-PATH-011'], sourceIds: ['SRC-KING-JNEUROCYTOL-1980'], boundary: 'Motor-neuron-to-flight-muscle output as reported in the cited primary anatomy.' },
      { id: 'edge_ttm_left_midleg', from: 'ttm', to: 'left_midleg', relation: 'model_adapter', provenance: 'agent_hypothesized', evidenceIds: ['E-FLYLAB-MODEL-004'], boundary: 'FlyLab maps bilateral muscle recruitment to schematic T2 leg motion; no muscle mechanics are executed.' },
      { id: 'edge_ttm_right_midleg', from: 'ttm', to: 'right_midleg', relation: 'model_adapter', provenance: 'agent_hypothesized', evidenceIds: ['E-FLYLAB-MODEL-004'], boundary: 'FlyLab maps bilateral muscle recruitment to schematic T2 leg motion; no muscle mechanics are executed.' },
      { id: 'edge_dlm_left_wing', from: 'dlm', to: 'left_wing', relation: 'model_adapter', provenance: 'agent_hypothesized', evidenceIds: ['E-FLYLAB-MODEL-004'], boundary: 'FlyLab maps bilateral muscle recruitment to schematic wing motion; no aerodynamics are executed.' },
      { id: 'edge_dlm_right_wing', from: 'dlm', to: 'right_wing', relation: 'model_adapter', provenance: 'agent_hypothesized', evidenceIds: ['E-FLYLAB-MODEL-004'], boundary: 'FlyLab maps bilateral muscle recruitment to schematic wing motion; no aerodynamics are executed.' },
    ],
    summary: 'Adult giant fibers route a short-mode escape command through TTMn/TTM jump-leg and PSI/DLMn/DLM wing branches, then into a reduced-order, state-coherent body replay.',
    evidenceBoundary: 'The functional and pathway literature is source-backed, but FlyLab bundles no GF reconstruction or BANC node IDs. The rendered GF path is an explicitly schematic bilateral literature map; it does not encode the reported ipsilateral jump-muscle versus contralateral DLM laterality.',
    simulationBoundary: 'In model 0.3, GF body-event order and approximate millisecond intervals are literature-constrained calibration targets; response probability, body amplitudes, adapter gains, lift, and recovery remain seeded, hand-authored, and unfitted. The simulator does not execute electrical synapses, motor neurons, muscles, aerodynamics, or a connectome.',
  },
];

export const EMBODIMENT_COVERAGE = BODY_PART_IDS.map((bodyPart) => {
  const maps = EMBODIED_MOTOR_MAPS.filter((motorMap) => motorMap.targetBodyParts.includes(bodyPart));
  return {
    bodyPart,
    status: maps.length ? 'mapped_reduced_order' as const : 'not_modeled' as const,
    motorMapIds: maps.map((motorMap) => motorMap.id),
    circuitIds: maps.map((motorMap) => motorMap.circuitId),
    boundary: maps.length
      ? 'At least one source-backed path reaches a hand-authored reduced-order body controller; this is not complete motor coverage.'
      : 'No validated circuit-to-controller map is available in this release.',
  };
});

export function embodimentCoverageForCircuits(circuitIds: readonly string[]) {
  const selected = new Set(circuitIds);
  return EMBODIMENT_COVERAGE.map((entry) => {
    const selectedIndexes = entry.circuitIds.map((circuitId, index) => ({ circuitId, index }))
      .filter(({ circuitId }) => selected.has(circuitId));
    return {
      ...entry,
      status: selectedIndexes.length ? 'mapped_reduced_order' as const : 'not_modeled' as const,
      motorMapIds: selectedIndexes.map(({ index }) => entry.motorMapIds[index]),
      circuitIds: selectedIndexes.map(({ circuitId }) => circuitId),
      boundary: selectedIndexes.length
        ? 'The selected circuit has a source-backed path into a hand-authored reduced-order controller for this body part; this is not complete or calibrated motor coverage.'
        : 'The selected circuit has no validated controller binding for this body part in the current release.',
    };
  });
}

export function motorMapForCircuit(circuitId: string) {
  return EMBODIED_MOTOR_MAPS.find((motorMap) => motorMap.circuitId === circuitId);
}

export function motorMapsForQuery(query: string, bodyPart?: string, behavior?: string) {
  const normalized = query.trim().toLowerCase();
  return EMBODIED_MOTOR_MAPS.filter((motorMap) => {
    const searchable = [
      motorMap.id,
      motorMap.circuitId,
      motorMap.motorProgram,
      motorMap.summary,
      ...motorMap.behaviors,
      ...motorMap.targetBodyParts,
      ...motorMap.nodes.flatMap((node) => [node.id, node.label, node.role]),
    ].join(' ').toLowerCase();
    return (!normalized || searchable.includes(normalized))
      && (!bodyPart || bodyPart === 'any' || motorMap.targetBodyParts.includes(bodyPart as BodyPartId))
      && (!behavior || behavior === 'any' || motorMap.behaviors.includes(behavior));
  });
}
