import { deterministicSha256Hex } from './flylab.js';

export const DISCOVERY_DECISION_SCHEMA = 'flylab.discovery-decision';
export const DISCOVERY_DECISION_SCHEMA_VERSION = 1 as const;

export const DISCOVERY_DECISION_COVERAGE_WARNING =
  'Coverage is limited to the supplied circuit, evidence, and motor-map catalogs. A mapped reduced-order controller is not a complete connectome, neural, muscle, or behavioral model; missing and unsupported links remain explicit.';

export type DiscoveryPerturbation = 'activate' | 'silence';
export type DiscoverySelectionStatus = 'selected' | 'ambiguous' | 'evidence_filtered' | 'no_match';

/** The structural subset of CircuitRecord used by the decision builder. */
export interface DiscoveryCircuitInput {
  id: string;
  name: string;
  abbreviation: string;
  behaviors: readonly string[];
  targetBodyParts: readonly string[];
  motorMapId: string;
  modelCoverage?: string;
  evidenceIds: readonly string[];
  summary?: string;
}

/** The structural subset of EvidenceRecord used by the decision builder. */
export interface DiscoveryEvidenceInput {
  id: string;
  provenance: string;
  role: string;
  support: {
    kind: string;
    perturbations?: readonly string[];
    behaviors?: readonly string[];
  };
}

export interface DiscoveryMotorNodeInput {
  id: string;
  label?: string;
  pathStatus?: string;
  provenance?: string;
  evidenceIds?: readonly string[];
}

export interface DiscoveryMotorEdgeInput {
  id: string;
  from: string;
  to: string;
  relation?: string;
  provenance?: string;
  evidenceIds?: readonly string[];
  boundary?: string;
}

/** The structural subset of EmbodiedMotorMap used by the decision builder. */
export interface DiscoveryMotorMapInput {
  id: string;
  circuitId: string;
  motorProgram?: string;
  behaviors: readonly string[];
  targetBodyParts: readonly string[];
  nodes?: readonly DiscoveryMotorNodeInput[];
  edges?: readonly DiscoveryMotorEdgeInput[];
  evidenceBoundary?: string;
  simulationBoundary?: string;
}

/** Compatible with each item returned by rankCircuitsForSearch. */
export interface DiscoveryRankedMatchInput {
  circuit: { id: string };
  score: number;
  matchedTerms: readonly string[];
  unmatchedTerms: readonly string[];
}

export interface DiscoverySearchInput {
  query: string;
  behavior?: string;
  bodyPart?: string;
  evidenceLabels?: readonly string[];
  limit?: number;
}

export interface DiscoveryDecisionInput {
  missionGoal: string;
  search: DiscoverySearchInput;
  rankedMatches: readonly DiscoveryRankedMatchInput[];
  selectedCircuitId: string | null;
  circuits: readonly DiscoveryCircuitInput[];
  evidence: readonly DiscoveryEvidenceInput[];
  motorMaps: readonly DiscoveryMotorMapInput[];
}

export interface CanonicalDiscoverySearch {
  query: string;
  filters: {
    behavior: string;
    bodyPart: string;
    evidenceLabels: string[];
    limit: number | null;
  };
}

interface CanonicalCircuit extends DiscoveryCircuitInput {
  behaviors: string[];
  targetBodyParts: string[];
  evidenceIds: string[];
  modelCoverage: string;
  summary: string;
}

interface CanonicalEvidence extends Omit<DiscoveryEvidenceInput, 'support'> {
  support: {
    kind: string;
    perturbations: string[];
    behaviors: string[];
  };
}

interface CanonicalMotorMap extends Omit<DiscoveryMotorMapInput, 'behaviors' | 'targetBodyParts' | 'nodes' | 'edges'> {
  motorProgram: string;
  behaviors: string[];
  targetBodyParts: string[];
  nodes: Array<Required<Pick<DiscoveryMotorNodeInput, 'id'>> & {
    label: string;
    pathStatus: string;
    provenance: string;
    evidenceIds: string[];
  }>;
  edges: Array<Required<Pick<DiscoveryMotorEdgeInput, 'id' | 'from' | 'to'>> & {
    relation: string;
    provenance: string;
    evidenceIds: string[];
    boundary: string;
  }>;
  evidenceBoundary: string;
  simulationBoundary: string;
}

export interface CanonicalDiscoveryDecisionInput {
  missionGoal: string;
  search: CanonicalDiscoverySearch;
  rankedMatches: Array<{
    circuitId: string;
    score: number;
    matchedTerms: string[];
    unmatchedTerms: string[];
  }>;
  selectedCircuitId: string | null;
  circuits: CanonicalCircuit[];
  evidence: CanonicalEvidence[];
  motorMaps: CanonicalMotorMap[];
}

export type DiscoveryCoverageIssueCode =
  | 'missing_motor_map'
  | 'motor_map_circuit_mismatch'
  | 'missing_evidence_record'
  | 'missing_node_reference'
  | 'missing_motor_map_evidence'
  | 'context_only_unconnected'
  | 'model_adapter_not_biological_link'
  | 'behavior_not_mapped'
  | 'body_part_not_mapped';

export interface DiscoveryCoverageIssue {
  code: DiscoveryCoverageIssueCode;
  subjectId: string;
  relatedIds: string[];
  detail: string;
}

export type DiscoveryModelGapCode =
  | 'no_model_coverage'
  | 'reduced_order_only'
  | 'model_adapter_edges'
  | 'hypothesized_nodes';

export interface DiscoveryModelCoverageGap {
  code: DiscoveryModelGapCode;
  subjectIds: string[];
  detail: string;
}

export interface DiscoveryGoalCoverage {
  status: 'complete' | 'partial' | 'unsupported' | 'unspecified';
  goalTerms: string[];
  matchedGoalTerms: string[];
  unmatchedGoalTerms: string[];
  fraction: number;
  requestedBehavior: string | null;
  behaviorSupported: boolean | null;
  requestedBodyPart: string | null;
  bodyPartSupported: boolean | null;
}

