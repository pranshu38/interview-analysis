document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('resume-file-input');
    const jobSelect = document.getElementById('job-field-select');
    const nextButton = document.getElementById('next-button');
    const fileNameDisplay = document.getElementById('file-name-display');

    let isFileUploaded = false;
    let isJobSelected = false;

    function checkCompletion() {
        if (isFileUploaded && isJobSelected) {
            nextButton.classList.remove('disabled');
        } else {
            nextButton.classList.add('disabled');
        }
    }

    // --- Display selected file name ---
    fileInput.addEventListener('change', () => {
        isFileUploaded = fileInput.files.length > 0;
        if (isFileUploaded) {
            fileNameDisplay.textContent = fileInput.files[0].name;
        } else {
            fileNameDisplay.textContent = "No file selected";
        }
        checkCompletion();
    });

    // --- Job field selection ---
    jobSelect.addEventListener('change', () => {
        isJobSelected = !!jobSelect.value;
        checkCompletion();
    });

    // --- Proceed button ---
    nextButton.addEventListener('click', async (e) => {
        e.preventDefault();

        if (!isFileUploaded || !isJobSelected) {
            alert("Please upload your resume and select a job field first.");
            return;
        }

        // --- Normalize job field before sending ---
        let normalizedJobField = jobSelect.value.trim().toLowerCase().replace(/-/g, " ");

        const formData = new FormData();
        formData.append("resume", fileInput.files[0]);
        formData.append("job_field", normalizedJobField); // send normalized value

        try {
            nextButton.textContent = "Processing..."; // show loading
            nextButton.disabled = true;

            const response = await fetch("/start_session", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (data.message) {
                console.log(">>> Backend:", data.message);
                // Redirect to interview page after session is ready
                window.location.href = "/interview";
            } else {
                alert("Error: " + (data.error || "Unknown"));
                nextButton.textContent = "Proceed to Interview";
                nextButton.disabled = false;
            }
        } catch (err) {
            console.error("Fetch error:", err);
            alert("Something went wrong. Try again.");
            nextButton.textContent = "Proceed to Interview";
            nextButton.disabled = false;
        }
    });
});
