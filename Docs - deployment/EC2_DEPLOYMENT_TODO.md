# DevByte Engine EC2 Deployment Checklist

This is the checklist for moving the existing Dockerized DevByte Engine from a local development machine to the AWS EC2 host. Follow the phases in order. Do not schedule unattended runs until the one-video smoke test and the five-video test have both completed successfully.

## 0. Current Status

### Completed

- [x] An AWS EC2 instance is running in `ap-south-1`.
- [x] The Docker daemon is installed and usable on the instance.
- [x] The Git repository has been cloned to `~/Devbyte-Engine`.
- [x] Docker images have been built on EC2:
  - `devbyte-engine-devbyte:latest`
  - `devbyte-engine:latest`
- [x] The image build succeeded and each image is approximately 5.9 GB.
- [x] `docker-compose.yml` mounts `data/` and `logs/` so runtime state can survive container replacement.
- [x] Secrets are excluded from Git by `.gitignore`.

### Not yet proven

- [ ] The EC2 host has enough free RAM and disk for one render.
- [ ] `.env`, `client_secrets.json`, and `token.json` exist on the host.
- [ ] The non-root container user can read the secrets and write `token.json`, `data/`, and `logs/`.
- [ ] The container can reach Gemini, source APIs, and YouTube.
- [ ] One video can be generated and uploaded as private.
- [ ] A five-video run can finish without an out-of-memory failure.
- [ ] A cron job can run the pipeline without an interactive shell.

The important distinction is: **a successful `docker build` proves the image can be assembled; it does not prove the application can run.**

## 1. Protect the Deployment Inputs

Before running commands, confirm these rules:

- Never commit or paste `.env`, `client_secrets.json`, `token.json`, or the EC2 private key.
- Never place secrets in the Dockerfile or bake them into an image.
- Do not use `chmod 777` on the repository. It hides ownership problems and weakens security.
- Keep the first YouTube upload private until the complete pipeline is trusted.
- Do not run two production batches at the same time. Two Remotion renders can exhaust memory.

From your local PowerShell terminal, move to the directory containing the key and project files:

```powershell
Set-Location "C:\DEV\devilcode development"
Test-Path .\devbyte-server-key.pem
Test-Path ".\Devbyte-engine (youtube automation)\.env"
Test-Path ".\Devbyte-engine (youtube automation)\client_secrets.json"
Test-Path ".\Devbyte-engine (youtube automation)\token.json"
```

If one of the three application files is missing, stop and fix that locally before continuing. Do not create an empty replacement: an empty OAuth token is not a valid token.

## 2. Connect and Inspect the EC2 Host

Connect from PowerShell:

```powershell
ssh -i ".\devbyte-server-key.pem" ubuntu@ec2-43-204-221-74.ap-south-1.compute.amazonaws.com
```

On EC2, inspect memory, swap, disk, Docker storage, and CPU:

```bash
cd ~/Devbyte-Engine
free -h
df -h /
swapon --show
nproc
docker system df
```

### Why this matters

Rendering uses Chromium, FFmpeg, Node, and Python at the same time. Disk is needed not only for the 5.9 GB image, but also for npm layers, Docker's writable layer, audio, temporary render files, and generated videos. RAM is the more likely first constraint.

Do not infer capacity from the image list. Record the actual values from `free -h` and `df -h`. If available RAM is low, stop other containers and remove only unused Docker objects:

```bash
docker ps
sudo docker system prune
```

Read the prune confirmation carefully. This removes unused Docker data; it does not remove running containers, but it can remove cached images and make a later build slower. Do not use `--volumes` until you understand exactly which data would be deleted.

For the first run, configure the batch for one video. Increase concurrency only after measuring memory during a successful run:

```bash
free -h
watch -n 2 free -h
```

Press `Ctrl+C` to stop `watch` after observing the peak. If memory reaches near zero and swap is absent, do not increase render concurrency.

## 3. Verify the Repository and Compose File

On EC2:

```bash
cd ~/Devbyte-Engine
git status
git log -1 --oneline
docker compose config
```

The last command expands Compose and catches malformed YAML or missing variable interpolation before a real run.

Create persistent directories if they do not already exist:

```bash
mkdir -p data logs
ls -ld data logs
```

The Compose file mounts these host paths into `/app/data` and `/app/logs`. This is important because the container can be replaced while history, queues, and logs remain on the host.

## 4. Transfer Authentication Files Securely

