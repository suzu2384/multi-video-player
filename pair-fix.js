(() => {
  const grid = document.getElementById('videoGrid');
  const columnCount = document.getElementById('columnCount');
  const fileInput = document.getElementById('fileInput');
  if (!grid) return;

  const style = document.createElement('style');
  style.textContent = `
    #videoGrid.pair-mode .pair-move-controls {
      display: none !important;
    }

    .controls-drawer {
      position: relative;
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

    .pair-seek-dock {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      z-index: 24;
      padding: 6px 8px;
      border-radius: 8px;
      background: rgba(10,12,16,.82);
      backdrop-filter: blur(5px);
    }
    .pair-seek-dock .time-row {
      margin: 0 !important;
      display: grid !important;
      grid-template-columns: auto auto !important;
      gap: 4px 8px !important;
      color: #fff !important;
    }
    .pair-seek-dock .seek-slider {
      grid-column: 1 / -1 !important;
      grid-row: 1 !important;
      width: 100% !important;
    }
    .pair-seek-dock .current-time { grid-column: 1; grid-row: 2; }
    .pair-seek-dock .duration { grid-column: 2; grid-row: 2; text-align: right; }

    @media (max-width: 920px) {
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
        grid-template-columns: 30px minmax(0,1fr) 48px 28px !important;
        align-items: center !important;
        width: 100% !important;
      }
    }
  `;
  document.head.appendChild(style);

  const POSITION_CLASSES = ['pair-top-left','pair-top-right','pair-bottom-left','pair-bottom-right'];
  let knownCards = [];
  let slots = [];
  let scheduled = false;
  let swapLayer = null;
  let columnsManuallySet = false;

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

  const ensureDrawersAndSeek = () => {
    const pairMode = grid.classList.contains('pair-mode');
    grid.querySelectorAll('.video-card').forEach(card => {
      const info = card.querySelector('.video-info');
      const frame = card.querySelector('.video-frame');
      if (!info || !frame) return;

      const oldDetails = info.querySelector(':scope > .pair-extra-controls');
      let videoControls = info.querySelector(':scope > .video-controls')
        || oldDetails?.querySelector(':scope > .video-controls');
      let cropControls = info.querySelector(':scope > .crop-controls')
        || oldDetails?.querySelector(':scope > .crop-controls');
      let timeRow = info.querySelector(':scope > .time-row')
        || frame.querySelector('.pair-seek-dock > .time-row');
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
          if (open) drawer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
        drawer.append(toggle, content);
        info.insertBefore(drawer, info.firstElementChild?.nextElementSibling || null);
      }
      drawer.querySelector('.controls-drawer-content').append(videoControls, cropControls);
      oldDetails?.remove();

      let dock = frame.querySelector(':scope > .pair-seek-dock');
      if (pairMode) {
        if (!dock) {
          dock = document.createElement('div');
          dock.className = 'pair-seek-dock';
          frame.appendChild(dock);
        }
        dock.appendChild(timeRow);
      } else {
        dock?.remove();
        info.appendChild(timeRow);
      }
    });
  };

  const getSelectedCards = () => [...grid.querySelectorAll('.video-card.pair-selected:not(.hidden-in-pair)')];
  const hasSameCards = cards => cards.length === knownCards.length && cards.every(card => knownCards.includes(card));

  const initializeSlots = cards => {
    knownCards = cards;
    if (cards.length === 2) {
      const left = cards.find(card => card.classList.contains('pair-left')) || cards[0];
      slots = [left, cards.find(card => card !== left) || null];
      return;
    }
    slots = new Array(4).fill(null);
    cards.forEach(card => {
      const index = POSITION_CLASSES.findIndex(name => card.classList.contains(name));
      if (index >= 0 && !slots[index]) slots[index] = card;
    });
    cards.forEach(card => {
      if (slots.includes(card)) return;
      const index = slots.indexOf(null);
      if (index >= 0) slots[index] = card;
    });
  };

  const applySlotClasses = cards => {
    cards.forEach(card => {
      card.classList.remove('pair-left','pair-right',...POSITION_CLASSES);
      card.style.removeProperty('grid-column');
      card.style.removeProperty('grid-row');
      card.style.removeProperty('order');
    });
    if (cards.length === 2) {
      slots[0]?.classList.add('pair-left');
      slots[1]?.classList.add('pair-right');
      return;
    }
    slots.forEach((card,index) => {
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
    Object.assign(swapLayer.style,{position:'absolute',inset:'0',zIndex:'30',pointerEvents:'none'});
    grid.appendChild(swapLayer);
    return swapLayer;
  };

  const rebuildSelectionOrder = orderedCards => {
    const selectedCards = getSelectedCards();
    selectedCards.forEach(card => {
      const checkbox = card.querySelector('.pair-checkbox');
      if (!checkbox) return;
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
    orderedCards.forEach(card => {
      const checkbox = card.querySelector('.pair-checkbox');
      if (!checkbox) return;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  const addSwap = (from,to,symbol,left,top) => {
    const source = slots[from];
    const target = slots[to];
    if (!source || !target) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = symbol;
    Object.assign(button.style,{position:'absolute',left:`${left}%`,top:`${top}%`,transform:'translate(-50%,-50%)',width:'38px',height:'38px',padding:'0',border:'1px solid #6b7788',borderRadius:'50%',background:'rgba(24,28,35,.94)',color:'#fff',fontSize:'20px',lineHeight:'1',boxShadow:'0 2px 10px rgba(0,0,0,.45)',pointerEvents:'auto'});
    button.addEventListener('click',event => {
      event.preventDefault();
      event.stopPropagation();

      const nextOrder = slots.filter(Boolean);
      [nextOrder[from], nextOrder[to]] = [nextOrder[to], nextOrder[from]];
      knownCards = [];
      slots = [];
      rebuildSelectionOrder(nextOrder);
      schedule();
    });
    getSwapLayer().appendChild(button);
  };

  const renderSwaps = () => {
    const layer = getSwapLayer();
    layer.replaceChildren();
    if (!grid.classList.contains('pair-mode')) { layer.style.display = 'none'; return; }
    layer.style.display = 'block';
    if (knownCards.length === 2) { addSwap(0,1,'⇄',50,50); return; }
    if (knownCards.length >= 3) {
      addSwap(0,1,'⇄',50,25);
      addSwap(2,3,'⇄',50,75);
      addSwap(0,2,'⇅',25,50);
      addSwap(1,3,'⇅',75,50);
    }
  };

  const refresh = () => {
    scheduled = false;
    ensureDrawersAndSeek();
    grid.style.position = 'relative';
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
    renderSwaps();
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
  new MutationObserver(schedule).observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
  window.addEventListener('resize',schedule);
  window.addEventListener('orientationchange',schedule);
  fileInput?.addEventListener('change',() => [0,150,500].forEach(delay => setTimeout(forceAutomaticColumns,delay)));
  schedule();
  showVersion();
})();
