import { formatDuration, formatBytes, triggerDownload } from "./utils.js";

export function showNotification(type, message, DOM_Elements, timeout = 5000) {
    const div = document.createElement("div");
    div.className = `notification ${type}`;
    div.textContent = message;
    DOM_Elements.notifyBox.prepend(div);
    setTimeout(() => { div.remove(); }, timeout);
}

export async function withLoading(button, fn) {
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Loading...";
    button.classList.add("btn-loading");
    try { return await fn(); }
    finally {
        button.disabled = false;
        button.textContent = oldText;
        button.classList.remove("btn-loading");
    }
}

export function addVideoItem(videoInfo, DOM_Elements) {
    const item = document.createElement("div");
    item.className = "video-item";
    item.videoInfo = videoInfo;

    const title = document.createElement("div");
    title.textContent = videoInfo.title;
    title.className = "video-title";
    item.appendChild(title);

    const duration = document.createElement("div");
    duration.textContent = `Duration: ${formatDuration(videoInfo.duration)}`;
    duration.className = "video-duration";
    item.appendChild(duration);

    const urlDisplay = document.createElement("input");
    urlDisplay.type = "text";
    urlDisplay.readOnly = true;
    urlDisplay.value = videoInfo.url;
    item.appendChild(urlDisplay);

    const videoSelect = document.createElement("select");
    videoInfo.videoFormats.forEach(format => {
        const option = document.createElement("option");
        option.value = format.formatCode;
        option.textContent = 
            `(${format.width}x${format.height})p, ${format.fps}fps, ${format.bitrate} kbps`; // .${format.ext}
        videoSelect.appendChild(option);
    });

    const audioSelect = document.createElement("select");
    videoInfo.audioFormats.forEach(format => {
        const option = document.createElement("option");
        option.value = format.formatCode;
        option.textContent = `${format.bitrate} kbps`; // .${format.ext}
        audioSelect.appendChild(option);
    });

    videoSelect.className = "video-format";
    audioSelect.className = "audio-format";
    selectDefaultVideoFormat(videoSelect, videoInfo.videoFormats, DOM_Elements);
    selectDefaultAudioFormat(audioSelect, videoInfo.audioFormats, DOM_Elements);
    videoSelect.addEventListener("change", () => { updateStorageEstimate(DOM_Elements); })
    audioSelect.addEventListener("change", () => { updateStorageEstimate(DOM_Elements); })

    const selectors = document.createElement("div");
    selectors.className = "quality-selectors";
    selectors.appendChild(videoSelect);
    selectors.appendChild(audioSelect);
    item.appendChild(selectors);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => { removeVideoItem(item, DOM_Elements); });
    item.appendChild(delBtn);

    DOM_Elements.videosContainer.prepend(item);
    updateStorageEstimate(DOM_Elements);
}

export function removeVideoItem(videoItem, DOM_Elements) {
    DOM_Elements.videosContainer.removeChild(videoItem);
    updateStorageEstimate(DOM_Elements);
    showNotification("info",`Removed: ${videoItem.videoInfo.title}`, DOM_Elements); 
}

export function selectDefaultVideoFormat(select, formats, DOM_Elements) {
    const preferredHeight = DOM_Elements.prefVidHeight.value;
    if (preferredHeight === "best") { select.selectedIndex = 0; return; }
    const target = Number(preferredHeight);
    let best = formats[0];
    let bestDiff = Infinity;
    for (const format of formats) {
        const diff = Math.abs(format.height - target);
        if (diff < bestDiff) { best = format; bestDiff = diff; }
    }
    select.value = best.formatCode;
}

export function selectDefaultAudioFormat(select, formats, DOM_Elements) {
    const preferred = DOM_Elements.prefAudQuality.value;
    if (preferred === "best") { select.selectedIndex = 0; return; }
    const target = Number(preferred);
    let best = formats[0];
    let bestDiff = Infinity;
    for (const format of formats) {
        const diff = Math.abs(format.bitrate - target);
        if (diff < bestDiff) { best = format; bestDiff = diff; }
    }
    select.value = best.formatCode;
}

