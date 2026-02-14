// ========================================
// PLAYLISTS & FAVORIS & DRAG DROP & PARTAGE
// ========================================

// Variable globale pour stocker l'index de la playlist à supprimer
let playlistToDeleteIndex = null;

function renderPLs() {
    generateSmartPlaylists();
}

function generateSmartPlaylists() {
    const plList = document.getElementById('pl-list');
    if (!plList) return;

    const smartHtml = `
        <div class="sidebar-pl-row" onclick="showSmartPL('recent')">
            <div class="sidebar-pl-thumb" style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);">📅</div>
            <span class="sidebar-pl-name" style="color:var(--accent);">Récemment Ajoutés</span>
        </div>
        <div class="sidebar-pl-row" onclick="showSmartPL('top')">
            <div class="sidebar-pl-thumb" style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);">🔥</div>
            <span class="sidebar-pl-name" style="color:var(--accent);">Top 50</span>
        </div>
        <div style="height:1px; background:var(--border); margin:10px 15px; opacity:0.5;"></div>`;

    const userPlaylistsHtml = playlists.map((pl, i) => {
        let imgUrl = 'https://img.icons8.com/?size=100&id=20909&format=png&color=FFFFFF';
        if (pl.tracks.length > 0) imgUrl = getCover(pl.tracks[0]);
        return `<div class="sidebar-pl-row" onclick="showPL(${i})">
            <img src="${imgUrl}" class="sidebar-pl-thumb" loading="lazy">
            <span class="sidebar-pl-name">${escapeHtml(pl.name)}</span>
        </div>`;
    }).join('');

    plList.innerHTML = smartHtml + userPlaylistsHtml;
}

function showSmartPL(type) {
    let tracks = [];
    let title = "";
    
    if (type === 'recent') {
        title = "📅 Récemment Ajoutés";
        tracks = allMusic.slice(-50).reverse();
    } else if (type === 'top') {
        title = "🔥 Top 50 (Historique)";
        tracks = history.slice(0, 50);
    }

    if (tracks.length === 0) {
        showNotification("Playlist vide pour le moment", "info");
        return;
    }

    updateNav([{name: 'Playlists', cmd: 'showAllPlaylists()'}, {name: title, cmd: ''}]);
    currentViewTracks = tracks;
    
    let html = `
        <div class="playlist-header-banner">
            <div class="pl-info">
                <div class="pl-type">PLAYLIST INTELLIGENTE</div>
                <h1 class="pl-title">${title}</h1>
                <div class="pl-meta">${tracks.length} titres</div>
                <div class="pl-actions-bar">
                    <button class="btn-primary" onclick="playAll()">▶ Lecture</button>
                </div>
            </div>
        </div>
        <div class="playlist-tracks">`;

    html += tracks.map((track, i) => {
        const isPlaying = (queue[qIdx]?.path === track.path);
        return `
        <div class="row ${isPlaying ? 'active-track' : ''}" 
             onclick="playFromList(${i})" 
             oncontextmenu="openContextMenu(event, ${i})">
            <img src="${getCover(track)}" class="track-thumbnail" loading="lazy">
            <div class="track-info">
                <div class="track-name">${escapeHtml(track.name)}</div>
                <div class="track-artist">${escapeHtml(track.artist)}</div>
            </div>
            
            <div class="row-actions">
                <button class="action-btn desktop-only" onclick="event.stopPropagation(); addToQueue(${i})" title="Queue">⏳</button>
                <button class="action-btn" onclick="event.stopPropagation(); toggleFav(${i})" title="Favoris">❤️</button>
                <button class="action-btn mobile-only" onclick="event.stopPropagation(); openContextMenu(event, ${i})">⋮</button>
            </div>
        </div>`;
    }).join('');

    html += `</div>`;
    document.getElementById('content-area').innerHTML = html;
}

// --- CRÉATION DE PLAYLIST ---

function createPL() { 
    const modal = document.getElementById('create-pl-modal');
    const input = document.getElementById('new-pl-name');
    if (modal && input) {
        modal.style.display = 'flex';
        input.value = '';
        setTimeout(() => input.focus(), 50);
        input.onkeydown = (e) => {
            if (e.key === 'Enter') confirmCreatePL();
            if (e.key === 'Escape') closeCreatePL();
        };
    }
}

function closeCreatePL() {
    const modal = document.getElementById('create-pl-modal');
    if (modal) modal.style.display = 'none';
}

