# DevByte Engine Command Reference

This reference assumes the project root is the current directory unless a command says otherwise.

## Local System

### Project and File Operations

- `Get-Location`
  Shows the current PowerShell directory.

- `Get-ChildItem`
  Lists files and folders in the current directory.

- `Get-ChildItem -Recurse -File | Select-Object FullName`
  Lists files recursively without showing directories.

- `Get-ChildItem data\worker_0`
  Lists the artifacts generated for worker 0.

- `Test-Path data\worker_0\video.mp4`
  Checks whether the worker video exists.

- `Get-Item data\worker_0\video.mp4 | Select-Object FullName,Length,LastWriteTime`
  Shows the video path, size, and last modification time.

- `Get-Content logs\pipeline.log -Tail 50`
  Displays the last 50 lines of the pipeline log.

- `Get-Content logs\pipeline.log -Wait -Tail 50`
  Follows the pipeline log and displays new lines as they are written.

- `Select-String -Path logs\pipeline.log -Pattern 'ERROR|failed|FB|IG|S3'`
  Searches the pipeline log for common upload and failure messages.

### Python, Node, and Media Tools

- `python --version`
  Shows the locally selected Python version.

- `python -c "import sys; print(sys.executable)"`
  Shows which Python executable is being used.

- `node --version`
  Shows the installed Node.js version.

- `npm --version`
  Shows the installed npm version.

- `ffmpeg -version`
  Checks whether FFmpeg is installed and available on the local PATH.

- `Get-Command python,python3,node,npm,ffmpeg -ErrorAction SilentlyContinue`
  Shows which local executables PowerShell can find.

- `pip install -r requirements.txt`
  Installs or updates the Python dependencies listed by the project.

- `npm install`
  Installs the root Node.js dependencies from `package.json`.

- `Set-Location render; npm install; Set-Location ..`
  Installs the Remotion renderer dependencies and returns to the project root.

### Local Pipeline and Upload Testing

- `npm run batch`
  Runs the complete batch generation and publishing pipeline locally.

- `node orchestrator/run_pipeline.js --fresh`
  Runs a fresh single-video pipeline locally.

- `python services/s3_temp_upload.py --file data\worker_0\video.mp4`
  Uploads a video to S3 and prints a presigned URL, bucket, and object key.

- `python services/upload_facebook.py --video data\worker_0\video.mp4 --caption "DevByte AI Tool Spotlight"`
  Runs the standalone Facebook uploader locally, including S3 upload and thumbnail generation.

- `python services/upload_instagram.py --video data\worker_0\video.mp4 --caption "DevByte AI Tool Spotlight"`
  Runs the standalone Instagram Reels uploader locally.

- `python services/upload.py --video data\worker_0\video.mp4 --script data\worker_0\script.json`
  Runs the YouTube uploader locally.

### Local Networking and Processes

- `Test-NetConnection graph.facebook.com -Port 443`
  Checks HTTPS connectivity from Windows to the Meta Graph API.

- `Test-NetConnection s3.ap-south-1.amazonaws.com -Port 443`
  Checks HTTPS connectivity from Windows to the AWS S3 regional endpoint.

- `Get-Process node,python,ffmpeg -ErrorAction SilentlyContinue`
  Lists running Node.js, Python, and FFmpeg processes.

- `Stop-Process -Name node,python,ffmpeg -Force -ErrorAction SilentlyContinue`
  Stops stuck local pipeline processes.

### SSH Connection

- `ssh -i .\devbyte-server-key.pem ubuntu@<EC2_PUBLIC_IP>`
  Opens an SSH session to the EC2 instance using the project key.

- `ssh -i .\devbyte-server-key.pem -o ConnectTimeout=10 ubuntu@<EC2_PUBLIC_IP> "hostname; docker --version"`
  Tests SSH access and Docker availability without opening an interactive shell.

## Docker

### Docker Daemon and Image Checks

- `docker version`
  Checks whether the local Docker client can reach the Docker daemon.

- `docker info`
  Shows Docker daemon status, storage, and runtime information.

- `docker compose config`
  Validates and renders the effective Compose configuration.

- `docker compose images`
  Lists images used by the Compose project.

- `docker image ls`
  Lists locally available Docker images.

- `docker compose build devbyte`
  Rebuilds the DevByte image using the current Dockerfile.

- `docker compose build --no-cache devbyte`
  Rebuilds the DevByte image from scratch when the existing image may be stale.

### Compose Service Management

- `docker compose ps`
  Shows the state of the Compose services.

- `docker compose up -d postgres`
  Starts PostgreSQL in the background.

- `docker compose up -d devbyte`
  Starts the DevByte service in the background.

- `docker compose up -d`
  Starts all Compose services in the background.

- `docker compose down`
  Stops and removes the Compose containers without deleting named volumes.

