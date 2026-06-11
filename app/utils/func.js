import path from "path";
import fs from "node:fs/promises";
import { spawn } from "child_process";

export function buildVideoInfo(video) {
    if (!video?.id) { return null; }
    if (video.is_live || video.live_status === "is_live" || video.live_status === "is_upcoming") { return null; }

    return {
        title: video.title ?? null,
        duration: video.duration ?? null,
        url: `https://youtu.be/${video.id}`,

        videoFormats: (video.formats || [])
            .filter(f => f.vcodec && f.vcodec !== "none")
            .map(f => ({
                width: f.width ?? null,
                height: f.height ?? null,
                fps: f.fps ?? null,
                formatCode: f.format_id ?? null,
                bitrate: f.tbr ?? f.vbr ?? null,
                ext: f.ext ?? null,
                codec: f.vcodec ?? null
            }))
            .sort((a, b) => {
                const h1 = a.height ?? 0;
                const h2 = b.height ?? 0;
                if (h1 !== h2) { return h2 - h1; }
                return (b.fps ?? 0) - (a.fps ?? 0);
            }),

        audioFormats: (video.formats || [])
            .filter(f => f.vcodec === "none" && f.acodec && f.acodec !== "none")
            .map(f => ({
                formatCode: f.format_id ?? null,
                bitrate: f.abr ?? f.tbr ?? null,
                ext: f.ext ?? null,
                codec: f.acodec ?? null
            }))
            .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
    };
};

export async function downloadJob(downloadId, jobs, PATHS) {
    const job = jobs.get(downloadId);
    if (!job) throw new Error("Invalid download Id");
    if (job.status === "completed") return;

    if (job.status === "queued") {
        job.progress = {progress: 0, current: 0, total: job.queue.videoQueue.length, file: ""};
        job.status = "running";
    }
    if (job.progress.current >= job.progress.total) {
        job.status = "completed";
        console.log("[Message] - All downloads completed for", downloadId);
        return;
    }

    const onlyAudio = job.queue.options.onlyAudio;
    const video = job.queue.videoQueue[job.progress.current];
    const selectedVideo = video.videoFormats[0];
    const selectedAudio = video.audioFormats[0];
    job.progress.file = getFileName(video, onlyAudio);
    
    const outputDir = path.join(PATHS.DOWNLOAD_FILES_PATH, downloadId);
    const outputTemplate = path.join(outputDir, `${job.progress.file}.%(ext)s`);

    let args  = ["--js-runtimes", "node", "--newline", "-o", outputTemplate, "-f"];
    if (onlyAudio) {
        args.push(selectedAudio.formatCode, "-x", "--audio-format", "m4a", video.url);
        job.progress.file += ".m4a";
    } else {
        args.push(`${selectedVideo.formatCode}+${selectedAudio.formatCode}`, "--merge-output-format", "mp4", 
            "--postprocessor-args", "ffmpeg:-c:v libx264 -c:a aac -b:a 192k", "--recode-video", "mp4", video.url);
        job.progress.file += ".mp4";
    }

    const child = spawn(PATHS.YT_DLP_PATH, args);
    child.stdout.on("data", chunk => {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
            const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
            if (match) { job.progress.progress = Number(match[1]); }
        }
    });

    child.stderr.on("data", data => { console.error("[Error] - Download error:",data.toString()); });

    child.on("close", code => {
        if (code !== 0) { console.error(`[Error] - yt-dlp exited with code ${code}`); }
        job.progress.progress = 100; job.progress.current++;
        downloadJob(downloadId, jobs, PATHS);
    });
}

export function pollJob(job, res) {
    if (!job) {
        res.write(`data: ${JSON.stringify({ error: "Invalid download id" })}`); 
        return res.end();
    }
    res.write(`data: ${JSON.stringify({ data: job.progress, status: job.status })}\n\n`);
    if (job.status !== "completed") { setTimeout(() => pollJob(job, res), 1000); }
}

export async function cleanupDownloadFolders(download_path, jobs, max_age) {
    try {
        const now = Date.now();
        const entries = await fs.readdir(download_path, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const downloadId = entry.name;
            // Skip active jobs
            if (jobs.has(downloadId)) { continue; }
            const folderPath = path.join(download_path, downloadId);
            try {
                const stats = await fs.stat(folderPath);
                const age = now - stats.mtimeMs;
                if (age > max_age) {
                    console.log(`[Cleanup] - Removing expired folder ${downloadId}`);
                    await fs.rm(folderPath, {recursive: true, force: true});
                }
            } catch (err) {
                console.error(`[Cleanup] - Failed processing ${downloadId}:`, err);
            }
        }
    } catch (err) { console.error("[Cleanup] - Failed:", err); }
}

export function getFileName(videoInfo, onlyAudio) {
    let meta = ` - (${videoInfo.audioFormats[0].bitrate} kbps)`;
    if(!onlyAudio) {
        meta = ` - (${videoInfo.videoFormats[0].height}p, ${videoInfo.videoFormats[0].fps}fps,`
            + ` ${videoInfo.videoFormats[0].bitrate} kbps)${meta}`;
    }
    meta = truncateString(videoInfo.title, 50) + meta;
    return meta.replace(/[<>:"/\\|?*]/g, "_");
}

export function truncateString(str, length) {
    if(str.length > length) { return str.slice(0, length) + "... "; }
    return str;
}