async function confirmCreatePL() {
    const input = document.getElementById('new-pl-name');
    const name = input.value.trim();
    if (name) { 
        playlists.push({ name, tracks: [] }); 
        await saveData('pl', playlists); 
        renderPLs(); 
        if(typeof showAllPlaylists === 'function') showAllPlaylists(); 
        closeCreatePL();
        showNotification(`Playlist "${name}" créée !`); 
    } else {
        showNotification("Veuillez entrer un nom", "error");
    }
}

// --- SUPPRESSION DE PLAYLIST ---

function deletePL(idx) {
    playlistToDeleteIndex = idx;
    const plName = playlists[idx].name;
    const msgElement = document.getElementById('delete-pl-msg');
    if (msgElement) {
        msgElement.innerText = `Voulez-vous vraiment supprimer la playlist "${plName}" ?`;
    }
    const modal = document.getElementById('delete-pl-modal');
    if (modal) modal.style.display = 'flex';
}

async function performDeletePL() {
    if (playlistToDeleteIndex !== null) {
        playlists.splice(playlistToDeleteIndex, 1);
        await saveData('pl', playlists);
        renderPLs();
        if(typeof showAllPlaylists === 'function') showAllPlaylists();
        showNotification(`Playlist supprimée 🗑️`);
    }
    closeDeleteModal();
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-pl-modal');
    if (modal) modal.style.display = 'none';
    playlistToDeleteIndex = null;
}

// ========================================
// GESTION AVANCÉE PLAYLIST (PARAMÈTRES ⚙️)
// ========================================

