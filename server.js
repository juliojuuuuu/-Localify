const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const mm = require('music-metadata');
const app = express();

const CONFIG = {
    MUSIC_PATH: './music',
    DATA_DIR: './data',
    USERS_DIR: './data/users-data',
    SHARED_PLAYLISTS_FILE: './data/shared-playlists.json',
    PORT: process.env.PORT || 3000,
    CACHE_DURATION: 5 * 60 * 1000,
    SESSION_DURATION: 7 * 24 * 60 * 60 * 1000,
    DEFAULT_ADMIN_USERNAME: process.env.LOCALIFY_ADMIN_USER || 'admin',
    DEFAULT_ADMIN_PASSWORD: process.env.LOCALIFY_ADMIN_PASSWORD || 'admin123456'
};

const DATA_FILES = {
    users: path.join(CONFIG.DATA_DIR, 'users.json'),
    sharedPlaylists: path.resolve(CONFIG.SHARED_PLAYLISTS_FILE),
    appSettings: path.join(CONFIG.DATA_DIR, 'app-settings.json')
};

const DATA_TYPES = new Set(['fav', 'pl', 'cfg', 'history']);

const DEFAULT_APP_SETTINGS = {
    themeLimitPerUser: 5
};

function normalizeThemeLimit(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_APP_SETTINGS.themeLimitPerUser;
    return Math.max(0, Math.min(200, Math.floor(parsed)));
}

async function readAppSettings() {
    const settings = await readJsonFile(DATA_FILES.appSettings, { ...DEFAULT_APP_SETTINGS });
    return {
        ...DEFAULT_APP_SETTINGS,
        ...settings,
        themeLimitPerUser: normalizeThemeLimit(settings.themeLimitPerUser)
    };
}

async function writeAppSettings(settings = {}) {
    const merged = {
        ...DEFAULT_APP_SETTINGS,
        ...settings,
        themeLimitPerUser: normalizeThemeLimit(settings.themeLimitPerUser)
    };
    await writeJsonFile(DATA_FILES.appSettings, merged);
    return merged;
}

let musicCache = { data: null, timestamp: null };
const sessions = new Map();

async function initializeDataDir() {
    try {
        if (!fsSync.existsSync(CONFIG.DATA_DIR)) {
            await fs.mkdir(CONFIG.DATA_DIR, { recursive: true });
            console.log('✓ Dossier data créé');
        }
        if (!fsSync.existsSync(CONFIG.USERS_DIR)) {
            await fs.mkdir(CONFIG.USERS_DIR, { recursive: true });
            console.log('✓ Dossier users-data créé');
        }
        if (!fsSync.existsSync(CONFIG.MUSIC_PATH)) {
            await fs.mkdir(CONFIG.MUSIC_PATH, { recursive: true });
            console.log('✓ Dossier music créé');
        }
        if (!fsSync.existsSync(DATA_FILES.users)) {
            await fs.writeFile(DATA_FILES.users, JSON.stringify({ users: [] }, null, 2));
            console.log('✓ users.json initialisé');
        }
        if (!fsSync.existsSync(DATA_FILES.sharedPlaylists)) {
            await fs.writeFile(DATA_FILES.sharedPlaylists, JSON.stringify({ shares: [] }, null, 2));
            console.log('✓ shared-playlists.json initialisé');
        }
        if (!fsSync.existsSync(DATA_FILES.appSettings)) {
            await fs.writeFile(DATA_FILES.appSettings, JSON.stringify(DEFAULT_APP_SETTINGS, null, 2));
            console.log('✓ app-settings.json initialisé');
        }
        await ensureAdminAccount();
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        process.exit(1);
    }
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/stream', express.static(path.resolve(CONFIG.MUSIC_PATH)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function sanitizePath(filePath) {
    if (!filePath) throw new Error('Chemin manquant');

    const decodedPath = decodeURIComponent(filePath);
    const root = path.resolve(CONFIG.MUSIC_PATH);
    const finalPath = path.resolve(root, decodedPath);

    if (!finalPath.startsWith(root)) {
        throw new Error('Chemin invalide : tentative de remontée interdite');
    }

    return path.relative(root, finalPath);
}

