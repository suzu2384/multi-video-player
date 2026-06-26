(() => {
  const grid = document.getElementById('videoGrid');
  if (!grid) return;

  const setStyle = (element, property, value) => {
    if (element.style[property] !== value) element.style[property] = value;
  };

  const fix = () => {
    if (grid.classList.contains('pair-count-2')) {
      grid.querySelectorAll('.pair-left,.pair-right').forEach(card => {
        card.classList.remove('pair-top-left','pair-top-right','pair-bottom-left','pair-bottom-right');
      });
    }

    grid.querySelectorAll('.pair-move-controls').forEach(controls => {
      const buttons = [...controls.querySelectorAll('.pair-move')];
      buttons.forEach(button => {
        setStyle(button, 'display', button.disabled ? 'none' : '');
        if (!button.disabled) {
          setStyle(button, 'gridColumn', 'auto');
          setStyle(button, 'gridRow', 'auto');
        }
      });

      const visibleCount = buttons.filter(button => !button.disabled).length;
      setStyle(controls, 'display', grid.classList.contains('pair-mode') && visibleCount > 0 ? 'flex' : 'none');
      setStyle(controls, 'width', 'fit-content');
      setStyle(controls, 'height', 'fit-content');
      setStyle(controls, 'gridTemplateColumns', 'none');
      setStyle(controls, 'gridTemplateRows', 'none');
      setStyle(controls, 'alignItems', 'center');
    });
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

  new MutationObserver(() => requestAnimationFrame(fix)).observe(grid, { childList: true, subtree: true, attributes: true });
  requestAnimationFrame(fix);
  showVersion();
})();
