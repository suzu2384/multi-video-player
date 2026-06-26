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

  if (!columnCount || !videoGrid) return;

  const foldStyle = document.createElement('style');
  foldStyle.textContent = `
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

  const refreshMobileLayout = () => {
    clampColumns();
    fixTwoVideoPairLayout();
  };

  const scheduleClamp = () => {
    window.requestAnimationFrame(() => {
      refreshMobileLayout();
      window.setTimeout(refreshMobileLayout, 0);
      window.setTimeout(refreshMobileLayout, 250);
    });
  };

  columnCount.addEventListener('input', scheduleClamp);
  columnCount.addEventListener('change', scheduleClamp);
  window.addEventListener('resize', scheduleClamp);
  window.addEventListener('orientationchange', scheduleClamp);
  window.addEventListener('pageshow', scheduleClamp);
  document.addEventListener('visibilitychange', scheduleClamp);
  document.addEventListener('click', event => {
    if (event.target.closest('#pairModeButton, .pair-move')) scheduleClamp();
  });
  if (fileInput) fileInput.addEventListener('change', scheduleClamp);

  new MutationObserver(scheduleClamp).observe(videoGrid, { childList: true, subtree: false });
  showVersion();
  scheduleClamp();
})();