Leave the EC2 shell open or open a second local PowerShell terminal. Run `scp` from the local machine, not from inside EC2. Use the project path that actually exists on your Windows machine:

```powershell
scp -i ".\devbyte-server-key.pem" `
  ".\Devbyte-engine (youtube automation)\.env" `
  ".\Devbyte-engine (youtube automation)\client_secrets.json" `
  ".\Devbyte-engine (youtube automation)\token.json" `
  ubuntu@ec2-43-204-221-74.ap-south-1.compute.amazonaws.com:/home/ubuntu/Devbyte-Engine/
```

If `scp` reports `dest open ... Failure`, inspect the destination paths on EC2:

```bash
cd ~/Devbyte-Engine
ls -ld .env client_secrets.json token.json
```

If any of them begins with `d` in the permissions output, it is a directory. Docker creates an empty directory when a bind-mounted source file is missing. Remove only these empty placeholder directories, then retry `scp` from PowerShell:

```bash
sudo rmdir .env client_secrets.json token.json
```

`rmdir` fails instead of deleting anything if a directory is not empty. Do not use `rm -rf` for this cleanup. Confirm the paths are gone before retrying:

```bash
test ! -e .env && echo ".env ready"
test ! -e client_secrets.json && echo "client_secrets.json ready"
test ! -e token.json && echo "token.json ready"
```

After the transfer, verify that they are regular files rather than directories:

```bash
test -f .env && echo ".env transferred"
test -f client_secrets.json && echo "client_secrets.json transferred"
test -f token.json && echo "token.json transferred"
```

Back in the EC2 shell, check only filenames and permissions, never print file contents:

```bash
cd ~/Devbyte-Engine
ls -l .env client_secrets.json token.json
```

### Why the token is different

`client_secrets.json` identifies the Google application. `token.json` contains the already-authorized OAuth token and may be refreshed by the uploader. The Compose file therefore mounts the token read-write. The `.env` and client secret are read-only mounts.

The Docker Compose command is run by the host user `ubuntu`, so `ubuntu` must be able to read the bind-source files before Docker can start. The container runs as non-root user `devbyte` with UID/GID `1001`, so use `ubuntu` as the host owner and numeric group `1001` for container access:

```bash
sudo chown -R 1001:1001 data logs
sudo chown ubuntu:1001 .env client_secrets.json token.json
# Allow ubuntu to traverse and inspect these bind-mounted directories while
# UID 1001 remains the owner and retains write access.
sudo chmod 755 data logs
sudo chmod 640 .env client_secrets.json
sudo chmod 660 token.json
```

This gives `ubuntu` read access to the Compose source files, gives the container group read access to `.env` and `client_secrets.json`, and allows both `ubuntu` and the container to update `token.json`. Do not use `chmod 777`. Verify ownership and modes:

```bash
stat -c '%U:%G %a %n' .env client_secrets.json token.json data logs
```

## 5. Run a Container-Level Smoke Test

First verify that the bind mounts are accepted and the container can execute Python:

```bash
docker compose run --rm --no-deps devbyte python3 --version
```

Then run one collector or the project’s smallest documented pipeline command. For example, if the collector supports the shown arguments:

```bash
docker compose run --rm devbyte python3 collectors/hackernews.py --input config.json --output data/temp_hn.json
```

Check the result on the host:

```bash
ls -lh data/temp_hn.json
```

If this fails, diagnose the exact class of failure before proceeding:

- `permission denied`: fix ownership of `data`, `logs`, or `token.json`.
- missing secret: repeat the `scp` step and check the filename.
- network or DNS error: check EC2 outbound access and security policy.
- Python/module error: rebuild the image after confirming the repository revision.

## 6. Run One Complete Video

Start with one complete batch item and keep the upload private. Use the project’s existing batch command rather than inventing a second entry point:

```bash
cd ~/Devbyte-Engine
docker compose up --abort-on-container-exit --remove-orphans
```

The command should return after the container exits. Capture the exit code immediately:

```bash
echo $?
```

Inspect the logs and outputs without exposing secrets:

```bash
docker compose logs --no-color --tail=200
tail -n 100 logs/* 2>/dev/null || true
find data -maxdepth 2 -type f -printf '%TY-%Tm-%Td %TH:%TM %s %p\n' | sort | tail -30
```

Confirm all of these before continuing:

- the story was collected and evaluated;
- the script passed validation;
- TTS produced audio;
- Remotion produced a playable MP4;
- the upload completed as private;
- `data/history.json` changed only as expected;
- the container exited successfully.

