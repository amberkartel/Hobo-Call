async function uploadSegment(blob, id, facing) {
    // Yesterday it worked, today it doesn't? Let's verify the blob size first.
    if (blob.size < 1000) {
        console.log("Segment too small, skipping.");
        return; 
    }

    pendingUploads++;
    const formData = new FormData();
    // Using a timestamp to prevent the server from getting confused by duplicate filenames
    const timestamp = new Date().getTime();
    formData.append("video", blob, `part_${id}_${facing}_${timestamp}.webm`);

    try {
        // Use a relative path unless your backend is on a different domain
        const response = await fetch("/upload", { 
            method: "POST", 
            body: formData 
        });

        if (response.ok) {
            console.log(`Segment ${id} reach server.`);
        } else {
            // This will help you see if Render is rejecting the file
            const errorText = await response.text();
            alert("Server Error: " + response.status + " - " + errorText);
        }
    } catch (e) {
        alert("Network Fail: " + e.message);
    } finally {
        pendingUploads = Math.max(0, pendingUploads - 1);
        checkFinalRedirect();
    }
}
