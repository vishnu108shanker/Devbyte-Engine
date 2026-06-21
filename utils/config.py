import json
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(PROJECT_ROOT, 'config.json')

REQUIRED_KEYS = [
    "source",
    "tts_voice",
    "max_word_count",
    "max_retries",
    "subprocess_timeout_seconds",
    "output_dir"
]

def load_config() -> dict:
    if not os.path.exists(CONFIG_PATH):
        raise ValueError(f"Config file not found at {CONFIG_PATH}")
        
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        config = json.load(f)
        
    for key in REQUIRED_KEYS:
        if key not in config:
            raise ValueError(f"Missing required config key: {key}")
            
    return config

if __name__ == "__main__":
    import pprint
    print("Loading config...")
    config = load_config()
    pprint.pprint(config)
