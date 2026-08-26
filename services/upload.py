import os
import json
import argparse
from google.auth.exceptions import RefreshError
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/youtube.upload']
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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
                print("Stored YouTube credentials are no longer valid. Starting a fresh authorization flow...")
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

def main():
    parser = argparse.ArgumentParser(description="Upload a video to YouTube.")
    parser.add_argument('--video', default='data/video.mp4', help='Path to the video file.')
    parser.add_argument('--script', default='data/script.json', help='Path to the script JSON file.')
    args = parser.parse_args()

    if not os.path.exists(args.video):
        print(f"Error: Video file not found at {args.video}")
        return
    
    if not os.path.exists(args.script):
        print(f"Error: Script file not found at {args.script}")
        return

    print("Authenticating with YouTube API...")
    youtube = authenticate_youtube()

    print("Reading metadata...")
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

    # Prepare the video file
    media = MediaFileUpload(args.video, chunksize=-1, resumable=True, mimetype='video/mp4')

    print(f"Uploading '{title}' (Private)...")
    request = youtube.videos().insert(
        part=','.join(body.keys()),
        body=body,
        media_body=media
    )

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"Uploaded {int(status.progress() * 100)}%")

    print("\nUpload Successful!😘")
    print(f"Video ID: {response['id']}")
    print(f"YouTube URL: https://youtu.be/{response['id']}")

if __name__ == '__main__':
    main()
