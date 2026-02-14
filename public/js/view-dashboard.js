// ========================================
// VUE : TABLEAU DE BORD
// ========================================

function showDashboard() {
    updateNav([{name: 'Dashboard', cmd: 'showDashboard()'}]);
    const container = document.getElementById('content-area');
    if (!container) return;
    if (allMusic.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Chargement...</p></div>';
        return;
    }

    const now = new Date();
    const greeting = now.getHours() >= 18 ? 'Bonsoir' : (now.getHours() < 5 ? 'Bonne nuit' : 'Bonjour');
    const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const uniqueArtists = new Set(allMusic.map(m => m.artist)).size;
    const lastTrack = history[0] || null;
    const topArtists = getTopArtists();
    const newArrivals = allMusic.slice(-6).reverse();
    const recommendations = getRecommendedTracks(8);
    const continueProgress = Number(localStorage.getItem('localify_last_time') || '0');

    const formats = { mp3: 0, flac: 0, m4a: 0, wav: 0, other: 0 };
    allMusic.forEach(t => {
        const ext = t.path.split('.').pop().toLowerCase();
        if (formats[ext] !== undefined) formats[ext]++;
        else formats.other++;
    });

    const blocks = {
        stats: `
        <div class="dash-section-title">📊 Aperçu de la bibliothèque</div>
        <div class="dash-grid">
            <div class="dash-stat ds-purple"><div class="dash-stat-icon">🎵</div><div class="dash-stat-val">${allMusic.length}</div><div class="dash-stat-label">Titres Totaux</div></div>
            <div class="dash-stat ds-blue"><div class="dash-stat-icon">🎤</div><div class="dash-stat-val">${uniqueArtists}</div><div class="dash-stat-label">Artistes Uniques</div></div>
            <div class="dash-stat ds-green" onclick="showFavs()"><div class="dash-stat-icon">❤️</div><div class="dash-stat-val">${favs.length}</div><div class="dash-stat-label">Coups de cœur</div></div>
            <div class="dash-stat ds-orange" onclick="showAllPlaylists()"><div class="dash-stat-icon">📂</div><div class="dash-stat-val">${playlists.length}</div><div class="dash-stat-label">Playlists</div></div>
            <div class="dash-stat" onclick="showQueue()"><div class="dash-stat-icon">⏳</div><div class="dash-stat-val">${queue.length}</div><div class="dash-stat-label">En file d'attente</div></div>
            <div class="dash-stat" onclick="showDashboardRecommendations()"><div class="dash-stat-icon">✨</div><div class="dash-stat-val">${recommendations.length}</div><div class="dash-stat-label">Recommandations</div></div>
        </div>`,
        charts: `
        <div class="dash-section-title">📈 Statistiques & Qualité</div>
        <div class="dashboard-charts">
            <div class="chart-box"><h3 style="margin-top:0; margin-bottom:20px; font-size:16px;">Top Artistes</h3><div class="artist-chart">${renderTopArtists(topArtists)}</div></div>
            <div class="chart-box"><h3 style="margin-top:0; margin-bottom:20px; font-size:16px;">Qualité Audio</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    ${renderFormatBar('MP3', formats.mp3, allMusic.length, '#268aff')}
                    ${renderFormatBar('FLAC (Hi-Fi)', formats.flac, allMusic.length, '#b026ff')}
                    ${renderFormatBar('M4A / AAC', formats.m4a, allMusic.length, '#ff9d26')}
                    ${renderFormatBar('Autres', formats.other + formats.wav, allMusic.length, '#888')}
                </div>
            </div>
        </div>`,
        tools: `
        <div class="dash-section-title" style="margin-top:20px;">⚡ Outils rapides</div>
        <div class="dash-grid">
            <div class="dash-action da-mix" onclick="playRandomMix()"><div class="da-icon">🎲</div><div class="da-info"><h3>Mix Aléatoire</h3><p>Surprends-moi</p></div></div>
            <div class="dash-action da-save" onclick="exportData()"><div class="da-icon">💾</div><div class="da-info"><h3>Sauvegarder</h3><p>Config & Playlists</p></div></div>
            <div class="dash-action da-load" onclick="triggerImport()"><div class="da-icon">📥</div><div class="da-info"><h3>Restaurer</h3><p>Importer sauvegarde</p></div></div>
        </div>`,
        arrivals: `
        <div class="dash-section-title dash-title-with-link">🆕 Récemment ajoutés <button class="dash-mini-link" onclick="showDashboardCollection('recent')">Voir tout</button></div>
        <div class="dash-new-grid">${newArrivals.map(track => {
            const idx = allMusic.indexOf(track);
            return `<div class="dash-new-card" onclick="play(${idx})"><img src="${getCover(track)}" loading="lazy"><div class="dnc-info"><div class="dnc-title">${escapeHtml(track.name)}</div><div class="dnc-artist">${escapeHtml(track.artist)}</div></div></div>`;
        }).join('')}</div>`,
        recos: `
        <div class="dash-section-title dash-title-with-link" id="dash-reco-anchor">✨ Recommandé pour toi <button class="dash-mini-link" onclick="showDashboardCollection('recommended')">Voir tout</button></div>
        <div class="dash-reco-grid">${renderRecommendationCards(recommendations)}</div>`
    };

    const defaultOrder = ['stats', 'charts', 'arrivals', 'recos', 'tools'];
    const order = Array.isArray(personalization.dashboardLayoutOrder) && personalization.dashboardLayoutOrder.length
        ? personalization.dashboardLayoutOrder.filter(k => blocks[k])
        : defaultOrder;

    const heroBg = lastTrack ? getCover(lastTrack) : 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop';
    let html = `<div class="dashboard-container">
        <div class="dash-hero" style="background-image: url('${heroBg}');">
            <div class="dash-hero-content">
                <div class="dash-greeting"><span class="dash-date">${dateStr}</span><h1>${greeting},<br>Bienvenue sur Localify.</h1></div>
                ${lastTrack ? `<div class="dash-resume-card" onclick="resumeLastTrack()"><img src="${getCover(lastTrack)}" class="dash-resume-img"><div class="dash-resume-info"><span>Continuer l'écoute</span><h3>${escapeHtml(lastTrack.name)}</h3><p>${escapeHtml(lastTrack.artist)} · ${formatTime(continueProgress)}</p></div><div class="dash-play-icon">▶</div></div>` : ''}
            </div>
        </div>
        <div class="dash-layout-controls"><strong>Disposition Dashboard</strong><div><button class="btn-secondary" onclick="shiftDashboardLayout(-1)">⬅</button><button class="btn-secondary" onclick="shiftDashboardLayout(1)" style="margin-left:8px;">➡</button></div></div>`;

    order.forEach(key => { html += blocks[key] || ''; });
    html += '</div>';
    container.innerHTML = html;
}

function renderTopArtists(topArtists) {
    if (!topArtists.length) return '<p style="color:var(--text-muted); font-size:13px;">Pas assez de données.</p>';
    const maxVal = topArtists[0][1] || 1;
    return topArtists.map(([name, count]) => {
        const pct = (count / maxVal) * 100;
        return `<div class="bar-chart-row"><div class="bar-label" title="${escapeHtml(name)}">${escapeHtml(name)}</div><div class="bar-track"><div class="bar-fill" style="width: ${pct}%"></div></div><div class="bar-val">${count}</div></div>`;
    }).join('');
}

function renderRecommendationCards(recommendations) {
    if (recommendations.length === 0) return '<div class="chart-box" style="grid-column:1/-1;"><p style="color:var(--text-muted); margin:0;">Lance quelques écoutes pour obtenir des recommandations personnalisées.</p></div>';
    return recommendations.map(track => {
        const idx = allMusic.findIndex(m => m.path === track.path);
        if (idx === -1) return '';
        const liked = favs.includes(track.path);
        const hidden = getRecoFeedback(track.path) === 'down';
        if (hidden) return '';
        return `<div class="dash-reco-card" onclick="play(${idx})"><img src="${getCover(track)}" loading="lazy" alt="${escapeHtml(track.name)}"><div class="drc-info"><div class="drc-title">${escapeHtml(track.name)}</div><div class="drc-artist">${escapeHtml(track.artist)}</div></div><div class="drc-actions"><button class="drc-btn" onclick="event.stopPropagation(); queue.push(allMusic[${idx}]); showNotification('Ajouté à la file ⏳');">+ File</button><button class="drc-btn" onclick="event.stopPropagation(); toggleFav(${idx});">${liked ? '❤️' : '🤍'}</button><button class="drc-btn" onclick="event.stopPropagation(); openContextMenu(event, ${idx});">⋮</button></div><div class="drc-feedback"><button onclick="event.stopPropagation(); rateRecommendation('${track.path.replace(/'/g, "\\'")}', 'up')">👍</button><button onclick="event.stopPropagation(); rateRecommendation('${track.path.replace(/'/g, "\\'")}', 'down')">👎</button></div></div>`;
    }).join('');
}