export interface DiscoveryCandidate {
  rank: number;
  circuitId: string;
  name: string;
  abbreviation: string;
  score: number;
  matchedTerms: string[];
  unmatchedTerms: string[];
  selected: boolean;
  goalCoverage: DiscoveryGoalCoverage;
  supportedBehaviors: string[];
  supportedBodyParts: string[];
  supportedPerturbations: DiscoveryPerturbation[];
  motorMapId: string | null;
  catalogEvidenceIds: string[];
  filterEligibleEvidenceIds: string[];
  measuredCausalEvidenceIdsByPerturbation: Record<DiscoveryPerturbation, string[]>;
  structuralOnlyEvidenceIds: string[];
  missingOrUnsupportedLinks: DiscoveryCoverageIssue[];
  modelCoverageGaps: DiscoveryModelCoverageGap[];
}

export type DiscoveryRecommendationCode =
  | 'highest_ranked_supported_selection'
  | 'explicit_alternative_selection'
  | 'selected_without_filtered_causal_support'
  | 'ambiguous_top_score'
  | 'evidence_filter_excludes_causal_support'
  | 'no_catalog_match';

export interface DiscoveryRecommendationReason {
  code: DiscoveryRecommendationCode;
  summary: string;
  score: number | null;
  scoreMargin: number | null;
  matchedGoalTerms: string[];
  unmatchedGoalTerms: string[];
  measuredCausalEvidenceIds: string[];
  limitations: string[];
}

export interface DiscoveryRecommendation {
  circuitId: string | null;
  reason: DiscoveryRecommendationReason;
}

export type DiscoveryRejectionCode =
  | 'lower_ranked'
  | 'top_score_tie'
  | 'explicitly_not_selected'
  | 'filtered_causal_support_missing';

export interface DiscoveryRejectedAlternative {
  circuitId: string;
  rank: number;
  score: number;
  reason: {
    code: DiscoveryRejectionCode;
    summary: string;
    scoreDelta: number | null;
    unmatchedGoalTerms: string[];
  };
}

export type DiscoveryEvidenceExclusionCode =
  | 'not_linked_to_ranked_candidate'
  | 'missing_catalog_record'
  | 'evidence_label_filter_mismatch'
  | 'not_measured'
  | 'not_hypothesis_support'
  | 'structural_context_only'
  | 'model_or_catalog_context_only'
  | 'behavior_not_supported'
  | 'perturbation_not_supported';

export interface DiscoveryExcludedEvidence {
  evidenceId: string;
  circuitIds: string[];
  excludedFrom: 'measured_causal_recommendation';
  reasons: Array<{
    code: DiscoveryEvidenceExclusionCode;
    detail: string;
  }>;
}

export interface DiscoveryDecision {
  schema: typeof DISCOVERY_DECISION_SCHEMA;
  schemaVersion: typeof DISCOVERY_DECISION_SCHEMA_VERSION;
  id: string;
  missionGoal: string;
  search: CanonicalDiscoverySearch;
  selectionStatus: DiscoverySelectionStatus;
  selectedCircuitId: string | null;
  candidates: DiscoveryCandidate[];
  recommendation: DiscoveryRecommendation;
  rejectedAlternatives: DiscoveryRejectedAlternative[];
  excludedEvidenceIds: string[];
  excludedEvidence: DiscoveryExcludedEvidence[];
  overallCoverage: 'partial' | 'undetermined' | 'none';
  coverageWarning: string;
  provenance: ['derived'];
}

const GOAL_STOP_WORDS = new Set([
  'a', 'an', 'and', 'adult', 'agent', 'behavior', 'brain', 'catalog', 'circuit', 'controller',
  'evidence', 'experiment', 'find', 'fly', 'for', 'from', 'fruit', 'in', 'investigate', 'map',
  'mapped', 'model', 'of', 'on', 'pathway', 'reproduce', 'research', 'show', 'source', 'sourcebacked',
  'the', 'to', 'trace', 'use', 'using', 'with',
]);

function requiredString(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string') throw new TypeError(`${path} must be a string.`);
  const canonical = value.trim().replace(/\s+/g, ' ');
  if (!allowEmpty && !canonical) throw new RangeError(`${path} must not be empty.`);
  return canonical;
}

function optionalString(value: unknown, path: string): string {
  return value === undefined ? '' : requiredString(value, path, true);
}

function uniqueStrings(values: readonly string[], path: string, sort = true): string[] {
  if (!Array.isArray(values)) throw new TypeError(`${path} must be an array.`);
  const result = [...new Set(values.map((value, index) => requiredString(value, `${path}[${index}]`)))];
  return sort ? result.sort((left, right) => left.localeCompare(right)) : result;
}

function assertUniqueIds(values: readonly { id: string }[], path: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) throw new RangeError(`${path} contains duplicate id ${value.id}.`);
    seen.add(value.id);
  }
}

function canonicalTerm(value: string): string {
  const normalized = value.toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b(?:middle|mid|t2|mesothoracic)[ -]?leg\b/g, 'midleg')
    .replace(/\b(?:activation|activating|activated)\b/g, 'activate')
    .replace(/\b(?:silencing|silenced|suppression|suppressing|suppressed)\b/g, 'silence')
    .replace(/\bbackwards\b/g, 'backward');
  return normalized.length > 3 && normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
}

function normalizedTerms(value: string): string[] {
  return [...new Set(value.toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b(?:middle|mid|t2|mesothoracic)[ -]?leg\b/g, 'midleg')
    .split(/[^a-z0-9]+/)
    .map(canonicalTerm)
    .filter((term) => (term.length >= 3 || term === 'gf') && !GOAL_STOP_WORDS.has(term)))];
}

function termMatches(queryTerm: string, candidateTerms: readonly string[]) {
  return candidateTerms.some((candidateTerm) => (
    candidateTerm === queryTerm
    || (queryTerm.length >= 3 && candidateTerm.endsWith(queryTerm))
    || (candidateTerm.length >= 3 && queryTerm.endsWith(candidateTerm))
  ));
}