async function openPlaylistSettings(plIdx) {
    const pl = playlists[plIdx];
    if (!pl) return;

    // 1. Récupération des partages actifs (Version Sécurisée)
    let activeShares = [];
    try {
        const res = await fetch('/api/playlists/shared-by-me', { headers: getAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            if (data && data.success && Array.isArray(data.shares)) {
                // Filtre correct sur ID ou Nom
                activeShares = data.shares.filter(s => {
                    const sharePlName = s.sourcePlaylistName || (s.playlist ? s.playlist.name : '');
                    const sharePlId = s.playlistId || (s.playlist ? s.playlist._id : null);
                    return (pl._id && sharePlId === pl._id) || (sharePlName === pl.name);
                });
            }
        }
    } catch (e) {
        console.warn("Impossible de charger les partages", e);
    }

    // 2. Nettoyage ancienne modale
    const existingModal = document.getElementById('pl-settings-modal');
    if (existingModal) existingModal.remove();

    // 3. Construction du HTML
    const html = `
    <div id="pl-settings-modal" class="modal" style="display:flex;">
        <div class="modal-content" style="max-width:500px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 class="modal-title" style="margin:0;">⚙️ Gérer la playlist</h3>
                <button id="close-pl-settings" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:24px; line-height:1;">×</button>
            </div>

            <div class="setting-item">
                <div class="setting-label">Nom de la playlist</div>
                <div style="display:flex; gap:10px; margin-top:8px;">
                    <input id="edit-pl-name" type="text" class="styled-input" value="${escapeHtml(pl.name)}" style="flex:1;">
                </div>
            </div>

            <div style="border-top:1px solid var(--border); margin:20px 0;"></div>

            <div class="setting-item">
                <div class="setting-label">Confidentialité & Partage</div>
                <p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">
                    ${activeShares.length > 0 
                        ? `<span style="color:var(--accent);">⚠️ Partagée avec ${activeShares.length} utilisateur(s).</span>` 
                        : "🔒 Cette playlist est privée (visible uniquement par vous)."}
                </p>

                ${activeShares.length > 0 ? `
                    <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:10px; max-height:150px; overflow-y:auto; margin-bottom:10px;">
                        ${activeShares.map(share => `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                                <div>
                                    <div style="font-size:13px;">👤 ${escapeHtml(share.to)}</div>
                                    <div style="font-size:11px; color:var(--text-muted);">${share.syncEnabled ? '🔄 Synchro active' : '📦 Copie simple'}</div>
                                </div>
                                <button class="btn-danger" style="padding:4px 8px; font-size:11px;" onclick="revokeShare('${share.id}', ${plIdx})">Révoquer</button>
                            </div>
                        `).join('')}
                    </div>
                    
                    <button class="btn-danger" style="width:100%;" onclick='makePlaylistPrivate(${plIdx}, ${JSON.stringify(activeShares.map(s => s.id))})'>
                        🔒 Rendre totalement privée
                    </button>
                ` : `
                    <button class="btn-secondary" style="width:100%; opacity:0.7; cursor:not-allowed;" disabled>
                        Aucun partage actif
                    </button>
                `}
            </div>

            <div class="modal-actions" style="margin-top:25px;">
                <button class="btn-primary" style="width:100%;" onclick="savePlaylistName(${plIdx})">Enregistrer le nom</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    
    // Listeners fermeture
    setTimeout(() => {
        const modal = document.getElementById('pl-settings-modal');
        const closeBtn = document.getElementById('close-pl-settings');
        if (closeBtn) closeBtn.onclick = closePlaylistSettings;
        if (modal) {
            modal.onclick = (e) => { if (e.target === modal) closePlaylistSettings(); };
        }
    }, 50);
}

function closePlaylistSettings() {
    const modal = document.getElementById('pl-settings-modal');
    if (modal) modal.remove();
}

// --- FONCTIONS HELPERS (AVEC NOUVELLE MODALE DE CONFIRMATION) ---

// Nouvelle fonction pour remplacer le confirm() natif "moche"
function openCustomConfirm(title, message, onConfirm) {
    const html = `
    <div id="custom-confirm-modal" class="modal" style="display:flex; z-index:10001;">
        <div class="modal-content" style="max-width:400px; text-align:center;">
            <h3 class="modal-title" style="margin-bottom:10px;">${title}</h3>
            <p style="color:var(--text-muted); margin-bottom:20px;">${message}</p>
            <div class="modal-actions" style="justify-content:center; gap:10px;">
                <button id="btn-confirm-cancel" class="btn-secondary" style="min-width:100px;">Annuler</button>
                <button id="btn-confirm-ok" class="btn-primary" style="min-width:100px;">Confirmer</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
    const modal = document.getElementById('custom-confirm-modal');
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');

    const close = () => modal.remove();

    btnOk.onclick = () => {
        onConfirm();
        close();
    };

    btnCancel.onclick = close;
    modal.onclick = (e) => { if(e.target === modal) close(); };
}

async function savePlaylistName(idx) {
    const input = document.getElementById('edit-pl-name');
    const newName = input.value.trim();
    const oldName = playlists[idx].name;

    if (newName && newName !== oldName) {
        playlists[idx].name = newName;
        await saveData('pl', playlists);
        renderPLs(); // Update sidebar
        showPL(idx); // Update main view
        showNotification("Playlist renommée ✅");
    }
    closePlaylistSettings();
}

async function revokeShare(shareId, plIdx) {
    openCustomConfirm(
        "Révoquer le partage",
        "Voulez-vous vraiment arrêter le partage avec cet utilisateur ?",
        async () => {
            try {
                const res = await fetch(`/api/playlists/shared-by-me/${shareId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                if (res.ok) {
                    showNotification("Partage révoqué.");
                    closePlaylistSettings();
                    openPlaylistSettings(plIdx); // Refresh modal
                } else {
                    showNotification("Erreur lors de la révocation", "error");
                }
            } catch (e) { console.error(e); }
        }
    );
}

async function makePlaylistPrivate(plIdx, shareIds) {
    openCustomConfirm(
        "Confirmer la confidentialité",
        "Voulez-vous vraiment couper TOUS les partages pour cette playlist ?",
        async () => {
            let count = 0;
            for (const id of shareIds) {
                try {
                    await fetch(`/api/playlists/shared-by-me/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
                    count++;
                } catch (e) { console.error(e); }
            }
            showNotification(`${count} partages supprimés.`);
            closePlaylistSettings();
            openPlaylistSettings(plIdx);
        }
    );
}

// ========================================
// AFFICHAGE PLAYLIST
// ========================================

function showPL(idx) {
    const pl = playlists[idx]; 
    if(!pl) return;
    updateNav([{name: 'Playlists', cmd: 'showAllPlaylists()'}, {name: pl.name, cmd: ''}]);
    currentViewTracks = pl.tracks;
    
    let html = `
        <div class="playlist-header-banner">
            <div class="pl-info">
                <div class="pl-type">PLAYLIST</div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <h1 class="pl-title">${escapeHtml(pl.name)}</h1>
                    <button class="btn-icon-edit" onclick="openPlaylistSettings(${idx})" title="Paramètres">⚙️</button>
                </div>
                <div class="pl-meta">${pl.tracks.length} titres</div>
                <div class="pl-actions-bar">
                    <button class="btn-primary" onclick="playAll()">▶ Lecture</button>
                    <button class="btn-secondary" onclick="sharePlaylist(${idx})">📤 Partager</button>
                    <button class="btn-danger" onclick="deletePL(${idx})">🗑️ Supprimer</button>
                </div>
            </div>
        </div>
        <div style="padding: 0 20px; color: var(--text-muted); margin-bottom: 10px;">
            <small>💡 Glissez les titres pour changer l'ordre</small>
        </div>
        <div class="playlist-tracks" id="pl-tracks-container">`;

    if (pl.tracks.length === 0) {
        html += `<div class="empty-state"><p>Playlist vide 🙈</p></div>`;
    } else {
        html += pl.tracks.map((track, i) => {
            const isPlaying = (queue[qIdx]?.path === track.path);
            return `
            <div class="row ${isPlaying ? 'active-track' : ''} draggable-pl" 
                 draggable="true" 
                 data-index="${i}"
                 onclick="playFromList(${i})" 
                 oncontextmenu="openContextMenu(event, ${i})">
                <div style="color:var(--text-dim); margin-right:10px; cursor:grab;">☰</div>
                <img src="${getCover(track)}" class="track-thumbnail" loading="lazy">
                <div class="track-info">
                    <div class="track-name">${escapeHtml(track.name)}</div>
                    <div class="track-artist">${escapeHtml(track.artist)}</div>
                </div>
                
                <div class="row-actions">
                    <button class="action-btn btn-remove-track desktop-only" 
                            onclick="event.stopPropagation(); removeTrackFromPL(${idx}, ${i}); return false;" 
                            title="Retirer">❌</button>
                    <button class="action-btn mobile-only" onclick="event.stopPropagation(); openContextMenu(event, ${i})">⋮</button>
                </div>
            </div>`;
        }).join('');
    }
    html += `</div>`;
    document.getElementById('content-area').innerHTML = html;
    setupPlaylistDragAndDrop(idx);
}

async function removeTrackFromPL(plIdx, trackIdx) {
    playlists[plIdx].tracks.splice(trackIdx, 1);
    await saveData('pl', playlists);
    showPL(plIdx);
    showNotification("Titre retiré");
}

// --- AJOUT À UNE PLAYLIST (POPUP) ---

function isTrackInAnyPlaylist(track) {
    if (!track || !track.path || !Array.isArray(playlists)) return false;
    return playlists.some(pl => Array.isArray(pl.tracks) && pl.tracks.some(t => t.path === track.path));
}

function openCurrentTrackPLModal() {
    const track = queue[qIdx];
    if (!track) {
        showNotification('Aucune musique en cours', 'info');
        return;
    }

    trackToEnqueue = track;
    const modal = document.getElementById('pl-modal');
    const listContainer = document.getElementById('modal-pl-list');
    if (!modal || !listContainer) return;

    if (!playlists || playlists.length === 0) {
        showNotification("Crée une playlist d'abord 🙌", 'info');
        return;
    }

    listContainer.innerHTML = playlists.map((pl, i) => {
        const exists = Array.isArray(pl.tracks) && pl.tracks.some(t => t.path === track.path);
        return `
            <div class="modal-pl-item" onclick="addTrackToPL(${i})">
                <span>${escapeHtml(pl.name)}</span>
                ${exists ? '<small style="margin-left:auto;color:var(--success);">✓ Déjà ajoutée</small>' : ''}
            </div>
        `;
    }).join('');

    modal.style.display = 'flex';
}

function openPLModal(idx) {
    const targetIdx = (idx !== undefined) ? idx : contextTargetIdx;
    
    if (targetIdx !== null && currentViewTracks[targetIdx]) {
        trackToEnqueue = currentViewTracks[targetIdx];
        const modal = document.getElementById('pl-modal');
        const listContainer = document.getElementById('modal-pl-list');
        
        if (modal && listContainer) {
            listContainer.innerHTML = playlists.map((pl, i) => `
                <div class="modal-pl-item" onclick="addTrackToPL(${i})">
                    <span>${escapeHtml(pl.name)}</span>
                </div>
            `).join('');
            modal.style.display = 'flex'; 
        }
    }
}

function closePLModal() {
    const modal = document.getElementById('pl-modal');
    if (modal) modal.style.display = 'none';
    trackToEnqueue = null;
}

async function addTrackToPL(plIdx) {
    if (trackToEnqueue && playlists[plIdx]) {
        const exists = playlists[plIdx].tracks.some(t => t.path === trackToEnqueue.path);
        
        if (!exists) {
            playlists[plIdx].tracks.push(trackToEnqueue);
            await saveData('pl', playlists);
            showNotification(`Ajouté à ${playlists[plIdx].name}`);
        } else {
            showNotification(`Déjà dans la playlist`, 'info');
        }
        closePLModal();
        if (typeof updatePlayerUI === 'function' && queue[qIdx]) updatePlayerUI(queue[qIdx]);
    }
}

// --- FAVORIS ---

async function toggleFav(idx) {
    const track = currentViewTracks[idx];
    if (favs.includes(track.path)) { 
        favs = favs.filter(p => p !== track.path); 
        showNotification("Retiré des favoris", "info");
    } else { 
        favs.push(track.path); 
        showNotification("Ajouté aux favoris ❤️");
    }
    await saveData('fav', favs); 
    renderList(currentViewTracks);
    if (queue[qIdx]?.path === track.path) {
        if(typeof updatePlayerUI === 'function') updatePlayerUI(track);
        if(typeof applyPersonalization === 'function') applyPersonalization(); 
    }
}

async function toggleCurrentFav() {
    const track = queue[qIdx];
    if (!track) return;
    
    if (favs.includes(track.path)) {
        favs = favs.filter(p => p !== track.path);
        showNotification("Retiré des favoris", "info");
    } else {
        favs.push(track.path);
        showNotification("Ajouté aux favoris ❤️");
    }
    
    await saveData('fav', favs);
    
    if(typeof updatePlayerUI === 'function') updatePlayerUI(track); 
    if(typeof applyPersonalization === 'function') applyPersonalization(); 
}

function showFavs() {
    updateNav([{name: 'Favoris', cmd: 'showFavs()'}]);
    currentViewTracks = allMusic.filter(m => favs.includes(m.path));
    document.getElementById('content-area').innerHTML = `<h2 class="section-title">❤️ Favoris</h2>`;
    renderList(currentViewTracks);
}

// --- FILE D'ATTENTE (QUEUE) ---

function showQueue() {
    updateNav([{name: "File d'attente", cmd: 'showQueue()'}]);
    currentViewTracks = queue;

    let html = `
        <div class="section-header">
            <h2 class="section-title">⏳ File d'attente</h2>
            <button class="btn-secondary" onclick="clearQueue()">🗑️ Vider</button>
        </div>
        <div style="padding: 0 20px; color: var(--text-muted); margin-bottom: 20px;">
            <small>💡 Astuce : Glissez-déposez les titres pour changer l'ordre.</small>
        </div>
        <div id="queue-list">`;

    if (queue.length === 0) {
        html += '<div class="empty-state"><p>La file d\'attente est vide.</p></div></div>';
        document.getElementById('content-area').innerHTML = html;
        return;
    }

    html += queue.map((track, i) => `
        <div class="row ${i === qIdx ? 'active-track' : ''} draggable" 
             draggable="true" 
             data-index="${i}" 
             onclick="play(${i})"
             oncontextmenu="openContextMenu(event, ${i})">
            <span style="color:var(--text-dim); margin-right:10px; cursor:grab;">☰</span>
            <img src="${getCover(track)}" class="track-thumbnail" loading="lazy">
            <div class="track-info">
                <div class="track-name">${escapeHtml(track.name)}</div>
                <div class="track-artist">${escapeHtml(track.artist)}</div>
            </div>
            
            <div class="row-actions">
                <button class="action-btn desktop-only" onclick="event.stopPropagation(); removeFromQueue(${i})">❌</button>
                <button class="action-btn mobile-only" onclick="event.stopPropagation(); openContextMenu(event, ${i})">⋮</button>
            </div>
        </div>`).join('');

    html += '</div>';
    document.getElementById('content-area').innerHTML = html;
    addDragAndDropHandlers();
}

function addToQueue(idx) { 
    queue.push(currentViewTracks[idx]); 
    showNotification('Ajouté à la file'); 
}

function removeFromQueue(index) {
    if (index === qIdx) {
        showNotification("Impossible de retirer le titre en cours", "error");
        return;
    }
    if (index < qIdx) qIdx--;
    queue.splice(index, 1);
    if(typeof saveSession === 'function') saveSession();
    showQueue();
}

function clearQueue() {
    if (queue.length <= 1) return;
    const currentTrack = queue[qIdx];
    queue = [currentTrack];
    qIdx = 0;
    if(typeof saveSession === 'function') saveSession();
    showQueue();
}

function playFromList(idx) { 
    queue = [...currentViewTracks]; 
    if(typeof play === 'function') play(idx); 
}

function playAll() { 
    if (currentViewTracks.length > 0) { 
        queue = [...currentViewTracks]; 
        if(typeof play === 'function') play(0); 
    } 
}

function playRecentTrack(idx) { 
    if(history[idx]) {
        queue = [history[idx]]; 
        if(typeof play === 'function') play(0); 
    }
}

// --- DRAG & DROP LOGIC ---

function setupPlaylistDragAndDrop(plIdx) {
    const list = document.getElementById('pl-tracks-container');
    if (!list) return;

    let draggedItem = null;
    let draggedIndex = null;
    const rows = list.querySelectorAll('.draggable-pl');

    rows.forEach(row => {
        row.addEventListener('dragstart', (e) => {
            draggedItem = row;
            draggedIndex = parseInt(row.getAttribute('data-index'));
            setTimeout(() => row.classList.add('dragging'), 0);
            e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragend', () => {
            row.classList.remove('dragging');
            draggedItem = null;
            draggedIndex = null;
        });
    });

    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(list, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) list.appendChild(draggable);
        else list.insertBefore(draggable, afterElement);
    });

    list.addEventListener('drop', async (e) => {
        e.preventDefault();
        const newIndex = [...list.querySelectorAll('.draggable-pl')].indexOf(draggedItem);
        if (draggedIndex !== null && newIndex !== -1 && draggedIndex !== newIndex) {
            const pl = playlists[plIdx];
            const item = pl.tracks.splice(draggedIndex, 1)[0];
            pl.tracks.splice(newIndex, 0, item);
            await saveData('pl', playlists);
            showPL(plIdx);
            showNotification("Playlist réorganisée 👌");
        }
    });
}

