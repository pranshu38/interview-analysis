document.addEventListener('DOMContentLoaded', () => {
    // --- Initialize Tabs ---
    const tabs = document.querySelectorAll('.tab');
    const panes = document.querySelectorAll('.tab-pane');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const targetPane = document.getElementById(tab.dataset.tab);
            if(targetPane) targetPane.classList.add('active');
        });
    });

    // --- Initialize Accordion ---
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('open');
        });
    });

    // --- Chart Defaults for the DARK THEME ---
    Chart.defaults.color = 'var(--text-secondary)';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // --- Initialize All Charts ---
    
    // 1. Radar Charts
    const radarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                pointLabels: { color: 'var(--text-primary)', font: { size: 14 } },
                ticks: { display: false },
                suggestedMin: 0,
                suggestedMax: 100
            }
        },
        plugins: { legend: { display: false } }
    };

    const radarChart1El = document.getElementById('radarChart1');
    if (radarChart1El) {
        new Chart(radarChart1El, {
            type: 'radar',
            data: {
                labels: ['Clarity', 'Confidence', 'Keywords'],
                datasets: [{ 
                    label: 'Q1 Score', 
                    data: [85, 90, 75], 
                    backgroundColor: 'rgba(34, 211, 238, 0.2)', 
                    borderColor: 'var(--accent-cyan)', 
                    borderWidth: 2 
                }]
            },
            options: radarOptions
        });
    }

    const radarChart2El = document.getElementById('radarChart2');
    if (radarChart2El) {
         new Chart(radarChart2El, {
            type: 'radar',
            data: {
                labels: ['Clarity', 'Confidence', 'Keywords'],
                datasets: [{ 
                    label: 'Q2 Score', 
                    data: [70, 88, 50], 
                    backgroundColor: 'rgba(239, 68, 68, 0.2)', 
                    borderColor: 'var(--accent-red)', 
                    borderWidth: 2 
                }]
            },
            options: radarOptions
        });
    }

    // 2. Confidence Heatmap (Line Chart)
    const confidenceChartEl = document.getElementById('confidenceChart');
    if (confidenceChartEl) {
        new Chart(confidenceChartEl, {
            type: 'line',
            data: {
                labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
                datasets: [{
                    label: 'Confidence Level',
                    data: [90, 88, 75, 82, 85],
                    borderColor: 'var(--accent-purple)',
                    backgroundColor: 'rgba(167, 139, 250, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // 3. Sentiment Trend Chart
    const sentimentTrendChartEl = document.getElementById('sentimentTrendChart');
    if (sentimentTrendChartEl) {
        new Chart(sentimentTrendChartEl, {
            type: 'line',
            data: {
                labels: ['Start', 'Midpoint', 'End'],
                datasets: [
                    { label: 'Positive', data: [70, 80, 75], borderColor: 'var(--accent-green)' },
                    { label: 'Negative', data: [10, 5, 15], borderColor: 'var(--accent-red)' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
});

