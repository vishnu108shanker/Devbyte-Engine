import argparse
import json
import os
import sys
from psycopg.types.json import Jsonb

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from database_layer.python.connection import get_connection


def parse_args():
    parser = argparse.ArgumentParser(description="Migrate history.json records into PostgreSQL 'publications' table.")
    parser.add_argument("--file", default=os.path.join(PROJECT_ROOT, "data", "history.json"), help="Path to history.json file (default: data/history.json)")
    return parser.parse_args()


def migrate():
    args = parse_args()
    json_path = os.path.abspath(args.file)

    if not os.path.exists(json_path):
        print(f"❌ History file not found at: {json_path}")
        sys.exit(1)

    print(f"📖 Reading source history from: {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        try:
            history = json.load(f)
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse JSON file {json_path}: {e}")
            sys.exit(1)

    if not isinstance(history, list) or len(history) == 0:
        print("ℹ️ History file is empty or contains no array items. Nothing to migrate.")
        return

    print("🔌 Connecting to PostgreSQL through the DevByte database layer...")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                inserted_count = 0
                skipped_count = 0

                for item in history:
                    candidate_id = item.get("id") or item.get("candidate_id") or "unknown"
                    published_at = item.get("published_at", "1970-01-01T00:00:00Z")
                    event_type = item.get("event_type", "update")

                    cur.execute(
                        """
                        SELECT 1 FROM publications
                        WHERE candidate_id = %s AND published_at = %s
                        """,
                        (candidate_id, published_at)
                    )
                    if cur.fetchone():
                        skipped_count += 1
                        continue

                    cur.execute(
                        """
                        INSERT INTO publications (candidate_id, published_at, event_type, candidate_snapshot)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (candidate_id, published_at, event_type, Jsonb(item))
                    )
                    inserted_count += 1

                conn.commit()
                print(f"✅ Migration complete! Inserted: {inserted_count} | Skipped (already existed): {skipped_count}")

    except Exception as e:
        print(f"❌ Migration failed with error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    migrate()