export function validateDiscoveryDecisionInput(input: DiscoveryDecisionInput): void {
  if (!input || typeof input !== 'object') throw new TypeError('Discovery decision input must be an object.');
  requiredString(input.missionGoal, 'missionGoal');
  if (!input.search || typeof input.search !== 'object') throw new TypeError('search must be an object.');
  requiredString(input.search.query, 'search.query', true);
  if (input.search.limit !== undefined && (!Number.isInteger(input.search.limit) || input.search.limit < 1)) {
    throw new RangeError('search.limit must be a positive integer when provided.');
  }
  if (!Array.isArray(input.rankedMatches)) throw new TypeError('rankedMatches must be an array.');
  if (!Array.isArray(input.circuits)) throw new TypeError('circuits must be an array.');
  if (!Array.isArray(input.evidence)) throw new TypeError('evidence must be an array.');
  if (!Array.isArray(input.motorMaps)) throw new TypeError('motorMaps must be an array.');

  input.circuits.forEach((circuit, index) => {
    requiredString(circuit.id, `circuits[${index}].id`);
    requiredString(circuit.name, `circuits[${index}].name`);
    requiredString(circuit.abbreviation, `circuits[${index}].abbreviation`);
    requiredString(circuit.motorMapId, `circuits[${index}].motorMapId`);
    uniqueStrings(circuit.behaviors, `circuits[${index}].behaviors`);
    uniqueStrings(circuit.targetBodyParts, `circuits[${index}].targetBodyParts`);
    uniqueStrings(circuit.evidenceIds, `circuits[${index}].evidenceIds`);
  });
  input.evidence.forEach((record, index) => {
    requiredString(record.id, `evidence[${index}].id`);
    requiredString(record.provenance, `evidence[${index}].provenance`);
    requiredString(record.role, `evidence[${index}].role`);
    if (!record.support || typeof record.support !== 'object') {
      throw new TypeError(`evidence[${index}].support must be an object.`);
    }
    requiredString(record.support.kind, `evidence[${index}].support.kind`);
    if (record.support.perturbations) uniqueStrings(record.support.perturbations, `evidence[${index}].support.perturbations`);
    if (record.support.behaviors) uniqueStrings(record.support.behaviors, `evidence[${index}].support.behaviors`);
  });
  input.motorMaps.forEach((motorMap, index) => {
    requiredString(motorMap.id, `motorMaps[${index}].id`);
    requiredString(motorMap.circuitId, `motorMaps[${index}].circuitId`);
    uniqueStrings(motorMap.behaviors, `motorMaps[${index}].behaviors`);
    uniqueStrings(motorMap.targetBodyParts, `motorMaps[${index}].targetBodyParts`);
    if (motorMap.nodes && !Array.isArray(motorMap.nodes)) throw new TypeError(`motorMaps[${index}].nodes must be an array.`);
    if (motorMap.edges && !Array.isArray(motorMap.edges)) throw new TypeError(`motorMaps[${index}].edges must be an array.`);
    assertUniqueIds(motorMap.nodes ?? [], `motorMaps[${index}].nodes`);
    assertUniqueIds(motorMap.edges ?? [], `motorMaps[${index}].edges`);
  });
  input.rankedMatches.forEach((match, index) => {
    if (!match.circuit || typeof match.circuit !== 'object') throw new TypeError(`rankedMatches[${index}].circuit must be an object.`);
    requiredString(match.circuit.id, `rankedMatches[${index}].circuit.id`);
    if (!Number.isFinite(match.score) || match.score < 0) throw new RangeError(`rankedMatches[${index}].score must be a finite nonnegative number.`);
    uniqueStrings(match.matchedTerms, `rankedMatches[${index}].matchedTerms`);
    uniqueStrings(match.unmatchedTerms, `rankedMatches[${index}].unmatchedTerms`);
  });

  assertUniqueIds(input.circuits, 'circuits');
  assertUniqueIds(input.evidence, 'evidence');
  assertUniqueIds(input.motorMaps, 'motorMaps');
  const rankedIds = input.rankedMatches.map((match) => ({ id: match.circuit.id }));
  assertUniqueIds(rankedIds, 'rankedMatches');

  const circuitIds = new Set(input.circuits.map((circuit) => circuit.id));
  for (const { id } of rankedIds) {
    if (!circuitIds.has(id)) throw new RangeError(`Ranked circuit ${id} is missing from circuits.`);
  }
  if (input.selectedCircuitId !== null) {
    requiredString(input.selectedCircuitId, 'selectedCircuitId');
    if (!circuitIds.has(input.selectedCircuitId)) throw new RangeError(`Selected circuit ${input.selectedCircuitId} is missing from circuits.`);
    if (!rankedIds.some(({ id }) => id === input.selectedCircuitId)) {
      throw new RangeError(`Selected circuit ${input.selectedCircuitId} is missing from rankedMatches.`);
    }
  }
}

