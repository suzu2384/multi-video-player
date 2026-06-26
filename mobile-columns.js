(() => {
  'use strict';

  const APP_VERSION = '2026.06.26.1';
  const DESKTOP_MAX_COLUMNS = 6;
  const MOBILE_PORTRAIT_MAX_COLUMNS = 2;
  const MOBILE_LANDSCAPE_MAX_COLUMNS = 3;
  const IOS_OR_ANDROID = /iPhone|iPad|iPod|Android/i;

  const columnCount = document.getElementById('columnCount');
  const videoGrid = document.getElementById('videoGrid');
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');

  if (!columnCount || !videoGrid) return;

  const foldStyle = document.createElement('style');
  foldStyle.textContent = `
    .video-grid.multi-mode .video-card {
      grid-column: auto !important;
      grid-row: auto !important;
      order: initial !important;
    }

    .video-grid .pair-extra-controls {
      display: block !important;
      margin-top: 8px;
      border: 1px solid #3b4554;
      border-radius: 8px;
      background: #14181f;
      overflow: hidden;
    }

    .video-grid .pair-extra-controls > summary {
      display: list-item !important;
      padding: 8px 10px;
      color: #d4dae3;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      user-select: none;
    }

    .video-grid .pair-extra-controls[open] > summary {
      border-bottom: 1px solid #303641;
    }

    .video-grid .pair-extra-controls > .video-controls,
    .video-grid .pair-extra-controls > .crop-controls {
      margin: 0 !important;
      padding: 8px 10px !important;
    }

    .video-grid .pair-extra-controls > .crop-controls {
      border-top: 1px solid #303641 !important;
    }

    .video-grid .crop-controls .section-icon {
      display: none !important;
    }

    .drop-zone.mobile-hidden {
      display: none !important;
    }

    body.desktop-multi-drop #dropZone {
      position: fixed !important;
      inset: 52px 12px 52px 12px !important;
      z-index: 45 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      min-height: 0 !important;
      margin: 0 !important;
      opacity: 1;
      pointer-events: auto;
      transition: opacity .12s ease, background .12s ease, border-color .12s ease;
    }

    body.desktop-multi-drop #dropZone .drop-instruction {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      text-align: center !important;
    }

    body.desktop-multi-drop #dropZone .drop-instruction strong,
    body.desktop-multi-drop #dropZone .drop-instruction span {
      display: block !important;
      width: 100% !important;
      text-align: center !important;
    }

    body.desktop-multi-drop.has-videos:not(.desktop-file-dragging) #dropZone {
      opacity: 0 !important;
      pointer-events: none !important;
    }

    body.desktop-multi-drop.desktop-file-dragging #dropZone {
      opacity: 1 !important;
      pointer-events: none !important;
      border: 2px dashed #79aaff !important;
      background: rgba(28, 73, 140, .82) !important;
      backdrop-filter: blur(4px);
      box-shadow: inset 0 0 0 4px rgba(121,170,255,.12);
    }

    body.desktop-multi-drop.desktop-file-dragging #dropZone .drop-instruction,
    body.desktop-multi-drop.desktop-file-dragging #dropZone .file-button {
      opacity: 1 !important;
      visibility: visible !important;
    }

    body:not(.desktop-multi-drop) #dropZone.desktop-hidden {
      display: none !important;
    }

    .mobile-add-video {
      position: fixed;
      left: 14px;
      bottom: calc(var(--toolbar-height, 138px) + 14px);
      z-index: 60;
      display: none;
      align-items: center;
      justify-content: center;
      width: 54px;
      height: 54px;
      padding: 0;
      border: 1px solid #6ea8ff;
      border-radius: 50%;
      background: #2f6feb;
      color: #fff;
      font-size: 32px;
      font-weight: 400;
      line-height: 1;
      box-shadow: 0 6px 20px rgba(0,0,0,.42);
    }

    .mobile-add-video.visible {
      display: inline-flex;
    }
  `;
  document.head.appendChild(foldStyle);

  const showVersion = () => {
    const versionLabel = document.createElement('div');
    versionLabel.textContent = `v${APP_VERSION}`;
    versionLabel.title = '読み込まれているアプリのバージョン';
    Object.assign(versionLabel.style, {
      position: 'fixed',
      right: '6px',
      bottom: '4px',
      zIndex: '9999',
      padding: '2px 5px',
      borderRadius: '4px',
      background: 'rgba(0, 0, 0, 0.55)',
      color: 'rgba(255, 255, 255, 0.75)',
      fontSize: '10px',
      lineHeight: '1.2',
      pointerEvents: 'none'
    });
    document.body.appendChild(versionLabel);
  };

  const isTouchDevice = () => navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const isMobileLayout = () => {
    const userAgent = navigator.userAgent || '';
    const isMobileUserAgent = IOS_OR_ANDROID.test(userAgent);
    const isNarrowTouchScreen = isTouchDevice() && Math.min(window.innerWidth, window.innerHeight) <= 767;
    const isTabletLikeTouchScreen = isTouchDevice() && Math.max(window.innerWidth, window.innerHeight) <= 1024;
    return isMobileUserAgent || isNarrowTouchScreen || isTabletLikeTouchScreen;
  };

  const getMaxColumns = () => {
    if (!isMobileLayout()) return DESKTOP_MAX_COLUMNS;
    return window.innerHeight >= window.innerWidth
      ? MOBILE_PORTRAIT_MAX_COLUMNS
      : MOBILE_LANDSCAPE_MAX_COLUMNS;
  };

  const rebuildColumnOptions = maxColumns => {
    const videoCount = videoGrid.querySelectorAll('.video-card').length;
    const fallbackColumns = Math.min(maxColumns, Math.max(1, videoCount));
    const selectedColumns = Number(columnCount.value);
    const currentColumns = Math.min(
      maxColumns,
      Math.max(1, Number.isFinite(selectedColumns) && selectedColumns > 0 ? selectedColumns : fallbackColumns)
    );

    columnCount.replaceChildren();
    for (let count = 1; count <= maxColumns; count += 1) {
      const option = document.createElement('option');
      option.value = String(count);
      option.textContent = String(count);
      columnCount.appendChild(option);
    }
    columnCount.value = String(currentColumns);
    return currentColumns;
  };

  const clampColumns = () => {
    const maxColumns = getMaxColumns();
    const columns = rebuildColumnOptions(maxColumns);
    videoGrid.style.setProperty('--multi-columns', String(columns));
  };

  const fixTwoVideoPairLayout = () => {
    if (!videoGrid.classList.contains('pair-count-2')) return;
    videoGrid.querySelectorAll('.pair-left, .pair-right').forEach(card => {
      card.classList.remove('pair-top-left', 'pair-top-right', 'pair-bottom-left', 'pair-bottom-right');
    });
  };

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'mobile-add-video';
  addButton.textContent = '+';
  addButton.title = '動画を追加';
  addButton.setAttribute('aria-label', '動画を追加');
  addButton.addEventListener('click', () => fileInput?.click());
  document.body.appendChild(addButton);

  const refreshResponsiveUi = () => {
    const mobile = isMobileLayout();
    const multiMode = videoGrid.classList.contains('multi-mode');
    const hasVideos = videoGrid.querySelector('.video-card') !== null;

    addButton.classList.toggle('visible', Boolean(fileInput) && mobile && multiMode);
    dropZone?.classList.toggle('mobile-hidden', mobile);
    dropZone?.classList.toggle('desktop-hidden', !mobile && !multiMode);
    document.body.classList.toggle('desktop-multi-drop', !mobile && multiMode);
    document.body.classList.toggle('has-videos', hasVideos);

    if (mobile || !multiMode) {
      document.body.classList.remove('desktop-file-dragging');
    }
  };

  const refreshMobileLayout = () => {
    clampColumns();
    fixTwoVideoPairLayout();
    refreshResponsiveUi();
  };

  const scheduleClamp = () => {
    window.requestAnimationFrame(() => {
      refreshMobileLayout();
      window.setTimeout(refreshMobileLayout, 0);
      window.setTimeout(refreshMobileLayout, 250);
    });
  };

  let dragDepth = 0;
  const hasDraggedFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');

  document.addEventListener('dragenter', event => {
    if (isMobileLayout() || !videoGrid.classList.contains('multi-mode') || !hasDraggedFiles(event)) return;
    dragDepth += 1;
    document.body.classList.add('desktop-file-dragging');
  }, true);

  document.addEventListener('dragleave', event => {
    if (!document.body.classList.contains('desktop-file-dragging')) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) document.body.classList.remove('desktop-file-dragging');
  }, true);

  document.addEventListener('drop', () => {
    dragDepth = 0;
    document.body.classList.remove('desktop-file-dragging');
  }, true);

  window.addEventListener('blur', () => {
    dragDepth = 0;
    document.body.classList.remove('desktop-file-dragging');
  });

  columnCount.addEventListener('input', scheduleClamp);
  columnCount.addEventListener('change', scheduleClamp);
  window.addEventListener('resize', scheduleClamp);
  window.addEventListener('orientationchange', scheduleClamp);
  window.addEventListener('pageshow', scheduleClamp);
  document.addEventListener('visibilitychange', scheduleClamp);
  document.addEventListener('click', event => {
    if (event.target.closest('#pairModeButton, #multiModeButton, .pair-move')) scheduleClamp();
  });
  if (fileInput) fileInput.addEventListener('change', scheduleClamp);

  new MutationObserver(scheduleClamp).observe(videoGrid, {
    childList: true,
    subtree: false,
    attributes: true,
    attributeFilter: ['class']
  });
  showVersion();
  scheduleClamp();
})();