function addDragAndDropHandlers() {
    const list = document.getElementById('queue-list');
    if (!list) return;
    let draggedItem = null;
    let draggedIndex = null;
    const rows = list.querySelectorAll('.draggable');

    rows.forEach(row => {
        row.addEventListener('dragstart', (e) => {
            draggedItem = row;
            draggedIndex = parseInt(row.getAttribute('data-index'));
            setTimeout(() => row.classList.add('dragging'), 0);
            e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragend', () => {
            row.classList.remove('dragging');
            draggedItem = null;
            draggedIndex = null;
            showQueue();
        });
        row.addEventListener('click', (e) => {
            if (row.classList.contains('just-dropped')) {
                e.stopPropagation(); e.preventDefault();
                row.classList.remove('just-dropped');
            }
        });
    });

    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(list, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) list.appendChild(draggable);
        else list.insertBefore(draggable, afterElement);
    });

    list.addEventListener('drop', (e) => {
        e.preventDefault();
        const newIndex = [...list.querySelectorAll('.draggable')].indexOf(draggedItem);
        if (draggedIndex !== null && newIndex !== -1 && draggedIndex !== newIndex) {
            const item = queue.splice(draggedIndex, 1)[0];
            queue.splice(newIndex, 0, item);
            if (qIdx === draggedIndex) qIdx = newIndex;
            else if (qIdx > draggedIndex && qIdx <= newIndex) qIdx--;
            else if (qIdx < draggedIndex && qIdx >= newIndex) qIdx++;
            if(typeof saveSession === 'function') saveSession();
            draggedItem.classList.add('just-dropped');
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.draggable:not(.dragging), .draggable-pl:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ========================================
// MODALE DE PARTAGE (STYLE CUSTOM)
// ========================================

// 1. Ouvre la modale de partage
function sharePlaylist(plIdx) {
    const pl = playlists[plIdx];
    if (!pl) return;

    // On ferme d'anciennes modales si elles existent
    closeShareModal();

    const html = `
    <div id="share-modal" class="modal" style="display:flex;">
        <div class="modal-content" style="max-width:450px;">
            <h3 class="modal-title">📤 Partager la playlist</h3>
            <p style="margin-bottom: 20px; color: var(--text-muted);">
                Playlist : <strong style="color: var(--text-main);">${escapeHtml(pl.name)}</strong>
            </p>

            <div class="setting-item">
                <div class="setting-label">Destinataire</div>
                <input id="share-username" type="text" class="styled-input" 
                       placeholder="Nom d'utilisateur (pseudo)" 
                       style="width:100%; margin-top: 8px;">
            </div>

            <div class="setting-item" style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                <div>
                    <div class="setting-label" style="font-size: 14px;">Synchronisation auto</div>
                    <div style="font-size: 11px; color: var(--text-muted);">Le destinataire verra vos ajouts/suppressions</div>
                </div>
                <label class="switch">
                    <input id="share-sync" type="checkbox">
                    <span class="slider"></span>
                </label>
            </div>

            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeShareModal()">Annuler</button>
                <button class="btn-primary" onclick="confirmSharePlaylist(${plIdx})">Partager</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    
    // Focus automatique sur le champ texte
    setTimeout(() => document.getElementById('share-username').focus(), 50);

    // Fermer si on clique dehors
    const modal = document.getElementById('share-modal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeShareModal();
    });
    
    // Valider avec Entrée
    const input = document.getElementById('share-username');
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmSharePlaylist(plIdx);
    });
}

// 2. Ferme la modale
function closeShareModal() {
    const modal = document.getElementById('share-modal');
    if (modal) modal.remove();
}

// 3. Exécute le partage (Appel API)
async function confirmSharePlaylist(plIdx) {
    const pl = playlists[plIdx];
    const usernameInput = document.getElementById('share-username');
    const syncInput = document.getElementById('share-sync');
    
    if (!usernameInput || !pl) return;

    const toUsername = usernameInput.value.trim();
    const syncEnabled = syncInput.checked;

    if (!toUsername) {
        showNotification("Veuillez entrer un pseudo", "error");
        usernameInput.focus();
        return;
    }

    // Effet visuel de chargement sur le bouton
    const btn = document.querySelector('#share-modal .btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "Envoi...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/playlists/share', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                toUsername: toUsername,
                playlistName: pl.name,
                tracks: pl.tracks,
                syncEnabled
            })
        });
        const data = await res.json();
        
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Partage impossible');
        }

        closeShareModal();
        showNotification(`Playlist partagée avec ${toUsername} ${syncEnabled ? '(Sync ON)' : ''} ✅`);
        
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function acceptSharedPlaylist(shareId) {
    try {
        const res = await fetch(`/api/playlists/shared-with-me/${encodeURIComponent(shareId)}/accept`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Import impossible');

        playlists = await (await fetch('/api/data/pl', { headers: getAuthHeaders() })).json();
        renderPLs();
        if (typeof showAllPlaylists === 'function') showAllPlaylists();
        showNotification(`Playlist importée: ${data.playlistName}`);
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function refuseSharedPlaylist(shareId) {
    try {
        const res = await fetch(`/api/playlists/shared-with-me/${encodeURIComponent(shareId)}/refuse`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Refus impossible');
        if (typeof showAllPlaylists === 'function') showAllPlaylists();
        showNotification('Invitation refusée');
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function disableSharedSync(shareId) {
    try {
        const res = await fetch(`/api/playlists/shared-with-me/${encodeURIComponent(shareId)}/disable-sync`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Désactivation impossible');

        playlists = await (await fetch('/api/data/pl', { headers: getAuthHeaders() })).json();
        renderPLs();
        if (typeof showAllPlaylists === 'function') showAllPlaylists();
        showNotification('Synchronisation désactivée');
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function removeSharedRecipient(shareId) {
    // Utilisation de la nouvelle modale "belle"
    openCustomConfirm(
        "Confirmer la suppression",
        "Retirer ce destinataire et supprimer sa copie partagée ?",
        async () => {
            try {
                const res = await fetch(`/api/playlists/shared-by-me/${encodeURIComponent(shareId)}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' })
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || 'Suppression impossible');
                if (typeof showAllPlaylists === 'function') showAllPlaylists();
                showNotification('Destinataire retiré ✅');
            } catch (error) {
                showNotification(`❌ ${error.message}`, 'error');
            }
        }
    );
}