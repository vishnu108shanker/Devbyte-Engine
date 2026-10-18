#!/usr/bin/env python3
"""utils/schedule_utils.py

Shared scheduling utilities for DevByte Engine publish services (YouTube, Meta, etc.).
Generates random daytime release times (e.g. 10:00 AM - 8:00 PM) or parses explicit
schedule timestamps, converting between ISO-8601 UTC and Unix Epoch seconds.
"""

import os
import random
import datetime
from typing import Optional, Tuple


def parse_schedule_time(val: Optional[str]) -> Optional[datetime.datetime]:
    """Parse an arbitrary timestamp string (unix epoch, ISO-8601, or standard date).
    Returns a timezone-aware datetime object, or None if invalid/empty.
    """
    if not val:
        return None
    val = val.strip()

    # 1. Try unix timestamp (integer or float)
    try:
        ts = float(val)
        return datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc)
    except ValueError:
        pass

    # 2. Try ISO-8601 (e.g. 2026-10-19T14:30:00Z)
    try:
        clean_iso = val.replace('Z', '+00:00')
        dt = datetime.datetime.fromisoformat(clean_iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt
    except ValueError:
        pass

    # 3. Try common readable date formats
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d'):
        try:
            dt = datetime.datetime.strptime(val, fmt)
            local_tz = datetime.datetime.now().astimezone().tzinfo
            return dt.replace(tzinfo=local_tz)
        except ValueError:
            pass

    return None


def get_random_daytime_schedule(
    start_hour: Optional[int] = None,
    end_hour: Optional[int] = None,
    min_lead_minutes: int = 25
) -> datetime.datetime:
    """Computes a random datetime during daytime hours (e.g. 10:00 AM - 8:00 PM).
    If the current time has already passed today's daytime window (or is within
    min_lead_minutes of closing), it automatically picks a random daytime slot for tomorrow.
    """
    if start_hour is None:
        start_hour = int(os.getenv('SCHEDULE_START_HOUR', 10))
    if end_hour is None:
        end_hour = int(os.getenv('SCHEDULE_END_HOUR', 20))

    now = datetime.datetime.now().astimezone()

    earliest_today = now + datetime.timedelta(minutes=min_lead_minutes)
    latest_today = now.replace(hour=end_hour, minute=59, second=59, microsecond=0)

    # Check if there is still a daytime window remaining today
    if earliest_today < latest_today and earliest_today.hour <= end_hour:
        eff_start = max(start_hour, earliest_today.hour)
        if eff_start <= end_hour:
            rand_hour = random.randint(eff_start, end_hour)
            if rand_hour == earliest_today.hour:
                start_min = min(earliest_today.minute, 55)
                rand_minute = random.randint(start_min, 59)
            else:
                rand_minute = random.randint(0, 59)
            candidate = now.replace(hour=rand_hour, minute=rand_minute, second=0, microsecond=0)
            if candidate >= earliest_today:
                return candidate

    # Schedule for tomorrow during peak daytime hours
    tomorrow = now + datetime.timedelta(days=1)
    rand_hour = random.randint(start_hour, end_hour)
    rand_minute = random.randint(0, 59)
    return tomorrow.replace(hour=rand_hour, minute=rand_minute, second=0, microsecond=0)


def resolve_schedule(
    schedule_arg: bool = False,
    schedule_time_val: Optional[str] = None
) -> Tuple[Optional[str], Optional[int], Optional[str]]:
    """Resolves scheduling intent from arguments or environment variable AUTO_SCHEDULE_POSTS.

    Returns:
        (iso_utc, epoch_sec, readable_str) or (None, None, None) if not scheduled.
    """
    # 1. Check if a specific time string was provided
    if schedule_time_val:
        dt = parse_schedule_time(schedule_time_val)
        if dt:
            utc_dt = dt.astimezone(datetime.timezone.utc)
            return (
                utc_dt.strftime('%Y-%m-%dT%H:%M:%SZ'),
                int(dt.timestamp()),
                dt.strftime('%Y-%m-%d %I:%M %p %Z')
            )

    # 2. Check if scheduling was requested via flag or env var
    auto_env = os.getenv('AUTO_SCHEDULE_POSTS', '').strip().lower() in ('1', 'true', 'yes')
    if schedule_arg or auto_env:
        dt = get_random_daytime_schedule()
        utc_dt = dt.astimezone(datetime.timezone.utc)
        return (
            utc_dt.strftime('%Y-%m-%dT%H:%M:%SZ'),
            int(dt.timestamp()),
            dt.strftime('%Y-%m-%d %I:%M %p %Z')
        )

    return None, None, None
