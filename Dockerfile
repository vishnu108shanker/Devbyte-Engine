# =============================================================================
# DevByte Engine V3 — Single-stage Dockerfile
# Base: node:18-bookworm (Debian 12 with Node 18 LTS)
# Adds: Python 3.11, FFmpeg, Chromium deps for Remotion rendering
# =============================================================================

FROM node:22-bookworm

# ---- 1. System packages (changes rarely → cached layer) --------------------
# Grouped by purpose:
#   - Python runtime (python3 = 3.11 on Bookworm)
#   - FFmpeg for media processing
#   - Chromium/Remotion shared library dependencies
#   - Fonts so subtitle/title text doesn't render with fallback glyphs
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    # Chromium runtime dependencies (from Remotion Docker guide for Bookworm)
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    libdrm2 \
    libx11-xcb1 \
    libxext6 \
    libxrender1 \
    libxinerama1 \
    libxi6 \
    libxtst6 \
    xdg-utils \
    # Fonts — at least one legible sans-serif family
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---- 2. Root Node dependencies (lockfile-first for layer caching) ----------
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- 3. Remotion renderer Node dependencies --------------------------------
# NOTE: We intentionally do NOT copy render/package-lock.json here.
# That lockfile is generated on the Windows host and only resolves
# Windows-specific optional native binaries (e.g. @rspack/binding-win32-x64-msvc),
# which breaks the Linux-native @rspack/binding-linux-x64-gnu resolution.
# Installing fresh inside the Linux container ensures correct native bindings.
COPY render/package.json ./render/
RUN cd render && rm -f package-lock.json && npm install

# ---- 4. Ensure Remotion's bundled Chromium is downloaded --------------------
RUN cd render && npx remotion browser ensure

# ---- 5. Python dependencies ------------------------------------------------
COPY requirements.txt ./
RUN pip install --break-system-packages --no-cache-dir -r requirements.txt

# ---- 6. Copy source code (everything not in .dockerignore) ------------------
COPY . .

# ---- 7. Create non-root user (Chromium should not run as root) --------------
RUN groupadd --gid 1001 devbyte \
    && useradd --uid 1001 --gid devbyte --shell /bin/bash --create-home devbyte \
    && chown -R devbyte:devbyte /app

USER devbyte

# ---- 8. Default entrypoint — the batch pipeline ----------------------------
CMD ["npm", "run", "batch"]
