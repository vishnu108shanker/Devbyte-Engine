import sys
import os
import argparse
import datetime
import json
import time
from google import genai
from google.genai import types

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, error, warning, success
from utils.file_utils import read_json, write_json
from utils.config import load_config

def load_prompt_template(category: str) -> str:
    prompt_path = os.path.join(PROJECT_ROOT, "editorial", "prompts", f"{category}.txt")
    if not os.path.exists(prompt_path):
        warning(f"Prompt file not found for category '{category}'. Falling back to free_alternative.")
        prompt_path = os.path.join(PROJECT_ROOT, "editorial", "prompts", "free_alternative.txt")
    
    with open(prompt_path, 'r', encoding='utf-8') as f:
        return f.read()

def inject_variables(prompt: str, tool_data: dict) -> str:
    # Available variables: {name}, {summary}, {pricing}, {website}, {use_cases}, {target_audience}, {competitors}, {event_type}
    replacements = {
        "{name}": tool_data.get("name", ""),
        "{summary}": tool_data.get("summary", ""),
        "{pricing}": tool_data.get("pricing", ""),
        "{website}": tool_data.get("website", ""),
        "{use_cases}": ", ".join(tool_data.get("use_cases", [])),
        "{target_audience}": tool_data.get("target_audience", ""),
        "{competitors}": ", ".join(tool_data.get("competitors", [])),
        "{event_type}": tool_data.get("event_type", "")
    }
    
    for key, val in replacements.items():
        prompt = prompt.replace(key, str(val))
    return prompt

def get_script_from_gemini(tool_data: dict, max_retries: int) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
        api_key = os.environ.get("GEMINI_API_KEY")
        
    if not api_key:
        error("GEMINI_API_KEY environment variable is not set")
        return None
        
    client = genai.Client(api_key=api_key)
    
    category = tool_data.get("category", "free_alternative")
    raw_prompt = load_prompt_template(category)
    enriched_prompt = inject_variables(raw_prompt, tool_data)
    
    models_to_try = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite']
    
    for model_name in models_to_try:
        for attempt in range(max_retries + 1):
            try:
                info(f"Calling Gemini API with {model_name} (Attempt {attempt + 1})...")
                response = client.models.generate_content(
                    model=model_name,
                    contents=enriched_prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                    )
                )
                result = json.loads(response.text)
                
                # Validate all required output fields exist
                required_fields = ["hook", "body", "cta", "word_count", "title", "description", "hashtags", "thumbnail_text", "pinned_comment"]
                for field in required_fields:
                    if field not in result:
                        raise ValueError(f"Missing required field in Gemini output: {field}")
                
                # Augment with our architecture required fields
                result["source_title"] = tool_data.get("name", "")
                result["source_url"] = tool_data.get("website", "")
                result["category"] = tool_data.get("category", "")
                result["generated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
                
                # Add raw_script for downstream compatibility
                result["raw_script"] = f"{result['hook']} {result['body']} {result['cta']}"
                
                return result
            except Exception as e:
                if attempt < max_retries:
                    warning(f"Gemini API call failed with {model_name}, retrying in 10s... ({str(e)})")
                    time.sleep(10)
                else:
                    warning(f"{model_name} failed after {max_retries} retries: {str(e)}. Falling back to next model...")
                    break # Try the next model
                    
    error("All models failed. Pipeline halted.")
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    
    config = load_config()
    
    # Input is now a single object (selected_tool.json), not an array of trending repos
    data = read_json(args.input)
    if not data or not isinstance(data, dict):
        error(f"Invalid or empty input object in {args.input}")
        return
        
    info(f"Generating script for selected tool: {data.get('name')}")
    
    script_data = get_script_from_gemini(data, max_retries=config.get("max_retries", 2))
    
    if not script_data:
        error("Failed to generate script.")
        sys.exit(1)
        
    success("Script successfully generated via Gemini API")
    write_json(args.output, script_data)

if __name__ == "__main__":
    main()
