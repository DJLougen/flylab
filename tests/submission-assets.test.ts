import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('FlyLab submission assets', () => {
  it('keeps mistyped handoff routes recoverable', () => {
    const config = readFileSync('next.config.ts', 'utf8');
    const fallbackRoute = readFileSync('app/[...path]/page.tsx', 'utf8');

    assert.match(config, /source:\s*['"]\/Use['"]/);
    assert.match(config, /source:\s*['"]\/use['"]/);
    assert.equal((config.match(/destination:\s*['"]\/['"]/g) ?? []).length, 2);
    assert.match(fallbackRoute, /path\[0\]\?\.toLowerCase\(\) === ['"]use['"]/);
    assert.match(fallbackRoute, /redirect\(['"]\/['"]\)/);
    assert.match(fallbackRoute, /notFound\(\)/);
  });

  it('provides browser-readable agent recovery without pretending to polyfill WebMCP', () => {
    const page = readFileSync('app/page.tsx', 'utf8');
    const guide = readFileSync('app/agent/page.tsx', 'utf8');

    assert.match(page, /id="agent-diagnostics"/);
    assert.match(page, /id="agent-recovery-packet"/);
    assert.match(page, /JSON\.stringify\(agentHandoff\.agent_context\)/);
    assert.match(page, /Retry Site Tool detection/);
    assert.match(page, /does not exercise Site Tool discovery, registration, or agent invocation/);
    assert.match(guide, /Browser-readable recovery surface/);
    assert.match(guide, /does not create a fallback transport or make Site Tools callable/);
    assert.match(guide, /Exact tool contracts/);
  });

  it('warns before navigation can discard a mutated page session', () => {
    const page = readFileSync('app/page.tsx', 'utf8');

    assert.match(page, /addEventListener\(['"]beforeunload['"], protectPageScopedWork\)/);
    assert.match(page, /removeEventListener\(['"]beforeunload['"], protectPageScopedWork\)/);
    assert.match(page, /page-scoped; export before leaving/);
  });

  it('keeps the complete shared activity history inspectable', () => {
    const page = readFileSync('app/page.tsx', 'utf8');

    assert.match(page, /lab\.activity\.map\(\(item\)/);
    assert.doesNotMatch(page, /lab\.activity\.slice\(0,\s*3\)/);
  });

  it('binds retained runtime evidence to a Git commit, tree, and clean-worktree observation', () => {
    const verifier = readFileSync('scripts/verify-live-webmcp.mjs', 'utf8');

    assert.match(verifier, /flylab\.source-revision\.v1/);
    assert.match(verifier, /git_commit: gitCommit/);
    assert.match(verifier, /git_tree: gitTree/);
    assert.match(verifier, /worktree_clean: porcelain === ['"]['"]/);
    assert.match(verifier, /waitForRegisteredToolInventory/);
    assert.match(verifier, /Page\.reload/);
    assert.match(verifier, /Browser\.setDownloadBehavior/);
    assert.match(verifier, /clipboard_matches_manual_fallback/);
    assert.match(verifier, /capture_artifacts/);
  });

  it('serves the generated tool contracts with immediate revalidation', () => {
    const route = readFileSync('app/flylab-tool-contracts.json/route.ts', 'utf8');

    assert.match(route, /['"]Cache-Control['"]:\s*['"]no-cache['"]/);
    assert.doesNotMatch(route, /max-age=300/);
  });

  it('requires rights-cleared narration instead of recording a macOS System Voice', () => {
    const builder = readFileSync('scripts/build-demo-video.mjs', 'utf8');
    const attestation = readFileSync('docs/NARRATION_RIGHTS_ATTESTATION.md', 'utf8');

    assert.doesNotMatch(builder, /\/usr\/bin\/say|SAY_BIN|FLYLAB_DEMO_VOICE/);
    assert.match(builder, /FLYLAB_NARRATION_RIGHTS_CONFIRMED/);
    assert.match(builder, /externally_supplied_per_segment/);
    assert.match(builder, /ui_approval/);
    assert.match(builder, /outputs\/demo\/v24/);
    assert.doesNotMatch(builder, /rm\(finalOutputReport/);
    assert.match(attestation, /not a completed attestation/i);
    assert.match(attestation, /00\.wav/);
    assert.match(attestation, /14\.wav/);
    assert.match(attestation, /\[complete before release\]/i);
    assert.doesNotMatch(attestation, /commercial-publication permission verified:\s*\*\*yes\*\*/i);
  });

  it('fails the direct video build closed until the interface is explicitly approved', () => {
    const result = spawnSync(process.execPath, ['scripts/build-demo-video.mjs'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        FLYLAB_UI_APPROVED: '0',
        FLYLAB_NARRATION_RIGHTS_CONFIRMED: '1',
        FLYLAB_DEMO_FRAMES: '/definitely-missing-flylab-frames',
        FLYLAB_NARRATION_DIR: '/definitely-missing-flylab-narration',
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /interface owner explicitly approves the final UI/i);
  });

  it('ships a standard social-preview image generated from the FlyLab interface', () => {
    const image = readFileSync('public/og.png');
    const notices = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
    const dimensions = new DataView(image.buffer, image.byteOffset, image.byteLength);

    assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(dimensions.getUint32(16), 1200);
    assert.equal(dimensions.getUint32(20), 630);
    assert.match(notices, /social-preview image/i);
  });

  it('prints the complete narration plan without synthesizing audio', () => {
    const result = spawnSync(process.execPath, ['scripts/build-demo-video.mjs', '--print-plan'], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);

    const plan = JSON.parse(result.stdout) as {
      schema_version: string;
      demo: {
        schema_version: string;
        workflow: string;
        webmcp: {
          registered_tools: number;
          native_invocation_proof_required: boolean;
          proof_capture_kind: string;
          ordinary_chrome_support: string;
        };
        discovery: { selected_circuit_id: string; rejected_alternative_circuit_id: string };
        protocol: { experiment_arms: number; replicates_per_arm: number; total_seeded_runs: number };
        visualization: { invented_connectome_ids: boolean };
        analysis: { metric_method_version: string; exact_per_run_records_required: boolean; biological_measurement: boolean };
        export: { format: string; source_closed: boolean };
      };
      segment_count: number;
      segments: Array<{ audio_file: string; frame: string; narration: string; word_count: number }>;
    };

    assert.equal(plan.schema_version, 'flylab.demo-narration-plan.v2');
    assert.equal(plan.demo.schema_version, 'flylab.demo-release.v24');
    assert.equal(plan.demo.workflow, 'native-webmcp-client-gf-rapid-escape');
    assert.equal(plan.demo.webmcp.registered_tools, 8);
    assert.equal(plan.demo.webmcp.native_invocation_proof_required, true);
    assert.equal(plan.demo.webmcp.proof_capture_kind, 'automated_flag_enabled_chrome_protocol_capture');
    assert.equal(plan.demo.webmcp.ordinary_chrome_support, 'unsupported_without_testing_capability');
    assert.equal(plan.demo.discovery.selected_circuit_id, 'circuit_gf_adult');
    assert.equal(plan.demo.discovery.rejected_alternative_circuit_id, 'circuit_mdn_adult');
    assert.equal(plan.demo.protocol.experiment_arms, 3);
    assert.equal(plan.demo.protocol.replicates_per_arm, 12);
    assert.equal(plan.demo.protocol.total_seeded_runs, 36);
    assert.equal(plan.demo.visualization.invented_connectome_ids, false);
    assert.equal(plan.demo.analysis.metric_method_version, 'flylab.behavior-metrics.v4');
    assert.equal(plan.demo.analysis.exact_per_run_records_required, true);
    assert.equal(plan.demo.analysis.biological_measurement, false);
    assert.equal(plan.demo.export.format, 'flylab.mission-evidence-bundle.v3');
    assert.equal(plan.demo.export.source_closed, true);
    assert.equal(plan.segment_count, 15);
    assert.equal(plan.segments[0]?.frame, 'proof-webmcp-tools.png');
    assert.equal(plan.segments[6]?.frame, 'proof-approval-hash-guard.png');
    assert.equal(plan.segments[8]?.frame, '06-circuit-bilateral-active.png');
    assert.equal(plan.segments[12]?.frame, 'proof-idempotent-retry.png');
    assert.equal(plan.segments[14]?.frame, 'proof-webmcp-invocations.png');
    assert.deepEqual(plan.segments.map((segment) => segment.audio_file),
      Array.from({ length: 15 }, (_, index) => `${String(index).padStart(2, '0')}.wav`));
    const narration = plan.segments.map((segment) => segment.narration).join(' ');
    const wordCount = plan.segments.reduce((total, segment) => total + segment.word_count, 0);
    assert.ok(wordCount >= 320 && wordCount <= 350, `expected 320-350 narration words, received ${wordCount}`);
    assert.match(narration, /eight native FlyLab WebMCP tools/i);
    assert.match(narration, /giant-fiber pathway/i);
    assert.match(narration, /MDN as a rejected alternative/i);
    assert.match(narration, /exactly three arms/i);
    assert.match(narration, /thirty-six deterministic virtual trials/i);
    assert.match(narration, /protocol hash and seed-manifest hash/i);
    assert.match(narration, /invents no connectome neuron IDs/i);
    assert.match(narration, /formal versioned metric definitions/i);
    assert.match(narration, /source-closed mission version-three bundle/i);
    assert.match(narration, /deliberately wrong protocol hash returns EVIDENCE MISMATCH/i);
    assert.match(narration, /idempotent replay, creates zero artifacts/i);
    assert.match(narration, /revokes both approval hashes/i);
    assert.match(narration, /flag-enabled automated Chrome protocol capture/i);
    assert.match(narration, /not a DevTools screenshot/i);
    assert.match(narration, /ordinary Chrome .* remains unsupported/i);
    assert.doesNotMatch(narration, /\bthe agent\b|\ba supervisor\b/i);
    assert.doesNotMatch(narration, /five controlled arms|six BANC|one hundred fifty-three predicted synaptic links/i);
  });

  it('reports every unmet release gate without creating a demo', () => {
    const result = spawnSync(process.execPath, ['scripts/build-demo-video.mjs', '--check'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        FLYLAB_DEMO_FRAMES: '/definitely-missing-flylab-frames',
        FLYLAB_NARRATION_DIR: '/definitely-missing-flylab-narration',
      },
    });
    assert.equal(result.status, 2, result.stderr);

    const report = JSON.parse(result.stdout) as {
      schema_version: string;
      ready_to_build: boolean;
      ui_approved: boolean;
      narration_rights_confirmed: boolean;
      missing_frames: string[];
      missing_narration: string[];
    };

    assert.equal(report.schema_version, 'flylab.demo-preflight.v2');
    assert.equal(report.ready_to_build, false);
    assert.equal(report.ui_approved, false);
    assert.equal(report.narration_rights_confirmed, false);
    assert.equal(report.missing_frames.length, 15);
    assert.equal(report.missing_narration.length, 15);
  });
});
