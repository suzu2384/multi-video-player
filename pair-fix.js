(() => {
  const grid = document.getElementById('videoGrid');
  if (!grid) return;

  const fix = () => {
    if (grid.classList.contains('pair-count-2')) {
      grid.querySelectorAll('.pair-left,.pair-right').forEach(card => {
        card.classList.remove('pair-top-left','pair-top-right','pair-bottom-left','pair-bottom-right');
      });
    }

    grid.querySelectorAll('.pair-move').forEach(button => {
      const shouldHide = button.disabled;
      if (button.hidden !== shouldHide) button.hidden = shouldHide;
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