function parseMetadata(filePath, fileName) {
    const parts = filePath.split(path.sep);
    const directories = parts.slice(0, -1);
    let artist = 'Artiste Inconnu';
    let album = 'Singles';

    if (directories.length >= 3) {
        artist = directories[1];
        album = directories[2];
    } else if (directories.length === 2) {
        artist = directories[1];
    } else if (directories.length === 1) {
        artist = directories[0];
    } else {
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        const dashParts = nameWithoutExt.split(' - ');
        if (dashParts.length >= 2) artist = dashParts[dashParts.length - 1].trim();
    }

    return { name: fileName.replace(/\.[^/.]+$/, ''), artist, album };
}

async function scanMusicDirectory() {
    const results = [];
    const extensions = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.opus'];

    async function walkDir(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walkDir(fullPath);
            } else {
                const ext = path.extname(entry.name).toLowerCase();
                if (extensions.includes(ext)) {
                    const relativePath = path.relative(CONFIG.MUSIC_PATH, fullPath);
                    const metadata = parseMetadata(relativePath, entry.name);
                    results.push({
                        id: Buffer.from(relativePath).toString('base64').substring(0, 12),
                        name: metadata.name,
                        artist: metadata.artist,
                        album: metadata.album,
                        url: `/stream/${relativePath.split(path.sep).map(s => encodeURIComponent(s)).join('/')}`,
                        path: relativePath
                    });
                }
            }
        }
    }
    if (fsSync.existsSync(CONFIG.MUSIC_PATH)) await walkDir(CONFIG.MUSIC_PATH);
    return results;
}

async function readJsonFile(filePath, fallbackValue) {
    try {
        if (!fsSync.existsSync(filePath)) return fallbackValue;
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return fallbackValue;
    }
}

async function writeJsonFile(filePath, value) {
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function normalizeUsername(username = '') {
    return String(username).trim().toLowerCase();
}

function assertValidCredentials(username, password) {
    if (!username || !password) throw new Error('Nom d\'utilisateur et mot de passe requis');
    if (username.length < 3) throw new Error('Nom d\'utilisateur trop court (3 caractères min)');
    if (password.length < 6) throw new Error('Mot de passe trop court (6 caractères min)');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, hashedPassword) {
    const [salt, expectedHash] = String(hashedPassword).split(':');
    if (!salt || !expectedHash) return false;
    const derivedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derivedHash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

function createSession(user) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        username: user.username,
        role: user.role || 'user',
        expiresAt: Date.now() + CONFIG.SESSION_DURATION
    });
    return token;
}

function getSession(token) {
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
        sessions.delete(token);
        return null;
    }
    return session;
}

function getAuthToken(req) {
    const headerToken = req.headers['x-auth-token'];
    return typeof headerToken === 'string' ? headerToken : '';
}

function buildPublicUser(user) {
    const role = user.role || 'user';
    return {
        username: user.username,
        role,
        isAdmin: role === 'admin',
        avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : ''
    };
}

function getDefaultDataForType(type) {
    return type === 'cfg' ? { autoplay: true, volume: 1 } : [];
}

function getUserDataDir(username) {
    return path.join(CONFIG.USERS_DIR, encodeURIComponent(username));
}

function getUserDataFile(username, type) {
    return path.join(getUserDataDir(username), `${type}.json`);
}

async function ensureUserDataFiles(username) {
    const userDir = getUserDataDir(username);
    if (!fsSync.existsSync(userDir)) {
        await fs.mkdir(userDir, { recursive: true });
    }

    for (const type of DATA_TYPES) {
        const filePath = getUserDataFile(username, type);
        if (!fsSync.existsSync(filePath)) {
            await writeJsonFile(filePath, getDefaultDataForType(type));
        }
    }
}

async function findUserByUsername(username) {
    const normalized = normalizeUsername(username);
    const usersDb = await readJsonFile(DATA_FILES.users, { users: [] });
    const users = Array.isArray(usersDb.users) ? usersDb.users : [];
    return users.find(u => normalizeUsername(u.username) === normalized) || null;
}

