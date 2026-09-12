import os
import json
import sys
import argparse
import subprocess
from google.auth.exceptions import RefreshError
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from utils.logger import info, error, warning

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/youtube.upload']
TOKEN_PATH = os.path.join(PROJECT_ROOT, 'token.json')
CLIENT_SECRETS_PATH = os.path.join(PROJECT_ROOT, 'client_secrets.json')


def authenticate_youtube():
    """Authenticates the user and returns the YouTube service."""
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first time.
    if os.path.isdir(TOKEN_PATH):
        raise RuntimeError(
            f"OAuth token path is a directory: {TOKEN_PATH}. "
            "Remove that directory and create an empty token.json file."
        )

    if os.path.exists(TOKEN_PATH):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
        except Exception:
            creds = None
            if os.path.exists(TOKEN_PATH):
                with open(TOKEN_PATH, 'w', encoding='utf-8') as token:
                    token.write('{}')

    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except RefreshError:
                print("😅🤡Stored YouTube credentials are no longer valid. Starting a fresh authorization flow...")
                creds = None
                if os.path.exists(TOKEN_PATH):
                    with open(TOKEN_PATH, 'w', encoding='utf-8') as token:
                        token.write('{}')

        if not creds or not creds.valid:
            if not os.path.exists(CLIENT_SECRETS_PATH):
                print("Error: 'client_secrets.json' not found.")
                print("Please download it from the Google Cloud Console and place it in the project root.")
                exit(1)

            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)

        # Save the credentials for the next run
        with open(TOKEN_PATH, 'w', encoding='utf-8') as token:
            token.write(creds.to_json())

    return build('youtube', 'v3', credentials=creds)

def extract_thumbnail(video_path, output_path, timestamp="0.02"):
    """Extracts a frame from the video at the given timestamp using ffmpeg."""
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(timestamp),
        "-i", video_path,
        "-frames:v", "1",
        "-q:v", "2",
        output_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg thumbnail extraction failed: {result.stderr.strip()}")

def main():
    parser = argparse.ArgumentParser(description="Upload a video to YouTube.")
    parser.add_argument('--video', default='data/video.mp4', help='Path to the video file.')
    parser.add_argument('--script', default='data/script.json', help='Path to the script JSON file.')
    parser.add_argument('--thumbnail-time', default='0.02', help='Timestamp (in seconds) to extract thumbnail from video.')
    parser.add_argument('--skip-thumbnail', action='store_true', help='Skip extracting and setting a custom video thumbnail.')
    args = parser.parse_args()

    if not os.path.exists(args.video):
        error(f"Video file not found at {args.video}")
        return
    
    if not os.path.exists(args.script):
        error(f"Script file not found at {args.script}")
        return

    info("Authenticating with YouTube API...")
    youtube = authenticate_youtube()

    info("Reading metadata...")
    with open(args.script, 'r', encoding='utf-8') as f:
        script_data = json.load(f)
    
    title = script_data.get('title', 'Generated Short')
    description = script_data.get('description', '')
    hashtags = script_data.get('hashtags', [])
    source_url = script_data.get('source_url', '')
    
    # Append the website link to the description
    if source_url:
        description = f"{description}\n\n🔗 Website: {source_url}"
        
    # Append hashtags to the end of the description
    if hashtags:
        formatted_hashtags = " ".join([f"#{tag}" for tag in hashtags])
        description = f"{description}\n\n{formatted_hashtags}"

    # YouTube metadata body
    body = {
        'snippet': {
            'title': title,
            'description': description,
            # 'categoryId': '28', # 28 = Science & Technology (Optional)
        },
        'status': {
            'privacyStatus': 'private', # Upload as private by default
            'selfDeclaredMadeForKids': False
        }
    }

    # Prepare the video file with 2MB chunking for optimal throughput & network stability
    media = MediaFileUpload(args.video, chunksize=2 * 1024 * 1024, resumable=True, mimetype='video/mp4')

    info(f"Starting YouTube Upload: '{title}' (Private)...")
    request = youtube.videos().insert(
        part=','.join(body.keys()),
        body=body,
        media_body=media
    )

    response = None
    last_pct = -1
    while response is None:
        status, response = request.next_chunk()
        if status:
            pct = int(status.progress() * 100)
            if pct != last_pct and (pct % 20 == 0 or pct == 100):
                info(f"YouTube Upload Progress: {pct}%")
                last_pct = pct

    video_id = response.get('id', '')
    info(f"✅ YouTube Upload Successful! Video ID: {video_id} | URL: https://youtu.be/{video_id}")

    if not args.skip_thumbnail and video_id:
        video_dir = os.path.dirname(os.path.abspath(args.video))
        thumbnail_path = os.path.join(video_dir, 'thumbnail.jpg')
        try:
            info(f"Extracting thumbnail from '{args.video}' at {args.thumbnail_time}s...")
            extract_thumbnail(args.video, thumbnail_path, timestamp=args.thumbnail_time)

            info(f"Uploading thumbnail to YouTube for video {video_id}...")
            thumb_media = MediaFileUpload(thumbnail_path, mimetype='image/jpeg')
            youtube.thumbnails().set(
                videoId=video_id,
                media_body=thumb_media
            ).execute()
            info("✅ Video thumbnail set successfully!")
        except HttpError as http_err:
            warning(f"⚠️ Could not set thumbnail via YouTube API (HttpError {http_err.resp.status}): {http_err}. "
                    "Ensure your channel has phone verification (intermediate features) enabled.")
        except Exception as e:
            warning(f"⚠️ Failed to extract or set thumbnail: {e}")

if __name__ == '__main__':
    main()
