/*
DOC NAME: supabase-backup-to-drive.mjs
LOCATION: /scripts/supabase-backup-to-drive.mjs
SCOPE: Weekly Supabase Postgres logical backup via pg_dump (pooler-compatible), upload to Google Drive folder, delete backups older than RETENTION_DAYS.
STATUS: UNLOCKED
*/

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { google } from "googleapis";

function mustEnv(name) {
	const v = process.env[name];
	if (!v) throw new Error(`Missing env var: ${name}`);
	return v;
}

function runPgDump({ host, port, db, user, password, outFile }) {
	return new Promise((resolve, reject) => {
		const args = [
			`--host=${host}`,
			`--port=${port}`,
			`--username=${user}`,
			`--dbname=${db}`,
			"--format=custom",
			"--blobs",
			"--verbose",
			"--no-password",
			`--file=${outFile}`,
		];

		const child = spawn("pg_dump", args, {
			env: { ...process.env, PGPASSWORD: password },
			stdio: "inherit",
		});

		child.on("error", reject);
		child.on("close", (code) => {
			if (code !== 0) return reject(new Error(`pg_dump exited with code ${code}`));
			return resolve();
		});
	});
}

async function getDriveClient() {
	const clientId = mustEnv("GOOGLE_OAUTH_CLIENT_ID");
	const clientSecret = mustEnv("GOOGLE_OAUTH_CLIENT_SECRET");
	const refreshToken = mustEnv("GOOGLE_OAUTH_REFRESH_TOKEN");
	const redirectUri = mustEnv("GOOGLE_OAUTH_REDIRECT_URI");

	const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
	oauth2.setCredentials({ refresh_token: refreshToken });

	return google.drive({ version: "v3", auth: oauth2 });
}

async function uploadToDrive(drive, folderId, filePath) {
	const fileName = path.basename(filePath);

	const res = await drive.files.create({
		requestBody: {
			name: fileName,
			parents: [folderId],
		},
		media: {
			mimeType: "application/octet-stream",
			body: fs.createReadStream(filePath),
		},
		fields: "id,name,createdTime",
	});

	return res.data;
}

function escapeDriveQueryValue(value) {
	// Google Drive query strings are quoted with single quotes; escape any embedded single quotes.
	return String(value).replace(/'/g, "\\'");
}

function isBackupFileName(name) {
	// Only delete backups created by this script.
	// Matches: supabase_<db>_<timestamp>.dump
	return /^supabase_.+_.+\.dump$/i.test(name ?? "");
}

// Deletes script backups in the folder older than retentionDays based on createdTime
async function retentionCleanup(drive, folderId, retentionDays) {
	const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

	let pageToken = undefined;
	let deleted = 0;

	const q = `'${escapeDriveQueryValue(folderId)}' in parents and trashed = false`;

	do {
		const list = await drive.files.list({
			q,
			fields: "nextPageToken, files(id,name,createdTime)",
			pageSize: 1000,
			pageToken,
		});

		for (const f of list.data.files ?? []) {
			if (!f.id || !f.name || !f.createdTime) continue;
			if (!isBackupFileName(f.name)) continue;

			const created = new Date(f.createdTime);
			if (Number.isNaN(created.getTime())) continue;

			if (created < cutoff) {
				await drive.files.delete({ fileId: f.id });
				deleted += 1;
				console.log(`Deleted old backup: ${f.name} (${f.createdTime})`);
			}
		}

		pageToken = list.data.nextPageToken ?? undefined;
	} while (pageToken);

	console.log(
		`Retention cleanup done. Deleted ${deleted} backup file(s) older than ${retentionDays} days.`
	);
}

async function main() {
	const host = mustEnv("SUPABASE_DB_HOST");
	const port = mustEnv("SUPABASE_DB_PORT");
	const db = mustEnv("SUPABASE_DB_NAME");
	const user = mustEnv("SUPABASE_DB_USER");
	const password = mustEnv("SUPABASE_DB_PASSWORD");

	const folderId = mustEnv("GOOGLE_DRIVE_BACKUP_FOLDER_ID");
	const retentionDays = Number(process.env.RETENTION_DAYS ?? "30");

	if (!Number.isFinite(retentionDays) || retentionDays < 0) {
		throw new Error(`RETENTION_DAYS must be a non-negative number. Got: ${process.env.RETENTION_DAYS}`);
	}

	const ts = new Date().toISOString().replace(/[:.]/g, "-");
	const outFile = path.join(os.tmpdir(), `supabase_${db}_${ts}.dump`);

	console.log(`Creating dump: ${outFile}`);
	await runPgDump({ host, port, db, user, password, outFile });

	const stat = fs.statSync(outFile);
	if (!stat.size) throw new Error("Dump file is empty.");

	console.log(`Dump size: ${stat.size} bytes`);

	const drive = await getDriveClient();

	console.log("Uploading to Google Drive...");
	const uploaded = await uploadToDrive(drive, folderId, outFile);
	console.log(`Uploaded: ${uploaded.name} (id: ${uploaded.id})`);

	console.log(`Applying retention cleanup: keep last ${retentionDays} days...`);
	await retentionCleanup(drive, folderId, retentionDays);

	// Remove local temp file
	fs.unlinkSync(outFile);
	console.log("Local temp file removed.");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
