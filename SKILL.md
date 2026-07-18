---
name: kuaishoufabu
description: Prepare local video batches and automate Kuaishou Creator scheduled publishing with metadata inspection/cleaning, numeric filename ordering, persistent browser login, upload-completion verification, rolling date-window scheduling, retries, logs, and resumable queues. Use when Codex needs to clean generated-video container metadata, publish many videos to Kuaishou at fixed daily times, recover a stopped batch, or maintain a rolling Kuaishou schedule.
---

# Kuaishou Fabu

Use the bundled Node scripts for deterministic execution. Work on copies of videos and keep the live flag off until a dry run succeeds.

## Workflow

1. Read [references/configuration.md](references/configuration.md).
2. Create `kuaishou.config.json` in the user's project directory. Never store credentials or cookies in the skill folder.
3. In `scripts/`, run `npm install`.
4. Inspect metadata with `ffprobe`. If the user requests cleaning for editing/privacy, run `node clean-video-metadata.js` and verify every output.
5. Run `node init-queue.js` to build a numerically ordered queue.
6. Run `node login.js`; let the user complete login or CAPTCHA. Never automate authentication challenges.
7. Keep `live: false` and test one item:
   `node schedule-batch.js --dry-run --rolling --limit=1`.
8. Confirm the selected video, caption, date, and time from the screenshot/log.
9. Set `live: true` only after the user authorizes actual publishing. Submit one live item first and verify it appears in Kuaishou's scheduled queue.
10. Submit the currently eligible window with `node schedule-batch.js --rolling`.
11. Register `register-rolling-task.ps1` only when Kuaishou's date picker limits future dates. The task adds newly eligible items; Kuaishou still performs the timed publication.

## Reliability rules

- Treat `重新上传` as an editor-ready signal, not proof that upload finished.
- Require upload text/progress to disappear and remain stable for five seconds before publishing.
- Stop on the first ambiguous submission result; do not mark an item scheduled without a success signal.
- Persist queue state after every successful submission.
- Resume only items whose status is `pending`.
- Disable the rolling task and set `live: false` immediately when the user reports wrong or deleted posts.
- Preserve originals during metadata cleaning and verify outputs with `ffprobe`.
- Expect Kuaishou UI selectors and future-date limits to change. Re-run a dry test after site changes.

## Commands

Run commands from the user's project directory and point `KUAISHOU_CONFIG` at the config file when it is not named `kuaishou.config.json`.

```powershell
node <skill>/scripts/clean-video-metadata.js
node <skill>/scripts/init-queue.js
node <skill>/scripts/login.js
node <skill>/scripts/schedule-batch.js --dry-run --rolling --limit=1
node <skill>/scripts/schedule-batch.js --rolling
node <skill>/scripts/doctor.js
```
