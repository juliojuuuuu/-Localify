// ========================================
// PARAMÈTRES (COMPLET & CORRIGÉ)
// ========================================

const PRESET_THEMES = [
    {
        id: 'midnight',
        name: 'Midnight Neon',
        color: '#ff007b',
        wallpaper: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1600&q=80'
    },
    {
        id: 'sunset',
        name: 'Sunset Drive',
        color: '#ff6b35',
        wallpaper: 'https://images.unsplash.com/photo-1472120435266-53107fd0c44a?auto=format&fit=crop&w=1600&q=80'
    },
    {
        id: 'forest',
        name: 'Deep Forest',
        color: '#00c48c',
        wallpaper: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80'
    },
    {
        id: 'ocean',
        name: 'Ocean Breeze',
        color: '#00a8ff',
        wallpaper: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80'
    }
];

let themePolicy = { maxCustomThemes: 5, isAdmin: false, loaded: false };

async function loadThemePolicy() {
    if (!authState?.token) return;
    try {
        const res = await fetch('/api/themes/policy', { headers: getAuthHeaders() });
        const data = await res.json();
        if (res.ok && data.success) {
            themePolicy = {
                maxCustomThemes: data.maxCustomThemes,
                isAdmin: data.isAdmin === true,
                loaded: true,
                rawLimit: data.rawLimit
            };
        }
    } catch {}
}

function getCustomThemes() {
    if (!Array.isArray(personalization.customThemes)) personalization.customThemes = [];
    return personalization.customThemes;
}

function isThemeLimitReached() {
    const themes = getCustomThemes();
    if (themePolicy.isAdmin) return false;
    const limit = Number(themePolicy.maxCustomThemes);
    if (!Number.isFinite(limit)) return false;
    return themes.length >= Math.max(0, limit);
}

function loadSettingsSectionsState() {
    try {
        return JSON.parse(localStorage.getItem('localify_settings_sections') || '{}');
    } catch {
        return {};
    }
}

function saveSettingsSectionsState(state) {
    localStorage.setItem('localify_settings_sections', JSON.stringify(state || {}));
}