export function updateStorageEstimate(DOM_Elements) {
    const items = Array.from(DOM_Elements.videosContainer.children);
    const onlyAudio = DOM_Elements.onlyAudioBox.checked;

    let totalKBytes = 0;
    for(const item of items) {
        const audioSelect = item.querySelector(".audio-format");
        const selectedAudio = item.videoInfo.audioFormats.find(f => f.formatCode === audioSelect.value);
        const audioKByte = selectedAudio.bitrate * item.videoInfo.duration / 8;

        if(onlyAudio) { totalKBytes += audioKByte; continue; }

        const videoSelect = item.querySelector(".video-format");
        const selectedVideo = item.videoInfo.videoFormats.find(f => f.formatCode === videoSelect.value);
        const videoKByte = selectedVideo.bitrate * item.videoInfo.duration / 8;

        totalKBytes += videoKByte + audioKByte;
    }

    DOM_Elements.storageDetails.innerHTML = `
        <div class="storage-total">
            Total size: ${formatBytes(totalKBytes)}
        </div>
    `;
}

export function getDownloadQueue(DOM_Elements) {
    const container = DOM_Elements.videosContainer;
    const items = Array.from(container.children);
    let queue = []
    for(const item of items) {
        let videoInfo = JSON.parse(JSON.stringify(item.videoInfo));
        const videoSelect = item.querySelector(".video-format");
        const audioSelect = item.querySelector(".audio-format");
        videoInfo.videoFormats = [item.videoInfo.videoFormats.find(f => f.formatCode === videoSelect.value)];
        videoInfo.audioFormats = [item.videoInfo.audioFormats.find(f => f.formatCode === audioSelect.value)];
        queue.push(videoInfo);
    }
    return queue.reverse();
}

export function manageDownload(data, url, prevFile, DOM_Elements) {
    // progress=0, current=0, total=job.queue.videoQueue.length, file=""
    DOM_Elements.statusText.textContent = `Status: ${data.status}`;
    if(data.data.current < data.data.total) {
        DOM_Elements.progressBar.style.width = `${data.data.progress}%`;
        DOM_Elements.progressText.textContent = 
                `Preparing file [${data.data.current+1} of ${data.data.total}], ${data.data.progress}%`;
    } else {
        proceedBtn.hidden = false;
        DOM_Elements.progressBar.style.width = "100%";
        DOM_Elements.progressText.textContent = `All ${data.data.total} file/s completed.`
    }
    if(prevFile != data.data.current) {
        showNotification("info", "Downloading " + data.data.file, DOM_Elements);
        triggerDownload(`${url}/${data.data.file}`, data.data.file);
    }
    return data.data.current;
}

export function endSSE(source, message, DOM_Elements) {
    progressBar.style.width = "0%"; 
    progressText.textContent = "Downloading video 0 of 0";
    proceedBtn.hidden = false; progressContainer.hidden = true;
    statusText.hidden = true; progressText.hidden = true;
    if(message !== null) { showNotification("error", message, DOM_Elements); }
    source.close();
    showNotification("info", "Connection closed with the server", DOM_Elements);
}

// Sample json

// [
//   {
//     "title": "@SaiAbhyankkar - Pavazha Malli (Music Video) | Kayadu | Shruti Haasan | Vivek | Thejo | Think Indie",
//     "duration": 309,
//     "url": "https://youtu.be/b68HETiNO98",
//     "videoFormats": [
//       {
//         "width": 3104,
//         "height": 2160,
//         "fps": 24,
//         "formatCode": "313",
//         "bitrate": 14299.135,
//         "ext": "webm",
//         "codec": "vp9"
//       }, ...
//     ],
//     "audioFormats": [
//       {
//         "formatCode": "140",
//         "bitrate": 129.49,
//         "ext": "m4a",
//         "codec": "mp4a.40.2"
//       }, ...
//     ]
//   }
// ]

