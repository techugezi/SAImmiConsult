/* DOC NAME: googleDriveClient.ts
   LOCATION: /src/lib/googleDriveClient.ts
   SCOPE: Server-only Google Drive API client (single OAuth actor via refresh token).
   STATUS: UNLOCKED (lock after approved)
   AUDIT:
   - Removed ALL console logging (no warn/info/error in prod).
   - No sensitive values (tokens/folder ids/links) are ever logged.
   - Exposed a lightweight, non-logging readiness flag (`isGoogleDriveReady`) for callers to gate behavior.
   - PROD: Hardened env handling (trim/blank → null) to prevent false “ready” states.
*/

import "server-only";

import { google } from "googleapis";

function envValue(v: string | undefined): string | null {
	const s = (v ?? "").trim();
	return s ? s : null;
}

const GOOGLE_OAUTH_CLIENT_ID = envValue(process.env.GOOGLE_OAUTH_CLIENT_ID);
const GOOGLE_OAUTH_CLIENT_SECRET = envValue(process.env.GOOGLE_OAUTH_CLIENT_SECRET);
const GOOGLE_OAUTH_REDIRECT_URI = envValue(process.env.GOOGLE_OAUTH_REDIRECT_URI);
const GOOGLE_OAUTH_REFRESH_TOKEN = envValue(process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
const GOOGLE_DRIVE_ROOT_FOLDER_ID = envValue(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);

export const isGoogleDriveReady = Boolean(
	GOOGLE_OAUTH_CLIENT_ID &&
	GOOGLE_OAUTH_CLIENT_SECRET &&
	GOOGLE_OAUTH_REDIRECT_URI &&
	GOOGLE_OAUTH_REFRESH_TOKEN,
);

export const oauth2Client = new google.auth.OAuth2(
	GOOGLE_OAUTH_CLIENT_ID ?? undefined,
	GOOGLE_OAUTH_CLIENT_SECRET ?? undefined,
	GOOGLE_OAUTH_REDIRECT_URI ?? undefined,
);

if (GOOGLE_OAUTH_REFRESH_TOKEN) {
	oauth2Client.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN });
}

export const drive = google.drive({
	version: "v3",
	auth: oauth2Client,
});

export const DRIVE_ROOT_FOLDER_ID = GOOGLE_DRIVE_ROOT_FOLDER_ID;
