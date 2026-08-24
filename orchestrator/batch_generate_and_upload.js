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

async function main() {
  console.log(`🚀 Starting PARALLEL batch generation of ${MAX_VIDEOS} videos...\n`);

  // Phase 1: Ingestion & Evaluation (Run once)
  console.log(`--- PHASE 1: INGESTION, FILTERING & EVALUATION ---`);
  const ingestSteps = [
    ["python", ["collectors/hackernews.py", "--input", "config.json", "--output", "data/temp_hn.json"]],
    ["python", ["collectors/blogs.py", "--input", "config.json", "--output", "data/temp_blogs.json"]],
    ["python", ["collectors/github_releases.py", "--input", "config.json", "--output", "data/temp_github.json"]],
    ["python", ["collectors/product_hunt.py", "--input", "config.json", "--output", "data/temp_product_hunt.json"]],
    ["python", ["ingestion/normalizer.py", "--input", "data/temp_hn.json", "--input", "data/temp_blogs.json", "--input", "data/temp_github.json", "--input", "data/temp_product_hunt.json", "--output", "data/raw_candidates.json"]],
    ["python", ["ingestion/signal_filter.py", "--input", "data/raw_candidates.json", "--output", "data/raw_candidates.json"]],
    ["python", ["ingestion/quality_filter.py", "--input", "data/raw_candidates.json", "--output", "data/raw_candidates.json"]],
    ["python", ["ingestion/deduplicator.py", "--input", "data/raw_candidates.json", "--output", "data/raw_candidates.json"]],
    ["python", ["evaluation/evaluator.py", "--input", "data/raw_candidates.json", "--output", "data/evaluated_candidates.json"]],
    ["python", ["editorial/editorial_engine.py", "--input", "data/evaluated_candidates.json", "--output", "data/content_queue.json", "--channel", "channels/ai_tools.json", "--policy", "editorial/editorial_policy.json", "--history", "data/history.json"]]
  ];

  for (const [cmd, args] of ingestSteps) {
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

  // Phase 3 & 4: Parallel Generation, Rendering & Uploading
  console.log(`\n--- PHASE 3 & 4: PARALLEL GENERATION & UPLOAD ---`);
  
  let historyData = [];
  try {
    historyData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'data', 'history.json'), 'utf8'));
  } catch (e) {
    // If it doesn't exist, we start fresh
  }
  
  const workerPromises = workers.map(async (worker) => {
    const wId = worker.id;
    const wDir = `data/worker_${wId}`;
    
    console.log(`[Worker ${wId}] Starting generation for: ${worker.candidate.name}`);
    
    // AI Script
    let ok = await runCommandAsync('python', ['services/gemini.py', '--input', `${wDir}/selected_tool.json`, '--output', `${wDir}/script.json`]);
    if (!ok) return false;
    
    // Validate
    ok = await runCommandAsync('python', ['utils/validator.py', '--input', `${wDir}/script.json`, '--output', `${wDir}/validated_script.json`]);
    if (!ok) return false;
    
    // TTS
    ok = await runCommandAsync('python', ['services/tts.py', '--input', `${wDir}/validated_script.json`, '--output', `${wDir}/audio.mp3`]);
    if (!ok) return false;
    
    // Render (Concurrency safe now that props/audio names are dynamic!)
    ok = await runCommandAsync('node', ['services/render.js', '--input', `${wDir}/validated_script.json`, '--audio', `${wDir}/audio.mp3`, '--output', `${wDir}/video.mp4`]);
    if (!ok) return false;
    
    // Upload
    ok = await runCommandAsync('python', ['services/upload.py', '--video', `${wDir}/video.mp4`, '--script', `${wDir}/script.json`]);
    if (!ok) return false;
    
    console.log(`[Worker ${wId}] ✅ Successfully generated and uploaded video!`);
    return true;
  });

  const results = await Promise.all(workerPromises);
  
  // Phase 5: Cleanup & History Update
  console.log(`\n--- PHASE 5: CLEANUP & HISTORY UPDATE ---`);
  let successCount = 0;
  for (let i = 0; i < results.length; i++) {
    if (results[i]) {
      const cand = workers[i].candidate;
      cand.published_at = new Date().toISOString();
      historyData.push(cand);
      successCount++;
    }
  }
  
  fs.writeFileSync(path.join(PROJECT_ROOT, 'data', 'history.json'), JSON.stringify(historyData, null, 2), 'utf8');
  console.log(`✅ Updated data/history.json with ${successCount} new videos.`);
  
  console.log(`\n🎉 BATCH JOB of 5 videos COMPLETE! Successfully generated and uploaded ${successCount} videos.`);
}

main();
