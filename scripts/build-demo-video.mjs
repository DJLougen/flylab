import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const framesDirectory = resolve(process.env.FLYLAB_DEMO_FRAMES ?? 'outputs/demo/candidate/frames');
const finalOutputDirectory = resolve(process.env.FLYLAB_DEMO_OUTPUT ?? 'outputs/demo/candidate');
const narrationDirectory = resolve(process.env.FLYLAB_NARRATION_DIR ?? 'outputs/demo/candidate/narration');
const ffmpeg = process.env.FFMPEG_BIN ?? '/opt/homebrew/bin/ffmpeg';
const ffprobe = process.env.FFPROBE_BIN ?? '/opt/homebrew/bin/ffprobe';
const uiApproved = process.env.FLYLAB_UI_APPROVED === '1';
const narrationRightsConfirmed = process.env.FLYLAB_NARRATION_RIGHTS_CONFIRMED === '1';
const finalOutputVideo = join(finalOutputDirectory, 'FlyLab-WebMCP-Demo.mp4');
const finalOutputCaptions = join(finalOutputDirectory, 'FlyLab-WebMCP-Demo.srt');
const finalOutputNarration = join(finalOutputDirectory, 'FlyLab-WebMCP-Demo-narration.txt');
const finalOutputThumbnail = join(finalOutputDirectory, 'FlyLab-Devpost-Thumbnail.png');
const finalOutputReport = join(finalOutputDirectory, 'FlyLab-WebMCP-Demo-report.json');
const finalOutputContactSheet = join(finalOutputDirectory, 'FlyLab-WebMCP-Demo-contact-sheet.png');
const finalGalleryDirectory = join(finalOutputDirectory, 'gallery');

const demoMetadata = {
  schema_version: 'flylab.demo-release.v03',
  release: 'model-0.3.0-candidate',
  workflow: 'native-webmcp-client-gf-rapid-escape',
  hero_goal: 'Investigate how the adult fruit-fly brain coordinates leg and wing output during rapid escape. Separate measured findings from connectome inference and simulation assumptions, draft a falsifiable hypothesis, and design a controlled experiment. Stop for my approval, then continue, analyze every metric, compare conditions, and save the complete evidence bundle.',
  webmcp: {
    transport: 'document.modelContext.registerTool',
    registered_tools: 8,
    native_invocation_proof_required: true,
    proof_capture_kind: 'automated_flag_enabled_chrome_protocol_capture',
    ordinary_chrome_support: 'unsupported_without_testing_capability',
  },
  discovery: {
    selected_circuit_id: 'circuit_gf_adult',
    rejected_alternative_circuit_id: 'circuit_mdn_adult',
    decision_artifact_required: true,
  },
  protocol: {
    experiment_arms: 3,
    condition_ids: ['condition_baseline', 'condition_sham', 'condition_bilateral'],
    replicates_per_arm: 12,
    total_seeded_runs: 36,
    approval: 'visible operator approval control binding the exact protocol hash and seed-manifest hash; approval is not a WebMCP tool',
  },
  visualization: {
    subject: 'literature-schematic giant-fiber leg-and-wing branches',
    behavior_replay: 'selected seeded state trajectory',
    invented_connectome_ids: false,
    boundary: 'The 3D view is a literature-backed schematic and model-selection display, not a specimen reconstruction, connectome import, or measured neural activity.',
  },
  analysis: {
    metric_method_version: 'flylab.behavior-metrics.v5',
    exact_per_run_records_required: true,
    biological_measurement: false,
  },
  export: {
    format: 'flylab.mission-evidence-bundle.v3',
    source_closed: true,
    schema_url: 'https://flylab-neuroethology.d-lougen.chatgpt.site/schemas/flylab-evidence-export-v3.schema.json',
    content_integrity: 'SHA-256 over protocol, model, and complete condition runs',
  },
};

