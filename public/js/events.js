// ========================================
// EVENTS & LISTENERS (MOBILE : SWIPE & HAPTICS)
// ========================================

// --- HAPTIC FEEDBACK (VIBRATIONS) ---
function vibrate(ms = 10) {
    // Ne fonctionne que sur mobile (Android principalement, iOS bloque souvent ça sur le web)
    if (navigator.vibrate) navigator.vibrate(ms);
}

function handleSearch(val) {
    if (!val) { showLib(); return; }
    const terms = val.toLowerCase().split(' ').filter(t => t.length > 0);
    currentViewTracks = allMusic.filter(m => {
        const target = (m.name + ' ' + m.artist + ' ' + (m.album || '')).toLowerCase();
        return terms.every(term => target.includes(term));
    });
    document.getElementById('content-area').innerHTML = `<h2 class="section-title">🔍 Résultats (${currentViewTracks.length})</h2>`;
    renderList(currentViewTracks);
}

function setupAudioEventHandlers() {
    const seek = document.getElementById('seek');
    const focusSeek = document.getElementById('focus-seek');

    audio.ontimeupdate = () => {
        if (audio.duration) {
            const percent = (audio.currentTime / audio.duration) * 100;
            if(seek) seek.value = percent;
            document.getElementById('cur').innerText = formatTime(audio.currentTime);
            document.getElementById('dur').innerText = formatTime(audio.duration);
            
            if(focusSeek) focusSeek.value = percent;
            const fCur = document.getElementById('focus-cur');
            const fDur = document.getElementById('focus-dur');
            if(fCur) fCur.innerText = formatTime(audio.currentTime);
            if(fDur) fDur.innerText = formatTime(audio.duration);
            
            saveSession();
            localStorage.setItem('localify_last_time', String(Math.floor(audio.currentTime || 0)));
        }
    };
    
    // Ajout vibration sur le seek
    if(seek) seek.oninput = () => { if(audio.duration) audio.currentTime = (seek.value / 100) * audio.duration; };
    if(focusSeek) focusSeek.oninput = () => { 
        if(audio.duration) audio.currentTime = (focusSeek.value / 100) * audio.duration; 
        vibrate(5); // Petite vibration quand on bouge le curseur
    };
    
    audio.onended = () => { if (config.autoplay) next(); };
}

function setupUIEventHandlers() {
    // --- GESTION DES CLAVIERS ---
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        if (e.key === '?' || e.key === 'H' || e.key === 'h') {
            const modal = document.getElementById('shortcuts-modal');
            if (modal) modal.style.display = (modal.style.display === 'none' || modal.style.display === '') ? 'flex' : 'none';
        }

        switch(e.code) {
            case 'Space': e.preventDefault(); togglePlay(); break;
            case 'ArrowRight': if(audio.duration) audio.currentTime = Math.min(audio.currentTime + 5, audio.duration); break;
            case 'ArrowLeft': if(audio.duration) audio.currentTime = Math.max(audio.currentTime - 5, 0); break;
            case 'ArrowUp': 
                e.preventDefault(); 
                const nvu = Math.min(audio.volume + 0.1, 1); updateVol(nvu); 
                const vs1 = document.getElementById('vol'); if(vs1) vs1.value = nvu;
                break;
            case 'ArrowDown': 
                e.preventDefault(); 
                const nvd = Math.max(audio.volume - 0.1, 0); updateVol(nvd); 
                const vs2 = document.getElementById('vol'); if(vs2) vs2.value = nvd;
                break;
            case 'KeyN': next(); break;
            case 'KeyP': prev(); break;
            case 'KeyM': toggleMute(); break;
            case 'KeyF': toggleFocusMode(); break;
        }
    });

    // --- GESTION DU MENU CONTEXTUEL ---
    document.addEventListener('click', () => {
        const menu = document.getElementById('context-menu');
        if(menu) menu.style.display = 'none';
    });

    // --- GESTION DES ERREURS D'IMAGE ---
    document.addEventListener('error', function (e) {
        if (e.target.tagName.toLowerCase() === 'img' && e.target.classList.contains('track-thumbnail')) {
            e.target.src = 'https://img.icons8.com/?size=100&id=44029&format=png&color=FFFFFF';
        }
    }, true);

    // --- ACTIVATION DES GESTES MOBILES (SWIPE) ---
    setupMobileGestures();
}

