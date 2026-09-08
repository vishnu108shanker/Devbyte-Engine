const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MAX_VIDEOS = 5;  // Limit to 5 videos per batch




// Utility to run sync commands (for Phase 1)
function runCommandSync(command, args, cwd = PROJECT_ROOT) {
  console.log(`\n> [SYNC] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: true });
  return result.status === 0;
}

// Utility to run async commands (returns a Promise, for Phase 3/4)
function runCommandAsync(command, args, cwd = PROJECT_ROOT) {
  return new Promise((resolve) => {
    console.log(`\n> [ASYNC] ${command} ${args.join(' ')}`);
    const proc = spawn(command, args, { cwd, stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

// Performance report generator with visual ASCII bar chart
function logPerformanceReport(title, timings) {
  const LOG_FILE = path.join(PROJECT_ROOT, 'logs', 'pipeline.log');
  const maxDuration = Math.max(...timings.map(t => t.duration), 0.1);
  const maxBarLength = 20;

  const lines = [
    `\n⏱️  PERFORMANCE REPORT: "${title}"`,
    `──────────────────────────────────────────────────`
  ];

  let totalSec = 0;
  for (const t of timings) {
    totalSec += t.duration;
    const durStr = t.duration.toFixed(1).padStart(6, ' ') + 's';
    const barCount = Math.round((t.duration / maxDuration) * maxBarLength);
    const bar = '█'.repeat(barCount);
    lines.push(`${t.label.padEnd(15, ' ')}: ${durStr}  ${bar}`);
  }

  lines.push(`──────────────────────────────────────────────────`);
  lines.push(`Total Pipeline  : ${totalSec.toFixed(1).padStart(6, ' ')}s\n`);

  const reportText = lines.join('\n');
  console.log(reportText);

  try {
    fs.appendFileSync(LOG_FILE, `\n${new Date().toISOString()} - INFO - [performance]\n${reportText}\n`, 'utf8');
  } catch (e) {
    // ignore
  }
}

async function main() {
  console.log(`🚀 Starting PARALLEL batch generation of ${MAX_VIDEOS} videos...\n`);

  // Phase 1: Ingestion & Evaluation (Run once)
  console.log(`--- PHASE 1: INGESTION, FILTERING & EVALUATION ---`);
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

  console.log("Running collectors concurrently...");
  const collectorPromises = [
    runCommandAsync(PYTHON_CMD, ["collectors/hackernews.py", "--input", "config.json", "--output", "data/temp_hn.json"]),
    runCommandAsync(PYTHON_CMD, ["collectors/blogs.py", "--input", "config.json", "--output", "data/temp_blogs.json"]),
    runCommandAsync(PYTHON_CMD, ["collectors/github_releases.py", "--input", "config.json", "--output", "data/temp_github.json"]),
    runCommandAsync(PYTHON_CMD, ["collectors/product_hunt.py", "--input", "config.json", "--output", "data/temp_product_hunt.json"])
  ];
  await Promise.all(collectorPromises);

  const sequentialSteps = [
    [PYTHON_CMD, ["ingestion/normalizer.py", "--input", "data/temp_hn.json", "--input", "data/temp_blogs.json", "--input", "data/temp_github.json", "--input", "data/temp_product_hunt.json", "--output", "data/raw_candidates.json"]],
    [PYTHON_CMD, ["ingestion/signal_filter.py", "--input", "data/raw_candidates.json", "--output", "data/raw_candidates.json"]],
    [PYTHON_CMD, ["ingestion/quality_filter.py", "--input", "data/raw_candidates.json", "--output", "data/raw_candidates.json"]],
    [PYTHON_CMD, ["ingestion/deduplicator.py", "--input", "data/raw_candidates.json", "--output", "data/raw_candidates.json"]],
    [PYTHON_CMD, ["ingestion/staleness_gate.py", "--input", "data/raw_candidates.json", "--output", "data/raw_candidates.json", "--max-days", "14"]],
    [PYTHON_CMD, ["evaluation/evaluator.py", "--input", "data/raw_candidates.json", "--output", "data/evaluated_candidates.json"]],
    [PYTHON_CMD, ["editorial/editorial_engine.py", "--input", "data/evaluated_candidates.json", "--output", "data/content_queue.json", "--channel", "channels/ai_tools.json", "--policy", "editorial/editorial_policy.json", "--history", "data/history.json"]]
  ];

  for (const [cmd, args] of sequentialSteps) {
    if (!runCommandSync(cmd, args)) {
      console.error(`❌ Ingestion failed at step: ${args[0]}`);
      process.exit(1);
    }
  }

  // Phase 2: Setup Workers
  console.log(`\n--- PHASE 2: SETUP WORKERS ---`);
  const queuePath = path.join(PROJECT_ROOT, 'data', 'content_queue.json');
  if (!fs.existsSync(queuePath)) {
    console.error(`❌ Content queue not found!`);
    process.exit(1);
  }
  
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const targetCount = Math.min(MAX_VIDEOS, queue.length);
  
  if (targetCount === 0) {
    console.log(`⚠️ No eligible candidates found today.`);
    process.exit(0);
  }
  
  console.log(`Found ${targetCount} candidates to process.`);
  const workers = [];

  for (let i = 0; i < targetCount; i++) {
    const workerDir = path.join(PROJECT_ROOT, 'data', `worker_${i}`);
    if (!fs.existsSync(workerDir)) {
      fs.mkdirSync(workerDir, { recursive: true });
    }
    
    // Write selected tool
    const candidate = queue[i];
    const selectedPath = path.join(workerDir, 'selected_tool.json');
    fs.writeFileSync(selectedPath, JSON.stringify(candidate, null, 2), 'utf8');
    
    workers.push({ id: i, candidate, dir: workerDir });
  }

  // Phase 3 & 4: Overlapped Production & Upload (Single-Upload-Slot Queue)
  console.log(`\n--- PHASE 3 & 4: PIPELINED VIDEO PRODUCTION & UPLOAD ---`);
  console.log(`Sequential rendering (concurrency = 1) overlapped with a single upload slot (concurrency = 1)...\n`);
  
  let historyData = [];
  try {
    historyData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'data', 'history.json'), 'utf8'));
  } catch (e) {
    // If it doesn't exist, we start fresh
  }
  
  let activeUploadPromise = Promise.resolve();
  const uploadResults = [];

  for (let i = 0; i < workers.length; i++) {
    const worker = workers[i];
    const wId = worker.id;
    const wDir = `data/worker_${wId}`;
    const timings = [];
    
    console.log(`\n🎬 [Video ${i + 1}/${workers.length}] Starting production: "${worker.candidate.name}"`);
    
    // 1. AI Script
    const tScript0 = Date.now();
    let ok = await runCommandAsync(PYTHON_CMD, ['services/gemini.py', '--input', `${wDir}/selected_tool.json`, '--output', `${wDir}/script.json`]);
    const scriptSec = (Date.now() - tScript0) / 1000;
    timings.push({ label: 'Gemini Script', duration: scriptSec });
    if (!ok) {
      console.error(`[Video ${i + 1}] ❌ Script generation failed.`);
      continue;
    }

    // 2. Validate
    const tVal0 = Date.now();
    ok = await runCommandAsync(PYTHON_CMD, ['utils/validator.py', '--input', `${wDir}/script.json`, '--output', `${wDir}/validated_script.json`]);
    const valSec = (Date.now() - tVal0) / 1000;
    timings.push({ label: 'Validator', duration: valSec });
    if (!ok) {
      console.error(`[Video ${i + 1}] ❌ Script validation failed.`);
      continue;
    }

    // 3. TTS
    const tTts0 = Date.now();
    ok = await runCommandAsync(PYTHON_CMD, ['services/tts.py', '--input', `${wDir}/validated_script.json`, '--output', `${wDir}/audio.mp3`]);
    const ttsSec = (Date.now() - tTts0) / 1000;
    timings.push({ label: 'TTS Voice', duration: ttsSec });
    if (!ok) {
      console.error(`[Video ${i + 1}] ❌ TTS audio generation failed.`);
      continue;
    }

    // 4. Render (Sequential — starts only after previous video is fully rendered)
    const tRender0 = Date.now();
    ok = await runCommandAsync('node', ['services/render.js', '--input', `${wDir}/validated_script.json`, '--audio', `${wDir}/audio.mp3`, '--output', `${wDir}/video.mp4`]);
    const renderSec = (Date.now() - tRender0) / 1000;
    timings.push({ label: 'Remotion Render', duration: renderSec });
    if (!ok) {
      console.error(`[Video ${i + 1}] ❌ Video rendering failed.`);
      continue;
    }
    console.log(`[Video ${i + 1}/${workers.length}] ✅ Render complete! (${renderSec.toFixed(1)}s)`);

    // 5. Pipelined Upload Slot (Queue slot concurrency = 1)
    // Chain onto the active upload so uploads never run in parallel with each other,
    // but the next video's render pipeline proceeds immediately.
    const prevUpload = activeUploadPromise;

    activeUploadPromise = (async () => {
      await prevUpload;

      console.log(`\n📤 [Upload Slot] Starting YouTube upload for Video ${i + 1}: "${worker.candidate.name}"`);
      const tUpload0 = Date.now();
      const uploadOk = await runCommandAsync(PYTHON_CMD, ['services/upload.py', '--video', `${wDir}/video.mp4`, '--script', `${wDir}/script.json`]);
      const uploadSec = (Date.now() - tUpload0) / 1000;
      timings.push({ label: 'YT Upload', duration: uploadSec });

      if (uploadOk) {
        console.log(`[Upload Slot] ✅ Video ${i + 1} uploaded successfully!`);
      } else {
        console.error(`[Upload Slot] ❌ Video ${i + 1} upload failed.`);
      }

      logPerformanceReport(worker.candidate.name, timings);
      return { success: uploadOk, candidate: worker.candidate };
    })();

    uploadResults.push(activeUploadPromise);
  }
  
  // Phase 5: Cleanup & History Update
  console.log(`\n--- PHASE 5: CLEANUP & HISTORY UPDATE ---`);
  console.log(`Waiting for all in-flight uploads to complete...`);
  const settledUploads = await Promise.all(uploadResults);

  let successCount = 0;
  for (const res of settledUploads) {
    if (res && res.success) {
      const cand = res.candidate;
      cand.published_at = new Date().toISOString();
      historyData.push(cand);
      successCount++;
    }
  }
  
  fs.writeFileSync(path.join(PROJECT_ROOT, 'data', 'history.json'), JSON.stringify(historyData, null, 2), 'utf8');
  console.log(`✅ Updated data/history.json with ${successCount} new videos.`);
  
  console.log(`\n🎉 BATCH JOB COMPLETE! Successfully generated and uploaded ${successCount} videos.`);
}

main();