export function canonicalizeDiscoveryDecisionInput(input: DiscoveryDecisionInput): CanonicalDiscoveryDecisionInput {
  validateDiscoveryDecisionInput(input);
  const circuits: CanonicalCircuit[] = input.circuits.map((circuit) => ({
    id: requiredString(circuit.id, 'circuit.id'),
    name: requiredString(circuit.name, 'circuit.name'),
    abbreviation: requiredString(circuit.abbreviation, 'circuit.abbreviation'),
    behaviors: uniqueStrings(circuit.behaviors, `circuit ${circuit.id} behaviors`),
    targetBodyParts: uniqueStrings(circuit.targetBodyParts, `circuit ${circuit.id} targetBodyParts`),
    motorMapId: requiredString(circuit.motorMapId, `circuit ${circuit.id} motorMapId`),
    modelCoverage: optionalString(circuit.modelCoverage, `circuit ${circuit.id} modelCoverage`),
    evidenceIds: uniqueStrings(circuit.evidenceIds, `circuit ${circuit.id} evidenceIds`),
    summary: optionalString(circuit.summary, `circuit ${circuit.id} summary`),
  })).sort((left, right) => left.id.localeCompare(right.id));
  const evidence: CanonicalEvidence[] = input.evidence.map((record) => ({
    id: requiredString(record.id, 'evidence.id'),
    provenance: requiredString(record.provenance, `evidence ${record.id} provenance`),
    role: requiredString(record.role, `evidence ${record.id} role`),
    support: {
      kind: requiredString(record.support.kind, `evidence ${record.id} support.kind`),
      perturbations: uniqueStrings(record.support.perturbations ?? [], `evidence ${record.id} perturbations`),
      behaviors: uniqueStrings(record.support.behaviors ?? [], `evidence ${record.id} behaviors`),
    },
  })).sort((left, right) => left.id.localeCompare(right.id));
  const motorMaps: CanonicalMotorMap[] = input.motorMaps.map((motorMap) => ({
    id: requiredString(motorMap.id, 'motorMap.id'),
    circuitId: requiredString(motorMap.circuitId, `motorMap ${motorMap.id} circuitId`),
    motorProgram: optionalString(motorMap.motorProgram, `motorMap ${motorMap.id} motorProgram`),
    behaviors: uniqueStrings(motorMap.behaviors, `motorMap ${motorMap.id} behaviors`),
    targetBodyParts: uniqueStrings(motorMap.targetBodyParts, `motorMap ${motorMap.id} targetBodyParts`),
    nodes: (motorMap.nodes ?? []).map((node) => ({
      id: requiredString(node.id, `motorMap ${motorMap.id} node.id`),
      label: optionalString(node.label, `motorMap ${motorMap.id} node ${node.id} label`),
      pathStatus: optionalString(node.pathStatus, `motorMap ${motorMap.id} node ${node.id} pathStatus`),
      provenance: optionalString(node.provenance, `motorMap ${motorMap.id} node ${node.id} provenance`),
      evidenceIds: uniqueStrings(node.evidenceIds ?? [], `motorMap ${motorMap.id} node ${node.id} evidenceIds`),
    })).sort((left, right) => left.id.localeCompare(right.id)),
    edges: (motorMap.edges ?? []).map((edge) => ({
      id: requiredString(edge.id, `motorMap ${motorMap.id} edge.id`),
      from: requiredString(edge.from, `motorMap ${motorMap.id} edge ${edge.id} from`),
      to: requiredString(edge.to, `motorMap ${motorMap.id} edge ${edge.id} to`),
      relation: optionalString(edge.relation, `motorMap ${motorMap.id} edge ${edge.id} relation`),
      provenance: optionalString(edge.provenance, `motorMap ${motorMap.id} edge ${edge.id} provenance`),
      evidenceIds: uniqueStrings(edge.evidenceIds ?? [], `motorMap ${motorMap.id} edge ${edge.id} evidenceIds`),
      boundary: optionalString(edge.boundary, `motorMap ${motorMap.id} edge ${edge.id} boundary`),
    })).sort((left, right) => left.id.localeCompare(right.id)),
    evidenceBoundary: optionalString(motorMap.evidenceBoundary, `motorMap ${motorMap.id} evidenceBoundary`),
    simulationBoundary: optionalString(motorMap.simulationBoundary, `motorMap ${motorMap.id} simulationBoundary`),
  })).sort((left, right) => left.id.localeCompare(right.id));

  return {
    missionGoal: requiredString(input.missionGoal, 'missionGoal'),
    search: {
      query: requiredString(input.search.query, 'search.query', true),
      filters: {
        behavior: requiredString(input.search.behavior ?? 'any', 'search.behavior'),
        bodyPart: requiredString(input.search.bodyPart ?? 'any', 'search.bodyPart'),
        evidenceLabels: uniqueStrings(input.search.evidenceLabels ?? [], 'search.evidenceLabels'),
        limit: input.search.limit ?? null,
      },
    },
    rankedMatches: input.rankedMatches.map((match) => ({
      circuitId: requiredString(match.circuit.id, 'rankedMatch.circuit.id'),
      score: match.score,
      matchedTerms: uniqueStrings(match.matchedTerms, `rankedMatch ${match.circuit.id} matchedTerms`),
      unmatchedTerms: uniqueStrings(match.unmatchedTerms, `rankedMatch ${match.circuit.id} unmatchedTerms`),
    })).sort((left, right) => right.score - left.score || left.circuitId.localeCompare(right.circuitId)),
    selectedCircuitId: input.selectedCircuitId,
    circuits,
    evidence,
    motorMaps,
  };
}

function measuredCausalIds(
  circuit: CanonicalCircuit,
  records: readonly CanonicalEvidence[],
  evidenceLabels: readonly string[],
) {
  const labels = new Set(evidenceLabels);
  const circuitBehaviors = new Set(circuit.behaviors);
  const result: Record<DiscoveryPerturbation, string[]> = { activate: [], silence: [] };
  for (const record of records) {
    const behaviorCompatible = !record.support.behaviors.length
      || record.support.behaviors.some((behavior) => circuitBehaviors.has(behavior));
    if (record.provenance !== 'measured'
      || record.role !== 'hypothesis_support'
      || record.support.kind !== 'perturbation_effect'
      || !behaviorCompatible
      || (labels.size && !labels.has(record.provenance))) continue;
    for (const perturbation of ['activate', 'silence'] as const) {
      if (record.support.perturbations.includes(perturbation)) result[perturbation].push(record.id);
    }
  }
  result.activate.sort((left, right) => left.localeCompare(right));
  result.silence.sort((left, right) => left.localeCompare(right));
  return result;
}

function catalogSupportedPerturbations(circuit: CanonicalCircuit, records: readonly CanonicalEvidence[]) {
  const withoutFilter = measuredCausalIds(circuit, records, []);
  return (['activate', 'silence'] as const).filter((perturbation) => withoutFilter[perturbation].length);
}

