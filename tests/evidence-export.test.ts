import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import ts from 'typescript';

import {
  EVIDENCE_EXPORT_SCHEMA,
  EVIDENCE_EXPORT_SCHEMA_URL,
  EVIDENCE_EXPORT_SCHEMA_VERSION,
  createEvidenceExportEnvelope,
  evidenceExportFilename,
  serializeEvidenceExport,
  type EvidenceBundleMetadata,
} from '../lib/evidence-export.js';
import { createExperimentApproval } from '../lib/experiment-approval.js';
import {
  ANALYSIS_METRICS,
  analyzeBatch,
  designExperiment,
  sha256,
  simulateExperiment,
} from '../lib/flylab.js';

function duplicateJsonObjectKeys(sourceText: string): string[] {
  const source = ts.parseJsonText('flylab-evidence-export-v3.schema.json', sourceText);
  const duplicates: string[] = [];

  function visit(node: ts.Node, path: string) {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Set<string>();
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = property.name.getText(source);
        if (seen.has(key)) duplicates.push(`${path}.${key}`);
        seen.add(key);
        visit(property.initializer, `${path}.${key}`);
      }
      return;
    }
    if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach((element, index) => visit(element, `${path}[${index}]`));
    }
  }

  const root = source.statements[0];
  if (root && ts.isExpressionStatement(root)) visit(root.expression, '$');
  return duplicates;
}

const provenanceCounts = {
  measured: 2,
  derived: 3,
  connectome_inferred: 1,
  simulation_predicted: 4,
  agent_hypothesized: 2,
};

const annotation = {
  id: 'annotation_123',
  title: 'MDN-inspired trial',
  note: 'Model evidence only.',
  author: 'caller_input' as const,
  trust: 'untrusted_annotation' as const,
  purpose: 'administrative_annotation_not_evidence' as const,
  boundary: 'Administrative annotation; not scientific evidence.',
};

const provenanceIndex = {
  measured: ['evidence_123'],
  derived: ['analysis_123', 'evidence_123'],
  connectome_inferred: ['context_evidence_123'],
  simulation_predicted: ['run_123'],
  agent_hypothesized: ['exp_123'],
};

const lineageEdges = [
  { from: 'evidence_123', relation: 'supports', to: 'exp_123' },
  { from: 'context_evidence_123', relation: 'contextualizes', to: 'exp_123' },
  { from: 'exp_123', relation: 'produces', to: 'run_123' },
];