async function ensureAdminAccount() {
    const adminUsername = normalizeUsername(CONFIG.DEFAULT_ADMIN_USERNAME);
    const usersDb = await readJsonFile(DATA_FILES.users, { users: [] });
    const users = Array.isArray(usersDb.users) ? usersDb.users : [];
    const existing = users.find(u => normalizeUsername(u.username) === adminUsername);

    if (!existing) {
        users.push({
            username: adminUsername,
            passwordHash: hashPassword(CONFIG.DEFAULT_ADMIN_PASSWORD),
            role: 'admin',
            createdAt: new Date().toISOString()
        });
        await writeJsonFile(DATA_FILES.users, { users });
        await ensureUserDataFiles(adminUsername);
        console.log(`✓ Compte admin créé (${adminUsername})`);
    } else if ((existing.role || 'user') !== 'admin') {
        existing.role = 'admin';
        await writeJsonFile(DATA_FILES.users, { users });
    }
}

async function requireAuth(req, res, next) {
    const token = getAuthToken(req);
    const session = getSession(token);
    if (!session) return res.status(401).json({ success: false, message: 'Connexion requise' });

    req.user = session;
    await ensureUserDataFiles(session.username);
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès admin requis' });
    }
    next();
}

function makeUniquePlaylistName(existingPlaylists, baseName) {
    const existingNames = new Set(existingPlaylists.map(pl => pl.name));
    if (!existingNames.has(baseName)) return baseName;

    let i = 2;
    while (existingNames.has(`${baseName} (${i})`)) i++;
    return `${baseName} (${i})`;
}

app.get('/api/music', async (req, res) => {
    const now = Date.now();
    if (musicCache.data && (now - musicCache.timestamp) < CONFIG.CACHE_DURATION) {
        return res.json(musicCache.data);
    }
    const musicList = await scanMusicDirectory();
    musicCache = { data: musicList, timestamp: now };
    res.json(musicList);
});

app.get('/api/cover', async (req, res) => {
    try {
        const rawPath = req.query.path;
        const cleanPath = sanitizePath(rawPath);
        const fullPath = path.join(CONFIG.MUSIC_PATH, cleanPath);

        const placeholder = 'https://img.icons8.com/?size=100&id=1wPyVx3xGRwD&format=png&color=000000';

        if (!fsSync.existsSync(fullPath)) return res.redirect(placeholder);

        const metadata = await mm.parseFile(fullPath);
        const picture = metadata.common.picture && metadata.common.picture[0];

        if (picture) {
            const mimeType = picture.format.includes('/') ? picture.format : `image/${picture.format}`;
            res.set({
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000',
                'Content-Length': picture.data.length
            });
            return res.send(picture.data);
        }

        const folderPath = path.dirname(fullPath);
        const imagesInFolder = ['cover.jpg', 'folder.jpg', 'album.jpg', 'cover.png', 'front.jpg'];

        for (const name of imagesInFolder) {
            const imgPath = path.join(folderPath, name);
            if (fsSync.existsSync(imgPath)) {
                return res.sendFile(path.resolve(imgPath));
            }
        }

        res.redirect(placeholder);
    } catch (error) {
        console.error('Erreur cover :', error.message);
        res.redirect('https://img.icons8.com/?size=100&id=1wPyVx3xGRwD&format=png&color=000000');
    }
});

app.get('/api/data/:type', requireAuth, async (req, res) => {
    const type = req.params.type;
    if (!DATA_TYPES.has(type)) {
        return res.status(400).json({ success: false, message: 'Type de données invalide' });
    }

    const filePath = getUserDataFile(req.user.username, type);
    const defaultValue = getDefaultDataForType(type);
    const content = await readJsonFile(filePath, defaultValue);
    res.json(content);
});

app.post('/api/data/:type', requireAuth, async (req, res) => {
    const type = req.params.type;
    if (!DATA_TYPES.has(type)) {
        return res.status(400).json({ success: false, message: 'Type de données invalide' });
    }

    const filePath = getUserDataFile(req.user.username, type);
    await writeJsonFile(filePath, req.body);

    if (type === 'pl') {
        await syncSharedPlaylistsForOwner(req.user.username, Array.isArray(req.body) ? req.body : []);
    }

    res.json({ success: true });
});

