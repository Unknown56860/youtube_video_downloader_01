import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { buildVideoInfo, downloadJob, pollJob, cleanupDownloadFolders } from "./utils/func.js";
// import { mockResults, mockResults2 } from "./utils/mockData.js";

const PORT = 3000;

const BASE_PATH = import.meta.dirname;
const YT_DLP_PATH = path.resolve(BASE_PATH, "../.venv/Scripts/yt-dlp.exe");
const DOWNLOAD_FILES_PATH = path.resolve(BASE_PATH, "./downloads");

const PATHS = { BASE_PATH, YT_DLP_PATH, DOWNLOAD_FILES_PATH };

const VIDEO_INFO = "/video-info";
const PREPARE_DOWNLOAD = "/prepare-download";
const DOWNLOAD_PROGRESS = "/download-progress/:id";
const EXPOSE_FILES = "/download-file/:downloadId/:filename";

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 50 hours

const jobs = new Map();

const execFileAsync = promisify(execFile);

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static((path.join(BASE_PATH, "public"))));

app.post(VIDEO_INFO, async (req, res) => {
    let { url } = req.body;
    console.log(`[Request] - Metadata for "${url}"`);
    return res.json(mockResults2);
    try {
        const parsed = new URL(url);
        const videoId = parsed.searchParams.get("v");
        if (videoId) { url = `https://youtu.be/${videoId}`; }
        const { stdout } = await execFileAsync(
            YT_DLP_PATH,
            ["--dump-single-json", "--ignore-errors", "--js-runtimes", "node", url],
            { maxBuffer: 1024 * 1024 * 100 }
        );
        const data = JSON.parse(stdout);
        const results = [];
        if (Array.isArray(data.entries)) {
            for(const entry of data.entries) { results.push(buildVideoInfo(entry)); }
        }
        else { results.push(buildVideoInfo(data)); }
        // console.log(JSON.stringify(results, null, 2));
        return res.json(results);
    }
    catch (err) {
        console.error("[Error] - Metadata extraction failure:", err);
        return res.status(500).json({error: "Video/s not found"});
    }
});

app.post(PREPARE_DOWNLOAD, (req, res) => {
    try {
        const queue = req.body;
        console.log(`[Request] - Received download request with ${queue.videoQueue.length} video/s.`);
        const requestId = crypto.randomUUID();
        jobs.set(requestId, {status: "queued", queue: queue});
        downloadJob(requestId, jobs, PATHS);
        res.json({ downloadId: requestId });
    }
    catch(err) {
        console.error("[Error] - Download failure:", err); 
        return res.status(500).json({error: "Failed to start download"});
    }
});

app.get(DOWNLOAD_PROGRESS, (req, res) => {
    const { id } = req.params;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    pollJob(jobs.get(id), res);
    res.on("close", () => {
        console.log("[Info] - Closing event stream for", id);
        jobs.delete(id); res.end();
    });
});

app.get(EXPOSE_FILES, (req, res) => {
    const { downloadId, filename } = req.params;
    console.log(`[Request] - DownloadId: ${downloadId}, File: ${filename}`);
    const filePath = path.resolve(DOWNLOAD_FILES_PATH, downloadId, filename);
    // const filePath = path.resolve(DOWNLOAD_FILES_PATH, filename);
    if (!filePath.startsWith(path.resolve(DOWNLOAD_FILES_PATH))) {
        return res.status(400).json({ error: "Invalid filename" });
    }
    res.download(filePath, err => {
        if(err) { 
            console.error("[Error] - File error:", err);
            res.status(404).json({ error: "File not found!" });
        }
    });
});

app.listen(PORT, () => {
    console.log("[Server]  - Listening on port", PORT);
    // await cleanupDownloadFolders(DOWNLOAD_FILES_PATH, jobs, MAX_AGE_MS);
    setInterval(() => {
        cleanupDownloadFolders(DOWNLOAD_FILES_PATH, jobs, MAX_AGE_MS);
    }, CLEANUP_INTERVAL_MS);
    console.log("[Cleanup] - Service started with interval", CLEANUP_INTERVAL_MS/60000, "minutes");
});


// Video
// yt-dlp.exe --js-runtimes node --newline -o "../../app/downloads/xyz/testAudio+VideoFile.%(ext)s" -f 93+140 --merge-output-format mp4 "https://youtu.be/wJQXNdpCkwg?si=YDDvs0dX-7Oq2W_Y"

// Audio only
// yt-dlp.exe --newline -o "../../app/downloads/xyz/testAudioFile.%(ext)s" -f 140 -x --audio-format m4a "https://youtu.be/wJQXNdpCkwg?si=YDDvs0dX-7Oq2W_Y"
