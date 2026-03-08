/* ═══════════════════════════════════════════════
H  —  Personal Offline Micro-Social App
app.js — All application logic
═══════════════════════════════════════════════ */

const DB_KEY_PROFILE = ‘h_profile’;
const DB_KEY_POSTS   = ‘h_posts’;
const MAX_CHARS      = 280;

/* ── State ── */
let profile       = null;
let posts         = [];
let composerImage = null;
let openMenuId    = null;

/* ── Bootstrap ── */
document.addEventListener(‘DOMContentLoaded’, () => {
profile = loadProfile();
posts   = loadPosts();

if (!profile) {
showOnboarding();
} else {
bootApp();
}

// Close menus on outside click
document.addEventListener(‘click’, e => {
if (openMenuId && !e.target.closest(’.post-menu-wrapper’)) {
closeAllMenus();
}
});
});

/* ── Service Worker ── */
if (‘serviceWorker’ in navigator) {
window.addEventListener(‘load’, () => {
navigator.serviceWorker.register(’./service-worker.js’)
.catch(err => console.log(‘SW registration failed:’, err));
});
}

/* ══════════════════════════════════════════════
STORAGE
══════════════════════════════════════════════ */
function loadProfile() {
try { return JSON.parse(localStorage.getItem(DB_KEY_PROFILE)); } catch { return null; }
}
function saveProfile(p) {
localStorage.setItem(DB_KEY_PROFILE, JSON.stringify(p));
}
function loadPosts() {
try { return JSON.parse(localStorage.getItem(DB_KEY_POSTS)) || []; } catch { return []; }
}
function savePosts() {
localStorage.setItem(DB_KEY_POSTS, JSON.stringify(posts));
}