async function syncSharedPlaylistsForOwner(ownerUsername, ownerPlaylists) {
    const sharesDb = await readJsonFile(DATA_FILES.sharedPlaylists, { shares: [] });
    const shares = Array.isArray(sharesDb.shares) ? sharesDb.shares : [];

    const acceptedSyncShares = shares.filter(s => (
        s.from === ownerUsername &&
        s.status === 'accepted' &&
        s.syncEnabled === true
    ));

    if (acceptedSyncShares.length === 0) return;

    for (const share of acceptedSyncShares) {
        const sourceName = String(share.sourcePlaylistName || share.playlist?.name || '').trim();
        const sourcePlaylist = ownerPlaylists.find(pl => pl && pl.name === sourceName);
        if (!sourcePlaylist) continue;

        const recipientPlaylistFile = getUserDataFile(share.to, 'pl');
        const recipientPlaylists = await readJsonFile(recipientPlaylistFile, []);
        const targetPlaylist = recipientPlaylists.find(pl => pl.importedFromShareId === share.id);
        if (!targetPlaylist) continue;

        targetPlaylist.tracks = Array.isArray(sourcePlaylist.tracks) ? sourcePlaylist.tracks : [];
        targetPlaylist.syncedAt = new Date().toISOString();
        targetPlaylist.syncEnabled = true;

        share.playlist = {
            name: sourcePlaylist.name,
            tracks: targetPlaylist.tracks
        };
        share.syncedAt = targetPlaylist.syncedAt;

        await writeJsonFile(recipientPlaylistFile, recipientPlaylists);
    }

    await writeJsonFile(DATA_FILES.sharedPlaylists, { shares });
}

app.post('/api/playlists/share', requireAuth, async (req, res) => {
    try {
        const toUsername = normalizeUsername(req.body.toUsername);
        const playlistName = String(req.body.playlistName || '').trim();
        const tracks = Array.isArray(req.body.tracks) ? req.body.tracks : [];

        if (!toUsername || !playlistName) {
            return res.status(400).json({ success: false, message: 'Destinataire et playlist requis' });
        }
        if (toUsername === req.user.username) {
            return res.status(400).json({ success: false, message: 'Impossible de partager avec vous-même' });
        }

        const recipient = await findUserByUsername(toUsername);
        if (!recipient) {
            return res.status(404).json({ success: false, message: 'Utilisateur destinataire introuvable' });
        }

        const sharesDb = await readJsonFile(DATA_FILES.sharedPlaylists, { shares: [] });
        const shares = Array.isArray(sharesDb.shares) ? sharesDb.shares : [];

        const share = {
            id: crypto.randomUUID(),
            from: req.user.username,
            to: toUsername,
            sourcePlaylistName: playlistName,
            playlist: {
                name: playlistName,
                tracks
            },
            createdAt: new Date().toISOString(),
            status: 'pending',
            syncEnabled: Boolean(req.body.syncEnabled)
        };

        shares.push(share);
        await writeJsonFile(DATA_FILES.sharedPlaylists, { shares });

        res.json({ success: true, shareId: share.id });
    } catch {
        res.status(500).json({ success: false, message: 'Partage impossible' });
    }
});

app.get('/api/playlists/shared-with-me', requireAuth, async (req, res) => {
    const sharesDb = await readJsonFile(DATA_FILES.sharedPlaylists, { shares: [] });
    const shares = Array.isArray(sharesDb.shares) ? sharesDb.shares : [];
    const pending = shares.filter(s => s.to === req.user.username && s.status === 'pending');
    const activeSync = shares.filter(s => s.to === req.user.username && s.status === 'accepted' && s.syncEnabled === true);
    const shareLog = shares
        .filter(s => s.to === req.user.username && s.status === 'accepted')
        .map(s => ({
            id: s.id,
            from: s.from,
            playlistName: s.playlist?.name || s.sourcePlaylistName || 'Playlist',
            syncedAt: s.syncedAt || s.acceptedAt || s.createdAt || null,
            syncEnabled: s.syncEnabled === true
        }));
    res.json({ success: true, shares: pending, activeSync, shareLog });
});

