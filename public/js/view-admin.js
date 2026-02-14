// ========================================
// VUE ADMIN (VERSION DIAGNOSTIC & SECOURS)
// ========================================

let adminSettings = {
    registrationEnabled: true,
    maxPlaylistsPerUser: 50,
    globalTheme: null,
    globalThemeForced: false
};

let adminUsers = [];
let lastAdminError = null; // Pour stocker l'erreur et l'afficher

async function showAdminPanel() {
    updateNav([{name: 'Administration', cmd: 'showAdminPanel()'}]);
    
    if (!authState || !authState.user || !authState.user.isAdmin) {
        showNotification("⛔ Accès réservé aux administrateurs", "error");
        if(typeof showDashboard === 'function') showDashboard();
        return;
    }

    await loadAdminData();
    renderAdminPanel();
}

async function loadAdminData() {
    try {
        const headers = getAuthHeaders();
        lastAdminError = null;
        
        // --- 1. TENTATIVE CHARGEMENT UTILISATEURS ---
        console.log("Admin: Fetching users...");
        const usersRes = await fetch('/api/admin/users', { headers });
        
        if (usersRes.ok) {
            const data = await usersRes.json();
            // Détection du format (Tableau ou Objet)
            if (Array.isArray(data)) adminUsers = data;
            else if (data.users && Array.isArray(data.users)) adminUsers = data.users;
            else if (data.data && Array.isArray(data.data)) adminUsers = data.data;
            else adminUsers = [];
        } else {
            // EN CAS D'ERREUR HTTP (404, 403, 500...)
            lastAdminError = `Erreur Serveur: ${usersRes.status} (${usersRes.statusText})`;
            console.error("Admin Error:", lastAdminError);
            showNotification(`⚠️ ${lastAdminError}`, "error");
            
            // On ajoute l'utilisateur actuel pour ne pas avoir un tableau vide
            if (authState.user) {
                adminUsers = [{
                    ...authState.user,
                    playlistCount: playlists.length,
                    favoritesCount: favs.length,
                    isAdmin: true
                }];
            }
        }
        
        // --- 2. TENTATIVE CHARGEMENT PARAMÈTRES ---
        const settingsRes = await fetch('/api/admin/settings', { headers });
        if (settingsRes.ok) {
            const data = await settingsRes.json();
            adminSettings = { ...adminSettings, ...(data.settings || data) };
        }

    } catch (error) {
        lastAdminError = "Erreur Connexion: " + error.message;
        console.error('Admin Critical:', error);
        showNotification("❌ Impossible de joindre le serveur", "error");
    }
}