// ========================================
// GESTION DES GESTES TACTILES (SWIPE)
// ========================================
function setupMobileGestures() {
    const focusOverlay = document.getElementById('focus-overlay');
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    if (!focusOverlay) return;

    focusOverlay.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: true});

    focusOverlay.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleGesture();
    }, {passive: true});

    function handleGesture() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // Seuil minimum pour considérer que c'est un swipe (50px)
        const threshold = 50; 

        // Si le mouvement est horizontal (plus large que haut)
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (Math.abs(deltaX) > threshold) {
                if (deltaX > 0) {
                    // Swipe Droite -> Précédent
                    prev();
                    animateSwipe('right');
                } else {
                    // Swipe Gauche -> Suivant
                    next();
                    animateSwipe('left');
                }
                vibrate(20); // Vibration confirmant l'action
            }
        } 
        // Si le mouvement est vertical
        else {
            // Swipe Bas -> Fermer le lecteur
            if (deltaY > threshold + 50) { // Un peu plus dur pour pas fermer par erreur
                toggleFocusMode();
                vibrate(10);
            }
        }
    }
}

// Animation visuelle lors du swipe
function animateSwipe(direction) {
    const cover = document.getElementById('focus-cover');
    if (!cover) return;
    
    // Petite animation CSS
    const xMove = direction === 'left' ? '-20px' : '20px';
    cover.style.transition = 'transform 0.1s';
    cover.style.transform = `translateX(${xMove})`;
    
    setTimeout(() => {
        cover.style.transform = 'translateX(0)';
        // Remet l'animation vinyle si nécessaire après 200ms
        setTimeout(() => {
            cover.style.transition = ''; 
            if(typeof applyPersonalization === 'function') applyPersonalization(); 
        }, 200);
    }, 150);
}

// --- AJOUT VIBRATION AUX ACTIONS CLÉS ---
// On surcharge légèrement les fonctions existantes via des wrappers si besoin,
// mais le mieux est d'appeler vibrate() ici pour les clics UI globaux

document.addEventListener('click', (e) => {
    // Si on clique sur un bouton ou un lien, on vibre un peu
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        vibrate(10);
    }
});

// --- MENU CONTEXTUEL ---
let contextTargetIdx = null;

function openContextMenu(e, idx) {
    e.preventDefault(); 
    e.stopPropagation(); 
    vibrate(15); // Vibration à l'ouverture
    contextTargetIdx = idx; 
    const menu = document.getElementById('context-menu');
    if (menu) {
        menu.style.display = 'block';
        menu.style.left = e.pageX + 'px'; 
        menu.style.top = e.pageY + 'px';
        
        // Ajustement mobile pour ne pas sortir de l'écran
        if (window.innerWidth <= 768) {
            menu.style.left = '50%';
            menu.style.transform = 'translateX(-50%)';
            menu.style.top = (e.pageY - 100) + 'px'; // Un peu plus haut
        }
    }
}

function ctxPlay() { if (contextTargetIdx !== null) playFromList(contextTargetIdx); }
function ctxQueue() { if (contextTargetIdx !== null) addToQueue(contextTargetIdx); }
function ctxFav() { if (contextTargetIdx !== null) toggleFav(contextTargetIdx); }
function ctxAddToPL() { if (contextTargetIdx !== null) openPLModal(contextTargetIdx); }

function ctxYouTube() {
    if (contextTargetIdx !== null) openYouTubeSearch(contextTargetIdx);
    const menu = document.getElementById('context-menu');
    if(menu) menu.style.display = 'none';
}

function openYouTubeSearch(idx) {
    if (typeof currentViewTracks === 'undefined' || !currentViewTracks[idx]) return;
    const track = currentViewTracks[idx];
    const query = encodeURIComponent(`${track.artist} ${track.name}`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
}

// --- SCREENSAVER ---
let screensaverTimeout;

function resetScreensaverTimer() {
    if (!personalization.enableScreensaver) return;
    const overlay = document.getElementById('focus-overlay');
    if (!isFocusMode) {
        if (overlay && !overlay.classList.contains('hidden') && document.body.classList.contains('screensaver-active')) {
            toggleFocusMode(); 
            document.body.classList.remove('screensaver-active');
        }
    }
    clearTimeout(screensaverTimeout);
    screensaverTimeout = setTimeout(() => {
        if (!audio.paused && !isFocusMode) { 
            toggleFocusMode(); 
            document.body.classList.add('screensaver-active'); 
        }
    }, 60000);
}

document.addEventListener('mousemove', resetScreensaverTimer);
document.addEventListener('keydown', resetScreensaverTimer);
document.addEventListener('click', resetScreensaverTimer);