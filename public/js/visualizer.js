// ========================================
// VISUALISEUR AUDIO (VIOLET + GLOW 🌟)
// ========================================

function drawVisualizer() {
    if (typeof personalization !== 'undefined' && personalization.visualizerType === 'none') {
        clearAllCanvases();
        return;
    }

    if (!analyser || !dataArray) return;

    const canvas1 = document.getElementById('visualizer');
    const canvas2 = document.getElementById('visualizer-focus');
    
    drawOnCanvas(canvas1, false); 
    
    if (typeof isFocusMode !== 'undefined' && isFocusMode && personalization.showFocusVisualizer) {
        drawOnCanvas(canvas2, true);  
    } else {
        clearCanvas(canvas2);
    }

    animationId = requestAnimationFrame(drawVisualizer);
}

function clearAllCanvases() {
    clearCanvas(document.getElementById('visualizer'));
    clearCanvas(document.getElementById('visualizer-focus'));
    if (typeof animationId !== 'undefined' && animationId) cancelAnimationFrame(animationId);
}

function clearCanvas(canvas) {
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function drawOnCanvas(canvas, isBig) {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
    
    const w = canvas.width;
    const h = canvas.height;

    // 1. Nettoyage (Transparence)
    ctx.clearRect(0, 0, w, h);

    // --- 2. CONFIGURATION DU GLOW (EFFET NÉON) ---
    // C'est ici que la magie opère !
    ctx.shadowBlur = isBig ? 20 : 10; // Flou plus grand en mode plein écran
    ctx.shadowColor = "rgba(176, 38, 255, 0.8)"; // La couleur du halo (Violet)

    analyser.getByteFrequencyData(dataArray);

    const type = personalization.visualizerType || 'bars';
    const color = 'rgba(176, 38, 255, 0.9)'; // Couleur des barres (Violet solide)

    // --- TYPE 1 : BARRES ---
    if (type === 'bars') {
        const barWidth = (w / dataArray.length) * 2.5;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const barHeight = (dataArray[i] / 255) * h * (isBig ? 0.9 : 0.6);
            ctx.fillStyle = color;
            ctx.fillRect(x, h - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    
    // --- TYPE 2 : DUAL BARS (MIROIR) ---
    else if (type === 'dual-bars') {
        const barWidth = (w / dataArray.length) * 2.5;
        let x = 0;
        const centerY = h / 2;
        
        for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] / 255) * (h / 2);
            ctx.fillStyle = color;
            ctx.fillRect(x, centerY - v, barWidth, v * 2);
            x += barWidth + 1;
        }
    }

    // --- TYPE 3 : SHOCKWAVE (PULSATION) ---
    else if (type === 'shockwave') {
        let sum = 0;
        for(let i = 0; i < 40; i++) sum += dataArray[i];
        const average = sum / 40;
        
        const centerX = w / 2;
        const centerY = h / 2;
        const radius = (isBig ? 80 : 20) + (average * (isBig ? 0.8 : 0.2));
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 1.4, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(176, 38, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // --- TYPE 4 : ONDE ---
    else if (type === 'wave') {
        const waveArray = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(waveArray);
        ctx.lineWidth = isBig ? 3 : 2;
        ctx.strokeStyle = color;
        ctx.beginPath();
        const sliceWidth = w / waveArray.length;
        let x = 0;
        for (let i = 0; i < waveArray.length; i++) {
            const v = waveArray[i] / 128.0;
            const y = (v * h) / 2;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.stroke();
    }
    
    // --- TYPE 5 : ROND ---
    else if (type === 'round') {
        const cx = w / 2;
        const cy = h / 2;
        const radius = isBig ? Math.min(w, h) / 4 : Math.min(w, h) / 3;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = isBig ? 3 : 2;
        for (let i = 0; i < dataArray.length; i++) {
            if (i > dataArray.length * 0.7) break; 
            const v = dataArray[i];
            const angle = (i / (dataArray.length * 0.7)) * Math.PI * 2;
            const barHeight = (v / 255) * (isBig ? 150 : 50);
            const x1 = cx + Math.cos(angle) * radius;
            const y1 = cy + Math.sin(angle) * radius;
            const x2 = cx + Math.cos(angle) * (radius + barHeight);
            const y2 = cy + Math.sin(angle) * (radius + barHeight);
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();
    }
}