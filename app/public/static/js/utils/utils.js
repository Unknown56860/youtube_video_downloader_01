
export async function postJson(payload, url) {
    const response = await fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });
    if(!response.ok) { 
        let error = `Error (${response.status})`;
        try{
            const errBody = await response.json();
            if(errBody && errBody.error) { error = errBody.error; }
        } catch{e} {}
        throw new Error(error);
    }
    return await response.json();
}

export function triggerDownload(url, filename) {
    console.log("Downloading", filename);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    // a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

export function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h <= 0) { return `${m}:${s.toString().padStart(2, "0")}`; }
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatBytes(KBytes) {
    const units = ["KB", "MB", "GB", "TB"];
    let i = 0;
    while(KBytes >= 1024 && i < units.length - 1) { KBytes /= 1024; i++; }
    return `${KBytes.toFixed(2)} ${units[i]}`;
}

