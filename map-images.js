document.addEventListener('DOMContentLoaded', async () => {
  // wait a bit in case your page builds cards with JS
  await new Promise(r => setTimeout(r, 500));

  // helper: simple CSV parser for the first two columns (waterfall,file)
  async function loadPairs() {
    const res = await fetch('images_attribution.csv', {cache:'no-store'});
    const txt = await res.text();
    const lines = txt.split(/\r?\n/).slice(1).filter(Boolean);
    const pairs = [];
    for (const line of lines) {
      // very simple split: waterfall name is first cell, filename second
      // (author_html may contain commas later — we ignore those)
      const cells = line.split(',');
      if (cells.length < 2) continue;
      const name = cells[0].trim().replace(/^"|"$/g,'');
      const file = cells[1].trim().replace(/^"|"$/g,'');
      if (name && file) pairs.push([name, file]);
    }
    return pairs;
  }

  const norm = s => (s||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/\b(upper|lower)\b/g,'')
    .replace(/\b(falls?|waterfall|michigan|wisconsin|state|park|county|river|creek|branch|fork)\b/g,'')
    .replace(/[^a-z0-9]+/g,'')
    .trim();

  const pairs = await loadPairs();              // [[name, file], ...]
  const keys  = pairs.map(([n,f]) => [norm(n), f, n]); // [key, file, originalName]

  // Index card-like blocks once; this is cheap & robust
  const blocks = Array.from(document.querySelectorAll('section, article, li, .card, .item, div'));
  // Only keep blocks that contain an <img>
  const cardBlocks = blocks.filter(b => b.querySelector('img'));

  const trySet = (block, file) => {
    const img = block.querySelector('img');
    if (!img) return false;
    const src = img.getAttribute('src') || '';
    if (!/placeholder\.svg$|^images\//.test(src)) return false;
    const url = 'images/' + file.replace(/^\/+/, '');
    img.removeAttribute('loading'); img.removeAttribute('decoding');
    img.setAttribute('src', url);
    img.setAttribute('srcset', url);
    // update <picture> <source> too
    const pic = img.closest('picture');
    if (pic) pic.querySelectorAll('source').forEach(s => s.setAttribute('srcset', url));
    return true;
  };

  let updates = 0;

  // Build searchable text per block once
  const blockText = new Map();
  const getText = (el) => {
    if (blockText.has(el)) return blockText.get(el);
    let t = '';
    el.querySelectorAll('h1,h2,h3,h4,h5,h6,[data-name],[aria-label],[title],strong,b').forEach(n=>{
      const v = n.getAttribute?.('data-name') || n.getAttribute?.('aria-label') || n.getAttribute?.('title') || n.textContent || '';
      if (v) t += ' ' + v;
    });
    t += ' ' + (el.textContent || '');
    t = t.replace(/\s+/g,' ').trim();
    blockText.set(el, t);
    return t;
  };

  // Pass 1: exact (case-insensitive) substring match using ORIGINAL names
  for (const [_, file, original] of keys) {
    const rx = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i');
    for (const block of cardBlocks) {
      if (rx.test(getText(block))) {
        if (trySet(block, file)) updates++;
      }
    }
  }

  // Pass 2: normalized matching for any leftovers
  for (const block of cardBlocks) {
    const img = block.querySelector('img');
    if (!img) continue;
    const src = img.getAttribute('src') || '';
    if (!/placeholder\.svg$|^images\//.test(src)) continue; // already set or external

    const key = norm(getText(block));
    if (!key) continue;

    // choose the best normalized key by longest common substring
    let bestK = null, bestS = 0, bestFile = null;
    for (const [k, file] of keys) {
      // quick score: substring or longest common run
      let s = 0;
      if (key.includes(k) || k.includes(key)) s = Math.min(key.length, k.length);
      else {
        let run=0; for (let i=0;i<k.length;i++){ run = key.includes(k[i]) ? run+1 : 0; s = Math.max(s, run); }
      }
      if (s > bestS) { bestS = s; bestK = k; bestFile = file; }
    }
    if (bestFile && bestS >= 4) {
      if (trySet(block, bestFile)) updates++;
    }
  }

  // Optional: log a tiny summary for debugging (won't break anything)
  console.log('[mapper] updated images:', updates);
});
