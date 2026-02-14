// ========================================
// VUE : LISTE DES PLAYLISTS
// ========================================

async function showAllPlaylists() {
    updateNav([{name: 'Playlists', cmd: 'showAllPlaylists()'}]);

    let sharedHtml = '';
    try {
        const res = await fetch('/api/playlists/shared-with-me', { headers: getAuthHeaders() });
        const data = await res.json();

        const pendingShares = (res.ok && data.success && Array.isArray(data.shares)) ? data.shares : [];
        const activeSync = (res.ok && data.success && Array.isArray(data.activeSync)) ? data.activeSync : [];
        const shareLog = (res.ok && data.success && Array.isArray(data.shareLog)) ? data.shareLog : [];
        const sentRes = await fetch('/api/playlists/shared-by-me', { headers: getAuthHeaders() });
        const sentData = await sentRes.json();
        const sentShares = (sentRes.ok && sentData.success && Array.isArray(sentData.shares)) ? sentData.shares : [];

        if (pendingShares.length > 0 || activeSync.length > 0 || sentShares.length > 0 || shareLog.length > 0) {
            const pendingCards = pendingShares.map(share => `
                <div class="card" style="padding:14px;" onclick="event.stopPropagation()">
                    <div class="card-title">${escapeHtml(share.playlist?.name || 'Playlist partagée')}</div>
                    <div style="font-size:12px; color:var(--text-muted); margin:6px 0 10px;">
                        De: ${escapeHtml(share.from)} · ${(share.playlist?.tracks || []).length} titres ${share.syncEnabled ? '· 🔄 sync active' : '· 📦 copie simple'}
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-primary" style="flex:1;" onclick="acceptSharedPlaylist('${share.id}')">➕ Ajouter</button>
                        <button class="btn-secondary" style="flex:1;" onclick="refuseSharedPlaylist('${share.id}')">Refuser</button>
                    </div>
                </div>`).join('');

            const syncCards = activeSync.map(share => `
                <div class="card" style="padding:14px; border:1px solid var(--accent);">
                    <div class="card-title">🔄 ${escapeHtml(share.playlist?.name || 'Playlist synchronisée')}</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:6px;">
                        Source: ${escapeHtml(share.from)} · ${(share.playlist?.tracks || []).length} titres
                    </div>
                    <button class="btn-secondary" style="width:100%; margin-top:10px;" onclick="disableSharedSync('${share.id}')">Arrêter la sync</button>
                </div>`).join('');

            const sentCards = sentShares.map(share => `
                <div class="card" style="padding:14px;">
                    <div class="card-title">${escapeHtml(share.playlist?.name || share.sourcePlaylistName || 'Playlist')}</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:6px;">Vers ${escapeHtml(share.to)} · ${escapeHtml(share.status || 'pending')}</div>
                    <button class="btn-danger" style="width:100%; margin-top:10px;" onclick="removeSharedRecipient('${share.id}')">Retirer le destinataire</button>
                </div>`).join('');

            const logRows = shareLog.slice(0, 6).map(item => `<li style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">${escapeHtml(item.playlistName)} · ${item.syncEnabled ? 'sync ON' : 'copie'} · ${item.syncedAt ? new Date(item.syncedAt).toLocaleString('fr-FR') : '—'}</li>`).join('');

            sharedHtml = `
                <div class="section-header" style="margin-top:8px;">
                    <h2 class="section-title">Partages & synchronisation</h2>
                </div>
                ${pendingCards ? `<div style="padding:0 20px; color:var(--text-muted); font-size:13px;">Invitations en attente</div><div class="grid">${pendingCards}</div>` : ''}
                ${syncCards ? `<div style="padding:15px 20px 0; color:var(--text-muted); font-size:13px;">Synchronisations actives</div><div class="grid">${syncCards}</div>` : ''}
                ${sentCards ? `<div style="padding:15px 20px 0; color:var(--text-muted); font-size:13px;">Partagées par moi</div><div class="grid">${sentCards}</div>` : ''}
                ${logRows ? `<div class="chart-box" style="margin:15px 20px 0;"><h3 style="margin:0 0 10px; font-size:15px;">Journal de sync</h3><ul style="padding-left:16px; margin:0;">${logRows}</ul></div>` : ''}`;
        }
    } catch {
        // silencieux pour ne pas bloquer la vue
    }

    let html = `
        <div class="section-header">
            <h2 class="section-title">Mes Playlists</h2>
            <button class="btn-primary" onclick="createPL()">+ Créer</button>
        </div>
        <div class="grid">`;

    if (!playlists || playlists.length === 0) {
        html += `<div class="empty-state"><p>Aucune playlist créée 🙈</p></div>`;
    } else {
        html += playlists.map((pl, i) => {
            let imgUrl = 'https://img.icons8.com/?size=200&id=20909&format=png&color=333333';
            let hasCover = pl.tracks.length > 0;
            if (hasCover) imgUrl = getCover(pl.tracks[0]);

            return `
                <div class="card pl-card" onclick="showPL(${i})">
                    <div class="pl-card-img-wrap">
                        <img src="${imgUrl}" class="pl-card-img ${hasCover ? '' : 'default-icon'}" loading="lazy">
                        <div class="pl-card-overlay">▶</div>
                    </div>
                    <div class="card-title" style="margin-top:10px;">${escapeHtml(pl.name)}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">
                        ${pl.tracks.length} titres
                    </div>
                    ${pl.sharedBy ? `<div style="font-size:11px;color:var(--accent);margin-top:6px;">Partagée par ${escapeHtml(pl.sharedBy)}</div>` : ''}
                    ${pl.syncEnabled ? `<div style="font-size:11px;color:var(--success);margin-top:4px;">🔄 Synchronisée automatiquement</div>` : ''}
                </div>`;
        }).join('');
    }

    html += `</div>${sharedHtml}`;
    document.getElementById('content-area').innerHTML = html;
}
