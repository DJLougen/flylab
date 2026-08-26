import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const framesDirectory = resolve(process.env.FLYLAB_DEMO_FRAMES ?? 'outputs/demo/v7/frames');
const outputDirectory = resolve(process.env.FLYLAB_DEMO_OUTPUT ?? 'outputs/demo/v7');
const ffmpeg = process.env.FFMPEG_BIN ?? '/opt/homebrew/bin/ffmpeg';
const ffprobe = process.env.FFPROBE_BIN ?? '/opt/homebrew/bin/ffprobe';
const say = process.env.SAY_BIN ?? '/usr/bin/say';
const voice = process.env.FLYLAB_DEMO_VOICE ?? 'Samantha';
const speechRate = process.env.FLYLAB_DEMO_RATE ?? '205';
const outputVideo = join(outputDirectory, 'FlyLab-WebMCP-Demo.mp4');
const outputCaptions = join(outputDirectory, 'FlyLab-WebMCP-Demo.srt');
const outputNarration = join(outputDirectory, 'FlyLab-WebMCP-Demo-narration.txt');
const outputThumbnail = join(outputDirectory, 'FlyLab-Devpost-Thumbnail.png');
const galleryDirectory = join(outputDirectory, 'gallery');

const segments = [
  {
    frame: '00-eight-tools-live.png',
    narration: 'FlyLab is agent-operable, human-auditable, and scientifically bounded. One read-only state inspector and seven workflow actions share the same visible fruit-fly laboratory with a person.',
  },
  {
    frame: '01-circuit-found.png',
    narration: 'Using a browser-native site tool, not screen scraping, the agent finds the adult Moonwalker descending-neuron circuit with primary sources, pinned BANC version data, and coverage warnings.',
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
    narration: 'Execution remains blocked until a person reviews the exact protocol and uses the visible approval control. Approval is deliberately not available as an agent tool.',
  },
  {
    frame: '05-simulation-replay.png',
    narration: 'After approval, FlyLab produces seeded deterministic trajectories in a reduced-order model, not FlyGym execution, neural dynamics, or wet-lab data.',
  },
  {
    frame: '06-circuit-bilateral-active.png',
    narration: 'The circuit view renders six actual BANC version eight eighty-eight L two skeleton reconstructions: four M D N cells and two L B L forty cells. Purple marks the bilateral model targets. Cyan marks the bundled structural L B L forty paths: four edges and one hundred fifty-three putative contacts.',
  },
  {
    frame: '07-circuit-left-active.png',
    narration: 'Switching to left-only illuminates only the two metadata-left M D N cells and their connectome-inferred right L B L forty target, totaling one hundred three contacts. The translucent central nervous system shell is schematic, and glow is model selection, not measured neural activity.',
  },
  {
    frame: '08-behavior-analysis.png',
    narration: 'The agent calculates the preregistered behavior metrics from the completed batch. Results carry both derived and simulation-predicted labels, preserving the difference between arithmetic on a model and measurements from flies.',
  },
  {
    frame: '09-bounded-follow-up.png',
    narration: 'FlyLab can rank conditions and propose one bounded follow-up, but that proposal has no execution authority. A new or edited experiment would require another human review.',
  },
  {
    frame: '10-evidence-saved.png',
    narration: 'Finally, the agent saves sources, evidence classes, hypothesis, protocol, seeds, runs, model versions, analyses, limitations, and the next proposal into one manifest-hashed evidence bundle.',
  },
  {
    frame: '11-evidence-ledger.png',
    narration: 'This is the core of FlyLab. One inspector plus seven Web M C P workflow actions let an agent recover, explore, and run a transparent virtual neuroethology workflow while every claim keeps its source and a person keeps control.',
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

for (const binary of [ffmpeg, ffprobe, say]) {
  if (!existsSync(binary)) throw new Error(`Required demo binary was not found: ${binary}`);
}
for (const segment of segments) {
  const frame = join(framesDirectory, segment.frame);
  if (!existsSync(frame)) throw new Error(`Missing demo frame: ${frame}`);
}

await mkdir(outputDirectory, { recursive: true });
await mkdir(galleryDirectory, { recursive: true });
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'flylab-demo-'));
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
    ['03-protocol-locked.png', join(galleryDirectory, '01-human-approval-gate.png')],
    ['06-circuit-bilateral-active.png', join(galleryDirectory, '02-banc-circuit-bilateral.png')],
    ['07-circuit-left-active.png', join(galleryDirectory, '03-banc-circuit-left-only.png')],
    ['08-behavior-analysis.png', join(galleryDirectory, '04-behavior-analysis.png')],
    ['11-evidence-ledger.png', join(galleryDirectory, '05-evidence-ledger.png')],
  ];
  for (const [frame, output] of media) {
    await run(ffmpeg, [
      '-y',
      '-i', join(framesDirectory, frame),
      '-vf', 'crop=1350:900:(iw-1350)/2:0,scale=1200:800:flags=lanczos',
      '-frames:v', '1',
      '-update', '1',
      output,
    ]);
  }

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
  console.log(JSON.stringify({
    ok: true,
    video: outputVideo,
    captions: outputCaptions,
    narration: outputNarration,
    thumbnail: outputThumbnail,
    gallery: media.slice(1).map(([, output]) => output),
    duration_seconds: finalDuration,
    size_bytes: Number(report.format?.size),
    streams: report.streams,
  }, null, 2));
} finally {
  if (basename(temporaryDirectory).startsWith('flylab-demo-')) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
