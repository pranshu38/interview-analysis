// Get data from hidden div
const dashData = document.getElementById("dashboard-data").dataset;

// Parse and fallback
const confidenceValue = parseInt(dashData.confidence) || 0;
const eyeContact = dashData.eye || 'N/A';
const sentimentPositive = parseInt(dashData.positive) || 0;
const sentimentNegative = parseInt(dashData.negative) || 0;
const sentimentNeutral = parseInt(dashData.neutral) || 0;

let fillerWords = {};
try {
  fillerWords = JSON.parse(dashData.filler || '{}');
} catch (e) { fillerWords = {}; }

const voiceClarity = parseFloat(dashData.clarity) || 0;
const keywordCoverage = parseInt(dashData.keywords) || 0;
const finalScore = parseInt(dashData.score) || 0;
const suggestions = dashData.suggestions || 'No suggestions available.';

// Fill text values
document.getElementById("eyeContactValue").textContent = eyeContact;
document.getElementById("clarityValue").textContent = voiceClarity + "/10";
document.getElementById("keywordBar").style.width = keywordCoverage + "%";
document.getElementById("keywordValue").textContent = keywordCoverage + "%";
document.getElementById("scoreValue").textContent = finalScore + "%";
document.getElementById("suggestionsText").textContent = suggestions;

// Filler words list
const fillerList = document.getElementById("fillerList");
fillerList.innerHTML = '';
for (let word in fillerWords) {
  const li = document.createElement("li");
  li.innerHTML = `"${word}" <span class="count">${fillerWords[word]}</span>`;
  fillerList.appendChild(li);
}

// Confidence Chart
new Chart(document.getElementById('confidenceChart'), {
  type: 'bar',
  data: {
    labels: ['Confidence'],
    datasets: [{
      data: [confidenceValue],
      backgroundColor: '#00cfff'
    }]
  },
  options: {
    responsive: true,
    plugins: { legend: { display: false }},
    scales: { y: { min: 0, max: 100 } }
  }
});

// Sentiment Chart
new Chart(document.getElementById('sentimentChart'), {
  type: 'doughnut',
  data: {
    labels: ['Positive', 'Negative', 'Neutral'],
    datasets: [{
      data: [sentimentPositive, sentimentNegative, sentimentNeutral],
      backgroundColor: ['#27ae60', '#e74c3c', '#95a5a6']
    }]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: 'bottom' } }
  }
});

// Final Score Gauge Chart
const gaugeCanvas = document.getElementById('finalScoreGauge');
if (gaugeCanvas) {
  const ctxGauge = gaugeCanvas.getContext('2d');
  new Chart(ctxGauge, {
    type: 'doughnut',
    data: {
      labels: ['Score', 'Remaining'],
      datasets: [{
        data: [finalScore, 100 - finalScore],
        backgroundColor: ['#00cfff', '#444'],
        borderWidth: 0
      }]
    },
    options: {
      rotation: -90,
      circumference: 180,
      cutout: '70%',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      animation: {
        onComplete: function(chart) {
          const { ctx, chartArea } = chart;
          const centerX = (chartArea.left + chartArea.right) / 2;
          const centerY = (chartArea.top + chartArea.bottom) / 2;
          ctx.save();
          ctx.font = "bold 26px Segoe UI";
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(finalScore + "%", centerX, centerY);
        }
      }
    }
  });
}
