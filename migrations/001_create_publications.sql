CREATE TABLE IF NOT EXISTS publications (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    event_type TEXT NOT NULL,
    candidate_snapshot JSONB NOT NULL
);

-- Index candidate_id for fast deduplication lookups
CREATE INDEX IF NOT EXISTS idx_publications_candidate_id ON publications(candidate_id);