function goalCoverage(
  missionGoal: string,
  search: CanonicalDiscoverySearch,
  circuit: CanonicalCircuit,
  motorMap: CanonicalMotorMap | null,
  match: CanonicalDiscoveryDecisionInput['rankedMatches'][number],
  perturbations: readonly DiscoveryPerturbation[],
): DiscoveryGoalCoverage {
  const goalTerms = normalizedTerms(`${missionGoal} ${search.query}`);
  const vocabulary = normalizedTerms([
    circuit.id,
    circuit.name,
    circuit.abbreviation,
    circuit.summary,
    ...circuit.behaviors,
    ...circuit.targetBodyParts,
    ...perturbations,
    motorMap?.id ?? '',
    motorMap?.motorProgram ?? '',
    ...(motorMap?.behaviors ?? []),
    ...(motorMap?.targetBodyParts ?? []),
    ...(motorMap?.nodes.flatMap((node) => [node.id, node.label]) ?? []),
    ...match.matchedTerms,
  ].join(' '));
  const matchedGoalTerms = goalTerms.filter((term) => termMatches(term, vocabulary));
  const unmatchedGoalTerms = goalTerms.filter((term) => !matchedGoalTerms.includes(term));
  const requestedBehavior = search.filters.behavior === 'any' ? null : search.filters.behavior;
  const requestedBodyPart = search.filters.bodyPart === 'any' ? null : search.filters.bodyPart;
  const behaviorSupported = requestedBehavior === null ? null : circuit.behaviors.includes(requestedBehavior);
  const bodyPartSupported = requestedBodyPart === null ? null : circuit.targetBodyParts.includes(requestedBodyPart);
  const structuredUnsupported = behaviorSupported === false || bodyPartSupported === false;
  const fraction = goalTerms.length ? matchedGoalTerms.length / goalTerms.length : 1;
  return {
    status: structuredUnsupported
      ? 'unsupported'
      : !goalTerms.length && requestedBehavior === null && requestedBodyPart === null
        ? 'unspecified'
        : unmatchedGoalTerms.length ? 'partial' : 'complete',
    goalTerms,
    matchedGoalTerms,
    unmatchedGoalTerms,
    fraction: Math.round(fraction * 1000) / 1000,
    requestedBehavior,
    behaviorSupported,
    requestedBodyPart,
    bodyPartSupported,
  };
}

function coverageIssues(
  circuit: CanonicalCircuit,
  motorMap: CanonicalMotorMap | null,
  evidenceById: ReadonlyMap<string, CanonicalEvidence>,
): DiscoveryCoverageIssue[] {
  const issues: DiscoveryCoverageIssue[] = [];
  for (const evidenceId of circuit.evidenceIds) {
    if (!evidenceById.has(evidenceId)) issues.push({
      code: 'missing_evidence_record',
      subjectId: evidenceId,
      relatedIds: [circuit.id],
      detail: `Circuit ${circuit.id} references evidence ${evidenceId}, which is absent from the supplied evidence catalog.`,
    });
  }
  if (!motorMap) {
    issues.push({
      code: 'missing_motor_map',
      subjectId: circuit.motorMapId,
      relatedIds: [circuit.id],
      detail: `Circuit ${circuit.id} declares motor map ${circuit.motorMapId}, which is absent from the supplied motor-map catalog.`,
    });
    return issues;
  }
  if (motorMap.circuitId !== circuit.id) issues.push({
    code: 'motor_map_circuit_mismatch',
    subjectId: motorMap.id,
    relatedIds: [circuit.id, motorMap.circuitId],
    detail: `Motor map ${motorMap.id} is cataloged for ${motorMap.circuitId}, not ${circuit.id}.`,
  });
  const nodeIds = new Set(motorMap.nodes.map((node) => node.id));
  for (const node of motorMap.nodes) {
    if (node.pathStatus === 'context_only_unconnected') issues.push({
      code: 'context_only_unconnected',
      subjectId: node.id,
      relatedIds: [motorMap.id],
      detail: `Motor-map node ${node.id} is context only and has no supported connection in this map.`,
    });
    for (const evidenceId of node.evidenceIds) {
      if (!evidenceById.has(evidenceId)) issues.push({
        code: 'missing_motor_map_evidence',
        subjectId: evidenceId,
        relatedIds: [motorMap.id, node.id],
        detail: `Motor-map node ${node.id} references evidence ${evidenceId}, which is absent from the supplied catalog.`,
      });
    }
  }
  for (const edge of motorMap.edges) {
    const missingNodes = [edge.from, edge.to].filter((id) => !nodeIds.has(id));
    if (missingNodes.length) issues.push({
      code: 'missing_node_reference',
      subjectId: edge.id,
      relatedIds: missingNodes.sort((left, right) => left.localeCompare(right)),
      detail: `Motor-map edge ${edge.id} references missing node${missingNodes.length === 1 ? '' : 's'} ${missingNodes.join(', ')}.`,
    });
    if (edge.relation === 'model_adapter' || edge.provenance === 'agent_hypothesized') issues.push({
      code: 'model_adapter_not_biological_link',
      subjectId: edge.id,
      relatedIds: [edge.from, edge.to],
      detail: `Motor-map edge ${edge.id} is a hand-authored model adapter, not a measured or connectome-inferred biological link.`,
    });
    for (const evidenceId of edge.evidenceIds) {
      if (!evidenceById.has(evidenceId)) issues.push({
        code: 'missing_motor_map_evidence',
        subjectId: evidenceId,
        relatedIds: [motorMap.id, edge.id],
        detail: `Motor-map edge ${edge.id} references evidence ${evidenceId}, which is absent from the supplied catalog.`,
      });
    }
  }
  for (const behavior of circuit.behaviors) {
    if (!motorMap.behaviors.includes(behavior)) issues.push({
      code: 'behavior_not_mapped',
      subjectId: behavior,
      relatedIds: [circuit.id, motorMap.id],
      detail: `Circuit behavior ${behavior} is not declared by motor map ${motorMap.id}.`,
    });
  }
  for (const bodyPart of circuit.targetBodyParts) {
    if (!motorMap.targetBodyParts.includes(bodyPart)) issues.push({
      code: 'body_part_not_mapped',
      subjectId: bodyPart,
      relatedIds: [circuit.id, motorMap.id],
      detail: `Circuit body part ${bodyPart} is not declared by motor map ${motorMap.id}.`,
    });
  }
  return issues.sort((left, right) => left.code.localeCompare(right.code)
    || left.subjectId.localeCompare(right.subjectId)
    || left.relatedIds.join('\u0000').localeCompare(right.relatedIds.join('\u0000')));
}

