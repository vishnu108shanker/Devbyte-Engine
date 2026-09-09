Good — you're already SSH'd into your EC2 instance. Let's go through each command and what its output is telling you.
whoami → ubuntu
Tells you which Linux user you're logged in as. AWS's default Ubuntu AMI creates a non-root user called ubuntu and gives it SSH access — you're never logged in as root directly, which is intentional (safer default; you use sudo when you need elevated permissions).
pwd → /home/ubuntu
"Print working directory" — your current location in the filesystem. /home/ubuntu is this user's home directory, the default landing spot after SSH login.
ls -la — directory listing
drwxr-x--- 4 ubuntu ubuntu 4096 Sep  6 11:28 .
drwxr-xr-x 3 root   root   4096 Sep  5 21:31 ..
-rw-r--r-- 1 ubuntu ubuntu  220 Mar 31  2024 .bash_logout
-rw-r--r-- 1 ubuntu ubuntu 3771 Mar 31  2024 .bashrc
drwx------ 2 ubuntu ubuntu 4096 Sep  6 11:28 .cache
-rw-r--r-- 1 ubuntu ubuntu  807 Mar 31  2024 .profile
drwx------ 2 ubuntu ubuntu 4096 Sep  5 21:31 .ssh

-a shows hidden files (anything starting with .), -l shows the long format (permissions, owner, size, date).
. = this directory itself, .. = the parent directory (/home). Their owner (root) confirms /home itself is root-owned even though your user folder inside it isn't.
drwxr-x--- etc. — first character is the type (d = directory, - = file), the next 9 characters are permissions in three groups of three: owner / group / others, each group being read/write/execute.
.bashrc / .profile / .bash_logout — standard shell config files, auto-run when you log in or open a shell. Nothing DevByte-specific yet.
.cache — misc cached data from programs you've run.
.ssh — this is the important one. It holds your authorized_keys file, which is the list of public keys allowed to SSH in as this user. Its permissions are drwx------ (only the owner can read/write/enter it) — SSH refuses to work if this folder is too permissive, since loose permissions here are a classic way to get locked out or compromised.
There's nothing here related to Docker, your repo, or DevByte yet — this is a completely fresh instance. That's expected; you haven't installed anything.
uname -a — system/kernel info
Linux ip-172-31-3-143 6.17.0-1017-aws #17~24.04.1-Ubuntu ... x86_64 x86_64 x86_64 GNU/Linux

Linux — kernel name.
ip-172-31-3-143 — the hostname AWS auto-assigned, derived from the instance's private IP (172.31.3.143). This is normal; it's not your public IP.
6.17.0-1017-aws — kernel version, with an -aws-specific build (AWS ships a kernel variant tuned for their virtualization).
24.04.1-Ubuntu — confirms you're on Ubuntu 24.04 LTS, which matches what your Dockerfile expects (Debian Bookworm-based, Node 22).
x86_64 (three times, for kernel/hardware/OS) — confirms a standard 64-bit Intel/AMD architecture, not ARM. This matters: it's why your t2.micro/t3.micro-style x86 instance will pull the correct @rspack/binding-linux-x64-gnu native binary your Dockerfile explicitly installs — if this said aarch64 (ARM, like Oracle's Ampere A1), that binding would be wrong and you'd hit the rspack bug again in a different way.
free -h — memory usage
              total        used        free      shared  buff/cache   available
Mem:           7.6Gi       501Mi       6.8Gi       2.9Mi       559Mi       7.1Gi
Swap:             0B          0B          0B

7.6Gi total RAM — tells you this is roughly a t3.large/m5.large-class instance (not the free-tier t2.micro, which only has 1GB). Worth double-checking your instance type/billing if you didn't intend this size.
used (501Mi) — actively allocated memory right now, basically nothing since you've installed nothing yet.
buff/cache — memory Linux is using to cache disk reads for speed; this is reclaimed automatically when a program needs it, so don't worry about it "eating" your RAM.
available (7.1Gi) — the realistic number: how much RAM a new process could get right now, accounting for reclaimable cache. This is the number that matters, not free.
Swap: 0B — no swap space configured. Worth noting for later: your batch pipeline renders 5 videos in parallel via Chromium/Remotion, which is memory-hungry. If you run low on RAM under load with no swap, the OOM killer will silently kill a process rather than slow down gracefully. Something to watch once you're running full batches — you may want to add a swap file as insurance.
df -h — disk usage
Filesystem       Size  Used Avail Use% Mounted on
/dev/root         29G  1.9G   28G   7% /
tmpfs            3.8G     0  3.8G   0% /dev/shm
tmpfs            1.6G  1.1M  1.6G   1% /run
tmpfs            5.0M     0  5.0M   0% /run/lock
efivarfs         128K  3.1K  120K   3% /sys/firmware/efi/efivars
/dev/nvme0n1p16  881M   94M  726M  12% /boot
/dev/nvme0n1p15  105M  6.2M   99M   6% /boot/efi
tmpfs            778M   12K  778M   1% /run/user/1000

/dev/root mounted at / — this is your EBS volume, the one concept from the notes doc that's now concrete: 29G total, 1.9G used, 28G free. This is where Docker images, your repo, and data//logs/ will all live once you set things up.
tmpfs entries — RAM-backed virtual filesystems (temporary, wiped on reboot), used internally by the OS for things like /dev/shm (shared memory) and /run (runtime state). Not something you manage directly.
/boot and /boot/efi — small partitions holding the kernel and EFI bootloader files. Not something you'll touch.
efivarfs — UEFI firmware variables, irrelevant to your work.
Bottom line from this whole session: you have a clean x86_64 Ubuntu 24.04 EC2 instance, ~7.6GB RAM, ~28GB free disk, nothing installed yet, SSH access working correctly. Next real step is installing Docker + Docker Compose, then cloning the repo and mounting your secrets per docker-compose.yml.