app.post('/api/playlists/shared-with-me/:id/accept', requireAuth, async (req, res) => {
    const shareId = req.params.id;
    const sharesDb = await readJsonFile(DATA_FILES.sharedPlaylists, { shares: [] });
    const shares = Array.isArray(sharesDb.shares) ? sharesDb.shares : [];
    const share = shares.find(s => s.id === shareId && s.to === req.user.username && s.status === 'pending');

    if (!share) {
        return res.status(404).json({ success: false, message: 'Partage introuvable' });
    }

    const plFile = getUserDataFile(req.user.username, 'pl');
    const currentPlaylists = await readJsonFile(plFile, []);
    const importedBaseName = `${share.playlist.name} (partagée par ${share.from})`;
    const importedName = makeUniquePlaylistName(currentPlaylists, importedBaseName);

    currentPlaylists.push({
        name: importedName,
        tracks: Array.isArray(share.playlist.tracks) ? share.playlist.tracks : [],
        sharedBy: share.from,
        importedFromShareId: share.id,
        importedAt: new Date().toISOString(),
        syncEnabled: share.syncEnabled === true,
        syncedAt: share.syncEnabled === true ? new Date().toISOString() : null
    });

    share.status = 'accepted';
    share.acceptedAt = new Date().toISOString();

    await writeJsonFile(plFile, currentPlaylists);
    await writeJsonFile(DATA_FILES.sharedPlaylists, { shares });

    res.json({ success: true, playlistName: importedName });
});

app.post('/api/playlists/shared-with-me/:id/refuse', requireAuth, async (req, res) => {
    const shareId = req.params.id;
    const sharesDb = await readJsonFile(DATA_FILES.sharedPlaylists, { shares: [] });
    const shares = Array.isArray(sharesDb.shares) ? sharesDb.shares : [];
    const share = shares.find(s => s.id === shareId && s.to === req.user.username && s.status === 'pending');
    if (!share) {
        return res.status(404).json({ success: false, message: 'Partage introuvable' });
    }

    share.status = 'refused';
    share.refusedAt = new Date().toISOString();
    await writeJsonFile(DATA_FILES.sharedPlaylists, { shares });
    res.json({ success: true });
});

app.post('/api/playlists/shared-with-me/:id/disable-sync', requireAuth, async (req, res) => {
    const shareId = req.params.id;
    const sharesDb = await readJsonFile(DATA_FILES.sharedPlaylists, { shares: [] });
    const shares = Array.isArray(sharesDb.shares) ? sharesDb.shares : [];
    const share = shares.find(s => s.id === shareId && s.to === req.user.username && s.status === 'accepted');
    if (!share) {
        return res.status(404).json({ success: false, message: 'Synchronisation introuvable' });
    }

    share.syncEnabled = false;
    share.syncDisabledAt = new Date().toISOString();

    const plFile = getUserDataFile(req.user.username, 'pl');
    const currentPlaylists = await readJsonFile(plFile, []);
    const linked = currentPlaylists.find(pl => pl.importedFromShareId === share.id);
    if (linked) {
        linked.syncEnabled = false;
    }

    await writeJsonFile(plFile, currentPlaylists);
    await writeJsonFile(DATA_FILES.sharedPlaylists, { shares });
    res.json({ success: true });
});

app.get('/api/playlists/shared-by-me', requireAuth, async (req, res) => {
    const sharesDb = await readJsonFile(DATA_FILES.sharedPlaylists, { shares: [] });
    const shares = Array.isArray(sharesDb.shares) ? sharesDb.shares : [];
    const mine = shares.filter(s => s.from === req.user.username && s.status !== 'refused');
    res.json({ success: true, shares: mine });
});

app.delete('/api/playlists/shared-by-me/:id', requireAuth, async (req, res) => {
    const shareId = req.params.id;
    const sharesDb = await readJsonFile(DATA_FILES.sharedPlaylists, { shares: [] });
    const shares = Array.isArray(sharesDb.shares) ? sharesDb.shares : [];
    const idx = shares.findIndex(s => s.id === shareId && s.from === req.user.username);
    if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Partage introuvable' });
    }

    const [share] = shares.splice(idx, 1);
    if (share?.to) {
        const recipientPlFile = getUserDataFile(share.to, 'pl');
        const recipientPlaylists = await readJsonFile(recipientPlFile, []);
        const filtered = recipientPlaylists.filter(pl => pl.importedFromShareId !== share.id);
        await writeJsonFile(recipientPlFile, filtered);
    }

    await writeJsonFile(DATA_FILES.sharedPlaylists, { shares });
    res.json({ success: true });
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const username = normalizeUsername(req.body.username);
        const password = String(req.body.password || '');
        assertValidCredentials(username, password);

        const usersDb = await readJsonFile(DATA_FILES.users, { users: [] });
        const users = Array.isArray(usersDb.users) ? usersDb.users : [];

        if (users.some(u => normalizeUsername(u.username) === username)) {
            return res.status(409).json({ success: false, message: 'Ce compte existe déjà' });
        }

        users.push({
            username,
            passwordHash: hashPassword(password),
            role: 'user',
            avatarUrl: '',
            createdAt: new Date().toISOString()
        });

        await writeJsonFile(DATA_FILES.users, { users });
        await ensureUserDataFiles(username);

        const token = createSession({ username, role: 'user' });
        res.json({ success: true, token, user: buildPublicUser({ username, role: 'user', avatarUrl: '' }) });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Inscription impossible' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const username = normalizeUsername(req.body.username);
        const password = String(req.body.password || '');
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Nom d\'utilisateur et mot de passe requis' });
        }

        const usersDb = await readJsonFile(DATA_FILES.users, { users: [] });
        const users = Array.isArray(usersDb.users) ? usersDb.users : [];
        const user = users.find(u => normalizeUsername(u.username) === username);

        if (!user || !verifyPassword(password, user.passwordHash)) {
            return res.status(401).json({ success: false, message: 'Identifiants invalides' });
        }

        const role = user.role || 'user';
        await ensureUserDataFiles(user.username);
        const token = createSession({ username: user.username, role });
        res.json({ success: true, token, user: buildPublicUser(user) });
    } catch {
        res.status(500).json({ success: false, message: 'Connexion impossible' });
    }
});

app.get('/api/auth/me', async (req, res) => {
    const token = getAuthToken(req);
    const session = getSession(token);
    if (!session) return res.status(401).json({ success: false, message: 'Session invalide' });
    const user = await findUserByUsername(session.username);
    if (!user) return res.status(401).json({ success: false, message: 'Session invalide' });
    res.json({ success: true, user: buildPublicUser(user) });
});

app.post('/api/auth/avatar', requireAuth, async (req, res) => {
    try {
        const avatarUrl = String(req.body.avatarUrl || '').trim();
        if (avatarUrl && avatarUrl.length > 512) {
            return res.status(400).json({ success: false, message: 'Avatar trop long (512 caractères max)' });
        }

        const usersDb = await readJsonFile(DATA_FILES.users, { users: [] });
        const users = Array.isArray(usersDb.users) ? usersDb.users : [];
        const user = users.find(u => normalizeUsername(u.username) === req.user.username);
        if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

        user.avatarUrl = avatarUrl;
        await writeJsonFile(DATA_FILES.users, { users });
        res.json({ success: true, user: buildPublicUser(user) });
    } catch {
        res.status(500).json({ success: false, message: 'Mise à jour avatar impossible' });
    }
});

