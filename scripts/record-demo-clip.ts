/**
 * Records the demo clip that every title plays in demo mode (CLAUDE.md §12: browser recording
 * with MediaRecorder instead of ffmpeg). A canvas animation and a quiet Web Audio pad are recorded
 * in Chromium as fragmented MP4 (VP9 + Opus). The fragments double as HLS segments, so the mock
 * server can offer the same file for direct play and as an HLS stream.
 *
 * The recording runs in real time (about a minute). Run it only when the clip should change:
 *   node scripts/record-demo-clip.ts
 * To only redo the post-processing of the existing file: node scripts/record-demo-clip.ts --finalize
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLIP_PARTS, CLIP_SECONDS } from '../src/mocks/media/timeline.ts';

const WIDTH = 960;
const HEIGHT = 540;
const OUTPUT = join(import.meta.dirname, '..', 'src', 'mocks', 'media');

/** Invented names for the closing credits. */
const CREDITS = [
  'Ana Berger',
  'Ben Okafor',
  'Carla Wendt',
  'David Lindqvist',
  'Elif Aydın',
  'Finn Marlow',
  'Greta Sommer',
  'Hannes Roth',
  'Ida Kaminski',
  'Jonas Feld',
  'Kaja Norberg',
  'Leon Hartwig',
  'Mara Vogt',
  'Noah Brenner',
  'Olga Petrova',
  'Paul Seidel',
];

interface RecordingOptions {
  width: number;
  height: number;
  seconds: number;
  parts: readonly { kind: string; start: number; end: number; label: string }[];
  credits: string[];
}

/** Runs inside the browser page. */
async function recordInPage(options: RecordingOptions): Promise<string> {
  const { width, height, seconds, parts, credits } = options;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  document.body.append(canvas);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D context');
  const ctx = context;

  const hueAt = (t: number) => Math.round(228 + 34 * Math.sin((t / seconds) * Math.PI * 2));
  const timecode = (t: number) => {
    const whole = Math.max(0, Math.floor(t));
    return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
  };
  const partAt = (t: number) =>
    parts.find((part) => t >= part.start && t < part.end) ?? parts[parts.length - 1];
  const fade = (t: number, start: number, end: number, edge = 0.8) =>
    Math.max(0, Math.min(1, (t - start) / edge, (end - t) / edge));

  const circles = Array.from({ length: 7 }, (_, index) => ({
    radius: 50 + ((index * 37) % 110),
    speed: 0.05 + index * 0.013,
    phase: index * 1.7,
    offset: index * 24,
  }));

  function draw(t: number) {
    const hue = hueAt(t);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `hsl(${hue} 45% 17%)`);
    gradient.addColorStop(1, `hsl(${hue + 40} 50% 7%)`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (const circle of circles) {
      const x = width / 2 + Math.cos(t * circle.speed + circle.phase) * width * 0.38;
      const y = height / 2 + Math.sin(t * circle.speed * 1.3 + circle.phase) * height * 0.34;
      ctx.beginPath();
      ctx.arc(x, y, circle.radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${hue + circle.offset} 70% 62% / 0.1)`;
      ctx.fill();
    }

    const part = partAt(t);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';

    if (part?.kind === 'intro') {
      for (let ring = 0; ring < 4; ring += 1) {
        const progress = ((t - part.start) / 1.6 + ring / 4) % 1;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 60 + progress * 360, 0, Math.PI * 2);
        ctx.strokeStyle = `hsl(${hue + 60} 80% 75% / ${String(0.35 * (1 - progress))})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.globalAlpha = fade(t, part.start, part.end);
      ctx.textAlign = 'center';
      ctx.font = '800 132px system-ui, sans-serif';
      ctx.letterSpacing = '28px';
      ctx.fillText('DEMO', width / 2 + 14, height / 2);
      ctx.letterSpacing = '0px';
    }

    if (part?.kind === 'part') {
      ctx.globalAlpha = fade(t, part.start, part.end, 0.5);
      ctx.textAlign = 'center';
      ctx.font = '700 150px system-ui, sans-serif';
      ctx.fillText(timecode(t), width / 2, height / 2 - 10);
      const barWidth = 480;
      ctx.fillStyle = 'rgb(255 255 255 / 0.18)';
      ctx.fillRect((width - barWidth) / 2, height / 2 + 90, barWidth, 6);
      ctx.fillStyle = `hsl(${hue + 60} 85% 72%)`;
      ctx.fillRect((width - barWidth) / 2, height / 2 + 90, (barWidth * t) / seconds, 6);
    }

    if (part?.kind === 'outro') {
      ctx.globalAlpha = fade(t, part.start, part.end + 1);
      ctx.textAlign = 'center';
      const lineHeight = 46;
      const scroll = (t - part.start) * 52;
      ctx.font = '600 30px system-ui, sans-serif';
      credits.forEach((name, index) => {
        const y = height + 40 + index * lineHeight - scroll;
        if (y > -40 && y < height + 40) ctx.fillText(name, width / 2, y);
      });
    }

    ctx.globalAlpha = 1;
    if (part?.label) {
      ctx.textAlign = 'left';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillStyle = 'rgb(255 255 255 / 0.7)';
      ctx.fillText(part.label, 36, 44);
    }
    ctx.textAlign = 'right';
    ctx.font = '600 20px ui-monospace, monospace';
    ctx.fillStyle = 'rgb(255 255 255 / 0.6)';
    ctx.fillText(`${timecode(t)}.${String(Math.floor((t % 1) * 10))}`, width - 36, height - 36);

    // Fade in from black at the start.
    if (t < 1.5) {
      ctx.globalAlpha = 1 - t / 1.5;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
  }

  const audio = new AudioContext({ sampleRate: 48_000 });
  const destination = audio.createMediaStreamDestination();
  const master = audio.createGain();
  master.gain.value = 0.9;
  master.connect(destination);
  const begin = audio.currentTime + 0.05;
  for (const frequency of [110, 164.81, 220, 277.18]) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.018;
    oscillator.connect(gain).connect(master);
    oscillator.start(begin);
    oscillator.stop(begin + seconds + 1);
  }
  for (let time = 3; time < seconds; time += 5) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = time % 10 === 3 ? 880 : 659.25;
    gain.gain.setValueAtTime(0, begin + time);
    gain.gain.linearRampToValueAtTime(0.05, begin + time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, begin + time + 1.4);
    oscillator.connect(gain).connect(master);
    oscillator.start(begin + time);
    oscillator.stop(begin + time + 1.5);
  }

  const stream = new MediaStream([
    ...canvas.captureStream(30).getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);
  const recorderOptions: MediaRecorderOptions & { videoKeyFrameIntervalDuration: number } = {
    mimeType: 'video/mp4;codecs=vp9,opus',
    videoBitsPerSecond: 380_000,
    audioBitsPerSecond: 48_000,
    videoKeyFrameIntervalDuration: 2000,
  };
  const recorder = new MediaRecorder(stream, recorderOptions);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    chunks.push(event.data);
  };

  draw(0);
  const start = performance.now() + (begin - audio.currentTime) * 1000;
  let frame = 0;
  const tick = () => {
    draw(Math.max(0, (performance.now() - start) / 1000));
    frame = requestAnimationFrame(tick);
  };
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, start - performance.now())));
  recorder.start(1000);
  tick();
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000 + 150));
  await new Promise((resolve) => {
    recorder.onstop = resolve;
    recorder.stop();
  });
  cancelAnimationFrame(frame);
  await audio.close();

  const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

