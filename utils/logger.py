import logging
import os
import sys

# Force UTF-8 encoding for standard output on Windows to support emojis
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

# Compute the absolute path to the logs directory, regardless of cwd
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_FILE = os.path.join(PROJECT_ROOT, 'logs', 'pipeline.log')

# Configure file logging
logger = logging.getLogger('devbyte_pipeline')
logger.setLevel(logging.INFO)

# Prevent adding multiple handlers if module is re-imported
if not logger.handlers:
    # Ensure logs directory exists
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    
    file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%dT%H:%M:%SZ')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

def info(msg: str):
    """Log an info message."""
    print(f"✅ {msg}")
    logger.info(msg)

def error(msg: str):
    """Log an error message."""
    print(f"❌ {msg}", file=sys.stderr)
    logger.error(msg)

def warning(msg: str):
    """Log a warning message."""
    print(f"⚠️ {msg}")
    logger.warning(msg)

def success(msg: str):
    """Log a success message."""
    print(f"🎉 {msg}")
    logger.info(f"SUCCESS: {msg}")

if __name__ == "__main__":
    # Self-test when executed directly
    info("This is an info message")
    warning("This is a warning message")
    error("This is an error message")
    success("This is a success message")
