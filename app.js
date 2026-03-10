// app.js - Hitgram Main Application Logic

// ──────────────────── Service Worker Registration ────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW error:', err));
  });
}

// ──────────────────── Toast Utility ────────────────────
function showToast(message, type = '', duration = 2800) {
  let toast = document.getElementById('hitgram-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'hitgram-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'toast ' + type;
  requestAnimationFrame(() => {
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), duration);
  });
}

// ──────────────────── Blob → Object URL cache ────────────────────
const urlCache = new Map();
function getBlobUrl(blob) {
  if (!blob) return '';
  const key = blob.size + '_' + blob.type;
  if (urlCache.has(key)) return urlCache.get(key);
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

// ──────────────────── Image Rendering ────────────────────
function renderGridItems(images, container) {
  container.innerHTML = '';
  // Keep viewer image list in sync with what's visible
  viewerImageList = images;
  images.forEach((img, i) => {
    const item = createGridItem(img, i, images);
    container.appendChild(item);
  });
}

function createGridItem(img, index, imageList) {
  const item = document.createElement('div');
  item.className = 'grid-item';
  item.style.animationDelay = Math.min(index * 0.04, 0.6) + 's';
  item.dataset.id = img.id;

  const imgEl = document.createElement('img');
  imgEl.loading = 'lazy';
  imgEl.decoding = 'async';
  imgEl.alt = '';

  // Use IntersectionObserver for lazy loading
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        imgEl.src = getBlobUrl(img.blob);
        obs.unobserve(entry.target);
      }
    });
  }, { rootMargin: '200px' });

  const overlay = document.createElement('div');
  overlay.className = 'grid-item-overlay';

  const favBtn = document.createElement('button');
  favBtn.className = 'grid-fav-btn' + (img.favorite ? ' faved' : '');
  favBtn.title = 'Favorite';
  favBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="${img.favorite ? 'currentColor' : 'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  favBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isFav = await HitgramDB.toggleFavorite(img.id);
    img.favorite = isFav;
    favBtn.className = 'grid-fav-btn' + (isFav ? ' faved' : '');
    favBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="${isFav ? 'currentColor' : 'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    showToast(isFav ? '❤️ Added to favorites' : 'Removed from favorites');
  });

  item.appendChild(imgEl);
  item.appendChild(overlay);
  item.appendChild(favBtn);

  observer.observe(item);
  // Pass the imageList so viewer can navigate through all visible images
  item.addEventListener('click', () => openViewer(img, imageList || viewerImageList));

  return item;
}

// ──────────────────── Fullscreen Viewer ────────────────────
let viewerCurrentImage = null;
let viewerCurrentIndex = 0;
let viewerImageList = []; // the full list of images currently shown in grid
let viewerScale = 1;
let viewerPinchDist = null;
let viewerTranslate = { x: 0, y: 0 };
let viewerHeaderTimeout;

// Called from explore page to keep viewer in sync with current grid images
function setViewerImageList(list) {
  viewerImageList = list;
}

function openViewer(img, imageList) {
  if (imageList) viewerImageList = imageList;
  const idx = viewerImageList.findIndex(i => i.id === img.id);
  viewerCurrentIndex = idx >= 0 ? idx : 0;
  viewerCurrentImage = viewerImageList[viewerCurrentIndex] || img;

  _loadViewerImage(viewerCurrentImage, true);

  const viewer = document.getElementById('image-viewer');
  viewer.classList.add('open');
  document.body.style.overflow = 'hidden';
  showViewerHeader();
}

