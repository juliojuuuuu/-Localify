// ========================================
// LOGIQUE LECTURE (CORRIGÉE iOS & PIP)
// ========================================

async function play(idx) {
    if (typeof initAudioContext === 'function') initAudioContext();
    if (!queue || idx < 0 || idx >= queue.length) return;

    const crossOn = personalization && personalization.enableCrossfade;

    // Gestion du Crossfade (Fondu enchaîné)
    if (crossOn && !audio.paused && audio.currentTime > 0) {
        let vol = audio.volume;
        const fadeOut = setInterval(() => {
            if (vol > 0.1) { 
                vol -= 0.1; 
                audio.volume = vol;
            } else { 
                clearInterval(fadeOut); 
                startNextTrack(idx); 
            }
        }, 50);
        return;
    }
    startNextTrack(idx);
}

async function startNextTrack(idx) {
    qIdx = idx;
    const track = queue[qIdx];
    if (!track) return;

    try {
        audio.src = track.url;
        const crossOn = personalization && personalization.enableCrossfade;
        audio.volume = crossOn ? 0 : (config.volume || 1);
        
        // Vitesse de lecture
        if (personalization.playbackRate) {
            audio.playbackRate = personalization.playbackRate;
            audio.preservesPitch = (personalization.preservePitch !== false); 
        }

        await audio.play();
        
        // --- IMPORTANT iOS : Mise à jour immédiate de la session ---
        updateMediaSession(track);
        
        // Fondu d'entrée (Fade In)
        if (crossOn) {
            let vol = 0;
            const target = config.volume || 1;
            const fadeIn = setInterval(() => {
                if (vol < target - 0.05) { 
                    vol += 0.05; 
                    audio.volume = vol;
                } else { 
                    audio.volume = target; 
                    clearInterval(fadeIn); 
                }
            }, 50);
        }
        
        updatePlayerUI(track);
        
        // Sauvegarde historique
        history = [track, ...history.filter(h => h.path !== track.path)].slice(0, 50);
        saveData('history', history);
        saveSession(); 

    } catch (error) {
        console.error('Erreur lecture:', error);
        showNotification("Fichier illisible ou manquant", "error");
        setTimeout(() => next(), 1500);
    }
}

function updateMediaSession(track) {
    if ('mediaSession' in navigator) {
        const coverPath = (typeof getCover === 'function') ? getCover(track) : '';
        // Conversion chemin relatif -> absolu pour iOS
        const absoluteCover = new URL(coverPath, window.location.href).href;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.name || "Titre inconnu",
            artist: track.artist || "Artiste inconnu",
            album: track.album || 'Localify',
            artwork: [
                { src: absoluteCover, sizes: '512x512', type: 'image/png' }
            ]
        });

        // FORCE l'état de lecture pour éviter la mise en veille
        navigator.mediaSession.playbackState = "playing";

        // Définition des contrôles sur l'écran de verrouillage
        navigator.mediaSession.setActionHandler('play', () => togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => togglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => prev());
        navigator.mediaSession.setActionHandler('nexttrack', () => next());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime && audio.duration) audio.currentTime = details.seekTime;
        });
    }
}

function restoreSession() {
    try {
        const savedSession = localStorage.getItem('localify_session');
        const savedShuffle = localStorage.getItem('localify_shuffle');
        const savedRepeat = localStorage.getItem('localify_repeat');
        if (savedShuffle) isShuffle = (savedShuffle === 'true');
        if (savedRepeat) repeatMode = parseInt(savedRepeat);
        if (savedSession) {
            const session = JSON.parse(savedSession);
            if (session.track && session.queue && session.queue.length > 0) {
                queue = session.queue;
                qIdx = session.idx || 0;
                const track = queue[qIdx];
                if (track) {
                    audio.src = track.url;
                    audio.currentTime = session.time || 0;
                    updatePlayerUI(track);
                    // Note: On ne lance pas la lecture auto ici (politique navigateur)
                }
            }
        }
        updateShuffleRepeatUI();
    } catch (e) { console.error("Erreur session", e); }
    // Restaure le thème si nécessaire
    applyTheme(localStorage.getItem('localify_theme') || '#ff007b');
}

