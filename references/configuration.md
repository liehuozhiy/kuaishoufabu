# Configuration

Create `kuaishou.config.json` in the working directory:

```json
{
  "videoDirectory": "C:\\path\\to\\videos",
  "cleanedDirectory": "C:\\path\\to\\cleaned-videos",
  "workDirectory": "C:\\path\\to\\publisher-state",
  "startDate": "2026-07-13",
  "times": ["07:00", "12:00", "18:00"],
  "timezone": "Asia/Shanghai",
  "publishUrl": "https://cp.kuaishou.com/article/publish/video",
  "browserExecutable": "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "ffmpegPath": "C:\\path\\to\\ffmpeg.exe",
  "ffprobePath": "C:\\path\\to\\ffprobe.exe",
  "headless": false,
  "live": false,
  "rollingDays": 12,
  "defaultTopics": ["快手舞蹈", "快手热点", "我要上热门"],
  "maxRetries": 3
}
```

`workDirectory` contains the browser profile, mutable queue, logs, and screenshots. Keep it outside the skill and outside Git. `cleanedDirectory` must differ from `videoDirectory`.

The filename convention may start with a numeric prefix such as `22_title.mp4`. The queue sorts this prefix numerically and derives captions from the title and `@topic(...)` segments.

`rollingDays` is the number of future days currently selectable in Kuaishou. Determine it with a dry run; do not assume it is permanent.
