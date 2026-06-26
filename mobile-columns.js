(() => {
  'use strict';

  const DESKTOP_MAX_COLUMNS = 6;
  const MOBILE_PORTRAIT_MAX_COLUMNS = 2;
  const MOBILE_LANDSCAPE_MAX_COLUMNS = 3;
  const IOS_OR_ANDROID = /iPhone|iPad|iPod|Android/i;

  const columnCount = document.getElementById('columnCount');
  const videoGrid = document.getElementById('videoGrid');
  const fileInput = document.getElementById('fileInput');

  if (!columnCount || !videoGrid) return;

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
    const currentColumns = Math.min(maxColumns, Math.max(1, Number(columnCount.value) || 1));
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

  const scheduleClamp = () => {
    window.requestAnimationFrame(() => {
      clampColumns();
      window.setTimeout(clampColumns, 0);
      window.setTimeout(clampColumns, 250);
    });
  };

  columnCount.addEventListener('input', scheduleClamp);
  columnCount.addEventListener('change', scheduleClamp);
  window.addEventListener('resize', scheduleClamp);
  window.addEventListener('orientationchange', scheduleClamp);
  window.addEventListener('pageshow', scheduleClamp);
  document.addEventListener('visibilitychange', scheduleClamp);
  if (fileInput) fileInput.addEventListener('change', scheduleClamp);

  new MutationObserver(scheduleClamp).observe(videoGrid, { childList: true, subtree: false });
  scheduleClamp();
})();
