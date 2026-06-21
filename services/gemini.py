import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import argparse
import datetime
import json
import time
import google.generativeai as genai

from utils.logger import info, error, warning, success
from utils.file_utils import read_json, write_json
from utils.config import load_config

def get_script_from_gemini(repo_data: dict, max_retries: int) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
        api_key = os.environ.get("GEMINI_API_KEY")
        
    if not api_key:
        error("GEMINI_API_KEY environment variable is not set")
        return None
        
    genai.configure(api_key=api_key)
    # Using 2.5 flash because 1.5 flash was deprecated
    model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"response_mime_type": "application/json"})
    
    prompt = f"""
    You are a professional YouTube Shorts scriptwriter for a tech channel.
    Create a highly engaging, fast-paced script for the following GitHub repository.
    
    Repository: {repo_data.get('title')}
    Summary: {repo_data.get('summary')}
    Language: {repo_data.get('metadata', {}).get('language', 'Unknown')}
    Stars: {repo_data.get('metadata', {}).get('metric_value', 'Unknown')}
    
    Requirements:
    1. Hook: 15-20 words. Must be incredibly engaging.
    2. Body: 40-50 words. Explain what it is and why developers should care.
    3. CTA: 10-15 words. Ask them to subscribe or check the comments.
    
    Output strictly as a JSON object with exactly these keys:
    {{
        "hook": "string",
        "body": "string",
        "cta": "string",
        "word_count": integer
    }}
    """
    
    for attempt in range(max_retries + 1):
        try:
            info(f"Calling Gemini API (Attempt {attempt + 1})...")
            response = model.generate_content(prompt)
            result = json.loads(response.text)
            
            # Augment with our architecture required fields
            result["source_title"] = repo_data.get("title", "")
            result["source_url"] = repo_data.get("url", "")
            result["generated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
            
            # Add fields to satisfy both architecture and output schema contracts
            result["title"] = repo_data.get("title", "")
            result["raw_script"] = f"{result['hook']} {result['body']} {result['cta']}"
            
            return result
        except Exception as e:
            if attempt < max_retries:
                warning(f"Gemini API call failed, retrying in 10s... ({str(e)})")
                time.sleep(10)
            else:
                error(f"Gemini API failed after {max_retries} retries: {str(e)}")
                return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    
    config = load_config()
    
    data = read_json(args.input)
    if not data or not isinstance(data, list) or len(data) == 0:
        error(f"Invalid or empty input array in {args.input}")
        return
        
    repo_data = data[0]
    info(f"Generating script for: {repo_data.get('title')}")
    
    script_data = get_script_from_gemini(repo_data, max_retries=config.get("max_retries", 2))
    
    if not script_data:
        error("Failed to generate script.")
        return
        
    success("Script successfully generated via Gemini API")
    write_json(args.output, script_data)

if __name__ == "__main__":
    main()
