(() => {
  const grid = document.getElementById('videoGrid');
  if (!grid) return;
  const fix = () => {
    if (!grid.classList.contains('pair-count-2')) return;
    grid.querySelectorAll('.pair-left,.pair-right').forEach(card => {
      card.classList.remove('pair-top-left','pair-top-right','pair-bottom-left','pair-bottom-right');
    });
  };
  new MutationObserver(() => requestAnimationFrame(fix)).observe(grid, { childList: true, subtree: true, attributes: true });
  requestAnimationFrame(fix);
})();
