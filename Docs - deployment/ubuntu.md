# EC2 Instance Initial Session Summary

Good — you're already SSH'd into your EC2 instance. Let's go through each command and what its output is telling you.

---

## 1. `whoami` → Account Identity
* **Output:** `ubuntu`
* **Details:** Tells you which Linux user you're logged in as. 
* **Note:** AWS's default Ubuntu AMI creates a non-root user called `ubuntu` and gives it SSH access. You are never logged in as `root` directly, which is an intentional, safer default. You must use `sudo` when you need elevated permissions.

## 2. `pwd` → Current Location
* **Output:** `/home/ubuntu`
* **Details:** "Print working directory" — your current location in the filesystem. 
* **Note:** `/home/ubuntu` is this user's home directory and acts as the default landing spot after an SSH login.

## 3. `ls -la` → Directory Listing
* **Output:**
  ```text
  drwxr-x--- 4 ubuntu ubuntu 4096 Sep  6 11:28 .
  drwxr-xr-x 3 root   root   4096 Sep  5 21:31 ..
  -rw-r--r-- 1 ubuntu ubuntu  220 Mar 31  2024 .bash_logout
  -rw-r--r-- 1 ubuntu ubuntu 3771 Mar 31  2024 .bashrc
  drwx------ 2 ubuntu ubuntu 4096 Sep  6 11:28 .cache
  -rw-r--r-- 1 ubuntu ubuntu  807 Mar 31  2024 .profile
  drwx------ 2 ubuntu ubuntu 4096 Sep  5 21:31 .ssh
  ```

### Breakdown of Flags & Output
* **Flags:** `-a` shows hidden files (anything starting with a `.`), and `-l` shows the long format (permissions, owner, size, date).
* **Relative Directories:** 
  * `.` = this directory itself.
  * `..` = the parent directory (`/home`). Their owner (`root`) confirms `/home` itself is root-owned, even though your user folder inside it isn't.
* **Permissions Block:** `drwxr-x---` etc. The first character is the type (`d` = directory, `-` = file). The next 9 characters are permissions split into three groups of three: **owner / group / others**, with each group representing read/write/execute capabilities.
* **Shell Files:** `.bashrc` / `.profile` / `.bash_logout` are standard shell config files that auto-run when you log in or open a shell. Nothing DevByte-specific yet.
* **Cache:** `.cache` contains misc cached data from programs you've run.
* **SSH Directory:** `.ssh` is the critical folder. It holds your `authorized_keys` file, which lists the public keys allowed to SSH in as this user. Its permissions are strictly `drwx------` (only the owner can read/write/enter it). SSH will refuse to work if this folder is too permissive, as loose permissions here are a classic way to get locked out or compromised.

> **System Status:** There's nothing here related to Docker, your repo, or DevByte yet — this is a completely fresh instance. That's expected; you haven't installed anything.

---

## 4. `uname -a` → System & Kernel Info
* **Output:**
  ```text
  Linux ip-172-31-3-143 6.17.0-1017-aws #17~24.04.1-Ubuntu ... x86_64 x86_64 x86_64 GNU/Linux
  ```
* **Linux:** Kernel name.
* **ip-172-31-3-143:** The hostname AWS auto-assigned, derived from the instance's private IP (`172.31.3.143`). This is normal; it's not your public IP.
* **6.17.0-1017-aws:** Kernel version, featuring an `-aws`-specific build tuned by AWS for virtualization optimization.
* **24.04.1-Ubuntu:** Confirms you're running Ubuntu 24.04 LTS, which matches what your Dockerfile expects (Debian Bookworm-based, Node 22).
* **x86_64:** (Repeated three times for kernel/hardware/OS). Confirms a standard 64-bit Intel/AMD architecture, not ARM. 
* **Why this matters:** This is why your `t2.micro`/`t3.micro`-style x86 instance will pull the correct `@rspack/binding-linux-x64-gnu` native binary your Dockerfile explicitly installs. If this said `aarch64` (ARM, like Oracle's Ampere A1), that binding would be wrong and you'd hit the rspack bug again in a different way.

---

## 5. `free -h` → Memory Usage
* **Output:**
  ```text
                total        used        free      shared  buff/cache   available
  Mem:           7.6Gi       501Mi       6.8Gi       2.9Mi       559Mi       7.1Gi
  Swap:             0B          0B          0B
  ```
* **7.6Gi total RAM:** Tells you this is roughly a `t3.large`/`m5.large`-class instance (not the free-tier `t2.micro`, which only has 1GB). Worth double-checking your instance type/billing if you didn't intend this size.
* **used (501Mi):** Actively allocated memory right now. It is basically empty since you've installed nothing yet.
* **buff/cache:** Memory Linux is using to cache disk reads for speed. This is reclaimed automatically when a program needs it, so don't worry about it "eating" your RAM.
* **available (7.1Gi):** The realistic metric. This tracks how much RAM a new process could grab right now by accounting for reclaimable cache. This is the number that matters, not "free".
* **Swap (0B):** No swap space configured. 
* **Warning for later:** Your batch pipeline renders 5 videos in parallel via Chromium/Remotion, which is highly memory-hungry. If you run low on RAM under load with no swap, the OOM (Out Of Memory) killer will silently kill a process rather than slow down gracefully. Watch this once you're running full batches — you may want to add a swap file as insurance.

---

## 6. `df -h` → Disk Usage
* **Output:**
  ```text
  Filesystem       Size  Used Avail Use% Mounted on
  /dev/root         29G  1.9G   28G   7% /
  tmpfs            3.8G     0  3.8G   0% /dev/shm
  tmpfs            1.6G  1.1M  1.6G   1% /run
  tmpfs            5.0M     0  5.0M   0% /run/lock
  efivarfs         128K  3.1K  120K   3% /sys/firmware/efi/efivars
  /dev/nvme0n1p16  881M   94M  726M  12% /boot
  /dev/nvme0n1p15  105M  6.2M   99M   6% /boot/efi
  tmpfs            778M   12K  778M   1% /run/user/1000
  ```
* **`/dev/root` mounted at `/`:** This is your EBS volume. The core concept from the notes doc is now concrete: 29G total, 1.9G used, 28G free. This is where your Docker images, repo, and `data/logs/` directories will live once things are set up.
* **tmpfs entries:** RAM-backed virtual filesystems (temporary and wiped on reboot). These are used internally by the OS for things like `/dev/shm` (shared memory) and `/run` (runtime state) and are not managed directly by you.
* **`/boot` and `/boot/efi`:** Small partitions holding the kernel and EFI bootloader files. You will not need to touch these.
* **efivarfs:** UEFI firmware variables, irrelevant to your work.

---

## Bottom Line
You have a clean **x86_64 Ubuntu 24.04 EC2 instance** featuring **~7.6GB RAM**, **~28GB free disk space**, nothing pre-installed, and working SSH access. 

### Next Steps:
1. Install **Docker** + **Docker Compose**.
2. Clone your repository.
3. Mount your secrets according to your `docker-compose.yml` file.
