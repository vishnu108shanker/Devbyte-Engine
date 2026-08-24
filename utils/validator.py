import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import argparse
import datetime

from utils.logger import info, error, warning, success
from utils.file_utils import read_json, write_json
from utils.config import load_config

def strip_non_ascii(text: str) -> str:
    """Strip emojis and non-ASCII characters."""
    if not text:
        return ""
    return text.encode('ascii', 'ignore').decode('ascii').strip()

def validate_script(script_data: dict, max_word_count: int) -> dict:
    """Validates the script and strips non-ascii characters."""
    # Verify required fields
    required_fields = ["hook", "body", "cta"]
    for field in required_fields:
        if field not in script_data or not script_data[field]:
            raise ValueError(f"Missing or empty required field: {field}")
            
    # Clean strings and calculate exact word count
    hook = strip_non_ascii(script_data["hook"])
    body = strip_non_ascii(script_data["body"])
    cta = strip_non_ascii(script_data["cta"])
    
    total_words = len(hook.split()) + len(body.split()) + len(cta.split())
    
    if total_words > max_word_count:
        raise ValueError(f"Word count {total_words} exceeds maximum allowed ({max_word_count})")
        
    # Update script data with cleaned strings
    script_data["hook"] = hook
    script_data["body"] = body
    script_data["cta"] = cta
    script_data["word_count"] = total_words
    script_data["raw_script"] = f"{hook} {body} {cta}"
    
    script_data["validated"] = True
    script_data["validated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    
    return script_data

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    
    config = load_config()
    max_words = config.get("max_word_count", 110)
    
    script_data = read_json(args.input)
    if not script_data:
        error(f"Could not read input file {args.input}")
        return
        
    info(f"Validating script against max_word_count={max_words}...")
    
    try:
        validated_data = validate_script(script_data, max_words)
    except ValueError as e:
        error(f"Validation failed: {str(e)}")
        # Do not write output on validation failure
        return
        
    success("Script validated successfully")
    write_json(args.output, validated_data)

if __name__ == "__main__":
    main()