- `docker compose logs -f devbyte`
  Follows the DevByte container logs.

- `docker compose logs --tail 100 devbyte`
  Shows the last 100 DevByte container log lines.

- `docker compose exec devbyte <command>`
  Runs a command inside an already running DevByte container.

- `docker compose run --rm devbyte <command>`
  Creates a temporary DevByte container, runs one command, and removes it afterward.

### Container Runtime Diagnostics

- `docker compose run --rm --entrypoint python3 devbyte --version`
  Checks that Python 3 is installed in the DevByte image.

- `docker compose run --rm --entrypoint ffmpeg devbyte -version`
  Checks that FFmpeg is installed in the DevByte image.

- `docker compose run --rm --entrypoint node devbyte --version`
  Checks that Node.js is installed in the DevByte image.

- `docker compose run --rm --entrypoint sh devbyte -c "id; pwd; ls -la; command -v python3; command -v ffmpeg; command -v node"`
  Inspects the container user, working directory, files, and key executables.

- `docker compose run --rm --entrypoint python3 devbyte -c "import os, shutil; print('Python:', shutil.which('python3')); print('FFmpeg:', shutil.which('ffmpeg')); print('Video:', os.path.isfile('data/worker_0/video.mp4')); print('FB token configured:', bool(os.getenv('FB_LONG_LIVED_TOKEN'))); print('FB page configured:', bool(os.getenv('FB_PAGE_ID'))); print('S3 bucket configured:', bool(os.getenv('S3_TEMP_BUCKET')))"`
  Checks the container runtime, mounted video, and presence of required Facebook and S3 environment variables without printing secrets.

- `docker compose run --rm --entrypoint python3 devbyte -c "import os; print({name: bool(os.getenv(name)) for name in ['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_DEFAULT_REGION','S3_TEMP_BUCKET','META_LONG_LIVED_TOKEN','INSTAGRAM_ACCOUNT_ID','FB_PAGE_ID','FB_LONG_LIVED_TOKEN']})"`
  Checks whether the main AWS and Meta variables are present inside the container without exposing their values.

### Docker Upload Testing

- `docker compose run --rm --entrypoint python3 devbyte services/s3_temp_upload.py --file data/worker_0/video.mp4`
  Tests container-to-S3 upload and presigned URL generation.

- `docker compose run --rm --entrypoint python3 devbyte services/upload_facebook.py --video data/worker_0/video.mp4 --caption "DevByte AI Tool Spotlight"`
  Tests a standalone Facebook upload from a temporary container.

- `docker compose run --rm --entrypoint python3 devbyte services/upload_instagram.py --video data/worker_0/video.mp4 --caption "DevByte AI Tool Spotlight"`
  Tests a standalone Instagram upload from a temporary container.

- `docker compose run --rm --entrypoint node devbyte orchestrator/batch_generate_and_upload.js`
  Runs the batch orchestrator with Node as the explicit container entrypoint.

### Docker Cleanup and Inspection

- `docker ps`
  Lists running containers.

- `docker ps -a`
  Lists running and stopped containers.

- `docker inspect devbyte-engine`
  Shows detailed configuration for the named DevByte container.

- `docker stats`
  Shows live CPU, memory, network, and block I/O usage for running containers.

- `docker system df`
  Shows Docker disk usage by images, containers, and volumes.

- `docker compose rm -f`
  Removes stopped Compose containers.

## EC2

### Connection and Instance Checks

- `ssh -i devbyte-server-key.pem ubuntu@<EC2_PUBLIC_IP>`
  Connects to the Ubuntu EC2 instance.

- `hostname`
  Shows the EC2 hostname.

- `whoami`
  Shows the current Linux user.

- `pwd`
  Shows the current remote directory.

- `uptime`
  Shows instance uptime and load average.

- `df -h`
  Shows available disk space on mounted filesystems.

- `free -h`
  Shows available memory and swap usage.

- `nproc`
  Shows the number of available CPU cores.

- `uname -a`
  Shows the Linux kernel and system information.

### Project and File Operations

- `cd ~/Devbyte-Engine`
  Changes to the deployed project directory.

- `ls -lah`
  Lists project files with sizes and permissions.

- `find data/worker_0 -maxdepth 1 -type f -printf '%f %s bytes\n'`
  Lists worker 0 files and their sizes.

- `test -f data/worker_0/video.mp4 && echo 'video exists' || echo 'video missing'`
  Checks whether the worker video exists on EC2.

- `stat data/worker_0/video.mp4`
  Shows the video size, timestamps, and permissions.

- `tail -n 100 logs/pipeline.log`
  Displays the last 100 pipeline log lines.

- `tail -f logs/pipeline.log`
  Follows the pipeline log in real time.

