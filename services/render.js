const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const inputPath = getArg('--input');
const audioPath = getArg('--audio');
const outputPath = getArg('--output');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOG_FILE = path.join(PROJECT_ROOT, 'logs', 'pipeline.log');

function logError(msg) {
  const timestamp = new Date().toISOString();
  const logMsg = `${timestamp} - ERROR - [render.js] ${msg}\n`;
  console.error(`❌ ${msg}`);
  fs.appendFileSync(LOG_FILE, logMsg, 'utf8');
}

function logInfo(msg) {
  const timestamp = new Date().toISOString();
  const logMsg = `${timestamp} - INFO - [render.js] ${msg}\n`;
  console.log(`ℹ️ ${msg}`);
  fs.appendFileSync(LOG_FILE, logMsg, 'utf8');
}

async function main() {
  if (!inputPath || !audioPath || !outputPath) {
    logError("Missing required arguments. Need --input, --audio, --output");
    process.exit(1);
  }

  const absInput = path.resolve(PROJECT_ROOT, inputPath);
  const absAudio = path.resolve(PROJECT_ROOT, audioPath);
  const absOutput = path.resolve(PROJECT_ROOT, outputPath);
  
  if (!fs.existsSync(absInput)) {
    logError(`Input script not found: ${absInput}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(absAudio)) {
    logError(`Audio file not found: ${absAudio}`);
    process.exit(1);
  }

  try {
    logInfo("Reading script data...");
    const scriptData = JSON.parse(fs.readFileSync(absInput, 'utf8'));
    
    logInfo("Calculating audio duration...");
    let durationInSeconds = 30; // fallback
    try {
      const mm = await import('music-metadata');
      const metadata = await mm.parseFile(absAudio);
      durationInSeconds = metadata.format.duration;
    } catch (mmErr) {
      logError(`Failed to parse audio metadata: ${mmErr.message}. Defaulting to 30s.`);
    }
    
    if (!durationInSeconds) {
      throw new Error("Could not determine audio duration.");
    }
    
    const fps = 30;
    const durationInFrames = Math.ceil(durationInSeconds * fps);
    logInfo(`Audio duration: ${durationInSeconds.toFixed(2)}s (${durationInFrames} frames)`);

    const renderDir = path.join(PROJECT_ROOT, 'render');
    const publicDir = path.join(renderDir, 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Copy the audio to public directory so Remotion can access it via staticFile
    const audioFilename = 'audio.mp3';
    fs.copyFileSync(absAudio, path.join(publicDir, audioFilename));

    // Prepare props. 
    const props = {
      ...scriptData,
      durationInFrames,
      audio_url: audioFilename
    };
    
    const propsPath = path.join(renderDir, 'props.json');
    
    fs.writeFileSync(propsPath, JSON.stringify(props, null, 2), 'utf8');
    logInfo(`Generated props.json at ${propsPath}`);
    
    const outDir = path.dirname(absOutput);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // Determine Composition Name based on category
    // Convert snake_case to PascalCase (e.g. 'free_alternative' -> 'FreeAlternative')
    const category = scriptData.category || 'free_alternative';
    const compositionName = category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
    
    logInfo(`Spawning Remotion render subprocess for composition: ${compositionName}...`);
    const remotionCmd = `npx remotion render src/index.ts ${compositionName} "${absOutput}" --props=props.json`;
    
    try {
      execSync(remotionCmd, { cwd: renderDir, stdio: 'inherit' });
    } catch (renderError) {
      throw new Error(`Remotion subprocess failed: ${renderError.message}`);
    }

    if (fs.existsSync(propsPath)) {
      fs.unlinkSync(propsPath);
      logInfo("Cleaned up props.json");
    }
    const publicAudioPath = path.join(publicDir, 'audio.mp3');
    if (fs.existsSync(publicAudioPath)) {
      fs.unlinkSync(publicAudioPath);
      logInfo("Cleaned up public/audio.mp3");
    }
    
    logInfo(`✅ Video successfully rendered at ${absOutput}`);
    
  } catch (error) {
    logError(error.message);
    process.exit(1);
  }
}

main();
