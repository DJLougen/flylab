import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildDiscoveryDecision,
  canonicalizeDiscoveryDecisionInput,
  validateDiscoveryDecision,
  type DiscoveryDecisionInput,
} from '../lib/discovery-decision.js';
import {
  CIRCUITS,
  EMBODIED_MOTOR_MAPS,
  EVIDENCE,
  rankCircuitsForSearch,
} from '../lib/flylab.js';

function decisionInput(overrides: Partial<DiscoveryDecisionInput> = {}): DiscoveryDecisionInput {
  const rankedMatches = rankCircuitsForSearch('jump wing escape backward');
  return {
    missionGoal: 'Compare adult giant-fiber escape with MDN backward walking, including activation and silencing support.',
    search: {
      query: 'jump wing escape backward',
      behavior: 'any',
      bodyPart: 'any',
      evidenceLabels: [],
      limit: 8,
    },
    rankedMatches,
    selectedCircuitId: rankedMatches[0]?.circuit.id ?? null,
    circuits: CIRCUITS,
    evidence: EVIDENCE,
    motorMaps: EMBODIED_MOTOR_MAPS,
    ...overrides,
  };
}

describe('persisted mission discovery decision', () => {
  test('persists GF and MDN hero-style ranking, causal coverage, and structural boundaries', () => {
    const decision = buildDiscoveryDecision(decisionInput());

    assert.equal(decision.selectionStatus, 'selected');
    assert.equal(decision.selectedCircuitId, 'circuit_gf_adult');
    assert.equal(decision.recommendation.circuitId, 'circuit_gf_adult');
    assert.equal(decision.recommendation.reason.code, 'highest_ranked_supported_selection');
    assert.deepEqual(decision.candidates.map((candidate) => candidate.circuitId), [
      'circuit_gf_adult',
      'circuit_mdn_adult',
    ]);

    const gf = decision.candidates[0]!;
    const mdn = decision.candidates[1]!;
    assert.deepEqual(gf.matchedTerms, ['escape', 'jump', 'wing']);
    assert.deepEqual(gf.unmatchedTerms, ['backward']);
    assert.deepEqual(gf.supportedBehaviors, ['short_mode_escape']);
    assert.deepEqual(gf.supportedBodyParts, ['left_midleg', 'left_wing', 'right_midleg', 'right_wing']);
    assert.deepEqual(gf.supportedPerturbations, ['activate', 'silence']);
    assert.equal(gf.motorMapId, 'motor_map_gf_escape_v1');
    assert.deepEqual(gf.measuredCausalEvidenceIdsByPerturbation, {
      activate: ['E-GF-CAUSAL-010'],
      silence: ['E-GF-CAUSAL-010'],
    });
    assert.deepEqual(gf.structuralOnlyEvidenceIds, ['E-FANC-ESCAPE-012']);
    assert.ok(gf.modelCoverageGaps.some((gap) => gap.code === 'model_adapter_edges'));

    assert.deepEqual(mdn.measuredCausalEvidenceIdsByPerturbation.activate, [
      'E-MDN-ACTIVATION-001',
      'E-MDN-LATERALITY-006',
    ]);
    assert.deepEqual(mdn.measuredCausalEvidenceIdsByPerturbation.silence, ['E-MDN-SILENCING-005']);
    assert.deepEqual(mdn.structuralOnlyEvidenceIds, ['E-BANC-PATH-003']);
    assert.ok(mdn.missingOrUnsupportedLinks.some((issue) => (
      issue.code === 'context_only_unconnected' && issue.subjectId === 'lul130'
    )));
    assert.ok(gf.goalCoverage.goalTerms.length > 0);
    assert.ok(gf.goalCoverage.matchedGoalTerms.length > 0);
    assert.match(decision.coverageWarning, /not a complete connectome/i);
    assert.deepEqual(JSON.parse(JSON.stringify(decision)), decision);
    assert.strictEqual(validateDiscoveryDecision(decision), decision);
  });

  test('preserves every higher- and lower-ranked alternative when an explicit alternative is selected', () => {
    const input = decisionInput({ selectedCircuitId: 'circuit_mdn_adult' });
    const decision = buildDiscoveryDecision(input);

    assert.equal(decision.recommendation.circuitId, 'circuit_mdn_adult');
    assert.equal(decision.recommendation.reason.code, 'explicit_alternative_selection');
    assert.deepEqual(decision.candidates.map(({ circuitId, selected }) => ({ circuitId, selected })), [
      { circuitId: 'circuit_gf_adult', selected: false },
      { circuitId: 'circuit_mdn_adult', selected: true },
    ]);
    assert.deepEqual(decision.rejectedAlternatives.map((alternative) => alternative.circuitId), [
      'circuit_gf_adult',
    ]);
    assert.equal(decision.rejectedAlternatives[0]?.reason.code, 'explicitly_not_selected');
    assert.ok((decision.rejectedAlternatives[0]?.reason.scoreDelta ?? -1) === 0);
  });

  test('preserves top-score ambiguity and an empty no-match state without inventing a recommendation', () => {
    const ambiguousMatches = rankCircuitsForSearch('leg');
    const ambiguous = buildDiscoveryDecision(decisionInput({
      search: { query: 'leg', behavior: 'any', bodyPart: 'any', evidenceLabels: [], limit: 8 },
      rankedMatches: ambiguousMatches,
      selectedCircuitId: null,
    }));

    assert.equal(ambiguous.selectionStatus, 'ambiguous');
    assert.equal(ambiguous.selectedCircuitId, null);
    assert.equal(ambiguous.recommendation.circuitId, null);
    assert.equal(ambiguous.recommendation.reason.code, 'ambiguous_top_score');
    assert.equal(ambiguous.candidates.length, 2);
    assert.deepEqual(
      ambiguous.rejectedAlternatives.map((alternative) => alternative.reason.code),
      ['top_score_tie', 'top_score_tie'],
    );

    const noMatch = buildDiscoveryDecision(decisionInput({
      search: { query: 'proboscis grooming', evidenceLabels: [], limit: 8 },
      rankedMatches: [],
      selectedCircuitId: null,
    }));
    assert.equal(noMatch.selectionStatus, 'no_match');
    assert.equal(noMatch.recommendation.reason.code, 'no_catalog_match');
    assert.deepEqual(noMatch.candidates, []);
    assert.deepEqual(noMatch.rejectedAlternatives, []);
    assert.equal(noMatch.overallCoverage, 'none');
  });

  test('canonicalizes equivalent inputs to the same deterministic artifact and ID', () => {
    const original = decisionInput();
    const reordered: DiscoveryDecisionInput = {
      ...original,
      missionGoal: `  ${original.missionGoal}  `,
      search: {
        ...original.search,
        evidenceLabels: ['measured', 'measured'],
      },
      rankedMatches: [...original.rankedMatches].reverse().map((match) => ({
        ...match,
        matchedTerms: [...match.matchedTerms].reverse(),
        unmatchedTerms: [...match.unmatchedTerms].reverse(),
      })),
      circuits: [...original.circuits].reverse().map((circuit) => ({
        ...circuit,
        behaviors: [...circuit.behaviors].reverse(),
        targetBodyParts: [...circuit.targetBodyParts].reverse(),
        evidenceIds: [...circuit.evidenceIds].reverse(),
      })),
      evidence: [...original.evidence].reverse(),
      motorMaps: [...original.motorMaps].reverse().map((motorMap) => ({
        ...motorMap,
        behaviors: [...motorMap.behaviors].reverse(),
        targetBodyParts: [...motorMap.targetBodyParts].reverse(),
        nodes: [...(motorMap.nodes ?? [])].reverse(),
        edges: [...(motorMap.edges ?? [])].reverse(),
      })),
    };
    const measuredOriginal = buildDiscoveryDecision({
      ...original,
      search: { ...original.search, evidenceLabels: ['measured'] },
    });
    const measuredReordered = buildDiscoveryDecision(reordered);

    assert.equal(measuredReordered.id, measuredOriginal.id);
    assert.deepEqual(measuredReordered, measuredOriginal);
    assert.match(measuredOriginal.id, /^discovery_[0-9a-f]{64}$/);
    assert.deepEqual(
      canonicalizeDiscoveryDecisionInput(reordered),
      canonicalizeDiscoveryDecisionInput({
        ...original,
        search: { ...original.search, evidenceLabels: ['measured'] },
      }),
    );
  });

  test('records why evidence was excluded while retaining catalog perturbation support', () => {
    const matches = rankCircuitsForSearch('giant fiber escape');
    const decision = buildDiscoveryDecision(decisionInput({
      search: {
        query: 'giant fiber escape',
        behavior: 'short_mode_escape',
        bodyPart: 'left_wing',
        evidenceLabels: ['connectome_inferred'],
        limit: 8,
      },
      rankedMatches: matches,
      selectedCircuitId: null,
    }));
    const gf = decision.candidates[0]!;

    assert.equal(decision.selectionStatus, 'evidence_filtered');
    assert.equal(decision.recommendation.reason.code, 'evidence_filter_excludes_causal_support');
    assert.deepEqual(gf.supportedPerturbations, ['activate', 'silence']);
    assert.deepEqual(gf.measuredCausalEvidenceIdsByPerturbation, { activate: [], silence: [] });
    assert.deepEqual(gf.filterEligibleEvidenceIds, ['E-FANC-ESCAPE-012']);

    const causal = decision.excludedEvidence.find((record) => record.evidenceId === 'E-GF-CAUSAL-010')!;
    assert.ok(causal.reasons.some((reason) => reason.code === 'evidence_label_filter_mismatch'));
    const structural = decision.excludedEvidence.find((record) => record.evidenceId === 'E-FANC-ESCAPE-012')!;
    assert.ok(structural.reasons.some((reason) => reason.code === 'structural_context_only'));
    assert.ok(structural.reasons.some((reason) => reason.code === 'not_measured'));
    assert.ok(decision.excludedEvidenceIds.includes('E-GF-CAUSAL-010'));
    assert.ok(decision.excludedEvidenceIds.includes('E-FANC-ESCAPE-012'));
  });

  test('rejects invalid selections and non-finite scores before producing an artifact', () => {
    assert.throws(
      () => buildDiscoveryDecision(decisionInput({ selectedCircuitId: 'missing_circuit' })),
      /missing from circuits/,
    );
    const invalidMatches = rankCircuitsForSearch('GF').map((match) => ({ ...match, score: Number.NaN }));
    assert.throws(
      () => buildDiscoveryDecision(decisionInput({ rankedMatches: invalidMatches })),
      /finite nonnegative number/,
    );
  });
});
