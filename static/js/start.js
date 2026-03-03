document.addEventListener('DOMContentLoaded', () => {
    // --- Background Slideshow ---
    const backgrounds = [
        'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        'https://images.pexels.com/photos/5668858/pexels-photo-5668858.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        'https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        'https://images.pexels.com/photos/7688162/pexels-photo-7688162.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
    ];

    const slider = document.getElementById('background-slider');
    backgrounds.forEach((bg, index) => {
        const div = document.createElement('div');
        div.className = 'background-image';
        if (index === 0) div.classList.add('active');
        div.style.backgroundImage = `url(${bg})`;
        slider.appendChild(div);
    });

    let currentBg = 0;
    const bgDivs = document.querySelectorAll('.background-image');
    setInterval(() => {
        bgDivs[currentBg].classList.remove('active');
        currentBg = (currentBg + 1) % backgrounds.length;
        bgDivs[currentBg].classList.add('active');
    }, 5000);

    // --- Tickers ---
    const motivational = [
        "Confidence is silent. Insecurities are loud.",
        "The best impression is an authentic one.",
        "Your only limit is your mind.",
        "Success is where preparation and opportunity meet.",
        "Clarity in speech leads to clarity in thought.",
        "Every challenge is a chance to prove your worth."
    ];

    const instructions = [
        "INSTRUCTIONS: Face the camera directly.",
        "Ensure your environment is well-lit and quiet.",
        "Speak clearly and at a moderate pace.",
        "Listen to questions before speaking.",
        "Maintain eye contact with the camera.",
        "Be yourself. Authenticity is key."
    ];

    const motivationalTicker = document.getElementById('motivational-ticker');
    const instructionTicker = document.getElementById('instruction-ticker');

    const fillTicker = (el, lines) => {
        const content = lines.map(l => `<span>${l}</span>`).join('');
        el.innerHTML = content + content;
    };

    fillTicker(motivationalTicker, motivational);
    fillTicker(instructionTicker, instructions);
});