function modelCoverageGaps(circuit: CanonicalCircuit, motorMap: CanonicalMotorMap | null): DiscoveryModelCoverageGap[] {
  if (!motorMap) return [{
    code: 'no_model_coverage',
    subjectIds: [circuit.id],
    detail: `Circuit ${circuit.id} has no supplied motor map and therefore no supported model binding.`,
  }];
  const gaps: DiscoveryModelCoverageGap[] = [{
    code: 'reduced_order_only',
    subjectIds: [circuit.id, motorMap.id],
    detail: motorMap.simulationBoundary
      || 'The motor map is a reduced-order controller binding, not an executed connectome, neural, muscle, or physics model.',
  }];
  const adapterEdges = motorMap.edges
    .filter((edge) => edge.relation === 'model_adapter' || edge.provenance === 'agent_hypothesized')
    .map((edge) => edge.id)
    .sort((left, right) => left.localeCompare(right));
  if (adapterEdges.length) gaps.push({
    code: 'model_adapter_edges',
    subjectIds: adapterEdges,
    detail: 'These edges are hand-authored model adapters rather than measured or connectome-inferred biological links.',
  });
  const hypothesizedNodes = motorMap.nodes
    .filter((node) => node.provenance === 'agent_hypothesized')
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));
  if (hypothesizedNodes.length) gaps.push({
    code: 'hypothesized_nodes',
    subjectIds: hypothesizedNodes,
    detail: 'These body/controller nodes are model bindings and are not biological measurements.',
  });
  return gaps;
}

function evidenceExclusions(
  canonical: CanonicalDiscoveryDecisionInput,
  candidateCircuitIds: readonly string[],
): DiscoveryExcludedEvidence[] {
  const circuitById = new Map(canonical.circuits.map((circuit) => [circuit.id, circuit]));
  const evidenceById = new Map(canonical.evidence.map((record) => [record.id, record]));
  const evidenceLabels = new Set(canonical.search.filters.evidenceLabels);
  const linkedCircuitIdsByEvidence = new Map<string, string[]>();
  for (const circuitId of candidateCircuitIds) {
    const circuit = circuitById.get(circuitId)!;
    for (const evidenceId of circuit.evidenceIds) {
      const linked = linkedCircuitIdsByEvidence.get(evidenceId) ?? [];
      linked.push(circuitId);
      linkedCircuitIdsByEvidence.set(evidenceId, linked);
    }
  }
  const evidenceIds = new Set([...canonical.evidence.map((record) => record.id), ...linkedCircuitIdsByEvidence.keys()]);
  const exclusions: DiscoveryExcludedEvidence[] = [];
  for (const evidenceId of [...evidenceIds].sort((left, right) => left.localeCompare(right))) {
    const record = evidenceById.get(evidenceId);
    const circuitIds = (linkedCircuitIdsByEvidence.get(evidenceId) ?? []).sort((left, right) => left.localeCompare(right));
    const reasons: DiscoveryExcludedEvidence['reasons'] = [];
    if (!circuitIds.length) reasons.push({
      code: 'not_linked_to_ranked_candidate',
      detail: 'The evidence record is not referenced by any ranked candidate.',
    });
    if (!record) reasons.push({
      code: 'missing_catalog_record',
      detail: 'A ranked circuit references this evidence ID, but the supplied evidence catalog has no matching record.',
    });
    if (record) {
      if (evidenceLabels.size && !evidenceLabels.has(record.provenance)) reasons.push({
        code: 'evidence_label_filter_mismatch',
        detail: `Evidence provenance ${record.provenance} is outside the requested labels: ${[...evidenceLabels].sort().join(', ')}.`,
      });
      if (record.provenance !== 'measured') reasons.push({
        code: 'not_measured',
        detail: `Evidence provenance ${record.provenance} cannot be counted as measured causal support.`,
      });
      if (record.role !== 'hypothesis_support') reasons.push({
        code: 'not_hypothesis_support',
        detail: `Evidence role ${record.role} is not hypothesis support.`,
      });
      if (record.support.kind === 'structural_path') reasons.push({
        code: 'structural_context_only',
        detail: 'Structural connectivity alone does not establish perturbation causality.',
      });
      else if (record.support.kind !== 'perturbation_effect') reasons.push({
        code: 'model_or_catalog_context_only',
        detail: `Evidence support kind ${record.support.kind} is contextual rather than a perturbation effect.`,
      });
      if (circuitIds.length && record.support.behaviors.length && !circuitIds.some((circuitId) => {
        const circuit = circuitById.get(circuitId)!;
        return record.support.behaviors.some((behavior) => circuit.behaviors.includes(behavior));
      })) reasons.push({
        code: 'behavior_not_supported',
        detail: 'The evidence behaviors do not overlap the linked ranked candidates.',
      });
      if (record.support.kind === 'perturbation_effect'
        && !record.support.perturbations.some((value) => value === 'activate' || value === 'silence')) reasons.push({
        code: 'perturbation_not_supported',
        detail: 'The perturbation-effect record declares neither activation nor silencing support.',
      });
    }
    if (reasons.length) exclusions.push({
      evidenceId,
      circuitIds,
      excludedFrom: 'measured_causal_recommendation',
      reasons,
    });
  }
  return exclusions;
}

