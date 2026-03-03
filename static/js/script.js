// --- Main Entry Point ---
// This function runs only after the entire HTML page is loaded.
document.addEventListener("DOMContentLoaded", function() {
    
    // Check which page is active by looking for a unique element on that page.
    if (document.querySelector('.interview-page-container')) {
        initInterviewPage();
    } else if (document.querySelector('.dashboard-grid')) {
        initDashboardPage();
    }
    // Add other page initializers here if needed
});


// =========================================================================
// --- INTERVIEW PAGE SCRIPT (UPGRADED WITH RECORDING) ---
// =========================================================================
function initInterviewPage() {
    const webcamPreview = document.getElementById('webcam-preview');
    const timerDisplay = document.getElementById('timer-display');
    const generateBtn = document.getElementById('generate-q-btn');
    const submitBtn = document.getElementById('submit-btn');
    
    let timerInterval;
    let mediaRecorder; // To hold the recording object
    let recordedChunks = []; // To store the video data

    // --- 1. Webcam and Recording Start ---
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                webcamPreview.srcObject = stream;
                startTimer();

                // --- NEW: Start Recording the Stream ---
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        recordedChunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = handleStop;
                mediaRecorder.start();
                // ---------------------------

            })
            .catch(err => {
                console.error("Media access error:", err);
                document.getElementById('ai-question-area').textContent = "Webcam/Mic access denied. Please allow permissions and refresh.";
            });
    }

    function startTimer() {
        let seconds = 0;
        if (timerInterval) clearInterval(timerInterval); 
        timerInterval = setInterval(() => {
            seconds++;
            const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
            const secs = String(seconds % 60).padStart(2, '0');
            timerDisplay.textContent = `${minutes}:${secs}`;
        }, 1000);
    }

    // --- 2. Generate Question Button (remains the same) ---
    generateBtn.addEventListener('click', () => {
        const questions = ["What is a REST API?", "Describe a challenging project.", "How do you handle deadlines?"];
        const randQ = questions[Math.floor(Math.random() * questions.length)];
        document.getElementById('ai-question-area').innerText = randQ;
    });

    // --- 3. Stop & Submit Button (NEW LOGIC) ---
    submitBtn.addEventListener('click', () => {
        clearInterval(timerInterval);
        const stream = webcamPreview.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        submitBtn.textContent = "Analyzing...";
        submitBtn.disabled = true;

        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        } else {
            // Handle case where recorder isn't active
            handleStop();
        }
    });

    // --- 4. NEW: Function to handle sending the video to the backend ---
    function handleStop() {
        const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });

        const formData = new FormData();
        formData.append('video', videoBlob, 'interview_capture.webm');

        fetch('/analyze', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log('Analysis from backend:', data);
            
            // Store the backend's analysis results in session storage
            sessionStorage.setItem('analysisResults', JSON.stringify(data));
            
            // NOW, redirect to the dashboard
            window.location.href = "/dashboard";
        })
        .catch(error => {
            console.error('Error sending video to backend:', error);
            submitBtn.textContent = "Error! Try Again";
            submitBtn.disabled = false;
        });
    }
}


// =========================================================================
// --- DASHBOARD PAGE SCRIPT (UPGRADED TO RECEIVE BACKEND DATA) ---
// =========================================================================
function initDashboardPage() {
    // --- 1. Get Data: Check for backend results first, then use fallback data ---
    const backendResults = JSON.parse(sessionStorage.getItem('analysisResults'));

    const analysisData = backendResults || {
        // Fallback dummy data if you visit the page directly
        confidence: 85,
        sentiment: [65, 10, 25],
        filler_words: [{ word: '"Um"', count: 8}, { word: '"Ah"', count: 5}, { word: '"Like"', count: 3}],
        clarity: 8.5,
        keywords: 75,
        final_score: 82,
        suggestions: "This is fallback data. Complete an interview to see real analysis."
    };
    
    // --- 2. Initialize Charts and Display Data ---
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = 'var(--text-secondary)';

    const confidenceCtx = document.getElementById('confidenceChart');
    if (confidenceCtx) {
        new Chart(confidenceCtx.getContext('2d'), {
            type: 'bar',
            data: { 
                labels: ['Confidence'], 
                datasets: [{ data: [analysisData.confidence], backgroundColor: ['var(--accent-cyan)'], borderRadius: 5, barThickness: 35 }] 
            },
            options: { 
                indexAxis: 'y', 
                plugins: { legend: { display: false } }, 
                scales: { 
                    x: { max: 100, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'var(--text-secondary)'} },
                    y: { grid: { display: false }, ticks: { display: false } }
                }
            }
        });
    }

    const sentimentCtx = document.getElementById('sentimentChart');
    if (sentimentCtx) {
        new Chart(sentimentCtx.getContext('2d'), {
            type: 'doughnut',
            data: { 
                labels: ['Positive', 'Negative', 'Neutral'], 
                datasets: [{ data: analysisData.sentiment, backgroundColor: ['var(--accent-green)', 'var(--accent-red)', '#6b7280'], borderWidth: 0 }] 
            },
            options: { cutout: '70%', plugins: { legend: { position: 'bottom', labels: {color: 'var(--text-primary)'} } } }
        });
    }
    
    const fillerList = document.getElementById('filler-words-list-ul');
    if(fillerList) {
        fillerList.innerHTML = '';
        if (analysisData.filler_words && analysisData.filler_words.length > 0) {
            analysisData.filler_words.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${item.word}</span><span class="count">${item.count}</span>`;
                fillerList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No filler words detected!';
            fillerList.appendChild(li);
        }
    }
    
    const suggestionsEl = document.querySelector('.final-score-card p');
    if(suggestionsEl) {
        suggestionsEl.textContent = analysisData.suggestions;
    }

    // Set data attributes for animation
    document.querySelector('.final-score-value').dataset.count = analysisData.final_score;
    document.querySelector('.progress-label').dataset.count = analysisData.keywords;
    document.querySelector('.large-metric .value[data-count]').dataset.count = analysisData.clarity;
    
    const keywordProgress = document.getElementById('keyword-progress');
    if(keywordProgress) {
      keywordProgress.style.width = analysisData.keywords + '%';
    }
    
    animateCounters('.page-container');

    // IMPORTANT: Clear the storage so you don't see old results on a refresh
    sessionStorage.removeItem('analysisResults');
}

// --- UTILITY: Count-up Animation ---
function animateCounters(selector) {
     document.querySelectorAll(`${selector} [data-count]`).forEach(counter => {
        const target = parseFloat(counter.dataset.count);
        if (isNaN(target)) return;
        
        const isDecimal = !Number.isInteger(target);
        let startTime;

        function animate(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / 1500, 1);
            let currentValue = progress * target;
            
            if (isDecimal) {
                counter.innerText = currentValue.toFixed(1);
            } else {
                if(counter.classList.contains('final-score-value') || counter.classList.contains('progress-label')) {
                    counter.innerText = Math.floor(currentValue) + '%';
                } else {
                    counter.innerText = Math.floor(currentValue);
                }
            }
            
            if (progress < 1) requestAnimationFrame(animate);
        }
        setTimeout(() => requestAnimationFrame(animate), 300);
    });
}

