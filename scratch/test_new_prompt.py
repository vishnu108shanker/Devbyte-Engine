import os
import json
import subprocess
import time

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HISTORY_FILE = os.path.join(PROJECT_ROOT, "data", "history.json")
TEMP_INPUT = os.path.join(PROJECT_ROOT, "data", "test_input.json")
TEMP_SCRIPT = os.path.join(PROJECT_ROOT, "data", "test_script.json")
TEMP_AUDIO = os.path.join(PROJECT_ROOT, "data", "test_audio.mp3")
GEMINI_SVC = os.path.join(PROJECT_ROOT, "services", "gemini.py")
TTS_SVC = os.path.join(PROJECT_ROOT, "services", "tts.py")

def main():
    if not os.path.exists(HISTORY_FILE):
        print("No history.json found.")
        return

    with open(HISTORY_FILE, "r", encoding="utf-8") as f:
        history = json.load(f)

    print(f"Loaded {len(history)} items from history.")
    
    # Take the last 3 items for testing
    test_items = history[-3:]
    
    for i, item in enumerate(test_items):
        print(f"\n--- Testing Candidate {i+1}: {item.get('name')} ---")
        
        # Write temp input
        with open(TEMP_INPUT, "w", encoding="utf-8") as f:
            json.dump(item, f, indent=2)
            
        print("Running Gemini Scriptwriter...")
        try:
            subprocess.run(["python", GEMINI_SVC, "--input", TEMP_INPUT, "--output", TEMP_SCRIPT], check=True)
        except subprocess.CalledProcessError as e:
            print(f"Gemini failed: {e}")
            continue
            
        # Check script
        if not os.path.exists(TEMP_SCRIPT):
            print("No script generated.")
            continue
            
        with open(TEMP_SCRIPT, "r", encoding="utf-8") as f:
            script_data = json.load(f)
            
        print(f"Title: {script_data.get('title')}")
        print(f"Hook: {script_data.get('hook')}")
        print(f"Body: {script_data.get('body')}")
        print(f"CTA: {script_data.get('cta')}")
        print(f"Word Count: {script_data.get('word_count')}")
        
        print("\nRunning Edge TTS...")
        try:
            # Note: tts.py usually takes the validated script, but it can read directly if keys match
            subprocess.run(["python", TTS_SVC, "--input", TEMP_SCRIPT, "--output", TEMP_AUDIO], check=True)
            if os.path.exists(TEMP_AUDIO):
                size_mb = os.path.getsize(TEMP_AUDIO) / (1024 * 1024)
                print(f"TTS Audio successfully generated: {size_mb:.2f} MB")
            else:
                print("Audio file not found after TTS.")
        except subprocess.CalledProcessError as e:
            print(f"TTS failed: {e}")
            
        time.sleep(2)

if __name__ == "__main__":
    main()
