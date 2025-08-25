document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('images_map.json', {cache:'no-store'});
    const MAP = await res.json();

    const norm = s => (s||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/\b(upper|lower)\b/g,'')
      .replace(/(falls?|waterfall|michigan|wisconsin|state|park|county|river|creek|branch|fork)/g,'')
      .replace(/[^a-z0-9]+/g,'')
      .trim();

    const score = (a,b) => {
      if (!a||!b) return 0;
      if (a.includes(b) || b.includes(a)) return Math.min(a.length,b.length);
      let best=0, run=0;
      for (let i=0;i<b.length;i++){ run = a.includes(b[i]) ? run+1 : 0; best=Math.max(best,run); }
      return best;
    };

    const chooseFile = (text) => {
      const key = norm(text);
      if (!key) return null;
      let bestK=null, bestS=0;
      for (const k of Object.keys(MAP)) {
        const s = score(key,k);
        if (s > bestS) { bestS=s; bestK=k; }
      }
      return bestS >= 4 ? MAP[bestK] : null;
    };

    const setImg = (img, file) => {
      if (!file) return;
      const url = 'images/' + file.replace(/^\/+/, '');
      // handle lazy loaders
      img.removeAttribute('loading');
      img.removeAttribute('decoding');
      img.setAttribute('src', url);
      img.setAttribute('srcset', url);
      img.setAttribute('data-src', url);
      img.setAttribute('data-srcset', url);
      // if picture sources exist, update them too
      const pic = img.closest('picture');
      if (pic) pic.querySelectorAll('source').forEach(s => {
        s.setAttribute('srcset', url);
        s.setAttribute('data-srcset', url);
      });
    };

    // Try to infer the card title near each image
    const imgs = Array.from(document.querySelectorAll('img'));
    imgs.forEach(img => {
      // Only rewrite placeholders or local images
      const src = img.getAttribute('src') || '';
      if (!/placeholder\.svg$|^images\//.test(src)) return;

      // collect nearby text: headings/labels in ancestors
      let text = '';
      let node = img;
      for (let hops=0; node && hops<6; hops++, node=node.parentElement) {
        const bits=[];
        node.querySelectorAll?.('h1,h2,h3,h4,h5,h6,[data-name],[aria-label],[title],strong,b').forEach(el=>{
          const v = el.getAttribute?.('data-name') || el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.textContent || '';
          if (v) bits.push(v);
        });
        if (node!==img) bits.push(node.textContent||'');
        text = (bits.join(' ') + ' ' + text).trim();
        if (text.length > 500) break;
      }
      const file = chooseFile(text);
      if (file) setImg(img, file);
    });

    // Also handle CSS backgrounds that reference placeholder or /images/
    document.querySelectorAll('*').forEach(el=>{
      const st = getComputedStyle(el).backgroundImage || '';
      const m = st.match(/url\(["']?([^"')]+)["']?\)/i);
      if (!m) return;
      const bg = m[1];
      if (!/placeholder\.svg$|\/images\//.test(bg)) return;
      // same text context approach
      let text = el.textContent || '';
      let node = el;
      for (let hops=0; node && hops<4; hops++, node=node.parentElement) {
        const v = node.getAttribute?.('aria-label') || node.getAttribute?.('title') || '';
        text = (v + ' ' + text).trim();
      }
      const file = chooseFile(text);
      if (file) el.style.backgroundImage = `url("images/${file.replace(/^\/+/, '')}")`;
    });
  } catch (e) {
    console.error('image mapper error:', e);
  }
});
