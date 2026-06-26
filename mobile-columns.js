(() => {
  'use strict';

  const DESKTOP_MAX_COLUMNS = 6;
  const MOBILE_PORTRAIT_MAX_COLUMNS = 2;
  const MOBILE_LANDSCAPE_MAX_COLUMNS = 3;

  const columnCount = document.getElementById('columnCount');
  const videoGrid = document.getElementById('videoGrid');
  const fileInput = document.getElementById('fileInput');

  if (!columnCount || !videoGrid) return;

  const isMobileLayout = () => window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 1024px)').matches;

  const getMaxColumns = () => {
    if (!isMobileLayout()) return DESKTOP_MAX_COLUMNS;
    return window.innerHeight > window.innerWidth
      ? MOBILE_PORTRAIT_MAX_COLUMNS
      : MOBILE_LANDSCAPE_MAX_COLUMNS;
  };

  const rebuildColumnOptions = maxColumns => {
    const values = [...columnCount.options].map(option => Number(option.value));
    const alreadyMatches = values.length === maxColumns && values.every((value, index) => value === index + 1);
    if (alreadyMatches) return;

    columnCount.replaceChildren();
    for (let count = 1; count <= maxColumns; count += 1) {
      const option = document.createElement('option');
      option.value = String(count);
      option.textContent = String(count);
      columnCount.appendChild(option);
    }
  };

  const clampColumns = () => {
    const maxColumns = getMaxColumns();
    const currentColumns = Math.min(maxColumns, Math.max(1, Number(columnCount.value) || 1));
    rebuildColumnOptions(maxColumns);
    columnCount.value = String(currentColumns);
    videoGrid.style.setProperty('--multi-columns', String(currentColumns));
  };

  const scheduleClamp = () => window.requestAnimationFrame(clampColumns);

  columnCount.addEventListener('input', scheduleClamp);
  columnCount.addEventListener('change', scheduleClamp);
  window.addEventListener('resize', scheduleClamp);
  window.addEventListener('orientationchange', scheduleClamp);
  if (fileInput) fileInput.addEventListener('change', () => window.setTimeout(clampColumns, 0));

  new MutationObserver(scheduleClamp).observe(videoGrid, { childList: true });
  clampColumns();
})();
