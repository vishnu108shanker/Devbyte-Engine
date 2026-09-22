#!/usr/bin/env python3
"""upload_instagram.py

Upload a video to Instagram Reels using the Instagram Graph API.

The script:
1. Reads required configuration from environment variables (or a .env file).
2. Uploads the local video file to an S3 bucket specified by `S3_TEMP_BUCKET`.
3. Generates a presigned GET URL (valid ~2 h) which Instagram can fetch.
4. Creates a media container via the Graph API, then publishes it.
5. Polls the publishing status until it succeeds or fails.
6. Deletes the temporary S3 object.

Usage (inside the DevByte Docker container):

    python services/upload_instagram.py --video /path/to/video.mp4 \
        --caption "My awesome video"

Required environment variables (add them to `.env` which is mounted into the container):
    META_LONG_LIVED_TOKEN   – Instagram Graph API access token (long‑lived).
    INSTAGRAM_ACCOUNT_ID    – Instagram Business Account ID.
    S3_TEMP_BUCKET          – S3 bucket name for temporary uploads.
    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
    AWS_DEFAULT_REGION

The script returns exit code 0 on success and prints the Instagram media ID.
"""

import argparse
import os
import sys
import time
import uuid
from urllib.parse import urlparse, unquote

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
# Helper functions
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

def create_media_container(token, ig_id, video_url, caption):
    endpoint = f"https://graph.facebook.com/v19.0/{ig_id}/media"
    payload = {
        'media_type': 'REELS',
        'video_url': video_url,
        'caption': caption,
        'access_token': token,
    }
    r = requests.post(endpoint, data=payload)
    if not r.ok:
        sys.stderr.write(f"Failed to create media container: {r.text}\n")
        sys.exit(1)
    return r.json().get('id')

def publish_media(token, ig_id, container_id):
    endpoint = f"https://graph.facebook.com/v19.0/{ig_id}/media_publish"
    payload = {'creation_id': container_id, 'access_token': token}
    r = requests.post(endpoint, data=payload)
    if not r.ok:
        sys.stderr.write(f"Failed to publish media: {r.text}\n")
        sys.exit(1)
    return r.json().get('id')

def poll_status(token, media_id, timeout=300, interval=5):
    endpoint = f"https://graph.facebook.com/v19.0/{media_id}"
    params = {'fields': 'status_code', 'access_token': token}
    elapsed = 0
    while elapsed < timeout:
        r = requests.get(endpoint, params=params)
        if not r.ok:
            sys.stderr.write(f"Status poll error: {r.text}\n")
            sys.exit(1)
        status = r.json().get('status_code')
        if status == 'FINISHED':
            return True
        if status == 'ERROR':
            sys.stderr.write('Instagram reported an error processing the video\n')
            return False
        time.sleep(interval)
        elapsed += interval
    sys.stderr.write('Timed out waiting for Instagram processing\n')
    return False

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Upload video to Instagram Reels')
    parser.add_argument('--video', required=True, help='Path to video file')
    parser.add_argument('--caption', default='', help='Caption for the Reel')
    parser.add_argument('--video-url', dest='video_url', default=None,
                        help='Pre-existing presigned S3 URL (skip S3 upload)')
    parser.add_argument('--no-cleanup', dest='no_cleanup', action='store_true',
                        help='Skip S3 object deletion (let a later step clean up)')
    args = parser.parse_args()

    token = get_env('META_LONG_LIVED_TOKEN')
    ig_id = get_env('INSTAGRAM_ACCOUNT_ID')
    bucket = get_env('S3_TEMP_BUCKET')

    if not os.path.isfile(args.video):
        sys.stderr.write(f"Video file not found: {args.video}\n")
        sys.exit(1)

    # If a presigned URL was supplied, skip the S3 upload entirely
    if args.video_url:
        video_url = args.video_url
        obj_key = None  # nothing to clean up on our side
    else:
        # Unique S3 key
        obj_key = f"instagram_uploads/{uuid.uuid4()}{os.path.splitext(args.video)[1]}"
        # Upload & presign
        upload_to_s3(args.video, bucket, obj_key)
        video_url = generate_presigned_url(bucket, obj_key)

    # Create container
    container_id = create_media_container(token, ig_id, video_url, args.caption)
    # Wait until container is ready before publishing
    if not poll_status(token, container_id):
        sys.stderr.write('Container not ready for publishing\n')
        sys.exit(1)
    # Publish media
    media_id = publish_media(token, ig_id, container_id)
    # Cleanup temporary S3 object (best effort) — unless told not to
    if obj_key and not args.no_cleanup:
        delete_s3_object(bucket, obj_key)
    # Report success
    print(f"✅ Instagram Reel uploaded successfully. Media ID: {media_id}")
    sys.exit(0)

if __name__ == '__main__':
    main()