function selectionStatus(canonical: CanonicalDiscoveryDecisionInput): DiscoverySelectionStatus {
  if (canonical.selectedCircuitId) return 'selected';
  if (!canonical.rankedMatches.length) return 'no_match';
  if (canonical.rankedMatches.length > 1
    && canonical.rankedMatches[0].score === canonical.rankedMatches[1].score) return 'ambiguous';
  return 'evidence_filtered';
}

function recommendationFor(
  status: DiscoverySelectionStatus,
  selectedCircuitId: string | null,
  candidates: readonly DiscoveryCandidate[],
): DiscoveryRecommendation {
  const selected = candidates.find((candidate) => candidate.circuitId === selectedCircuitId) ?? null;
  if (!selected) {
    const top = candidates[0] ?? null;
    const code: DiscoveryRecommendationCode = status === 'ambiguous'
      ? 'ambiguous_top_score'
      : status === 'no_match' ? 'no_catalog_match' : 'evidence_filter_excludes_causal_support';
    const summary = status === 'ambiguous'
      ? 'No circuit is recommended because multiple candidates share the top score; preserve the ambiguity and refine the goal or filters.'
      : status === 'no_match'
        ? 'No circuit is recommended because the search returned no catalog match.'
        : 'The search has a unique highest-ranked candidate, but the evidence filter leaves no eligible causal selection.';
    return {
      circuitId: null,
      reason: {
        code,
        summary,
        score: top?.score ?? null,
        scoreMargin: top && candidates[1] ? top.score - candidates[1].score : null,
        matchedGoalTerms: top?.goalCoverage.matchedGoalTerms ?? [],
        unmatchedGoalTerms: top?.goalCoverage.unmatchedGoalTerms ?? [],
        measuredCausalEvidenceIds: [],
        limitations: top
          ? [...new Set(top.modelCoverageGaps.map((gap) => gap.detail))]
          : ['The bounded supplied catalog contains no ranked candidate for this search.'],
      },
    };
  }
  const causalIds = [...new Set([
    ...selected.measuredCausalEvidenceIdsByPerturbation.activate,
    ...selected.measuredCausalEvidenceIdsByPerturbation.silence,
  ])].sort((left, right) => left.localeCompare(right));
  const top = candidates[0]!;
  const isHighest = selected.rank === 1;
  const code: DiscoveryRecommendationCode = !causalIds.length
    ? 'selected_without_filtered_causal_support'
    : isHighest ? 'highest_ranked_supported_selection' : 'explicit_alternative_selection';
  const summary = !causalIds.length
    ? `${selected.abbreviation} is the committed selection, but the active evidence filters leave it without measured activation or silencing support.`
    : isHighest
      ? `${selected.abbreviation} is the committed highest-ranked candidate with filter-eligible measured perturbation support.`
      : `${selected.abbreviation} is an explicitly committed alternative rather than the highest-ranked candidate; the higher-ranked candidates remain preserved.`;
  return {
    circuitId: selected.circuitId,
    reason: {
      code,
      summary,
      score: selected.score,
      scoreMargin: isHighest && candidates[1]
        ? selected.score - candidates[1].score
        : selected.score - top.score,
      matchedGoalTerms: selected.goalCoverage.matchedGoalTerms,
      unmatchedGoalTerms: selected.goalCoverage.unmatchedGoalTerms,
      measuredCausalEvidenceIds: causalIds,
      limitations: [...new Set([
        ...selected.missingOrUnsupportedLinks.map((issue) => issue.detail),
        ...selected.modelCoverageGaps.map((gap) => gap.detail),
      ])],
    },
  };
}

function rejectedAlternatives(
  status: DiscoverySelectionStatus,
  selectedCircuitId: string | null,
  candidates: readonly DiscoveryCandidate[],
): DiscoveryRejectedAlternative[] {
  const topScore = candidates[0]?.score ?? null;
  return candidates.filter((candidate) => candidate.circuitId !== selectedCircuitId).map((candidate) => {
    const causalCount = candidate.measuredCausalEvidenceIdsByPerturbation.activate.length
      + candidate.measuredCausalEvidenceIdsByPerturbation.silence.length;
    let code: DiscoveryRejectionCode;
    let summary: string;
    if (!causalCount) {
      code = 'filtered_causal_support_missing';
      summary = `${candidate.abbreviation} remains a ranked alternative, but the active evidence filters leave no measured perturbation support.`;
    } else if (status === 'ambiguous' && candidate.score === topScore) {
      code = 'top_score_tie';
      summary = `${candidate.abbreviation} shares the top score; it is not rejected scientifically and remains unresolved pending disambiguation.`;
    } else if (selectedCircuitId && candidate.score >= (candidates.find((entry) => entry.circuitId === selectedCircuitId)?.score ?? Number.POSITIVE_INFINITY)) {
      code = 'explicitly_not_selected';
      summary = `${candidate.abbreviation} scored at least as highly as the committed circuit but was not the explicit selection.`;
    } else {
      code = 'lower_ranked';
      summary = `${candidate.abbreviation} remains a preserved alternative with a lower search score.`;
    }
    return {
      circuitId: candidate.circuitId,
      rank: candidate.rank,
      score: candidate.score,
      reason: {
        code,
        summary,
        scoreDelta: topScore === null ? null : topScore - candidate.score,
        unmatchedGoalTerms: candidate.goalCoverage.unmatchedGoalTerms,
      },
    };
  });
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Discovery decision identity cannot contain a non-finite number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
  }
  throw new TypeError(`Discovery decision identity cannot contain ${typeof value}.`);
}

export function discoveryDecisionId(value: Omit<DiscoveryDecision, 'id'>): string {
  return `discovery_${deterministicSha256Hex(stableSerialize(value))}`;
}

