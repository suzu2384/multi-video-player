(() => {
  const grid = document.getElementById('videoGrid');
  const columnCount = document.getElementById('columnCount');
  const fileInput = document.getElementById('fileInput');
  const pairSettings = document.getElementById('pairSettings');
  if (!grid) return;

  const style = document.createElement('style');
  style.textContent = `
    #videoGrid.pair-mode .pair-move-controls {
      display: none !important;
    }

    .pair-center-swap-layer {
      position: absolute;
      inset: 0;
      z-index: 140;
      pointer-events: none;
    }
    .pair-center-swap-button {
      position: absolute;
      transform: translate(-50%, -50%);
      width: 38px;
      height: 38px;
      padding: 0 !important;
      border: 1px solid #6b7788;
      border-radius: 50%;
      background: rgba(24,28,35,.94);
      color: #fff;
      box-shadow: 0 2px 10px rgba(0,0,0,.45);
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .pair-center-swap-button img {
      display: block;
      width: 22px;
      height: 22px;
      pointer-events: none;
    }
    .pair-center-swap-button:disabled {
      opacity: .35;
      cursor: default;
    }

    .pair-settings {
      margin: 12px auto 14px !important;
    }
    .pair-settings .pair-settings-group {
      display: inline-flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      gap: 10px 14px !important;
    }
    .pair-settings .pair-size-group {
      flex: 0 1 auto !important;
    }
    .pair-settings .pair-export-group {
      flex: 1 1 auto !important;
      justify-content: flex-end !important;
      margin-left: auto !important;
    }
    .pair-settings .pair-settings-separator {
      display: inline-block !important;
      width: 1px !important;
      height: 32px !important;
      flex: 0 0 auto !important;
      background: #3b4554 !important;
    }
    .pair-settings .export-progress {
      flex-basis: 100% !important;
    }
    @media (max-width: 760px) {
      .pair-settings .pair-export-group {
        justify-content: flex-start !important;
        margin-left: 0 !important;
      }
      .pair-settings .pair-settings-separator {
        width: 100% !important;
        height: 1px !important;
      }
    }

    .controls-drawer {
      position: relative;
      order: 2 !important;
      margin-top: 8px;
      border: 1px solid #3b4554;
      border-radius: 8px;
      background: #14181f;
      overflow: visible;
    }
    .controls-drawer-toggle {
      width: 100%;
      padding: 8px 10px;
      border: 0;
      background: transparent;
      color: #d4dae3;
      text-align: left;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .controls-drawer-toggle::after {
      content: '▼';
      float: right;
      font-size: 10px;
      transition: transform .16s ease;
    }
    .controls-drawer.open .controls-drawer-toggle::after { transform: rotate(180deg); }
    .controls-drawer-content {
      display: none;
      background: #14181f;
    }
    .controls-drawer.open .controls-drawer-content { display: block; }
    .controls-drawer-content > .video-controls,
    .controls-drawer-content > .crop-controls {
      margin: 0 !important;
      padding: 8px 10px !important;
    }
    .controls-drawer-content > .crop-controls {
      border-top: 1px solid #303641 !important;
    }
    .video-grid .crop-controls .section-icon { display: none !important; }

    body.pair-view .video-grid.pair-mode .video-info {
      display: flex !important;
      flex-direction: column !important;
    }
    body.pair-view .video-grid.pair-mode .title-row {
      order: 0 !important;
    }
    body.pair-view .video-grid.pair-mode .time-row {
      order: 1 !important;
      margin-top: 8px !important;
    }
    body.pair-view .video-grid.pair-mode .video-controls,
    body.pair-view .video-grid.pair-mode .crop-controls {
      order: 3 !important;
    }

    body.pair-view .video-card.drawer-open,
    body.pair-view .video-card.drawer-open .video-info,
    body.pair-view .video-card.drawer-open .controls-drawer {
      position: relative;
      z-index: 80 !important;
      overflow: visible !important;
    }
    body.pair-view .controls-drawer.open .controls-drawer-content {
      position: absolute;
      left: -1px;
      right: -1px;
      top: calc(100% + 4px);
      z-index: 100;
      max-height: min(62vh, 520px);
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      border: 1px solid #3b4554;
      border-radius: 8px;
      background: #14181f;
      box-shadow: 0 10px 28px rgba(0,0,0,.55);
    }
    body.pair-view .video-grid.pair-mode { overflow: visible !important; }
    body.pair-view main { overflow: auto !important; }

    .controls-drawer-content .video-controls {
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 8px !important;
    }
    .controls-drawer-content .video-controls label {
      display: grid !important;
      grid-template-columns: 30px minmax(0,1fr) auto !important;
      align-items: center !important;
      width: 100% !important;
    }
    .controls-drawer-content .crop-controls {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 8px !important;
    }
    .controls-drawer-content .crop-controls .icon-field {
      display: grid !important;
      grid-template-columns: 30px minmax(0,1fr) 72px 34px !important;
      align-items: center !important;
      width: 100% !important;
    }
  `;
  document.head.appendChild(style);

  let scheduled = false;
  let columnsManuallySet = false;
  let swapLayer = null;

  const ensurePairSettingsPlacement = () => {
    if (!pairSettings || !grid.parentElement) return;
    if (grid.nextElementSibling !== pairSettings) {
      grid.parentElement.insertBefore(pairSettings, grid.nextSibling);
    }
    if (grid.classList.contains('pair-mode')) {
      const width = Math.round(grid.getBoundingClientRect().width);
      if (width > 0) {
        pairSettings.style.width = `${width}px`;
        pairSettings.style.maxWidth = '100%';
      }
    } else {
      pairSettings.style.removeProperty('width');
      pairSettings.style.removeProperty('max-width');
    }
  };

  const ensurePairSettingsLayout = () => {
    if (!pairSettings) return;
    ensurePairSettingsPlacement();
    if (pairSettings.dataset.grouped === 'true') return;
    const sizeIcon = pairSettings.querySelector(':scope > .section-icon');
    const pairWidthInput = document.getElementById('pairWidth');
    const pairHeightInput = document.getElementById('pairHeight');
    const resetPairSize = document.getElementById('resetPairSize');
    const exportCodec = document.getElementById('exportCodec');
    const exportBitrate = document.getElementById('exportBitrate');
    const exportPair = document.getElementById('exportPair');
    const exportProgress = document.getElementById('exportProgress');
    const widthLabel = pairWidthInput?.closest('label');
    const heightLabel = pairHeightInput?.closest('label');
    const codecLabel = exportCodec?.closest('label');
    const bitrateLabel = exportBitrate?.closest('label');
    if (!sizeIcon || !widthLabel || !heightLabel || !resetPairSize || !codecLabel || !bitrateLabel || !exportPair) return;

    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'pair-settings-group pair-size-group';
    sizeGroup.setAttribute('aria-label', '並列動画の表示サイズ設定');
    sizeGroup.append(sizeIcon, widthLabel, heightLabel, resetPairSize);

    const separator = document.createElement('span');
    separator.className = 'pair-settings-separator';
    separator.setAttribute('aria-hidden', 'true');

    const exportGroup = document.createElement('div');
    exportGroup.className = 'pair-settings-group pair-export-group';
    exportGroup.setAttribute('aria-label', '並列動画の書き出し設定');
    exportGroup.append(codecLabel, bitrateLabel, exportPair);

    pairSettings.insertBefore(sizeGroup, exportProgress || null);
    pairSettings.insertBefore(separator, exportProgress || null);
    pairSettings.insertBefore(exportGroup, exportProgress || null);
    pairSettings.dataset.grouped = 'true';
  };

  const isTouchDevice = () => navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const isMobileLayout = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
    || (isTouchDevice() && Math.max(window.innerWidth, window.innerHeight) <= 1024);
  const getMaxColumns = () => !isMobileLayout() ? 6 : (window.innerHeight >= window.innerWidth ? 2 : 3);

  const forceAutomaticColumns = () => {
    if (columnsManuallySet || !columnCount || !grid.classList.contains('multi-mode')) return;
    const count = grid.querySelectorAll('.video-card').length;
    if (!count) return;
    const max = getMaxColumns();
    const desired = Math.min(max, Math.max(1, count));
    if (![...columnCount.options].some(option => Number(option.value) === desired)) {
      columnCount.replaceChildren();
      for (let value = 1; value <= max; value += 1) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = String(value);
        columnCount.appendChild(option);
      }
    }
    columnCount.value = String(desired);
    grid.style.setProperty('--multi-columns', String(desired));
  };

  const createDrawer = (card) => {
    const drawer = document.createElement('div');
    drawer.className = 'controls-drawer';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'controls-drawer-toggle';
    toggle.textContent = '操作';
    toggle.setAttribute('aria-expanded', 'false');
    const content = document.createElement('div');
    content.className = 'controls-drawer-content';
    toggle.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const open = drawer.classList.toggle('open');
      card.classList.toggle('drawer-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) drawer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    drawer.append(toggle, content);
    return drawer;
  };

  const placeAfter = (parent, node, previous) => {
    if (!parent || !node) return;
    parent.insertBefore(node, previous ? previous.nextSibling : parent.firstChild);
  };

  const ensureDrawersAndSeek = () => {
    grid.querySelectorAll('.video-card').forEach(card => {
      const info = card.querySelector('.video-info');
      const frame = card.querySelector('.video-frame');
      if (!info || !frame) return;

      const oldDetails = info.querySelector(':scope > .pair-extra-controls');
      let drawer = info.querySelector(':scope > .controls-drawer');
      const drawerContent = drawer?.querySelector(':scope > .controls-drawer-content');
      let videoControls = info.querySelector(':scope > .video-controls')
        || oldDetails?.querySelector(':scope > .video-controls')
        || drawerContent?.querySelector(':scope > .video-controls');
      let cropControls = info.querySelector(':scope > .crop-controls')
        || oldDetails?.querySelector(':scope > .crop-controls')
        || drawerContent?.querySelector(':scope > .crop-controls');
      let timeRow = info.querySelector(':scope > .time-row')
        || frame.querySelector('.pair-seek-dock > .time-row');
      if (!videoControls || !cropControls || !timeRow) return;

      frame.querySelector(':scope > .pair-seek-dock')?.remove();

      const titleRow = info.querySelector(':scope > .title-row');
      placeAfter(info, timeRow, titleRow);

      if (!drawer) drawer = createDrawer(card);
      placeAfter(info, drawer, timeRow);
      drawer.querySelector('.controls-drawer-content').append(videoControls, cropControls);
      oldDetails?.remove();
    });
  };

  const getSelectedCards = () => [...grid.querySelectorAll('.video-card.pair-selected:not(.hidden-in-pair)')];

  const ensureSwapLayer = () => {
    if (swapLayer?.isConnected) return swapLayer;
    swapLayer = document.createElement('div');
    swapLayer.className = 'pair-center-swap-layer';
    grid.appendChild(swapLayer);
    return swapLayer;
  };

  const clickNativeMove = (sourceIndex, direction) => {
    const cards = getSelectedCards();
    const source = cards[sourceIndex];
    const nativeButton = source?.querySelector(`.pair-move[data-direction="${direction}"]`);
    if (!nativeButton) return;
    const wasDisabled = nativeButton.disabled;
    nativeButton.disabled = false;
    nativeButton.click();
    nativeButton.disabled = wasDisabled;
    requestAnimationFrame(schedule);
    setTimeout(schedule, 80);
  };

  const addCenterSwapButton = (sourceIndex, targetIndex, direction, iconSrc, left, top, label) => {
    const cards = getSelectedCards();
    if (!cards[sourceIndex] || !cards[targetIndex]) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pair-center-swap-button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.style.left = `${left}%`;
    button.style.top = `${top}%`;
    const image = document.createElement('img');
    image.src = iconSrc;
    image.alt = '';
    button.appendChild(image);
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      clickNativeMove(sourceIndex, direction);
    });
    ensureSwapLayer().appendChild(button);
  };

  const renderCenterSwapButtons = () => {
    const layer = ensureSwapLayer();
    layer.replaceChildren();
    const cards = getSelectedCards();
    if (!grid.classList.contains('pair-mode') || cards.length < 2) {
      layer.style.display = 'none';
      return;
    }
    layer.style.display = 'block';
    grid.style.position = 'relative';

    if (cards.length === 2) {
      addCenterSwapButton(0, 1, 'right', 'assets/swap-horizontal-icon.svg', 50, 50, '左右の動画を入れ替える');
      return;
    }

    addCenterSwapButton(0, 1, 'right', 'assets/swap-horizontal-icon.svg', 50, 25, '上段左右の動画を入れ替える');
    addCenterSwapButton(2, 3, 'right', 'assets/swap-horizontal-icon.svg', 50, 75, '下段左右の動画を入れ替える');
    addCenterSwapButton(0, 2, 'down', 'assets/swap-vertical-icon.svg', 25, 50, '左列上下の動画を入れ替える');
    addCenterSwapButton(1, 3, 'down', 'assets/swap-vertical-icon.svg', 75, 50, '右列上下の動画を入れ替える');
  };

  const refresh = () => {
    scheduled = false;
    ensurePairSettingsLayout();
    ensurePairSettingsPlacement();
    ensureDrawersAndSeek();
    renderCenterSwapButtons();
    if (grid.classList.contains('multi-mode')) forceAutomaticColumns();
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  };

  const showVersion = async () => {
    const label = document.createElement('div');
    Object.assign(label.style,{position:'fixed',right:'6px',bottom:'4px',zIndex:'9999',padding:'2px 5px',borderRadius:'4px',background:'rgba(0,0,0,.55)',color:'rgba(255,255,255,.75)',fontSize:'10px',lineHeight:'1.2',whiteSpace:'pre-line',pointerEvents:'none'});
    document.body.appendChild(label);
    try {
      const response = await fetch(`version.txt?t=${Date.now()}`,{cache:'no-store'});
      label.textContent = response.ok ? (await response.text()).trim() : 'version unknown';
    } catch { label.textContent = 'version unknown'; }
  };

  columnCount?.addEventListener('input', () => { columnsManuallySet = true; });
  columnCount?.addEventListener('change', () => { columnsManuallySet = true; });
  new MutationObserver(schedule).observe(grid,{ childList:true, subtree:false, attributes:true, attributeFilter:['class'] });
  window.addEventListener('resize',schedule);
  window.addEventListener('orientationchange',schedule);
  fileInput?.addEventListener('change',() => [0,150,500].forEach(delay => setTimeout(forceAutomaticColumns,delay)));
  ensurePairSettingsLayout();
  ensurePairSettingsPlacement();
  schedule();
  showVersion();
})();
