import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from google.auth.exceptions import RefreshError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import services.upload as upload


class FakeCreds:
    def __init__(self, valid=True, expired=False, refresh_token="refresh"):
        self.valid = valid
        self.expired = expired
        self.refresh_token = refresh_token

    def refresh(self, request):
        raise RefreshError("stale refresh token")

    def to_json(self):
        return '{"token": "new"}'


class UploadAuthTests(unittest.TestCase):
    def test_refresh_error_triggers_fresh_authorization(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            token_path = Path(temp_dir) / "token.json"
            client_secrets_path = Path(temp_dir) / "client_secrets.json"
            client_secrets_path.write_text('{"installed": {"client_id": "x", "client_secret": "y", "redirect_uris": ["http://localhost"]}}', encoding="utf-8")

            with patch.object(upload, "TOKEN_PATH", token_path), patch.object(upload, "CLIENT_SECRETS_PATH", client_secrets_path):
                with patch.object(upload.Credentials, "from_authorized_user_file", return_value=FakeCreds()):
                    with patch.object(upload.InstalledAppFlow, "from_client_secrets_file") as flow_factory:
                        flow = type("Flow", (), {"run_local_server": lambda self, port=0: FakeCreds(valid=True, expired=False)})()
                        flow_factory.return_value = flow
                        with patch.object(upload, "build", return_value="service") as build_mock:
                            result = upload.authenticate_youtube()

            self.assertEqual(result, "service")
            build_mock.assert_called_once_with("youtube", "v3", credentials=unittest.mock.ANY)
            self.assertTrue(token_path.exists())
            self.assertEqual(token_path.read_text(encoding="utf-8"), '{"token": "new"}')


if __name__ == "__main__":
    unittest.main()
