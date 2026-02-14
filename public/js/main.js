// ========================================
// MAIN ENTRY POINT (DÉMARRAGE UNIQUE)
// ========================================

function renderAuthGate() {
    const content = document.getElementById('content-area');
    if (!content) return;

    content.innerHTML = `
    <div class="settings-container" style="max-width:520px; margin:40px auto;">
        <h2 class="section-title" style="margin-bottom:20px;">🔒 Connexion obligatoire</h2>
        <div class="settings-box">
            <div class="box-header">Connexion</div>
            <div class="setting-item">
                <input id="startup-login-username" type="text" class="styled-input" placeholder="Nom d'utilisateur" style="width:100%; margin-bottom:10px;">
                <input id="startup-login-password" type="password" class="styled-input" placeholder="Mot de passe" style="width:100%; margin-bottom:10px;">
                <button class="btn-secondary" style="width:100%; margin-bottom:16px;" onclick="loginAccount(true)">Se connecter</button>

                <div class="setting-label">Pas encore de compte ?</div>
                <input id="startup-register-username" type="text" class="styled-input" placeholder="Nom d'utilisateur" style="width:100%; margin-bottom:10px;">
                <input id="startup-register-password" type="password" class="styled-input" placeholder="Mot de passe (6+ caractères)" style="width:100%; margin-bottom:10px;">
                <button class="btn-primary" style="width:100%;" onclick="registerAccount(true)">Créer un compte</button>
            </div>
        </div>
    </div>`;
}

function hidePlayerUntilAuth() {
    const player = document.querySelector('.player');
    if (player) player.style.display = authState.user ? '' : 'none';
}

async function init() {
    console.log('🚀 Démarrage de Localify...');
    try {
        if (typeof initAuthSession === 'function') await initAuthSession();





        

        if (!authState.user) {
            renderAuthGate();
            if (typeof renderUserMenu === 'function') renderUserMenu();
            hidePlayerUntilAuth();
            return;
        }

        const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
        const [mRes, fRes, pRes, cRes, hRes] = await Promise.all([
            fetch('/api/music'),
            fetch('/api/data/fav', { headers }),
            fetch('/api/data/pl', { headers }),
            fetch('/api/data/cfg', { headers }),
            fetch('/api/data/history', { headers })
        ]);

        allMusic = await mRes.json();

        favs = await fRes.json() || [];
        playlists = await pRes.json() || [];
        history = await hRes.json() || [];

        const serverConfig = await cRes.json() || { autoplay: true, volume: 1 };
        config = serverConfig;

        if (serverConfig.personalization) {
            personalization = { ...personalization, ...serverConfig.personalization };
            localStorage.setItem('localify_perso', JSON.stringify(personalization));
            if (personalization.themeColor) localStorage.setItem('localify_theme', personalization.themeColor);
        }

        if (typeof renderPLs === 'function') renderPLs();
        if (typeof showLib === 'function') showLib();
        if (typeof restoreSession === 'function') restoreSession();
        if (typeof applyPersonalization === 'function') applyPersonalization();
        if (typeof renderUserMenu === 'function') renderUserMenu();

        if (config.volume !== undefined) {
            audio.volume = config.volume;
            const volInput = document.getElementById('vol');
            if (volInput) volInput.value = config.volume;
        }

        hidePlayerUntilAuth();
        console.log(`✅ Chargé : ${allMusic.length} titres`);
    } catch (e) {
        console.error('❌ Erreur critique au démarrage:', e);
        if (typeof showNotification === 'function') showNotification('Erreur de connexion au serveur', 'error');
    }




    // Afficher le bouton admin
if (authState.user && authState.user.isAdmin) {
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) adminBtn.style.display = 'flex';
}




}

document.addEventListener('DOMContentLoaded', async () => {
    await init();

    if (typeof setupAudioEventHandlers === 'function') setupAudioEventHandlers();
    if (typeof setupUIEventHandlers === 'function') setupUIEventHandlers();
    if (typeof updateShuffleRepeatUI === 'function') updateShuffleRepeatUI();
});