/* ══════════════════════════════════════════════
ONBOARDING MODAL
══════════════════════════════════════════════ */
function showOnboarding() {
const overlay = document.createElement(‘div’);
overlay.className = ‘modal-overlay’;
overlay.innerHTML = `
<div class="modal" id="onboard-modal">
<div class="modal-logo"><span class="logo-letter">H</span></div>
<h2>Welcome to H</h2>
<p>Your personal offline space. Set up your profile to get started.</p>

```
  <div class="avatar-upload-area" id="avatar-area">
    <div class="avatar-upload-circle" id="avatar-circle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 16v-4m0 0V8m0 4H8m4 0h4"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
    </div>
    <span class="avatar-upload-label">Add profile photo</span>
    <input type="file" id="avatar-file" accept="image/*" style="display:none">
  </div>

  <div class="field">
    <label>Display Name</label>
    <input type="text" id="onboard-name" placeholder="Your name" maxlength="50" autocomplete="off">
  </div>
  <div class="field">
    <label>Username</label>
    <input type="text" id="onboard-handle" placeholder="@username" maxlength="30" autocomplete="off">
    <div class="field-hint">Others will see this as your handle</div>
  </div>

  <button class="modal-submit" id="onboard-submit" disabled>Let's go →</button>
</div>
```

`;
document.body.appendChild(overlay);

// Avatar upload
let avatarData = null;
const avatarArea   = overlay.querySelector(’#avatar-area’);
const avatarFile   = overlay.querySelector(’#avatar-file’);
const avatarCircle = overlay.querySelector(’#avatar-circle’);

avatarArea.addEventListener(‘click’, () => avatarFile.click());
avatarFile.addEventListener(‘change’, () => {
const file = avatarFile.files[0];
if (!file) return;
resizeImage(file, 300, data => {
avatarData = data;
avatarCircle.innerHTML = `<img src="${data}" alt="avatar">`;
});
});

// Validation
const nameInput   = overlay.querySelector(’#onboard-name’);
const handleInput = overlay.querySelector(’#onboard-handle’);
const submitBtn   = overlay.querySelector(’#onboard-submit’);

function validate() {
submitBtn.disabled = !nameInput.value.trim() || !handleInput.value.trim();
}
nameInput.addEventListener(‘input’, validate);
handleInput.addEventListener(‘input’, () => {
let v = handleInput.value.replace(/[^a-zA-Z0-9_]/g, ‘’);
handleInput.value = v;
validate();
});

// Submit
submitBtn.addEventListener(‘click’, () => {
let handle = handleInput.value.trim();
if (!handle.startsWith(’@’)) handle = ‘@’ + handle;

```
profile = {
  name:   nameInput.value.trim(),
  handle: handle,
  avatar: avatarData || null
};
saveProfile(profile);
overlay.remove();
bootApp();
showToast('Profile saved! Welcome to H ✦');
```

});
}

/* ══════════════════════════════════════════════
APP BOOT — Render Shell
══════════════════════════════════════════════ */
function bootApp() {
document.getElementById(‘app’).innerHTML = buildShell();
bindComposer();
renderFeed();
updateSidebarProfile();
updateStats();
}

function buildShell() {
const avatarHTML = profile.avatar
? `<img src="${profile.avatar}" alt="avatar">`
: `<div class="composer-avatar-placeholder">${initials(profile.name)}</div>`;

const sidebarAvatar = profile.avatar
? `<img src="${profile.avatar}" alt="avatar" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
: `<div style="width:40px;height:40px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1rem;">${initials(profile.name)}</div>`;

return `

  <div class="app-shell">

```
<!-- Left Sidebar -->
<nav class="sidebar">
  <a class="sidebar-logo" href="#">
    <span class="logo-letter">H</span>
  </a>
  <div class="sidebar-nav">
    ${navItem(iconHome(), 'Home', true)}
    ${navItem(iconSearch(), 'Explore')}
    ${navItem(iconBell(), 'Notifications')}
    ${navItem(iconMail(), 'Messages')}
    ${navItem(iconBookmark(), 'Bookmarks')}
    ${navItem(iconUser(), 'Profile')}
  </div>
  <div class="sidebar-profile">
    ${sidebarAvatar}
    <div class="sidebar-profile-info">
      <div class="sidebar-profile-name">${esc(profile.name)}</div>
      <div class="sidebar-profile-handle">${esc(profile.handle)}</div>
    </div>
    <span class="sidebar-profile-dots">···</span>
  </div>
</nav>

<!-- Main Column -->
<main class="main-col">
  <div class="timeline-header">
    <h2>For You</h2>
    <div class="tabs">
      <div class="tab active">For You</div>
      <div class="tab">Following</div>
    </div>
  </div>

  <!-- Composer -->
  <div class="composer">
    <div class="composer-avatar">${avatarHTML}</div>
    <div class="composer-body">
      <div class="composer-audience">
        ${iconGlobe()} Everyone
      </div>
      <textarea
        class="composer-textarea"
        id="post-input"
        placeholder="What's happening?"
        maxlength="${MAX_CHARS}"
        rows="2"
      ></textarea>
      <div id="composer-img-preview"></div>
      <div class="composer-divider"></div>
      <div class="composer-actions">
        <div class="composer-tools">
          <label class="tool-btn" title="Add photo">
            ${iconImage()}
            <input type="file" id="img-upload" accept="image/*">
          </label>
        </div>
        <div class="composer-right">
          <span class="char-count" id="char-count">0</span>
          <button class="post-btn" id="post-btn" disabled>Post</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Feed -->
  <div class="feed" id="feed"></div>
</main>

<!-- Right Sidebar -->
<aside class="right-sidebar">
  <div class="search-bar">
    ${iconSearch()}
    <input type="text" placeholder="Search H">
  </div>
  <div class="widget-card" id="stats-widget">
    <h3>Your Stats</h3>
    <div class="widget-stat">
      <span class="widget-stat-label">Posts</span>
      <span class="widget-stat-value" id="stat-posts">0</span>
    </div>
    <div class="widget-stat">
      <span class="widget-stat-label">With photos</span>
      <span class="widget-stat-value" id="stat-photos">0</span>
    </div>
    <div class="widget-stat">
      <span class="widget-stat-label">Member since</span>
      <span class="widget-stat-value" id="stat-since">—</span>
    </div>
  </div>
</aside>
```

  </div>

  <!-- Mobile Nav -->

  <div class="mobile-nav">
    <div class="mobile-nav-item">${iconHome()}</div>
    <div class="mobile-nav-item">${iconSearch()}</div>
    <div class="mobile-nav-item">${iconBell()}</div>
    <div class="mobile-nav-item">${iconUser()}</div>
  </div>
  `;
}

function navItem(icon, label, active = false) {
return `<div class="nav-item${active ? ' active' : ''}"> ${icon} <span>${label}</span> </div>`;
}

/* ══════════════════════════════════════════════
COMPOSER
══════════════════════════════════════════════ */
function bindComposer() {
const textarea  = document.getElementById(‘post-input’);
const postBtn   = document.getElementById(‘post-btn’);
const imgUpload = document.getElementById(‘img-upload’);
const charCount = document.getElementById(‘char-count’);

textarea.addEventListener(‘input’, () => {
const len = textarea.value.length;
charCount.textContent = len;
charCount.className = ‘char-count’ + (len > 260 ? ’ danger’ : len > 220 ? ’ warn’ : ‘’);
postBtn.disabled = len === 0 && !composerImage;
autoResize(textarea);
});

imgUpload.addEventListener(‘change’, () => {
const file = imgUpload.files[0];
if (!file) return;
resizeImage(file, 1200, data => {
composerImage = data;
renderComposerPreview();
postBtn.disabled = false;
});
});

postBtn.addEventListener(‘click’, submitPost);

textarea.addEventListener(‘keydown’, e => {
if ((e.metaKey || e.ctrlKey) && e.key === ‘Enter’) submitPost();
});
}

function renderComposerPreview() {
const preview = document.getElementById(‘composer-img-preview’);
if (!composerImage) { preview.innerHTML = ‘’; return; }
preview.innerHTML = `<div class="composer-image-preview"> <img src="${composerImage}" alt="preview"> <button class="remove-img" id="remove-img" title="Remove">✕</button> </div>`;
document.getElementById(‘remove-img’).addEventListener(‘click’, () => {
composerImage = null;
document.getElementById(‘img-upload’).value = ‘’;
renderComposerPreview();
const ta = document.getElementById(‘post-input’);
document.getElementById(‘post-btn’).disabled = ta.value.trim().length === 0;
});
}

function submitPost() {
const textarea = document.getElementById(‘post-input’);
const text = textarea.value.trim();
if (!text && !composerImage) return;

const now = new Date();
const post = {
id:        generateId(),
text:      text,
image:     composerImage || null,
timestamp: now.toISOString(),
liked:     false,
likes:     0,
};

posts.unshift(post);
savePosts();

textarea.value = ‘’;
document.getElementById(‘char-count’).textContent = ‘0’;
document.getElementById(‘post-btn’).disabled = true;
textarea.style.height = ‘’;
composerImage = null;
document.getElementById(‘img-upload’).value = ‘’;
renderComposerPreview();

prependPostCard(post);
updateStats();
showToast(‘Your post is live ✦’);
}

/* ══════════════════════════════════════════════
FEED
══════════════════════════════════════════════ */
function renderFeed() {
const feed = document.getElementById(‘feed’);
if (posts.length === 0) {
feed.innerHTML = `<div class="empty-state"> <div class="empty-state-icon">${iconFeather()}</div> <h3>Nothing here yet</h3> <p>When you post something, it will show up here.</p> </div>`;
return;
}
feed.innerHTML = ‘’;
posts.forEach(p => feed.appendChild(buildPostCard(p)));
}

function prependPostCard(post) {
const feed = document.getElementById(‘feed’);
const empty = feed.querySelector(’.empty-state’);
if (empty) feed.innerHTML = ‘’;
const card = buildPostCard(post);
feed.prepend(card);
}

function buildPostCard(post) {
const wrap = document.createElement(‘article’);
wrap.className = ‘post-card’;
wrap.dataset.id = post.id;

const avatarHTML = profile.avatar
? `<img src="${profile.avatar}" alt="avatar">`
: `<div class="post-avatar-placeholder">${initials(profile.name)}</div>`;

const imageHTML = post.image
? `<div class="post-image"><img src="${post.image}" alt="post image" loading="lazy"></div>`
: ‘’;

const likedClass = post.liked ? ‘post-action like liked’ : ‘post-action like’;

wrap.innerHTML = `<div class="post-avatar">${avatarHTML}</div> <div class="post-body"> <div class="post-header"> <span class="post-name">${esc(profile.name)}</span> <span class="post-handle">${esc(profile.handle)}</span> <span class="post-dot">·</span> <span class="post-time">${formatDate(post.timestamp)}</span> </div> ${post.text ?`<div class="post-text">${esc(post.text)}</div>`: ''} ${imageHTML} <div class="post-actions-bar"> <span class="post-action" title="Reply">${iconReply()} <span>0</span></span> <span class="post-action" title="Repost">${iconRepost()} <span>0</span></span> <span class="${likedClass}" title="Like" data-likes="${post.likes}">${iconHeart()} <span>${post.likes}</span></span> <span class="post-action" title="Share">${iconShare()}</span> </div> </div> <div class="post-menu-wrapper"> <button class="menu-trigger" title="More">${iconDots()}</button> <div class="dropdown-menu" style="display:none"> <div class="dropdown-item danger" data-action="delete"> ${iconTrash()} Delete </div> </div> </div>`;

// Like toggle
const likeBtn = wrap.querySelector(’.post-action.like’);
likeBtn.addEventListener(‘click’, e => {
e.stopPropagation();
const idx = posts.findIndex(p => p.id === post.id);
if (idx === -1) return;
posts[idx].liked = !posts[idx].liked;
posts[idx].likes += posts[idx].liked ? 1 : -1;
savePosts();
likeBtn.className = posts[idx].liked ? ‘post-action like liked’ : ‘post-action like’;
likeBtn.querySelector(‘span’).textContent = posts[idx].likes;
});

// Three-dot menu
const trigger = wrap.querySelector(’.menu-trigger’);
const menu    = wrap.querySelector(’.dropdown-menu’);

trigger.addEventListener(‘click’, e => {
e.stopPropagation();
const isOpen = menu.style.display !== ‘none’;
closeAllMenus();
if (!isOpen) {
menu.style.display = ‘block’;
openMenuId = post.id;
}
});

// Delete
wrap.querySelector(’[data-action=“delete”]’).addEventListener(‘click’, e => {
e.stopPropagation();
deletePost(post.id, wrap);
});

return wrap;
}

function deletePost(id, cardEl) {
posts = posts.filter(p => p.id !== id);
savePosts();
cardEl.style.transition = ‘opacity 0.2s, transform 0.2s’;
cardEl.style.opacity = ‘0’;
cardEl.style.transform = ‘translateX(8px)’;
setTimeout(() => {
cardEl.remove();
if (posts.length === 0) renderFeed();
updateStats();
}, 200);
showToast(‘Post deleted’);
}

function closeAllMenus() {
document.querySelectorAll(’.dropdown-menu’).forEach(m => m.style.display = ‘none’);
openMenuId = null;
}

/* ══════════════════════════════════════════════
STATS
══════════════════════════════════════════════ */
function updateStats() {
const el = document.getElementById(‘stat-posts’);
const ep = document.getElementById(‘stat-photos’);
const es = document.getElementById(‘stat-since’);
if (!el) return;
el.textContent = posts.length;
ep.textContent = posts.filter(p => p.image).length;
// Member since = earliest post or today
if (posts.length > 0) {
const earliest = new Date(posts[posts.length - 1].timestamp);
es.textContent = earliest.toLocaleDateString(‘en-US’, { month: ‘short’, year: ‘numeric’ });
} else {
es.textContent = new Date().toLocaleDateString(‘en-US’, { month: ‘short’, year: ‘numeric’ });
}
}

function updateSidebarProfile() { /* Already rendered in shell */ }

/* ══════════════════════════════════════════════
UTILS
══════════════════════════════════════════════ */
function generateId() {
return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function initials(name) {
return name.split(’ ‘).map(w => w[0]).join(’’).toUpperCase().slice(0, 2);
}

function esc(str) {
return String(str)
.replace(/&/g, ‘&’)
.replace(/</g, ‘<’)
.replace(/>/g, ‘>’)
.replace(/”/g, ‘"’);
}

function formatDate(iso) {
const d = new Date(iso);
const now = new Date();
const diff = (now - d) / 1000;
if (diff < 60)  return Math.floor(diff) + ‘s’;
if (diff < 3600) return Math.floor(diff / 60) + ‘m’;
if (diff < 86400) return Math.floor(diff / 3600) + ‘h’;
return d.toLocaleDateString(‘en-US’, { month: ‘short’, day: ‘numeric’, year: d.getFullYear() !== now.getFullYear() ? ‘numeric’ : undefined })
+ ’ · ’ + d.toLocaleTimeString(‘en-US’, { hour: ‘2-digit’, minute: ‘2-digit’, hour12: false });
}

function autoResize(el) {
el.style.height = ‘auto’;
el.style.height = el.scrollHeight + ‘px’;
}

function resizeImage(file, maxSize, callback) {
const reader = new FileReader();
reader.onload = e => {
const img = new Image();
img.onload = () => {
let w = img.width, h = img.height;
if (w > maxSize || h > maxSize) {
if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
else       { w = Math.round(w * maxSize / h); h = maxSize; }
}
const canvas = document.createElement(‘canvas’);
canvas.width = w; canvas.height = h;
canvas.getContext(‘2d’).drawImage(img, 0, 0, w, h);
callback(canvas.toDataURL(‘image/jpeg’, 0.82));
};
img.src = e.target.result;
};
reader.readAsDataURL(file);
}

function showToast(msg) {
const t = document.createElement(‘div’);
t.className = ‘toast’;
t.textContent = msg;
document.body.appendChild(t);
setTimeout(() => t.remove(), 2700);
}

/* ══════════════════════════════════════════════
SVG ICONS
══════════════════════════════════════════════ */
function iconHome() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/> <path d="M9 21V12h6v9"/> </svg>`;
}
function iconSearch() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="11" cy="11" r="8"/> <path d="M21 21l-4.35-4.35"/> </svg>`;
}
function iconBell() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/> <path d="M13.73 21a2 2 0 01-3.46 0"/> </svg>`;
}
function iconMail() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="2" y="4" width="20" height="16" rx="2"/> <path d="M2 7l10 7 10-7"/> </svg>`;
}
function iconBookmark() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/> </svg>`;
}
function iconUser() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/> <circle cx="12" cy="7" r="4"/> </svg>`;
}
function iconGlobe() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"> <circle cx="12" cy="12" r="10"/> <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/> </svg>`;
}
function iconImage() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="3" y="3" width="18" height="18" rx="2"/> <circle cx="8.5" cy="8.5" r="1.5"/> <path d="M21 15l-5-5L5 21"/> </svg>`;
}
function iconDots() {
return `<svg viewBox="0 0 24 24" fill="currentColor"> <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/> </svg>`;
}
function iconTrash() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"> <polyline points="3 6 5 6 21 6"/> <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/> <path d="M10 11v6M14 11v6"/> <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/> </svg>`;
}
function iconReply() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"> <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/> </svg>`;
}
function iconRepost() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"> <polyline points="17 1 21 5 17 9"/> <path d="M3 11V9a4 4 0 014-4h14"/> <polyline points="7 23 3 19 7 15"/> <path d="M21 13v2a4 4 0 01-4 4H3"/> </svg>`;
}
function iconHeart() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"> <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/> </svg>`;
}
function iconShare() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"> <circle cx="18" cy="5" r="3"/> <circle cx="6" cy="12" r="3"/> <circle cx="18" cy="19" r="3"/> <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/> <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/> </svg>`;
}
function iconFeather() {
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px"> <path d="M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5z"/> <line x1="16" y1="8" x2="2" y2="22"/> <line x1="17.5" y1="15" x2="9" y2="15"/> </svg>`;
}
