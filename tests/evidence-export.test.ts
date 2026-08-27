import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  EVIDENCE_EXPORT_SCHEMA,
  EVIDENCE_EXPORT_SCHEMA_VERSION,
  createEvidenceExportEnvelope,
  evidenceExportFilename,
  serializeEvidenceExport,
  type EvidenceBundleMetadata,
} from '../lib/evidence-export.js';
import { sha256 } from '../lib/flylab.js';

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
});
