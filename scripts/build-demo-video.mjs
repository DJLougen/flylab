import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const framesDirectory = resolve(process.env.FLYLAB_DEMO_FRAMES ?? 'outputs/demo/v7/frames');
const finalOutputDirectory = resolve(process.env.FLYLAB_DEMO_OUTPUT ?? 'outputs/demo/v7');
const ffmpeg = process.env.FFMPEG_BIN ?? '/opt/homebrew/bin/ffmpeg';
const ffprobe = process.env.FFPROBE_BIN ?? '/opt/homebrew/bin/ffprobe';
const say = process.env.SAY_BIN ?? '/usr/bin/say';
const voice = process.env.FLYLAB_DEMO_VOICE ?? 'Samantha';
const speechRate = process.env.FLYLAB_DEMO_RATE ?? '205';
const finalOutputVideo = join(finalOutputDirectory, 'FlyLab-WebMCP-Demo.mp4');
const finalOutputCaptions = join(finalOutputDirectory, 'FlyLab-WebMCP-Demo.srt');
const finalOutputNarration = join(finalOutputDirectory, 'FlyLab-WebMCP-Demo-narration.txt');
const finalOutputThumbnail = join(finalOutputDirectory, 'FlyLab-Devpost-Thumbnail.png');
const finalOutputReport = join(finalOutputDirectory, 'FlyLab-WebMCP-Demo-report.json');
const finalOutputContactSheet = join(finalOutputDirectory, 'FlyLab-WebMCP-Demo-contact-sheet.png');
const finalGalleryDirectory = join(finalOutputDirectory, 'gallery');

const segments = [
  {
    frame: 'proof-webmcp-tools.png',
    narration: 'The browser\'s WebMCP panel sees eight FlyLab site tools: one read-only inspector and seven scientific actions. They are page-registered, not screen-scraping shortcuts.',
  },
  {
    frame: '00-eight-tools-live.png',
    narration: 'The agent inspects the shared revision, artifacts, human gate, blocker, and one valid next action. The person sees the same state.',
  },
  {
    frame: '01-circuit-found.png',
    narration: 'A site tool finds the adult Moonwalker descending-neuron circuit with primary sources, pinned BANC data, and coverage warnings.',
  },
  {
    frame: '02-hypothesis-drafted.png',
    narration: 'It drafts a falsifiable claim labeled agent-hypothesized, so plausible language never silently becomes biological evidence.',
  },
  {
    frame: '03-protocol-locked.png',
    narration: 'The agent designs five controlled arms. Timing, model drive, replicates, seed, controller version, and assumptions stay visible.',
  },
  {
    frame: '04-human-approved.png',
    narration: 'A person reviews and approves the exact protocol; approval is not a tool. The agent then re-inspects before continuing.',
  },
  {
    frame: '05-simulation-replay.png',
    narration: 'After approval, FlyLab produces seeded deterministic trajectories in a reduced-order model, not FlyGym execution, neural dynamics, or wet-lab data.',
  },
  {
    frame: '06-circuit-bilateral-active.png',
    narration: 'The 3D circuit renders six BANC version eight eighty-eight L two skeleton reconstructions: four M D Ns and two L B L forties. Purple marks bilateral model targets; cyan marks four structural paths and one hundred fifty-three putative contacts.',
  },
  {
    frame: '07-circuit-left-active.png',
    narration: 'Left-only selects two metadata-left M D Ns and the connectome-inferred right L B L forty target, totaling one hundred three contacts. The shell is schematic; glow is model selection, not measured activity.',
  },
  {
    frame: '08-behavior-analysis.png',
    narration: 'The agent calculates preregistered behavior metrics. Results carry derived and simulation-predicted labels, separating arithmetic on a model from measurements of flies.',
  },
  {
    frame: '09-bounded-follow-up.png',
    narration: 'FlyLab can rank conditions and propose one bounded follow-up, but that proposal has no execution authority. A new or edited experiment would require another human review.',
  },
  {
    frame: '10-evidence-saved.png',
    narration: 'The agent saves sources, evidence classes, protocol, seeds, runs, model versions, analyses, limitations, and the proposal in one manifest-hashed bundle.',
  },
  {
    frame: '11-evidence-ledger.png',
    narration: 'The ledger keeps measured, derived, connectome-inferred, simulation-predicted, and agent-hypothesized claims distinct. Every result keeps its source and model boundary.',
  },
  {
    frame: '12-protocol-edit-invalidates-results.png',
    narration: 'A person edit advances the revision, clears approval and downstream artifacts, and returns the agent to the human gate with no callable next tool.',
  },
  {
    frame: 'proof-webmcp-invocations.png',
    narration: 'The browser records completed WebMCP calls and structured results. FlyLab makes research agent-operable while keeping execution and scientific interpretation human-auditable.',
  },
];

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

await mkdir(finalOutputDirectory, { recursive: true });
await rm(finalOutputReport, { force: true });

for (const binary of [ffmpeg, ffprobe, say]) {
  if (!existsSync(binary)) throw new Error(`Required demo binary was not found: ${binary}`);
}
for (const segment of segments) {
  const frame = join(framesDirectory, segment.frame);
  if (!existsSync(frame)) throw new Error(`Missing demo frame: ${frame}`);
}

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
let timeline = 0;

try {
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const textPath = join(temporaryDirectory, `${String(index).padStart(2, '0')}.txt`);
    const audioPath = join(temporaryDirectory, `${String(index).padStart(2, '0')}.aiff`);
    const videoPath = join(temporaryDirectory, `${String(index).padStart(2, '0')}.mp4`);
    await writeFile(textPath, `${segment.narration}\n`);
    await run(say, ['-v', voice, '-r', speechRate, '-o', audioPath, '-f', textPath]);
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
    ['03-protocol-locked.png', join(galleryDirectory, '02-human-approval-gate.png')],
    ['06-circuit-bilateral-active.png', join(galleryDirectory, '03-banc-circuit-bilateral.png')],
    ['08-behavior-analysis.png', join(galleryDirectory, '04-behavior-analysis.png')],
    ['11-evidence-ledger.png', join(galleryDirectory, '05-evidence-ledger.png')],
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