function setupCollapsibleSettingsBoxes() {
    const state = loadSettingsSectionsState();
    const boxes = document.querySelectorAll('.settings-grid .settings-box');

    boxes.forEach((box, index) => {
        const header = box.querySelector(':scope > .box-header');
        if (!header) return;

        const sectionKey = `section_${index}_${String(header.textContent || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        let content = box.querySelector(':scope > .settings-collapsible-content');

        if (!content) {
            content = document.createElement('div');
            content.className = 'settings-collapsible-content';
            const children = Array.from(box.children).filter(el => el !== header);
            children.forEach(child => content.appendChild(child));
            box.appendChild(content);
        }

        const collapsed = state[sectionKey] === true;
        content.style.display = collapsed ? 'none' : '';

        header.style.cursor = 'pointer';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';

        let badge = header.querySelector('.section-toggle-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'section-toggle-badge';
            badge.style.fontSize = '12px';
            badge.style.opacity = '0.85';
            badge.style.padding = '2px 8px';
            badge.style.border = '1px solid rgba(255,255,255,0.2)';
            badge.style.borderRadius = '999px';
            header.appendChild(badge);
        }
        badge.textContent = collapsed ? 'Voir plus ▾' : 'Réduire ▴';

        header.onclick = () => {
            const nextState = loadSettingsSectionsState();
            const isCollapsed = content.style.display === 'none';
            content.style.display = isCollapsed ? '' : 'none';
            nextState[sectionKey] = !isCollapsed;
            saveSettingsSectionsState(nextState);
            badge.textContent = isCollapsed ? 'Réduire ▴' : 'Voir plus ▾';
        };
    });
}

function showSettings() {
    updateNav([{name: 'Paramètres', cmd: 'showSettings()'}]);
    renderSettings();
    loadThemePolicy().then(() => renderSettings());
}

function renderSettings() {
    const currentColor = personalization.themeColor || localStorage.getItem('localify_theme') || '#ff007b';
    const currentSpeed = personalization.playbackRate || 1;
    const currentAmbiance = personalization.ambianceMode || 'none';
    const currentBlur = Number(personalization.blurIntensity ?? 10);
    const currentSidebarStyle = personalization.sidebarStyle || 'default';
    const currentAutoTheme = personalization.autoThemeByTime === true;
    const customThemes = getCustomThemes();

    const renderSwitch = (label, checked, key) => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-size:14px; color:#eee;">${label}</span>
            <label class="switch">
                <input type="checkbox" ${checked ? 'checked' : ''} onchange="togglePersonalization('${key}')">
                <span class="slider"></span>
            </label>
        </div>`;

    const limitText = themePolicy.isAdmin
        ? 'Illimité (admin)'
        : `Limite actuelle: ${Number(themePolicy.maxCustomThemes ?? 0)} thème(s)`;

    document.getElementById('content-area').innerHTML = `
    <div class="settings-container">
        <h2 class="section-title" style="margin-bottom:25px;">⚙️ Paramètres complets</h2>
        <div class="settings-grid">
            <div class="settings-box settings-box-wide">
                <div class="box-header">👤 Compte</div>
                ${renderAccountSection()}
            </div>

            <div class="settings-box settings-box-wide">
                <div class="box-header">🎨 Système de thèmes</div>
                <div class="setting-item">
                    <div class="setting-label">Thèmes prédéfinis (couleur + fond)</div>
                    <div class="theme-presets-grid">
                        ${PRESET_THEMES.map(t => `
                            <button class="theme-preset-btn ${personalization.themePreset === t.id ? 'active' : ''}" onclick="applyThemePreset('${t.id}')">
                                <span class="theme-preview" style="background-image:linear-gradient(140deg, rgba(0,0,0,0.35), rgba(0,0,0,0.75)), url('${t.wallpaper}')"></span>
                                <span class="theme-name">${t.name}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="setting-item">
                    <div class="setting-label">Mes thèmes personnalisés</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">${limitText}</div>
                    ${customThemes.length === 0 ? '<div style="font-size:13px;color:var(--text-muted);">Aucun thème perso pour le moment.</div>' : `
                        <div class="theme-presets-grid">
                            ${customThemes.map((t, idx) => `
                                <button class="theme-preset-btn" onclick="applyCustomTheme(${idx})">
                                    <span class="theme-preview" style="background-image:linear-gradient(140deg, rgba(0,0,0,0.35), rgba(0,0,0,0.75)), url('${t.wallpaper || ''}'); background-color:${t.color || '#ff007b'}"></span>
                                    <span class="theme-name">${t.name || `Custom ${idx + 1}`}</span>
                                </button>
                            `).join('')}
                        </div>
                    `}
                    <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
                        <button class="btn-secondary" onclick="openThemeCreatorModal()" ${isThemeLimitReached() ? 'disabled' : ''}>➕ Créer un thème personnalisé</button>
                        <button class="btn-secondary" onclick="applyThemePreset('custom')">Mode manuel</button>
                    </div>
                </div>

                <div class="setting-item" style="border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
                    <div class="setting-label">Couleur thème</div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <input type="color" value="${currentColor}" onchange="applyTheme(this.value)" style="flex:1; height:40px; border:none; cursor:pointer; background:none;">
                        <button class="btn-secondary" onclick="applyTheme('#ff007b')" style="height:40px; padding:0 15px;" title="Reset">↺</button>
                    </div>
                </div>

                <div class="setting-item">
                    <div class="setting-label">Fond d'écran (URL)</div>
                    <input type="text" class="styled-input" value="${personalization.bgImage || ''}" onchange="setWallpaper(this.value)" placeholder="https://..." style="width:100%; margin-bottom:10px;">
                    <button class="btn-secondary" onclick="setWallpaper('')" style="width:100%;">🗑️ Supprimer le fond</button>
                </div>

                <div class="setting-item">
                    <div class="setting-label">Intensité du flou : <span style="color:var(--accent); font-weight:bold;">${currentBlur}px</span></div>
                    <input type="range" min="0" max="20" step="1" value="${currentBlur}" style="width:100%; cursor:pointer;" oninput="setBlurIntensity(this.value)">
                </div>

                <div class="setting-item">
                    <div class="setting-label">Style du menu gauche</div>
                    <select class="styled-select" onchange="setSidebarStyle(this.value)">
                        <option value="default" ${currentSidebarStyle==='default'?'selected':''}>Classique</option>
                        <option value="transparent" ${currentSidebarStyle==='transparent'?'selected':''}>Transparent</option>
                        <option value="glass" ${currentSidebarStyle==='glass'?'selected':''}>Glass</option>
                    </select>
                </div>

                <div class="setting-item">
                    <div class="setting-label">Ambiance</div>
                    <select class="styled-select" onchange="setAmbiance(this.value)">
                        <option value="none" ${currentAmbiance==='none'?'selected':''}>Désactivé</option>
                        <option value="snow" ${currentAmbiance==='snow'?'selected':''}>❄️ Neige</option>
                        <option value="embers" ${currentAmbiance==='embers'?'selected':''}>🔥 Braises</option>
                        <option value="stars" ${currentAmbiance==='stars'?'selected':''}>✨ Étoiles</option>
                        <option value="fireflies" ${currentAmbiance==='fireflies'?'selected':''}>🧚 Lucioles</option>
                    </select>
                </div>

                ${renderSwitch('Auto-thème selon l\'heure', currentAutoTheme, 'autoThemeByTime')}
                ${renderSwitch('Contraste renforcé', personalization.highContrast === true, 'highContrast')}

                <div class="setting-item">
                    <div style="margin-top:4px;">
                        <div class="dash-action da-save" onclick="exportThemePreset()" style="margin-bottom:12px;">
                            <div class="da-icon">🎨</div>
                            <div class="da-info"><h3>Exporter mon preset</h3><p>Thème + particules</p></div>
                        </div>
                        <div class="dash-action da-load" onclick="importThemePreset()">
                            <div class="da-icon">📂</div>
                            <div class="da-info"><h3>Importer un preset</h3><p>Restaurer mon thème</p></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="settings-box">
                <div class="box-header">🎯 Mode Focus</div>
                <div class="setting-item">
                    <div class="setting-label">Style de Pochette</div>
                    <select class="styled-select" onchange="setCoverStyle(this.value)">
                        <option value="square" ${personalization.coverStyle==='square'?'selected':''}>Carré (Flottant)</option>
                        <option value="round" ${personalization.coverStyle==='round'?'selected':''}>Rond (Flottant)</option>
                        <option value="vinyl" ${personalization.coverStyle==='vinyl'?'selected':''}>Vinyle (Tourne)</option>
                    </select>
                </div>
                ${renderSwitch('Afficher bouton Coeur', personalization.showFocusHeart!==false, 'showFocusHeart')}
                ${renderSwitch('Activer Animations', personalization.enableFocusAnimation!==false, 'enableFocusAnimation')}
            </div>

            <div class="settings-box">
                <div class="box-header">🎧 Audio & Expérience</div>
                ${renderSwitch('Mode 8D (Audio Spatial)', personalization.enable8D, 'enable8D')}
                ${renderSwitch('Fondu enchaîné (Crossfade)', personalization.enableCrossfade, 'enableCrossfade')}
                <div style="margin: 15px 0;">
                    <button class="btn-secondary" style="width:100%; display:flex; justify-content:center; align-items:center; gap:10px;" onclick="openEQModal()">
                        <span>🎚️</span> Ouvrir l'Égaliseur
                    </button>
                </div>
                <div class="setting-item" style="border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
                    <div class="setting-label">Vitesse : <span id="speed-val" style="color:var(--accent); font-weight:bold;">x${currentSpeed}</span></div>
                    <input type="range" min="0.5" max="1.5" step="0.05" value="${currentSpeed}" style="width:100%; cursor:pointer;" oninput="updatePlaybackSpeed(this.value)">
                </div>
            </div>

            <div class="settings-box">
                <div class="box-header">⚙️ Interface</div>
                <div class="setting-item">
                    <div class="setting-label">Position "Récents"</div>
                    <select class="styled-select" onchange="setRecentPos(this.value)">
                        <option value="top" ${personalization.recentPosition==='top'?'selected':''}>Haut de page</option>
                        <option value="bottom" ${personalization.recentPosition==='bottom'?'selected':''}>Bas de page</option>
                    </select>
                </div>
                <div class="setting-item">
                    <div class="setting-label">Style Visualiseur</div>
                    <select class="styled-select" onchange="setVisStyle(this.value)">
                        <option value="bars" ${personalization.visualizerType==='bars'?'selected':''}>Barres</option>
                        <option value="round" ${personalization.visualizerType==='round'?'selected':''}>Circulaire</option>
                        <option value="wave" ${personalization.visualizerType==='wave'?'selected':''}>Onde</option>
                        <option value="none" ${personalization.visualizerType==='none'?'selected':''}>Désactivé</option>
                    </select>
                </div>
                ${renderSwitch('Playlists sur la bibliothèque', personalization.showPlaylistsOnHome, 'showPlaylistsOnHome')}
                ${renderSwitch('Économiseur d\'écran', personalization.enableScreensaver, 'enableScreensaver')}
            </div>

            <div class="settings-box">
                <div class="box-header">💾 Utilitaires</div>
                <div class="setting-item">
                    <div class="setting-label">🌙 Minuteur de sommeil</div>
                    <select class="styled-select" onchange="triggerSleepTimer(this.value)">
                        <option value="0">Désactivé</option>
                        <option value="15">15 Minutes</option>
                        <option value="30">30 Minutes</option>
                        <option value="60">1 Heure</option>
                    </select>
                </div>
                <div style="margin-top:20px; margin-bottom:10px;">
                    <button class="btn-secondary" style="width:100%;" onclick="document.getElementById('shortcuts-modal').style.display='flex'">
                        <span>⌨️</span> Raccourcis Clavier
                    </button>
                </div>
                <div style="margin-top:16px;">
                    <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Sauvegarde locale du compte connecté (utile pour migration / backup manuel).</div>
                    <div class="dash-action da-save" onclick="exportData()" style="margin-bottom:12px;">
                        <div class="da-icon">💾</div>
                        <div class="da-info"><h3>Exporter mes données</h3><p>Compte actuel : config + playlists</p></div>
                    </div>
                    <div class="dash-action da-load" onclick="triggerImport()">
                        <div class="da-icon">📥</div>
                        <div class="da-info"><h3>Importer une sauvegarde</h3><p>Restaurer dans ce compte</p></div>
                    </div>
                </div>
            </div>

            ${authState?.user?.isAdmin ? `
            <div class="settings-box settings-box-wide">
                <div class="box-header">🛡️ Administration des thèmes</div>
                <div class="setting-item">
                    <div class="setting-label">Limite thèmes personnalisés (utilisateurs non-admin)</div>
                    <input type="number" min="0" max="200" class="styled-input" id="admin-theme-limit" value="${Number(themePolicy.rawLimit ?? 5)}" style="width:100%; margin-bottom:10px;">
                    <button class="btn-secondary" style="width:100%;" onclick="saveAdminThemeLimit()">Enregistrer la limite</button>
                </div>
                <div class="setting-item" style="font-size:13px; color:var(--text-muted);">
                    <div class="setting-label" style="margin-bottom:8px; color:#fff;">💡 Idées d'options admin</div>
                    <ul style="padding-left:18px; margin:0; display:grid; gap:6px;">
                        <li>Activer / bloquer les inscriptions</li>
                        <li>Limiter le nombre de playlists par utilisateur</li>
                        <li>Forcer un thème global par défaut pour tous</li>
                        <li>Exporter les données d'un utilisateur spécifique</li>
                    </ul>
                </div>
            </div>
            ` : ''}
        </div>
    </div>`;

    setupCollapsibleSettingsBoxes();
}

// --- FONCTIONS LOGIQUES ---

function applyPersonalization() {
    // Gestion du fond d'écran
    if(personalization.bgImage) {
        document.body.style.setProperty('--bg-image', `url('${personalization.bgImage}')`);
        document.documentElement.style.setProperty('--bg-overlay', '0.85');
    } else {
        document.body.style.setProperty('--bg-image', 'none');
        document.documentElement.style.setProperty('--bg-overlay', '0.98');
    }
    
    document.body.classList.toggle('no-animations', personalization.enableFocusAnimation === false);
    const heart = document.getElementById('focus-fav-btn'); 
    if(heart) heart.style.setProperty('display', personalization.showFocusHeart!==false?'flex':'none', 'important');

    const cover = document.getElementById('focus-cover'); 
    if(cover) {
        cover.classList.remove('style-round', 'style-vinyl');
        if(personalization.coverStyle === 'round') cover.classList.add('style-round');
        if(personalization.coverStyle === 'vinyl') cover.classList.add('style-vinyl');
    }
    
    const blur = Number(personalization.blurIntensity ?? 10);
    document.documentElement.style.setProperty('--ui-blur', `${Math.max(0, Math.min(20, blur))}px`);
    const surfaceAlpha = blur === 0 ? 0.95 : 0.72;
    document.documentElement.style.setProperty('--ui-surface-alpha', String(surfaceAlpha));

    const sidebarStyle = personalization.sidebarStyle || 'default';
    if (sidebarStyle === 'transparent') {
        document.documentElement.style.setProperty('--sidebar-bg', 'rgba(0,0,0,0.35)');
        document.documentElement.style.setProperty('--sidebar-footer-bg', 'rgba(0,0,0,0.25)');
        document.documentElement.style.setProperty('--sidebar-border', 'rgba(255,255,255,0.08)');
    } else if (sidebarStyle === 'glass') {
        document.documentElement.style.setProperty('--sidebar-bg', 'rgba(18,18,18,0.72)');
        document.documentElement.style.setProperty('--sidebar-footer-bg', 'rgba(15,15,15,0.82)');
        document.documentElement.style.setProperty('--sidebar-border', 'rgba(255,255,255,0.14)');
    } else {
        document.documentElement.style.setProperty('--sidebar-bg', 'var(--side)');
        document.documentElement.style.setProperty('--sidebar-footer-bg', '#000');
        document.documentElement.style.setProperty('--sidebar-border', 'var(--border)');
    }

    document.body.classList.toggle('high-contrast', personalization.highContrast === true);

    if (personalization.autoThemeByTime === true) {
        const hour = new Date().getHours();
        const presetId = hour >= 19 || hour < 7 ? 'midnight' : (hour >= 12 ? 'sunset' : 'ocean');
        const preset = PRESET_THEMES.find(p => p.id === presetId);
        if (preset) {
            personalization.themeColor = preset.color;
            personalization.bgImage = preset.wallpaper;
        }
    }

    if(personalization.themeColor) applyTheme(personalization.themeColor, false);
}

function updatePlaybackSpeed(val) {
    const speed = parseFloat(val);
    document.getElementById('speed-val').innerText = 'x' + speed;
    if (audio) { audio.playbackRate = speed; audio.preservesPitch = true; }
    personalization.playbackRate = speed;
    savePerso();
}

function triggerSleepTimer(val) {
    const min = parseInt(val);
    if (typeof setSleepTimer === 'function') setSleepTimer(min);
}

async function savePerso() {
    localStorage.setItem('localify_perso', JSON.stringify(personalization));
    config.personalization = personalization;
    if(typeof saveData === 'function') await saveData('cfg', config);
}

function applyTheme(col, save=true) { 
    if (save) personalization.themePreset = 'custom';
    personalization.themeColor = col; 
    document.documentElement.style.setProperty('--accent', col);
    document.documentElement.style.setProperty('--accent-hover', col);
    
    let c = col.substring(1);
    if(c.length==3) c=c.split('').map(x=>x+x).join('');
    const r=parseInt(c.substring(0,2),16), g=parseInt(c.substring(2,4),16), b=parseInt(c.substring(4,6),16);
    if(typeof visualizerColor !== 'undefined') visualizerColor = {r,g,b};
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.6)`);
    
    localStorage.setItem('localify_theme', col);
    if(save) savePerso(); 
}

function setWallpaper(url) { 
    personalization.bgImage = url; 
    personalization.themePreset = 'custom';
    applyPersonalization(); savePerso(); 
    if(url === '') showNotification("Fond d'écran supprimé 🗑️");
}


function applyThemePreset(presetId) {
    if (presetId === 'custom') {
        personalization.themePreset = 'custom';
        savePerso();
        showSettings();
        showNotification('Mode personnalisé activé ✨', 'info');
        return;
    }

    const preset = PRESET_THEMES.find(p => p.id === presetId);
    if (!preset) return;

    personalization.themePreset = preset.id;
    personalization.bgImage = preset.wallpaper;
    applyTheme(preset.color, false);
    applyPersonalization();
    savePerso();
    showSettings();
    showNotification(`Thème ${preset.name} appliqué ✅`);
}

function setBlurIntensity(value) {
    const blur = Number(value);
    personalization.blurIntensity = Number.isFinite(blur) ? Math.max(0, Math.min(20, blur)) : 10;
    applyPersonalization();
    savePerso();
    showSettings();
}

function setSidebarStyle(style) {
    personalization.sidebarStyle = style || 'default';
    applyPersonalization();
    savePerso();
    showSettings();
}

function setCoverStyle(s) { personalization.coverStyle = s; applyPersonalization(); savePerso(); }
function setRecentPos(p) { personalization.recentPosition = p; savePerso(); showSettings(); }

function setVisStyle(s) { 
    personalization.visualizerType = s; savePerso(); 
    if (typeof drawVisualizer === 'function') {
        if (typeof animationId !== 'undefined' && animationId) cancelAnimationFrame(animationId);
        if (s !== 'none') drawVisualizer();
    }
}

// --- FONCTION AMBIANCE (LANCEMENT GLOBAL) ---
function setAmbiance(mode) {
    personalization.ambianceMode = mode;
    savePerso();
    // Lance immédiatement les particules (fonction définie dans ui.js)
    if (typeof initParticles === 'function') initParticles();
}


function openThemeCreatorModal() {
    if (isThemeLimitReached()) {
        showNotification('Limite de thèmes personnalisés atteinte', 'error');
        return;
    }

    const html = `
    <div id="theme-creator-modal" class="modal" style="display:flex;">
        <div class="modal-content" style="max-width:560px;">
            <h3 class="modal-title">🧩 Créer un thème personnalisé</h3>
            <input id="custom-theme-name" class="styled-input" style="width:100%; margin-bottom:10px;" placeholder="Nom du thème">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                <div>
                    <label style="font-size:12px; color:var(--text-muted);">Couleur principale</label>
                    <input id="custom-theme-color" type="color" value="${personalization.themeColor || '#ff007b'}" style="width:100%; height:42px; border:none; background:none;">
                </div>
                <div>
                    <label style="font-size:12px; color:var(--text-muted);">Flou (0-20)</label>
                    <input id="custom-theme-blur" type="number" min="0" max="20" value="${Number(personalization.blurIntensity ?? 10)}" class="styled-input" style="width:100%;">
                </div>
            </div>
            <input id="custom-theme-wallpaper" class="styled-input" style="width:100%; margin-bottom:10px;" placeholder="URL fond d'écran" value="${escapeHtml(personalization.bgImage || '')}">
            <select id="custom-theme-sidebar" class="styled-select" style="width:100%; margin-bottom:10px;">
                <option value="default" ${(personalization.sidebarStyle||'default')==='default'?'selected':''}>Sidebar Classique</option>
                <option value="transparent" ${personalization.sidebarStyle==='transparent'?'selected':''}>Sidebar Transparent</option>
                <option value="glass" ${personalization.sidebarStyle==='glass'?'selected':''}>Sidebar Glass</option>
            </select>
            <select id="custom-theme-ambiance" class="styled-select" style="width:100%; margin-bottom:12px;">
                <option value="none" ${(personalization.ambianceMode||'none')==='none'?'selected':''}>Ambiance: Désactivée</option>
                <option value="snow" ${personalization.ambianceMode==='snow'?'selected':''}>Ambiance: ❄️ Neige</option>
                <option value="embers" ${personalization.ambianceMode==='embers'?'selected':''}>Ambiance: 🔥 Braises</option>
                <option value="stars" ${personalization.ambianceMode==='stars'?'selected':''}>Ambiance: ✨ Étoiles</option>
                <option value="fireflies" ${personalization.ambianceMode==='fireflies'?'selected':''}>Ambiance: 🧚 Lucioles</option>
            </select>
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:12px; font-size:13px; color:#eee;">
                <input id="custom-theme-contrast" type="checkbox" ${personalization.highContrast ? 'checked' : ''}> Contraste renforcé
            </label>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeThemeCreatorModal()">Annuler</button>
                <button class="btn-primary" onclick="createCustomThemeFromModal()">Créer le thème</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function closeThemeCreatorModal() {
    document.getElementById('theme-creator-modal')?.remove();
}

function createCustomThemeFromModal() {
    const themes = getCustomThemes();
    if (isThemeLimitReached()) {
        showNotification('Limite atteinte pour ce compte', 'error');
        return;
    }

    const name = String(document.getElementById('custom-theme-name')?.value || '').trim();
    const color = String(document.getElementById('custom-theme-color')?.value || '#ff007b');
    const wallpaper = String(document.getElementById('custom-theme-wallpaper')?.value || '').trim();
    const blurIntensity = Number(document.getElementById('custom-theme-blur')?.value || 10);
    const sidebarStyle = String(document.getElementById('custom-theme-sidebar')?.value || 'default');
    const ambianceMode = String(document.getElementById('custom-theme-ambiance')?.value || 'none');
    const highContrast = document.getElementById('custom-theme-contrast')?.checked === true;

    if (!name) {
        showNotification('Donne un nom au thème', 'error');
        return;
    }

    themes.push({
        id: `custom-${Date.now()}`,
        name,
        color,
        wallpaper,
        blurIntensity: Math.max(0, Math.min(20, Number.isFinite(blurIntensity) ? blurIntensity : 10)),
        sidebarStyle: ['default', 'transparent', 'glass'].includes(sidebarStyle) ? sidebarStyle : 'default',
        ambianceMode: ['none', 'snow', 'embers', 'stars', 'fireflies'].includes(ambianceMode) ? ambianceMode : 'none',
        highContrast
    });

    personalization.customThemes = themes;
    savePerso();
    closeThemeCreatorModal();
    showNotification('Thème personnalisé créé ✅');
    renderSettings();
}

function applyCustomTheme(index) {
    const themes = getCustomThemes();
    const theme = themes[index];
    if (!theme) return;

    personalization.themePreset = theme.id || 'custom';
    personalization.themeColor = theme.color || personalization.themeColor;
    personalization.bgImage = theme.wallpaper || '';
    personalization.blurIntensity = Number(theme.blurIntensity ?? 10);
    personalization.sidebarStyle = theme.sidebarStyle || 'default';
    personalization.ambianceMode = theme.ambianceMode || 'none';
    personalization.highContrast = theme.highContrast === true;

    applyTheme(personalization.themeColor, false);
    applyPersonalization();
    if (typeof initParticles === 'function') initParticles();
    savePerso();
    renderSettings();
    showNotification(`Thème ${theme.name} appliqué ✅`);
}

async function saveAdminThemeLimit() {
    if (!authState?.user?.isAdmin) return;
    const input = document.getElementById('admin-theme-limit');
    const maxCustomThemes = Number(input?.value ?? 5);

    try {
        const res = await fetch('/api/admin/themes/policy', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ maxCustomThemes })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Mise à jour impossible');

        themePolicy.rawLimit = data.maxCustomThemes;
        themePolicy.maxCustomThemes = data.maxCustomThemes;
        showNotification('Limite des thèmes mise à jour ✅');
        renderSettings();
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

function togglePersonalization(k) { 
    if(personalization[k]===undefined) personalization[k]=true; 
    personalization[k] = !personalization[k]; 
    
    if (k === 'chameleonMode') {
        if (personalization[k]) {
            const cover = document.getElementById('player-cover');
            if (cover && typeof getDominantColor === 'function') {
                const color = getDominantColor(cover);
                if (color) applyTheme(color, false);
            }
        } else {
            const savedColor = localStorage.getItem('localify_theme') || '#ff007b';
            applyTheme(savedColor);
        }
    }
    
    if (k === 'enable8D') {
        if (typeof toggle8DMode === 'function') toggle8DMode(personalization[k]);
        if (personalization[k] && typeof initAudioContext === 'function') initAudioContext();
    }

    applyPersonalization(); savePerso(); showSettings();
    if (k === 'enableFocusAnimation' && personalization[k] === true && typeof drawVisualizer === 'function') requestAnimationFrame(drawVisualizer);
}

function exportData() {
    const data = { playlists, favs, config, personalization, theme: personalization.themeColor };
    const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = "localify_backup.json"; a.click();
}

function triggerImport() { 
    const input = document.getElementById('import-file');
    if(input) input.click(); 
}

function renderAccountSection() {
    if (authState.user) {
        return `
            <div class="setting-item">
                <div class="setting-label">Connecté en tant que</div>
                <div style="font-weight:bold; color:var(--accent); margin-bottom:6px;">${escapeHtml(authState.user.username)}</div>
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Rôle: ${authState.user.isAdmin ? 'Admin' : 'Utilisateur'}</div>
                ${authState.user.isAdmin ? '<div style="font-size:12px; color:var(--accent); margin-bottom:10px;">🛠️ Compte admin activé (fonctionnalités à venir)</div>' : ''}
                <button class="btn-secondary" style="width:100%; margin-bottom:8px;" onclick="openAvatarModal()">Changer l'avatar</button>
                <button class="btn-secondary" style="width:100%; margin-bottom:8px;" onclick="openPasswordModal()">Changer le mot de passe</button>
                <button class="btn-secondary" style="width:100%;" onclick="logoutAccount()">Se déconnecter</button>
            </div>`;
    }

    return `
        <div class="setting-item">
            <div class="setting-label">Connexion</div>
            <input id="auth-login-username" type="text" class="styled-input" placeholder="Nom d'utilisateur" style="width:100%; margin-bottom:8px;">
            <input id="auth-login-password" type="password" class="styled-input" placeholder="Mot de passe" style="width:100%; margin-bottom:10px;">
            <button class="btn-secondary" style="width:100%; margin-bottom:14px;" onclick="loginAccount()">Se connecter</button>

            <div class="setting-label" style="margin-top:8px;">Inscription</div>
            <input id="auth-register-username" type="text" class="styled-input" placeholder="Nom d'utilisateur" style="width:100%; margin-bottom:8px;">
            <input id="auth-register-password" type="password" class="styled-input" placeholder="Mot de passe (6+ caractères)" style="width:100%; margin-bottom:10px;">
            <button class="btn-primary" style="width:100%;" onclick="registerAccount()">Créer un compte</button>
        </div>`;

    setupCollapsibleSettingsBoxes();
}

async function loginAccount(fromStartup = false) {
    const username = (document.getElementById('auth-login-username')?.value || document.getElementById('startup-login-username')?.value || '').trim();
    const password = document.getElementById('auth-login-password')?.value || document.getElementById('startup-login-password')?.value || '';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Connexion impossible');

        setAuthSession(data.token, data.user);
        showNotification(`Bienvenue ${data.user.username} 👋`);
        if (typeof init === 'function') await init();
        if (typeof renderUserMenu === 'function') renderUserMenu();
        if (!fromStartup) showSettings();
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function registerAccount(fromStartup = false) {
    const username = (document.getElementById('auth-register-username')?.value || document.getElementById('startup-register-username')?.value || '').trim();
    const password = document.getElementById('auth-register-password')?.value || document.getElementById('startup-register-password')?.value || '';

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Inscription impossible');

        setAuthSession(data.token, data.user);
        showNotification('Compte créé avec succès ✅');
        if (typeof init === 'function') await init();
        if (typeof renderUserMenu === 'function') renderUserMenu();
        if (!fromStartup) showSettings();
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function logoutAccount() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' })
        });
    } catch {}

    setAuthSession('', null);
    showNotification('Déconnecté');
    if (typeof init === 'function') await init();
    if (typeof renderUserMenu === 'function') renderUserMenu();
}



function exportThemePreset() {
    const data = {
        themeColor: personalization.themeColor,
        bgImage: personalization.bgImage,
        blurIntensity: personalization.blurIntensity,
        sidebarStyle: personalization.sidebarStyle,
        highContrast: personalization.highContrast,
        ambianceMode: personalization.ambianceMode || 'none'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'localify-theme-preset.json';
    a.click();
}

function importThemePreset() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(String(reader.result || '{}'));
                personalization.themeColor = data.themeColor || personalization.themeColor;
                personalization.bgImage = data.bgImage || '';
                personalization.blurIntensity = Number(data.blurIntensity ?? personalization.blurIntensity ?? 10);
                personalization.sidebarStyle = data.sidebarStyle || 'default';
                personalization.highContrast = data.highContrast === true;
                personalization.ambianceMode = data.ambianceMode || 'none';
                applyPersonalization();
                if (typeof initParticles === 'function') initParticles();
                savePerso();
                showSettings();
                showNotification('Preset importé ✅');
            } catch {
                showNotification('❌ Preset invalide', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return 'Faible';
    if (score <= 3) return 'Moyenne';
    return 'Forte';
}

function openAvatarModal() {
    const current = authState?.user?.avatarUrl || '';
    const html = `<div id="quick-account-modal" class="modal" style="display:flex;"><div class="modal-content" style="max-width:420px;"><h3 class="modal-title">🖼️ Changer l'avatar</h3><input id="account-avatar-input" class="styled-input" style="width:100%; margin-bottom:12px;" placeholder="https://..." value="${escapeHtml(current)}"><div class="modal-actions"><button class="btn-secondary" onclick="closeQuickAccountModal()">Annuler</button><button class="btn-primary" onclick="changeAvatarFromMenu(document.getElementById('account-avatar-input').value)">Enregistrer</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function openPasswordModal() {
    const html = `<div id="quick-account-modal" class="modal" style="display:flex;"><div class="modal-content" style="max-width:420px;"><h3 class="modal-title">🔒 Changer le mot de passe</h3><input id="account-pass-current" type="password" class="styled-input" style="width:100%; margin-bottom:8px;" placeholder="Mot de passe actuel"><input id="account-pass-new" type="password" class="styled-input" style="width:100%; margin-bottom:8px;" placeholder="Nouveau mot de passe" oninput="document.getElementById('pwd-strength').textContent='Force: ' + getPasswordStrength(this.value)"><div id="pwd-strength" style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Force: Faible</div><div class="modal-actions"><button class="btn-secondary" onclick="closeQuickAccountModal()">Annuler</button><button class="btn-primary" onclick="changePasswordFromMenu(document.getElementById('account-pass-current').value, document.getElementById('account-pass-new').value)">Enregistrer</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function closeQuickAccountModal() {
    document.getElementById('quick-account-modal')?.remove();
}

async function changeAvatarFromMenu(inputValue) {
    const avatarUrl = typeof inputValue === 'string' ? inputValue : (authState?.user?.avatarUrl || '');

    try {
        const res = await fetch('/api/auth/avatar', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ avatarUrl: avatarUrl.trim() })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Mise à jour avatar impossible');

        authState.user = data.user;
        if (typeof renderUserMenu === 'function') renderUserMenu();
        closeQuickAccountModal();
        showNotification('Avatar mis à jour ✅');
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function changePasswordFromMenu(currentPassword, newPassword) {
    if (!currentPassword || !newPassword) return;

    try {
        const res = await fetch('/api/auth/password', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Mise à jour impossible');

        closeQuickAccountModal();
        showNotification('Mot de passe changé 🔐');
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}
