from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from google_auth_oauthlib.flow import Flow

# Your Web client credentials
CLIENT_ID = ""
CLIENT_SECRET = ""
REDIRECT_URI = "http://localhost:3000/en/oauth2callback"

SCOPES = ["https://www.googleapis.com/auth/drive"]

authorization_code = None

class OAuthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global authorization_code
        parsed_path = urlparse(self.path)
        if parsed_path.path == "/en/oauth2callback":
            query_params = parse_qs(parsed_path.query)
            if "code" in query_params:
                authorization_code = query_params["code"][0]
                self.send_response(200)
                self.send_header("Content-type", "text/html")
                self.end_headers()
                self.wfile.write(b"<h1>Authentication successful! You can close this window and check VS Code.</h1>")
            else:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"<h1>Error: No code found in request.</h1>")
        else:
            self.send_response(404)
            self.end_headers()
            
    def log_message(self, format, *args):
        pass # Suppress default server logs in terminal

def main():
    client_config = {
        "web": {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }

    flow = Flow.from_client_config(client_config, SCOPES, redirect_uri=REDIRECT_URI)
    auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')

    print("\n" + "="*70)
    print("1. Open this link in your browser:")
    print("="*70)
    print(auth_url)
    print("="*70)
    print("\nWaiting for authentication callback on http://localhost:3000/en/oauth2callback ...")

    server = HTTPServer(("localhost", 3000), OAuthHandler)
    while authorization_code is None:
        server.handle_request()

    flow.fetch_token(code=authorization_code)
    creds = flow.credentials

    print("\n" + "="*40)
    print("SUCCESS! COPY YOUR REFRESH TOKEN BELOW:")
    print("="*40)
    print(f"GOOGLE_OAUTH_CLIENT_ID: {CLIENT_ID}")
    print(f"GOOGLE_OAUTH_CLIENT_SECRET: {CLIENT_SECRET}")
    print(f"GOOGLE_OAUTH_REFRESH_TOKEN: {creds.refresh_token}")
    print("="*40)

if __name__ == "__main__":
    main()