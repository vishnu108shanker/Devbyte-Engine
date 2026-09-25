const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MAX_VIDEOS = 2 ; // Default batch limit
const LOG_FILE = path.join(PROJECT_ROOT, 'logs', 'pipeline.log');
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

// Ensure logs directory exists
if (!fs.existsSync(path.join(PROJECT_ROOT, 'logs'))) {
  fs.mkdirSync(path.join(PROJECT_ROOT, 'logs'), { recursive: true });
}

// Database pool for persistent publication tracking (PostgreSQL truth)
const { getPool } = require('../database_layer/node/connection');
const pool = getPool();

// MongoDB Atlas Presentation Archive publisher
const { publishToMongo, closeMongo } = require('../database_layer/node/mongo_publisher');

// ── Clean Terminal Formatting & Logging ─────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function writeLog(tag, message) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} - [${tag}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (e) {
    // ignore
  }
}

function logPhase(title) {
  console.log(`\n${c.bold}${c.cyan}══════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ${title}${c.reset}`);
  console.log(`${c.bold}${c.cyan}══════════════════════════════════════════════════════════════════════${c.reset}\n`);
  writeLog('PHASE', title);
}

function logWorker(workerNum, total, name, icon, message) {
  const prefix = `${c.bold}[Video ${workerNum}/${total}]${c.reset} ${c.dim}"${name}"${c.reset}`;
  console.log(`${prefix} ${icon} ${message}`);
  writeLog(`Video ${workerNum}/${total}`, `[${name}] ${message}`);
}

function logError(tag, message, detail = '') {
  console.error(`${c.bold}${c.red}❌ [${tag}] ${message}${c.reset}`);
  if (detail) {
    console.error(`${c.dim}${detail.trim().split('\n').slice(-5).join('\n')}${c.reset}`);
  }
  writeLog(`ERROR:${tag}`, `${message}\n${detail}`);
}

