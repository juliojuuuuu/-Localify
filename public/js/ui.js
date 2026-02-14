// ========================================
// INTERFACE UTILISATEUR GLOBALE & PARTICULES
// ========================================

function toggleMenu() { 
    const sb = document.getElementById('sidebar');
    if(!sb) return;
    if (window.innerWidth <= 768) {
        sb.classList.toggle('open');
        sb.classList.remove('hidden');
    } else {
        sb.classList.toggle('hidden');
        sb.classList.remove('open');
    }
}

function updateNav(pathArray) {
    const breadcrumb = document.getElementById('breadcrumb');
    if(!breadcrumb) return;
    let html = `<span onclick="showLib()" class="breadcrumb-item">📚 Bibliothèque</span>`;
    pathArray.forEach(item => {
        html += ` <span class="breadcrumb-separator">›</span> <span onclick="${item.cmd}" class="breadcrumb-item">${escapeHtml(item.name)}</span>`;
    });
    breadcrumb.innerHTML = html;
}


function getUserInitial() {
    const username = authState?.user?.username || '?';
    return username.charAt(0).toUpperCase();
}

// DANS ui.js

function renderUserMenu() {
    const wrap = document.getElementById('user-menu-wrap');
    if (!wrap) return;
    
    // Si pas connecté
    if (!authState || !authState.user) {
        wrap.innerHTML = '';
        return;
    }

    const avatarUrl = String(authState.user.avatarUrl || '').trim();
    let avatarHtml;

    // LOGIQUE DE DÉTECTION : EMOJI vs IMAGE
    // Si la chaîne fait 4 caractères ou moins, c'est probablement un emoji
    if (avatarUrl && avatarUrl.length <= 4) {
        // C'est un Emoji -> On l'affiche dans une DIV (texte)
        avatarHtml = `
            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px; background: var(--card); border-radius: 50%;">
                ${avatarUrl}
            </div>`;
    } else if (avatarUrl) {
        // C'est une Image (URL ou Base64) -> On l'affiche dans une IMG
        avatarHtml = `<img src="${escapeHtml(avatarUrl)}" alt="avatar" 
            style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
            onerror="this.style.display='none'; this.parentElement.innerText='${getUserInitial()}';">`;
    } else {
        // Pas d'avatar -> Initiale
        avatarHtml = getUserInitial();
    }

    wrap.innerHTML = `
        <button class="user-bubble-btn" onclick="toggleUserMenu(event)" 
            style="overflow: hidden; padding: 0; display: flex; align-items: center; justify-content: center;">
            ${avatarHtml}
        </button>
        <div id="user-menu-dropdown" class="user-menu-dropdown" style="display:none;">
            <div class="user-menu-header">Connecté: <strong>${escapeHtml(authState.user.username)}</strong></div>
            <button class="user-menu-item" onclick="changeAvatarFromMenu()">🖼️ Changer l'avatar</button>
            <button class="user-menu-item" onclick="changePasswordFromMenu()">🔒 Changer le mot de passe</button>
            <button class="user-menu-item" onclick="logoutAccount()">🚪 Se déconnecter</button>
        </div>`;
}

function toggleUserMenu(event) {
    event?.stopPropagation();
    const menu = document.getElementById('user-menu-dropdown');
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function closeUserMenu() {
    const menu = document.getElementById('user-menu-dropdown');
    if (menu) menu.style.display = 'none';
}

function renderList(list) {
    const container = document.getElementById('content-area');
    if(!container) return;
    if (list.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>🎵 Aucun titre</p></div>';
        return;
    }
    const listHtml = list.map((track, i) => {
        const isFav = favs.includes(track.path);
        const isPlaying = queue[qIdx]?.path === track.path;
        
        return `
        <div class="row ${isPlaying ? 'active-track' : ''}" 
             onclick="playFromList(${i})" 
             oncontextmenu="openContextMenu(event, ${i})">
             
            <img src="${getCover(track)}" alt="${track.name}" class="track-thumbnail" loading="lazy">
            <div class="track-info">
                <div class="track-name">${escapeHtml(track.name)}</div>
                <div class="track-artist">${escapeHtml(track.artist)}</div>
            </div>
            <div class="row-actions">
                <button class="action-btn desktop-only" onclick="event.stopPropagation(); openPLModal(${i})" title="Playlist">➕</button>
                <button class="action-btn desktop-only ${isFav ? 'is-fav' : ''}" onclick="event.stopPropagation(); toggleFav(${i})" title="Favoris">${isFav ? '❤️' : '🤍'}</button>
                <button class="action-btn desktop-only" onclick="event.stopPropagation(); addToQueue(${i})" title="Queue">⏳</button>
                <button class="action-btn desktop-only" onclick="event.stopPropagation(); openYouTubeSearch(${i})" title="Voir sur YouTube">📺</button>
                <button class="action-btn mobile-only" onclick="event.stopPropagation(); openContextMenu(event, ${i})" title="Plus d'actions">⋮</button>
            </div>
        </div>`;
    }).join('');
    container.innerHTML = listHtml;
}

// --- MISE À JOUR : CLASSE FOCUS-ACTIVE ---
function toggleFocusMode() {
    isFocusMode = !isFocusMode;
    const overlay = document.getElementById('focus-overlay');
    
    // IMPORTANT : On signale au CSS que le focus est actif pour gérer la transparence
    document.body.classList.toggle('focus-active', isFocusMode);

    if(overlay) {
        overlay.classList.toggle('hidden', !isFocusMode);
        if(isFocusMode && typeof applyPersonalization === 'function') applyPersonalization(); 
    }
}

function goToArtist(artistName) {
    if (!artistName || artistName === "Inconnu") return;
    if (typeof showLib === 'function') showLib();
    const searchInput = document.getElementById('search-bar');
    if (searchInput) {
        searchInput.value = artistName;
        if (typeof handleSearch === 'function') handleSearch(artistName);
    }
    if (isFocusMode) toggleFocusMode();
    showNotification(`Recherche : ${artistName} 🔍`);
}

function createPlaylistFromMenu() {
    toggleMenu();
    setTimeout(() => {
        if (typeof createPL === 'function') createPL();
    }, 300);
}

function showOSD(icon, text) {
    let osd = document.getElementById('osd-overlay');
    if (!osd) {
        osd = document.createElement('div');
        osd.id = 'osd-overlay';
        Object.assign(osd.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(10px)', webkitBackdropFilter: 'blur(10px)',
            padding: '30px 50px', borderRadius: '20px', color: 'white', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', zIndex: '11000', pointerEvents: 'none',
            opacity: '0', transition: 'opacity 0.2s ease', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)'
        });
        document.body.appendChild(osd);
    }
    osd.innerHTML = `<div style="font-size: 48px; margin-bottom: 10px;">${icon}</div><div style="font-size: 20px; font-weight: bold; font-family: sans-serif; letter-spacing: 1px;">${text}</div>`;
    requestAnimationFrame(() => { osd.style.opacity = '1'; });
    if (window.osdTimeout) clearTimeout(window.osdTimeout);
    window.osdTimeout = setTimeout(() => { osd.style.opacity = '0'; }, 1500);
}

