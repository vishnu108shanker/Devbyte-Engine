# The Publishing Architecture (V1)

## Philosophy: Strict Separation of Concerns
The DevByte Engine follows a rigorous separation between **Generation** and **Publishing**.
The generation pipeline (`run_pipeline.js`) is solely responsible for creating content. It knows nothing about YouTube or APIs.
The publishing pipeline (`services/upload.py`) is solely responsible for distribution. It knows nothing about rendering or scripting.

By keeping these systems decoupled, we can eventually swap rendering tools, change AI providers, or add TikTok/Instagram upload scripts without breaking the core engine.

---

## How `upload.py` Works

At exactly 85 lines of code, `upload.py` is an intentionally thin wrapper around the official YouTube Data API v3. 

### 1. Inputs
The script takes zero active arguments by default. It looks specifically for two files produced by the Generation Pipeline:
- **`data/video.mp4`**: The final rendered short.
- **`data/script.json`**: The Content Package (which includes metadata, hashtags, and description).

### 2. Authentication (OAuth 2.0)
The script uses the standard Google OAuth 2.0 desktop flow.
1. It looks for an existing `token.json` file.
2. If `token.json` is missing or expired, it looks for `client_secrets.json` in the root folder.
3. It opens a local web server (`port=0`) and prompts the user's browser to authenticate with Google.
4. Once authenticated, Google returns an access token which is saved to `token.json`.
*This means the browser will only ever pop up on the very first run.*

### 3. Metadata Extraction
The script opens `data/script.json` and extracts:
- `title`
- `description`
- `hashtags`

It dynamically formats the hashtags (e.g., `#AITools #Tech`) and appends them to the bottom of the video description.

### 4. Upload Execution
The script builds a `MediaFileUpload` request pointing to `video.mp4` using a `resumable=True` chunking method. This allows large files to upload reliably even on spotty connections.

**Privacy Status:** The upload is hardcoded to `'privacyStatus': 'private'`. This ensures that you can review the video on your phone or in YouTube Studio before manually making it public.

### 5. Output
The script prints the progress chunk-by-chunk. Once YouTube returns a `200 OK` response with a video ID, the script prints:
```text
Upload Successful!
Video ID: {id}
YouTube URL: https://youtu.be/{id}
```

---

## Future Scope
In upcoming iterations (V2+), the Publishing Architecture could be expanded to include:
- Scheduled unlisting/publishing (via YouTube API scheduling scopes).
- Applying custom thumbnails (`thumbnail_text` is already generated in `script.json`).
- Automatically pinning the affiliate link comment to the top of the video (requires a separate API call using the generated Video ID).
- Uploading to secondary platforms like Instagram Reels and TikTok.
