// ========================================
// MOTEUR AUDIO, EQ & EFFETS (CORRIGÉ iOS)
// ========================================

let pannerNode; // Pour le mode 8D
let pannerInterval;
let iosWakeInterval; // Variable pour le hack iOS

function initAudioContext() {
    if (!audioContext) {
        // 1. Création du contexte audio (Compatible Webkit/Safari)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext({
            latencyHint: 'playback' // Optimisation pour la lecture continue
        });
        
        // 2. Création des nœuds
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; // Pour le visualiseur
        
        // IMPORTANT : createMediaElementSource "vole" le son de la balise <audio>
        // Si le contexte s'arrête, le son s'arrête.
        source = audioContext.createMediaElementSource(audio);
        
        // --- ÉGALISEUR (3 Bandes) ---
        bassNode = audioContext.createBiquadFilter();
        bassNode.type = 'lowshelf';
        bassNode.frequency.value = 250;

        midNode = audioContext.createBiquadFilter();
        midNode.type = 'peaking';
        midNode.frequency.value = 1000;
        midNode.Q.value = 0.5;

        trebleNode = audioContext.createBiquadFilter();
        trebleNode.type = 'highshelf';
        trebleNode.frequency.value = 4000;

        // --- EFFET 8D (PANNER) ---
        pannerNode = audioContext.createStereoPanner();

        // 3. Chaînage : Source -> Bass -> Mid -> Treble -> Panner -> Analyser -> Sortie
        source.connect(bassNode);
        bassNode.connect(midNode);
        midNode.connect(trebleNode);
        trebleNode.connect(pannerNode);
        pannerNode.connect(analyser);
        analyser.connect(audioContext.destination);

        // 4. Préparation des données pour le visualiseur
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        console.log("🔊 Moteur Audio Initialisé");

        // Restaurer l'EQ sauvegardé
        restoreEQ();

        // Relancer le visualiseur si nécessaire
        if (typeof drawVisualizer === 'function') drawVisualizer();
        
        // --- ACTIVATION DU HACK iOS ---
        enableIOSHack();
    }

    // --- DEVERROUILLAGE AGRESSIF (MOBILE) ---
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log("🔊 Contexte Audio forcé (Resume)");
        });
    }
}

// ========================================
// HACK ANTI-VEILLE iOS (KEEP ALIVE)
// ========================================
function enableIOSHack() {
    // 1. Détection changement d'état (Verrouillage écran)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // L'utilisateur verrouille ou change d'app : On force le réveil
            if (audioContext && audioContext.state !== 'running' && !audio.paused) {
                audioContext.resume();
            }
        }
    });

    // 2. "Battement de coeur" : On vérifie toutes les 2 secondes si le moteur dort
    if (iosWakeInterval) clearInterval(iosWakeInterval);
    iosWakeInterval = setInterval(() => {
        if (audioContext && !audio.paused) {
            if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
                console.log("⚠️ AudioContext endormi par iOS -> REVEIL FORCÉ");
                audioContext.resume();
            }
        }
    }, 2000);

    // 3. Technique de l'oscillateur silencieux (Le plus efficace)
    // On joue un son vide pour garder le "speaker" matériel actif
    document.addEventListener('touchstart', function() {
        if (audioContext) {
            const buffer = audioContext.createBuffer(1, 1, 22050);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
        }
    }, { once: true });
}

// --- GESTION DE L'ÉGALISEUR ---
function setEQ(band, value) {
    if (!audioContext) return; 
    const val = parseFloat(value);
    
    if (typeof eqSettings !== 'undefined') {
        eqSettings[band] = val;
        localStorage.setItem('localify_eq', JSON.stringify(eqSettings));
    }

    if (band === 'bass' && bassNode) bassNode.gain.value = val;
    if (band === 'mid' && midNode) midNode.gain.value = val;
    if (band === 'treble' && trebleNode) trebleNode.gain.value = val;
}

function restoreEQ() {
    const savedEq = localStorage.getItem('localify_eq');
    if (savedEq) {
        try {
            const parsed = JSON.parse(savedEq);
            if (typeof eqSettings !== 'undefined') eqSettings = parsed;
            
            if (bassNode) bassNode.gain.value = eqSettings.bass || 0;
            if (midNode) midNode.gain.value = eqSettings.mid || 0;
            if (trebleNode) trebleNode.gain.value = eqSettings.treble || 0;
        } catch (e) { console.error("Erreur EQ restore", e); }
    }
}

// --- MODE 8D (AUDIO SPATIAL) ---
function toggle8DMode(enable) {
    if (!audioContext || !pannerNode) return;

    if (enable) {
        let x = 0;
        clearInterval(pannerInterval);
        pannerInterval = setInterval(() => {
            if (!audio.paused) {
                x += 0.02; 
                pannerNode.pan.value = Math.sin(x);
            }
        }, 50);
        showNotification("Mode 8D Activé 🎧");
    } else {
        clearInterval(pannerInterval);
        pannerNode.pan.value = 0; 
        showNotification("Mode 8D Désactivé");
    }
}

// --- GESTION MUTE ---
function toggleMute() {
    audio.muted = !audio.muted;
    const btn = document.getElementById('mute-btn');
    if (btn) {
        btn.innerHTML = audio.muted 
            ? '<i data-lucide="volume-x"></i>' 
            : '<i data-lucide="volume-2"></i>';
        
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }
}

// --- PRESETS ÉGALISEUR ---
function applyPreset(type) {
    let b = 0, m = 0, t = 0;

    switch (type) {
        case 'bass':   b = 8;  m = -2; t = -2; break; 
        case 'rock':   b = 5;  m = -1; t = 6;  break; 
        case 'pop':    b = 3;  m = 4;  t = 3;  break; 
        case 'voice':  b = -2; m = 6;  t = 2;  break; 
        case 'flat':   b = 0;  m = 0;  t = 0;  break; 
    }

    if(bassNode) bassNode.gain.value = b;
    if(midNode) midNode.gain.value = m;
    if(trebleNode) trebleNode.gain.value = t;

    const slBass = document.getElementById('modal-eq-bass');
    const slMid = document.getElementById('modal-eq-mid');
    const slTreble = document.getElementById('modal-eq-treble');
    
    if(slBass) slBass.value = b;
    if(slMid) slMid.value = m;
    if(slTreble) slTreble.value = t;

    eqSettings = { bass: b, mid: m, treble: t };
    localStorage.setItem('localify_eq', JSON.stringify(eqSettings));
    
    showNotification(`Preset "${type}" appliqué 🎚️`);
}