describe('FlyLab portable evidence export', () => {
  test('preserves the exact saved metadata and full payload in a versioned envelope', async () => {
    const payload = {
      format: 'flylab.experiment-evidence-bundle.v3',
      annotation,
      experiment: { id: 'exp_123', seed: 73142 },
      runs: [{ id: 'run_123', trajectory: [0, -1.2, -2.4] }],
    };
    const manifestHash = await sha256(payload);
    const bundle: EvidenceBundleMetadata = {
      id: 'evidence_123',
      scope: 'experiment',
      title: payload.annotation.title,
      manifestHash,
      savedAt: '2026-08-26T12:34:56.000Z',
      includedIds: ['exp_123', 'run_123'],
      supportingEvidenceIds: ['evidence_123'],
      supportingSourceIds: ['source_123'],
      contextEvidenceIds: ['context_evidence_123'],
      contextSourceIds: ['context_source_123'],
      methodEvidenceIds: ['method_evidence_123'],
      methodSourceIds: ['method_source_123'],
      catalogSourceIds: ['catalog_source_123'],
      provenanceCounts,
      provenanceIndex,
      lineageEdges,
      boundary: 'Simulation evidence bundle; not a new biological experiment.',
      provenance: ['derived'],
      annotation,
    };

    const envelope = createEvidenceExportEnvelope(bundle, payload);

    assert.deepEqual(Object.keys(envelope), ['schema', 'schemaVersion', 'bundle', 'integrity', 'payload']);
    assert.equal(envelope.schema, EVIDENCE_EXPORT_SCHEMA);
    assert.equal(envelope.schemaVersion, EVIDENCE_EXPORT_SCHEMA_VERSION);
    assert.strictEqual(envelope.bundle, bundle);
    assert.strictEqual(envelope.payload, payload);
    assert.deepEqual(envelope.bundle.contextEvidenceIds, ['context_evidence_123']);
    assert.deepEqual(envelope.bundle.contextSourceIds, ['context_source_123']);
    assert.deepEqual(envelope.bundle.provenanceIndex, provenanceIndex);
    assert.deepEqual(envelope.bundle.lineageEdges, lineageEdges);
    assert.equal(envelope.integrity.manifestHash, manifestHash);
    assert.equal(envelope.integrity.scope, 'payload');
    assert.match(envelope.integrity.assurance, /not a digital signature or a guarantee of immutability/);
  });

  test('serializes deterministically and retains the existing payload manifest hash', async () => {
    const payload = {
      format: 'flylab.mission-evidence-bundle.v3',
      sources: [{ id: 'source_1', title: 'Pinned source' }],
      analysis: { id: 'analysis_1', values: [1.25, 2.5] },
    };
    const manifestHash = await sha256(payload);
    const bundle: EvidenceBundleMetadata = {
      id: 'evidence_hash_round_trip',
      scope: 'mission',
      title: 'Hash round trip',
      manifestHash,
      savedAt: '2026-08-26T12:34:56.000Z',
      includedIds: ['source_1', 'analysis_1'],
      supportingEvidenceIds: ['evidence_1'],
      supportingSourceIds: ['source_1'],
      contextEvidenceIds: ['context_evidence_1'],
      contextSourceIds: ['context_source_1'],
      methodEvidenceIds: ['method_evidence_1'],
      methodSourceIds: ['method_source_1'],
      catalogSourceIds: ['catalog_source_1'],
      provenanceCounts,
      provenanceIndex: {
        measured: ['evidence_1'],
        derived: ['analysis_1'],
        connectome_inferred: ['context_evidence_1'],
        simulation_predicted: [],
        agent_hypothesized: [],
      },
      lineageEdges: [
        { from: 'source_1', relation: 'supports', to: 'evidence_1' },
        { from: 'context_evidence_1', relation: 'contextualizes', to: 'analysis_1' },
      ],
      boundary: 'Simulation evidence bundle; not a new biological experiment.',
      provenance: ['derived'],
      annotation: { ...annotation, title: 'Hash round trip' },
    };
    const envelope = createEvidenceExportEnvelope(bundle, payload);
    const first = serializeEvidenceExport(envelope);
    const second = serializeEvidenceExport(envelope);
    const parsed = JSON.parse(first) as typeof envelope;

    assert.equal(first, second);
    assert.ok(first.endsWith('\n'));
    assert.deepEqual(parsed.payload, payload);
    assert.deepEqual(parsed.bundle.contextEvidenceIds, ['context_evidence_1']);
    assert.deepEqual(parsed.bundle.contextSourceIds, ['context_source_1']);
    assert.deepEqual(parsed.bundle.provenanceIndex, bundle.provenanceIndex);
    assert.deepEqual(parsed.bundle.lineageEdges, bundle.lineageEdges);
    assert.equal(parsed.integrity.manifestHash, manifestHash);
    assert.equal(await sha256(parsed.payload), manifestHash);
  });

  test('creates a portable, filesystem-safe JSON filename', () => {
    assert.equal(
      evidenceExportFilename(' Evidence 123 / MDN trial '),
      'evidence-123-mdn-trial.flylab-evidence.json',
    );
    assert.equal(evidenceExportFilename('***'), 'flylab-evidence.flylab-evidence.json');
  });

  test('publishes a strict deployed v3 schema that validates the retained Run 5 bundle', async () => {
    const schemaPath = join(process.cwd(), 'public/schemas/flylab-evidence-export-v3.schema.json');
    const retainedBundlePath = join(
      process.cwd(),
      'docs/release-evidence/evidence_06b9daf2e1c7d6a6404e4f81841549882f41b884018b04d731be0a27c52c5660.flylab-evidence.json',
    );
    const schemaText = readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaText);
    const retainedBundle = JSON.parse(readFileSync(retainedBundlePath, 'utf8'));
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.$id, EVIDENCE_EXPORT_SCHEMA_URL);
    assert.deepEqual(duplicateJsonObjectKeys(schemaText), []);
    assert.equal(validate(retainedBundle), true, JSON.stringify(validate.errors));
    assert.equal(validate({ ...retainedBundle, schemaVersion: 2 }), false);
    const missingIntegrity = { ...retainedBundle };
    delete missingIntegrity.integrity;
    assert.equal(validate(missingIntegrity), false);

    const experiment = designExperiment({
      hypothesisId: 'hyp_gf_short_mode_escape',
      targetCircuitId: 'circuit_gf_adult',
      behavior: 'short_mode_escape',
      perturbation: 'activate',
      laterality: 'bilateral',
      activationLevel: 0.75,
      onsetMs: 500,
      durationMs: 900,
      trialDurationMs: 3000,
      replicates: 2,
      includeBaseline: true,
      includeShamControl: true,
      seed: 91827,
    });
    const batch = simulateExperiment(experiment);
    const analysis = analyzeBatch(batch, [...ANALYSIS_METRICS]);
    const approval = await createExperimentApproval(experiment, '2026-08-27T12:00:00.000Z');
    const v03WithContentDigest = structuredClone(retainedBundle);
    v03WithContentDigest.payload.approval = approval;
    v03WithContentDigest.payload.batch = {
      ...batch,
      approval,
      boundary: batch.model.boundary,
    };
    v03WithContentDigest.payload.analyses = [analysis];
    v03WithContentDigest.payload.model = batch.model;
    v03WithContentDigest.payload.experiment.model = batch.model;
    assert.equal(validate(v03WithContentDigest), true, JSON.stringify(validate.errors));

    const v03WithoutContentDigest = structuredClone(v03WithContentDigest);
    delete v03WithoutContentDigest.payload.batch.runHashScope;
    delete v03WithoutContentDigest.payload.batch.runHashSerialization;
    delete v03WithoutContentDigest.payload.batch.runContentHash;
    delete v03WithoutContentDigest.payload.batch.runContentHashScope;
    delete v03WithoutContentDigest.payload.batch.runContentHashSerialization;
    assert.equal(validate(v03WithoutContentDigest), false);

    const v03WithEmptyConditionRuns = structuredClone(v03WithContentDigest);
    v03WithEmptyConditionRuns.payload.batch.conditionRuns = [{}, {}, {}];
    assert.equal(validate(v03WithEmptyConditionRuns), false);

    const v03WithoutCompatibilityTrajectory = structuredClone(v03WithContentDigest);
    delete v03WithoutCompatibilityTrajectory.payload.batch.conditionRuns[0].trajectory;
    assert.equal(validate(v03WithoutCompatibilityTrajectory), false);

    const v03WithEmptyProtocol = structuredClone(v03WithContentDigest);
    v03WithEmptyProtocol.payload.batch.protocol = {};
    assert.equal(validate(v03WithEmptyProtocol), false);

    for (const field of ['targetCircuitId', 'behavior', 'motorMap', 'approval', 'boundary']) {
      const withoutRequiredBatchField = structuredClone(v03WithContentDigest);
      delete withoutRequiredBatchField.payload.batch[field];
      assert.equal(validate(withoutRequiredBatchField), false, `v0.3 batch accepted without ${field}`);
    }

    for (const field of ['calibrationStatus', 'calibrationSummary']) {
      const withoutCalibrationField = structuredClone(v03WithContentDigest);
      delete withoutCalibrationField.payload.model[field];
      assert.equal(validate(withoutCalibrationField), false, `v0.3 payload model accepted without ${field}`);
    }

    const v03WithWrongController = structuredClone(v03WithContentDigest);
    v03WithWrongController.payload.model.controller = 'legacy-controller';
    assert.equal(validate(v03WithWrongController), false);

    const v03WithWrongEnvironment = structuredClone(v03WithContentDigest);
    v03WithWrongEnvironment.payload.model.environment = 'legacy-environment';
    assert.equal(validate(v03WithWrongEnvironment), false);

    const v5WithoutAnalysisDigest = structuredClone(v03WithContentDigest);
    for (const analysis of v5WithoutAnalysisDigest.payload.analyses) {
      delete analysis.batchRunContentHash;
    }
    assert.equal(validate(v5WithoutAnalysisDigest), false);
    for (const analysis of v5WithoutAnalysisDigest.payload.analyses) {
      analysis.batchRunContentHash = v5WithoutAnalysisDigest.payload.batch.runContentHash;
    }
    assert.equal(validate(v5WithoutAnalysisDigest), true, JSON.stringify(validate.errors));

    const v5WithEmptyConditions = structuredClone(v03WithContentDigest);
    v5WithEmptyConditions.payload.analyses[0].conditions = [{}];
    assert.equal(validate(v5WithEmptyConditions), false);

    const v5WithEmptyMetricDefinitions = structuredClone(v03WithContentDigest);
    v5WithEmptyMetricDefinitions.payload.analyses[0].metricDefinitions = {};
    assert.equal(validate(v5WithEmptyMetricDefinitions), false);

    const v5WithEmptyInitiationDefinition = structuredClone(v03WithContentDigest);
    v5WithEmptyInitiationDefinition.payload.analyses[0].responseInitiationSummaryDefinition = {};
    assert.equal(validate(v5WithEmptyInitiationDefinition), false);

    const v5WithEmptyObservationDefinition = structuredClone(v03WithContentDigest);
    v5WithEmptyObservationDefinition.payload.analyses[0].responseObservationSummaryDefinition = {};
    assert.equal(validate(v5WithEmptyObservationDefinition), false);
  });
});