function renderAdminPanel() {
    const container = document.getElementById('content-area');
    if (!container) return;

    const safeUsers = Array.isArray(adminUsers) ? adminUsers : [];
    // Utilisation des données locales si les données admin manquent
    const totalPlaylists = safeUsers.reduce((sum, u) => sum + (Number(u.playlistCount) || 0), 0) || playlists.length;
    const musicCount = (typeof allMusic !== 'undefined' && Array.isArray(allMusic)) ? allMusic.length : 0;

    container.innerHTML = `
        <div class="dashboard-container">
            <div class="dash-hero" style="background: linear-gradient(135deg, #b026ff 0%, #ff007b 100%); min-height: 180px;">
                <div class="dash-hero-content">
                    <div class="dash-greeting">
                        <h1>🛡️ Administration</h1>
                        <p style="margin: 10px 0 0 0; font-size: 15px; color: rgba(255,255,255,0.8);">Gestion centralisée</p>
                        ${lastAdminError ? `<div style="margin-top:10px; padding:5px 10px; background:rgba(0,0,0,0.3); border-radius:4px; font-size:12px; color:#ffcccc;">🕵️ Diagnostic : ${lastAdminError}</div>` : ''}
                    </div>
                    <button class="btn-primary" onclick="forceExportGlobal()">💾 Export Global (Force)</button>
                </div>
            </div>

            <div class="dash-section-title">📊 Statistiques</div>
            <div class="dash-grid">
                <div class="dash-stat ds-blue">
                    <div class="dash-stat-icon">👥</div>
                    <div class="dash-stat-val">${safeUsers.length}</div>
                    <div class="dash-stat-label">Utilisateurs</div>
                </div>
                <div class="dash-stat ds-purple">
                    <div class="dash-stat-icon">🎵</div>
                    <div class="dash-stat-val">${musicCount}</div>
                    <div class="dash-stat-label">Titres</div>
                </div>
                <div class="dash-stat ds-orange">
                    <div class="dash-stat-icon">📂</div>
                    <div class="dash-stat-val">${totalPlaylists}</div>
                    <div class="dash-stat-label">Playlists</div>
                </div>
            </div>

            <div class="dash-section-title">👥 Utilisateurs ${lastAdminError ? '(Mode Local)' : ''}</div>
            <div style="padding: 0 30px;">
                ${renderAdminUsersTable()}
            </div>
            
            ${lastAdminError ? `
            <div style="margin: 20px 30px; padding: 15px; background: rgba(255,0,0,0.1); border: 1px solid rgba(255,0,0,0.3); border-radius: 8px;">
                <h3 style="margin-top:0; color: #ff6b6b;">🛠️ Dépannage</h3>
                <p style="font-size: 13px; color: var(--text-muted);">
                    Le serveur ne renvoie pas la liste des utilisateurs (${lastAdminError}).<br>
                    Cependant, l'<strong>Export Global</strong> fonctionne désormais en utilisant vos données locales comme secours.
                </p>
            </div>` : ''}
        </div>
    `;
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function renderAdminUsersTable() {
    if (!adminUsers || adminUsers.length === 0) {
        return '<div class="empty-state"><p>Aucune donnée utilisateur disponible.</p></div>';
    }

    return `
        <div class="chart-box" style="padding: 0; overflow: hidden;">
            ${adminUsers.map(user => {
                const isCurrentUser = authState.user && authState.user.username === user.username;
                const uname = user.username || 'Inconnu';
                // Si l'avatar est une URL longue, on l'affiche, sinon une initiale
                const hasAvatar = user.avatarUrl && user.avatarUrl.length > 5;
                
                return `
                    <div class="row" style="padding: 15px 20px; ${isCurrentUser ? 'background: rgba(255,0,123,0.1);' : ''}">
                        <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                            ${hasAvatar ? 
                                `<img src="${escapeHtml(user.avatarUrl)}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : 
                                `<div style="width: 40px; height: 40px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">${uname.charAt(0).toUpperCase()}</div>`
                            }
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: bold; font-size: 15px;">
                                    ${escapeHtml(uname)}
                                    ${user.isAdmin ? '<span style="background: var(--accent); padding: 2px 8px; border-radius: 10px; font-size: 10px; margin-left: 8px; vertical-align: middle;">ADMIN</span>' : ''}
                                    ${isCurrentUser ? '<span style="background: var(--success); padding: 2px 8px; border-radius: 10px; font-size: 10px; margin-left: 8px; vertical-align: middle;">MOI</span>' : ''}
                                </div>
                                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                                    ${user.playlistCount || 0} playlists · ${user.favoritesCount || 0} favoris
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="action-btn" onclick="exportAdminUserData('${uname}')" title="Sauvegarder cet utilisateur">💾</button>
                            ${!isCurrentUser ? `<button class="action-btn" onclick="deleteAdminUser('${uname}')" style="color: #ff4d4d;" title="Supprimer">🗑️</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// --- FONCTION D'EXPORT "BLINDÉE" (CLIENT + SERVEUR) ---
async function forceExportGlobal() {
    const btn = document.querySelector('.dash-hero-content .btn-primary');
    if(btn) { btn.innerText = "⏳ Génération..."; btn.disabled = true; }

    try {
        // Etape 1 : On tente l'export serveur officiel
        console.log("Tentative export serveur...");
        const res = await fetch('/api/admin/export-all', { headers: getAuthHeaders() });
        
        if (res.ok) {
            const blob = await res.blob();
            downloadBlob(blob, `localify-FULL-export-${Date.now()}.json`);
            showNotification('✅ Export serveur réussi');
        } else {
            throw new Error(`Serveur a répondu ${res.status}`);
        }

    } catch (serverError) {
        console.warn("Echec export serveur, passage en mode LOCAL:", serverError);
        
        // Etape 2 : Export de secours (Client-Side)
        // On rassemble toutes les données disponibles dans le navigateur
        try {
            const backupData = {
                source: "client-side-backup",
                date: new Date().toISOString(),
                user: authState.user,
                playlists: typeof playlists !== 'undefined' ? playlists : [],
                favorites: typeof favs !== 'undefined' ? favs : [],
                config: typeof config !== 'undefined' ? config : {},
                personalization: typeof personalization !== 'undefined' ? personalization : {},
                musicCount: typeof allMusic !== 'undefined' ? allMusic.length : 0
            };

            const jsonStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            downloadBlob(blob, `localify-CLIENT-BACKUP-${Date.now()}.json`);
            
            showNotification('⚠️ Export Local généré (Serveur injoignable)', 'warning');
        } catch (clientError) {
            showNotification("❌ Echec total de l'export", "error");
        }
    } finally {
        if(btn) { btn.innerText = "💾 Export Global (Force)"; btn.disabled = false; }
    }
}

// Utilitaire de téléchargement
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- AUTRES ACTIONS ADMIN ---
async function exportAdminUserData(username) {
    // Si c'est moi, on utilise la sauvegarde locale client
    if (authState.user && authState.user.username === username) {
        if(typeof exportData === 'function') {
            exportData(); // Utilise la fonction de settings.js
            return;
        }
    }

    try {
        const res = await fetch(`/api/admin/export-user/${encodeURIComponent(username)}`, { headers: getAuthHeaders() });
        if (res.ok) {
            const blob = await res.blob();
            downloadBlob(blob, `localify-${username}.json`);
            showNotification("Export utilisateur réussi ✅");
        } else {
            showNotification("Erreur serveur lors de l'export", "error");
        }
    } catch (e) { showNotification("Erreur réseau", "error"); }
}

async function deleteAdminUser(username) {
    if(!confirm(`⚠️ ATTENTION: Supprimer définitivement l'utilisateur "${username}" ?`)) return;
    
    try {
        const res = await fetch(`/api/admin/delete-user/${encodeURIComponent(username)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (res.ok) {
            showNotification("Utilisateur supprimé 🗑️");
            loadAdminData(); // Rafraîchir
            renderAdminPanel();
        } else {
            showNotification("Erreur lors de la suppression", "error");
        }
    } catch (e) { showNotification("Erreur réseau", "error"); }
}

// Paramètres admin (toggle)
async function toggleAdminRegistration(enabled) {
    // Simulation visuelle immédiate
    adminSettings.registrationEnabled = enabled;
    try {
        await fetch('/api/admin/settings/registration', {
            method: 'POST',
            headers: getAuthHeaders({'Content-Type': 'application/json'}),
            body: JSON.stringify({ enabled })
        });
        showNotification(`Inscriptions ${enabled ? 'ouvertes' : 'fermées'}`);
    } catch (e) { console.error(e); }
}