interface Box {
  type: string;
  start: number;
  end: number;
}

function readBoxes(data: Buffer, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let position = start;
  while (position + 8 <= end) {
    let size = data.readUInt32BE(position);
    if (size === 1) size = Number(data.readBigUInt64BE(position + 8));
    if (size === 0) size = end - position;
    boxes.push({
      type: data.toString('latin1', position + 4, position + 8),
      start: position,
      end: position + size,
    });
    position += size;
  }
  return boxes;
}

const child = (data: Buffer, box: Box, type: string) =>
  readBoxes(data, box.start + 8, box.end).find((candidate) => candidate.type === type);
const children = (data: Buffer, box: Box, type: string) =>
  readBoxes(data, box.start + 8, box.end).filter((candidate) => candidate.type === type);

/** Fragment table of the recording: byte ranges and durations for the HLS playlist. */
function analyze(data: Buffer) {
  const top = readBoxes(data, 0, data.length);
  const moov = top.find((box) => box.type === 'moov');
  if (!moov) throw new Error('moov box missing');

  let videoTrack = 0;
  let timescale = 0;
  for (const trak of children(data, moov, 'trak')) {
    const mdia = child(data, trak, 'mdia');
    const hdlr = mdia && child(data, mdia, 'hdlr');
    if (!mdia || !hdlr || data.toString('latin1', hdlr.start + 16, hdlr.start + 20) !== 'vide')
      continue;
    const tkhd = child(data, trak, 'tkhd');
    const mdhd = child(data, mdia, 'mdhd');
    if (!tkhd || !mdhd) continue;
    const tkhdVersion = data[tkhd.start + 8];
    videoTrack = data.readUInt32BE(tkhd.start + (tkhdVersion === 1 ? 28 : 20));
    const mdhdVersion = data[mdhd.start + 8];
    timescale = data.readUInt32BE(mdhd.start + (mdhdVersion === 1 ? 28 : 20));
  }
  if (!videoTrack || !timescale) throw new Error('video track missing');

  const fragments: { offset: number; length: number; start: number; samples: number }[] = [];
  for (const box of top) {
    if (box.type === 'moof') {
      for (const traf of children(data, box, 'traf')) {
        const tfhd = child(data, traf, 'tfhd');
        if (!tfhd || data.readUInt32BE(tfhd.start + 12) !== videoTrack) continue;
        const tfdt = child(data, traf, 'tfdt');
        const trun = child(data, traf, 'trun');
        if (!tfdt || !trun) continue;
        const start =
          data[tfdt.start + 8] === 1
            ? Number(data.readBigUInt64BE(tfdt.start + 12))
            : data.readUInt32BE(tfdt.start + 12);
        fragments.push({
          offset: box.start,
          length: 0,
          start,
          samples: data.readUInt32BE(trun.start + 12),
        });
      }
    }
    const last = fragments.at(-1);
    if (box.type === 'mdat' && last) last.length = box.end - last.offset;
  }
  const frameTicks = timescale / 30;
  const total = (fragments.at(-1)?.start ?? 0) + (fragments.at(-1)?.samples ?? 0) * frameTicks;
  const initLength = moov.end;
  return {
    width: WIDTH,
    height: HEIGHT,
    durationSeconds: Math.round((total / timescale) * 1000) / 1000,
    codecs: 'vp09.00.30.08,opus',
    init: { offset: 0, length: initLength },
    fragments: fragments.map((fragment, index) => {
      const next = fragments[index + 1]?.start ?? total;
      return {
        offset: fragment.offset,
        length: fragment.length,
        duration: Math.round(((next - fragment.start) / timescale) * 1000) / 1000,
      };
    }),
  };
}