// ── Subprocess Runner (Buffered for Crystal-Clear Terminal Output) ───────
function runSubprocess(command, args, options = {}) {
  const { cwd = PROJECT_ROOT, tag = 'EXEC', capture = true } = options;

  return new Promise((resolve) => {
    const t0 = Date.now();
    writeLog(tag, `Spawning: ${command} ${args.join(' ')}`);

    const proc = spawn(command, args, {
      cwd,
      stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    if (capture && proc.stdout) {
      proc.stdout.on('data', (d) => { stdout += d.toString(); });
    }
    if (capture && proc.stderr) {
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
    }

    proc.on('close', (code) => {
      const durationSec = (Date.now() - t0) / 1000;
      const ok = code === 0;

      if (stdout) writeLog(tag, `stdout:\n${stdout.trim()}`);
      if (stderr) writeLog(tag, `stderr:\n${stderr.trim()}`);

      resolve({
        ok,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        durationSec,
      });
    });

    proc.on('error', (err) => {
      writeLog(tag, `Process error: ${err.message}`);
      resolve({
        ok: false,
        code: -1,
        stdout: '',
        stderr: err.message,
        durationSec: (Date.now() - t0) / 1000,
      });
    });
  });
}

// Synchronous helper for top-level sequential ingestion steps
function runSyncStep(command, args, stepLabel) {
  console.log(`  ${c.yellow}▶${c.reset} ${stepLabel}...`);
  const result = spawnSync(command, args, { cwd: PROJECT_ROOT, stdio: 'pipe', shell: false });
  if (result.status !== 0) {
    const errText = result.stderr ? result.stderr.toString() : 'Unknown error';
    logError('INGESTION', `${stepLabel} failed`, errText);
    return false;
  }
  console.log(`  ${c.green}✔${c.reset} ${stepLabel} complete.`);
  return true;
}

// Visual ASCII Performance Report
function printPerformanceReport(title, timings) {
  const maxDuration = Math.max(...timings.map((t) => t.duration), 0.1);
  const maxBarLength = 22;

  const lines = [
    `\n${c.bold}⏱️   PERFORMANCE REPORT: "${title}"${c.reset}`,
    `────────────────────────────────────────────────────────────`,
  ];

  let totalSec = 0;
  for (const t of timings) {
    totalSec += t.duration;
    const durStr = t.duration.toFixed(1).padStart(6, ' ') + 's';
    const barCount = Math.round((t.duration / maxDuration) * maxBarLength);
    const bar = '█'.repeat(barCount);
    lines.push(`  ${t.label.padEnd(16, ' ')}: ${c.cyan}${durStr}${c.reset}  ${c.blue}${bar}${c.reset}`);
  }

  lines.push(`────────────────────────────────────────────────────────────`);
  lines.push(`  ${c.bold}${'Total Pipeline'.padEnd(16, ' ')}: ${c.green}${totalSec.toFixed(1).padStart(6, ' ')}s${c.reset}\n`);

  const reportText = lines.join('\n');
  console.log(reportText);
  writeLog('PERFORMANCE', reportText.replace(/\x1b\[[0-9;]*m/g, ''));
}

// ── Main Orchestration ──────────────────────────────────────────────────
async function main() {
  const overallStart = Date.now();
  console.log(`${c.bold}${c.magenta}`);
  console.log(`  ╔════════════════════════════════════════════════════════════╗`);
  console.log(`  ║       DevByte Engine — High-Throughput Batch Pipeline      ║`);
  console.log(`  ║     Maximum Concurrency • Multi-Platform Publishing        ║`);
  console.log(`  ╚════════════════════════════════════════════════════════════╝${c.reset}`);

  // ── PHASE 1: INGESTION, FILTERING & EVALUATION ────────────────────────
  logPhase('PHASE 1: INGESTION, FILTERING & EDITORIAL EVALUATION');

  console.log(`📡 Spawning 4 content collectors in parallel...`);
  const tCollectors0 = Date.now();
  const collectorTasks = [
    runSubprocess(PYTHON_CMD, ['collectors/hackernews.py', '--input', 'config.json', '--output', 'data/temp_hn.json'], { tag: 'COLLECT:HN' }),
    runSubprocess(PYTHON_CMD, ['collectors/blogs.py', '--input', 'config.json', '--output', 'data/temp_blogs.json'], { tag: 'COLLECT:BLOGS' }),
    runSubprocess(PYTHON_CMD, ['collectors/github_releases.py', '--input', 'config.json', '--output', 'data/temp_github.json'], { tag: 'COLLECT:GITHUB' }),
    runSubprocess(PYTHON_CMD, ['collectors/product_hunt.py', '--input', 'config.json', '--output', 'data/temp_product_hunt.json'], { tag: 'COLLECT:PH' }),
  ];

  const collectorResults = await Promise.all(collectorTasks);
  const collectorSec = ((Date.now() - tCollectors0) / 1000).toFixed(1);
  const collectorsOk = collectorResults.every((r) => r.ok);
  if (!collectorsOk) {
    logError('COLLECTORS', 'One or more content collectors failed. Check logs/pipeline.log for details.');
  } else {
    console.log(`  ${c.green}✔${c.reset} All 4 collectors finished in ${collectorSec}s.\n`);
  }

  const sequentialPipeline = [
    {
      cmd: PYTHON_CMD,
      args: ['ingestion/normalizer.py', '--input', 'data/temp_hn.json', '--input', 'data/temp_blogs.json', '--input', 'data/temp_github.json', '--input', 'data/temp_product_hunt.json', '--output', 'data/raw_candidates.json'],
      label: 'Normalizing candidate schemas',
    },
    {
      cmd: PYTHON_CMD,
      args: ['ingestion/signal_filter.py', '--input', 'data/raw_candidates.json', '--output', 'data/raw_candidates.json'],
      label: 'Applying signal & keyword filters',
    },
    {
      cmd: PYTHON_CMD,
      args: ['ingestion/quality_filter.py', '--input', 'data/raw_candidates.json', '--output', 'data/raw_candidates.json'],
      label: 'Validating story quality & minimum thresholds',
    },
    {
      cmd: PYTHON_CMD,
      args: ['ingestion/deduplicator.py', '--input', 'data/raw_candidates.json', '--output', 'data/raw_candidates.json'],
      label: 'Deduplicating across sources & history',
    },
    {
      cmd: PYTHON_CMD,
      args: ['ingestion/staleness_gate.py', '--input', 'data/raw_candidates.json', '--output', 'data/raw_candidates.json', '--max-days', '14'],
      label: 'Enforcing 14-day staleness gate',
    },
    {
      cmd: PYTHON_CMD,
      args: ['evaluation/evaluator.py', '--input', 'data/raw_candidates.json', '--output', 'data/evaluated_candidates.json'],
      label: 'Two-Pass Gemini editorial scoring & ranking',
    },
    {
      cmd: PYTHON_CMD,
      args: ['editorial/editorial_engine.py', '--input', 'data/evaluated_candidates.json', '--output', 'data/content_queue.json', '--channel', 'channels/ai_tools.json', '--policy', 'editorial/editorial_policy.json', '--history', 'data/history.json'],
      label: 'Assembling balanced content queue',
    },
  ];

  for (const step of sequentialPipeline) {
    if (!runSyncStep(step.cmd, step.args, step.label)) {
      process.exit(1);
    }
  }

  // ── PHASE 2: SETUP WORKERS ────────────────────────────────────────────
  logPhase('PHASE 2: SETUP WORKER DIRECTORIES');
  const queuePath = path.join(PROJECT_ROOT, 'data', 'content_queue.json');
  if (!fs.existsSync(queuePath)) {
    logError('QUEUE', 'Content queue not found at data/content_queue.json');
    process.exit(1);
  }

  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const targetCount = Math.min(MAX_VIDEOS, queue.length);

  if (targetCount === 0) {
    console.log(`⚠️  No eligible candidates found in the queue today.`);
    process.exit(0);
  }

  console.log(`Found ${c.bold}${targetCount}${c.reset} candidates scheduled for production:`);
  const workers = [];

  for (let i = 0; i < targetCount; i++) {
    const workerDir = path.join(PROJECT_ROOT, 'data', `worker_${i}`);
    if (!fs.existsSync(workerDir)) {
      fs.mkdirSync(workerDir, { recursive: true });
    }

    const candidate = queue[i];
    const selectedPath = path.join(workerDir, 'selected_tool.json');
    fs.writeFileSync(selectedPath, JSON.stringify(candidate, null, 2), 'utf8');

    workers.push({ id: i, candidate, dir: workerDir });
    console.log(`  ${c.cyan}#${i + 1}${c.reset} [${candidate.category || 'tool'}] ${c.bold}${candidate.name}${c.reset} (${candidate.source || 'unknown'})`);
  }

  // ── PHASE 3: CONCURRENT PRE-PRODUCTION (SCRIPTS + VALIDATION + TTS) ───
  logPhase('PHASE 3: CONCURRENT PRE-PRODUCTION (SCRIPTS, VALIDATION & TTS)');
  console.log(`⚡ Generating AI scripts and synthesizing neural voice audio for all ${workers.length} videos concurrently...\n`);

  const tPreProd0 = Date.now();

  const preProdPromises = workers.map(async (worker, idx) => {
    const workerNum = idx + 1;
    const wDir = `data/worker_${worker.id}`;
    const name = worker.candidate.name;
    const workerTimings = [];

    // Step 1: Gemini AI Scriptwriting
    logWorker(workerNum, workers.length, name, '✍️ ', 'Generating AI script & metadata...');
    const tScript0 = Date.now();
    const scriptRes = await runSubprocess(PYTHON_CMD, [
      'services/gemini.py',
      '--input', `${wDir}/selected_tool.json`,
      '--output', `${wDir}/script.json`,
    ], { tag: `W${worker.id}:GEMINI` });

    const scriptSec = (Date.now() - tScript0) / 1000;
    workerTimings.push({ label: 'Gemini Script', duration: scriptSec });

    if (!scriptRes.ok) {
      logError(`Worker ${workerNum}`, `Script generation failed for "${name}"`, scriptRes.stderr);
      return { worker, ok: false, timings: workerTimings, errorStep: 'Script' };
    }

    // Step 2: Validator
    const tVal0 = Date.now();
    const valRes = await runSubprocess(PYTHON_CMD, [
      'utils/validator.py',
      '--input', `${wDir}/script.json`,
      '--output', `${wDir}/validated_script.json`,
    ], { tag: `W${worker.id}:VALIDATOR` });

    const valSec = (Date.now() - tVal0) / 1000;
    workerTimings.push({ label: 'Validator', duration: valSec });

    if (!valRes.ok) {
      logError(`Worker ${workerNum}`, `Script validation failed for "${name}"`, valRes.stderr);
      return { worker, ok: false, timings: workerTimings, errorStep: 'Validator' };
    }

    // Step 3: Edge TTS Voice Synthesis
    logWorker(workerNum, workers.length, name, '🎙️ ', 'Synthesizing neural TTS audio...');
    const tTts0 = Date.now();
    const ttsRes = await runSubprocess(PYTHON_CMD, [
      'services/tts.py',
      '--input', `${wDir}/validated_script.json`,
      '--output', `${wDir}/audio.mp3`,
    ], { tag: `W${worker.id}:TTS` });

    const ttsSec = (Date.now() - tTts0) / 1000;
    workerTimings.push({ label: 'TTS Voice', duration: ttsSec });

    if (!ttsRes.ok) {
      logError(`Worker ${workerNum}`, `TTS audio synthesis failed for "${name}"`, ttsRes.stderr);
      return { worker, ok: false, timings: workerTimings, errorStep: 'TTS' };
    }

    logWorker(workerNum, workers.length, name, '✅', `Script & Voice ready! (Script: ${scriptSec.toFixed(1)}s, TTS: ${ttsSec.toFixed(1)}s)`);
    return { worker, ok: true, timings: workerTimings };
  });

  const preProdResults = await Promise.all(preProdPromises);
  const totalPreProdSec = ((Date.now() - tPreProd0) / 1000).toFixed(1);
  const readyWorkers = preProdResults.filter((r) => r.ok);
  console.log(`\n${c.green}✔${c.reset} Pre-production complete! ${c.bold}${readyWorkers.length}/${workers.length}${c.reset} videos ready to render (${totalPreProdSec}s total).`);

  // ── PHASE 4: PIPELINED RENDERING & MULTI-PLATFORM PUBLISHING ─────────
  logPhase('PHASE 4: PIPELINED RENDERING (MAX CPU) & MULTI-PLATFORM PUBLISHING (MAX I/O)');

  const cpuCount = os.cpus() ? os.cpus().length : 1;
  console.log(`⚙️  Host hardware: ${c.bold}${cpuCount} CPU threads${c.reset}`);
  console.log(`⚙️  Remotion render concurrency: ${c.bold}${process.env.REMOTION_CONCURRENCY || cpuCount} workers${c.reset}`);
  console.log(`⚙️  Multi-Platform distribution: YouTube Shorts, Instagram Reels, Facebook Page\n`);

  let activeUploadPromise = Promise.resolve();
  const publicationOutcomes = [];

  for (let i = 0; i < readyWorkers.length; i++) {
    const { worker, timings } = readyWorkers[i];
    const workerNum = i + 1;
    const wDir = `data/worker_${worker.id}`;
    const name = worker.candidate.name;

    // ── Remotion Video Render (Maximizing 100% CPU on host) ────────────
    logWorker(workerNum, readyWorkers.length, name, '🎬', `Rendering Remotion video (utilizing all ${cpuCount} CPU cores)...`);
    const tRender0 = Date.now();

    const renderRes = await runSubprocess('node', [
      'services/render.js',
      '--input', `${wDir}/validated_script.json`,
      '--audio', `${wDir}/audio.mp3`,
      '--output', `${wDir}/video.mp4`,
    ], { tag: `W${worker.id}:RENDER`, capture: false });

    const renderSec = (Date.now() - tRender0) / 1000;
    timings.push({ label: 'Remotion Render', duration: renderSec });

    if (!renderRes.ok) {
      logError(`Worker ${workerNum}`, `Render failed for "${name}"`);
      continue;
    }

    logWorker(workerNum, readyWorkers.length, name, '✅', `Render complete in ${renderSec.toFixed(1)}s!`);

    // ── Pipelined Publishing Slot ───────────────────────────────────────
    // Hand off this video to the background publishing pipeline so the next video
    // can begin Remotion rendering immediately on the CPU.
    const prevUpload = activeUploadPromise;

    activeUploadPromise = (async () => {
      await prevUpload;

      logWorker(workerNum, readyWorkers.length, name, '🚀', 'Starting concurrent multi-platform publishing (YouTube + Meta S3)...');
      const publishStart = Date.now();

      // Track platform upload states and permalinks
      const platformStatus = {
        youtube: false,
        instagram: false,
        facebook: false,
      };
      const platformUrls = {
        youtube: null,
        instagram: null,
        facebook: null,
      };

      // 1. YouTube Upload Promise (Direct local file -> Google API)
      const ytPromise = (async () => {
        const tYt0 = Date.now();
        const res = await runSubprocess(PYTHON_CMD, [
          'services/upload.py',
          '--video', `${wDir}/video.mp4`,
          '--script', `${wDir}/script.json`,
        ], { tag: `W${worker.id}:YT`, capture: true });

        const sec = (Date.now() - tYt0) / 1000;
        timings.push({ label: 'YT Upload', duration: sec });

        if (res.ok) {
          platformStatus.youtube = true;
          const urlMatch = res.stdout.match(/URL:\s*(https:\/\/youtu\.be\/[^\s]+|https:\/\/www\.youtube\.com\/[^\s]+)/);
          const idMatch = res.stdout.match(/Video ID:\s*([^\s|]+)/);
          platformUrls.youtube = urlMatch ? urlMatch[1] : (idMatch ? `https://www.youtube.com/shorts/${idMatch[1]}` : null);
          logWorker(workerNum, readyWorkers.length, name, '✅', `YouTube Shorts published successfully! (${sec.toFixed(1)}s)`);
        } else {
          logError(`Worker ${workerNum} | YT`, `YouTube upload failed`, res.stderr);
        }
      })();

      // 2. Meta Platforms Publishing Flow (Shared S3 temporary asset)
      const metaPromise = (async () => {
        // Step A: Upload video once to S3 to get a presigned URL
        logWorker(workerNum, readyWorkers.length, name, '☁️ ', 'Uploading temporary asset to S3 for Meta platforms...');
        const tS30 = Date.now();
        const s3Res = await runSubprocess(PYTHON_CMD, [
          'services/s3_temp_upload.py',
          '--file', `${wDir}/video.mp4`,
        ], { tag: `W${worker.id}:S3`, capture: true });

        const s3Sec = (Date.now() - tS30) / 1000;
        timings.push({ label: 'S3 Temp Upload', duration: s3Sec });

        if (!s3Res.ok) {
          logError(`Worker ${workerNum} | S3`, 'S3 upload failed; skipping Instagram and Facebook', s3Res.stderr);
          return;
        }

        let s3Data;
        try {
          s3Data = JSON.parse(s3Res.stdout);
        } catch (parseErr) {
          logError(`Worker ${workerNum} | S3`, 'Invalid JSON from s3_temp_upload.py', s3Res.stdout);
          return;
        }

        const { presigned_url: presignedUrl, key: s3Key } = s3Data;
        logWorker(workerNum, readyWorkers.length, name, '⚡', 'Broadcasting S3 presigned URL to Instagram & Facebook concurrently...');
        let metaCaption = '';
        try {
          const scriptData = JSON.parse(fs.readFileSync(`${wDir}/script.json`, 'utf8'));
          metaCaption = scriptData.title || '';
        } catch (e) {
          logError(`Worker ${workerNum}`, 'Failed to read script.json for caption', e.message);
        }

        // Step B: Dispatch Instagram Reels and Facebook Page uploads in parallel!
        const igPromise = (async () => {
          const tIg0 = Date.now();
          const igRes = await runSubprocess(PYTHON_CMD, [
            'services/upload_instagram.py',
            '--video', `${wDir}/video.mp4`,
            '--video-url', presignedUrl,
            '--caption', metaCaption,
            '--no-cleanup',
          ], { tag: `W${worker.id}:IG`, capture: true });

          const igSec = (Date.now() - tIg0) / 1000;
          timings.push({ label: 'IG Upload', duration: igSec });

          if (igRes.ok) {
            platformStatus.instagram = true;
            const igMatch = igRes.stdout.match(/Media ID:\s*([^\s]+)/);
            platformUrls.instagram = igMatch ? `https://www.instagram.com/reel/${igMatch[1]}/` : null;
            logWorker(workerNum, readyWorkers.length, name, '✅', `Instagram Reels published successfully! (${igSec.toFixed(1)}s)`);
          } else {
            logError(`Worker ${workerNum} | IG`, 'Instagram Reels upload failed', igRes.stderr);
          }
        })();

        const fbPromise = (async () => {
          const tFb0 = Date.now();
          const fbRes = await runSubprocess(PYTHON_CMD, [
            'services/upload_facebook.py',
            '--video', `${wDir}/video.mp4`,
            '--video-url', presignedUrl,
            '--caption', metaCaption,
          ], { tag: `W${worker.id}:FB`, capture: true });

          const fbSec = (Date.now() - tFb0) / 1000;
          timings.push({ label: 'FB Upload', duration: fbSec });

          if (fbRes.ok) {
            platformStatus.facebook = true;
            const fbMatch = fbRes.stdout.match(/Video ID:\s*([^\s]+)/);
            platformUrls.facebook = fbMatch ? `https://www.facebook.com/watch/?v=${fbMatch[1]}` : null;
            logWorker(workerNum, readyWorkers.length, name, '✅', `Facebook Page published successfully! (${fbSec.toFixed(1)}s)`);
          } else {
            logError(`Worker ${workerNum} | FB`, 'Facebook Page upload failed', fbRes.stderr);
          }
        })();

        // Wait for BOTH Meta platforms to complete reading the S3 URL
        await Promise.all([igPromise, fbPromise]);

        // Step C: Delete temporary S3 object now that both Meta platforms have fetched it
        const delRes = await runSubprocess(PYTHON_CMD, [
          'services/s3_temp_upload.py',
          '--delete',
          '--key', s3Key,
        ], { tag: `W${worker.id}:S3_CLEANUP`, capture: true });

        if (delRes.ok) {
          logWorker(workerNum, readyWorkers.length, name, '🧹', 'Cleaned up temporary S3 asset.');
        } else {
          writeLog('S3_CLEANUP', `Warning: could not delete ${s3Key}`);
        }
      })();

      // Wait for both YouTube and Meta pipelines to finish concurrently
      await Promise.all([ytPromise, metaPromise]);

      const totalPublishSec = ((Date.now() - publishStart) / 1000).toFixed(1);
      const isAnyPublished = platformStatus.youtube || platformStatus.instagram || platformStatus.facebook;

      if (isAnyPublished) {
        logWorker(workerNum, readyWorkers.length, name, '🎉', `All platforms finished in ${totalPublishSec}s!`);
      } else {
        logError(`Worker ${workerNum}`, `All upload targets failed for "${name}"`);
      }

      printPerformanceReport(name, timings);

      const getTiming = (lbl) => (timings.find((t) => t.label === lbl)?.duration || 0);

      const performanceSnapshot = {
        gemini_script_s: Math.round(getTiming('Gemini Script') * 10) / 10,
        validator_s: Math.round(getTiming('Validator') * 10) / 10,
        tts_s: Math.round(getTiming('TTS Voice') * 10) / 10,
        render_s: Math.round(getTiming('Remotion Render') * 10) / 10,
        s3_upload_s: Math.round(getTiming('S3 Temp Upload') * 10) / 10,
        yt_upload_s: Math.round(getTiming('YT Upload') * 10) / 10,
        fb_upload_s: Math.round(getTiming('FB Upload') * 10) / 10,
        ig_upload_s: Math.round(getTiming('IG Upload') * 10) / 10,
        total_s: Math.round(timings.reduce((acc, curr) => acc + (curr.duration || 0), 0) * 10) / 10,
      };

      return {
        candidate: worker.candidate,
        success: isAnyPublished,
        platforms: platformStatus,
        platformUrls,
        performance: performanceSnapshot,
      };
    })();

    publicationOutcomes.push(activeUploadPromise);
  }

  // ── PHASE 5: DATABASE & HISTORY LEDGER UPDATES ────────────────────────
  logPhase('PHASE 5: DATABASE & HISTORY LEDGER UPDATES');
  console.log(`Waiting for all in-flight platform uploads to settle...`);
  const settledPublications = await Promise.all(publicationOutcomes);

  let successCount = 0;
  let historyData = [];
  try {
    historyData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'data', 'history.json'), 'utf8'));
  } catch (e) {
    historyData = [];
  }

  for (const item of settledPublications) {
    if (item && item.success) {
      const cand = item.candidate;
      cand.published_at = new Date().toISOString();
      cand.published_platforms = item.platforms;

      // 1. PostgreSQL Publications Table (Append-only Production Truth)
      if (pool) {
        try {
          await pool.query(
            `INSERT INTO publications (candidate_id, published_at, event_type, candidate_snapshot)
             VALUES ($1, $2, $3, $4)`,
            [
              cand.id,
              cand.published_at,
              cand.event_type || 'update',
              cand,
            ]
          );
          console.log(`  ${c.green}✔${c.reset} [PostgreSQL] Recorded publication for '${cand.id}'`);
        } catch (dbErr) {
          logError('DB', `Failed to insert publication '${cand.id}' into PostgreSQL`, dbErr.message);
        }
      }

      // 2. MongoDB Atlas Presentation Archive (DEVLAR website read-only database)
      const mongoDoc = {
        video_id: cand.id,
        title: cand.name || cand.title || 'Untitled DevByte Video',
        published_at: cand.published_at,
        platforms: {
          youtube: {
            status: item.platforms.youtube ? 'success' : 'failed',
            url: item.platformUrls.youtube,
          },
          instagram: {
            status: item.platforms.instagram ? 'success' : 'failed',
            url: item.platformUrls.instagram,
          },
          facebook: {
            status: item.platforms.facebook ? 'success' : 'failed',
            url: item.platformUrls.facebook,
          },
          devbyte_wiki: {
            status: null,
            url: null,
          },
        },
        performance: item.performance,
      };

      await publishToMongo(mongoDoc);

      // 3. Append to history.json
      historyData.push(cand);
      successCount++;
    }
  }

  fs.writeFileSync(path.join(PROJECT_ROOT, 'data', 'history.json'), JSON.stringify(historyData, null, 2), 'utf8');
  console.log(`  ${c.green}✔${c.reset} [history.json] Updated ledger with ${successCount} new video records.`);

  if (pool) {
    await pool.end();
  }
  await closeMongo();

  const grandTotalSec = ((Date.now() - overallStart) / 1000).toFixed(1);
  console.log(`\n${c.bold}${c.green}══════════════════════════════════════════════════════════════════════`);
  console.log(`  🎉 BATCH PRODUCTION COMPLETE!`);
  console.log(`  Published: ${successCount}/${targetCount} videos across YouTube, Instagram & Facebook`);
  console.log(`  Total Run Duration: ${grandTotalSec}s`);
  console.log(`══════════════════════════════════════════════════════════════════════${c.reset}\n`);
}

main().catch((err) => {
  logError('FATAL', 'Unhandled exception in batch orchestrator', err.stack || err.message);
  process.exit(1);
});
