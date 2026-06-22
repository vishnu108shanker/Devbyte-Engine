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

// Load config to get the timeout
let config;
try {
  const configPath = path.join(PROJECT_ROOT, 'config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  logError(`Failed to load config.json: ${e.message}`);
  process.exit(1);
}

const timeoutSeconds = config.subprocess_timeout_seconds || 30;

function runStep(step) {
  const outPathAbs = path.resolve(PROJECT_ROOT, step.outputPath);
  
  // Skip step if output exists and is non-empty
  if (fs.existsSync(outPathAbs)) {
    const stats = fs.statSync(outPathAbs);
    if (stats.size > 0) {
      logWarning(`Skipping step '${step.name}' - output already exists and is non-empty (${step.outputPath})`);
      return true;
    }
  }

  logInfo(`Running step: ${step.name}`);
  logInfo(`Command: ${step.command} ${step.args.join(' ')}`);

  // 30 second timeout on all Python subprocess calls. Node/Remotion gets 0 (unlimited)
  const stepTimeoutMs = step.command === "python" ? timeoutSeconds * 1000 : 0;

  // Execute subprocess
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
  
  // Verify output was actually created
  if (!fs.existsSync(outPathAbs) || fs.statSync(outPathAbs).size === 0) {
    logError(`Step '${step.name}' completed but output file is missing or empty: ${step.outputPath}`);
    return false;
  }

  logSuccess(`Completed step: ${step.name}`);
  return true;
}

const steps = [
  {
    name: "1. Scrape GitHub Trending",
    command: "python",
    args: ["sources/github.py", "--input", "config.json", "--output", "data/trending.json"],
    outputPath: "data/trending.json"
  },
  {
    name: "2. Generate AI Script",
    command: "python",
    args: ["services/gemini.py", "--input", "data/trending.json", "--output", "data/script.json"],
    outputPath: "data/script.json"
  },
  {
    name: "3. Validate Script",
    command: "python",
    args: ["utils/validator.py", "--input", "data/script.json", "--output", "data/validated_script.json"],
    outputPath: "data/validated_script.json"
  },
  {
    name: "4. Generate TTS Audio",
    command: "python",
    args: ["services/tts.py", "--input", "data/validated_script.json", "--output", "data/audio.mp3"],
    outputPath: "data/audio.mp3"
  },
  {
    name: "5. Render Video",
    command: "node",
    args: ["services/render.js", "--input", "data/validated_script.json", "--audio", "data/audio.mp3", "--output", "data/video.mp4"],
    outputPath: "data/video.mp4"
  }
];

function safeWipeData() {
  const dataDir = path.join(PROJECT_ROOT, 'data');
  // Hardcoded specific files to prevent accidental deletion of other items
  const filesToWipe = [
    'trending.json',
    'script.json',
    'validated_script.json',
    'audio.mp3',
    'video.mp4'
  ];
  
  logInfo("Fresh run requested (--fresh). Safely cleaning old data files...");
  for (const file of filesToWipe) {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logInfo(`Deleted old file: ${file}`);
      } catch (err) {
        logWarning(`Could not delete ${file}: ${err.message}`);
      }
    }
  }
}

function main() {
  logInfo("=== STARTING VIDEO AUTOMATION PIPELINE ===");
  
  if (isFreshRun) {
    safeWipeData();
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
