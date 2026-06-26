(() => {
  const grid = document.getElementById('videoGrid');
  const columnCount = document.getElementById('columnCount');
  const fileInput = document.getElementById('fileInput');
  if (!grid) return;

  const supportStyle = document.createElement('style');
  supportStyle.textContent = `
    .controls-drawer {
      margin-top: 8px;
      border: 1px solid #3b4554;
      border-radius: 8px;
      background: #14181f;
      overflow: hidden;
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

    .controls-drawer.open .controls-drawer-toggle::after {
      transform: rotate(180deg);
    }

    .controls-drawer-content {
      max-height: 0;
      overflow: hidden;
      opacity: 0;
      transition: max-height .2s ease, opacity .16s ease;
    }

    .controls-drawer.open .controls-drawer-content {
      max-height: 720px;
      opacity: 1;
      border-top: 1px solid #303641;
    }

    .controls-drawer-content > .video-controls,
    .controls-drawer-content > .crop-controls {
      margin: 0 !important;
      padding: 8px 10px !important;
    }

    .controls-drawer-content > .crop-controls {
      border-top: 1px solid #303641 !important;
    }

    .video-grid .crop-controls .section-icon {
      display: none !important;
    }

    body.pair-view.drawer-expanded,
    body.pair-view.drawer-expanded main {
      overflow: auto !important;
      height: auto !important;
      min-height: 100vh;
    }

    body.pair-view.drawer-expanded .video-grid.pair-mode,
    body.pair-view.drawer-expanded .video-grid.pair-mode .video-card,
    body.pair-view.drawer-expanded .video-grid.pair-mode .video-info {
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
    }

    @media (max-width: 920px) {
      .video-grid .controls-drawer-content .video-controls {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 8px !important;
      }

      .video-grid .controls-drawer-content .video-controls label {
        display: grid !important;
        grid-template-columns: 30px minmax(0, 1fr) auto !important;
        align-items: center !important;
        width: 100% !important;
      }

      .video-grid .controls-drawer-content .crop-controls {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        gap: 8px !important;
      }

      .video-grid .controls-drawer-content .crop-controls .icon-field {
        display: grid !important;
        grid-template-columns: 30px minmax(0, 1fr) 48px 28px !important;
        align-items: center !important;
        width: 100% !important;
      }
    }
  `;
  document.head.appendChild(supportStyle);

  const POSITION_CLASSES = [
    'pair-top-left',
    'pair-top-right',
    'pair-bottom-left',
    'pair-bottom-right'
  ];

  let knownCards = [];
  let slots = [];
  let scheduled = false;
  let swapLayer = null;

  const isTouchDevice = () => navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const isMobileLayout = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
    || (isTouchDevice() && Math.max(window.innerWidth, window.innerHeight) <= 1024);

  const getMaxColumns = () => {
    if (!isMobileLayout()) return 6;
    return window.innerHeight >= window.innerWidth ? 2 : 3;
  };

  const forceAutomaticColumns = () => {
    if (!columnCount || !grid.classList.contains('multi-mode')) return;
    const videoCount = grid.querySelectorAll('.video-card').length;
    if (videoCount === 0) return;

    const maxColumns = getMaxColumns();
    const desiredColumns = Math.min(maxColumns, Math.max(1, videoCount));
    const optionExists = [...columnCount.options].some(option => Number(option.value) === desiredColumns);

    if (!optionExists) {
      columnCount.replaceChildren();
      for (let count = 1; count <= maxColumns; count += 1) {
        const option = document.createElement('option');
        option.value = String(count);
        option.textContent = String(count);
        columnCount.appendChild(option);
      }
    }

    columnCount.value = String(desiredColumns);
    grid.style.setProperty('--multi-columns', String(desiredColumns));
  };

  const ensureControlDrawers = () => {
    grid.querySelectorAll('.video-card').forEach(card => {
      const info = card.querySelector('.video-info');
      if (!info) return;

      const oldDetails = info.querySelector(':scope > .pair-extra-controls');
      let videoControls = info.querySelector(':scope > .video-controls');
      let cropControls = info.querySelector(':scope > .crop-controls');
      const timeRow = info.querySelector(':scope > .time-row');

      if (oldDetails) {
        videoControls = oldDetails.querySelector(':scope > .video-controls') || videoControls;
        cropControls = oldDetails.querySelector(':scope > .crop-controls') || cropControls;
      }

      if (!videoControls || !cropControls || !timeRow) return;

      let drawer = info.querySelector(':scope > .controls-drawer');
      if (!drawer) {
        drawer = document.createElement('div');
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
          document.body.classList.toggle(
            'drawer-expanded',
            Boolean(grid.querySelector('.video-card.drawer-open'))
          );
          window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
        });

        drawer.append(toggle, content);
        info.insertBefore(drawer, timeRow);
      }

      drawer.querySelector('.controls-drawer-content').append(videoControls, cropControls);
      oldDetails?.remove();
    });
  };

  const getSelectedCards = () => [...grid.querySelectorAll('.video-card.pair-selected:not(.hidden-in-pair)')];

  const hasSameCards = cards => (
    cards.length === knownCards.length && cards.every(card => knownCards.includes(card))
  );

  const initializeSlots = cards => {
    knownCards = cards;

    if (cards.length === 2) {
      const left = cards.find(card => card.classList.contains('pair-left')) || cards[0];
      const right = cards.find(card => card !== left && card.classList.contains('pair-right'))
        || cards.find(card => card !== left)
        || null;
      slots = [left, right];
      return;
    }

    slots = new Array(4).fill(null);
    cards.forEach(card => {
      const position = POSITION_CLASSES.findIndex(className => card.classList.contains(className));
      if (position >= 0 && !slots[position]) slots[position] = card;
    });
    cards.forEach(card => {
      if (slots.includes(card)) return;
      const emptyIndex = slots.indexOf(null);
      if (emptyIndex >= 0) slots[emptyIndex] = card;
    });
  };

  const applySlotClasses = cards => {
    cards.forEach(card => {
      card.classList.remove('pair-left', 'pair-right', ...POSITION_CLASSES);
      card.style.removeProperty('grid-column');
      card.style.removeProperty('grid-row');
      card.style.removeProperty('order');
    });

    if (cards.length === 2) {
      if (slots[0]) slots[0].classList.add('pair-left');
      if (slots[1]) slots[1].classList.add('pair-right');
      return;
    }

    slots.forEach((card, index) => {
      if (!card) return;
      card.classList.add(POSITION_CLASSES[index]);
      card.style.gridColumn = String((index % 2) + 1);
      card.style.gridRow = String(Math.floor(index / 2) + 1);
      card.style.order = String(index);
    });
  };

  const getSwapLayer = () => {
    if (swapLayer?.isConnected) return swapLayer;
    swapLayer = document.createElement('div');
    swapLayer.className = 'pair-center-swap-layer';
    Object.assign(swapLayer.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '30',
      pointerEvents: 'none'
    });
    grid.appendChild(swapLayer);
    return swapLayer;
  };

  const createSwapButton = ({ from, to, symbol, left, top }) => {
    if (!slots[from] && !slots[to]) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = symbol;
    button.title = slots[from] && slots[to] ? '動画を入れ替える' : '空いている位置へ移動する';
    button.setAttribute('aria-label', button.title);
    Object.assign(button.style, {
      position: 'absolute',
      left: `${left}%`,
      top: `${top}%`,
      transform: 'translate(-50%, -50%)',
      width: '38px',
      height: '38px',
      padding: '0',
      border: '1px solid #6b7788',
      borderRadius: '50%',
      background: 'rgba(24, 28, 35, 0.94)',
      color: '#fff',
      fontSize: '20px',
      lineHeight: '1',
      boxShadow: '0 2px 10px rgba(0, 0, 0, .45)',
      pointerEvents: 'auto',
      cursor: 'pointer'
    });

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      [slots[from], slots[to]] = [slots[to], slots[from]];
      applySlotClasses(knownCards);
      renderSwapButtons();
    });

    getSwapLayer().appendChild(button);
  };

  const renderSwapButtons = () => {
    const layer = getSwapLayer();
    layer.replaceChildren();

    if (!grid.classList.contains('pair-mode')) {
      layer.style.display = 'none';
      return;
    }

    layer.style.display = 'block';

    if (knownCards.length === 2) {
      createSwapButton({ from: 0, to: 1, symbol: '⇄', left: 50, top: 50 });
      return;
    }

    if (knownCards.length >= 3) {
      createSwapButton({ from: 0, to: 1, symbol: '⇄', left: 50, top: 25 });
      createSwapButton({ from: 2, to: 3, symbol: '⇄', left: 50, top: 75 });
      createSwapButton({ from: 0, to: 2, symbol: '⇅', left: 25, top: 50 });
      createSwapButton({ from: 1, to: 3, symbol: '⇅', left: 75, top: 50 });
    }
  };

  const refresh = () => {
    scheduled = false;

    ensureControlDrawers();
    grid.style.position = 'relative';
    grid.querySelectorAll('.pair-move-controls').forEach(controls => {
      controls.style.display = 'none';
    });

    if (grid.classList.contains('multi-mode')) forceAutomaticColumns();

    const cards = getSelectedCards();
    if (!hasSameCards(cards)) initializeSlots(cards);

    if (cards.length < 2) {
      knownCards = cards;
      slots = [];
      if (swapLayer) swapLayer.style.display = 'none';
      return;
    }

    applySlotClasses(cards);
    renderSwapButtons();
  };

  const scheduleRefresh = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  };

  const showVersion = async () => {
    const label = document.createElement('div');
    label.textContent = 'version loading...';
    Object.assign(label.style, {
      position: 'fixed',
      right: '6px',
      bottom: '4px',
      zIndex: '9999',
      padding: '2px 5px',
      borderRadius: '4px',
      background: 'rgba(0,0,0,.55)',
      color: 'rgba(255,255,255,.75)',
      fontSize: '10px',
      lineHeight: '1.2',
      whiteSpace: 'pre-line',
      pointerEvents: 'none'
    });
    document.body.appendChild(label);

    try {
      const response = await fetch(`version.txt?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('version fetch failed');
      label.textContent = (await response.text()).trim();
    } catch {
      label.textContent = 'version unknown';
    }
  };

  new MutationObserver(scheduleRefresh).observe(grid, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'disabled']
  });
  window.addEventListener('resize', scheduleRefresh);
  window.addEventListener('orientationchange', scheduleRefresh);
  fileInput?.addEventListener('change', () => {
    window.setTimeout(forceAutomaticColumns, 0);
    window.setTimeout(forceAutomaticColumns, 150);
    window.setTimeout(forceAutomaticColumns, 500);
  });

  scheduleRefresh();
  showVersion();
})();
