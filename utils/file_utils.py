import os
import sys
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import error

def get_absolute_path(path: str) -> str:
    """Ensure path is absolute, resolving relative to cwd if necessary."""
    if os.path.isabs(path):
        return path
    return os.path.join(os.getcwd(), path)

def file_exists(path: str) -> bool:
    return os.path.exists(get_absolute_path(path))

def read_json(path: str):
    abs_path = get_absolute_path(path)
    if not os.path.exists(abs_path):
        error(f"File not found: {abs_path}")
        return None
    try:
        with open(abs_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        error(f"Failed to read JSON from {abs_path}: {str(e)}")
        return None

def write_json(path: str, data) -> None:
    abs_path = get_absolute_path(path)
    directory = os.path.dirname(abs_path)
    if directory and not os.path.exists(directory):
        try:
            os.makedirs(directory, exist_ok=True)
        except Exception as e:
            error(f"Failed to create directory {directory}: {str(e)}")
            return
            
    try:
        with open(abs_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        error(f"Failed to write JSON to {abs_path}: {str(e)}")

if __name__ == "__main__":
    print("file_utils loaded successfully.")