function renderFormatBar(label, count, total, color) {
    if (!count || !total) return '';
    const pct = Math.round((count / total) * 100);
    return `<div style="display:flex; align-items:center; font-size:12px; margin-bottom:4px;"><div style="width:80px; color:var(--text-muted);">${label}</div><div style="flex:1; background:rgba(255,255,255,0.1); height:6px; border-radius:3px; margin:0 10px; overflow:hidden;"><div style="width:${pct}%; background:${color}; height:100%;"></div></div><div style="width:35px; text-align:right; font-weight:bold;">${pct}%</div></div>`;
}

function getTopArtists() {
    const counts = {};
    (history || []).forEach(track => {
        if (track.artist) counts[track.artist] = (counts[track.artist] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function showDashboardRecommendations() {
    document.getElementById('dash-reco-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getRecoFeedback(path) {
    const map = JSON.parse(localStorage.getItem('localify_reco_feedback') || '{}');
    return map[path] || '';
}

function rateRecommendation(path, vote) {
    const map = JSON.parse(localStorage.getItem('localify_reco_feedback') || '{}');
    map[path] = vote;
    localStorage.setItem('localify_reco_feedback', JSON.stringify(map));
    showNotification(vote === 'up' ? 'Reco marquée pertinente 👍' : 'Reco masquée 👎');
    showDashboard();
}

function getRecommendedTracks(limit = 8) {
    if (!Array.isArray(allMusic) || allMusic.length === 0) return [];
    const feedback = JSON.parse(localStorage.getItem('localify_reco_feedback') || '{}');
    const recentSlice = (history || []).slice(0, 80);
    const recentArtists = recentSlice.reduce((acc, t, idx) => {
        const w = Math.max(1, 80 - idx);
        if (t.artist) acc[t.artist] = (acc[t.artist] || 0) + w;
        return acc;
    }, {});
    const recentPlays = recentSlice.reduce((acc, t, idx) => {
        acc[t.path] = (acc[t.path] || 0) + Math.max(1, 40 - idx);
        return acc;
    }, {});
    const favSet = new Set(favs || []);

    const scored = allMusic.map(track => {
        let score = 1;
        score += (recentArtists[track.artist] || 0) * 1.8;
        if (favSet.has(track.path)) score += 50;
        if (recentPlays[track.path]) score -= recentPlays[track.path] * 2.2;
        if (feedback[track.path] === 'up') score += 40;
        if (feedback[track.path] === 'down') score -= 300;
        return { track, score };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .map(x => x.track)
        .filter((t, idx, arr) => arr.findIndex(i => i.path === t.path) === idx)
        .slice(0, limit);
}

function showDashboardCollection(mode) {
    if (mode === 'recommended') {
        currentViewTracks = getRecommendedTracks(40);
        updateNav([{ name: 'Dashboard' }, { name: 'Recommandations' }]);
    } else {
        currentViewTracks = [...allMusic].reverse();
        updateNav([{ name: 'Dashboard' }, { name: 'Récemment ajoutés' }]);
    }
    renderList(currentViewTracks);
}

function shiftDashboardLayout(direction) {
    const order = Array.isArray(personalization.dashboardLayoutOrder) && personalization.dashboardLayoutOrder.length
        ? [...personalization.dashboardLayoutOrder]
        : ['stats', 'charts', 'arrivals', 'recos', 'tools'];
    if (direction > 0) {
        order.push(order.shift());
    } else {
        order.unshift(order.pop());
    }
    personalization.dashboardLayoutOrder = order;
    if (typeof savePerso === 'function') savePerso();
    showDashboard();
}

function resumeLastTrack() {
    if (!history.length) return;
    playRecentTrack(0);
    const saved = Number(localStorage.getItem('localify_last_time') || '0');
    if (audio && saved > 2) {
        const seekAfterLoad = () => {
            audio.currentTime = saved;
            audio.removeEventListener('loadedmetadata', seekAfterLoad);
        };
        audio.addEventListener('loadedmetadata', seekAfterLoad);
    }
}

function playRandomMix() {
    if (!allMusic.length) return;
    if (!isShuffle) toggleShuffle();
    queue = [...allMusic].sort(() => Math.random() - 0.5);
    play(0);
    showNotification('🎲 Mix Aléatoire lancé !');
}

function openEQModal() {
    const modal = document.getElementById('eq-modal');
    if (modal) {
        updateEQModalSliders();
        modal.style.display = 'flex';
    }
}

function closeEQModal() {
    const modal = document.getElementById('eq-modal');
    if (modal) modal.style.display = 'none';
}

function updateEQModalSliders() {
    const slBass = document.getElementById('modal-eq-bass');
    const slMid = document.getElementById('modal-eq-mid');
    const slTreble = document.getElementById('modal-eq-treble');
    if (slBass) slBass.value = eqSettings.bass || 0;
    if (slMid) slMid.value = eqSettings.mid || 0;
    if (slTreble) slTreble.value = eqSettings.treble || 0;
}
