import type { ProvenanceLabel } from './flylab.js';

export const EVIDENCE_EXPORT_SCHEMA = 'flylab.evidence-export';
export const EVIDENCE_EXPORT_SCHEMA_VERSION = 3 as const;
export const EVIDENCE_EXPORT_MEDIA_TYPE = 'application/vnd.flylab.evidence+json';
export const EVIDENCE_EXPORT_SCHEMA_URL = 'https://flylab-neuroethology.d-lougen.chatgpt.site/schemas/flylab-evidence-export-v3.schema.json';

export type EvidenceBundleScope = 'experiment' | 'mission';

export interface EvidenceBundleAnnotation {
  id: string;
  title: string;
  note: string;
  author: 'caller_input';
  trust: 'untrusted_annotation';
  purpose: 'administrative_annotation_not_evidence';
  boundary: string;
}

export interface EvidenceBundleMetadata {
  id: string;
  scope: EvidenceBundleScope;
  title: string;
  manifestHash: string;
  savedAt: string;
  includedIds: string[];
  supportingEvidenceIds: string[];
  supportingSourceIds: string[];
  contextEvidenceIds: string[];
  contextSourceIds: string[];
  methodEvidenceIds: string[];
  methodSourceIds: string[];
  catalogSourceIds: string[];
  provenanceCounts: Record<ProvenanceLabel, number>;
  provenanceIndex: Record<ProvenanceLabel, string[]>;
  lineageEdges: Array<{
    from: string;
    relation: string;
    to: string;
  }>;
  boundary: string;
  provenance: ['derived'];
  annotation: EvidenceBundleAnnotation | null;
}

export interface EvidenceExportEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  schema: typeof EVIDENCE_EXPORT_SCHEMA;
  schemaVersion: typeof EVIDENCE_EXPORT_SCHEMA_VERSION;
  bundle: EvidenceBundleMetadata;
  integrity: {
    manifestHash: string;
    scope: 'payload';
    serialization: 'JSON.stringify(payload)';
    assurance: 'Checksum for detecting payload changes; not a digital signature or a guarantee of immutability.';
  };
  payload: TPayload;
}

export function createEvidenceExportEnvelope<TPayload extends Record<string, unknown>>(
  bundle: EvidenceBundleMetadata,
  payload: TPayload,
): EvidenceExportEnvelope<TPayload> {
  return {
    schema: EVIDENCE_EXPORT_SCHEMA,
    schemaVersion: EVIDENCE_EXPORT_SCHEMA_VERSION,
    bundle,
    integrity: {
      manifestHash: bundle.manifestHash,
      scope: 'payload',
      serialization: 'JSON.stringify(payload)',
      assurance: 'Checksum for detecting payload changes; not a digital signature or a guarantee of immutability.',
    },
    payload,
  };
}

export function serializeEvidenceExport(envelope: EvidenceExportEnvelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function evidenceExportFilename(bundleId: string): string {
  const safeId = bundleId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return `${safeId || 'flylab-evidence'}.flylab-evidence.json`;
}