export function validateDiscoveryDecision(decision: DiscoveryDecision): DiscoveryDecision {
  if (decision.schema !== DISCOVERY_DECISION_SCHEMA) throw new RangeError(`Discovery decision schema must be ${DISCOVERY_DECISION_SCHEMA}.`);
  if (decision.schemaVersion !== DISCOVERY_DECISION_SCHEMA_VERSION) {
    throw new RangeError(`Discovery decision schemaVersion must be ${DISCOVERY_DECISION_SCHEMA_VERSION}.`);
  }
  requiredString(decision.id, 'decision.id');
  requiredString(decision.missionGoal, 'decision.missionGoal');
  if (new Set(decision.candidates.map((candidate) => candidate.circuitId)).size !== decision.candidates.length) {
    throw new RangeError('Discovery decision candidates must have unique circuit IDs.');
  }
  decision.candidates.forEach((candidate, index) => {
    if (candidate.rank !== index + 1) throw new RangeError('Discovery decision candidate ranks must be contiguous and ordered.');
    if (!Number.isFinite(candidate.score)) throw new RangeError(`Candidate ${candidate.circuitId} score must be finite.`);
  });
  if (decision.selectionStatus === 'selected') {
    if (!decision.selectedCircuitId || decision.recommendation.circuitId !== decision.selectedCircuitId) {
      throw new RangeError('A selected discovery decision must preserve the same selected and recommended circuit ID.');
    }
  } else if (decision.selectedCircuitId !== null || decision.recommendation.circuitId !== null) {
    throw new RangeError('A non-selected discovery decision cannot contain a selected or recommended circuit ID.');
  }
  const identity = Object.fromEntries(
    Object.entries(decision).filter(([key]) => key !== 'id'),
  ) as Omit<DiscoveryDecision, 'id'>;
  const expectedId = discoveryDecisionId(identity);
  if (decision.id !== expectedId) throw new RangeError(`Discovery decision id must be ${expectedId}.`);
  const serialized = JSON.stringify(decision);
  if (serialized === undefined) throw new TypeError('Discovery decision must be JSON serializable.');
  JSON.parse(serialized);
  return decision;
}

export function buildDiscoveryDecision(input: DiscoveryDecisionInput): DiscoveryDecision {
  const canonical = canonicalizeDiscoveryDecisionInput(input);
  const circuitById = new Map(canonical.circuits.map((circuit) => [circuit.id, circuit]));
  const evidenceById = new Map(canonical.evidence.map((record) => [record.id, record]));
  const motorMapById = new Map(canonical.motorMaps.map((motorMap) => [motorMap.id, motorMap]));
  const candidates: DiscoveryCandidate[] = canonical.rankedMatches.map((match, index) => {
    const circuit = circuitById.get(match.circuitId)!;
    const records = circuit.evidenceIds.map((id) => evidenceById.get(id)).filter((record): record is CanonicalEvidence => Boolean(record));
    const motorMap = motorMapById.get(circuit.motorMapId) ?? null;
    const measuredIds = measuredCausalIds(circuit, records, canonical.search.filters.evidenceLabels);
    const supportedPerturbations = catalogSupportedPerturbations(circuit, records);
    const filterEligibleEvidenceIds = records
      .filter((record) => !canonical.search.filters.evidenceLabels.length
        || canonical.search.filters.evidenceLabels.includes(record.provenance))
      .map((record) => record.id)
      .sort((left, right) => left.localeCompare(right));
    return {
      rank: index + 1,
      circuitId: circuit.id,
      name: circuit.name,
      abbreviation: circuit.abbreviation,
      score: match.score,
      matchedTerms: match.matchedTerms,
      unmatchedTerms: match.unmatchedTerms,
      selected: circuit.id === canonical.selectedCircuitId,
      goalCoverage: goalCoverage(canonical.missionGoal, canonical.search, circuit, motorMap, match, supportedPerturbations),
      supportedBehaviors: circuit.behaviors,
      supportedBodyParts: circuit.targetBodyParts,
      supportedPerturbations,
      motorMapId: motorMap?.id ?? null,
      catalogEvidenceIds: circuit.evidenceIds,
      filterEligibleEvidenceIds,
      measuredCausalEvidenceIdsByPerturbation: measuredIds,
      structuralOnlyEvidenceIds: records
        .filter((record) => record.support.kind === 'structural_path')
        .map((record) => record.id)
        .sort((left, right) => left.localeCompare(right)),
      missingOrUnsupportedLinks: coverageIssues(circuit, motorMap, evidenceById),
      modelCoverageGaps: modelCoverageGaps(circuit, motorMap),
    };
  });
  const status = selectionStatus(canonical);
  const exclusions = evidenceExclusions(canonical, candidates.map((candidate) => candidate.circuitId));
  const identity: Omit<DiscoveryDecision, 'id'> = {
    schema: DISCOVERY_DECISION_SCHEMA,
    schemaVersion: DISCOVERY_DECISION_SCHEMA_VERSION,
    missionGoal: canonical.missionGoal,
    search: canonical.search,
    selectionStatus: status,
    selectedCircuitId: canonical.selectedCircuitId,
    candidates,
    recommendation: recommendationFor(status, canonical.selectedCircuitId, candidates),
    rejectedAlternatives: rejectedAlternatives(status, canonical.selectedCircuitId, candidates),
    excludedEvidenceIds: exclusions.map((record) => record.evidenceId),
    excludedEvidence: exclusions,
    overallCoverage: status === 'no_match' ? 'none' : status === 'selected' ? 'partial' : 'undetermined',
    coverageWarning: status === 'no_match'
      ? `No supplied catalog circuit matched this search. ${DISCOVERY_DECISION_COVERAGE_WARNING}`
      : status === 'ambiguous'
        ? `The top search score is ambiguous, so coverage cannot be assigned to one circuit. ${DISCOVERY_DECISION_COVERAGE_WARNING}`
        : DISCOVERY_DECISION_COVERAGE_WARNING,
    provenance: ['derived'],
  };
  return validateDiscoveryDecision({ ...identity, id: discoveryDecisionId(identity) });
}

export const createDiscoveryDecision = buildDiscoveryDecision;