function saveSession() {
    if (queue.length > 0) {
        const session = {
            queue: queue.length > 100 ? queue.slice(qIdx, qIdx + 50) : queue,
            idx: qIdx,
            track: queue[qIdx],
            time: audio.currentTime
        };
        localStorage.setItem('localify_session', JSON.stringify(session));
    }
}

function togglePlay() {
    if (typeof initAudioContext === 'function') initAudioContext();
    
    if (audio.paused) {
        audio.play();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
        updatePlayerUI(queue[qIdx]);
        if (typeof showOSD === 'function') showOSD('▶️', 'Lecture');
    } else {
        audio.pause();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
        updatePlayerUI(queue[qIdx]);
        if (typeof showOSD === 'function') showOSD('⏸️', 'Pause');
    }
}

function next() { 
    if (queue.length === 0) return;
    if (repeatMode === 2) {
        audio.currentTime = 0;
        audio.play();
        return;
    }
    if (isShuffle) {
        let nextIdx;
        do { nextIdx = Math.floor(Math.random() * queue.length); } while (nextIdx === qIdx && queue.length > 1);
        play(nextIdx);
    } else {
        if (qIdx < queue.length - 1) { play(qIdx + 1); }
        else if (repeatMode === 1) { play(0); }
        else {
            audio.pause(); audio.currentTime = 0;
            updatePlayerUI(queue[qIdx]);
        }
    }
}

function prev() { 
    if (audio.currentTime > 3) { audio.currentTime = 0; }
    else {
        if (isShuffle) { play(Math.floor(Math.random() * queue.length)); }
        else if (qIdx > 0) { play(qIdx - 1); }
        else { play(0); }
    }
}

function updatePlayerUI(track) {
    if (!track) return;
    const isFav = favs.includes(track.path);
    const isInPlaylist = (typeof isTrackInAnyPlaylist === 'function') ? isTrackInAnyPlaylist(track) : false;
    const coverUrl = (typeof getCover === 'function') ? getCover(track) : '';
    const isPaused = audio.paused;

    const elements = {
        title: document.getElementById('p-title'),
        artist: document.getElementById('p-artist'),
        cover: document.getElementById('player-cover'),
        fTitle: document.getElementById('focus-title'),
        fArtist: document.getElementById('focus-artist'),
        fCover: document.getElementById('focus-cover')
    };

    if (elements.title) elements.title.innerText = track.name || "Inconnu";
    
    if (elements.artist) {
        elements.artist.innerText = track.artist || "Inconnu";
        elements.artist.style.cursor = "pointer";
        elements.artist.onclick = (e) => { e.stopPropagation(); goToArtist(track.artist); };
    }
    
    if (elements.fArtist) {
        elements.fArtist.innerText = track.artist || "Inconnu";
        elements.fArtist.style.cursor = "pointer";
        elements.fArtist.onclick = () => goToArtist(track.artist);
    }

    if (elements.cover) elements.cover.src = coverUrl;
    if (elements.fTitle) elements.fTitle.innerText = track.name || "Inconnu";
    if (elements.fCover) elements.fCover.src = coverUrl;

    const iconName = isPaused ? 'play' : 'pause';
    const playBtns = [document.getElementById('play-btn'), document.getElementById('focus-play-btn')];
    playBtns.forEach(btn => {
        if(btn) btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
    });

    const mainFav = document.getElementById('main-fav-btn');
    if (mainFav) {
        mainFav.innerHTML = `<i data-lucide="heart" class="${isFav ? 'fill-current' : ''}"></i>`;
        mainFav.classList.toggle('is-fav', isFav);
    }

    const focusFav = document.getElementById('focus-fav-btn');
    if (focusFav) {
        focusFav.innerHTML = `<i data-lucide="heart" class="${isFav ? 'fill-current' : ''}"></i>`;
        if (isFav) { 
            focusFav.style.color = 'var(--accent)'; 
            focusFav.classList.add('is-liked');
        } else { 
            focusFav.style.color = ''; 
            focusFav.classList.remove('is-liked');
        }
    }


    const mainAdd = document.getElementById('main-add-btn');
    if (mainAdd) {
        mainAdd.innerHTML = `<i data-lucide="plus" class="${isInPlaylist ? 'fill-current' : ''}"></i>`;
        mainAdd.classList.toggle('is-fav', isInPlaylist);
    }

    const focusAdd = document.getElementById('focus-add-btn');
    if (focusAdd) {
        focusAdd.innerHTML = `<i data-lucide="plus" class="${isInPlaylist ? 'fill-current' : ''}"></i>`;
        if (isInPlaylist) {
            focusAdd.style.color = 'var(--accent)';
            focusAdd.classList.add('is-liked');
        } else {
            focusAdd.style.color = '';
            focusAdd.classList.remove('is-liked');
        }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (elements.cover) {
        elements.cover.onload = () => {
            // Met à jour l'image PiP quand la cover change
            if (document.pictureInPictureElement && typeof updatePiPImage === 'function') {
                updatePiPImage();
            }
            if (personalization.chameleonMode && typeof getDominantColor === 'function') {
                const color = getDominantColor(elements.cover);
                if (color) applyTheme(color, false);
            }
        };
    }
}

function updateVol(v) { 
    audio.volume = v; 
    config.volume = v; 
    saveData('cfg', config); 

    if (typeof showOSD === 'function') {
        const pct = Math.round(v * 100);
        let icon = pct === 0 ? '🔇' : (pct < 50 ? '🔉' : '🔊');
        showOSD(icon, pct + '%');
    }
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    localStorage.setItem('localify_shuffle', isShuffle);
    if (isShuffle) showNotification("Mode aléatoire activé 🔀");
    else showNotification("Mode aléatoire désactivé ➡️");
    updateShuffleRepeatUI();
}

function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    localStorage.setItem('localify_repeat', repeatMode);
    if (repeatMode === 0) showNotification("Répétition désactivée ➡️");
    else if (repeatMode === 1) showNotification("Tout répéter 🔁");
    else if (repeatMode === 2) showNotification("Titre répété 🔂");
    updateShuffleRepeatUI();
}

