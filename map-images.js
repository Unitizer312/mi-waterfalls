document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load normalizedName -> filename map (built earlier as images_map.json)
    const res = await fetch('images_map.json', {cache: 'no-store'});
    const MAP = await res.json();

    const norm = s => (s||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/\b(upper|lower)\b/g,'')
      .replace(/(falls?|waterfall|michigan|wisconsin|state|park|county|river|creek|branch|fork)/g,'')
      .replace(/[^a-z0-9]+/g,'')
      .trim();

    // simple score: prefer substring/starts-with relations or longest run
    const score = (a,b) => {
      if (!a || !b) return 0;
      if (a.includes(b) || b.includes(a)) return Math.min(a.length,b.length);
      let best=0, run=0;
      for (let i=0;i<b.length;i++){ run = a.includes(b[i]) ? run+1 : 0; best = Math.max(best, run); }
      return best;
    };

    const imgs = Array.from(document.querySelectorAll('img'));
    imgs.forEach(img => {
      const src = img.getAttribute('src') || '';
      // only rewrite placeholders or existing local images
      if (!/placeholder\.svg$|^images\//.test(src)) return;

      // collect nearby text up the DOM for context
      let t = '';
      let node = img;
      for (let hops=0; node && hops<6; hops++, node=node.parentElement) {
        const bits = [];
        node.querySelectorAll?.('h1,h2,h3,h4,h5,h6,[data-name],[aria-label],[title],strong,b').forEach(el=>{
          const v = el.getAttribute?.('data-name') || el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.textContent || '';
          if (v) bits.push(v);
        });
        if (node !== img) bits.push(node.textContent||'');
        t = (bits.join(' ') + ' ' + t).trim();
        if (t.length > 400) break;
      }

      const key = norm(t);
      if (!key) return;

      // choose best match from MAP
      let bestK = null, bestS = 0;
      for (const k of Object.keys(MAP)) {
        const s = score(key,k);
        if (s > bestS) { bestS = s; bestK = k; }
      }

      if (bestK && bestS >= 4) {
        const file = MAP[bestK];
        if (file) img.setAttribute('src', 'images/' + file.replace(/^\/+/, ''));
      }
    });
  } catch (e) {
    console.error('image mapper error:', e);
  }
});
