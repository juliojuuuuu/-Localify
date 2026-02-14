// ========================================
// GESTION PROFIL UTILISATEUR & AVATAR LOCAL
// ========================================

// ========================================
// CHANGER L'AVATAR (STOCKAGE LOCAL)
// ========================================
function changeAvatarFromMenu() {
    closeUserMenu();
    showAvatarModal();
}

function showAvatarModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.id = 'avatar-modal';
    
    // Avatars par défaut (emojis/icônes)
    const defaultAvatars = [
        '😎', '🎵', '🎧', '🎸', '🎹', '🎤', 
        '🎺', '🥁', '🎻', '🎼', '🔥', '⭐',
        '🌟', '💫', '✨', '🎨', '🎭', '👑',
        '🦄', '🐉', '🦅', '🦋', '🌈', '🌙'
    ];
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <h2 class="modal-title">🖼️ Changer l'avatar</h2>
            
            <!-- Upload personnalisé -->
            <div style="margin: 20px 0;">
                <div class="setting-label">Importer une image</div>
                <div style="display: flex; gap: 10px; align-items: center; margin-top: 10px;">
                    <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                    <button class="btn-primary" onclick="document.getElementById('avatar-upload').click()">
                        📁 Choisir une image
                    </button>
                    <span id="avatar-filename" style="font-size: 12px; color: var(--text-muted);"></span>
                </div>
                <div id="avatar-preview" style="margin-top: 15px; text-align: center;"></div>
            </div>
            
            <div style="border-top: 1px solid var(--border); margin: 20px 0;"></div>
            
            <!-- Avatars par défaut -->
            <div style="margin: 20px 0;">
                <div class="setting-label">Ou choisir un emoji</div>
                <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; margin-top: 10px;">
                    ${defaultAvatars.map(emoji => `
                        <button class="avatar-option" onclick="selectEmojiAvatar('${emoji}')" 
                            style="font-size: 28px; padding: 10px; border: 2px solid var(--border); 
                            background: var(--card); border-radius: 10px; cursor: pointer; transition: all 0.2s;">
                            ${emoji}
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeAvatarModal()">Annuler</button>
                <button class="btn-primary" onclick="saveAvatar()">Enregistrer</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Gestion de l'upload
    const fileInput = document.getElementById('avatar-upload');
    fileInput.addEventListener('change', handleAvatarUpload);
    
    // Fermer en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAvatarModal();
    });
    
    // Charger l'avatar actuel
    loadCurrentAvatar();
}

let selectedAvatarData = null;
let selectedAvatarType = null; // 'image' ou 'emoji'

function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Vérifier la taille (max 500KB)
    if (file.size > 500 * 1024) {
        showNotification('Image trop grande (max 500KB)', 'error');
        return;
    }
    
    // Vérifier le type
    if (!file.type.startsWith('image/')) {
        showNotification('Fichier invalide', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            // Redimensionner l'image
            const canvas = document.createElement('canvas');
            const maxSize = 200;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convertir en base64
            selectedAvatarData = canvas.toDataURL('image/jpeg', 0.8);
            selectedAvatarType = 'image';
            
            // Afficher l'aperçu
            const preview = document.getElementById('avatar-preview');
            preview.innerHTML = `
                <img src="${selectedAvatarData}" 
                    style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; 
                    border: 3px solid var(--accent); box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
            `;
            
            const filename = document.getElementById('avatar-filename');
            filename.textContent = file.name;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function selectEmojiAvatar(emoji) {
    selectedAvatarData = emoji;
    selectedAvatarType = 'emoji';
    
    // Retirer la sélection précédente
    document.querySelectorAll('.avatar-option').forEach(btn => {
        btn.style.borderColor = 'var(--border)';
        btn.style.background = 'var(--card)';
    });
    
    // Marquer comme sélectionné
    event.target.style.borderColor = 'var(--accent)';
    event.target.style.background = 'var(--accent-glow)';
    
    // Afficher l'aperçu
    const preview = document.getElementById('avatar-preview');
    preview.innerHTML = `
        <div style="width: 120px; height: 120px; border-radius: 50%; 
            background: var(--accent); display: flex; align-items: center; 
            justify-content: center; font-size: 60px; margin: 0 auto;
            border: 3px solid var(--accent); box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
            ${emoji}
        </div>
    `;
    
    // Effacer le nom de fichier
    const filename = document.getElementById('avatar-filename');
    if (filename) filename.textContent = '';
}

function loadCurrentAvatar() {
    if (!authState.user) return;
    
    const preview = document.getElementById('avatar-preview');
    if (!preview) return;
    
    if (authState.user.avatarUrl) {
        const isEmoji = authState.user.avatarUrl.length <= 4; // Emoji = 1-4 caractères
        
        if (isEmoji) {
            preview.innerHTML = `
                <div style="width: 120px; height: 120px; border-radius: 50%; 
                    background: var(--card-hover); display: flex; align-items: center; 
                    justify-content: center; font-size: 60px; margin: 0 auto;
                    border: 2px solid var(--border);">
                    ${authState.user.avatarUrl}
                </div>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 10px;">Avatar actuel</p>
            `;
        } else {
            preview.innerHTML = `
                <img src="${authState.user.avatarUrl}" 
                    style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; 
                    border: 2px solid var(--border); margin: 0 auto; display: block;">
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 10px;">Avatar actuel</p>
            `;
        }
    }
}

// DANS user-profile.js

async function saveAvatar() {
    if (!selectedAvatarData) {
        showNotification('Sélectionnez un avatar', 'error');
        return;
    }
    
    // Modification du bouton pour montrer le chargement
    const btn = document.querySelector('#avatar-modal .btn-primary');
    const oldText = btn.innerText;
    btn.innerText = "Sauvegarde...";
    btn.disabled = true;

    try {
        // ON ENVOIE AU SERVEUR (API) AU LIEU DU LOCALSTORAGE
        const res = await fetch('/api/auth/avatar', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ avatarUrl: selectedAvatarData })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || "Erreur serveur");
        }

        // Mise à jour de l'utilisateur connecté avec les données du serveur
        authState.user = data.user;
        
        // On supprime l'ancien avatar local qui causait le conflit
        localStorage.removeItem('localify_avatar'); 

        showNotification('Avatar enregistré sur le compte ✅', 'success');
        
        if (typeof renderUserMenu === 'function') renderUserMenu();
        closeAvatarModal();

    } catch (error) {
        console.error(error);
        showNotification("Erreur sauvegarde : " + error.message, 'error');
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

function closeAvatarModal() {
    const modal = document.getElementById('avatar-modal');
    if (modal) modal.remove();
    selectedAvatarData = null;
    selectedAvatarType = null;
}

// ========================================
// CHANGER LE MOT DE PASSE
// ========================================
function changePasswordFromMenu() {
    closeUserMenu();
    showPasswordModal();
}

function showPasswordModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.id = 'password-modal';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <h2 class="modal-title">🔒 Changer le mot de passe</h2>
            
            <div style="margin: 20px 0;">
                <div class="setting-label">Mot de passe actuel</div>
                <input type="password" id="current-password" class="styled-input" 
                    placeholder="Entrez votre mot de passe actuel" style="margin-top: 8px;">
            </div>
            
            <div style="margin: 20px 0;">
                <div class="setting-label">Nouveau mot de passe</div>
                <input type="password" id="new-password" class="styled-input" 
                    placeholder="Au moins 6 caractères" style="margin-top: 8px;">
            </div>
            
            <div style="margin: 20px 0;">
                <div class="setting-label">Confirmer le nouveau mot de passe</div>
                <input type="password" id="confirm-password" class="styled-input" 
                    placeholder="Retapez le mot de passe" style="margin-top: 8px;">
            </div>
            
            <div class="modal-actions">
                <button class="btn-secondary" onclick="closePasswordModal()">Annuler</button>
                <button class="btn-primary" onclick="savePassword()">Enregistrer</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fermer en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePasswordModal();
    });
    
    // Focus sur le premier champ
    setTimeout(() => {
        document.getElementById('current-password')?.focus();
    }, 100);
}

async function savePassword() {
    const current = document.getElementById('current-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;
    
    // Validation
    if (!current || !newPass || !confirm) {
        showNotification('Tous les champs sont requis', 'error');
        return;
    }
    
    if (newPass.length < 6) {
        showNotification('Le mot de passe doit faire au moins 6 caractères', 'error');
        return;
    }
    
    if (newPass !== confirm) {
        showNotification('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/user/change-password', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ 
                currentPassword: current,
                newPassword: newPass 
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Mot de passe mis à jour ✅', 'success');
            closePasswordModal();
        } else {
            showNotification(data.error || 'Mot de passe actuel incorrect', 'error');
        }
    } catch (error) {
        console.error('Erreur changement mot de passe:', error);
        showNotification('Erreur lors du changement', 'error');
    }
}

function closePasswordModal() {
    const modal = document.getElementById('password-modal');
    if (modal) modal.remove();
}

// ========================================
// AMÉLIORATION DU MENU UTILISATEUR
// ========================================

// Améliorer le style du menu au clic sur les options
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('user-menu-item')) {
        // Petite animation au clic
        e.target.style.transform = 'scale(0.95)';
        setTimeout(() => {
            e.target.style.transform = '';
        }, 100);
    }
});

// Ajouter un style CSS pour les avatars emoji dans le menu
const style = document.createElement('style');
style.textContent = `
    .user-bubble-btn {
        transition: all 0.3s ease;
    }
    
    .user-bubble-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 15px rgba(255, 0, 123, 0.3);
    }
    
    .user-bubble-btn img {
        transition: transform 0.3s ease;
    }
    
    .user-bubble-btn:hover img {
        transform: scale(1.1);
    }
    
    .avatar-option:hover {
        transform: scale(1.1);
        border-color: var(--accent) !important;
    }
    
    .user-menu-item {
        transition: all 0.2s ease;
    }
    
    .user-menu-item:hover {
        transform: translateX(5px);
    }
`;
document.head.appendChild(style);
