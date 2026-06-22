@echo off
echo =================================================== >> logs\automation.log
echo Starting automated YouTube Shorts pipeline >> logs\automation.log
echo Date: %date% Time: %time% >> logs\automation.log
echo =================================================== >> logs\automation.log

cd /d "c:\DEV\devilcode development\Youtube-video-automation"
node orchestrator/run_pipeline.js --fresh >> logs\automation.log 2>&1

echo. >> logs\automation.log
echo Finished automated run >> logs\automation.log