function updateShuffleRepeatUI() {
    const btnS = document.getElementById('btn-shuffle');
    const btnR = document.getElementById('btn-repeat');
    if(btnS) btnS.classList.toggle('active', isShuffle);
    if(btnR) {
        btnR.classList.remove('active', 'active-one');
        if (repeatMode === 1) btnR.classList.add('active');
        if (repeatMode === 2) btnR.classList.add('active', 'active-one');
    }
}

// --- MODES AUTOMATIQUES (Minuteur) ---
let sleepTimerId = null;

function setSleepTimer(minutes) {
    if (sleepTimerId) { clearTimeout(sleepTimerId); sleepTimerId = null; }
    if (minutes === 0) { showNotification("Minuteur désactivé ❌"); return; }
    showNotification(`Arrêt dans ${minutes} minutes 🌙`);
    sleepTimerId = setTimeout(() => fadeOutAndStop(), minutes * 60 * 1000);
}

function fadeOutAndStop() {
    const fadeAudio = setInterval(() => {
        if (audio.volume > 0.05) audio.volume -= 0.05;
        else {
            clearInterval(fadeAudio);
            audio.pause();
            audio.volume = config.volume || 1;
            sleepTimerId = null;
        }
    }, 200);
}

// --- MINI-LECTEUR (PiP) - C'était la partie manquante ! ---
async function toggleMiniPlayer() {
    const video = document.getElementById('pip-video');
    
    // Si déjà actif, on quitte
    if (document.pictureInPictureElement) { 
        await document.exitPictureInPicture(); 
        return; 
    }

    try {
        // Met à jour l'image avant d'ouvrir
        if(typeof updatePiPImage === 'function') updatePiPImage();
        
        // Nécessaire pour lancer le PiP
        video.play(); 
        await video.requestPictureInPicture();
    } catch (error) { 
        console.error("Erreur PiP:", error); 
        showNotification("Erreur mini-lecteur (Non supporté ?)", "error"); 
    }
}