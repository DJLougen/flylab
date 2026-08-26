import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('FlyLab submission assets', () => {
  it('requires rights-cleared narration instead of recording a macOS System Voice', () => {
    const builder = readFileSync('scripts/build-demo-video.mjs', 'utf8');

    assert.doesNotMatch(builder, /\/usr\/bin\/say|SAY_BIN|FLYLAB_DEMO_VOICE/);
    assert.match(builder, /FLYLAB_NARRATION_RIGHTS_CONFIRMED/);
    assert.match(builder, /externally_supplied_per_segment/);
  });

  it('ships a standard social-preview image generated from the FlyLab interface', () => {
    const image = readFileSync('public/og.png');
    const notices = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');

    assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(image.readUInt32BE(16), 1200);
    assert.equal(image.readUInt32BE(20), 630);
    assert.match(notices, /social-preview image/i);
  });
});
