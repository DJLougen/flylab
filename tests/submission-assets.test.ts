import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('FlyLab submission assets', () => {
  it('requires rights-cleared narration instead of recording a macOS System Voice', () => {
    const builder = readFileSync('scripts/build-demo-video.mjs', 'utf8');

    assert.doesNotMatch(builder, /\/usr\/bin\/say|SAY_BIN|FLYLAB_DEMO_VOICE/);
    assert.match(builder, /FLYLAB_NARRATION_RIGHTS_CONFIRMED/);
    assert.match(builder, /externally_supplied_per_segment/);
    assert.match(builder, /ui_approval/);
    assert.doesNotMatch(builder, /rm\(finalOutputReport/);
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

    assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(image.readUInt32BE(16), 1200);
    assert.equal(image.readUInt32BE(20), 630);
    assert.match(notices, /social-preview image/i);
  });

  it('prints the complete narration plan without synthesizing audio', () => {
    const result = spawnSync(process.execPath, ['scripts/build-demo-video.mjs', '--print-plan'], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);

    const plan = JSON.parse(result.stdout) as {
      schema_version: string;
      segment_count: number;
      segments: Array<{ audio_file: string; frame: string }>;
    };

    assert.equal(plan.schema_version, 'flylab.demo-narration-plan.v1');
    assert.equal(plan.segment_count, 15);
    assert.equal(plan.segments[0]?.frame, 'proof-webmcp-tools.png');
    assert.equal(plan.segments[14]?.frame, 'proof-webmcp-invocations.png');
    assert.deepEqual(plan.segments.map((segment) => segment.audio_file),
      Array.from({ length: 15 }, (_, index) => `${String(index).padStart(2, '0')}.wav`));
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

    assert.equal(report.schema_version, 'flylab.demo-preflight.v1');
    assert.equal(report.ready_to_build, false);
    assert.equal(report.ui_approved, false);
    assert.equal(report.narration_rights_confirmed, false);
    assert.equal(report.missing_frames.length, 15);
    assert.equal(report.missing_narration.length, 15);
  });
});
