document.addEventListener("DOMContentLoaded", () => {
    const solutionContainer = document.getElementById("solution-answers");

    // Create and show loader
    const loaderDiv = document.createElement("div");
    loaderDiv.className = "loader";
    solutionContainer.appendChild(loaderDiv);

    // Fetch AI model answers from server
    fetch("/get_model_answers")
        .then(response => response.json())
        .then(data => {
            // Remove loader
            solutionContainer.removeChild(loaderDiv);

            const answers = data.model_answers || [];

            if (!answers.length) {
                const emptyMsg = document.createElement("p");
                emptyMsg.style.textAlign = "center";
                emptyMsg.style.fontSize = "1.2rem";
                emptyMsg.textContent = "No AI recommended answers available at the moment.";
                solutionContainer.appendChild(emptyMsg);
                return;
            }

            // Append each answer as a card
            answers.forEach((item, idx) => {
                const answerCard = document.createElement("div");
                answerCard.className = "answer-card";

                answerCard.innerHTML = `
                    <h3>Q${idx + 1}: ${item.question}</h3>
                    <p>${item.model_answer}</p>
                `;

                solutionContainer.appendChild(answerCard);
            });
        })
        .catch(err => {
            solutionContainer.innerHTML = `
                <p style="text-align:center;color:#ff4d4d;font-size:1.2rem;">
                    Error fetching AI recommended answers. Please try again later.
                </p>`;
            console.error("Error fetching AI recommended answers:", err);
        });
});
