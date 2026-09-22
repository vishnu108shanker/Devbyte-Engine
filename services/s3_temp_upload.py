#!/usr/bin/env python3
"""s3_temp_upload.py

Helper to manage temporary S3 video assets for multi-platform distribution.

Operations:
1. Upload & Presign:
   python services/s3_temp_upload.py --file /path/to/video.mp4
   Output: {"presigned_url": "...", "bucket": "...", "key": "..."}

2. Delete / Cleanup:
   python services/s3_temp_upload.py --delete --key meta_uploads/...mp4
   Output: {"deleted": true, "key": "..."}

Required environment variables:
    S3_TEMP_BUCKET
    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
    AWS_DEFAULT_REGION
"""

import argparse
import json
import os
import sys
import uuid

import boto3
from botocore.exceptions import ClientError

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass


def main():
    parser = argparse.ArgumentParser(description='Manage temporary S3 video assets for Meta platforms')
    parser.add_argument('--file', help='Path to the local file to upload')
    parser.add_argument('--prefix', default='meta_uploads', help='S3 key prefix (default: meta_uploads)')
    parser.add_argument('--delete', action='store_true', help='Delete the specified S3 object')
    parser.add_argument('--key', help='S3 object key to delete')
    args = parser.parse_args()

    bucket = os.getenv('S3_TEMP_BUCKET')
    if not bucket:
        sys.stderr.write('Missing required env var: S3_TEMP_BUCKET\n')
        sys.exit(1)

    s3 = boto3.client('s3')

    # Case 1: Delete S3 object
    if args.delete:
        if not args.key:
            sys.stderr.write('Missing required argument --key for delete operation\n')
            sys.exit(1)
        try:
            s3.delete_object(Bucket=bucket, Key=args.key)
            print(json.dumps({'deleted': True, 'key': args.key}))
            sys.exit(0)
        except ClientError as e:
            sys.stderr.write(f'Warning: could not delete S3 object {args.key}: {e}\n')
            sys.exit(1)

    # Case 2: Upload file and generate presigned URL
    if not args.file:
        sys.stderr.write('Missing required argument: --file or --delete\n')
        sys.exit(1)

    if not os.path.isfile(args.file):
        sys.stderr.write(f'File not found: {args.file}\n')
        sys.exit(1)

    obj_key = f"{args.prefix}/{uuid.uuid4()}{os.path.splitext(args.file)[1]}"

    try:
        s3.upload_file(args.file, bucket, obj_key)
    except ClientError as e:
        sys.stderr.write(f'S3 upload failed: {e}\n')
        sys.exit(1)

    try:
        presigned_url = s3.generate_presigned_url(
            ClientMethod='get_object',
            Params={'Bucket': bucket, 'Key': obj_key},
            ExpiresIn=7200,
        )
    except ClientError as e:
        sys.stderr.write(f'Presigned URL generation failed: {e}\n')
        sys.exit(1)

    # Print JSON to stdout for the orchestrator to parse
    result = {
        'presigned_url': presigned_url,
        'bucket': bucket,
        'key': obj_key,
    }
    print(json.dumps(result))
    sys.exit(0)


if __name__ == '__main__':
    main()