const segments = [
  {
    frame: 'proof-webmcp-tools.png',
    narration: 'This flag-enabled automated Chrome protocol capture confirms eight native FlyLab WebMCP tools: one read-only inspector and seven page-registered scientific actions.',
  },
  {
    frame: '00-eight-tools-live.png',
    narration: 'The WebMCP client reads the rapid-escape goal, page session, revision, artifact IDs, blocker, and one valid next action, matching the visible page.',
  },
  {
    frame: '01-circuit-found.png',
    narration: 'Goal-aware discovery selects the adult giant-fiber pathway for leg-and-wing escape, preserves MDN as a rejected alternative, and records reasons and gaps.',
  },
  {
    frame: '02-hypothesis-drafted.png',
    narration: 'It drafts a falsifiable giant-fiber hypothesis with primary outcome, expected direction, controls, evidence limits, and explicit failure criterion.',
  },
  {
    frame: '03-protocol-locked.png',
    narration: 'It designs exactly three arms—baseline, model sham, and bilateral perturbation—and twelve replicates each, yielding thirty-six deterministic virtual trials in a complete seed manifest.',
  },
  {
    frame: '04-operator-approved.png',
    narration: 'Approval is not a WebMCP tool. The capture activates the visible operator control, committing the protocol hash and seed-manifest hash; a judged run requires operator review and click.',
  },
  {
    frame: 'proof-approval-hash-guard.png',
    narration: 'A deliberately wrong protocol hash returns EVIDENCE MISMATCH. Revision and batch remain unchanged, proving exact approval binding.',
  },
  {
    frame: '05-simulation-replay.png',
    narration: 'The client echoes the approved hash and runs all thirty-six trials. Every run has a deterministic seed and trajectory ID; Three.js replays the selected seeded state trajectory.',
  },
  {
    frame: '06-circuit-bilateral-active.png',
    narration: 'The 3D literature schematic traces giant-fiber descent into established jump-leg and wing branches. It invents no connectome neuron IDs or specimen reconstruction.',
  },
  {
    frame: '07-behavior-analysis.png',
    narration: 'FlyLab returns formal versioned metric definitions and exact per-run records behind each aggregate. Highlighting is model selection; values are simulation predictions, not measurements.',
  },
  {
    frame: '08-bounded-follow-up.png',
    narration: 'The client compares every condition and proposes one bounded follow-up without authority to execute it. A new experiment needs new visible approval.',
  },
  {
    frame: '09-evidence-saved.png',
    narration: 'The save tool creates a source-closed mission version-three bundle with the complete lineage, published export schema, and SHA-256 content integrity over protocol, model, and all condition runs.',
  },
  {
    frame: 'proof-idempotent-retry.png',
    narration: 'Repeating run and save with original operation IDs returns idempotent replay, creates zero artifacts, and preserves revision. Conflicting reuse fails closed.',
  },
  {
    frame: '10-protocol-edit-invalidates-results.png',
    narration: 'Editing the protocol advances revision, revokes both approval hashes, clears downstream artifacts, and restores fail-closed review. Old operation IDs cannot revive cleared lineage.',
  },
  {
    frame: 'proof-webmcp-invocations.png',
    narration: 'Finally, the flag-enabled automated Chrome protocol capture confirms native invocation and structured results. It is runtime evidence, not a DevTools screenshot; ordinary Chrome without test capability remains unsupported.',
  },
];

function narrationAudioPath(index) {
  return join(narrationDirectory, `${String(index).padStart(2, '0')}.wav`);
}

const narrationPlan = segments.map((segment, index) => ({
  segment: index + 1,
  audio_file: basename(narrationAudioPath(index)),
  frame: segment.frame,
  narration: segment.narration,
  word_count: segment.narration.trim().split(/\s+/).length,
}));

if (process.argv.includes('--print-plan')) {
  console.log(JSON.stringify({
    schema_version: 'flylab.demo-narration-plan.v2',
    demo: demoMetadata,
    segment_count: narrationPlan.length,
    segments: narrationPlan,
  }, null, 2));
  process.exit(0);
}

