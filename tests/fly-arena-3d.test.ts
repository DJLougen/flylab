import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { join } from 'node:path';

const componentSource = readFileSync(
  join(process.cwd(), 'components/FlyArena3D.tsx'),
  'utf8',
);
const pageSource = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8');

describe('FlyLab Three.js arena fly', () => {
  test('uses a WebGL Three.js renderer instead of the former flat fly markup', () => {
    assert.match(componentSource, /new THREE\.WebGLRenderer/);
    assert.match(componentSource, /shadowMap\.type = THREE\.PCFShadowMap/);
    assert.doesNotMatch(componentSource, /PCFSoftShadowMap/);
    assert.match(componentSource, /data-renderer="three-js"/);
    assert.match(pageSource, /<FlyArena3D/);
    assert.doesNotMatch(pageSource, /className="fly-head"|className="fly-body"/);
  });

  test('keeps the defining adult external features in the procedural model', () => {
    for (const feature of [
      'head',
      'thorax',
      'segmented-abdomen',
      'left-compound-eye',
      'right-compound-eye',
      'paired-wings',
      'paired-branched-aristae',
    ]) {
      assert.ok(componentSource.includes(feature), `missing procedural feature: ${feature}`);
    }
    assert.match(componentSource, /haltere\.name =/);
    assert.match(componentSource, /const legZ = \[0\.38, -0\.05, -0\.48\]/);
    assert.match(componentSource, /for \(const side of \[-1, 1\] as const\)/);
  });

  test('labels the model-drive glow and the external-morphology boundary', () => {
    assert.match(componentSource, /model-drive-selection-halo/);
    assert.match(componentSource, /External morphology is schematic/);
  });

  test('routes the short-mode escape program into middle-leg extension, wing motion, and lift', () => {
    assert.match(componentSource, /motorProgram === 'short_mode_escape'/);
    assert.match(componentSource, /const midleg = index === 1 \|\| index === 4/);
    assert.match(componentSource, /wings\.children\.forEach/);
    assert.match(componentSource, /current\.point\?\.z/);
    assert.match(pageSource, /targetBodyParts=\{lab\.experiment\?\.motorMap\.targetBodyParts\}/);
  });

  test('lights and moves only body parts declared by the selected motor map', () => {
    assert.match(componentSource, /new Map<BodyPartId, THREE\.MeshStandardMaterial>/);
    assert.match(componentSource, /targetedBodyParts\.has\(WING_BODY_PARTS\[index\]\)/);
    assert.match(componentSource, /targetedBodyParts\.has\(LEG_BODY_PARTS\[index\]\)/);
    assert.match(componentSource, /bodyPartMaterials\.forEach/);
    assert.doesNotMatch(componentSource, /appendageMaterial\.emissive/);
  });
});
