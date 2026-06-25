(() => {
  const SYNC_TOLERANCE_SECONDS = 0.035;
  const HARD_SYNC_TOLERANCE_SECONDS = 0.18;
  const SYNC_INTERVAL_MS = 60;

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
  const swapPair = document.getElementById('swapPair');
  const toolbar = document.querySelector('.toolbar');
  const columnCount = document.getElementById('columnCount');
  const exportPair = document.getElementById('exportPair');
  const exportProgress = document.getElementById('exportProgress');
  const exportProgressBar = document.getElementById('exportProgressBar');
  const exportProgressText = document.getElementById('exportProgressText');
  const exportCodec = document.getElementById('exportCodec');
  const exportBitrate = document.getElementById('exportBitrate');
  const pairCanvasStage = document.getElementById('pairCanvasStage');
  const pairCanvas = document.getElementById('pairCanvas');
  const pairCanvasWaiting = document.getElementById('pairCanvasWaiting');
  const pairCanvasContext = pairCanvas.getContext('2d', { alpha: false });

  const getViewportSize = () => {
    const viewport = window.visualViewport;
    return {
      width: Math.round(viewport?.width || window.innerWidth || document.documentElement.clientWidth),
      height: Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight)
    };
  };

  const mobileCompositeDevice = (() => {
    const ua = navigator.userAgent || '';
    const mobileUa = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);
    const touchTablet = navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) <= 1024;
    return mobileUa || touchTablet;
  })();
  document.documentElement.classList.toggle('mobile-composite-device', mobileCompositeDevice);
  document.body.classList.toggle('mobile-composite-device', mobileCompositeDevice);

  const isMobileLayout = () => {
    const { width, height } = getViewportSize();
    return mobileCompositeDevice || Math.min(width, height) <= 760 || window.matchMedia('(pointer: coarse)').matches;
  };

  const getColumnLimit = () => {
    const { width, height } = getViewportSize();
    if (!isMobileLayout()) return 6;
    return height >= width ? 2 : 3;
  };

  const updateColumnOptions = () => {
    const limit = getColumnLimit();
    const previous = Math.min(limit, Math.max(1, Number(columnCount.value) || 1));
    columnCount.replaceChildren();
    for (let count = 1; count <= limit; count += 1) {
      const option = document.createElement('option');
      option.value = String(count);
      option.textContent = `${count}`;
      columnCount.appendChild(option);
    }
    columnCount.value = String(previous);
    return limit;
  };

  updateColumnOptions();
  columnCount.value = String(Math.min(2, getColumnLimit()));
  videoGrid.style.setProperty('--multi-columns', columnCount.value);
  const recorderFormats = [
    { value: '', label: '自動', extension: 'webm' },
    { value: 'video/webm;codecs=vp9,opus', label: 'VP9 + Opus (WebM)', extension: 'webm' },
    { value: 'video/webm;codecs=vp8,opus', label: 'VP8 + Opus (WebM)', extension: 'webm' },
    { value: 'video/webm', label: 'WebM（ブラウザ既定）', extension: 'webm' },
    { value: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', label: 'H.264 + AAC (MP4)', extension: 'mp4' },
    { value: 'video/mp4;codecs=avc1.42E01E', label: 'H.264 (MP4)', extension: 'mp4' },
    { value: 'video/mp4', label: 'MP4（ブラウザ既定）', extension: 'mp4' }
  ];

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
  populateRecorderFormats();


  /** @type {Array<{card: HTMLElement, video: HTMLVideoElement, url: string, volume: HTMLInputElement, offset: HTMLInputElement, pairCheckbox: HTMLInputElement}>} */
  const items = [];
  let mode = 'multi';
  let syncTimer = null;
  let pairReversed = false;
  let isExporting = false;
  let audioContext = null;
  let audioDestination = null;
  let columnsManuallySet = false;
  let pairFrameAnimation = 0;
  let pairFrameGeneration = 0;
  let pairFrameStarted = false;
  let pairAudioItem = null;
  const invalidatePreparedPlayback = () => {};

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return '00:00.0';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
  };

  const setStatus = () => {};

  const getPairItems = () => {
    const selected = items.filter(item => item.pairCheckbox.checked);
    return pairReversed ? [...selected].reverse() : selected;
  };
  const getActiveItems = () => mode === 'pair' ? getPairItems() : items;


  const restoreNormalVideoAudio = () => {
    items.forEach(item => {
      item.video.muted = false;
      applyVolume(item);
    });
    pairAudioItem = null;
  };

  const isMobileComposite = () => mobileCompositeDevice;

  const resizeCompositeCanvas = () => {
    if (mode === 'pair') {
      const width = Math.min(3840, Math.max(320, Number(pairWidth.value) || 1280));
      const height = Math.min(2160, Math.max(180, Number(pairHeight.value) || 720));
      if (pairCanvas.width !== width) pairCanvas.width = width;
      if (pairCanvas.height !== height) pairCanvas.height = height;
      return;
    }
    const columns = Math.max(1, Math.min(getColumnLimit(), Number(columnCount.value) || 1));
    const rows = Math.max(1, Math.ceil(items.length / columns));
    const cellWidth = 480;
    const cellHeight = 270;
    pairCanvas.width = columns * cellWidth;
    pairCanvas.height = rows * cellHeight;
  };

  const drawCompositeFrame = () => {
    const active = getActiveItems();
    resizeCompositeCanvas();
    const width = pairCanvas.width;
    const height = pairCanvas.height;
    pairCanvasContext.fillStyle = '#000';
    pairCanvasContext.fillRect(0, 0, width, height);
    if (mode === 'pair' && active.length === 2) {
      const half = Math.floor(width / 2);
      drawCroppedVideo(pairCanvasContext, active[0], 0, 0, half, height);
      drawCroppedVideo(pairCanvasContext, active[1], half, 0, width - half, height);
      return;
    }
    const columns = Math.max(1, Math.min(getColumnLimit(), Number(columnCount.value) || 1));
    const rows = Math.max(1, Math.ceil(active.length / columns));
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    active.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      drawCroppedVideo(pairCanvasContext, item, col * cellWidth, row * cellHeight, cellWidth, cellHeight);
    });
  };

  const stopPairFrameCompositor = ({ restoreAudio = true } = {}) => {
    pairFrameGeneration += 1;
    if (pairFrameAnimation) cancelAnimationFrame(pairFrameAnimation);
    pairFrameAnimation = 0;
    pairFrameStarted = false;
    pairCanvasStage.classList.remove('frame-ready');
    document.body.classList.remove('mobile-composite-active');
    if (restoreAudio) restoreNormalVideoAudio();
  };

  const startPairFrameCompositor = () => {
    stopPairFrameCompositor({ restoreAudio: false });
    if (!isMobileComposite() || getActiveItems().length === 0) return;
    if (mode === 'pair' && getActiveItems().length !== 2) return;
    const generation = ++pairFrameGeneration;
    document.body.classList.add('mobile-composite-active');
    pairCanvasStage.hidden = false;
    pairCanvasStage.classList.add('frame-ready');
    pairCanvasWaiting.textContent = '';
    pairFrameStarted = true;
    let lastDraw = 0;
    const render = (now = 0) => {
      if (generation !== pairFrameGeneration || !isMobileComposite()) return;
      if (now - lastDraw >= 33 || lastDraw === 0) {
        drawCompositeFrame();
        lastDraw = now;
      }
      pairFrameAnimation = requestAnimationFrame(render);
    };
    pairFrameAnimation = requestAnimationFrame(render);
  };

  const drawPairCanvasFrame = () => {
    if (isMobileComposite()) drawCompositeFrame();
  };

  const resizePairCanvas = resizeCompositeCanvas;

  const updateResponsiveColumns = () => {
    const limit = updateColumnOptions();
    const columns = Math.min(limit, Math.max(1, Number(columnCount.value) || 1));
    columnCount.value = String(columns);
    videoGrid.style.setProperty('--mobile-columns', String(columns));
    videoGrid.style.setProperty('--multi-columns', String(columns));
  };

  const updateColumnLayout = ({ forceAuto = false } = {}) => {
    if (forceAuto) columnsManuallySet = false;
    const limit = updateColumnOptions();
    if (!columnsManuallySet) {
      const automaticColumns = Math.min(limit, Math.max(1, items.length));
      columnCount.value = String(automaticColumns);
    }
    const columns = Math.min(limit, Math.max(1, Number(columnCount.value) || 1));
    columnCount.value = String(columns);
    videoGrid.style.setProperty('--multi-columns', String(columns));
    videoGrid.style.setProperty('--mobile-columns', String(columns));
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
      const availableHeight = Math.max(220, window.innerHeight - top - toolbarHeight - 8);
      const availableWidth = Math.max(320, videoGrid.parentElement.clientWidth);
      const panelWidth = availableWidth < 920 ? 190 : 250;
      const videoAvailableWidth = Math.max(320, availableWidth - panelWidth * 2);
      videoGrid.style.setProperty('--pair-panel-width', `${panelWidth}px`);

      document.body.classList.toggle('compact-pair', availableHeight < 570);
      document.body.classList.toggle('ultra-compact', availableHeight < 430);

      requestAnimationFrame(() => {
        const videoAvailableHeight = Math.max(120, availableHeight);
        const scale = Math.min(1, videoAvailableWidth / desiredWidth, videoAvailableHeight / desiredHeight);
        videoGrid.style.setProperty('--pair-display-width', `${Math.floor(desiredWidth * scale)}px`);
        videoGrid.style.setProperty('--pair-display-height', `${Math.floor(desiredHeight * scale)}px`);
      });
    });
  };

  const pauseEveryVideo = () => {
    items.forEach(item => item.video.pause());
    stopSyncMonitor();
    stopPairFrameCompositor();
  };

  const refreshLayout = () => {
    const selected = getPairItems();
    selectionCount.textContent = `▥ ${selected.length} / 2`;
    videoCount.textContent = `🎞 ${items.length}`;

    multiModeButton.classList.toggle('active', mode === 'multi');
    pairModeButton.classList.toggle('active', mode === 'pair');
    pairModeButton.disabled = mode !== 'pair' && selected.length !== 2;
    videoGrid.classList.toggle('multi-mode', mode === 'multi');
    videoGrid.classList.toggle('pair-mode', mode === 'pair');
    pairSettings.classList.toggle('visible', mode === 'pair');
    dropZone.classList.toggle('mode-hidden', mode === 'pair');
    exportPair.hidden = mode !== 'pair';
    exportPair.disabled = mode !== 'pair' || selected.length !== 2 || isExporting;
    columnCount.disabled = isExporting;
    exportCodec.disabled = isExporting;
    exportBitrate.disabled = isExporting;
    const shouldComposite = isMobileComposite() && getActiveItems().length > 0 && (mode !== 'pair' || getActiveItems().length === 2);
    pairCanvasStage.hidden = !shouldComposite;
    document.body.classList.toggle('mobile-composite-active', shouldComposite);
    if (shouldComposite) {
      resizePairCanvas();
      startPairFrameCompositor();
    } else {
      stopPairFrameCompositor();
    }

    items.forEach(item => {
      const isSelected = item.pairCheckbox.checked;
      item.card.classList.toggle('pair-selected', isSelected);
      item.card.classList.toggle('hidden-in-pair', mode === 'pair' && !isSelected);
      item.card.classList.remove('pair-left', 'pair-right');
    });

    if (mode === 'pair') {
      const pairItems = getPairItems();
      pairItems[0]?.card.classList.add('pair-left');
      pairItems[1]?.card.classList.add('pair-right');
    }

    const ordered = mode === 'pair' ? [...getPairItems(), ...items.filter(item => !item.pairCheckbox.checked)] : items;
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
    resizePairCanvas();
    if (mode === 'pair') drawPairCanvasFrame(getPairItems());
    fitPairToViewport();
  };

  const applyCrop = (item) => {
    const zoom = Number(item.cropZoom.value);
    const x = Number(item.cropX.value);
    const y = Number(item.cropY.value);
    item.video.style.setProperty('--crop-zoom', String(zoom));
    item.video.style.setProperty('--crop-x', `${x}%`);
    item.video.style.setProperty('--crop-y', `${y}%`);
    item.cropZoomOutput.value = `${zoom.toFixed(2)}×`;
    item.cropXOutput.value = `${x}%`;
    item.cropYOutput.value = `${y}%`;
  };

  const applyVolume = (item) => {
    item.video.volume = Math.min(1, Number(masterVolume.value) * Number(item.volume.value));
    if (mode === 'pair' && pairAudioItem) item.video.muted = !pairFrameStarted;
  };

  const getOffset = (item) => Math.max(0, Number(item.offset.value) || 0);
  const getLogicalTime = (item) => item.video.currentTime - getOffset(item);

  const clampVideoTime = (item, time) => {
    const max = Number.isFinite(item.video.duration) ? item.video.duration : Number.MAX_SAFE_INTEGER;
    return Math.min(Math.max(0, time), max);
  };

  const syncToLogicalTime = (logicalTime, targets = getActiveItems()) => {
    targets.forEach(item => {
      item.video.currentTime = clampVideoTime(item, logicalTime + getOffset(item));
    });
  };

  const syncActive = () => {
    const active = getActiveItems();
    if (active.length === 0) return;
    syncToLogicalTime(Math.max(0, getLogicalTime(active[0])), active);
  };

  const resetPlaybackRates = (targets = items) => {
    targets.forEach(item => {
      try { item.video.playbackRate = 1; } catch (_) {}
    });
  };

  const maintainSync = () => {
    const active = getActiveItems();
    const playing = active.filter(item => !item.video.paused && !item.video.ended);
    if (playing.length < 2) return;

    const reference = playing[0];
    const referenceTime = getLogicalTime(reference);
    reference.video.playbackRate = 1;

    playing.slice(1).forEach(item => {
      const drift = getLogicalTime(item) - referenceTime;
      const absoluteDrift = Math.abs(drift);

      if (absoluteDrift >= HARD_SYNC_TOLERANCE_SECONDS) {
        item.video.currentTime = clampVideoTime(item, referenceTime + getOffset(item));
        item.video.playbackRate = 1;
      } else if (absoluteDrift >= SYNC_TOLERANCE_SECONDS) {
        // 先行している動画は少し遅く、遅れている動画は少し速くして滑らかに追従させる。
        item.video.playbackRate = drift > 0 ? 0.94 : 1.06;
      } else {
        item.video.playbackRate = 1;
      }
    });
  };

  const runStartupSyncBurst = (active) => {
    const startedAt = performance.now();
    const align = () => {
      if (active.some(item => item.video.paused)) return;
      maintainSync();
      if (performance.now() - startedAt < 1400) {
        window.setTimeout(align, 40);
      } else {
        resetPlaybackRates(active);
        maintainSync();
      }
    };
    window.setTimeout(align, 0);
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
    resetPlaybackRates();
  }

  const setMode = (nextMode) => {
    if (mode !== nextMode) invalidatePreparedPlayback();
    if (nextMode === 'pair' && getPairItems().length !== 2) return;

    pauseEveryVideo();
    mode = nextMode;
    if (mode === 'multi') restoreNormalVideoAudio();
    refreshLayout();
    if (isMobileComposite()) { drawCompositeFrame(); document.body.classList.add('mobile-composite-active'); }
    setStatus('');
  };

  const VIDEO_FILE_PATTERN = /\.(mp4|m4v|mov|webm|ogv|ogg|avi|mkv)$/i;

  const isVideoFile = (file) => {
    // iOSのフォトライブラリから選んだファイルは、MIMEタイプが空になる場合がある。
    // MIMEタイプに加えてファイル名の拡張子でも判定する。
    return Boolean(
      file &&
      ((typeof file.type === 'string' && file.type.startsWith('video/')) ||
       VIDEO_FILE_PATTERN.test(file.name || ''))
    );
  };

  const addFiles = (fileList, { trustPicker = false } = {}) => {
    // iOSのフォトライブラリでは、MIMEタイプや拡張子が欠けることがある。
    // ファイル選択ダイアログから渡されたものは、判定で捨てずに読み込みを試す。
    const sourceFiles = Array.from(fileList || []).filter(file => file && file.size > 0);
    const files = trustPicker ? sourceFiles : sourceFiles.filter(isVideoFile);
    if (files.length === 0) {
      setStatus('選択した動画を読み込めませんでした。');
      return;
    }

    files.forEach(addVideo);
    updateColumnLayout();
    refreshLayout();
    setStatus('');
  };

  const addVideo = (file) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.video-card');
    const video = fragment.querySelector('video');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    const title = fragment.querySelector('.video-title');
    const removeButton = fragment.querySelector('.remove-button');
    const volume = fragment.querySelector('.volume-slider');
    const offset = fragment.querySelector('.start-offset');
    const seek = fragment.querySelector('.seek-slider');
    const currentTime = fragment.querySelector('.current-time');
    const duration = fragment.querySelector('.duration');
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

    const url = URL.createObjectURL(file);
    const item = {
      card, video, url, file, volume, offset, pairCheckbox,
      cropZoom, cropX, cropY, cropZoomOutput, cropXOutput, cropYOutput,
      audioSource: null
    };
    items.push(item);
    invalidatePreparedPlayback();

    title.textContent = file.name;
    title.title = file.name;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';
    video.controls = true;
    video.src = url;
    video.loop = false;

    // iOS SafariではDOMへ追加後にload()した方が安定する。
    requestAnimationFrame(() => {
      try { video.load(); } catch (error) { console.error(error); }
    });
    applyVolume(item);
    applyCrop(item);

    const markLoaded = () => {
      card.classList.add('video-loaded');
      card.classList.remove('video-error');
      duration.textContent = formatTime(video.duration);
    };
    video.addEventListener('loadedmetadata', markLoaded);
    video.addEventListener('loadeddata', markLoaded);
    video.addEventListener('canplay', markLoaded);

    video.addEventListener('error', () => {
      card.classList.add('video-error');
      title.title = `${file.name}（この端末では再生できない形式の可能性があります）`;
    });

    video.addEventListener('timeupdate', () => {
      currentTime.textContent = formatTime(video.currentTime);
      if (video.duration) seek.value = String((video.currentTime / video.duration) * 1000);
    });

    video.addEventListener('ended', () => {
      if (getActiveItems().includes(item)) {
        getActiveItems().forEach(other => other.video.pause());
        stopSyncMonitor();
      }
    });

    volume.addEventListener('input', () => applyVolume(item));
    offset.addEventListener('change', () => { invalidatePreparedPlayback(); syncActive(); });

    seek.addEventListener('input', () => {
      invalidatePreparedPlayback();
      if (!video.duration) return;
      const selectedVideoTime = (Number(seek.value) / 1000) * video.duration;
      const targets = getActiveItems().includes(item) ? getActiveItems() : [item];
      syncToLogicalTime(Math.max(0, selectedVideoTime - getOffset(item)), targets);
    });

    [cropZoom, cropX, cropY].forEach(control => {
      control.addEventListener('input', () => { applyCrop(item); if (isMobileComposite()) drawCompositeFrame(); });
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
      invalidatePreparedPlayback();
      if (pairCheckbox.checked && getPairItems().length > 2) {
        pairCheckbox.checked = false;
        setStatus('並列再生に選択できる動画は2本です。先に選択中の動画を外してください。');
      } else {
        const count = getPairItems().length;
        setStatus(count === 2
          ? '2本選択しました。「並列動画モード」を押すと横に連結します。'
          : `並列再生する動画をあと${2 - count}本選択してください。`);
      }
      refreshLayout();
    });

    removeButton.addEventListener('click', () => removeItem(item));
    videoGrid.appendChild(fragment);
  };

  const removeItem = (item) => {
    item.video.pause();
    URL.revokeObjectURL(item.url);
    item.card.remove();
    const index = items.indexOf(item);
    if (index >= 0) items.splice(index, 1);
    invalidatePreparedPlayback();

    if (mode === 'pair' && getPairItems().length !== 2) mode = 'multi';
    if (getPairItems().length < 2) pairReversed = false;
    stopSyncMonitor();
    updateColumnLayout();
    refreshLayout();
    setStatus('動画を削除しました。');
  };

  const waitUntilReady = (video) => new Promise(resolve => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve();
      return;
    }
    const finish = () => resolve();
    video.addEventListener('canplay', finish, { once: true });
    video.addEventListener('loadeddata', finish, { once: true });
  });

  const waitForEventOrTimeout = (target, eventName, timeoutMs = 1800) => new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      target.removeEventListener(eventName, finish);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    target.addEventListener(eventName, finish, { once: true });
  });

  let startingPlayback = false;

  const playActive = () => {
    if (startingPlayback) return;

    const active = getActiveItems();
    if (active.length === 0) return;
    if (mode === 'pair' && active.length !== 2) return;

    pauseEveryVideo();
    const logicalStart = Math.max(0, getLogicalTime(active[0]));
    syncToLogicalTime(logicalStart, active);
    resetPlaybackRates(active);
    startingPlayback = true;

    if (isMobileComposite()) startPairFrameCompositor();

    const playPromises = active.map(item => {
      try {
        const result = item.video.play();
        return result && typeof result.then === 'function' ? result : Promise.resolve();
      } catch (error) {
        return Promise.reject(error);
      }
    });

    Promise.allSettled(playPromises).then(results => {
      if (results.some(result => result.status === 'fulfilled')) {
        syncToLogicalTime(logicalStart, active);
        startSyncMonitor();
        runStartupSyncBurst(active);
      } else {
        stopPairFrameCompositor();
      }
    }).finally(() => {
      startingPlayback = false;
    });
  };

  const pauseActive = () => {
    getActiveItems().forEach(item => item.video.pause());
    stopSyncMonitor();
    if (isMobileComposite()) drawCompositeFrame();
    setStatus('一時停止しました。');
  };

  const restartActive = () => {
    invalidatePreparedPlayback();
    stopPairFrameCompositor();
    syncToLogicalTime(0);
    if (mode === 'pair') window.setTimeout(() => drawPairCanvasFrame(getPairItems()), 80);
    setStatus('表示中の動画を開始位置へ戻しました。');
  };


  const ensureAudioGraph = (pairItems) => {
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
      return recorderFormats.find(format => format.value === selected) || { value: selected, extension: selected.includes('mp4') ? 'mp4' : 'webm' };
    }
    const automatic = recorderFormats.slice(1).find(format => MediaRecorder.isTypeSupported(format.value));
    return automatic || { value: '', extension: 'webm' };
  };

  const exportPairVideo = async () => {
    const pairItems = getPairItems();
    if (mode !== 'pair' || pairItems.length !== 2 || isExporting) {
      setStatus('並列モードで動画を2本選択してください。');
      return;
    }
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      setStatus('このブラウザは動画の書き出しに対応していません。ChromeまたはEdgeを使用してください。');
      return;
    }

    isExporting = true;
    document.body.classList.add('exporting');
    exportProgress.hidden = false;
    exportProgressBar.value = 0;
    exportProgressText.textContent = '0%';
    refreshLayout();
    const previousTimes = pairItems.map(item => item.video.currentTime);
    const previousPaused = pairItems.map(item => item.video.paused);
    const previousLoops = pairItems.map(item => item.video.loop);

    try {
      pauseEveryVideo();
      await Promise.all(pairItems.map(item => waitUntilReady(item.video)));
      await ensureAudioGraph(pairItems);
      pairItems.forEach(item => { item.video.loop = false; });
      syncToLogicalTime(0, pairItems);

      const width = Math.min(3840, Math.max(320, Number(pairWidth.value) || 1280));
      const height = Math.min(2160, Math.max(180, Number(pairHeight.value) || 720));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      const fps = 30;
      const canvasStream = canvas.captureStream(fps);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ]);
      const recorderFormat = chooseRecorderFormat();
      const mimeType = recorderFormat.value;
      const requestedBitrate = Number(exportBitrate.value) || 8_000_000;
      const recorderOptions = { videoBitsPerSecond: requestedBitrate };
      if (mimeType) recorderOptions.mimeType = mimeType;
      const recorder = new MediaRecorder(combinedStream, recorderOptions);
      const chunks = [];
      recorder.addEventListener('dataavailable', event => {
        if (event.data.size > 0) chunks.push(event.data);
      });

      const usableDurations = pairItems.map(item => Math.max(0, item.video.duration - getOffset(item)));
      const exportDuration = Math.min(...usableDurations);
      if (!Number.isFinite(exportDuration) || exportDuration <= 0) throw new Error('書き出せる再生時間がありません。');

      let animationFrame = 0;
      const render = () => {
        context.fillStyle = '#000';
        context.fillRect(0, 0, width, height);
        const halfWidth = width / 2;
        drawCroppedVideo(context, pairItems[0], 0, 0, halfWidth, height);
        drawCroppedVideo(context, pairItems[1], halfWidth, 0, width - halfWidth, height);
        const progress = Math.min(exportDuration, Math.max(0, getLogicalTime(pairItems[0])));
        const percent = Math.min(100, Math.max(0, (progress / exportDuration) * 100));
        exportProgressBar.value = percent;
        exportProgressText.textContent = `${percent.toFixed(1)}%`;
        setStatus(`⬇ ${formatTime(progress)} / ${formatTime(exportDuration)} を書き出しています…`);
        if (recorder.state === 'recording') animationFrame = requestAnimationFrame(render);
      };

      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener('stop', resolve, { once: true });
        recorder.addEventListener('error', event => reject(event.error), { once: true });
      });
      recorder.start(1000);
      render();
      await Promise.all(pairItems.map(item => item.video.play()));

      await new Promise(resolve => {
        const check = () => {
          const elapsed = getLogicalTime(pairItems[0]);
          if (elapsed >= exportDuration - 0.04 || pairItems.some(item => item.video.ended)) resolve();
          else setTimeout(check, 100);
        };
        check();
      });
      pairItems.forEach(item => item.video.pause());
      recorder.stop();
      await stopped;
      cancelAnimationFrame(animationFrame);
      combinedStream.getTracks().forEach(track => track.stop());

      const outputType = recorder.mimeType || mimeType || 'video/webm';
      const blob = new Blob(chunks, { type: outputType });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const extension = outputType.includes('mp4') ? 'mp4' : recorderFormat.extension || 'webm';
      link.download = `parallel-video-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 30_000);
      exportProgressBar.value = 100;
      exportProgressText.textContent = '100%';
      setStatus('並列動画を保存しました。');
    } catch (error) {
      console.error(error);
      setStatus(`書き出しに失敗しました: ${error.message || error}`);
    } finally {
      pairItems.forEach((item, index) => {
        item.video.pause();
        item.video.loop = previousLoops[index];
        item.video.currentTime = clampVideoTime(item, previousTimes[index]);
      });
      for (let index = 0; index < pairItems.length; index += 1) {
        if (!previousPaused[index]) pairItems[index].video.play().catch(() => {});
      }
      isExporting = false;
      document.body.classList.remove('exporting');
      setTimeout(() => {
        exportProgress.hidden = true;
        exportProgressBar.value = 0;
        exportProgressText.textContent = '0%';
      }, 800);
      refreshLayout();
    }
  };

  fileInput.addEventListener('change', () => {
    const selectedFiles = Array.from(fileInput.files || []);
    // フォトライブラリ由来のFileはMIMEタイプや拡張子が欠ける場合があるため、
    // picker経由では形式判定で除外せず追加を試みる。
    addFiles(selectedFiles, { trustPicker: true });
    // iOSではDOM追加が完了した次のフレームでもう一度本数を基準に再計算する。
    requestAnimationFrame(() => {
      updateColumnLayout();
      refreshLayout();
    });
    window.setTimeout(() => { fileInput.value = ''; }, 0);
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
    // ラベル内のfile inputはブラウザ標準で開くため、親のクリック処理を重ねない。
    if (event.target.closest('.file-button')) return;
    fileInput.click();
  });
  dropZone.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') fileInput.click();
  });

  multiModeButton.addEventListener('click', () => setMode('multi'));
  pairModeButton.addEventListener('click', () => setMode('pair'));
  document.getElementById('playAll').addEventListener('click', playActive);
  document.getElementById('pauseAll').addEventListener('click', pauseActive);
  document.getElementById('restartAll').addEventListener('click', restartActive);
  document.getElementById('syncAll').addEventListener('click', () => {
    invalidatePreparedPlayback();
    syncActive();
    if (mode === 'pair') window.setTimeout(() => drawPairCanvasFrame(getPairItems()), 80);
    setStatus('表示中の動画の再生位置をそろえました。');
  });
  document.getElementById('removeAll').addEventListener('click', () => {
    pauseEveryVideo();
    [...items].forEach(item => {
      URL.revokeObjectURL(item.url);
      item.card.remove();
    });
    items.length = 0;
    mode = 'multi';
    updateColumnLayout({ forceAuto: true });
    refreshLayout();
    setStatus('すべての動画を削除しました。');
  });

  pairWidth.addEventListener('change', applyPairSize);
  pairHeight.addEventListener('change', applyPairSize);
  pairWidth.addEventListener('input', applyPairSize);
  pairHeight.addEventListener('input', applyPairSize);
  swapPair.addEventListener('click', () => {
    invalidatePreparedPlayback();
    if (getPairItems().length !== 2) {
      setStatus('左右を入れ替えるには動画を2本選択してください。');
      return;
    }
    pairReversed = !pairReversed;
    refreshLayout();
    setStatus('左右の動画を入れ替えました。');
  });

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

  let responsiveUpdateTimer = null;
  const scheduleResponsiveUpdate = () => {
    clearTimeout(responsiveUpdateTimer);
    responsiveUpdateTimer = setTimeout(() => {
      updateColumnLayout();
      fitPairToViewport();
      if (mode === 'pair') { resizePairCanvas(); drawPairCanvasFrame(getPairItems()); }
    }, 180);
  };

  window.addEventListener('resize', scheduleResponsiveUpdate);
  window.addEventListener('orientationchange', scheduleResponsiveUpdate);
  window.visualViewport?.addEventListener('resize', scheduleResponsiveUpdate);

  window.addEventListener('beforeunload', () => {
    stopSyncMonitor();
    items.forEach(item => URL.revokeObjectURL(item.url));
  });

  applyPairSize();
  updateColumnLayout();
  refreshLayout();
})();