if (process.argv.includes('--check')) {
  const missingFrames = segments
    .map((segment) => segment.frame)
    .filter((frame) => !existsSync(join(framesDirectory, frame)));
  const missingNarration = narrationPlan
    .map((segment) => segment.audio_file)
    .filter((file) => !existsSync(join(narrationDirectory, file)));
  const readyToBuild = uiApproved
    && narrationRightsConfirmed
    && missingFrames.length === 0
    && missingNarration.length === 0;

  console.log(JSON.stringify({
    schema_version: 'flylab.demo-preflight.v2',
    demo: demoMetadata,
    ready_to_build: readyToBuild,
    ui_approved: uiApproved,
    narration_rights_confirmed: narrationRightsConfirmed,
    required_frame_count: segments.length,
    missing_frames: missingFrames,
    required_narration_count: narrationPlan.length,
    missing_narration: missingNarration,
  }, null, 2));
  process.exit(readyToBuild ? 0 : 2);
}

function run(command, args, { capture = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolvePromise({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(`${basename(command)} exited ${code}: ${stderr.slice(-3000)}`));
    });
  });
}

function timestamp(seconds) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const remainingSeconds = Math.floor((milliseconds % 60_000) / 1000);
  const remainingMilliseconds = milliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')},${String(remainingMilliseconds).padStart(3, '0')}`;
}

if (!uiApproved) {
  throw new Error('Set FLYLAB_UI_APPROVED=1 only after the interface owner explicitly approves the final UI. The video builder fails closed before reading or generating media.');
}
if (!narrationRightsConfirmed) {
  throw new Error('Set FLYLAB_NARRATION_RIGHTS_CONFIRMED=1 only after supplying narration you own or are explicitly licensed to publish. The builder never records macOS System Voices.');
}
for (const binary of [ffmpeg, ffprobe]) {
  if (!existsSync(binary)) throw new Error(`Required demo binary was not found: ${binary}`);
}
for (let index = 0; index < segments.length; index += 1) {
  const segment = segments[index];
  const frame = join(framesDirectory, segment.frame);
  if (!existsSync(frame)) throw new Error(`Missing demo frame: ${frame}`);
  const audio = narrationAudioPath(index);
  if (!existsSync(audio)) throw new Error(`Missing rights-cleared narration clip: ${audio}`);
}

await mkdir(finalOutputDirectory, { recursive: true });

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'flylab-demo-'));
const outputDirectory = join(temporaryDirectory, 'delivery');
const outputVideo = join(outputDirectory, 'FlyLab-WebMCP-Demo.mp4');
const outputCaptions = join(outputDirectory, 'FlyLab-WebMCP-Demo.srt');
const outputNarration = join(outputDirectory, 'FlyLab-WebMCP-Demo-narration.txt');
const outputThumbnail = join(outputDirectory, 'FlyLab-Devpost-Thumbnail.png');
const outputContactSheet = join(outputDirectory, 'FlyLab-WebMCP-Demo-contact-sheet.png');
const galleryDirectory = join(outputDirectory, 'gallery');
await mkdir(galleryDirectory, { recursive: true });
const renderedSegments = [];
const captionEntries = [];
const narrationInputHashes = [];
let timeline = 0;

