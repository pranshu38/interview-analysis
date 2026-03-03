document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('resume-file-input');
    const fileNameDisplay = document.getElementById('file-name-display');
    const uploadArea = document.querySelector('.upload-area');
    const uploadSection = document.getElementById('upload-section');
    const analysisSection = document.getElementById('analysis-section');

    if (!fileInput) return;

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            handleFile(file);
        }
    });
    
    // Optional: Add drag and drop functionality
    uploadArea.addEventListener('dragover', (e) => e.preventDefault());
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if(file) handleFile(file);
    });

    function handleFile(file) {
        fileNameDisplay.textContent = file.name;

        // --- Simulate Analysis ---
        uploadArea.innerHTML = `
            <div class="spinner"></div>
            <p>Analyzing your resume...</p>`;
        
        setTimeout(() => {
            uploadSection.style.display = 'none';
            analysisSection.style.display = 'grid';
            runAnalysisAnimation();
        }, 2500); // Simulate 2.5 second analysis
    }

    function runAnalysisAnimation() {
        // --- 1. Animate Match Score Chart ---
        const scoreCtx = document.getElementById('matchScoreChart');
        const scoreValue = 78;
        if(scoreCtx) {
            new Chart(scoreCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [scoreValue, 100 - scoreValue],
                        backgroundColor: ['var(--accent-primary)', '#e5e7eb'],
                        borderColor: 'transparent',
                        borderRadius: 5,
                        cutout: '80%'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { animateRotate: true, duration: 1500 },
                    plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }
            });
        }
        
        // --- 2. Animate Counter ---
        const counter = document.querySelector('.match-score-text');
        if(counter) {
            const target = +counter.dataset.count;
            let startTime;
            function animate(timestamp) {
                if (!startTime) startTime = timestamp;
                const progress = Math.min((timestamp - startTime) / 1500, 1);
                counter.innerText = Math.floor(progress * target) + '%';
                if (progress < 1) requestAnimationFrame(animate);
            }
            requestAnimationFrame(animate);
        }

        // --- 3. Populate Keywords ---
        const keywordsList = document.getElementById('keywords-list');
        if(keywordsList) {
            const keywords = [
                { name: 'Python', found: true },
                { name: 'JavaScript', found: true },
                { name: 'Project Management', found: true },
                { name: 'Agile', found: false },
                { name: 'SQL', found: true },
            ];
            keywordsList.innerHTML = '';
            keywords.forEach(kw => {
                const li = document.createElement('li');
                li.className = kw.found ? 'found' : 'missing';
                li.innerHTML = `<i class='bx ${kw.found ? 'bx-check-circle' : 'bx-x-circle'}'></i> ${kw.name}`;
                keywordsList.appendChild(li);
            });
        }
    }
});

// Add a simple spinner style for the loading animation
const style = document.createElement('style');
style.innerHTML = `
.spinner {
    width: 56px;
    height: 56px;
    border: 5px solid #f3f3f3;
    border-top: 5px solid var(--accent-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;
document.head.appendChild(style);
