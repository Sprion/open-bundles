/*
 * Behaviour of the ob-bundle offer block (snippets/ob-bundle*.liquid), for every design.
 * Reads the bundle's bars (data-ob-tiers), the product variants and options, then:
 *  - keeps one choice {c: colour, s: size} per item of the chosen bar (bar defaults, colour mixes, bundle defaults);
 *  - draws the item pickers in the bundle's mode (data-picker): swatches, rows or tiles;
 *  - redraws every bar's numbers with the chosen variants (same maths as the open-bundles discount function:
 *    most expensive units paid, the cheapest `free` ones free, then the bar's saving);
 *  - adds the bundle to the cart (gifts flagged _ob_gift, cart attribute _ob so the discount function prices it).
 * Several blocks can live on one page (A/B versions, ?ob previews): hidden ones are not started.
 */
(() => {
  if (window.obBundle) return;
  window.obBundle = true;
  const fillVars = (text, v) => String(text ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (v[k] ?? m));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Every word the block shows. Same keys and defaults as UI_TEXTS in apps/experiments/core.py; bundle.ui (editor) wins.
  const UI = {
    free: 'FREE', sold_out: 'Sold out', locked: 'Locked', select: 'Select', add_one: 'Add to cart', add_many: 'Add {{count}} {{noun}} to cart',
    adding: 'Adding…', add_error: 'Unable to add to cart. Please try again.', choose_options: 'Choose your options', select_size: 'Select a size',
    choose_sizes: 'Choose {{unit}} sizes', choose_size: 'Choose a size.', size_guide: 'Size guide', done: 'Done', apply_all: 'Apply to all ({{count}})',
    custom_mix: 'Custom Pack', no_size_guide: 'Size measurements for this product are not available yet. Please contact us before ordering.', more: '+{{count}} More', combo_sold_out: 'This combination is sold out. Choose another size or colour.', save_tag: 'Save {{saved}}',
    pb_title: 'Build your own pack', pb_size: '1. Choose your size', pb_colors: '2. Add your colours', pb_count: '{{count}} {{noun}} in your pack',
    pb_next: 'Add {{left}} more: {{next}}', pb_min: 'Add at least {{min}} {{noun}}', pb_best: 'From {{unit_price}} / {{unit}}',
    pb_cta: 'Add {{count}} {{noun}} to cart · {{price}}', pb_back: 'Close',
  };

  function init(root) {
    if (root.dataset.ready) return;
    const ver = root.closest('[data-ob-version]');
    if (ver && getComputedStyle(ver).display === 'none') return;
    root.dataset.ready = '1';
    const ds = root.dataset;
    let ui = {}; try { ui = JSON.parse(ds.ui || '{}'); } catch { ui = {}; }
    const T = (k, v = {}) => fillVars(ui[k] || UI[k] || '', v);
    const J = (s) => JSON.parse(root.querySelector(s).textContent);
    const tiers = J('[data-ob-tiers]'), variants = J('[data-ob-variants]'), O = J('[data-ob-opts]');
    const CI = O.color, SI = O.size, cName = CI >= 0 ? O.names[CI] : 'Color', sName = SI >= 0 ? O.names[SI] : 'Size';
    const req = 'requireSel' in ds, oneVar = 'oneVariant' in ds, hideUn = 'hideUnavailable' in ds, tilesMode = ds.picker === 'tiles';
    const swc = ds.swColors ? JSON.parse(ds.swColors) : {}, mult = Number(ds.cmpMult) || 1;
    const fmt = new Intl.NumberFormat(document.documentElement.lang || 'en', { style: 'currency', currency: ds.currency || 'USD' });
    const money = (c) => fmt.format(c / 100), short = (c) => money(c).replace(/[.,]00(?=\D*$)/, '');
    const bars = [...root.querySelectorAll('[data-ob-bar]')], list = root.querySelector('[data-ob-list]'), panel = root.querySelector('[data-ob-panel]');
    const sheet = root.querySelector('[data-ob-sheet]'), scope = ver || root.parentElement;
    const atc = null;
    const btn = root.querySelector('[data-ob-cta]');
    const btnLabel = btn?.querySelector('[data-ob-cta-label]');
    const status = root.querySelector('[data-ob-status]');
    if (atc && btn) { // the page's own button takes the bundle's button look
      if (ds.btnBg) { btn.style.background = ds.btnBg; btn.style.borderColor = ds.btnBg; }
      if (ds.btnFg) btn.style.color = ds.btnFg;
      if (ds.ctaRadius) btn.style.borderRadius = `${ds.ctaRadius}px`;
      if (ds.ctaH) { btn.style.minHeight = `${ds.ctaH}px`; btn.style.paddingTop = '0'; btn.style.paddingBottom = '0'; btn.style.alignContent = 'center'; }
      if (ds.ctaSize) btn.style.fontSize = `${ds.ctaSize}px`;
      if (ds.ctaWeight) btn.style.fontWeight = ds.ctaWeight;
      if (ds.ctaCase) { btn.style.textTransform = ds.ctaCase === 'upper' ? 'uppercase' : 'none'; btn.style.letterSpacing = ds.ctaCase === 'upper' ? '.02em' : '0'; }
      if ('ctaNomark' in ds) { // flat button, text centred, no mountain mark
        btn.querySelectorAll(':scope > svg, :scope > img').forEach((m) => { m.style.display = 'none'; });
        btn.style.gridTemplateColumns = '1fr'; btn.style.justifyItems = 'center'; btn.style.boxShadow = 'none';
      }
    }

    const opt = (v, i) => (i >= 0 ? v.options[i] : null);
    const match = (v, c, s) => (CI < 0 || v.options[CI] === c) && (SI < 0 || v.options[SI] === s);
    const findV = (c, s) => variants.find((v) => match(v, c, s));
    const live = (c, s) => variants.some((v) => v.available && (c == null || CI < 0 || v.options[CI] === c) && (s == null || SI < 0 || v.options[SI] === s));
    const colors = (CI >= 0 ? O.values[CI] : []).filter((c) => !hideUn || live(c, null));
    const sizes = (SI >= 0 ? O.values[SI] : []).filter((s) => !hideUn || live(null, s));
    const pv = variants.find((v) => v.available) || variants[0];
    const img = (c, w = 400) => {
      const v = variants.find((x) => (CI < 0 || x.options[CI] === c) && x.featured_image?.src);
      let u = v?.featured_image?.src || O.fallback || '';
      if (!u) return '';
      if (u.startsWith('//')) u = 'https:' + u;
      try { const x = new URL(u); x.searchParams.set('width', w); return x.href; } catch { return u; }
    };
    const swatchStyle = (c) => (swc[c] ? `background:${swc[c]}` : `background-image:url('${img(c, 160)}')`);

    let items = [], touched = false, mixName = '', cur = 0, adding = false, gSize = '';
    const sizeFirst = 'sizeFirst' in ds && SI >= 0, gBox = root.querySelector('[data-ob-gsize]');
    const activeI = () => Math.max(0, bars.findIndex((b) => b.querySelector('input').checked));
    const unitsOf = (i) => (Number(tiers[i].buy) || 1) + (Number(tiers[i].free) || 0);
    const shown = () => (oneVar ? 1 : unitsOf(activeI()));

    // Choices of the bar's items: kept when the shopper already chose, else the bar's defaults, its first colour
    // mix, the bundle's default colour/size, or distinct colours (first = the page's variant).
    const defaultsFor = (i) => {
      const t = tiers[i], n = unitsOf(i), d = t.defaults || [], mix = (t.mixes || [])[0], out = [];
      const baseC = colors.includes(ds.defColor) ? ds.defColor : null;
      for (let k = 0; k < n; k++) {
        const prev = touched ? items[k] : null;
        let c = prev?.c ?? (d[k]?.color || (mix ? mix.colors[k % mix.colors.length] : '') || baseC || '');
        if (!c && CI >= 0) {
          const taken = out.map((x) => x.c);
          c = k === 0 && opt(pv, CI) ? opt(pv, CI) : colors.find((x) => !taken.includes(x) && live(x, null)) || colors[0];
        }
        let s = prev?.s ?? (sizeFirst ? gSize : req ? '' : d[k]?.size || ds.defSize || (SI >= 0 ? opt(pv, SI) || sizes[0] : ''));
        if (req && !tilesMode && !prev) c = '';
        if (s && c && !live(c, s) && !req) s = sizes.find((z) => live(c, z)) || s;
        out.push({ c, s });
      }
      return out;
    };

    const priceOf = (i) => {
      const t = tiers[i], n = unitsOf(i), buy = Number(t.buy) || 1;
      const chosen = Array.from({ length: n }, (_, k) => { const it = items[oneVar ? 0 : k]; return (it && findV(it.c, it.s)) || pv; });
      const ps = chosen.map((v) => v.price).sort((a, b) => b - a), paid = ps.slice(0, buy).reduce((s, p) => s + p, 0);
      const giftCmp = (t.gifts || []).filter((g) => g.type === 'product' && g.in_compare).reduce((s, g) => s + Math.round((Number(g.price) || 0) * 100), 0);
      const one = (v) => (mult > 1 ? Math.round(v.price * mult) : ds.design === 'boxed' && v.compare_at_price > v.price ? v.compare_at_price : v.price);
      const was = chosen.reduce((s, v) => s + one(v), 0) + giftCmp, val = Number(t.off?.value) || 0;
      let off = 0;
      if (t.off?.type === 'amount') off = Math.min(Math.round(val * 100), paid);
      else if (t.off?.type === 'price') off = Math.max(0, paid - Math.round(val * 100));
      else if (t.off?.type === 'percent') off = Math.round((paid * Math.min(val, 100)) / 100);
      return { total: paid - off, was, size: n, onlyAmount: t.off?.type === 'amount' && !t.free };
    };
    const varsOf = (p, exact) => ({ saved_percentage: `${p.was ? Math.round(((p.was - p.total) / p.was) * 100) : 0}%`, saved_total: exact ? money(p.was - p.total) : short(p.was - p.total),
      price: money(p.total), unit_price: money(p.total / p.size), quantity: String(p.size) });

    // Bar thumbnails (bundle bar_thumbs "stack"): the paid items' photos, "+", then the free items' photos or the
    // bar's gift photos, with "2" / "2 FREE" captions when items are free.
    const thumbs = (t) => {
      const buy = Number(t.buy) || 1, free = Number(t.free) || 0, start = Math.max(0, colors.indexOf(opt(pv, CI)));
      const col = (j) => (colors.length ? colors[(start + j) % colors.length] : null);
      const pics = (n, from) => Array.from({ length: Math.min(n, 2) }, (_, j) => `<img src="${esc(img(col(from + j), 160))}" alt="" loading="lazy">`).join('');
      const gifts = (t.gifts || []).filter((g) => g.type === 'product' && g.image && (!g.ladder || 'ladderInBars' in ds));
      const right = free ? pics(free, buy) : gifts.slice(0, 1).map((g) => `<img src="${esc(g.image + (g.image.includes('?') ? '&' : '?') + 'width=160')}" alt="" loading="lazy">`).join('');
      const cap = (txt, cls = '') => (free ? `<small class="${cls}">${esc(txt)}</small>` : '');
      return `<span class="ob__tg"><span class="ob__ts">${pics(buy, 0)}</span>${cap(buy)}</span>${right ? `<b class="ob__tplus">+</b><span class="ob__tg"><span class="ob__ts">${right}</span>${cap(`${free} ${T('free')}`, 'is-free')}</span>` : ''}`;
    };
    const drawBars = () => {
      const ai = activeI();
      bars.forEach((b, i) => {
        const t = tiers[i], p = priceOf(i), v = varsOf(p);
        b.classList.toggle('is-on', i === ai);
        const th = b.querySelector('[data-ob-thumbs]');
        if (th && !th.dataset.done) { th.innerHTML = 'one' in th.dataset ? `<img src="${esc(img(colors.length ? colors[i % colors.length] : null, 240))}" alt="" loading="lazy">` : thumbs(t); th.dataset.done = '1'; }
        b.querySelector('[data-ob-price]').textContent = money(p.total);
        b.querySelector('[data-ob-was]').textContent = p.was > p.total ? money(p.was) : '';
        b.querySelector('[data-ob-title]').textContent = fillVars(t.label || p.size, v);
        const sub = b.querySelector('[data-ob-sub]'); if (sub) sub.textContent = fillVars(t.sub, v);
        const badge = b.querySelector('[data-ob-badge]'); if (badge) badge.textContent = fillVars(t.badge, v);
        const tagEl = b.querySelector('[data-ob-tag]');
        if (tagEl) tagEl.textContent = t.sold_out ? T('sold_out') : t.tag ? fillVars(t.tag, v)
          : /^(classic|cards)$/.test(ds.design) && !('hideSave' in ds) && !ds.saveText && p.was > p.total ? T('save_tag', { saved: p.onlyAmount ? v.saved_total : v.saved_percentage }) : '';
        b.querySelectorAll('[data-ob-save]').forEach((pill) => {
          const txt = t.save_text || ds.saveText;
          pill.textContent = fillVars(txt, varsOf(p, ds.design === 'boxed'));
          pill.hidden = !txt || 'hideSave' in ds || p.was <= p.total;
        });
        const u = b.querySelector('[data-ob-unit]');
        if (u) u.textContent = 'noUnit' in ds ? '' : ds.unitText ? fillVars(ds.unitText, v) : p.size > 1 ? `${money(p.total / p.size)} / ${ds.unitNoun}` : '';
      });
      const tn = root.querySelector('[data-ob-tname]'); if (tn) tn.textContent = tiers[ai].short || bars[ai].querySelector('[data-ob-title]').textContent;
      const sm = root.querySelector('[data-ob-summary]');
      if (sm) {
        const p = priceOf(ai), vx = varsOf(p, true);
        sm.classList.toggle('is-single', p.size === 1); // one item: the price once (struck price first), no per-item line
        sm.querySelector('[data-ob-sunit]').textContent = money(p.total / p.size);
        sm.querySelector('[data-ob-stotal]').textContent = money(p.total);
        sm.querySelector('[data-ob-swas]').textContent = p.was > p.total ? money(p.was) : '';
        sm.querySelector('[data-ob-deal]').hidden = p.was <= p.total;
        sm.querySelector('[data-ob-dealtext]').textContent = fillVars(sm.dataset.deal, vx);
        sm.querySelector('[data-ob-dealnote]').textContent = fillVars(sm.dataset.note, vx);
        // No saving on this bar (a single item): the price alone in the text colour, and a link to the best pack.
        const plain = p.was <= p.total, nb = sm.querySelector('[data-ob-nudge]');
        sm.classList.toggle('is-plain', plain);
        if (nb) {
          let best = -1, bp = 0;
          tiers.forEach((t, i) => { if (t.sold_out) return; const q = priceOf(i), pct = q.was ? (q.was - q.total) / q.was : 0; if (pct > bp + 1e-9) { bp = pct; best = i; } });
          nb.hidden = !(plain && best >= 0 && sm.dataset.nudge);
          if (!nb.hidden) {
            nb.dataset.to = best;
            const name = bars[best].querySelector('[data-ob-title]').textContent.trim() || tiers[best].short;
            nb.innerHTML = `<span>${esc(fillVars(sm.dataset.nudge, { ...varsOf(priceOf(best)), pack: name }))}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
          }
        }
      }
    };

    // ---------- item pickers ----------
    const dd = (k, field, values, value, withImg) => `
      <div class="ob__dd ob__dd--${field === 'c' ? 'color' : 'size'}" data-dd>
        <button type="button" class="ob__ddbtn" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(field === 'c' ? cName : sName)} ${k + 1}">${withImg && value ? `<img src="${esc(img(value, 64))}" alt="">` : ''}<span>${esc(value || T('select'))}</span></button>
        <div class="ob__ddmenu" role="listbox" hidden>${values.map((x) => `<button type="button" role="option" class="ob__ddopt" data-k="${k}" data-f="${field}" data-v="${esc(x)}" aria-selected="${x === value}"${field === 's' && !live(items[k]?.c || null, x) ? ' disabled' : ''}>${withImg ? `<img src="${esc(img(x, 80))}" alt="" loading="lazy">` : ''}<span>${esc(x)}</span></button>`).join('')}</div>
      </div>`;
    const swatches = (k, value, cls = '') => `<div class="ob__sws${cls}" style="--cols:${Math.ceil(colors.length / Math.ceil(colors.length / 6))}">${colors.map((c) => `<button type="button" class="ob__sw" data-k="${k}" data-f="c" data-v="${esc(c)}" aria-pressed="${c === value}" aria-label="${esc(cName)}: ${esc(c)}" title="${esc(c)}"><span style="${esc(swatchStyle(c))}"></span></button>`).join('')}</div>`;
    const sizeBtns = (k) => `<div class="ob__btns">${sizes.map((z) => `<button type="button" class="ob__size" data-k="${k}" data-f="s" data-v="${esc(z)}" aria-pressed="${z === items[k].s}"${live(items[k].c || null, z) ? '' : ' disabled'}>${esc(z)}</button>`).join('')}</div>`;
    const soldMsg = (k) => { const it = items[k]; const v = findV(it.c, it.s); return it.c !== '' && it.s !== '' && v && !v.available ? `<p class="ob__soldmsg">${esc(T('combo_sold_out'))}</p>` : ''; };

    const drawPanel = () => {
      const n = shown(), t = tiers[activeI()];
      if (CI < 0 && SI < 0) { panel.innerHTML = ''; return; }
      if (ds.picker === 'rows') {
        if ('rowsLabels' in ds || ds.rowsFree) { // numbered rows: Color then Size (labels optional), hint on top
          // Free items: "FREE" under the number (rows_free_style number), or a tinted row with a gift icon and a chip
          // in the colour menu (row).
          const paid = oneVar ? n : Number(t.buy) || 1, lab = 'rowsLabels' in ds, rowFree = ds.rowsFree === 'row', freeTxt = ds.rowsFreeText || T('free');
          const gift = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9M12 8c-1.5-3-5-4-5-1.5S10 8 12 8zm0 0c1.5-3 5-4 5-1.5S14 8 12 8z"/></svg>';
          panel.innerHTML = `${ds.rowsHint ? `<p class="ob__rowshint">${esc(ds.rowsHint)}</p>` : ''}` + items.slice(0, n).map((it, k) => {
            const free = k >= paid, colDd = CI >= 0 ? dd(k, 'c', colors, it.c, true) : '';
            const colHtml = free && rowFree ? colDd.replace('</span></button>', `</span><em class="ob__ddfree">${esc(freeTxt)}</em></button>`) : colDd;
            return `<div class="ob__rowitem ob__rowitem--lab${free ? ' is-free' : ''}"><span class="ob__rown">${free && rowFree ? gift : ''}<b>${k + 1}</b>${free && !rowFree ? `<em>${esc(freeTxt)}</em>` : ''}</span>${CI >= 0 ? `<span class="ob__rowf">${lab ? `<small>${esc(cName)}</small>` : ''}${colHtml}</span>` : ''}${SI >= 0 ? `<span class="ob__rowf">${lab ? `<small>${esc(sName)}</small>` : ''}${dd(k, 's', sizes, it.s, false)}</span>` : ''}</div>`;
          }).join('');
        } else {
          panel.innerHTML = `<div class="ob__rowshead"><span>${esc([sName, cName].filter((x, i) => (i ? CI : SI) >= 0).join(', '))}</span></div>` + items.slice(0, n).map((it, k) => `
          <div class="ob__rowitem"><small>#${k + 1}</small>${SI >= 0 ? dd(k, 's', sizes, it.s, false) : '<span></span>'}${CI >= 0 ? dd(k, 'c', colors, it.c, true) : ''}</div>`).join('');
        }
      } else if (ds.picker === 'inline') { // minimal: one line per item, small colour photos + a size menu
        panel.innerHTML = items.slice(0, n).map((it, k) => `
          <div class="ob__il">${n > 1 ? `<small>${k + 1}</small>` : ''}${CI >= 0 ? `<span class="ob__ilc">${swatches(k, it.c, ' ob__sws--mini')}<em>${esc(it.c || '')}</em></span>` : '<span></span>'}${SI >= 0 ? dd(k, 's', sizes, it.s, false) : ''}</div>`).join('') + soldMsg(0);
      } else if (tilesMode && n > 1) {
        // Colour mixes: a preset mix fills every item's colour and the label lists its colours
        // ("Black, Charcoal +1 More"); "Custom Pack" (or "+N More") opens the item tiles to choose each one.
        const mixes = t.mixes || [], custom = !mixName || !mixes.length;
        const mixPic = (cols, own) => (ds.mixPic === 'none' ? '' : own ? `<span class="ob__stack ob__stack--one"><img src="${esc(own + (own.includes('?') ? '&' : '?') + 'width=240')}" alt=""></span>`
          : ds.mixPic === 'single' ? `<span class="ob__stack ob__stack--one"><img src="${esc(img(cols[0], 240))}" alt=""></span>`
          : `<span class="ob__stack">${cols.slice(0, 3).map((c, j) => `<img src="${esc(img(c, 240))}" alt="" style="left:${j * 21}%;z-index:${3 - j}">`).join('')}</span>`);
        const uniq = [...new Set(items.slice(0, n).map((x) => x.c).filter(Boolean))];
        const label = custom ? T('custom_mix') : uniq.slice(0, 2).join(', ');
        const more = !custom && uniq.length > 2 ? ` <button type="button" class="ob__more" data-mix="custom">${esc(T('more', { count: uniq.length - 2 }))}</button>` : '';
        const showTiles = custom || !(sizeFirst || SI < 0);
        panel.innerHTML = `${mixes.length ? `<div class="ob__sec"><p class="ob__lbl"><span>${esc(cName)}: <b>${esc(label)}</b>${more}</span></p>
            <div class="ob__mixes">${mixes.map((m, i) => `<button type="button" class="ob__mix" data-mix="${i}" aria-pressed="${m.name === mixName}">${m.badge ? `<span class="ob__badge">${esc(m.badge)}</span>` : ''}${mixPic(m.image ? [] : m.colors, m.image)}<span>${esc(m.name)}</span></button>`).join('')}<button type="button" class="ob__mix ob__mix--custom" data-mix="custom" aria-pressed="${custom}">${mixPic(items.slice(0, 3).map((x) => x.c))}<span class="ob__mixname">${esc(T('custom_mix'))}</span></button></div></div>` : ''}
          ${showTiles ? `<div class="ob__sec"><p class="ob__lbl"><span><b>${esc(ds.itemsTitle)}</b> | ${esc(ds.itemsHint)}</span><span>${items.slice(0, n).filter((x) => x.s || SI < 0).length} / ${n}</span></p>
            <div class="ob__tiles${n > 6 ? ' ob__tiles--many' : ''}">${items.slice(0, n).map((x, k) => `<button type="button" class="ob__tile" data-tile="${k}"><img src="${esc(img(x.c))}" alt="" loading="lazy"><span>${esc(x.c || '')}</span>${SI >= 0 && !(sizeFirst && (x.s === gSize || !x.s)) ? `<i class="${x.s ? '' : 'is-missing'}">${esc(x.s || '?')}</i>` : ''}</button>`).join('')}</div></div>` : ''}`;
      } else if (tilesMode) {
        const it = items[0];
        panel.innerHTML = `${SI >= 0 && !sizeFirst ? `<div class="ob__sec"><p class="ob__lbl"><span>${esc(sName)}: <b>${esc(it.s || '')}</b></span></p>${sizeBtns(0)}</div>` : ''}
          ${CI >= 0 ? `<div class="ob__sec"><p class="ob__lbl"><span>${esc(cName)}: <b>${esc(it.c)}</b></span></p>${swatches(0, it.c)}</div>` : ''}${soldMsg(0)}`;
      } else {
        const limit = ds.design === 'cards' ? 16 : 4;
        panel.innerHTML = items.slice(0, n).map((it, k) => `
          <fieldset class="ob__item"><legend hidden>Item ${k + 1}</legend><div class="ob__opts">
            ${CI >= 0 ? `<div><span class="ob__label">${esc(cName)}: <b>${esc(it.c)}</b></span>${colors.length <= limit ? swatches(k, it.c) : dd(k, 'c', colors, it.c, true)}</div>` : ''}
            ${SI >= 0 ? `<div>${'noSizeLabel' in ds ? '' : `<span class="ob__label">${esc(sName)}:</span>`}${dd(k, 's', sizes, it.s, false)}</div>` : ''}
          </div>${soldMsg(k)}</fieldset>`).join('');
      }
    };

    // Item sheet photos: every photo of the colour (alt text names it), the variant photo first; swipe or dots.
    const drawGallery = (c) => {
      const box = root.querySelector('[data-ob-sgal]');
      if (!box || box.dataset.c === c) return;
      box.dataset.c = c;
      const key = (u) => String(u).split('?')[0].replace(/^https?:/, '');
      const first = img(c, 900), list = [first, ...((O.gallery || {})[c] || []).map((u) => (u.startsWith('//') ? 'https:' + u : u))]
        .filter((u, i, a) => u && a.findIndex((x) => key(x) === key(u)) === i).slice(0, 8);
      // Two portrait photos visible at once, swipe for the others; a thin bar shows the position.
      box.classList.toggle('is-one', list.length < 2);
      box.innerHTML = `<div class="ob__sgtrack">${list.map((u, i) => `<img src="${esc(u)}" alt="" ${i > 1 ? 'loading="lazy"' : ''}>`).join('')}</div>`
        + (list.length > 2 ? '<div class="ob__sgbar"><i></i></div>' : '');
      const track = box.querySelector('.ob__sgtrack'), bar = box.querySelector('.ob__sgbar i');
      const pos = () => { if (!bar) return; const max = track.scrollWidth - track.clientWidth, w = track.clientWidth / track.scrollWidth;
        bar.style.width = `${w * 100}%`; bar.style.left = `${max > 0 ? (track.scrollLeft / max) * (1 - w) * 100 : 0}%`; };
      track.addEventListener('scroll', pos, { passive: true });
      requestAnimationFrame(pos);
    };

    const fillSheet = () => {
      const it = items[cur];
      drawGallery(it.c);
      root.querySelector('[data-ob-sbody]').innerHTML = `
        ${SI >= 0 ? `<div><p class="ob__lbl"><span>${esc(sName)}: <b>${esc(it.s || T('choose_size'))}</b></span></p>${sizeBtns(cur)}</div>` : ''}
        ${CI >= 0 ? `<div><p class="ob__lbl"><span>${esc(cName)}: <b>${esc(it.c)}</b></span></p>${swatches(cur, it.c)}</div>` : ''}
        <div class="ob__sheet-acts"><button type="button" data-all${it.s ? '' : ' disabled'}>${esc(T('apply_all', { count: shown() }))}</button><button type="button" data-done>${esc(it.s || SI < 0 ? T('done') : T('select_size'))}</button></div>`;
    };

    const drawCta = () => {
      if (!btn || adding) return;
      const n = shown(), units = unitsOf(activeI()), its = items.slice(0, n);
      const missing = its.some((x) => (CI >= 0 && !x.c) || (SI >= 0 && !x.s));
      const ok = !missing && its.every((x) => findV(x.c, x.s)?.available) && !tiers[activeI()].sold_out;
      let label;
      if (missing) label = ds.ctaWait ? ds.ctaWait : tilesMode ? (units > 1 ? T('choose_sizes', { unit: ds.unitNoun }) : T('select_size')) : T('choose_options');
      else if (!ok) label = T('sold_out');
      else {
        label = ds.ctaText ? fillVars(ds.ctaText, varsOf(priceOf(activeI()))) : units > 1 ? T('add_many', { count: units, noun: ds.noun }) : (ui.add_one || atc?.dataset.label || T('add_one'));
        if ('totalBtn' in ds) {
          const pr = priceOf(activeI());
          const amt = (pr.was > pr.total && !('hideCmp' in ds) ? `<s class="ob__btnwas">${money(pr.was)}</s> ` : '') + money(pr.total);
          const wasCol = ds.btnWas ? ` style="color:${esc(ds.btnWas)};opacity:1"` : '';
          const amt2 = (pr.was > pr.total && !('hideCmp' in ds) ? `<s class="ob__btnwas"${wasCol}>${money(pr.was)}</s> ` : '') + money(pr.total);
          label = ds.btnPrice === 'pill' ? `${esc(label)} <span class="ob__btnpill">${amt}</span>` : ds.btnPrice === 'plain' ? `${esc(label)}<span class="ob__btnamt">${amt}</span>`
            : ds.btnPrice === 'pipe' ? `${esc(label)}<span class="ob__btnsep" aria-hidden="true">|</span>${amt2}` : `${esc(label)} · ${amt}`;
          if ('btnArrow' in ds) label += '<svg class="ob__btnarrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
        } else label = esc(label);
      }
      btn.disabled = tilesMode && missing ? false : !ok;
      btn.classList.toggle('is-missing', missing);
      if (btnLabel) btnLabel.innerHTML = label;
    };

    const drawSize = () => {
      if (!gBox) return;
      gBox.querySelector('[data-ob-gsv]').textContent = gSize || T('choose_size');
      gBox.querySelector('.ob__btns').innerHTML = sizes.map((z) => `<button type="button" class="ob__size" data-gs="${esc(z)}" aria-pressed="${z === gSize}"${live(null, z) ? '' : ' disabled'}>${esc(z)}</button>`).join('');
    };
    const drawExtras = () => {
      const ai = activeI();
      if ('giftsBelow' in ds) { // the selected bar's gifts drawn under its item pickers
        const g = bars[ai].querySelector('.ob__gifts');
        if (g) panel.append(g.cloneNode(true));
      }
      const tk = root.querySelector('[data-ob-ticket]');
      if (tk) {
        const v = tiers[ai].banner_value || '';
        tk.hidden = !v;
        tk.querySelectorAll('[data-ob-tval]').forEach((x) => { x.textContent = v; });
        tk.querySelectorAll('[data-ob-tval2]').forEach((x) => { x.textContent = `${v} ${tk.dataset.unit || ''}`.trim(); });
      }
      const ct = root.querySelector('[data-ob-cthumbs]');
      if (ct && !ct.dataset.done) { ct.dataset.done = '1'; ct.innerHTML = colors.slice(0, 3).map((c) => `<span><img src="${esc(img(c, 120))}" alt="" loading="lazy"></span>`).join(''); }
    };
    if (ds.shipLocale) { // delivery date in the bundle's language and length ("lundi 16 novembre")
      const long = ds.shipDate === 'long';
      const bidCls = [...root.classList].find((c) => c.startsWith('ob-') && !c.startsWith('ob--'));
      scope.querySelectorAll(`.${CSS.escape(bidCls)} [data-ob-shipdate]`).forEach((el) => {
        const d = new Date(Number(el.dataset.obShipdate) * 1000);
        el.textContent = new Intl.DateTimeFormat(ds.shipLocale, long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
      });
    }
    const draw = () => {
      (['columns', 'grid', 'pills'].includes(ds.layout) ? list : bars[activeI()]).after(panel);
      drawSize(); drawBars(); drawPanel(); drawExtras(); drawCta();
      if (sheet.open) fillSheet();
      if (status) status.hidden = true;
      window.obGlRun?.(root);
    };
    const changed = (k) => {
      const v = findV(items[k]?.c, items[k]?.s);
      if (v && ds.sectionId) window.dispatchEvent(new CustomEvent('variant:changed', { detail: { variant: v, sectionId: ds.sectionId } }));
    };

    // ---------- events ----------
    root.querySelector('[data-ob-nudge]')?.addEventListener('click', (e) => { const b = bars[Number(e.currentTarget.dataset.to)]; b?.querySelector('input').click(); b?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
    bars.forEach((b) => b.querySelector('input').addEventListener('change', () => {
      mixName = ((tiers[activeI()].mixes || [])[0] || {}).name || '';
      items = defaultsFor(activeI()); draw();
    }));
    // An open menu must sit above the next rows and bars: every box between it and the bundle is lifted while it is open
    // (a tinted free row or a bar with a badge makes its own stacking layer, which would trap the menu under the next bar).
    const unlift = () => [root, ...root.querySelectorAll('[data-ob-lift]')].forEach((el) => {
      if (!el.dataset.obLift) return;
      el.style.zIndex = ''; if (el.dataset.obLift === 'pos') el.style.position = ''; delete el.dataset.obLift;
    });
    const lift = (d, on) => {
      unlift();
      if (!on) return;
      for (let el = d; el; el = el === root ? null : el.parentElement) {
        const pos = getComputedStyle(el).position === 'static';
        if (pos) el.style.position = 'relative';
        el.style.zIndex = '40'; el.dataset.obLift = pos ? 'pos' : '1';
      }
    };
    const closeMenus = (except) => {
      root.querySelectorAll('[data-dd]').forEach((d) => { if (d !== except) { d.querySelector('.ob__ddmenu').hidden = true; d.querySelector('.ob__ddbtn').setAttribute('aria-expanded', 'false'); } });
      if (!except) unlift();
    };
    root.addEventListener('click', (e) => {
      const ddBtn = e.target.closest('.ob__ddbtn');
      if (ddBtn) { e.preventDefault(); const d = ddBtn.closest('[data-dd]'), m = d.querySelector('.ob__ddmenu'), open = m.hidden; closeMenus(d); m.hidden = !open; ddBtn.setAttribute('aria-expanded', String(open)); lift(d, open); return; }
      const pick = e.target.closest('[data-f]');
      if (pick && !pick.disabled) {
        e.preventDefault();
        const k = Number(pick.dataset.k), it = items[k];
        it[pick.dataset.f] = pick.dataset.v; touched = true;
        if (pick.dataset.f === 'c') { mixName = ''; if (it.s && !live(it.c, it.s)) it.s = tilesMode ? '' : sizes.find((z) => live(it.c, z)) || it.s; }
        unlift(); draw(); changed(k); return;
      }
      const gs = e.target.closest('[data-gs]');
      if (gs && !gs.disabled) { gSize = gs.dataset.gs; touched = true; items.forEach((x) => { if (!x.c || live(x.c, gSize)) x.s = gSize; }); gBox.classList.remove('is-alert'); draw(); changed(0); return; }
      const mix = e.target.closest('[data-mix]');
      if (mix && mix.dataset.mix === 'custom') { mixName = ''; touched = true; draw(); return; }
      if (mix) { const m = tiers[activeI()].mixes[Number(mix.dataset.mix)]; mixName = m.name; touched = true; items.forEach((x, k) => { x.c = m.colors[k % m.colors.length]; }); draw(); changed(0); return; }
      const tile = e.target.closest('[data-tile]');
      if (tile) { cur = Number(tile.dataset.tile); fillSheet(); sheet.showModal(); return; }
      if (e.target.closest('[data-all]')) { const z = items[cur].s, c0 = items[cur].c, both = ds.applyAll === 'both'; items.slice(0, shown()).forEach((x) => { if (both && live(c0, z)) x.c = c0; if (live(x.c, z)) x.s = z; }); mixName = both ? '' : mixName; touched = true; sheet.close(); draw(); return; }
      if (e.target.closest('[data-done]')) { if (items[cur].s || SI < 0) sheet.close(); return; }
      const sg = e.target.closest('[data-ob-sg]');
      if (sg) {
        e.preventDefault();
        const dlg = root.querySelector('[data-ob-sgd]'), body = dlg.querySelector('[data-ob-sgbody]');
        if (!body.textContent.trim()) {
          body.textContent = T('no_size_guide');
        }
        closeMenus(); dlg.showModal(); return;
      }
      if (e.target.closest('[data-ob-close]')) { e.target.closest('dialog').close(); return; }
      if (e.target.matches('dialog')) e.target.close();
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('[data-dd]')) closeMenus(); });
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });

    // Adds lines to the cart (cart attribute _ob=1 first, so the open-bundles discount function prices them), then opens
    // the theme's cart drawer, or the cart page. Returns true when added.
    const addLines = async (lines, button, labelEl, stat) => {
      const cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
      const sections = cart?.getSectionsToRender?.().map((x) => x.id) || [], base = window.Shopify?.routes?.root || '/';
      const cartUrl = window.routes?.cart_url || base + 'cart';
      cart?.setActiveElement?.(button);
      adding = true; button.disabled = true; button.setAttribute('aria-busy', 'true');
      if (labelEl) labelEl.textContent = T('adding'); else button.textContent = T('adding');
      if (stat) stat.hidden = true;
      try {
        await fetch(base + 'cart/update.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attributes: { _ob: '1' } }) });
        const r = await fetch(base + 'cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: lines, sections, sections_url: location.pathname }) });
        const data = await r.json();
        if (!r.ok || Number(data.status) >= 400) throw new Error(data.description || data.message || T('add_error'));
        if ('skipCart' in ds) { location.assign(base + 'checkout'); return true; }
        if (pb?.open) pb.close();
        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') publish(PUB_SUB_EVENTS.cartUpdate, { source: 'ob-bundle', cartData: data });
        cart?.classList.remove('is-empty'); // like the theme's own form: an empty drawer has no item list to focus
        if (cart?.renderContents && sections.every((id) => data.sections?.[id])) { try { cart.renderContents({ ...data, key: data.key || data.items?.[0]?.key }); } catch { location.assign(cartUrl); } }
        else location.assign(cartUrl);
        return true;
      } catch (err) {
        if (stat) { stat.textContent = err.message; stat.hidden = false; }
        return false;
      } finally {
        adding = false; button.removeAttribute('aria-busy'); button.disabled = false; drawCta();
        if (button === btn && pb?.open) pbDraw();
      }
    };

    // ---------- Build your own pack: a pop-up on this product page (a new page would lose the shopper) ----------
    // One size for the pack, then + / - per colour. Priced like the cart: the largest bar the quantity reaches is
    // applied once (open-bundles discount function), extra items at full price; the per-item price drops as it grows.
    const multi = tiers.map((t, i) => unitsOf(i)).filter((u) => u > 1);
    const pbMin = Number(ds.pbMin) || (multi.length ? Math.min(...multi) : 2);
    let pb = null, pbSize = '', pbQty = {}, pbErr = '';
    const packPrice = (vs) => {
      const n = vs.length, ps = vs.map((v) => v.price).sort((a, b) => b - a), full = ps.reduce((x, y) => x + y, 0);
      let ti = -1;
      tiers.forEach((t, i) => { if (!t.sold_out && unitsOf(i) <= n && (ti < 0 || unitsOf(i) > unitsOf(ti))) ti = i; });
      if (ti < 0) return { total: full, was: full };
      const t = tiers[ti], u = unitsOf(ti), buy = Number(t.buy) || 1, paid = ps.slice(0, Math.min(buy, u)).reduce((x, y) => x + y, 0), rest = ps.slice(u).reduce((x, y) => x + y, 0);
      const val = Number(t.off?.value) || 0;
      let off = 0;
      if (t.off?.type === 'amount') off = Math.min(Math.round(val * 100), paid);
      else if (t.off?.type === 'price') off = Math.max(0, paid - Math.round(val * 100));
      else if (t.off?.type === 'percent') off = Math.round((paid * Math.min(val, 100)) / 100);
      return { total: paid - off + rest, was: full };
    };
    const pbCols = () => (CI >= 0 ? colors : ['']);
    const pbOk = (c) => (SI >= 0 ? Boolean(pbSize) && live(c || null, pbSize) : live(c || null, null));
    const pbVars = () => Object.entries(pbQty).flatMap(([c, q]) => Array.from({ length: q }, () => findV(c, pbSize))).filter(Boolean);
    const pbDraw = () => {
      const vs = pbVars(), n = vs.length, pr = packPrice(vs), noun = n === 1 ? ds.unitNoun : ds.noun, unit = ds.unitNoun;
      const us = tiers.map((t, i) => unitsOf(i)), top = Math.max(...us, pbMin), bi = us.indexOf(Math.max(...us));
      const best = packPrice(Array.from({ length: us[bi] }, () => pv));
      const nx = tiers.map((t, i) => i).filter((i) => unitsOf(i) > n && !tiers[i].sold_out).sort((a, b) => unitsOf(a) - unitsOf(b))[0];
      const hint = n < pbMin ? T('pb_min', { min: pbMin, noun: ds.noun })
        : nx != null ? T('pb_next', { left: unitsOf(nx) - n, next: fillVars(tiers[nx].tag || tiers[nx].label || '', varsOf(priceOf(nx))) }) : '';
      const cta = n >= pbMin ? `${esc(T('pb_cta', { count: n, noun, price: money(pr.total) }))}${pr.was > pr.total ? ` <s>${money(pr.was)}</s>` : ''}` : esc(T('pb_min', { min: pbMin, noun: ds.noun }));
      pb.innerHTML = `
        <div class="ob__pbhead"><b>${esc(T('pb_title'))}</b><button type="button" class="ob__pbx" data-pbclose aria-label="${esc(T('pb_back'))}">&times;</button></div>
        <div class="ob__pbbody">
          ${SI >= 0 ? `<p class="ob__pbstep">${esc(T('pb_size'))}</p><div class="ob__btns">${sizes.map((z) => `<button type="button" class="ob__size" data-pbs="${esc(z)}" aria-pressed="${z === pbSize}"${live(null, z) ? '' : ' disabled'}>${esc(z)}</button>`).join('')}</div>` : ''}
          <p class="ob__pbstep">${esc(T('pb_colors'))}</p>
          <div class="ob__pbcols">${pbCols().map((c) => {
            const q = pbQty[c] || 0, ok = pbOk(c);
            return `<div class="ob__pbc${q ? ' is-on' : ''}${ok || (SI >= 0 && !pbSize) ? '' : ' is-out'}"><span class="ob__pbimg"><img src="${esc(img(c || null, 240))}" alt="" loading="lazy">${q ? `<i>${q}</i>` : ''}</span>
              <span class="ob__pbname">${esc(c)}</span>
              <span class="ob__pbq"><button type="button" data-pbm="${esc(c)}" aria-label="- ${esc(c)}"${q ? '' : ' disabled'}>&minus;</button><b>${q}</b><button type="button" data-pbp="${esc(c)}" aria-label="+ ${esc(c)}"${ok && n < 50 ? '' : ' disabled'}>+</button></span></div>`;
          }).join('')}</div>
        </div>
        <div class="ob__pbfoot">
          <p class="ob__pbcount"><span>${esc(T('pb_count', { count: n, noun }))}</span><em>${esc(hint)}</em></p>
          <div class="ob__pbbar"><i style="width:${Math.min(100, (n / top) * 100)}%"></i></div>
          <p class="ob__pbunits"><span>${money(n ? pr.total / n : pv.price)} / ${esc(unit)}</span><span>${esc(T('pb_best', { unit_price: money(best.total / us[bi]), unit }))}</span></p>
          <button type="button" class="ob__pbcta" data-pbadd${n >= pbMin ? '' : ' disabled'}>${cta}</button>
          <p class="ob__pbstatus" data-pbstatus role="status" aria-live="polite"${pbErr ? '' : ' hidden'}>${esc(pbErr)}</p>
        </div>`;
    };
    const pbClick = async (e) => {
      if (e.target === pb || e.target.closest('[data-pbclose]')) { pb.close(); return; }
      const sz = e.target.closest('[data-pbs]');
      if (sz) { pbSize = sz.dataset.pbs; Object.keys(pbQty).forEach((c) => { if (!pbOk(c)) delete pbQty[c]; }); pbDraw(); return; }
      const plus = e.target.closest('[data-pbp]');
      if (plus && !plus.disabled) { const c = plus.dataset.pbp; pbQty[c] = (pbQty[c] || 0) + 1; pbDraw(); pb.querySelector(`[data-pbp="${CSS.escape(c)}"]`)?.focus(); return; }
      const minus = e.target.closest('[data-pbm]');
      if (minus && !minus.disabled) { const c = minus.dataset.pbm; pbQty[c] = Math.max(0, (pbQty[c] || 0) - 1); if (!pbQty[c]) delete pbQty[c]; pbDraw(); pb.querySelector(`[data-pbm="${CSS.escape(c)}"]`)?.focus(); return; }
      const add = e.target.closest('[data-pbadd]');
      if (add && !add.disabled && !adding) {
        const lines = [];
        pbVars().forEach((v) => { const ex = lines.find((y) => y.id === v.id); if (ex) ex.quantity++; else lines.push({ id: v.id, quantity: 1 }); });
        pbErr = '';
        const st = pb.querySelector('[data-pbstatus]');
        if (!(await addLines(lines, add, null, st))) pbErr = st.textContent;
        if (pb.open) pbDraw();
      }
    };
    const pbOpen = () => {
      if (!pb) {
        pb = document.createElement('dialog');
        pb.className = 'ob__dialog ob__sheet ob__pb';
        pb.setAttribute('aria-label', T('pb_title'));
        root.append(pb);
        pb.addEventListener('click', pbClick);
      }
      if (!pbSize && SI >= 0) pbSize = gSize || (items[0]?.s && live(null, items[0].s) ? items[0].s : '');
      pbDraw(); closeMenus(); pb.showModal();
    };
    root.querySelector('[data-ob-pack]')?.addEventListener('click', (e) => { e.preventDefault(); pbOpen(); });

    btn?.addEventListener('click', async () => {
      if (adding) return;
      const n = shown(), units = unitsOf(activeI()), its = items.slice(0, n);
      const k0 = its.findIndex((x) => (CI >= 0 && !x.c) || (SI >= 0 && !x.s));
      if (k0 >= 0) {
        if (sizeFirst && !gSize) { gBox.classList.add('is-alert'); gBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        if (tilesMode && units > 1) { cur = k0; fillSheet(); sheet.showModal(); }
        return;
      }
      const lines = [];
      for (let k = 0; k < units; k++) {
        const x = items[oneVar ? 0 : k], v = findV(x.c, x.s);
        if (!v?.available) { draw(); return; }
        const ex = lines.find((y) => y.id === v.id);
        if (ex) ex.quantity++;
        else lines.push({ id: v.id, quantity: 1, ...(mult > 1 ? { properties: { _ob_was: String(Math.round(v.price * mult)) } } : {}) });
      }
      const bar = bars[activeI()];
      (bar.dataset.gifts || '').split(',').filter(Boolean).forEach((id) => lines.push({ id: Number(id), quantity: 1, properties: { _ob_gift: '1' } }));
      ('giftsBelow' in ds ? panel : bar).querySelectorAll('[data-gift-select]').forEach((s) => { if (s.value) lines.push({ id: Number(s.value), quantity: 1, properties: { _ob_gift: '1' } }); });
      await addLines(lines, btn, btnLabel, status);
    });

    if (!bars.some((b) => b.querySelector('input').checked)) { const f = bars.find((b) => !b.classList.contains('is-soldout')); if (f) f.querySelector('input').checked = true; }
    mixName = ((tiers[activeI()].mixes || [])[0] || {}).name || '';
    items = defaultsFor(activeI());
    draw();
  }

  const all = (scope = document) => scope.querySelectorAll('[data-ob-block]').forEach(init);
  window.obBundleInit = all;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => all());
  else all();
  document.addEventListener('shopify:section:load', (e) => all(e.target));

  // editor real preview (dev theme): ?ob=<id>&ob_solo=<id> keeps only that offer block on the page.
  const solo = new URLSearchParams(location.search).get('ob_solo');
  if (solo) {
    const keep = () => {
      const blk = [...document.querySelectorAll('[data-ob-block]')].find((b) => b.dataset.ob === solo);
      if (!blk) return;
      const wrap = document.createElement('div');
      wrap.className = 'ob-solo';
      wrap.style.cssText = 'max-width:430px;margin:0 auto;padding:18px 16px 40px;';
      blk.hidden = false; blk.style.display = '';
      // styles stay where they are (the bundle's own <style> sits next to the block); everything else is hidden
      const styles = [...document.querySelectorAll('body style, body link[rel="stylesheet"]')];
      [...document.body.children].forEach((el) => { if (!/^(STYLE|LINK|SCRIPT)$/.test(el.tagName)) el.style.setProperty('display', 'none', 'important'); });
      wrap.append(blk);
      document.body.append(...styles, wrap);
      document.body.style.cssText = 'padding:0;margin:0;background:#ffffff;overflow:auto;';
      document.documentElement.style.cssText = 'padding:0;margin:0;';
    };
    if (document.readyState === 'complete') setTimeout(keep, 50); else addEventListener('load', () => setTimeout(keep, 50));
    // back to this tab after an edit in the editor: load the new draft
    let away = 0;
    document.addEventListener('visibilitychange', () => { if (document.hidden) away = Date.now(); else if (away && Date.now() - away > 800) location.reload(); });
  }
})();
