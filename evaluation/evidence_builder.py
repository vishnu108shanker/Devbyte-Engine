import datetime
import urllib.parse
from datetime import timezone
import re

SOURCE_LABELS = {
    "openai_blog": "OpenAI Official Blog",
    "google_blog": "Google AI Official Blog",
    "aws_blog": "AWS Official Blog",
    "nvidia_blogs": "NVIDIA Official Blog/Newsroom",
    "ibm_allpressrelease": "IBM Press Releases & Announcements",
    "hackernews": "Hacker News (Community Discussion & Voting)",
    "product_hunt": "Product Hunt (Community Launch & Upvotes)",
    "github_releases": "GitHub Official Releases",
}

def extract_root_domain(url):
    """Extract clean root domain (e.g. 'nvidia.com') from URL."""
    try:
        netloc = urllib.parse.urlparse(url).netloc.replace("www.", "").lower()
        parts = netloc.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return netloc
    except Exception:
        return ""

def normalize_title_for_comparison(title):
    """Normalize a title for fuzzy cross-source detection."""
    title = title.lower().strip()
    title = re.sub(r'[^\w\s]', '', title)
    return re.sub(r'\s+', ' ', title)

def compute_cross_source_coverage(candidates):
    """
    Detect multi-source coverage across candidates.
    Matches by:
    1. Exact target domain (if non-generic)
    2. Significant title token overlap (for stories covered by different publishers)
    Returns: dict mapping candidate id -> number of distinct sources covering it
    """
    # Exclude generic platforms from domain matching
    generic_domains = {"github.com", "ycombinator.com", "producthunt.com", "medium.com", "substack.com", "arxiv.org", "youtube.com", "twitter.com", "x.com"}

    domain_to_sources = {}
    for c in candidates:
        domain = extract_root_domain(c.get("website", ""))
        source = c.get("source", "unknown")
        if domain and domain not in generic_domains:
            if domain not in domain_to_sources:
                domain_to_sources[domain] = set()
            domain_to_sources[domain].add(source)

    counts = {}
    for c in candidates:
        cid = c.get("id")
        domain = extract_root_domain(c.get("website", ""))
        sources_set = set()
        if domain and domain in domain_to_sources:
            sources_set.update(domain_to_sources[domain])
        else:
            sources_set.add(c.get("source", "unknown"))

        # Check title overlap with other candidates from different sources
        c_title_norm = normalize_title_for_comparison(c.get("name", ""))
        c_words = set(w for w in c_title_norm.split() if len(w) > 3)
        if len(c_words) >= 3:
            for other in candidates:
                if other.get("id") == cid or other.get("source") == c.get("source"):
                    continue
                o_title_norm = normalize_title_for_comparison(other.get("name", ""))
                o_words = set(w for w in o_title_norm.split() if len(w) > 3)
                overlap = len(c_words.intersection(o_words))
                if overlap >= 3 and (overlap / min(len(c_words), len(o_words))) >= 0.6:
                    sources_set.add(other.get("source", "unknown"))

        counts[cid] = max(1, len(sources_set))

    return counts

def compute_days_ago(released_at):
    """Compute days since released_at ISO-8601 timestamp."""
    if not released_at:
        return None
    try:
        released_dt = datetime.datetime.fromisoformat(released_at.replace("Z", "+00:00"))
        if released_dt.tzinfo is None:
            released_dt = released_dt.replace(tzinfo=timezone.utc)
        now = datetime.datetime.now(timezone.utc)
        diff = (now - released_dt).total_seconds() / 86400.0
        return max(0, int(diff))
    except Exception:
        return None

def build_candidate_evidence(candidate, cross_source_count=1):
    """
    Construct structured factual evidence for a candidate.
    Signals are formatted as objective facts for the LLM editor, NOT arbitrary points.
    """
    released_at = candidate.get("released_at", "")
    days_ago = compute_days_ago(released_at)

    source = candidate.get("source", "unknown")
    source_label = SOURCE_LABELS.get(source, f"{source.replace('_', ' ').title()}")

    # Format popularity signals as facts (None if source doesn't provide them)
    hn_points = candidate.get("_hn_points")
    github_stars = candidate.get("_github_stars")
    ph_upvotes = candidate.get("_ph_upvotes")

    evidence = {
        "days_ago": days_ago if days_ago is not None else "unknown",
        "is_today": days_ago == 0 if days_ago is not None else False,
        "is_this_week": days_ago is not None and days_ago <= 7,
        "hn_points": hn_points if hn_points is not None and hn_points > 0 else None,
        "github_stars": github_stars if github_stars is not None and github_stars > 0 else None,
        "ph_upvotes": ph_upvotes if ph_upvotes is not None and ph_upvotes > 0 else None,
        "source": source,
        "source_label": source_label,
        "cross_source_count": cross_source_count,
        "independently_reported": cross_source_count >= 2,
        "event_type": candidate.get("event_type", "other"),
        "summary_word_count": len(candidate.get("summary", "").split()),
        "has_competitors": bool(candidate.get("competitors") and len(candidate["competitors"]) > 0),
        "has_use_cases": bool(candidate.get("use_cases") and len(candidate["use_cases"]) > 0),
        "has_target_audience": bool(candidate.get("target_audience", "").strip()),
    }

    candidate["evidence"] = evidence
    return candidate