function _loadViewerImage(img, animate) {
  viewerCurrentImage = img;
  const viewerImg = document.getElementById('viewer-img');
  const favBtn = document.getElementById('viewer-fav-btn');
  const counter = document.getElementById('viewer-counter');

  if (viewerImg) {
    if (animate) viewerImg.className = 'viewer-zoom-in';
    else viewerImg.className = '';
    viewerImg.src = getBlobUrl(img.blob);
  }

  viewerScale = 1;
  viewerTranslate = { x: 0, y: 0 };
  applyViewerTransform();

  if (favBtn) {
    favBtn.className = 'viewer-action-btn' + (img.favorite ? ' faved' : '');
    favBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="${img.favorite ? 'currentColor' : 'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  }

  if (counter && viewerImageList.length > 0) {
    counter.textContent = `${viewerCurrentIndex + 1} / ${viewerImageList.length}`;
  }

  _updateNavButtons();
  _updateDots();
}

function _updateNavButtons() {
  const prevBtn = document.getElementById('viewer-prev');
  const nextBtn = document.getElementById('viewer-next');
  if (!prevBtn || !nextBtn) return;

  if (viewerCurrentIndex <= 0) {
    prevBtn.classList.add('disabled');
  } else {
    prevBtn.classList.remove('disabled');
  }

  if (viewerCurrentIndex >= viewerImageList.length - 1) {
    nextBtn.classList.add('disabled');
  } else {
    nextBtn.classList.remove('disabled');
  }
}

function _updateDots() {
  const dotsEl = document.getElementById('viewer-dots');
  if (!dotsEl) return;
  const total = viewerImageList.length;
  // Only show dots if ≤ 20 images, otherwise skip (performance)
  if (total > 20 || total <= 1) { dotsEl.innerHTML = ''; return; }
  dotsEl.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'viewer-dot' + (i === viewerCurrentIndex ? ' active' : '');
    dotsEl.appendChild(dot);
  }
}

function navigateViewer(direction) {
  // direction: -1 = prev, +1 = next
  const newIdx = viewerCurrentIndex + direction;
  if (newIdx < 0 || newIdx >= viewerImageList.length) return;
  viewerCurrentIndex = newIdx;

  const viewerImg = document.getElementById('viewer-img');
  if (viewerImg) {
    // Slide animation
    viewerImg.style.transition = 'transform 0.2s ease, opacity 0.15s ease';
    viewerImg.style.transform = `translateX(${direction > 0 ? '-60px' : '60px'}) scale(0.92)`;
    viewerImg.style.opacity = '0';
    setTimeout(() => {
      viewerImg.style.transition = 'none';
      viewerImg.style.transform = `translateX(${direction > 0 ? '60px' : '-60px'}) scale(0.92)`;
      viewerImg.style.opacity = '0';
      _loadViewerImage(viewerImageList[viewerCurrentIndex], false);
      requestAnimationFrame(() => {
        viewerImg.style.transition = 'transform 0.25s cubic-bezier(0.34,1.2,0.64,1), opacity 0.2s ease';
        viewerImg.style.transform = 'translateX(0) scale(1)';
        viewerImg.style.opacity = '1';
        setTimeout(() => { viewerImg.style.transition = ''; }, 280);
      });
    }, 160);
  }

  showViewerHeader();
}

function closeViewer() {
  const viewer = document.getElementById('image-viewer');
  viewer.classList.remove('open');
  document.body.style.overflow = '';
  viewerCurrentImage = null;
  clearTimeout(viewerHeaderTimeout);
}

function applyViewerTransform() {
  const img = document.getElementById('viewer-img');
  if (!img) return;
  img.style.transform = `translate(${viewerTranslate.x}px, ${viewerTranslate.y}px) scale(${viewerScale})`;
}

function showViewerHeader() {
  const header = document.querySelector('.viewer-header');
  const footer = document.querySelector('.viewer-footer');
  const navBtns = document.querySelectorAll('.viewer-nav-btn');
  if (header) header.classList.remove('hidden');
  if (footer) footer.classList.remove('hidden');
  navBtns.forEach(b => b.style.opacity = '');
  clearTimeout(viewerHeaderTimeout);
  viewerHeaderTimeout = setTimeout(() => {
    if (header) header.classList.add('hidden');
    if (footer) footer.classList.add('hidden');
  }, 3500);
}