app.post('/api/auth/password', requireAuth, async (req, res) => {
    try {
        const currentPassword = String(req.body.currentPassword || '');
        const newPassword = String(req.body.newPassword || '');
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Mot de passe actuel et nouveau requis' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Nouveau mot de passe trop court (6 caractères min)' });
        }

        const usersDb = await readJsonFile(DATA_FILES.users, { users: [] });
        const users = Array.isArray(usersDb.users) ? usersDb.users : [];
        const user = users.find(u => normalizeUsername(u.username) === req.user.username);
        if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
        if (!verifyPassword(currentPassword, user.passwordHash)) {
            return res.status(401).json({ success: false, message: 'Mot de passe actuel invalide' });
        }

        user.passwordHash = hashPassword(newPassword);
        await writeJsonFile(DATA_FILES.users, { users });
        res.json({ success: true, message: 'Mot de passe mis à jour' });
    } catch {
        res.status(500).json({ success: false, message: 'Mise à jour du mot de passe impossible' });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    const token = getAuthToken(req);
    if (token) sessions.delete(token);
    res.json({ success: true });
});


app.get('/api/themes/policy', requireAuth, async (req, res) => {
    const settings = await readAppSettings();
    res.json({
        success: true,
        maxCustomThemes: req.user.role === 'admin' ? null : settings.themeLimitPerUser,
        isAdmin: req.user.role === 'admin',
        rawLimit: settings.themeLimitPerUser
    });
});

app.post('/api/admin/themes/policy', requireAuth, requireAdmin, async (req, res) => {
    try {
        const nextLimit = normalizeThemeLimit(req.body.maxCustomThemes);
        const settings = await writeAppSettings({ themeLimitPerUser: nextLimit });
        res.json({ success: true, maxCustomThemes: settings.themeLimitPerUser });
    } catch {
        res.status(500).json({ success: false, message: 'Mise à jour de la limite impossible' });
    }
});

app.get('/api/admin/features', requireAuth, requireAdmin, async (req, res) => {
    res.json({
        success: true,
        role: 'admin',
        message: 'Compte admin prêt pour des fonctionnalités futures',
        upcomingFeatures: []
    });
});



























// ==========================================
// ROUTES ADMINISTRATION MANQUANTES (A AJOUTER)
// ==========================================

// 1. Lister tous les utilisateurs
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const usersDb = await readJsonFile(DATA_FILES.users, { users: [] });
        const users = Array.isArray(usersDb.users) ? usersDb.users : [];

        // On enrichit les données avec le nombre de playlists/favoris
        const enrichedUsers = await Promise.all(users.map(async (u) => {
            const plFile = getUserDataFile(u.username, 'pl');
            const favFile = getUserDataFile(u.username, 'fav');
            
            const playlists = await readJsonFile(plFile, []);
            const favs = await readJsonFile(favFile, []);

            return {
                username: u.username,
                role: u.role || 'user',
                isAdmin: u.role === 'admin',
                avatarUrl: u.avatarUrl || '',
                playlistCount: Array.isArray(playlists) ? playlists.length : 0,
                favoritesCount: Array.isArray(favs) ? favs.length : 0,
                createdAt: u.createdAt
            };
        }));

        res.json({ success: true, users: enrichedUsers });
    } catch (error) {
        console.error("Erreur admin users:", error);
        res.status(500).json({ success: false, message: "Erreur récupération utilisateurs" });
    }
});

// 2. Récupérer les paramètres globaux
app.get('/api/admin/settings', requireAuth, requireAdmin, async (req, res) => {
    const settings = await readAppSettings();
    res.json({ success: true, settings });
});

// 3. Modifier paramètre : Inscription
app.post('/api/admin/settings/registration', requireAuth, requireAdmin, async (req, res) => {
    const settings = await writeAppSettings({ registrationEnabled: req.body.enabled === true });
    res.json({ success: true, settings });
});

// 4. Modifier paramètre : Limite Playlists
app.post('/api/admin/settings/playlist-limit', requireAuth, requireAdmin, async (req, res) => {
    const limit = parseInt(req.body.limit);
    if (!limit || limit < 1) return res.status(400).json({ success: false });
    const settings = await writeAppSettings({ maxPlaylistsPerUser: limit });
    res.json({ success: true, settings });
});

// 5. Modifier paramètre : Force Thème
app.post('/api/admin/settings/theme-force', requireAuth, requireAdmin, async (req, res) => {
    const settings = await writeAppSettings({ globalThemeForced: req.body.forced === true });
    res.json({ success: true, settings });
});

