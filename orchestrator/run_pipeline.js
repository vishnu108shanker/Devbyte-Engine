const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const isFreshRun = args.includes('--fresh');
const LOG_FILE = path.join(PROJECT_ROOT, 'logs', 'pipeline.log');


function logInfo(msg) {
  const timestamp = new Date().toISOString();
  const logMsg = `${timestamp} - INFO - [orchestrator] ${msg}\n`;
  console.log(`ℹ️ ${msg}`);
  fs.appendFileSync(LOG_FILE, logMsg, 'utf8');
}

function logError(msg) {
  const timestamp = new Date().toISOString();
  const logMsg = `${timestamp} - ERROR - [orchestrator] ${msg}\n`;
  console.error(`❌ ${msg}`);
  fs.appendFileSync(LOG_FILE, logMsg, 'utf8');
}

function logSuccess(msg) {
  const timestamp = new Date().toISOString();
  const logMsg = `${timestamp} - INFO - [orchestrator] ${msg}\n`;
  console.log(`✅ ${msg}`);
  fs.appendFileSync(LOG_FILE, logMsg, 'utf8');
}

function logWarning(msg) {
  const timestamp = new Date().toISOString();
  const logMsg = `${timestamp} - WARN - [orchestrator] ${msg}\n`;
  console.log(`⚠️ ${msg}`);
  fs.appendFileSync(LOG_FILE, logMsg, 'utf8');
}

let config;
try {
  const configPath = path.join(PROJECT_ROOT, 'config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  logError(`Failed to load config.json: ${e.message}`);
  process.exit(1);
}

const timeoutSeconds = config.subprocess_timeout_seconds || 60;

function cleanup() {
  const dataDir = path.join(PROJECT_ROOT, 'data');
  const safeFiles = ['history.json', 'video.mp4'];
  
  logInfo("Performing pre-run cleanup...");
  
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir);
    for (const file of files) {
      if (!safeFiles.includes(file)) {
        try {
          const filePath = path.join(dataDir, file);
          fs.rmSync(filePath, { recursive: true, force: true });
          logInfo(`Cleaned up temp file/folder: ${file}`);
        } catch (err) {
          logWarning(`Could not clean up ${file}: ${err.message}`);
        }
      }
    }
  }
}

function runStep(step) {
  logInfo(`Running step: ${step.name}`);
  logInfo(`Command: ${step.command} ${step.args.join(' ')}`);

  const stepTimeoutMs = step.command === "python" ? timeoutSeconds * 1000 : 0;

  const result = spawnSync(step.command, step.args, {
    cwd: PROJECT_ROOT,
    timeout: stepTimeoutMs,
    stdio: 'inherit',
    shell: true 
  });

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      logError(`Step '${step.name}' timed out after ${timeoutSeconds} seconds.`);
    } else {
      logError(`Step '${step.name}' failed to spawn: ${result.error.message}`);
    }
    return false;
  }

  if (result.status !== 0) {
    logError(`Step '${step.name}' exited with code ${result.status}`);
    return false;
  }
  
  if (step.outputPath) {
    const outPathAbs = path.resolve(PROJECT_ROOT, step.outputPath);
    if (!fs.existsSync(outPathAbs) || fs.statSync(outPathAbs).size === 0) {
        // Only fail if outputPath is strictly required. Wait, we always require it.
        // Actually, normalizer filters in place. If it's empty array, it's 2 bytes. 0 bytes means failure.
        if (!fs.existsSync(outPathAbs)) {
             logError(`Step '${step.name}' completed but output file is missing: ${step.outputPath}`);
             return false;
        }
    }
  }

  logSuccess(`Completed step: ${step.name}`);
  return true;
}