- `grep -Ei 'error|failed|facebook|instagram|s3' logs/pipeline.log | tail -n 100`
  Searches recent pipeline logs for upload-related messages.

### EC2 Docker Management

- `docker version`
  Checks whether Docker is installed and the daemon is reachable on EC2.

- `docker compose ps`
  Shows the status of the EC2 Compose services.

- `docker compose config`
  Validates the deployed Compose configuration.

- `docker compose pull`
  Pulls newer images referenced by Compose.

- `docker compose build devbyte`
  Builds the DevByte image on EC2 from the deployed Dockerfile.

- `docker compose up -d postgres`
  Starts PostgreSQL and leaves it running in the background.

- `docker compose up -d devbyte`
  Starts the DevByte service in the background.

- `docker compose logs --tail 100 devbyte`
  Shows recent DevByte container logs.

- `docker compose logs -f devbyte`
  Follows DevByte logs continuously.

- `docker compose restart devbyte`
  Restarts the DevByte service after configuration or code changes.

- `docker compose down`
  Stops and removes the deployed Compose containers.

### EC2 Container Diagnostics

- `docker compose run --rm --entrypoint python3 devbyte --version`
  Confirms Python 3 exists in the EC2 DevByte image.

- `docker compose run --rm --entrypoint ffmpeg devbyte -version`
  Confirms FFmpeg exists in the EC2 DevByte image.

- `docker compose run --rm --entrypoint python3 devbyte -c "import os, shutil; print('Python:', shutil.which('python3')); print('FFmpeg:', shutil.which('ffmpeg')); print('Video:', os.path.isfile('data/worker_0/video.mp4')); print('FB token configured:', bool(os.getenv('FB_LONG_LIVED_TOKEN'))); print('FB page configured:', bool(os.getenv('FB_PAGE_ID'))); print('S3 bucket configured:', bool(os.getenv('S3_TEMP_BUCKET')))"`
  Checks the EC2 container runtime, video mount, and required Facebook/S3 configuration without revealing secrets.

### EC2 Upload Testing

- `docker compose run --rm --entrypoint python3 devbyte services/upload_facebook.py --video data/worker_0/video.mp4 --caption "DevByte AI Tool Spotlight"`
  Runs a one-time Facebook upload from EC2 using a temporary container.

- `docker compose run --rm --entrypoint python3 devbyte services/upload_instagram.py --video data/worker_0/video.mp4 --caption "DevByte AI Tool Spotlight"`
  Runs a one-time Instagram upload from EC2 using a temporary container.

- `docker compose run --rm --entrypoint python3 devbyte services/s3_temp_upload.py --file data/worker_0/video.mp4`
  Tests the EC2 container's S3 upload and presigned URL generation.

- `docker compose exec devbyte python3 services/upload_facebook.py --video data/worker_0/video.mp4 --caption "DevByte AI Tool Spotlight"`
  Runs the Facebook uploader inside an already running DevByte container.

### EC2 Networking and Processes

- `curl -I https://graph.facebook.com`
  Checks outbound HTTPS connectivity to the Meta Graph API.

- `curl -I https://s3.ap-south-1.amazonaws.com`
  Checks outbound HTTPS connectivity to the AWS S3 regional endpoint.

- `ps aux | grep -E 'node|python|ffmpeg' | grep -v grep`
  Lists active Node.js, Python, and FFmpeg processes.

- `top`
  Displays live CPU and memory usage on the EC2 instance.

- `docker stats`
  Displays live resource usage for running containers.

### EC2 Deployment and File Transfer

- `git pull --ff-only`
  Updates the deployed checkout without creating an automatic merge commit.

- `docker compose build --no-cache devbyte`
  Rebuilds the EC2 image from scratch after Dockerfile or dependency changes.

- `docker compose up -d --remove-orphans`
  Starts the updated stack and removes obsolete Compose services.

- `scp -i devbyte-server-key.pem .env ubuntu@<EC2_PUBLIC_IP>:~/Devbyte-Engine/.env`
  Copies the local environment file to EC2; use carefully because it contains secrets.

- `scp -i devbyte-server-key.pem data/worker_0/video.mp4 ubuntu@<EC2_PUBLIC_IP>:~/Devbyte-Engine/data/worker_0/video.mp4`
  Copies a local worker video to the EC2 project directory.

## PowerShell and Bash Notes

- PowerShell uses a backtick `` ` `` for multiline commands; Bash uses a backslash `\`.
- In PowerShell, the simplest option is usually to run Docker commands on one line.
- `docker compose exec` requires a running service; use `docker compose run --rm` for a one-time command.
- This Docker image installs `python3`, so use `--entrypoint python3` for Python commands inside the container.
- Never print token values while testing; check only whether required variables are configured.
- Rotate any secret that has been pasted into chat, logs, terminals, or source control.
