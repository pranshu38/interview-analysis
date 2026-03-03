// interview.js — integrated version with hidden eye-contact analyzer
document.addEventListener('DOMContentLoaded', () => {
    const webcamPreview = document.getElementById('webcam-preview');
    const timerDisplay = document.getElementById('timer-display');
    const questionArea = document.getElementById('ai-question-area');
    const fakeProcessContainer = document.getElementById('fake-process-container');
    const submitBtn = document.getElementById('submit-btn');
    const nextBtn = document.getElementById('next-q-btn');
    const skipBtn = document.getElementById('skip-q-btn');
    const micCueContainer = document.getElementById('mic-cue-container');

    // Audio Analysis Elements (for per-question display only)
    const audioStatusText = document.getElementById('audio-status-text');

    let timerInterval, timerRunning = false, seconds = 0;
    let mediaRecorder, recordedChunks = [], interviewQuestions = [], currentQuestionIndex = 0;
    let answers = [], recognition, recognitionActive = false, speechAllowed = false;
    let voicesLoaded = false, voices = [], stream;
    const micOnSound = new Audio('/static/sounds/mic-on.mp3');

    const fillerWords = ['uh', 'uhh', 'um', 'umm', 'ah', 'aaa', 'ahh', 'like', 'so', 'actually', 'basically', 'you know'];

    let audioStatsPerQuestion = [];

    // Overlay for freeze effect
    const overlay = document.createElement('div');
    overlay.id = 'freezeOverlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.backdropFilter = 'blur(5px)';
    overlay.style.color = '#fff';
    overlay.style.fontSize = '1.4rem';
    overlay.style.fontWeight = '600';
    overlay.style.textAlign = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s ease';
    overlay.innerText = '⏸ Paused — Loading Next Question...';
    webcamPreview.parentElement.style.position = 'relative';
    webcamPreview.parentElement.appendChild(overlay);

    function showOverlay() { overlay.style.opacity = '1'; }
    function hideOverlay() { overlay.style.opacity = '0'; }

    // ================= INIT WEBCAM =================
    // Hidden eye-contact processing variables (added)
    let hiddenVideo = null;
    let faceMesh = null;
    let hiddenProcessing = false; // true while processing frames
    let eyeContactFrameBuffer = []; // collects per-frame isLooking (0/1) until 1 second
    let eyeContactPerSecond = []; // stores percentages per second
    let eyePerSecondInterval = null;
    let detectFrameHandle = null;

    // smoothing for final average (makes displayed average stable if you later want to show it)
    let smoothedAverage = null;
    const smoothingAlpha = 0.08; // small = slower smoothing

    async function initWebcam() {
        try {
            recordedChunks = [];
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            // Set visible preview
            webcamPreview.srcObject = stream;
            webcamPreview.muted = true;
            await webcamPreview.play().catch(()=>{});

            // MediaRecorder for uploading video later
            try {
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            } catch(e) {
                // Fallback if mimeType unsupported
                mediaRecorder = new MediaRecorder(stream);
            }
            mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
            mediaRecorder.onstop = handleStop;
            mediaRecorder.start();

            // start timer
            startTimer();

            // Setup hidden analyzer using the same stream
            setupHiddenEyeAnalyzer(stream);
        } catch (err) {
            console.error("Media access error:", err);
            questionArea.textContent = "Webcam/Mic access denied. Please allow permissions and refresh.";
            nextBtn.disabled = true;
            skipBtn.disabled = true;
            submitBtn.disabled = true;
        }
    }

    // ================= TIMER =================
    function startTimer() {
        if (timerRunning) return;
        timerRunning = true;
        timerInterval = setInterval(() => {
            seconds++;
            const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
            const secs = String(seconds % 60).padStart(2, '0');
            timerDisplay.textContent = `${minutes}:${secs}`;
        }, 1000);
    }
    function pauseTimer() { if (timerRunning) { clearInterval(timerInterval); timerRunning = false; } }
    function stopTimer() { clearInterval(timerInterval); timerRunning = false; }
    function resetTimer() { stopTimer(); seconds = 0; timerDisplay.textContent = '00:00'; }

    // ================= CAMERA CONTROL =================
    function freezeCamera() {
        if (webcamPreview && !webcamPreview.paused) {
            try { webcamPreview.pause(); } catch(e){}
            pauseTimer();
            webcamPreview.style.filter = 'blur(5px) brightness(0.7)';
            showOverlay();
            stopAudioAnalysis();
            pauseEyeAnalyzer(); // pause hidden detection
        }
    }

    function resumeCamera() {
        if (webcamPreview && webcamPreview.paused) {
            try { webcamPreview.play(); } catch(e){}
            startTimer();
            webcamPreview.style.filter = 'none';
            hideOverlay();
            startAudioAnalysis(currentQuestionIndex);
            resumeEyeAnalyzer(); // resume hidden detection
        }
    }

    // ================= FETCH QUESTIONS =================
    async function fetchQuestions() {
        try {
            const res = await fetch('/get_questions');
            const data = await res.json();
            if (!data.questions || !data.questions.length) {
                questionArea.textContent = "No questions available. Try again later.";
                nextBtn.disabled = true;
                skipBtn.disabled = true;
                return;
            }
            interviewQuestions = data.questions.map(q => ({
                text: q.text || q.question || "No question text",
                source: q.source || "general",
                keywords: q.keywords || []
            }));
            currentQuestionIndex = 0;
            answers = new Array(interviewQuestions.length).fill("");
            audioStatsPerQuestion = new Array(interviewQuestions.length).fill(null);
            displayQuestion(currentQuestionIndex);
        } catch (err) {
            console.error("Error fetching questions:", err);
            questionArea.textContent = "Could not load questions. Try refreshing.";
            nextBtn.disabled = true;
            skipBtn.disabled = true;
        }
    }

    // ================= DISPLAY QUESTION =================
    function displayQuestion(index) {
        if (index >= interviewQuestions.length) {
            questionArea.textContent = "🎉 You have completed all questions!";
            nextBtn.disabled = true;
            skipBtn.disabled = true;
            return;
        }

        const q = interviewQuestions[index];
        questionArea.innerHTML = `
            <div><strong>Question ${index + 1}:</strong> ${q.text} <br><small>Source: ${q.source}</small></div>
            <div id="answer-${index}" style="margin-top:10px;padding:8px;background-color:#1e293b;color:#f1f5f9;">
                ${answers[index] && answers[index] !== "__SKIPPED__" ? answers[index] : ""}
            </div>
        `;
        // resume camera and audio analysis
        resumeCamera();
        startTimer();
        if (speechAllowed) speakQuestionThenMicCue(q.text, index);
    }

    // ================= SPEAK QUESTION + MIC CUE =================
    function speakQuestionThenMicCue(text, index) {
        stopTranscription();
        const utterance = new SpeechSynthesisUtterance(text);

        function selectIndianFemaleVoice(voices) {
            const indianFemale = voices.find(v =>
                v.lang === 'en-IN' &&
                (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('heera') || v.name.toLowerCase().includes('meera'))
            );
            return indianFemale || voices.find(v => v.lang === 'en-IN') || voices[0];
        }

        function startSpeaking() {
            utterance.voice = selectIndianFemaleVoice(voices);
            utterance.rate = 1;
            utterance.pitch = 1.2;
            utterance.onend = () => startAnswering(index);
            speechSynthesis.speak(utterance);
        }

        if (!voicesLoaded) {
            voices = speechSynthesis.getVoices();
            if (voices.length) {
                voicesLoaded = true;
                startSpeaking();
            } else {
                speechSynthesis.onvoiceschanged = () => {
                    voices = speechSynthesis.getVoices();
                    voicesLoaded = true;
                    startSpeaking();
                };
            }
        } else startSpeaking();
    }

    // ================= START ANSWER WITH MIC CUE =================
    function startAnswering(index) {
        if (micCueContainer) {
            micCueContainer.style.display = 'block';
            micCueContainer.classList.add('mic-beat');
            try { micOnSound.play(); } catch(e){}
        }
        const answerDiv = document.getElementById(`answer-${index}`);
        startTranscription(answerDiv, index);
    }

    // ================= SPEECH RECOGNITION =================
    function startTranscription(answerDiv, index) {
        stopTranscription();
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            answerDiv.innerText = "Speech recognition not supported in your browser.";
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognitionActive = true;

        let finalTranscript = answers[index] && answers[index] !== "__SKIPPED__" ? answers[index] : "";

        recognition.onresult = (event) => {
            let interimTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) finalTranscript += transcript + " ";
                else interimTranscript += transcript;
            }
            answers[index] = finalTranscript + interimTranscript;
            answerDiv.innerText = finalTranscript + interimTranscript;
        };

        recognition.onend = () => { if (recognitionActive && currentQuestionIndex === index) recognition.start(); };
        recognition.start();
        startAudioAnalysis(index);
    }

    function stopTranscription() {
        if (recognition) {
            recognitionActive = false;
            recognition.onend = null;
            try { recognition.stop(); } catch (e) {}
            recognition = null;
        }
        stopAudioAnalysis();
    }

    // ================= AUDIO ANALYSIS (PER QUESTION VISUAL ONLY) =================
    let audioAnalysisInterval;
    function startAudioAnalysis(index) {
        audioStatusText.textContent = 'Recording';
        if (audioAnalysisInterval) clearInterval(audioAnalysisInterval);
        audioAnalysisInterval = setInterval(() => { /* nothing for dashboard here */ }, 1000);
    }

    function stopAudioAnalysis() {
        audioStatusText.textContent = 'Idle';
        if (audioAnalysisInterval) clearInterval(audioAnalysisInterval);
    }

    // ================= NEXT/SKIP =================
    function goToNextQuestion(skipped = false) {
        stopTranscription();
        freezeCamera();

        const currentAnswerDiv = document.getElementById(`answer-${currentQuestionIndex}`);
        answers[currentQuestionIndex] = skipped ? "__SKIPPED__" : (currentAnswerDiv ? currentAnswerDiv.innerText : "");

        evaluateAnswer(currentQuestionIndex).then(() => {
            nextBtn.disabled = true;
            skipBtn.disabled = true;
            showFakeProcess(() => {
                currentQuestionIndex++;
                if (micCueContainer) micCueContainer.style.display = 'none';
                displayQuestion(currentQuestionIndex);
                nextBtn.disabled = false;
                skipBtn.disabled = false;
            });
        });
    }

    nextBtn.addEventListener('click', () => goToNextQuestion(false));
    skipBtn.addEventListener('click', () => goToNextQuestion(true));

    // ================= FAKE PROCESS =================
    function showFakeProcess(callback) {
        fakeProcessContainer.style.display = 'block';
        fakeProcessContainer.innerHTML = `<div class="fake-interview-msg"><i class='bx bx-loader-alt spinner'></i> Processing your answer...</div>`;
        setTimeout(() => { fakeProcessContainer.style.display = 'none'; if (callback) callback(); }, 2000);
    }

    // ================= EVALUATE ANSWER =================
    async function evaluateAnswer(index) {
        if (index >= interviewQuestions.length) return;
        const answer = answers[index] || "";
        const question = interviewQuestions[index].text;
        try {
            await fetch("/evaluate_answer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ index, answer, question })
            });
        } catch (err) { console.error("Error evaluating answer:", err); }
    }

    // ================= SUBMIT =================
    submitBtn.addEventListener('click', async () => {
        stopTimer();
        stopTranscription();
        freezeCamera();

        interviewQuestions.forEach((q, idx) => {
            const div = document.getElementById(`answer-${idx}`);
            if (div) answers[idx] = div.innerText.trim();
        });

        if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();

        submitBtn.textContent = "Analyzing...";
        submitBtn.disabled = true;
        nextBtn.disabled = true;
        skipBtn.disabled = true;
    });

    // ================= HANDLE STOP =================
    async function handleStop() {
        // Stop background analysis first
        stopEyeAnalyzer();

        const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
        const formData = new FormData();
        formData.append('video', videoBlob, 'interview_capture.webm');
        formData.append('answers', JSON.stringify(answers));

        // ===== FINAL DASHBOARD CALCULATION =====
        let totalWords = 0, totalFillers = [], totalKeywords = 0, keywordsUsed = 0;
        let dictionary = new Set(["a","able","about","above","accept","account","across","act","action","activity","actually","add","address","admin","answer","interview"]);
        let totalSpellingScore = 0, totalWordsCounted = 0;

        interviewQuestions.forEach((q, idx) => {
            const ans = answers[idx] || "";
            const words = ans.split(/\s+/).filter(Boolean);
            totalWords += words.length;

            // Fillers
            const foundFillers = words.filter(w => fillerWords.includes(w.toLowerCase().replace(/[^a-z]/gi, "")));
            totalFillers.push(...foundFillers);

            // Keywords
            const kws = q.keywords || [];
            totalKeywords += kws.length;
            kws.forEach(kw => { if (ans.toLowerCase().includes(kw.toLowerCase())) keywordsUsed++; });

            // Clarity
            words.forEach(w => { 
                totalWordsCounted++; 
                totalSpellingScore += dictionary.has(w.toLowerCase()) ? 1 : 0; 
            });
        });

        const totalTimeSec = seconds || 1;
        const averageWPM = Math.round((totalWords / totalTimeSec) * 60);
        const keywordCoverage = totalKeywords ? Math.round((keywordsUsed / totalKeywords) * 100) : 0;
        const clarity = totalWordsCounted ? Math.min(10, Math.round((totalSpellingScore / totalWordsCounted) * 10)) : 0;

        let suggestions = [];
        if (averageWPM < 100) suggestions.push("Try to speak a bit faster.");
        if (totalFillers.length > 10) suggestions.push("Reduce filler words for clarity.");
        if (keywordCoverage < 50) suggestions.push("Try to include more relevant keywords.");
        if (clarity < 6) suggestions.push("Focus on clearer pronunciation and correct spelling.");
        if (suggestions.length === 0) suggestions.push("Great job! Keep up the good performance.");

        // Compute average eye contact from eyeContactPerSecond (if available)
        let averageEyeContact = 0;
        if (eyeContactPerSecond && eyeContactPerSecond.length) {
            const sum = eyeContactPerSecond.reduce((a,b)=>a+b,0);
            averageEyeContact = +(sum / eyeContactPerSecond.length).toFixed(1);

            // optional smoothing for stable final value
            if (smoothedAverage === null) smoothedAverage = averageEyeContact;
            else smoothedAverage = smoothedAverage + smoothingAlpha * (averageEyeContact - smoothedAverage);
            averageEyeContact = +smoothedAverage.toFixed(1);
        } else {
            averageEyeContact = 'N/A';
        }

        // Save aggregated dashboard data including eye contact
        localStorage.setItem('dashboardData', JSON.stringify({
            totalWords,
            wpm: averageWPM,
            fillers: totalFillers,
            confidence: 0,
            eye: averageEyeContact,
            positive: 0,
            negative: 0,
            neutral: 0,
            clarity: clarity,
            keywords: keywordCoverage,
            score: 0,
            suggestions: suggestions.join(" ")
        }));

        // Stop tracks now (we stopped analysis already)
        if (stream) stream.getTracks().forEach(track => track.stop());

        // Send video + answers to server
        try {
            const res = await fetch('/analyze', { method: 'POST', body: formData });
            const data = await res.json();
            window.location.href = data.redirect || "/review";
        } catch (err) {
            console.error("Error sending video:", err);
            submitBtn.textContent = "Error! Try Again";
            submitBtn.disabled = false;
        }
    }

    // =================== EYE CONTACT ANALYZER (Hidden, using same stream) ===================
    // We dynamically load MediaPipe FaceMesh to avoid modifying HTML.
    function loadMediaPipe(callback) {
        // Only load once
        if (window.FaceMesh && window.drawConnectors) { callback(); return; }

        const s1 = document.createElement('script');
        s1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
        s1.onload = () => {
            const s2 = document.createElement('script');
            s2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
            s2.onload = () => {
                callback();
            };
            s2.onerror = () => { console.warn('Failed to load drawing_utils'); callback(); };
            document.head.appendChild(s2);
        };
        s1.onerror = () => { console.warn('Failed to load face_mesh'); callback(); };
        document.head.appendChild(s1);
    }

    function setupHiddenEyeAnalyzer(stream) {
        // create a hidden video element (not shown to user)
        hiddenVideo = document.createElement('video');
        hiddenVideo.autoplay = true;
        hiddenVideo.muted = true;
        hiddenVideo.playsInline = true;
        hiddenVideo.style.display = 'none';
        hiddenVideo.srcObject = stream;
        document.body.appendChild(hiddenVideo);

        // create offscreen canvas if needed (not appended)
        const offscreenCanvas = document.createElement('canvas');
        const offscreenCtx = offscreenCanvas.getContext('2d');

        loadMediaPipe(() => {
            try {
                faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
                faceMesh.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
                faceMesh.onResults(onFaceResults);
            } catch (e) {
                console.warn('MediaPipe initialization failed', e);
                faceMesh = null;
            }

            hiddenVideo.onloadeddata = () => {
                offscreenCanvas.width = hiddenVideo.videoWidth || 640;
                offscreenCanvas.height = hiddenVideo.videoHeight || 480;
                // start processing loop
                startEyeAnalyzer();
            };
        });
    }

    // EAR helper
    function distance(a,b){ return Math.hypot(a.x - b.x, a.y - b.y); }
    function computeEAR(eyeLandmarks){
        // expects 6 landmarks for eye
        const [p1,p2,p3,p4,p5,p6] = eyeLandmarks;
        return (distance(p2,p6) + distance(p3,p5)) / (2 * distance(p1,p4));
    }

    // Process face results
    function onFaceResults(results) {
        if (!hiddenProcessing) return; // only if analyzer active
        let isLooking = 0;

        if (results && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];

            // LEFT EYE: points 33,160,158,133,153,144
            const leftEye = [landmarks[33], landmarks[160], landmarks[158], landmarks[133], landmarks[153], landmarks[144]];
            // RIGHT EYE: points 362,385,387,263,373,380
            const rightEye = [landmarks[362], landmarks[385], landmarks[387], landmarks[263], landmarks[373], landmarks[380]];

            const leftEAR = computeEAR(leftEye);
            const rightEAR = computeEAR(rightEye);
            const eyesOpen = (leftEAR > 0.18 && rightEAR > 0.18); // tuned threshold

            // Head yaw (nose vs chin x)
            const noseX = landmarks[1].x;
            const chinX = landmarks[152].x;
            const headYaw = chinX - noseX;

            // Count as looking if eyes open and head roughly centered
            if (eyesOpen && headYaw > -0.08 && headYaw < 0.08) isLooking = 1;
        }

        // push per-frame
        eyeContactFrameBuffer.push(isLooking);
    }

    // Send frames to faceMesh in a loop
    async function eyeDetectLoop() {
        if (!hiddenProcessing) return;
        if (faceMesh && hiddenVideo && hiddenVideo.readyState >= 2) {
            try {
                await faceMesh.send({ image: hiddenVideo });
            } catch (e) {
                // ignore transient errors
            }
        }
        detectFrameHandle = requestAnimationFrame(eyeDetectLoop);
    }

    function startEyeAnalyzer() {
        if (hiddenProcessing) return;
        hiddenProcessing = true;
        eyeContactFrameBuffer = [];
        eyeContactPerSecond = [];
        // start frame loop
        eyeDetectLoop();

        // per-second interval: compute percent of frames that were 1 (looking)
        if (eyePerSecondInterval) clearInterval(eyePerSecondInterval);
        eyePerSecondInterval = setInterval(() => {
            if (!hiddenProcessing) return;
            const frames = Math.max(1, eyeContactFrameBuffer.length);
            const sum = eyeContactFrameBuffer.reduce((a,b)=>a+b,0);
            const percent = (sum / frames) * 100;
            eyeContactPerSecond.push(+percent.toFixed(1));
            eyeContactFrameBuffer = [];
        }, 1000);
    }

    function pauseEyeAnalyzer() {
        hiddenProcessing = false;
        if (eyePerSecondInterval) { clearInterval(eyePerSecondInterval); eyePerSecondInterval = null; }
        if (detectFrameHandle) { cancelAnimationFrame(detectFrameHandle); detectFrameHandle = null; }
    }

    function resumeEyeAnalyzer() {
        if (hiddenProcessing) return;
        hiddenProcessing = true;
        // resume loops
        eyeDetectLoop();
        if (eyePerSecondInterval) clearInterval(eyePerSecondInterval);
        eyePerSecondInterval = setInterval(() => {
            if (!hiddenProcessing) return;
            const frames = Math.max(1, eyeContactFrameBuffer.length);
            const sum = eyeContactFrameBuffer.reduce((a,b)=>a+b,0);
            const percent = (sum / frames) * 100;
            eyeContactPerSecond.push(+percent.toFixed(1));
            eyeContactFrameBuffer = [];
        }, 1000);
    }

    function stopEyeAnalyzer() {
        hiddenProcessing = false;
        if (eyePerSecondInterval) { clearInterval(eyePerSecondInterval); eyePerSecondInterval = null; }
        if (detectFrameHandle) { cancelAnimationFrame(detectFrameHandle); detectFrameHandle = null; }
        // cleanup hidden video element
        if (hiddenVideo) {
            try { hiddenVideo.pause(); hiddenVideo.srcObject = null; hiddenVideo.remove(); } catch(e){}
            hiddenVideo = null;
        }
        // destroy faceMesh if present (try to call close if exists)
        try { if (faceMesh && typeof faceMesh.close === 'function') faceMesh.close(); } catch(e){}
        faceMesh = null;
    }

    // Unlock speech on first click
    document.addEventListener('click', () => {
        if (!speechAllowed) {
            speechAllowed = true;
            try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch(e){}
            if (interviewQuestions[currentQuestionIndex]) {
                speakQuestionThenMicCue(interviewQuestions[currentQuestionIndex].text || '', currentQuestionIndex);
            }
        }
    }, { once: true });

    // Start everything
    initWebcam();
    fetchQuestions();
});
