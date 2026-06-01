import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const app = express();
const jobs = new Map();

app.use(cors());
app.use(express.json());

app.post("/video-urls", async (req, res) => {
    var { url } = req.body;

    console.log("Received metadata request for: " + url);

    try {
        const parsed = new URL(url);

        if(parsed.searchParams.has("v")) {
            url = `https://youtu.be/${parsed.searchParams.get("v")}`;
        }

        const { stdout } = await execFileAsync(
            "../.venv/Scripts/yt-dlp.exe", // adjust path
            [
                "--flat-playlist",
                "--dump-single-json",
                url
            ]
        );
        
        const data = JSON.parse(stdout);
        // console.log("Data parsed. Building info...");
        
        const buildVideoInfo = video => ({
            url: `https://youtu.be/${video.id}`,
            title: video.title,
            duration: video.duration,

            videoFormats: (video.formats || [])
                .filter(f => f.vcodec !== "none" && f.height)
                .map(f => ({formatId: f.format_id, ext: f.ext, width: f.width, height: f.height, fps: f.fps}))
                .filter((f, index, self) => index === self.findIndex(x => x.height === f.height))
                .sort((a, b) => b.height - a.height),

            audioFormats: (video.formats || [])
                .filter(f => f.vcodec === "none" && f.acodec !== "none")
                .map(f => ({formatId: f.format_id, ext: f.ext, abr: f.abr}))
                .sort((a, b) => b.abr - a.abr)
        });

        if (Array.isArray(data.entries)) {
            const result = data.entries.map(buildVideoInfo);
            return res.json(result);
        }
        // console.log("Completed. Sending response: " + data)
        return res.json([buildVideoInfo(data)]);

    } catch(err) {
        console.error(err);
        res.status(500).json([]);
    }
});

app.post("/download", (req, res) => {
    console.log("Received media request.");
    const jobId = crypto.randomUUID();
    const multiplier =
        Number(req.body.options.downloadMerged) +
        Number(req.body.options.keepVideo) +
        Number(req.body.options.keepAudio);
    jobs.set(jobId, {
        id: jobId, status: "running",
        totalFiles: req.body.downloads.length * multiplier,
        completedCount: 0, progress: 0,
        lastPoll: Date.now(),
        completedFiles: []
    });
    processDownload(jobId, req.body);
    res.json({success: true,jobId});
});

app.get("/download-status/:jobId", (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) { return res.status(404).json({error: "Job not found"}); }
    job.lastPoll = Date.now();
    res.json({
        status: job.status, 
        progress: job.progress,
        completedCount: job.completedCount, 
        totalFiles: job.totalFiles,
        completedFiles: job.completedFiles,
        error: job.error
    });
});

app.get("/file/:jobId/:fileId", (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) { return res.sendStatus(404); }
    const file = job.completedFiles.find(f => f.fileId === req.params.fileId);
    if (!file) { return res.sendStatus(404); }
    res.download(file.path, file.filename, 
        async err => {
            if(err) { console.error(err); return; }
            try {
                await fs.unlink(file.path);
                job.completedFiles = job.completedFiles.filter(f => f.fileId !== file.fileId);
            }
            catch(ex) { console.error(ex); }
        }
    );
});

async function processDownload(jobId, payload) {
    const job = jobs.get(jobId);
    try {
        for (const item of payload.downloads) {
            // const fileId = crypto.randomUUID();
            // const output = `downloads/${fileId}.%(ext)s`;

            // const args = ["-f", `${item.videoFormatId}+${item.audioFormatId}`, "-o", output, item.url];
            // console.log("Starting download:", item.title); console.log(args);
            // await runYtDlp(job, args);

            // const files = await fs.readdir("./downloads");
            // const actualFile = files.find(x => x.startsWith(fileId));
            // const extension = actualFile.split(".").pop();
            // const title = trimFilename(sanitizeFilename(item.title));
            // const filename = `${title} - ${item.videoHeight}p - ${item.audioAbr}kbps.${extension}`;

            // await fs.rename(`downloads/${actualFile}`, `downloads/${filename}`);

            if(payload.options.downloadMerged) {
                await downloadVariant(
                    job,
                    item,
                    [
                        "-f",
                        `${item.videoFormatId}+${item.audioFormatId}`,
                        "--merge-output-format",
                        "mp4"
                    ],
                    "merged",
                    `${title + item.videoFormatId + item.audioFormatId}.mp4`
                );
            }

            if(payload.options.keepVideo) {
                await downloadVariant(
                    job,
                    item,
                    ["-f", item.videoFormatId],
                    "video",
                    `${title + item.videoFormatId}-video.mp4`
                );
            }

            if(payload.options.keepAudio) {
                await downloadVariant(
                    job,
                    item,
                    ["-f", item.audioFormatId],
                    "audio",
                    `${title + item.audioFormatId}-audio.m4a`
                );
            }
        }
        job.status = "completed";
    }
    catch (err) {
        job.status = "failed";
        job.error = err.message;
    }
}

async function downloadVariant(job, item, args, type, filename) {
    const fileId = crypto.randomUUID();

    await runYtDlp(job, [
        ...args,
        "-o",
        `downloads/${fileId}.%(ext)s`,
        item.url
    ]);

    const files = await fs.readdir("./downloads");

    const actualFile = files.find(f => f.startsWith(fileId));

    job.completedCount++;
    job.progress = Math.round((job.completedCount / job.totalFiles) * 100);

    job.completedFiles.push({
        fileId,
        filename,
        path: `downloads/${actualFile}`,
        type,
        downloadUrl: `/file/${job.id}/${fileId}`
    });
}

function runYtDlp(job, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(
            "../.venv/Scripts/yt-dlp.exe",
            "--js-runtimes",
            "node",
            args,
            {
                stdio: ["ignore", "pipe", "pipe"]
            }
        );

        job.childProcess = child;
        let stderr = "";
        
        child.stdout.on("data", d => {console.log(d.toString());});
        child.stderr.on("data", d => {
            console.log(d.toString());
            stderr += d.toString();
        });

        child.on("error", reject);
        child.on("close", code => {
            job.childProcess = null;
            if(code === 0) { resolve();}
            else { reject(new Error(stderr || `yt-dlp exited ${code}`));}
        });
    });
}

function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, " ").trim();
}

function trimFilename(name, max = 70) {
    if(name.length <= max) { return name; }
    return name.slice(0, max);
}

setInterval(() => {
    const now = Date.now();
    for (const [jobId, job] of jobs) {
        if (job.status !== "running") { continue; }
        const inactive = now - job.lastPoll > 120000;
        if (!inactive) { continue; }
        console.log(`Cancelling abandoned job ${jobId}`);
        if (job.childProcess) { job.childProcess.kill("SIGTERM"); }
        job.status = "cancelled";
    }
}, 10000);

setInterval(async () => {
    const now = Date.now();
    for(const [jobId, job] of jobs) {
        if(now - job.lastPoll < 1800000) { continue; }
        for(const file of job.completedFiles) {
            try { await fs.unlink(file.path); }
            catch {}
        }
        jobs.delete(jobId);
    }
}, 300000);

app.listen(3000, () => {
    console.log("Server started port: 3000");
});
