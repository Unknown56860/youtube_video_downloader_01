import { postJson } from "./utils/utils.js";
import { 
    showNotification, withLoading, addVideoItem, updateStorageEstimate,
    getDownloadQueue, manageDownload, endSSE
} from "./utils/elements.js";

const BASE_URL = "";
// const BASE_URL = "http://localhost:3000";

const URL_VIDEO_META = BASE_URL + "/video-info";
const URL_VIDEO_PREPARE = BASE_URL + "/prepare-download";
const URL_VIDEO_PROGRESS = BASE_URL + "/download-progress";
const URL_VIDEO_DOWNLOAD = BASE_URL + "/download-file";

let source = null;

document.addEventListener('DOMContentLoaded', () => {
  // ----- DOM references ------------------------------------------------
    const notifyBox = document.getElementById("notifications");

    const urlInput = document.getElementById('urlInput');
    const addBtn = document.getElementById('addBtn');

    const prefVidHeight = document.getElementById("defaultVideoQuality");
    const prefAudQuality = document.getElementById("defaultAudioQuality");

    const videosContainer = document.getElementById('video-list');

    const onlyAudioBox = document.getElementById("onlyAudio");

    const storageDetails = document.getElementById("storage-details");
    const proceedBtn = document.getElementById("proceedBtn");

    const statusText = document.getElementById("statusText");
    const progressText = document.getElementById("progressText");
    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");

    const DOM_Elements = {
        notifyBox, urlInput, addBtn, prefVidHeight, prefAudQuality, videosContainer, onlyAudioBox,
        storageDetails, proceedBtn, statusText, progressText, progressContainer, progressBar
    };

    
    addBtn.addEventListener('click', async () => {
        await withLoading(addBtn, async () => {
            const url = urlInput.value.trim(); urlInput.value = "";
            if(!url) { showNotification("error", "URL box empty", DOM_Elements); return; }
            try {
                console.log("Requesting metadata for:", response.downloadId);
                const videosInfo = await postJson({url}, URL_VIDEO_META);
                for(const videoInfo of videosInfo) { addVideoItem(videoInfo, DOM_Elements); }
                if(videosInfo.length === 0) { showNotification("error", "No videos found", DOM_Elements); }
                else if(videosInfo.length === 1) { showNotification("success", `Added ${videosInfo[0].title}`, DOM_Elements); }
                else { showNotification("success", `Added ${videosInfo.length} video/s to the list`, DOM_Elements); }
            }
            catch(err) { showNotification("error", "Request failed: " + err.message, DOM_Elements); }
        })
    });
    
    proceedBtn.addEventListener('click', async () => {
        if(videosContainer.childElementCount === 0) { showNotification("error", "Empty list!", DOM_Elements); return; }
        const onlyAudio = onlyAudioBox.checked;
        const videoQueue = getDownloadQueue(DOM_Elements);
        const payload = { options: { onlyAudio }, videoQueue: videoQueue };
        await withLoading(proceedBtn, async () => {
            const response = await postJson(payload, URL_VIDEO_PREPARE);
            if(response.error) { showNotification("error", response.error, DOM_Elements); return; }
            console.log("Download list sent, downloadId:", response.downloadId);
            videosContainer.replaceChildren();
            showNotification("success", "Starting downloads...", DOM_Elements);
            if(source !== null) { endSSE(source, null, DOM_Elements); }

            proceedBtn.hidden = true; statusText.hidden = false;
            progressText.hidden = false; progressContainer.hidden = false;

            let prevFile = 0;
            let url = `${URL_VIDEO_DOWNLOAD}/${response.downloadId}`;
            source = new EventSource(`${URL_VIDEO_PROGRESS}/${response.downloadId}`);
            source.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.data) { prevFile = manageDownload(data, url, prevFile, DOM_Elements); }
                if (data.error) { endSSE(source, "Error: " + data.error, DOM_Elements); }
            };
            source.onerror = (err) => { endSSE(source, "Server disconnected", DOM_Elements); };
        });
    });

    urlInput.addEventListener("keydown", (e) => { if(e.key === "Enter") { addBtn.click(); }} )
    onlyAudioBox.addEventListener('change', async () => { updateStorageEstimate(DOM_Elements); })
    
    updateStorageEstimate(DOM_Elements);
});

