// ========================================
// UTILITAIRES (SAUVEGARDE, IMPORT, FORMATAGE)
// ========================================

// Envoi des données au serveur (API)
async function saveData(type, data) {
    try {
        await fetch(`/api/data/${type}`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(data)
        });
    } catch (error) { console.error('Erreur sauvegarde:', error); }
}

// --- FONCTION DE RESTAURATION COMPLÈTE ---
async function importData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            console.log("Données importées :", data);

            // 1. Mise à jour des variables globales
            if (data.playlists) playlists = data.playlists;
            if (data.favs) favs = data.favs;
            if (data.config) config = data.config;
            if (data.personalization) personalization = data.personalization;
            if (data.eqSettings) eqSettings = data.eqSettings;

            // 2. CORRECTION : Restauration du Thème
            if (data.theme) {
                localStorage.setItem('localify_theme', data.theme);
                // Si la fonction applyTheme est disponible (via settings.js), on l'utilise
                if (typeof applyTheme === 'function') {
                    applyTheme(data.theme);
                } else {
                    document.documentElement.style.setProperty('--accent', data.theme);
                    document.documentElement.style.setProperty('--accent-hover', data.theme);
                }
            }

            // 3. Sauvegarde vers le serveur
            await Promise.all([
                saveData('pl', playlists),
                saveData('fav', favs),
                saveData('cfg', config)
            ]);

            // 4. Sauvegarde LocalStorage
            if (data.personalization) localStorage.setItem('localify_perso', JSON.stringify(data.personalization));
            if (data.eqSettings) localStorage.setItem('localify_eq', JSON.stringify(data.eqSettings));
            
            // Appliquer le thème immédiatement si présent
            if (data.personalization && localStorage.getItem('localify_theme')) {
                // On garde le thème
            }

            showNotification("✅ Restauration réussie ! Rechargement...");
            
            // 5. Recharger la page
            setTimeout(() => location.reload(), 1500);

        } catch (err) {
            console.error("Erreur import:", err);
            showNotification("❌ Fichier invalide ou corrompu", "error");
        }
    };
    reader.readAsText(file);
    
    // Réinitialiser l'input
    input.value = '';
}

// --- AUTRES UTILITAIRES ---

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

function getCover(track) { 
    if (track && track.path) {
        return `/api/cover?path=${encodeURIComponent(track.path)}&t=${Date.now()}`;
    }
    return 'https://img.icons8.com/?size=100&id=44029&format=png&color=FFFFFF'; 
}

function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    void toast.offsetWidth; 
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function refreshIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}






// --- COULEUR CAMÉLÉON ---
function getDominantColor(imgEl) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1;
        canvas.height = 1;
        
        // On dessine l'image en 1x1 pixel pour faire la moyenne
        ctx.drawImage(imgEl, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

        // Boost de saturation pour éviter les couleurs ternes
        return `rgb(${r}, ${g}, ${b})`;
    } catch (e) {
        return null; // En cas d'erreur (CORS), on ne change rien
    }
}
function getAuthHeaders(extra = {}) {
    const headers = { ...extra };
    if (authState && authState.token) {
        headers['x-auth-token'] = authState.token;
    }
    return headers;
}

async function initAuthSession() {
    if (!authState || !authState.token) return;
    try {
        const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Session expirée');
        const data = await res.json();
        authState.user = data.user;
    } catch {
        authState.token = '';
        authState.user = null;
        localStorage.removeItem('localify_auth_token');
    }
}

function setAuthSession(token, user) {
    authState.token = token || '';
    authState.user = user || null;
    if (authState.token) {
        localStorage.setItem('localify_auth_token', authState.token);
    } else {
        localStorage.removeItem('localify_auth_token');
    }
    if (typeof renderUserMenu === 'function') renderUserMenu();
}