// ========================================
// MOTEUR DE PARTICULES (GLOBAL)
// ========================================
let particleCtx, particleCanvas, particleAnimId;
let particlesArray = [];

function initParticles() {
    if (!personalization.ambianceMode || personalization.ambianceMode === 'none') {
        stopParticles();
        return;
    }

    particleCanvas = document.getElementById('particles-canvas');
    if (!particleCanvas) return;
    
    particleCtx = particleCanvas.getContext('2d');
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;

    particlesArray = [];
    const count = window.innerWidth < 768 ? 40 : 100;

    for (let i = 0; i < count; i++) {
        particlesArray.push(createParticle());
    }

    if (particleAnimId) cancelAnimationFrame(particleAnimId);
    animateParticles();
}

function stopParticles() {
    if (particleAnimId) cancelAnimationFrame(particleAnimId);
    if (particleCtx && particleCanvas) {
        particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    }
}

function createParticle() {
    const mode = personalization.ambianceMode;
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    let p = {
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 3 + 1,
        speedX: 0,
        speedY: 0,
        opacity: Math.random(),
        color: 'white'
    };

    if (mode === 'snow') {
        p.speedY = Math.random() * 1 + 0.5; 
        p.speedX = Math.random() * 1 - 0.5; 
        p.color = 'rgba(255, 255, 255, ';
        p.size = Math.random() * 3 + 1;
    } else if (mode === 'embers') {
        p.y = h + Math.random() * 50; 
        p.speedY = -(Math.random() * 1.5 + 0.5); 
        p.speedX = Math.random() * 1 - 0.5;
        p.size = Math.random() * 4 + 1;
        const colors = ['255, 87, 34', '255, 152, 0', '255, 235, 59']; 
        p.baseColor = colors[Math.floor(Math.random() * colors.length)];
        p.color = `rgba(${p.baseColor}, `;
    } else if (mode === 'stars') {
        p.speedY = Math.random() * 0.1 - 0.05; 
        p.speedX = Math.random() * 0.1 - 0.05;
        p.size = Math.random() * 2;
        p.color = 'rgba(255, 255, 255, ';
    } else if (mode === 'fireflies') {
        p.speedX = Math.random() * 2 - 1;
        p.speedY = Math.random() * 2 - 1;
        p.size = Math.random() * 3 + 1;
        p.color = 'rgba(176, 255, 87, '; 
    }

    return p;
}

function animateParticles() {
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    const mode = personalization.ambianceMode;

    for (let i = 0; i < particlesArray.length; i++) {
        let p = particlesArray[i];
        p.x += p.speedX; p.y += p.speedY;

        if (mode === 'snow') {
            if (p.y > particleCanvas.height) p.y = -10;
            if (p.x > particleCanvas.width) p.x = 0; if (p.x < 0) p.x = particleCanvas.width;
        } else if (mode === 'embers') {
            p.opacity -= 0.005;
            if (p.y < 0 || p.opacity <= 0) { p.y = particleCanvas.height + 10; p.x = Math.random() * particleCanvas.width; p.opacity = 1; }
        } else if (mode === 'fireflies') {
            if (p.x < 0 || p.x > particleCanvas.width) p.speedX *= -1;
            if (p.y < 0 || p.y > particleCanvas.height) p.speedY *= -1;
            p.opacity += (Math.random() - 0.5) * 0.1;
            if (p.opacity < 0) p.opacity = 0; if (p.opacity > 1) p.opacity = 1;
        } else if (mode === 'stars') {
             p.opacity += (Math.random() - 0.5) * 0.02;
             if (p.opacity < 0.2) p.opacity = 0.2; if (p.opacity > 1) p.opacity = 1;
        }

        particleCtx.beginPath();
        particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        particleCtx.fillStyle = p.color + p.opacity + ')';
        particleCtx.fill();
    }
    
    particleAnimId = requestAnimationFrame(animateParticles);
}


document.addEventListener('click', (event) => {
    const wrap = document.getElementById('user-menu-wrap');
    if (!wrap || !wrap.contains(event.target)) closeUserMenu();
});

window.addEventListener('load', initParticles);
window.addEventListener('resize', initParticles);