Do not delete `data/history.json` to make a test pass. It is the publishing ledger and should be preserved.

## 7. Run the Five-Video Benchmark

Only after one video succeeds, run the normal batch. Keep rendering sequential on a small EC2 instance. Record:

- total wall-clock time;
- per-video script, validation, TTS, render, and upload times;
- peak RAM;
- final disk usage;
- whether the growing gap between videos is still present.

Commands to record the before and after resource state:

```bash
date
free -h
df -h /
docker stats --no-stream
```

Run the batch:

```bash
time docker compose up --abort-on-container-exit --remove-orphans
```

Then check for incomplete output or an OOM kill:

```bash
docker compose ps
docker inspect devbyte-engine --format '{{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' 2>/dev/null || true
dmesg -T | grep -i -E 'oom|out of memory|killed process' | tail -20 || true
```

A five-video success means the process completed, not merely that the container started. Keep this benchmark as your production baseline.

## 8. Install a Single-Instance Daily Cron Job

Do not put a long, fragile Compose command directly into crontab. Create a small host script so paths, logging, and overlap protection are explicit:

```bash
cd ~/Devbyte-Engine
nano run_daily.sh
```

Use this content:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

cd /home/ubuntu/Devbyte-Engine
mkdir -p logs

exec 9>/tmp/devbyte-engine.lock
flock -n 9 || {
  printf '%s another run is already active\n' "$(date -Is)" >> logs/cron.log
  exit 0
}

printf '%s starting scheduled run\n' "$(date -Is)" >> logs/cron.log
docker compose up --abort-on-container-exit --remove-orphans >> logs/cron.log 2>&1
status=$?
printf '%s scheduled run exited with status %s\n' "$(date -Is)" "$status" >> logs/cron.log
exit "$status"
```

Make it executable and test it manually before scheduling:

```bash
chmod 750 run_daily.sh
./run_daily.sh
printf 'status=%s\n' "$?"
tail -n 50 logs/cron.log
```

`flock` prevents a second run from starting if the first run is still rendering or uploading. This protects RAM and prevents two jobs from racing over shared history and output files.

Edit the ubuntu user’s crontab:

```bash
crontab -e
```

For a daily run at 23:30 in the EC2 host’s local timezone, add:

```cron
30 23 * * * /home/ubuntu/Devbyte-Engine/run_daily.sh
```

Check the installed entry:

```bash
crontab -l
```

Cron has a small environment, so the script uses absolute paths. If the schedule must be India time, verify the server timezone first:

```bash
timedatectl
```

If it is UTC, either convert the desired time to UTC or set the timezone deliberately after considering the effect on all server tasks. Do not guess.

## 9. Maintenance and Rollback Routine

Before changing application code:

```bash
cd ~/Devbyte-Engine
git status
git pull --ff-only
docker compose build
docker compose up --abort-on-container-exit --remove-orphans
```

Keep runtime data outside the image. Never run `docker compose down -v` for this project unless you have explicitly verified that no important data is stored in Docker volumes.

Useful routine checks:

```bash
df -h /
free -h
docker system df
tail -n 100 ~/Devbyte-Engine/logs/cron.log
```

If a deployment fails, preserve the logs and the failed revision before rebuilding. The first troubleshooting questions are:

1. Did the container start?
2. Did it exit with a non-zero code?
3. Was it killed by the OOM killer?
4. Did a bind-mounted file or directory have the wrong ownership?
5. Did an external API or OAuth token fail?

## Definition of Done

The EC2 deployment is ready for unattended operation only when:

- [ ] the resource baseline is recorded;
- [ ] secrets are transferred outside Git and have restrictive permissions;
- [ ] the container can write to `data/` and `logs/` as UID `1001`;
- [ ] one private video completes end to end;
- [ ] the five-video benchmark completes without OOM or overlapping runs;
- [ ] `logs/cron.log` records a successful manual scheduled-script run;
- [ ] the crontab entry is installed and verified;
- [ ] the first scheduled uploads are checked manually for title, audio, subtitles, and privacy state.



The Fastest Way to See Per-Core CPU Right Now
Since you're SSH'd in during the render, just run this in your terminal:

htop

Press F2 → Display options → Show individual CPUs if not already shown. You'll see CPU 0 and CPU 1 as separate bars updating in real time — far more granular than anything CloudWatch can give you without the agent.

Or for a quick non-interactive snapshot: