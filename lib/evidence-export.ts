import type { ProvenanceLabel } from './flylab.js';

export const EVIDENCE_EXPORT_SCHEMA = 'flylab.evidence-export';
export const EVIDENCE_EXPORT_SCHEMA_VERSION = 1 as const;
export const EVIDENCE_EXPORT_MEDIA_TYPE = 'application/vnd.flylab.evidence+json';

export interface EvidenceBundleMetadata {
  id: string;
  title: string;
  manifestHash: string;
  savedAt: string;
  includedIds: string[];
  provenanceCounts: Record<ProvenanceLabel, number>;
  boundary: string;
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
