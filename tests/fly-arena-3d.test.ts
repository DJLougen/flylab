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
    assert.match(pageSource, /import \{ FlyArena3D \} from '@\/components\/FlyArena3D'/);
    assert.doesNotMatch(pageSource, /lazy\(\(\) => import\('@\/components\/FlyArena3D'\)/);
    assert.match(pageSource, /<FlyArena3D/);
    assert.doesNotMatch(pageSource, /className="fly-head"|className="fly-body"/);
  });

  test('keeps optional 3D failures inside the visual audit instead of the lab workspace', () => {
    assert.match(pageSource, /class OptionalViewerBoundary extends Component/);
    assert.match(pageSource, /The research workspace and Site Tools remain active/);
    assert.match(pageSource, /Reload visual module/);
    assert.match(pageSource, /<OptionalViewerBoundary label="3D fly">/);
    assert.match(pageSource, /<OptionalViewerBoundary label="3D brain">/);
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

  test('drives body pose and contact from the exact selected state-trace point', () => {
    for (const field of [
      'current.point?.groundContact',
      'current.point?.legExtension',
      'current.point?.wingDeployment',
      'current.point?.bodyPitchDeg',
      'current.point?.bodyRollDeg',
    ]) {
      assert.ok(componentSource.includes(field), `missing state-driven renderer field: ${field}`);
    }
    assert.match(componentSource, /appendage pose follows the selected seeded simulation trace/);
    assert.match(componentSource, /const gait = motorOutputActive \? legExtension : 0/);
    assert.match(componentSource, /const modeledWingAngle = wingDeployment \* 0\.44/);
    assert.doesNotMatch(componentSource, /animateGait/);
    assert.doesNotMatch(componentSource, /Math\.sin\(now/);
  });

  test('lets the operator select and replay an exact completed run instead of the compatibility illustration', () => {
    assert.match(pageSource, /selectedReplicateId/);
    assert.match(pageSource, /activeReplicate\?\.trajectory \?\? activeCondition\?\.trajectory/);
    assert.match(pageSource, /Replay this run/);
    assert.match(pageSource, /setSelectedReplicateId\(run\.id\)/);
    assert.match(pageSource, /run \$\{activeReplicate\.id\}/);
    assert.match(pageSource, /premotor \{round\(activePoint\.premotorDriveIndex/);
  });

  test('shows all formal seeded threshold and censoring summaries', () => {
    assert.match(pageSource, /RESPONSE_OBSERVATION_SUMMARY_DEFINITION\.fields\.thresholdCrossingProbability\.formula/);
    assert.match(pageSource, /RESPONSE_OBSERVATION_SUMMARY_DEFINITION\.fields\.thresholdCrossedN\.formula/);
    assert.match(pageSource, /RESPONSE_OBSERVATION_SUMMARY_DEFINITION\.fields\.censoredN\.formula/);
    assert.match(pageSource, /distinct from per-run generator probability and biological response rates/);
  });

  test('lights and moves only body parts declared by the selected motor map', () => {
    assert.match(componentSource, /new Map<BodyPartId, THREE\.MeshStandardMaterial>/);
    assert.match(componentSource, /targetedBodyParts\.has\(WING_BODY_PARTS\[index\]\)/);
    assert.match(componentSource, /targetedBodyParts\.has\(LEG_BODY_PARTS\[index\]\)/);
    assert.match(componentSource, /bodyPartMaterials\.forEach/);
    assert.doesNotMatch(componentSource, /appendageMaterial\.emissive/);
  });
});