try {
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const audioPath = narrationAudioPath(index);
    const videoPath = join(temporaryDirectory, `${String(index).padStart(2, '0')}.mp4`);
    narrationInputHashes.push({
      segment: index + 1,
      file: basename(audioPath),
      sha256: createHash('sha256').update(await readFile(audioPath)).digest('hex'),
    });
    const probe = await run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath], { capture: true });
    const speechDuration = Number(probe.stdout);
    if (!Number.isFinite(speechDuration)) throw new Error(`Could not measure narration segment ${index}.`);
    const duration = speechDuration + 0.85;
    const frameCount = Math.ceil(duration * 30);
    const fadeIn = index === 0 ? ',fade=t=in:st=0:d=0.45' : '';
    const fadeOut = index === segments.length - 1 ? `,fade=t=out:st=${Math.max(0, duration - 0.55).toFixed(3)}:d=0.55` : '';
    const videoFilter = `scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.000055,1.022)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1440x900:fps=30${fadeIn}${fadeOut},format=yuv420p`;
    const audioFilter = `apad=whole_dur=${duration.toFixed(3)},atrim=0:${duration.toFixed(3)}`;
    await run(ffmpeg, [
      '-y',
      '-loop', '1',
      '-framerate', '30',
      '-i', join(framesDirectory, segment.frame),
      '-i', audioPath,
      '-filter_complex', `[0:v]${videoFilter}[v];[1:a]${audioFilter}[a]`,
      '-map', '[v]',
      '-map', '[a]',
      '-frames:v', String(frameCount),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '19',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-ac', '2',
      '-movflags', '+faststart',
      videoPath,
    ]);
    renderedSegments.push(videoPath);
    captionEntries.push(`${index + 1}\n${timestamp(timeline)} --> ${timestamp(timeline + duration)}\n${segment.narration}\n`);
    timeline += duration;
  }

  const concatList = join(temporaryDirectory, 'segments.txt');
  const combinedVideo = join(temporaryDirectory, 'combined.mp4');
  await writeFile(concatList, renderedSegments.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join('\n'));
  await run(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', combinedVideo]);
  await writeFile(outputCaptions, `${captionEntries.join('\n')}\n`);
  await writeFile(outputNarration, `${segments.map((segment) => segment.narration).join('\n\n')}\n`);
  await run(ffmpeg, [
    '-y',
    '-i', combinedVideo,
    '-i', outputCaptions,
    '-map', '0:v:0',
    '-map', '0:a:0',
    '-map', '1:0',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-af', 'loudnorm=I=-16:LRA=11:TP=-1.5',
    '-ar', '48000',
    '-ac', '2',
    '-c:s', 'mov_text',
    '-metadata:s:s:0', 'language=eng',
    '-metadata', 'title=FlyLab WebMCP Challenge Demo',
    '-movflags', '+faststart',
    outputVideo,
  ]);

  const media = [
    ['06-circuit-bilateral-active.png', outputThumbnail],
    ['proof-webmcp-tools.png', join(galleryDirectory, '01-eight-webmcp-tools.png')],
    ['03-protocol-locked.png', join(galleryDirectory, '02-operator-approval-gate.png')],
    ['06-circuit-bilateral-active.png', join(galleryDirectory, '03-gf-literature-schematic.png')],
    ['07-behavior-analysis.png', join(galleryDirectory, '04-behavior-analysis.png')],
    ['09-evidence-saved.png', join(galleryDirectory, '05-evidence-ledger.png')],
  ];
  for (const [frame, output] of media) {
    const imageFilter = output === outputThumbnail
      ? 'crop=1440:810:0:45,scale=1280:720:flags=lanczos'
      : 'scale=1200:800:force_original_aspect_ratio=decrease:flags=lanczos,pad=1200:800:(ow-iw)/2:(oh-ih)/2';
    await run(ffmpeg, [
      '-y',
      '-i', join(framesDirectory, frame),
      '-vf', imageFilter,
      '-frames:v', '1',
      '-update', '1',
      output,
    ]);
  }

  const contactFramesDirectory = join(temporaryDirectory, 'contact-frames');
  await mkdir(contactFramesDirectory, { recursive: true });
  for (let index = 0; index < segments.length; index += 1) {
    await copyFile(
      join(framesDirectory, segments[index].frame),
      join(contactFramesDirectory, `${String(index).padStart(2, '0')}.png`),
    );
  }
  await run(ffmpeg, [
    '-y',
    '-framerate', '1',
    '-start_number', '0',
    '-i', join(contactFramesDirectory, '%02d.png'),
    '-vf', 'scale=480:300:force_original_aspect_ratio=decrease,pad=480:300:(ow-iw)/2:(oh-ih)/2,tile=3x5:padding=8:margin=8',
    '-frames:v', '1',
    '-update', '1',
    outputContactSheet,
  ]);

  const finalProbe = await run(ffprobe, [
    '-v', 'error',
    '-show_entries', 'format=duration,size:stream=index,codec_type,codec_name,width,height,sample_rate,channels',
    '-of', 'json',
    outputVideo,
  ], { capture: true });
  const report = JSON.parse(finalProbe.stdout);
  const finalDuration = Number(report.format?.duration);
  if (!(finalDuration > 0 && finalDuration < 180)) {
    throw new Error(`Final demo duration must be under three minutes; got ${finalDuration}.`);
  }
  const videoStream = report.streams?.find((stream) => stream.codec_type === 'video');
  const audioStream = report.streams?.find((stream) => stream.codec_type === 'audio');
  const captionStream = report.streams?.find((stream) => stream.codec_type === 'subtitle');
  if (videoStream?.codec_name !== 'h264' || videoStream.width !== 1440 || videoStream.height !== 900) {
    throw new Error(`Unexpected video stream: ${JSON.stringify(videoStream)}`);
  }
  if (audioStream?.codec_name !== 'aac' || audioStream.sample_rate !== '48000' || audioStream.channels !== 2) {
    throw new Error(`Unexpected audio stream: ${JSON.stringify(audioStream)}`);
  }
  if (captionStream?.codec_name !== 'mov_text') {
    throw new Error(`Unexpected caption stream: ${JSON.stringify(captionStream)}`);
  }
  const loudnessProbe = await run(ffmpeg, [
    '-hide_banner',
    '-i', outputVideo,
    '-filter_complex', 'ebur128=peak=true',
    '-f', 'null',
    '-',
  ], { capture: true });
  const loudnessMatches = [...loudnessProbe.stderr.matchAll(/I:\s+(-?\d+(?:\.\d+)?) LUFS/g)];
  const integratedLoudnessLufs = Number(loudnessMatches.at(-1)?.[1]);
  if (!Number.isFinite(integratedLoudnessLufs)
    || integratedLoudnessLufs < -17.5
    || integratedLoudnessLufs > -14.5) {
    throw new Error(`Unexpected integrated loudness: ${integratedLoudnessLufs} LUFS`);
  }
  const videoSha256 = createHash('sha256').update(await readFile(outputVideo)).digest('hex');
  const stagedGallery = media.slice(1).map(([, output]) => output);
  const finalGallery = stagedGallery.map((output) => join(finalGalleryDirectory, basename(output)));
  const artifactHashes = {};
  for (const [label, path] of [
    ['video', outputVideo],
    ['captions', outputCaptions],
    ['narration', outputNarration],
    ['thumbnail', outputThumbnail],
    ['contact_sheet', outputContactSheet],
    ...stagedGallery.map((path, index) => [`gallery_${index + 1}`, path]),
  ]) {
    artifactHashes[label] = createHash('sha256').update(await readFile(path)).digest('hex');
  }
  const deliveryReport = {
    ok: true,
    demo: demoMetadata,
    video: finalOutputVideo,
    captions: finalOutputCaptions,
    narration: finalOutputNarration,
    thumbnail: finalOutputThumbnail,
    contact_sheet: finalOutputContactSheet,
    gallery: finalGallery,
    report: finalOutputReport,
    duration_seconds: finalDuration,
    size_bytes: Number(report.format?.size),
    sha256: videoSha256,
    artifact_sha256: artifactHashes,
    ui_approval: {
      confirmed_by_builder_invocation: true,
    },
    narration_input: {
      mode: 'externally_supplied_per_segment',
      rights_confirmed_by_builder_invocation: true,
      files: narrationInputHashes,
    },
    integrated_loudness_lufs: integratedLoudnessLufs,
    streams: report.streams,
  };
  await mkdir(finalGalleryDirectory, { recursive: true });
  for (const [staged, final] of [
    [outputVideo, finalOutputVideo],
    [outputCaptions, finalOutputCaptions],
    [outputNarration, finalOutputNarration],
    [outputThumbnail, finalOutputThumbnail],
    [outputContactSheet, finalOutputContactSheet],
    ...stagedGallery.map((path, index) => [path, finalGallery[index]]),
  ]) {
    await rename(staged, final);
  }
  await writeFile(finalOutputReport, `${JSON.stringify(deliveryReport, null, 2)}\n`);
  console.log(JSON.stringify(deliveryReport, null, 2));
} finally {
  if (basename(temporaryDirectory).startsWith('flylab-demo-')) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
