/* --------------------------------------------------------------
   YouTube Video Downloader – Client side logic
   ------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
  // ----- DOM references ------------------------------------------------
  const container = document.getElementById("notifications");

  const urlInput = document.getElementById('urlInput');
  const addBtn = document.getElementById('addBtn');
  
  const preferredHeightSelection = document.getElementById("defaultVideoQuality");
  const preferredAudioSelection = document.getElementById("defaultAudioQuality");
  
  const itemsDiv = document.getElementById('url-list');

  const keepAudioBox = document.getElementById("keepAudio");
  const keepVideoBox = document.getElementById("keepVideo");
  const mergeAudioVideoBox = document.getElementById("downloadMerged");
  
  const storageDetails = document.getElementById("storage-details");
  const proceedBtn = document.getElementById("proceedBtn");

  const progressContainer = document.getElementById("progressContainer");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  // ----- Constants ----------------------------------
  const AUDIO_BITRATES = {64: 64, 96: 96, 128: 128, 160: 160}
  const VIDEO_BITRATES = {144: 0.1, 240: 0.3, 360: 0.7, 480: 1.2, 
                          720: 3.0, 1080: 6.0, 1440: 12.0, 2160: 25.0}

  // ----- Variables ----------------------------------
  let activeJobId = null;
  let downloadedFiles = new Set();

  // ---------- Add a new entry -----------------------------------------
  addBtn.addEventListener('click', async () => {
    await withLoading(addBtn, async () => {
        const url = urlInput.value.trim(); urlInput.value = "";
        if(!url) { showNotification("error", "Empty URL!"); return; }
        try { 
          const videoUrls = await getVideoUrls(url); 
          if(videoUrls.length === 0) { showNotification("error", "Invalid URL!"); return; }
          for(const videoUrl of videoUrls) { addItem(videoUrl); }
          if(videoUrls.length === 1) { showNotification("success", `Added ${videoUrls[0].title}`); }
          else { showNotification("success", `Added: ${videoUrls.length} videos to the list.`); }
        }
        catch(err) { showNotification("error", err.message); }
    });
  });

  proceedBtn.addEventListener('click', async () => {
    // Logic yet to be implemented correctly.

    const items = Array.from(itemsDiv.children);
    if(items.length === 0) { showNotification("error", "Empty list!"); return; }

    const keepAudio = keepAudioBox.checked;
    const keepVideo = keepVideoBox.checked;
    const downloadMerged = mergeAudioVideoBox.checked;

    const downloads = items.map(item => {
      
      const videoSelect = item.querySelector(".video-format");
      const audioSelect = item.querySelector(".audio-format");

      const videoFormat = item.videoInfo.videoFormats.find(f => f.formatId === videoSelect.value);
      const audioFormat = item.videoInfo.audioFormats.find(f => f.formatId === audioSelect.value);

      return {
        url: item.videoInfo.url,
        title: item.videoInfo.title,

        videoFormatId: videoFormat.formatId,
        audioFormatId: audioFormat.formatId,

        videoHeight: videoFormat.height,
        audioAbr: audioFormat.abr
      };
    });

    const payload = {
        options: { downloadMerged, keepAudio, keepVideo },
        downloads
    };
    await withLoading(proceedBtn, async () => {
      const result = await startDownload(payload);
      if(result.success) {
        activeJobId = result.jobId;
        progressText.hidden = false;
        progressContainer.hidden = false;
        progressBar.style.width = "0%";
        progressText.textContent = "0%";
        showNotification("success", "Download job started.");
        pollJob(activeJobId);
      }
    });
  });
  
  keepAudioBox.addEventListener('change', async () => { updateStorageEstimate(); })
  keepVideoBox.addEventListener('change', async () => { updateStorageEstimate(); })
  mergeAudioVideoBox.addEventListener('change', async () => { updateStorageEstimate(); })

  updateStorageEstimate();

  async function withLoading(button, fn) {
    const oldText = button.textContent;

    button.disabled = true;
    button.textContent = "Loading...";
    button.classList.add("btn-loading");

    try {
        return await fn();
    }
    finally {
        button.disabled = false;
        button.textContent = oldText;
        button.classList.remove("btn-loading");
    }
  }
  
  async function getVideoUrls(url) {
    console.log("Requesting metadata for: " + url);
    const response = await fetch(
      "http://localhost:3000/video-urls",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
      }
    );
    if(!response.ok) { throw new Error("Server error!"); }
    return await response.json();
  }
  
  async function startDownload(payload) {
    console.log("Requesting media");
    const response = await fetch(
        "http://localhost:3000/download",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }
    );
    return await response.json();
  };

  async function pollJob(jobId) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`http://localhost:3000/download-status/${jobId}`);
            if(!response.ok) { clearInterval(interval); return; }
            const job = await response.json();
            proceedBtn.disabled = true;
            progressBar.style.width = `${job.progress}%`;
            progressText.textContent = `${job.progress}% (${job.completedCount}/${job.totalFiles})`;
            for(const file of job.completedFiles) {
                if(downloadedFiles.has(file.fileId)) { continue; }
                downloadedFiles.add(file.fileId);
                // triggerDownload(`http://localhost:3000${file.downloadUrl}`, file.filename);
                window.open(`http://localhost:3000${file.downloadUrl}`, "_blank");
                showNotification("success", `Ready: ${file.filename}`);
            }
            if(job.status === "completed") {
                clearInterval(interval);
                proceedBtn.disabled = false;
                progressBar.style.width = "100%";
                progressText.textContent = `100% (${job.totalFiles}/${job.totalFiles})`;
                showNotification("success", "All downloads completed.");
            }
            if(job.status === "failed") {
                clearInterval(interval);
                proceedBtn.disabled = false;
                showNotification("error", job.error || "Download failed");
              }
              
            if(job.status === "cancelled") {
                clearInterval(interval);
                proceedBtn.disabled = false;
                showNotification("error", "Job cancelled.");
            }
        }
        catch(err) {
            clearInterval(interval);
            proceedBtn.disabled = false;
            showNotification("error", err.message);
        }
    }, 2000);
  }

  function triggerDownload(url, filename) {
    // const a = document.createElement("a");
    // a.href = url;
    // a.download = filename;
    // document.body.appendChild(a);
    // a.click(); a.remove();
  }

  function showNotification(type, message, timeout = 5000) {
    const div = document.createElement("div");
    div.className = `notification ${type}`;
    div.textContent = message;
    container.prepend(div);
    setTimeout(() => { div.remove(); }, timeout);
  }

  function addItem(video) {
    const item = document.createElement("div");
    item.className = "item";
    item.videoInfo = video;

    const title = document.createElement("div");
    title.textContent = video.title;
    title.className = "video-title";
    item.appendChild(title);

    const duration = document.createElement("div");
    duration.textContent = `Duration: ${formatDuration(video.duration)}`;
    duration.className = "video-duration";
    item.appendChild(duration);

    const urlDisplay = document.createElement("input");
    urlDisplay.type = "text";
    urlDisplay.readOnly = true;
    urlDisplay.value = video.url;
    item.appendChild(urlDisplay);

    const videoSelect = document.createElement("select");
    video.videoFormats.forEach(format => {
        const option = document.createElement("option");
        option.value = format.formatId;
        option.textContent = `${format.height}p (${format.ext})`;
        videoSelect.appendChild(option);
    });

    const audioSelect = document.createElement("select");
    video.audioFormats.forEach(format => {
        const option = document.createElement("option");
        option.value = format.formatId;
        option.textContent = `${format.abr ?? "?"} kbps (${format.ext})`;
        audioSelect.appendChild(option);
    });

    videoSelect.className = "video-format";
    audioSelect.className = "audio-format";
    selectDefaultVideoFormat(videoSelect, video.videoFormats);
    selectDefaultAudioFormat(audioSelect, video.audioFormats);

    /* NEW WRAPPER */
    const selectors = document.createElement("div");
    selectors.className = "selectors";
    selectors.appendChild(videoSelect);
    selectors.appendChild(audioSelect);
    item.appendChild(selectors);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => { removeItem(item); });
    item.appendChild(delBtn);

    itemsDiv.appendChild(item);
    updateStorageEstimate();
  }

  /* ---------- Remove an entry --------------------------------------- */
  function removeItem(item) {
    itemsDiv.removeChild(item);
    updateStorageEstimate();
    showNotification("info",`Removed: ${item.videoInfo.title}`);
  }

  function selectDefaultVideoFormat(select, formats) {
    const preferredHeight = preferredHeightSelection.value;
    if (preferredHeight === "best") { select.selectedIndex = 0; return; }
    const match = formats.find(f => String(f.height) === preferredHeight);
    if (match) { select.value = match.formatId; }
  }

  function selectDefaultAudioFormat(select, formats) {
    const preferred = preferredAudioSelection.value;
    if (preferred === "best") { select.selectedIndex = 0; return; }

    const target = Number(preferred);
    let best = formats[0];
    let bestDiff = Infinity;

    for (const format of formats) {
        const diff = Math.abs((format.abr ?? 0) - target);
        if (diff < bestDiff) { best = format; bestDiff = diff; }
    }
    select.value = best.formatId;
  }

  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function updateStorageEstimate() {
    const items = Array.from(itemsDiv.children);

    let audioBytes = 0;
    let videoBytes = 0;
    let mergedBytes = 0;

    for(const item of items) {
      const duration = item.videoInfo.duration;

      const videoSelect = item.querySelector(".video-format");
      const audioSelect = item.querySelector(".audio-format");

      const selectedVideo = item.videoInfo.videoFormats.find(f => f.formatId === videoSelect.value);
      const selectedAudio = item.videoInfo.audioFormats.find(f => f.formatId === audioSelect.value);

      const videoSize = estimateVideoBytes(duration, selectedVideo.height);
      const audioSize = estimateAudioBytes(duration, selectedAudio.abr ?? 128);

      audioBytes += audioSize;
      videoBytes += videoSize;
      mergedBytes += videoSize + audioSize;
    }

    const keepAudio = keepAudioBox.checked;
    const keepVideo = keepVideoBox.checked;
    const merge = mergeAudioVideoBox.checked;

    let total = 0;
    if(merge) total += mergedBytes;
    if(keepAudio) total += audioBytes;
    if(keepVideo) total += videoBytes;

    storageDetails.innerHTML = `
      <div class="storage-stat">
          <span class="storage-label">Video+Audio(merged):</span>
          <span class="storage-value">${formatBytes(mergedBytes)}</span>
      </div>

      <div class="storage-stat">
          <span class="storage-label">Audio only:</span>
          <span class="storage-value">${formatBytes(audioBytes)}</span>
      </div>

      <div class="storage-stat">
          <span class="storage-label">Video only:</span>
          <span class="storage-value">${formatBytes(videoBytes)}</span>
      </div>

      <div class="storage-total">
          Total size: ${formatBytes(total)}
      </div>
    `;
  }

  function estimateVideoBytes(seconds, height) {
    const mbps = VIDEO_BITRATES[height] ?? 6;
    return mbps * 125_000 * seconds;
  }
  function estimateAudioBytes(seconds, abr) {
    return abr * 125 * seconds;
  }

  function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    while(bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return `${bytes.toFixed(2)} ${units[i]}`;
  }

});