function initViewer() {
  const viewer = document.getElementById('image-viewer');
  if (!viewer) return;
  const imgWrap = viewer.querySelector('.viewer-img-wrap');
  const viewerImg = document.getElementById('viewer-img');
  const closeBtn = document.getElementById('viewer-close');
  const favBtn = document.getElementById('viewer-fav-btn');
  const downloadBtn = document.getElementById('viewer-download-btn');
  const prevBtn = document.getElementById('viewer-prev');
  const nextBtn = document.getElementById('viewer-next');

  closeBtn.addEventListener('click', closeViewer);

  // Gallery prev/next buttons
  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateViewer(-1); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateViewer(+1); });

  // Tap image area (not on nav buttons) to show/hide header
  imgWrap.addEventListener('click', (e) => {
    if (e.target.closest('.viewer-nav-btn')) return;
    showViewerHeader();
  });

  // Favorite
  if (favBtn) {
    favBtn.addEventListener('click', async () => {
      if (!viewerCurrentImage) return;
      const isFav = await HitgramDB.toggleFavorite(viewerCurrentImage.id);
      viewerCurrentImage.favorite = isFav;
      // Also update in list
      const listImg = viewerImageList.find(i => i.id === viewerCurrentImage.id);
      if (listImg) listImg.favorite = isFav;
      favBtn.className = 'viewer-action-btn' + (isFav ? ' faved' : '');
      favBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="${isFav ? 'currentColor' : 'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
      const gridItem = document.querySelector(`.grid-item[data-id="${viewerCurrentImage.id}"] .grid-fav-btn`);
      if (gridItem) {
        gridItem.className = 'grid-fav-btn' + (isFav ? ' faved' : '');
        gridItem.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="${isFav ? 'currentColor' : 'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
      }
      showToast(isFav ? '❤️ Added to favorites' : 'Removed from favorites');
    });
  }

  // Download
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!viewerCurrentImage) return;
      const url = getBlobUrl(viewerCurrentImage.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hitgram-image-' + Date.now() + '.' + (viewerCurrentImage.blob.type.split('/')[1] || 'jpg');
      a.click();
      showToast('Image saved!', 'success');
    });
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!viewer.classList.contains('open')) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowLeft') navigateViewer(-1);
    if (e.key === 'ArrowRight') navigateViewer(+1);
  });

  // ── Touch gestures ──
  let touchStartY = 0;
  let touchStartX = 0;
  let touchStartTime = 0;
  let isVerticalSwipe = false;
  let isHorizontalSwipe = false;
  let swipeCommitted = false;

  imgWrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
      touchStartTime = Date.now();
      isVerticalSwipe = false;
      isHorizontalSwipe = false;
      swipeCommitted = false;
      viewerPinchDist = null;
      viewerImg.style.transition = 'none';
    } else if (e.touches.length === 2) {
      viewerPinchDist = getTouchDist(e.touches);
      isVerticalSwipe = false;
      isHorizontalSwipe = false;
      viewerImg.style.transition = 'none';
    }
  }, { passive: true });

  imgWrap.addEventListener('touchmove', (e) => {
    // Pinch zoom
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      if (viewerPinchDist) {
        const delta = dist / viewerPinchDist;
        viewerScale = Math.min(Math.max(viewerScale * delta, 0.5), 5);
        viewerPinchDist = dist;
        applyViewerTransform();
      }
      return;
    }

    if (e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - touchStartY;
    const dx = e.touches[0].clientX - touchStartX;

    // Commit gesture direction once
    if (!swipeCommitted && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      swipeCommitted = true;
      isVerticalSwipe = Math.abs(dy) > Math.abs(dx);
      isHorizontalSwipe = !isVerticalSwipe;
    }

    // Vertical swipe down to close (only when not zoomed)
    if (isVerticalSwipe && viewerScale <= 1) {
      if (dy > 0) {
        e.preventDefault();
        const progress = Math.min(dy / 220, 1);
        viewer.style.opacity = 1 - progress * 0.65;
        viewer.style.transform = `translateY(${dy * 0.45}px)`;
      }
      return;
    }

    // Horizontal swipe for gallery navigation (only when not zoomed)
    if (isHorizontalSwipe && viewerScale <= 1) {
      e.preventDefault();
      // Live drag preview
      const maxDrag = 120;
      const clampedDx = Math.max(-maxDrag, Math.min(maxDrag, dx));
      viewerImg.style.transform = `translateX(${clampedDx}px) scale(${1 - Math.abs(clampedDx) / 800})`;
      return;
    }
  }, { passive: false });

  imgWrap.addEventListener('touchend', (e) => {
    viewerPinchDist = null;
    viewerImg.style.transition = '';

    if (!swipeCommitted) {
      // It was a tap
      const elapsed = Date.now() - touchStartTime;
      if (elapsed < 250) {
        const now = Date.now();
        if (now - (imgWrap._lastTap || 0) < 350) {
          // Double tap: toggle zoom
          if (viewerScale > 1) {
            viewerScale = 1;
            viewerTranslate = { x: 0, y: 0 };
          } else {
            viewerScale = 2.5;
          }
          applyViewerTransform();
        } else {
          showViewerHeader();
        }
        imgWrap._lastTap = now;
      }
      return;
    }

    const dy = e.changedTouches[0].clientY - touchStartY;
    const dx = e.changedTouches[0].clientX - touchStartX;

    if (isVerticalSwipe) {
      viewer.style.opacity = '';
      viewer.style.transform = '';
      if (dy > 100) {
        closeViewer();
      }
    } else if (isHorizontalSwipe && viewerScale <= 1) {
      // Horizontal swipe threshold: 60px or fast flick
      const elapsed = Date.now() - touchStartTime;
      const velocity = Math.abs(dx) / elapsed;
      const shouldNav = Math.abs(dx) > 60 || velocity > 0.4;

      if (shouldNav) {
        viewerImg.style.transform = '';
        if (dx < 0) navigateViewer(+1); // swipe left → next
        else navigateViewer(-1);        // swipe right → prev
      } else {
        // Snap back
        viewerImg.style.transition = 'transform 0.25s ease';
        viewerImg.style.transform = 'translateX(0) scale(1)';
        setTimeout(() => { viewerImg.style.transition = ''; viewerImg.style.transform = ''; }, 260);
      }
    }
  }, { passive: true });
}

function getTouchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ──────────────────── Upload Handler ────────────────────
function initUploadModal() {
  const addBtn = document.getElementById('btn-add');
  const modal = document.getElementById('upload-modal');
  const dropZone = document.getElementById('upload-drop-zone');
  const fileInput = document.getElementById('file-input');
  const progressWrap = document.getElementById('upload-progress-wrap');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressText = document.getElementById('upload-progress-text');

  if (!addBtn || !modal) return;

  addBtn.addEventListener('click', () => modal.classList.add('open'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    processFiles(Array.from(e.dataTransfer.files));
  });

  fileInput.addEventListener('change', () => {
    processFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });

  async function processFiles(files) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) { showToast('Please select image files', 'error'); return; }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const validFiles = imageFiles.filter(f => {
      if (f.size > MAX_SIZE) { showToast(`${f.name} is too large (max 10MB)`, 'error'); return false; }
      return true;
    });

    if (!validFiles.length) return;

    const count = await HitgramDB.getImageCount();
    const remaining = HitgramDB.MAX_IMAGES - count;
    if (remaining <= 0) {
      showToast(`Storage full! Max ${HitgramDB.MAX_IMAGES} images`, 'error');
      return;
    }

    const toProcess = validFiles.slice(0, remaining);
    progressWrap.classList.add('active');
    let done = 0;

    for (const file of toProcess) {
      try {
        await HitgramDB.addImage(file, []);
        done++;
        const pct = Math.round((done / toProcess.length) * 100);
        progressBar.style.width = pct + '%';
        progressText.textContent = `Uploading ${done} / ${toProcess.length}...`;
      } catch (e) {
        console.error('Upload error:', e);
      }
    }

    setTimeout(() => {
      progressWrap.classList.remove('active');
      progressBar.style.width = '0%';
      modal.classList.remove('open');
      showToast(`✅ Added ${done} image${done !== 1 ? 's' : ''}!`, 'success');
      // Reload grid
      if (window.loadExploreGrid) window.loadExploreGrid();
    }, 600);
  }
}

// ──────────────────── PWA Install Banner ────────────────────
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!localStorage.getItem('hitgram-install-dismissed')) {
    setTimeout(() => {
      const banner = document.getElementById('install-banner');
      if (banner) banner.classList.add('show');
    }, 3000);
  }
});

function initInstallBanner() {
  const banner = document.getElementById('install-banner');
  const installBtn = document.getElementById('install-btn');
  const dismissBtn = document.getElementById('install-dismiss');
  if (!banner) return;

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      banner.classList.remove('show');
      if (outcome === 'accepted') showToast('🎉 Hitgram installed!', 'success');
    });
  }
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      banner.classList.remove('show');
      localStorage.setItem('hitgram-install-dismissed', '1');
    });
  }
}

window.HitgramApp = { showToast, getBlobUrl, renderGridItems, createGridItem, initViewer, initUploadModal, initInstallBanner, closeViewer, openViewer, setViewerImageList, navigateViewer };