const steps = [
  {
    name: "1. Collect Hacker News",
    command: "python",
    args: ["collectors/hackernews.py", "--input", "config.json", "--output", "data/temp_hn.json"],
    outputPath: "data/temp_hn.json"
  },
  {
    name: "2. Collect Blogs",
    command: "python",
    args: ["collectors/blogs.py", "--input", "config.json", "--output", "data/temp_blogs.json"],
    outputPath: "data/temp_blogs.json"
  },
  {
    name: "2b. Collect GitHub",
    command: "python",
    args: ["collectors/github_releases.py", "--input", "config.json", "--output", "data/temp_github.json"],
    outputPath: "data/temp_github.json"
  },
  {
    name: "2c. Collect Product Hunt",
    command: "python",
    args: ["collectors/product_hunt.py", "--input", "config.json", "--output", "data/temp_product_hunt.json"],
    outputPath: "data/temp_product_hunt.json"
  },
  {
    name: "3. Normalize Data",
    command: "python",
    args: ["ingestion/normalizer.py", "--input", "data/temp_hn.json", "--input", "data/temp_blogs.json", "--input", "data/temp_github.json", "--input", "data/temp_product_hunt.json", "--output", "data/raw_candidates.json"],
    outputPath: "data/raw_candidates.json"
  },
  {
    name: "3b. Signal Filter",
    command: "python",
    args: ["ingestion/signal_filter.py", "--input", "data/raw_candidates.json", "--output", "data/raw_candidates.json"],
    outputPath: "data/raw_candidates.json"
  },
  {
    name: "4. Quality Filter",
    command: "python",
    args: ["ingestion/quality_filter.py", "--input", "data/raw_candidates.json", "--output", "data/raw_candidates.json"],
    outputPath: "data/raw_candidates.json"
  },
  {
    name: "5. Deduplicate",
    command: "python",
    args: ["ingestion/deduplicator.py", "--input", "data/raw_candidates.json", "--output", "data/raw_candidates.json"],
    outputPath: "data/raw_candidates.json"
  },
  {
    name: "6. Evaluate Candidates",
    command: "python",
    args: ["evaluation/evaluator.py", "--input", "data/raw_candidates.json", "--output", "data/evaluated_candidates.json"],
    outputPath: "data/evaluated_candidates.json"
  },
  {
    name: "7. Editorial Engine",
    command: "python",
    args: ["editorial/editorial_engine.py", "--input", "data/evaluated_candidates.json", "--output", "data/content_queue.json", "--channel", "channels/ai_tools.json", "--policy", "editorial/editorial_policy.json", "--history", "data/history.json"],
    outputPath: "data/content_queue.json"
  },
  {
    name: "8. Select Top Candidate",
    command: "node",
    args: ["-e", "\"const fs=require('fs'); fs.writeFileSync('data/selected_tool.json', JSON.stringify(JSON.parse(fs.readFileSync('data/content_queue.json'))[0], null, 2))\""],
    outputPath: "data/selected_tool.json"
  },
  {
    name: "9. Generate AI Script",
    command: "python",
    args: ["services/gemini.py", "--input", "data/selected_tool.json", "--output", "data/script.json"],
    outputPath: "data/script.json"
  },
  {
    name: "10. Validate Script",
    command: "python",
    args: ["utils/validator.py", "--input", "data/script.json", "--output", "data/validated_script.json"],
    outputPath: "data/validated_script.json"
  },
  {
    name: "11. Generate TTS Audio",
    command: "python",
    args: ["services/tts.py", "--input", "data/validated_script.json", "--output", "data/audio.mp3"],
    outputPath: "data/audio.mp3"
  },
  {
    name: "12. Render Video",
    command: "node",
    args: ["services/render.js", "--input", "data/validated_script.json", "--audio", "data/audio.mp3", "--output", "data/video.mp4"],
    outputPath: "data/video.mp4"
  },
  {
    name: "13. Update History",
    command: "node",
    args: ["-e", "\"const fs=require('fs'); const h=JSON.parse(fs.readFileSync('data/history.json') || '[]'); h.push(JSON.parse(fs.readFileSync('data/selected_tool.json'))); fs.writeFileSync('data/history.json', JSON.stringify(h, null, 2))\""]
  }
];

function main() {
  logInfo("=== STARTING VIDEO AUTOMATION PIPELINE V2 ===");
  
  if (isFreshRun) {
    cleanup();
  }
  
  for (const step of steps) {
    const success = runStep(step);
    if (!success) {
      logError("Pipeline halted due to unrecoverable failure.");
      process.exit(1);
    }
  }
  
  logSuccess("=== PIPELINE COMPLETED SUCCESSFULLY ===");
}

main();
