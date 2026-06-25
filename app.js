(() => {
  'use strict';

  const LOCAL_SYNC_TOLERANCE = 0.08;
  const SYNC_INTERVAL_MS = 300;
  const UI_INTERVAL_MS = 150;

  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const videoGrid = document.getElementById('videoGrid');
  const template = document.getElementById('videoCardTemplate');
  const masterVolume = document.getElementById('masterVolume');
  const multiModeButton = document.getElementById('multiModeButton');
  const pairModeButton = document.getElementById('pairModeButton');
  const selectionCount = document.getElementById('selectionCount');
  const videoCount = document.getElementById('videoCount');
  const pairSettings = document.getElementById('pairSettings');
  const pairWidth = document.getElementById('pairWidth');
  const pairHeight = document.getElementById('pairHeight');
  const toolbar = document.querySelector('.toolbar');
  const columnCount = document.getElementById('columnCount');
  const exportPair = document.getElementById('exportPair');
  const exportProgress = document.getElementById('exportProgress');
  const exportProgressBar = document.getElementById('exportProgressBar');
  const exportProgressText = document.getElementById('exportProgressText');
  const exportCodec = document.getElementById('exportCodec');
  const exportBitrate = document.getElementById('exportBitrate');

  for (let count = 1; count <= 6; count += 1) {
    const option = document.createElement('option');
    option.value = String(count);
    option.textContent = String(count);
    if (count === 2) option.selected = true;
    columnCount.appendChild(option);
  }

  const recorderFormats = [
    { value: '', label: '自動', extension: 'webm' },
    { value: 'video/webm;codecs=vp9,opus', label: 'VP9 + Opus (WebM)', extension: 'webm' },
    { value: 'video/webm;codecs=vp8,opus', label: 'VP8 + Opus (WebM)', extension: 'webm' },
    { value: 'video/webm', label: 'WebM（ブラウザ既定）', extension: 'webm' },
    { value: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', label: 'H.264 + AAC (MP4)', extension: 'mp4' },
    { value: 'video/mp4;codecs=avc1.42E01E', label: 'H.264 (MP4)', extension: 'mp4' },
    { value: 'video/mp4', label: 'MP4（ブラウザ既定）', extension: 'mp4' }
  ];

  const items = [];
  let itemSequence = 0;
  let mode = 'multi';
  let syncTimer = null;
  let uiTimer = null;
  const pairOrder = [];
  let isExporting = false;
  let audioContext = null;
  let audioDestination = null;
  let columnsManuallySet = false;

  const populateRecorderFormats = () => {
    exportCodec.replaceChildren();
    recorderFormats.forEach(format => {
      if (format.value && (!window.MediaRecorder || !MediaRecorder.isTypeSupported(format.value))) return;
      const option = document.createElement('option');
      option.value = format.value;
      option.textContent = format.label;
      exportCodec.appendChild(option);
    });
  };

  const formatTime = seconds => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
  };

  const getPairItems = () => {
    const selected = items.filter(item => item.pairCheckbox.checked);
    const selectedIds = new Set(selected.map(item => item.id));
    for (let index = pairOrder.length - 1; index >= 0; index -= 1) {
      if (!selectedIds.has(pairOrder[index])) pairOrder.splice(index, 1);
    }
    selected.forEach(item => {
      if (!pairOrder.includes(item.id)) pairOrder.push(item.id);
    });
    return pairOrder.map(id => selected.find(item => item.id === id)).filter(Boolean);
  };

  const swapPairPositions = (fromIndex, toIndex) => {
    const pairItems = getPairItems();
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= pairItems.length || toIndex >= pairItems.length) return;
    [pairOrder[fromIndex], pairOrder[toIndex]] = [pairOrder[toIndex], pairOrder[fromIndex]];
    refreshLayout();
  };

  const movePairItem = (item, direction) => {
    const pairItems = getPairItems();
    const index = pairItems.indexOf(item);
    if (index < 0) return;
    const row = Math.floor(index / 2);
    const column = index % 2;
    let target = -1;
    if (direction === 'left' && column === 1) target = index - 1;
    if (direction === 'right' && column === 0) target = index + 1;
    if (direction === 'up' && row === 1) target = index - 2;
    if (direction === 'down' && row === 0) target = index + 2;
    swapPairPositions(index, target);
  };

  const getActiveItems = () => (mode === 'pair' ? getPairItems() : items);

  const getDuration = item => Number.isFinite(item.video.duration) ? item.video.duration : 0;

  const getMediaTime = item => Number.isFinite(item.video.currentTime) ? item.video.currentTime : 0;

  const isPlaying = item => !item.video.paused && !item.video.ended;

  const clampMediaTime = (item, seconds) => {
    const duration = getDuration(item);
    const max = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    return Math.min(Math.max(0, Number(seconds) || 0), max);
  };

  const seekItem = (item, seconds) => {
    const time = clampMediaTime(item, seconds);
    if (item.video.readyState >= HTMLMediaElement.HAVE_METADATA) item.video.currentTime = time;
  };

  const playItem = item => item.video.play();

  const pauseItem = item => item.video.pause();

  const getOffset = item => Math.max(0, Number(item.offset.value) || 0);
  const getLogicalTime = item => getMediaTime(item) - getOffset(item);

  const applyVolume = item => {
    const value = Math.min(1, Math.max(0, Number(masterVolume.value) * Number(item.volume.value)));
    item.video.volume = value;
  };

  const applyCrop = item => {
    const zoom = Number(item.cropZoom.value) || 1;
    const x = Number(item.cropX.value) || 50;
    const y = Number(item.cropY.value) || 50;
    item.mediaViewport.style.setProperty('--crop-zoom', String(zoom));
    item.mediaViewport.style.setProperty('--crop-x', `${x}%`);
    item.mediaViewport.style.setProperty('--crop-y', `${y}%`);
    item.cropZoomOutput.value = `${zoom.toFixed(2)}×`;
    item.cropXOutput.value = `${x}%`;
    item.cropYOutput.value = `${y}%`;
  };

  const showItemError = (item, message) => {
    item.errorBox.textContent = message;
    item.errorBox.hidden = false;
    item.card.classList.add('has-media-error');
  };

  const clearItemError = item => {
    item.errorBox.textContent = '';
    item.errorBox.hidden = true;
    item.card.classList.remove('has-media-error');
  };

  const waitUntilReady = item => {
    if (item.video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('動画を読み込めませんでした。'));
      };
      const cleanup = () => {
        item.video.removeEventListener('loadedmetadata', onReady);
        item.video.removeEventListener('error', onError);
      };
      item.video.addEventListener('loadedmetadata', onReady, { once: true });
      item.video.addEventListener('error', onError, { once: true });
    });
  };

  const syncToLogicalTime = (logicalTime, targets = getActiveItems()) => {
    targets.forEach(item => seekItem(item, logicalTime + getOffset(item)));
  };

  const syncActive = () => {
    const active = getActiveItems();
    if (active.length === 0) return;
    syncToLogicalTime(Math.max(0, getLogicalTime(active[0])), active);
  };

  const maintainSync = () => {
    const active = getActiveItems();
    if (active.length < 2 || !isPlaying(active[0])) return;

    const referenceTime = getLogicalTime(active[0]);
    const tolerance = LOCAL_SYNC_TOLERANCE;
    active.slice(1).forEach(item => {
      if (!isPlaying(item)) return;
      if (Math.abs(referenceTime - getLogicalTime(item)) > tolerance) {
        seekItem(item, referenceTime + getOffset(item));
      }
    });
  };

  const startSyncMonitor = () => {
    stopSyncMonitor();
    syncTimer = window.setInterval(maintainSync, SYNC_INTERVAL_MS);
  };

  function stopSyncMonitor() {
    if (syncTimer !== null) {
      window.clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  const updateItemTimeUi = item => {
    const current = getMediaTime(item);
    const duration = getDuration(item);
    item.currentTimeLabel.textContent = formatTime(current);
    item.durationLabel.textContent = formatTime(duration);
    if (!item.seekDragging && duration > 0) {
      item.seek.value = String(Math.min(1000, Math.max(0, (current / duration) * 1000)));
    }
  };

  const startUiTimer = () => {
    if (uiTimer !== null) return;
    uiTimer = window.setInterval(() => items.forEach(updateItemTimeUi), UI_INTERVAL_MS);
  };

  const updateColumnLayout = ({ forceAuto = false } = {}) => {
    if (forceAuto) columnsManuallySet = false;
    if (!columnsManuallySet) {
      const automaticColumns = Math.min(6, Math.max(1, items.length));
      columnCount.value = String(automaticColumns);
    }
    const columns = Math.min(6, Math.max(1, Number(columnCount.value) || 1));
    columnCount.value = String(columns);
    videoGrid.style.setProperty('--multi-columns', String(columns));
  };

  const fitPairToViewport = () => {
    document.body.classList.toggle('pair-view', mode === 'pair');
    if (mode !== 'pair') {
      document.body.classList.remove('compact-pair', 'ultra-compact');
      videoGrid.style.removeProperty('--pair-display-width');
      videoGrid.style.removeProperty('--pair-display-height');
      return;
    }

    const toolbarHeight = toolbar.offsetHeight;
    document.body.style.setProperty('--header-height', '0px');
    document.body.style.setProperty('--toolbar-height', `${toolbarHeight}px`);

    requestAnimationFrame(() => {
      const desiredWidth = Math.min(3840, Math.max(320, Number(pairWidth.value) || 1280));
      const desiredHeight = Math.min(2160, Math.max(180, Number(pairHeight.value) || 720));
      const top = videoGrid.getBoundingClientRect().top;
      const availableHeight = Math.max(120, window.innerHeight - top - toolbarHeight - 8);
      const availableWidth = Math.max(240, videoGrid.parentElement.clientWidth);
      const isPortraitWindow = window.innerHeight > window.innerWidth;
      const pairCount = getPairItems().length;
      const isGridPair = pairCount > 2;

      let panelWidth = Math.round(Math.min(250, Math.max(140, availableWidth * 0.17)));
      let panelHeight = Math.round(Math.min(230, Math.max(105, availableHeight * 0.20)));

      let videoAvailableWidth = availableWidth;
      let videoAvailableHeight = availableHeight;

      if (isGridPair) {
        if (isPortraitWindow) {
          // 上段パネル + 2段の動画 + 下段パネル。動画同士は中央で隣接する。
          panelHeight = Math.min(panelHeight, Math.max(80, Math.floor((availableHeight - 120) / 2)));
          videoAvailableHeight = Math.max(80, availableHeight - panelHeight * 2);
        } else {
          // 左右端の操作パネル分だけ映像領域から差し引く。
          panelWidth = Math.min(panelWidth, Math.max(110, Math.floor((availableWidth - 160) / 2)));
          videoAvailableWidth = Math.max(120, availableWidth - panelWidth * 2);
        }
      } else if (isPortraitWindow) {
        panelHeight = Math.min(panelHeight, Math.max(90, availableHeight - 120));
        videoAvailableHeight = Math.max(80, availableHeight - panelHeight);
      } else {
        panelWidth = Math.min(panelWidth, Math.max(110, Math.floor((availableWidth - 160) / 2)));
        videoAvailableWidth = Math.max(120, availableWidth - panelWidth * 2);
      }

      const scale = Math.max(0.05, Math.min(1, videoAvailableWidth / desiredWidth, videoAvailableHeight / desiredHeight));
      const displayWidth = Math.max(1, Math.floor(desiredWidth * scale));
      const displayHeight = Math.max(1, Math.floor(desiredHeight * scale));

      videoGrid.style.setProperty('--pair-panel-width', `${panelWidth}px`);
      videoGrid.style.setProperty('--pair-panel-height', `${panelHeight}px`);
      videoGrid.style.setProperty('--pair-display-width', `${displayWidth}px`);
      videoGrid.style.setProperty('--pair-display-height', `${displayHeight}px`);

      document.body.classList.toggle('compact-pair', availableHeight < 620 || availableWidth < 1000);
      document.body.classList.toggle('ultra-compact', availableHeight < 430 || availableWidth < 720);
    });
  };

  const refreshLayout = () => {
    const selected = getPairItems();
    selectionCount.textContent = `▥ ${selected.length} / 4`;
    videoCount.textContent = `🎞 ${items.length}`;

    multiModeButton.classList.toggle('active', mode === 'multi');
    pairModeButton.classList.toggle('active', mode === 'pair');
    pairModeButton.disabled = mode !== 'pair' && (selected.length < 2 || selected.length > 4);
    videoGrid.classList.toggle('multi-mode', mode === 'multi');
    videoGrid.classList.toggle('pair-mode', mode === 'pair');
    pairSettings.classList.toggle('visible', mode === 'pair');
    dropZone.classList.toggle('mode-hidden', mode === 'pair');

    exportPair.hidden = mode !== 'pair';
    exportPair.disabled = mode !== 'pair' || selected.length < 2 || selected.length > 4 || isExporting;
    exportPair.title = '並列動画を書き出す';
    exportCodec.disabled = isExporting;
    exportBitrate.disabled = isExporting;
    columnCount.disabled = isExporting;

    items.forEach(item => {
      const isSelected = item.pairCheckbox.checked;
      item.card.classList.toggle('pair-selected', isSelected);
      item.card.classList.toggle('hidden-in-pair', mode === 'pair' && !isSelected);
      item.card.classList.remove('pair-left', 'pair-right', 'pair-top-left', 'pair-top-right', 'pair-bottom-left', 'pair-bottom-right');
    });

    videoGrid.classList.remove('pair-count-2', 'pair-count-3', 'pair-count-4');
    if (mode === 'pair') {
      const pairItems = getPairItems();
      videoGrid.classList.add(`pair-count-${pairItems.length}`);
      document.body.dataset.pairCount = String(pairItems.length);
      const slotClasses = ['pair-top-left', 'pair-top-right', 'pair-bottom-left', 'pair-bottom-right'];
      pairItems.forEach((item, index) => {
        item.card.classList.add(slotClasses[index]);
        if (index === 0) item.card.classList.add('pair-left');
        if (index === 1) item.card.classList.add('pair-right');
        item.card.style.order = String(index);
        const buttons = item.card.querySelectorAll('.pair-move');
        const row = Math.floor(index / 2);
        const column = index % 2;
        buttons.forEach(button => {
          const direction = button.dataset.direction;
          const target = direction === 'left' ? (column === 1 ? index - 1 : -1)
            : direction === 'right' ? (column === 0 ? index + 1 : -1)
            : direction === 'up' ? (row === 1 ? index - 2 : -1)
            : (row === 0 ? index + 2 : -1);
          button.disabled = target < 0 || target >= pairItems.length;
        });
      });
    } else {
      delete document.body.dataset.pairCount;
      items.forEach(item => { item.card.style.order = ''; });
    }

    const ordered = mode === 'pair'
      ? [...getPairItems(), ...items.filter(item => !item.pairCheckbox.checked)]
      : items;
    ordered.forEach(item => videoGrid.appendChild(item.card));
    fitPairToViewport();
  };

  const applyPairSize = () => {
    const width = Math.min(3840, Math.max(320, Number(pairWidth.value) || 1280));
    const height = Math.min(2160, Math.max(180, Number(pairHeight.value) || 720));
    pairWidth.value = String(width);
    pairHeight.value = String(height);
    videoGrid.style.setProperty('--pair-width', `${width}px`);
    videoGrid.style.setProperty('--pair-height', `${height}px`);
    videoGrid.style.setProperty('--pair-ratio', String(height / width));
    fitPairToViewport();
  };

  const pauseEveryMedia = () => {
    items.forEach(pauseItem);
    stopSyncMonitor();
  };

  const setMode = nextMode => {
    if (nextMode === 'pair' && (getPairItems().length < 2 || getPairItems().length > 4)) return;
    pauseEveryMedia();
    mode = nextMode;
    refreshLayout();
  };

  const createCard = titleText => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.video-card');
    const video = fragment.querySelector('.local-media');
    const mediaViewport = fragment.querySelector('.media-viewport');
    const errorBox = fragment.querySelector('.media-error');
    const title = fragment.querySelector('.video-title');
    const removeButton = fragment.querySelector('.remove-button');
    const volume = fragment.querySelector('.volume-slider');
    const offset = fragment.querySelector('.start-offset');
    const seek = fragment.querySelector('.seek-slider');
    const currentTimeLabel = fragment.querySelector('.current-time');
    const durationLabel = fragment.querySelector('.duration');
    const pairCheckbox = fragment.querySelector('.pair-checkbox');
    const cropZoom = fragment.querySelector('.crop-zoom');
    const cropX = fragment.querySelector('.crop-x');
    const cropY = fragment.querySelector('.crop-y');
    const cropZoomOutput = cropZoom.nextElementSibling;
    const cropXOutput = cropX.nextElementSibling;
    const cropYOutput = cropY.nextElementSibling;
    const resetZoom = fragment.querySelector('.reset-zoom');
    const resetX = fragment.querySelector('.reset-x');
    const resetY = fragment.querySelector('.reset-y');

    const item = {
      id: ++itemSequence,
      card,
      video,
      mediaViewport,
      errorBox,
      title,
      volume,
      offset,
      seek,
      currentTimeLabel,
      durationLabel,
      pairCheckbox,
      cropZoom,
      cropX,
      cropY,
      cropZoomOutput,
      cropXOutput,
      cropYOutput,
      seekDragging: false,
      objectUrl: null,
      audioSource: null,
      readyPromise: null,
      resolveReady: null,
      rejectReady: null
    };

    title.textContent = titleText;
    title.title = titleText;
    card.classList.add('local-card');

    item.readyPromise = new Promise((resolve, reject) => {
      item.resolveReady = resolve;
      item.rejectReady = reject;
    });
    item.readyPromise.catch(() => {});

    volume.addEventListener('input', () => applyVolume(item));
    offset.addEventListener('change', () => {
      if (getActiveItems().includes(item)) syncActive();
    });

    seek.addEventListener('pointerdown', () => { item.seekDragging = true; });
    seek.addEventListener('pointerup', () => { item.seekDragging = false; });
    seek.addEventListener('change', () => { item.seekDragging = false; });
    seek.addEventListener('input', () => {
      const duration = getDuration(item);
      if (!(duration > 0)) return;
      const selectedMediaTime = (Number(seek.value) / 1000) * duration;
      const targets = getActiveItems().includes(item) ? getActiveItems() : [item];
      syncToLogicalTime(Math.max(0, selectedMediaTime - getOffset(item)), targets);
      updateItemTimeUi(item);
    });

    [cropZoom, cropX, cropY].forEach(control => {
      control.addEventListener('input', () => applyCrop(item));
    });
    resetZoom.addEventListener('click', () => {
      cropZoom.value = '1';
      applyCrop(item);
    });
    resetX.addEventListener('click', () => {
      cropX.value = '50';
      applyCrop(item);
    });
    resetY.addEventListener('click', () => {
      cropY.value = '50';
      applyCrop(item);
    });

    pairCheckbox.addEventListener('change', () => {
      if (pairCheckbox.checked && items.filter(candidate => candidate.pairCheckbox.checked).length > 4) {
        pairCheckbox.checked = false;
      }
      if (pairCheckbox.checked && !pairOrder.includes(item.id)) pairOrder.push(item.id);
      if (!pairCheckbox.checked) {
        const orderIndex = pairOrder.indexOf(item.id);
        if (orderIndex >= 0) pairOrder.splice(orderIndex, 1);
      }
      refreshLayout();
    });

    fragment.querySelectorAll('.pair-move').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        movePairItem(item, button.dataset.direction);
      });
    });

    removeButton.addEventListener('click', () => removeItem(item));
    applyCrop(item);
    items.push(item);
    videoGrid.appendChild(fragment);
    return item;
  };

  const addLocalVideo = file => {
    const item = createCard(file.name);
    item.file = file;
    item.objectUrl = URL.createObjectURL(file);
    item.video.hidden = false;
    item.video.src = item.objectUrl;
    item.video.loop = false;

    const markReady = () => {
      clearItemError(item);
      item.resolveReady();
      updateItemTimeUi(item);
    };
    if (item.video.readyState >= HTMLMediaElement.HAVE_METADATA) markReady();
    else item.video.addEventListener('loadedmetadata', markReady, { once: true });

    item.video.addEventListener('loadedmetadata', () => updateItemTimeUi(item));
    item.video.addEventListener('ended', () => {
      if (!getActiveItems().includes(item)) return;
      getActiveItems().forEach(pauseItem);
      stopSyncMonitor();
    });
    item.video.addEventListener('error', () => {
      const message = 'この動画をブラウザで再生できません。';
      showItemError(item, message);
      item.rejectReady(new Error(message));
    }, { once: true });

    applyVolume(item);
    item.video.load();
    return item;
  };

  const addFiles = fileList => {
    const files = [...fileList].filter(file => file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm|avi|mkv)$/i.test(file.name));
    files.forEach(addLocalVideo);
    updateColumnLayout();
    refreshLayout();
  };

  const removeItem = item => {
    pauseItem(item);
    if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
    item.card.remove();
    const index = items.indexOf(item);
    if (index >= 0) items.splice(index, 1);

    if (mode === 'pair' && (getPairItems().length < 2 || getPairItems().length > 4)) mode = 'multi';
    stopSyncMonitor();
    updateColumnLayout();
    refreshLayout();
  };

  const playActive = async () => {
    const active = getActiveItems();
    if (active.length === 0 || (mode === 'pair' && (active.length < 2 || active.length > 4))) return;

    pauseEveryMedia();
    try {
      await Promise.all(active.map(waitUntilReady));
      syncActive();
      await Promise.allSettled(active.map(playItem));
      startSyncMonitor();
    } catch (error) {
      console.error(error);
    }
  };

  const pauseActive = () => {
    getActiveItems().forEach(pauseItem);
    stopSyncMonitor();
  };

  const restartActive = () => syncToLogicalTime(0);

  const ensureAudioGraph = pairItems => {
    if (!audioContext) {
      audioContext = new AudioContext();
      audioDestination = audioContext.createMediaStreamDestination();
    }
    pairItems.forEach(item => {
      if (!item.audioSource) {
        item.audioSource = audioContext.createMediaElementSource(item.video);
        item.audioSource.connect(audioContext.destination);
        item.audioSource.connect(audioDestination);
      }
    });
    return audioContext.resume();
  };

  const drawCroppedVideo = (context, item, dx, dy, dw, dh) => {
    const video = item.video;
    if (!video.videoWidth || !video.videoHeight) return;

    const zoom = Math.max(0.25, Number(item.cropZoom.value) || 1);
    const positionX = Math.min(1, Math.max(0, (Number(item.cropX.value) || 50) / 100));
    const positionY = Math.min(1, Math.max(0, (Number(item.cropY.value) || 50) / 100));
    const baseScale = Math.max(dw / video.videoWidth, dh / video.videoHeight);
    const drawnWidth = video.videoWidth * baseScale * zoom;
    const drawnHeight = video.videoHeight * baseScale * zoom;
    const drawnX = dx - (drawnWidth - dw) * positionX;
    const drawnY = dy - (drawnHeight - dh) * positionY;

    context.save();
    context.beginPath();
    context.rect(dx, dy, dw, dh);
    context.clip();
    context.drawImage(video, drawnX, drawnY, drawnWidth, drawnHeight);
    context.restore();
  };

  const chooseRecorderFormat = () => {
    const selected = exportCodec.value;
    if (selected) {
      return recorderFormats.find(format => format.value === selected)
        || { value: selected, extension: selected.includes('mp4') ? 'mp4' : 'webm' };
    }
    const automatic = recorderFormats.slice(1).find(format => MediaRecorder.isTypeSupported(format.value));
    return automatic || { value: '', extension: 'webm' };
  };

  const exportPairVideo = async () => {
    const pairItems = getPairItems();
    if (mode !== 'pair' || pairItems.length < 2 || pairItems.length > 4 || isExporting) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      window.alert('このブラウザは動画の書き出しに対応していません。ChromeまたはEdgeを使用してください。');
      return;
    }

    isExporting = true;
    document.body.classList.add('exporting');
    exportProgress.hidden = false;
    exportProgressBar.value = 0;
    exportProgressText.textContent = '0%';
    refreshLayout();

    const previousTimes = pairItems.map(getMediaTime);
    const previousPlaying = pairItems.map(isPlaying);
    const previousLoops = pairItems.map(item => item.video.loop);

    try {
      pauseEveryMedia();
      await Promise.all(pairItems.map(waitUntilReady));
      await ensureAudioGraph(pairItems);
      pairItems.forEach(item => { item.video.loop = false; });
      syncToLogicalTime(0, pairItems);

      const width = Math.min(3840, Math.max(320, Number(pairWidth.value) || 1280));
      const height = Math.min(2160, Math.max(180, Number(pairHeight.value) || 720));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ]);
      const recorderFormat = chooseRecorderFormat();
      const recorderOptions = { videoBitsPerSecond: Number(exportBitrate.value) || 8_000_000 };
      if (recorderFormat.value) recorderOptions.mimeType = recorderFormat.value;
      const recorder = new MediaRecorder(combinedStream, recorderOptions);
      const chunks = [];
      recorder.addEventListener('dataavailable', event => {
        if (event.data.size > 0) chunks.push(event.data);
      });

      const exportDuration = Math.min(...pairItems.map(item => Math.max(0, getDuration(item) - getOffset(item))));
      if (!Number.isFinite(exportDuration) || exportDuration <= 0) throw new Error('書き出せる再生時間がありません。');

      let animationFrame = 0;
      const render = () => {
        context.fillStyle = '#000';
        context.fillRect(0, 0, width, height);
        const columns = 2;
        const rows = pairItems.length > 2 ? 2 : 1;
        const cellWidth = width / columns;
        const cellHeight = height / rows;
        pairItems.forEach((item, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          drawCroppedVideo(context, item, column * cellWidth, row * cellHeight, cellWidth, cellHeight);
        });
        const progress = Math.min(exportDuration, Math.max(0, getLogicalTime(pairItems[0])));
        const percent = Math.min(100, Math.max(0, (progress / exportDuration) * 100));
        exportProgressBar.value = percent;
        exportProgressText.textContent = `${percent.toFixed(1)}%`;
        if (recorder.state === 'recording') animationFrame = requestAnimationFrame(render);
      };

      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener('stop', resolve, { once: true });
        recorder.addEventListener('error', event => reject(event.error), { once: true });
      });
      recorder.start(1000);
      render();
      await Promise.all(pairItems.map(playItem));

      await new Promise(resolve => {
        const check = () => {
          const elapsed = getLogicalTime(pairItems[0]);
          if (elapsed >= exportDuration - 0.04 || pairItems.some(item => item.video.ended)) resolve();
          else window.setTimeout(check, 100);
        };
        check();
      });

      pairItems.forEach(pauseItem);
      recorder.stop();
      await stopped;
      cancelAnimationFrame(animationFrame);
      combinedStream.getTracks().forEach(track => track.stop());

      const outputType = recorder.mimeType || recorderFormat.value || 'video/webm';
      const blob = new Blob(chunks, { type: outputType });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const extension = outputType.includes('mp4') ? 'mp4' : recorderFormat.extension || 'webm';
      link.download = `parallel-video-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 30_000);
      exportProgressBar.value = 100;
      exportProgressText.textContent = '100%';
    } catch (error) {
      console.error(error);
      window.alert(`書き出しに失敗しました: ${error.message || error}`);
    } finally {
      pairItems.forEach((item, index) => {
        pauseItem(item);
        item.video.loop = previousLoops[index];
        seekItem(item, previousTimes[index]);
      });
      previousPlaying.forEach((wasPlaying, index) => {
        if (wasPlaying) playItem(pairItems[index]).catch(() => {});
      });
      isExporting = false;
      document.body.classList.remove('exporting');
      window.setTimeout(() => {
        exportProgress.hidden = true;
        exportProgressBar.value = 0;
        exportProgressText.textContent = '0%';
      }, 800);
      refreshLayout();
    }
  };

  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });


  ['dragenter', 'dragover'].forEach(eventName => {
    document.addEventListener(eventName, event => {
      event.preventDefault();
      if (mode === 'multi') dropZone.classList.add('dragging');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, event => {
      event.preventDefault();
      dropZone.classList.remove('dragging');
    });
  });

  document.addEventListener('drop', event => {
    if (mode === 'multi') addFiles(event.dataTransfer.files);
  });

  dropZone.addEventListener('click', event => {
    fileInput.click();
  });
  dropZone.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      fileInput.click();
    }
  });

  multiModeButton.addEventListener('click', () => setMode('multi'));
  pairModeButton.addEventListener('click', () => setMode('pair'));
  document.getElementById('playAll').addEventListener('click', playActive);
  document.getElementById('pauseAll').addEventListener('click', pauseActive);
  document.getElementById('restartAll').addEventListener('click', restartActive);
  document.getElementById('syncAll').addEventListener('click', syncActive);
  document.getElementById('removeAll').addEventListener('click', () => {
    pauseEveryMedia();
    [...items].forEach(item => removeItem(item));
    items.length = 0;
    mode = 'multi';
    pairOrder.length = 0;
    updateColumnLayout({ forceAuto: true });
    refreshLayout();
  });

  pairWidth.addEventListener('input', applyPairSize);
  pairHeight.addEventListener('input', applyPairSize);
  pairWidth.addEventListener('change', applyPairSize);
  pairHeight.addEventListener('change', applyPairSize);
  document.getElementById('resetPairSize').addEventListener('click', () => {
    pairWidth.value = '1280';
    pairHeight.value = '720';
    applyPairSize();
  });

  masterVolume.addEventListener('input', () => items.forEach(applyVolume));
  columnCount.addEventListener('change', () => {
    columnsManuallySet = true;
    updateColumnLayout();
  });
  exportPair.addEventListener('click', exportPairVideo);
  window.addEventListener('resize', fitPairToViewport);

  window.addEventListener('beforeunload', () => {
    stopSyncMonitor();
    if (uiTimer !== null) window.clearInterval(uiTimer);
    items.forEach(item => {
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
    });
  });

  populateRecorderFormats();
  videoGrid.style.setProperty('--multi-columns', columnCount.value);
  applyPairSize();
  updateColumnLayout();
  refreshLayout();
  startUiTimer();
})();
