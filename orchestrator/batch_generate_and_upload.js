const { spawnSync } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MAX_VIDEOS = 5;

function runCommand(command, args) {
  console.log(`\n======================================================`);
  console.log(`Running: ${command} ${args.join(' ')}`);
  console.log(`======================================================\n`);
  
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: true
  });
  
  return result.status === 0;
}

function main() {
  console.log(`🚀 Starting batch generation of ${MAX_VIDEOS} videos...`);
  
  let successCount = 0;
  
  for (let i = 1; i <= MAX_VIDEOS; i++) {
    console.log(`\n\n🟢 🟢 🟢 STARTING VIDEO ${i} OF ${MAX_VIDEOS} 🟢 🟢 🟢\n`);
    
    // 1. Run the generation pipeline
    const pipelineSuccess = runCommand('node', ['orchestrator/run_pipeline.js', '--fresh']);
    if (!pipelineSuccess) {
      console.error(`❌ Pipeline failed on video ${i}. Halting batch job.`);
      process.exit(1);
    }
    
    // 2. Upload the generated video
    const uploadSuccess = runCommand('python', ['services/upload.py']);
    if (!uploadSuccess) {
      console.error(`❌ Upload failed on video ${i}. Halting batch job.`);
      process.exit(1);
    }
    
    successCount++;
    console.log(`✅ ✅ ✅ SUCCESSFULLY GENERATED AND UPLOADED VIDEO ${i} ✅ ✅ ✅`);
  }
  
  console.log(`\n🎉 BATCH JOB COMPLETE! Successfully generated and uploaded ${successCount} videos.`);
}

main();
