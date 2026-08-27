"""
Scoring functions for candidate evaluation.
Importable module — no CLI. Imported by evaluator.py.
Uses exact formulas from Architecture.md scoring formula section.
"""

import datetime


def calculate_freshness_score(released_at):
    """Score based on how recently the tool was released/announced."""
    try:
        released_dt = datetime.datetime.fromisoformat(released_at.replace("Z", "+00:00"))
        now = datetime.datetime.now(datetime.timezone.utc)
        days_ago = (now - released_dt).days

        if days_ago < 7:
            return 40
        elif days_ago < 30:
            return 25
        elif days_ago < 90:
            return 10
        else:
            return 0
    except (ValueError, AttributeError):
        return 0


def calculate_popularity_score(raw_count):
    """Normalize popularity to 0-30 range. Sources without data get 10."""
    if raw_count is None or raw_count == 0:
        return 10  # default for sources without popularity data
    return min(30, raw_count // 100)


def calculate_source_trust_score(source_tier):
    """Score based on source reliability tier."""
    if source_tier == 1:
        return 20
    elif source_tier == 2:
        return 15
    elif source_tier == 3:
        return 10
    return 0


def calculate_quality_score(candidate, cross_source_count=1):
    """Score based on data completeness and cross-source validation."""
    score = 0

    if candidate.get("competitors") and len(candidate["competitors"]) > 0:
        score += 10

    if candidate.get("use_cases") and len(candidate["use_cases"]) > 0:
        score += 10

    if candidate.get("target_audience") and candidate["target_audience"].strip():
        score += 5

    # Cross-source validation bonus
    if cross_source_count >= 2:
        score += 15

    return score


def calculate_confidence(candidate, cross_source_count=1):
    """Calculate confidence score from 0.0 to 1.0."""
    confidence = 0.0

    summary = candidate.get("summary", "")
    if summary and len(summary.split()) > 20:
        confidence += 0.40  # Increased base confidence for good summaries

    website = candidate.get("website", "")
    if website and website.startswith("https://"):
        confidence += 0.25

    if cross_source_count >= 2:
        confidence += 0.30

    return min(1.0, confidence)


def calculate_total_score(candidate, raw_count=0, cross_source_count=1, editor_score=50):
    """Calculate composite score from all scoring dimensions, weighted by Gemini editor score."""
    freshness = calculate_freshness_score(candidate.get("released_at", ""))
    popularity = calculate_popularity_score(raw_count)
    trust = calculate_source_trust_score(candidate.get("source_tier", 3))
    quality = calculate_quality_score(candidate, cross_source_count)

    base_score = freshness + popularity + trust + quality
    
    # Scale score proportionally by the editor's video-worthiness rating (editor_score / 100.0)
    return int(base_score * (editor_score / 100.0))