// 6. Modifier paramètre : Couleur Globale
app.post('/api/admin/settings/global-theme', requireAuth, requireAdmin, async (req, res) => {
    const settings = await writeAppSettings({ 
        globalTheme: req.body.theme,
        globalThemeForced: req.body.forced === true 
    });
    res.json({ success: true, settings });
});

// 7. Supprimer un utilisateur
app.delete('/api/admin/delete-user/:username', requireAuth, requireAdmin, async (req, res) => {
    const targetUsername = req.params.username;
    if (targetUsername === req.user.username) {
        return res.status(400).json({ success: false, message: "Impossible de se supprimer soi-même" });
    }

    try {
        // 1. Supprimer de users.json
        const usersDb = await readJsonFile(DATA_FILES.users, { users: [] });
        const initialLength = usersDb.users.length;
        usersDb.users = usersDb.users.filter(u => normalizeUsername(u.username) !== normalizeUsername(targetUsername));
        
        if (usersDb.users.length === initialLength) {
            return res.status(404).json({ success: false, message: "Utilisateur introuvable" });
        }
        await writeJsonFile(DATA_FILES.users, usersDb);

        // 2. Supprimer ses fichiers de données (Dossier)
        const userDir = getUserDataDir(targetUsername);
        if (fsSync.existsSync(userDir)) {
            await fs.rm(userDir, { recursive: true, force: true });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Erreur suppression user:", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// 8. Export Global (Tout le serveur)
app.get('/api/admin/export-all', requireAuth, requireAdmin, async (req, res) => {
    try {
        const usersDb = await readJsonFile(DATA_FILES.users, { users: [] });
        const settings = await readAppSettings();
        const shared = await readJsonFile(DATA_FILES.sharedPlaylists, { shares: [] });

        const fullExport = {
            date: new Date().toISOString(),
            system: { settings, sharedPlaylists: shared.shares },
            users: []
        };

        // On récupère les données de chaque utilisateur
        for (const u of usersDb.users) {
            const userData = {
                profile: { username: u.username, role: u.role, createdAt: u.createdAt },
                data: {}
            };
            
            for (const type of DATA_TYPES) {
                const file = getUserDataFile(u.username, type);
                userData.data[type] = await readJsonFile(file, getDefaultDataForType(type));
            }
            fullExport.users.push(userData);
        }

        res.setHeader('Content-Disposition', `attachment; filename="localify-export-${Date.now()}.json"`);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(fullExport, null, 2));

    } catch (error) {
        console.error("Erreur export global:", error);
        res.status(500).json({ success: false, message: "Echec de l'export" });
    }
});

// 9. Export Utilisateur Spécifique
app.get('/api/admin/export-user/:username', requireAuth, requireAdmin, async (req, res) => {
    try {
        const targetUsername = req.params.username;
        const usersDb = await readJsonFile(DATA_FILES.users, { users: [] });
        const user = usersDb.users.find(u => normalizeUsername(u.username) === normalizeUsername(targetUsername));

        if (!user) return res.status(404).json({ success: false, message: "Utilisateur introuvable" });

        const userExport = {
            username: user.username,
            exportedAt: new Date().toISOString(),
            playlists: await readJsonFile(getUserDataFile(user.username, 'pl'), []),
            favs: await readJsonFile(getUserDataFile(user.username, 'fav'), []),
            config: await readJsonFile(getUserDataFile(user.username, 'cfg'), {}),
            history: await readJsonFile(getUserDataFile(user.username, 'history'), [])
        };

        res.setHeader('Content-Disposition', `attachment; filename="localify-${user.username}.json"`);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(userExport, null, 2));

    } catch (error) {
        console.error("Erreur export user:", error);
        res.status(500).json({ success: false });
    }
});























async function startServer() {
    await initializeDataDir();
    app.listen(CONFIG.PORT, () => {
        console.log(`\n✓ Serveur Localify démarré sur http://localhost:${CONFIG.PORT}\n`);
        console.log(`ℹ️ Compte admin par défaut: ${CONFIG.DEFAULT_ADMIN_USERNAME} / ${CONFIG.DEFAULT_ADMIN_PASSWORD}`);
    });
}

startServer();
