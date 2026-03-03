document.addEventListener("DOMContentLoaded", async () => {
    const reviewList = document.getElementById("reviewList");

    try {
        // Fetch questions + answers from backend
        const res = await fetch("/get_questions");
        const data = await res.json();
        const qaLog = data.questions || []; // qa_log stored in session

        if (!qaLog.length) {
            reviewList.innerHTML = `<p class="text-center text-slate-500">No interview data found.</p>`;
            return;
        }

        // Create question-answer cards
        qaLog.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "question-card border border-orange-400 rounded-lg overflow-hidden shadow-md bg-slate-800 mb-3";

            const questionBtn = document.createElement("button");
            questionBtn.className = "w-full text-left px-4 py-3 bg-slate-700 hover:bg-slate-600 focus:outline-none font-semibold text-orange-300 transition-colors duration-200 flex justify-between items-center";
            questionBtn.innerHTML = `<span>Q${index + 1}: ${item.question?.trim() || "No question text available."}</span>
                                     <span class="text-orange-400 transform transition-transform duration-200">&#9656;</span>`;

            const answerDiv = document.createElement("div");
            answerDiv.className = "px-4 py-3 bg-slate-800 hidden text-slate-300";
            answerDiv.innerText = (item.answer && item.answer.trim() !== "") ? item.answer : "No answer detected.";

            // Toggle answer visibility
            questionBtn.addEventListener("click", () => {
                answerDiv.classList.toggle("hidden");
                const chevron = questionBtn.querySelector("span:last-child");
                chevron.classList.toggle("rotate-90");
            });

            card.appendChild(questionBtn);
            card.appendChild(answerDiv);
            reviewList.appendChild(card);
        });

    } catch (err) {
        console.error("Error loading review:", err);
        reviewList.innerHTML = `<p class="text-center text-red-500">Error loading review data.</p>`;
    }
});
