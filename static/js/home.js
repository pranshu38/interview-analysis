document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('resume-file-input');
    const jobSelect = document.getElementById('job-field-select');
    const nextButton = document.getElementById('next-button');
    const fileNameDisplay = document.getElementById('file-name-display');
    const fakeProcessContainer = document.getElementById('fake-process-container');

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
        fileNameDisplay.textContent = isFileUploaded ? fileInput.files[0].name : "No file selected";
        checkCompletion();
    });

    // --- Job field selection ---
    jobSelect.addEventListener('change', () => {
        isJobSelected = !!jobSelect.value;
        checkCompletion();
    });

    // --- Fake processing messages ---
    const fakeMessages = [
        "Uploading resume...",
        "Extracting resume content...",
        "Resume extraction successful.",
        "Generating general questions...",
        "Generating technical questions...",
        "Generating questions from resume...",
        "Almost done. Preparing your personalized interview..."
    ];

    function showFakeProcess() {
        fakeProcessContainer.innerHTML = "";
        let i = 0;

        return new Promise((resolve) => {
            const interval = setInterval(() => {
                if (i >= fakeMessages.length) {
                    clearInterval(interval);
                    resolve(); // Fake process done
                    return;
                }
                const msg = document.createElement("p");
                msg.classList.add("fake-msg");
                msg.textContent = fakeMessages[i];
                fakeProcessContainer.appendChild(msg);
                msg.scrollIntoView({ behavior: "smooth" });
                i++;
            }, 5000); // 5 seconds interval
        });
    }

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

        nextButton.textContent = "Processing...";
        nextButton.disabled = true;

        // --- Start fake front-end animation ---
        const fakeProcessPromise = showFakeProcess();

        try {
            // --- Backend request ---
            const response = await fetch("/start_session", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (data.error) {
                alert("Error: " + data.error);
                nextButton.textContent = "Proceed to Interview";
                nextButton.disabled = false;
                return;
            }

            console.log(">>> Backend:", data.message);

            // --- Wait for fake process to finish too ---
            await fakeProcessPromise;

            // --- Redirect after both backend & fake process complete ---
            window.location.href = "/interview";

        } catch (err) {
            console.error("Fetch error:", err);
            alert("Something went wrong. Try again.");
            nextButton.textContent = "Proceed to Interview";
            nextButton.disabled = false;
        }
    });
});
