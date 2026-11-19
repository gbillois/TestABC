// TestABC: renders test cards (home page and category menus). Data only, no network.
(function () {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function card(t) {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = t.href;
    a.innerHTML = `
      <div class="media">
        ${t.poster ? `<img src="${esc(t.poster)}" alt="" loading="lazy">` : ''}
        ${t.preview ? `<video muted loop playsinline preload="none" src="${esc(t.preview)}"></video>` : ''}
        <span class="num">${esc(t.n)}</span><span class="badge">${esc(t.badge || 'READY')}</span>
      </div>
      <div class="body">
        <div class="kind">${esc(t.kind)}</div>
        <h2>${esc(t.title)}</h2>
        <p>${esc(t.desc)}</p>
        <div class="tags">${(t.tags || []).map(x => `<span>${esc(x)}</span>`).join('')}</div>
        <div class="specs">${(t.specs || []).map(esc).join('<span>·</span>')}</div>
      </div>`;
    const v = a.querySelector('video');
    if (v) {
      a.addEventListener('mouseenter', () => { v.play().then(() => v.classList.add('playing')).catch(() => {}); });
      a.addEventListener('mouseleave', () => { v.pause(); v.classList.remove('playing'); });
    }
    return a;
  }

  function slot(n, label) {
    const d = document.createElement('div');
    d.className = 'slot';
    d.innerHTML = `<div><b>${esc(String(n).padStart(2, '0'))}</b><span>${esc(label || 'NEXT TEST SLOT')}</span></div>`;
    return d;
  }

  window.TestCards = { card, slot, esc };
})();
