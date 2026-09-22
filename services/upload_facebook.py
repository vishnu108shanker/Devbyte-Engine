#!/usr/bin/env python3
"""upload_facebook.py

Upload a video to a Facebook Page using the Facebook Graph API.

The script supports two modes:
  A) Standalone: pass --video and it handles S3 upload/cleanup itself.
  B) Shared URL: pass --video-url (presigned S3 URL) to skip S3 upload.
     Optionally pass --s3-bucket and --s3-key so this script can delete
     the temporary S3 object after a successful upload.

Usage:
    # Standalone (own S3 lifecycle)
    python services/upload_facebook.py --video /path/to/video.mp4 --caption "Hello"

    # Shared URL from orchestrator
    python services/upload_facebook.py --video /path/to/video.mp4 \
        --video-url "https://s3...presigned" \
        --s3-bucket my-bucket --s3-key meta_uploads/xyz.mp4 \
        --caption "Hello"

Required environment variables (add to .env):
    FB_PAGE_ID              – Numeric Facebook Page ID.
    FB_LONG_LIVED_TOKEN     – Page access token (long-lived) with
                              pages_manage_posts and pages_read_engagement.
    S3_TEMP_BUCKET          – S3 bucket name for temporary uploads.
    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
    AWS_DEFAULT_REGION

The script returns exit code 0 on success and prints the Facebook video ID.
"""

import argparse
import os
import sys
import time
import uuid

import boto3
import requests
from botocore.exceptions import ClientError

# Load .env if present (helps local development)
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# ---------------------------------------------------------------------------
# Helper functions (S3)
# ---------------------------------------------------------------------------

def get_env(name, required=True):
    val = os.getenv(name)
    if required and not val:
        sys.stderr.write(f"Missing required environment variable: {name}\n")
        sys.exit(1)
    return val

def upload_to_s3(file_path, bucket, object_name):
    s3 = boto3.client('s3')
    try:
        s3.upload_file(file_path, bucket, object_name)
    except ClientError as e:
        sys.stderr.write(f"S3 upload failed: {e}\n")
        sys.exit(1)
    return object_name

def generate_presigned_url(bucket, object_name, expires=7200):
    s3 = boto3.client('s3')
    try:
        url = s3.generate_presigned_url(
            ClientMethod='get_object',
            Params={'Bucket': bucket, 'Key': object_name},
            ExpiresIn=expires,
        )
        return url
    except ClientError as e:
        sys.stderr.write(f"Presigned URL generation failed: {e}\n")
        sys.exit(1)

def delete_s3_object(bucket, object_name):
    s3 = boto3.client('s3')
    try:
        s3.delete_object(Bucket=bucket, Key=object_name)
    except ClientError as e:
        sys.stderr.write(f"Warning: could not delete temporary S3 object: {e}\n")

# ---------------------------------------------------------------------------
# Facebook Graph API helpers
# ---------------------------------------------------------------------------

def create_video_upload(token, page_id, video_url, caption):
    """POST to /{page_id}/videos to create a video upload.
    Returns the video ID from the API response.
    """
    endpoint = f"https://graph.facebook.com/v19.0/{page_id}/videos"
    payload = {
        'file_url': video_url,
        'description': caption,
        'access_token': token,
    }
    r = requests.post(endpoint, data=payload)
    if not r.ok:
        sys.stderr.write(f"Failed to create video upload: {r.text}\n")
        sys.exit(1)
    return r.json().get('id')

def poll_processing_status(token, video_id, timeout=300, interval=5):
    """Poll the video's status until ready.
    Returns True on success, False on error/timeout.
    """
    endpoint = f"https://graph.facebook.com/v19.0/{video_id}"
    params = {'fields': 'status', 'access_token': token}
    elapsed = 0
    while elapsed < timeout:
        r = requests.get(endpoint, params=params)
        if not r.ok:
            sys.stderr.write(f"Processing status poll error: {r.text}\n")
            sys.exit(1)
        data = r.json()
        status = data.get('status', {})
        # The status field is an object with a 'video_status' key
        video_status = status.get('video_status', '')
        if video_status == 'ready':
            return True
        if video_status == 'error':
            sys.stderr.write(f"Facebook reported an error processing the video: {status}\n")
            return False
        time.sleep(interval)
        elapsed += interval
    sys.stderr.write('Timed out waiting for Facebook video processing\n')
    return False

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Upload video to Facebook Page')
    parser.add_argument('--video', required=True, help='Path to video file')
    parser.add_argument('--caption', default='', help='Caption / description for the video')
    parser.add_argument('--video-url', dest='video_url', default=None,
                        help='Pre-existing presigned S3 URL (skip S3 upload)')
    parser.add_argument('--s3-bucket', dest='s3_bucket', default=None,
                        help='S3 bucket to clean up (used with --video-url)')
    parser.add_argument('--s3-key', dest='s3_key', default=None,
                        help='S3 object key to delete after success (used with --video-url)')
    args = parser.parse_args()

    token = get_env('FB_LONG_LIVED_TOKEN')
    page_id = get_env('FB_PAGE_ID')
    bucket = get_env('S3_TEMP_BUCKET')

    if not os.path.isfile(args.video):
        sys.stderr.write(f"Video file not found: {args.video}\n")
        sys.exit(1)

    # Determine video URL and S3 cleanup responsibility
    if args.video_url:
        # Shared mode: URL provided by the orchestrator
        video_url = args.video_url
        cleanup_bucket = args.s3_bucket
        cleanup_key = args.s3_key
    else:
        # Standalone mode: do our own S3 upload
        obj_key = f"facebook_uploads/{uuid.uuid4()}{os.path.splitext(args.video)[1]}"
        upload_to_s3(args.video, bucket, obj_key)
        video_url = generate_presigned_url(bucket, obj_key)
        cleanup_bucket = bucket
        cleanup_key = obj_key

    # Create video upload on Facebook Page
    video_id = create_video_upload(token, page_id, video_url, args.caption)
    if not video_id:
        sys.stderr.write('Failed to obtain video ID from Facebook\n')
        sys.exit(1)

    # Poll processing status
    if not poll_processing_status(token, video_id):
        sys.stderr.write('Video processing failed or timed out\n')
        sys.exit(1)

    # Cleanup S3 object (best effort)
    if cleanup_bucket and cleanup_key:
        delete_s3_object(cleanup_bucket, cleanup_key)

    print(f"\u2705 Facebook video uploaded successfully. Video ID: {video_id}")
    sys.exit(0)

if __name__ == '__main__':
    main()