/**
 * Chromium writes VP9 level 0 into the vpcC box, which MediaSource.isTypeSupported() rejects.
 * Level 3.0 covers 960×540 at 30 fps.
 */
function patchVp9Level(data: Buffer): void {
  const at = data.indexOf(Buffer.from('vpcC', 'latin1'));
  if (at < 0) throw new Error('vpcC box missing');
  data[at + 4 + 4 + 1] = 30;
}

/**
 * MediaRecorder leaves the duration at 0 because it writes while recording; browsers then learn
 * the length only while loading and cannot start in the middle. The movie header gets the real
 * duration and `mvex` a `mehd` box (the fragment duration that fragmented files announce).
 */
function withDuration(data: Buffer, seconds: number): Buffer {
  const moov = readBoxes(data, 0, data.length).find((box) => box.type === 'moov');
  const mvhd = moov && child(data, moov, 'mvhd');
  const mvex = moov && child(data, moov, 'mvex');
  if (!moov || !mvhd || !mvex) throw new Error('moov, mvhd or mvex box missing');
  const version = data[mvhd.start + 8];
  const timescaleAt = mvhd.start + (version === 1 ? 28 : 20);
  const duration = Math.round(seconds * data.readUInt32BE(timescaleAt));
  if (version === 1) data.writeBigUInt64BE(BigInt(duration), timescaleAt + 4);
  else data.writeUInt32BE(duration, timescaleAt + 4);

  const existing = child(data, mvex, 'mehd');
  if (existing) {
    if (data[existing.start + 8] === 1)
      data.writeBigUInt64BE(BigInt(duration), existing.start + 12);
    else data.writeUInt32BE(duration, existing.start + 12);
    return data;
  }
  const mehd = Buffer.alloc(20);
  mehd.writeUInt32BE(20, 0);
  mehd.write('mehd', 4, 'latin1');
  mehd[8] = 1;
  mehd.writeBigUInt64BE(BigInt(duration), 12);
  const insertAt = mvex.start + 8;
  const result = Buffer.concat([data.subarray(0, insertAt), mehd, data.subarray(insertAt)]);
  // Fragment offsets are relative to their moof box, so only the parents' sizes change.
  result.writeUInt32BE(result.readUInt32BE(moov.start) + 20, moov.start);
  result.writeUInt32BE(result.readUInt32BE(mvex.start) + 20, mvex.start);
  return result;
}

function finalize(recording: Buffer): void {
  patchVp9Level(recording);
  const data = withDuration(recording, analyze(recording).durationSeconds);
  const table = analyze(data);
  writeFileSync(join(OUTPUT, 'demo-clip.mp4'), data);
  writeFileSync(
    join(OUTPUT, 'demo-clip.json'),
    `${JSON.stringify(table, null, 2)}
`,
  );
  console.log(
    `demo-clip.mp4: ${(data.length / 1024).toFixed(0)} KB, ${String(table.durationSeconds)} s, ${String(table.fragments.length)} fragments`,
  );
}

if (process.argv.includes('--finalize')) {
  // Only post-process the existing recording (e.g. after changing this script).
  finalize(readFileSync(join(OUTPUT, 'demo-clip.mp4')));
} else {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>clip</title><body style="margin:0"></body>');
    console.log(`Recording ${String(CLIP_SECONDS)} s …`);
    const base64 = await page.evaluate(recordInPage, {
      width: WIDTH,
      height: HEIGHT,
      seconds: CLIP_SECONDS,
      parts: CLIP_PARTS,
      credits: CREDITS,
    });
    finalize(Buffer.from(base64, 'base64'));
  } finally {
    await browser.close();
  }
}
