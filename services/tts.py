import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import argparse
import subprocess
import time

from utils.logger import info, error, warning, success
from utils.file_utils import read_json
from utils.config import load_config

def generate_tts(text: str, voice: str, output_path: str, max_retries: int = 2):
    # Ensure output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    
    # Write text to temp file to avoid shell argument length issues
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write(text)
        temp_text_file = f.name
    
    try:
        cmd = ["edge-tts", "--file", temp_text_file, "--voice", voice, "--write-media", output_path]
        
        for attempt in range(max_retries + 1):
            try:
                info(f"Running edge-tts (Attempt {attempt + 1})...")
                # Use shell=False (the default) so the OS passes the arguments directly to the binary.
                # This prevents argument-dropping on Linux and preserves quotes/spaces properly.
                result = subprocess.run(cmd, capture_output=True, text=True, shell=False)
                
                if result.returncode == 0 and os.path.exists(output_path):
                    # Verify file is not empty
                    if os.path.getsize(output_path) > 0:
                        return True
                    else:
                        warning("edge-tts produced an empty file.")
                
                err_msg = result.stderr.strip() if result.stderr else "Unknown error"
                warning(f"edge-tts failed: {err_msg}")
                
            except Exception as e:
                warning(f"Failed to execute edge-tts: {str(e)}")
                
            if attempt < max_retries:
                info("Retrying TTS in 5 seconds due to failure or rate limiting...")
                time.sleep(5)
                
        error(f"Failed to generate TTS after {max_retries} attempts.")
        return False
    finally:
        # Clean up temp file
        if os.path.exists(temp_text_file):
            os.unlink(temp_text_file)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    
    config = load_config()
    voice = config.get("tts_voice", "en-US-ChristopherNeural")
    
    script_data = read_json(args.input)
    if not script_data:
        error(f"Could not read input file {args.input}")
        return
        
    hook = script_data.get("hook", "")
    body = script_data.get("body", "")
    cta = script_data.get("cta", "")
    
    if not hook or not body or not cta:
        error("Missing required script fields (hook, body, or cta).")
        raise ValueError("Missing fields")
        
    # Concatenate fields
    full_text = f"{hook} {body} {cta}"
    
    info(f"Generating TTS using voice '{voice}'...")
    success_tts = generate_tts(full_text, voice, args.output, max_retries=config.get("max_retries", 2))
    
    if success_tts:
        success(f"Audio successfully generated at {args.output}")
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
