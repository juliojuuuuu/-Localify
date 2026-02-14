// ========================================
// ÉTAT GLOBAL & CONFIGURATION
// ========================================
let allMusic = [], favs = [], playlists = [], queue = [], qIdx = 0;
let currentViewTracks = [], history = [], trackToEnqueue = null;
let audio = new Audio();

// --- CONFIGURATION INDISPENSABLE POUR iOS ---
audio.setAttribute("playsinline", "true");
audio.setAttribute("webkit-playsinline", "true");
audio.preload = "auto";
audio.crossOrigin = "anonymous";

let config = { autoplay: true, volume: 1, carMode: false };
let isAsc = true;
let isShuffle = false;
let repeatMode = 0; 
let isFocusMode = false;

let audioContext, analyser, dataArray, source;
let bassNode, midNode, trebleNode;
let eqSettings = { bass: 0, mid: 0, treble: 0 };
let visualizerColor = { r: 255, g: 0, b: 123 }; 
let animationId;

let authState = {
    token: localStorage.getItem('localify_auth_token') || '',
    user: null
};

// Options de personnalisation
let personalization = {
    bgImage: '',            
    visualizerType: 'bars', 
    borderRadius: '12px',   
    showFocusHeart: true,       
    enableFocusAnimation: true, 
    showFocusVisualizer: true,
    enableScreensaver: false, 
    enableCrossfade: false,
    showPlaylistsOnHome: false,
    recentPosition: 'bottom',
    chameleonMode: false,
    coverStyle: 'square',
    sidebarStyle: 'default',
    themePreset: 'custom',
    blurIntensity: 10,
    dashboardLayoutOrder: ['stats', 'charts', 'arrivals', 'recos', 'tools'],
    highContrast: false,
    autoThemeByTime: false,
    
    // --- NOUVEAU : Mode Ambiance ---
    ambianceMode: 'none' // 'none', 'snow', 'embers', 'stars', 'fireflies'
};

// Chargement et fusion des préférences
const savedPerso = localStorage.getItem('localify_perso');
if (savedPerso) {
    try {
        const parsed = JSON.parse(savedPerso);
        personalization = { ...personalization, ...parsed };
    } catch (e) { console.error("Erreur chargement perso", e); }
}