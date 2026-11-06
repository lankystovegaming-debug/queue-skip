(() => {
  'use strict';
  const stalls = window.STALLS;
  const base = document.body.dataset.base;
  const page = document.body.dataset.page;
  const money = cents => `S$${(cents / 100).toFixed(2)}`;
  const url = route => base + (route ? route + '/' : '');
  const cartKey = 'queue-skip-cart-v1';
  const catalogue = new Map(stalls.flatMap(s => s.menu.map(m => [s.slug + ':' + m[0], {stall:s, item:m}])));
  let cart = {};
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(cartKey) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [key, value] of Object.entries(saved)) {
        if (catalogue.has(key) && Number.isInteger(value) && value > 0 && value <= 99) cart[key] = value;
      }
    }
  } catch { /* A malformed or unavailable saved cart starts empty. */ }
  const count = () => Object.values(cart).reduce((a,b) => a+b, 0);
  const total = () => Object.entries(cart).reduce((sum,[key,qty]) => sum + catalogue.get(key).item[3] * qty, 0);
  const bag = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/></svg>';
  const clock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>';
  const arrow = '<span aria-hidden="true">↗</span>';
  const logo = `<span class="logo-mark" aria-hidden="true">≋</span><span>queue<span class="logo-light">skip</span><span class="logo-dot">.</span></span>`;
  const wait = `<span class="wait">${clock} Estimated waiting time: 5 minutes</span>`;
  const header = () => `<header class="site-header"><div class="header-inner"><a class="brand" href="${url('')}" aria-label="Queue Skip home">${logo}</a><nav aria-label="Main navigation"><a class="nav-stalls ${!page || page !== 'cart' ? 'active' : ''}" href="${url('')}">Explore stalls</a><a class="cart-link" href="${url('cart')}">${bag}<span>Your cart</span><span class="cart-count" aria-label="${count()} items">${count()}</span></a></nav></div></header>`;
  const footer = () => `<footer class="site-footer"><a class="brand" href="${url('')}">${logo}</a><span>Good food. Less waiting.</span><span>Made for your next makan.</span></footer>`;
  function art(kind, label='', variant=0) {
    // Original vector food illustrations; no external image requests.
    let food;
    if (kind === 'coffee') food = `<ellipse cx="150" cy="159" rx="81" ry="17" fill="#9eac8b"/><ellipse cx="150" cy="147" rx="68" ry="17" fill="#f8f1da"/><path d="M186 68h15c38 0 38 57-1 57h-11" fill="none" stroke="#fff9e8" stroke-width="13"/><path d="M91 62h102v61c0 42-102 42-102 0Z" fill="#fff9e8"/><ellipse cx="142" cy="62" rx="51" ry="15" fill="#dec8a4"/><ellipse cx="142" cy="62" rx="44" ry="11" fill="#64402b"/><path d="M118 30c-13-13 13-17 0-30m27 30c-13-13 13-17 0-30m27 30c-13-13 13-17 0-30" fill="none" stroke="#fff9e8" stroke-width="5" stroke-linecap="round"/><path d="M106 86v31" stroke="white" stroke-width="7" stroke-linecap="round" opacity=".7"/>`;
    else if (kind === 'prata') food = `<ellipse cx="150" cy="149" rx="105" ry="33" fill="#b78952" opacity=".2"/><ellipse cx="150" cy="126" rx="108" ry="57" fill="#fff9e8"/><ellipse cx="141" cy="120" rx="73" ry="43" fill="#c2833c"/><ellipse cx="141" cy="113" rx="73" ry="43" fill="#edbd70"/><path d="M91 97q52-34 96 8m-92 17q38-28 88 3m-66-44q-9 34 36 60" stroke="#cb9048" stroke-width="6" fill="none" stroke-linecap="round"/><ellipse cx="221" cy="85" rx="30" ry="24" fill="#f7f1db"/><ellipse cx="221" cy="81" rx="23" ry="16" fill="#af552d"/><circle cx="215" cy="80" r="4" fill="#d58c4a"/><path d="m226 72-5 12" stroke="#53824f" stroke-width="4"/>`;
    else if (kind === 'dessert') food = `<ellipse cx="150" cy="163" rx="86" ry="14" fill="#9b7c90" opacity=".2"/><path d="M64 111h172c-8 81-161 81-172 0" fill="#f9f3e6"/><ellipse cx="150" cy="111" rx="86" ry="23" fill="#e8dbc9"/><path d="M79 110q16-54 71-76 56 23 73 76Z" fill="#fff6e1"/><path d="M84 99q16-42 45-51l14 68Z" fill="#d98091"/><path d="m145 39 23 9 7 70h-31Z" fill="#8bb685"/><path d="m175 55 23 23 18 29-34 8Z" fill="#e5b455"/><ellipse cx="150" cy="115" rx="68" ry="12" fill="#bf7691"/><circle cx="103" cy="113" r="6" fill="#834139"/><circle cx="118" cy="120" r="5" fill="#834139"/><circle cx="132" cy="112" r="6" fill="#834139"/>`;
    else if (kind === 'noodles') food = `<ellipse cx="150" cy="160" rx="98" ry="15" fill="#b87b60" opacity=".22"/><path d="M48 100h204c-16 91-188 91-204 0Z" fill="#365c4a"/><ellipse cx="150" cy="100" rx="102" ry="35" fill="#fdf1d0"/><ellipse cx="150" cy="99" rx="88" ry="27" fill="#b7793d"/><path d="M77 96q25-34 50-8t51 3 48 7M72 105q27-28 50-4t50 3 53 2M94 112q16-33 47-16t57 17M96 80q27 31 66 1t45 19" fill="none" stroke="#efc177" stroke-width="6" stroke-linecap="round"/><path d="m102 77 13 22m61-15 14 27m-48-4-9 15" stroke="#578858" stroke-width="8" stroke-linecap="round"/><path d="m211 18-73 75m91-64-74 75" stroke="#694333" stroke-width="5" stroke-linecap="round"/>`;
    else food = `<ellipse cx="150" cy="157" rx="102" ry="17" fill="#ba9754" opacity=".22"/><ellipse cx="150" cy="116" rx="109" ry="57" fill="#fff9e8"/><ellipse cx="150" cy="116" rx="93" ry="45" fill="#eae2c8"/><path d="M69 123c-7-69 85-82 90-4Z" fill="#fff7de"/><path d="m82 99 10-7m9 12 9-8m-22 18 11-7m19 4 9-7m-8-16 8-5" stroke="#dfd4b5" stroke-width="3" stroke-linecap="round"/><path d="M159 81q42-16 62 20l-28 34-44-16Z" fill="${variant ? '#a75b32' : '#d8a164'}"/><path d="m160 90 36 25m-27-34 36 25m-28-34 35 24" stroke="${variant ? '#763c2a' : '#fff0cc'}" stroke-width="7" stroke-linecap="round"/><circle cx="217" cy="124" r="16" fill="#669759"/><circle cx="217" cy="124" r="10" fill="#b6ce82"/><circle cx="199" cy="140" r="14" fill="#669759"/><circle cx="199" cy="140" r="8" fill="#b6ce82"/><ellipse cx="151" cy="141" rx="18" ry="11" fill="#ae4e32"/>`;
    return `<svg class="food-art" viewBox="0 0 300 200" role="img" aria-label="${label}">${food}</svg>`;
  }
  function home() {
    return `<main id="main"><section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="tiny-star">✳</span> YOUR HAWKER FAVOURITES, ONE TAP AWAY</p><h1>More makan.<br>Less <span class="serif">waiting.</span></h1><p class="hero-text">From your first kopi to your last bite.<br>Order ahead and skip straight to the good part.</p><a class="button" href="#stalls">Find your next bite <span aria-hidden="true">↓</span></a><div class="hero-note"><span class="small-dot"></span> Made for the way we makan.</div></div><div class="hero-visual" aria-hidden="true"><div class="hero-disc"></div><div class="hero-rice">${art('rice')}</div><div class="hero-kopi">${art('coffee')}</div><div class="hero-sticker">LESS QUEUE<span>more shiok!</span><i>✳</i></div><div class="hero-caption">Your usual, without the usual wait.</div></div></section><section id="stalls" class="stalls-section"><div class="section-top"><div><p class="eyebrow">A LITTLE OF EVERYTHING</p><h2>What are you craving?</h2></div><span class="stall-total">6 stalls. So many good choices.</span></div><div class="discovery"><div class="filters" role="group" aria-label="Filter stalls by category">${['All stalls','Rice','Noodles','Prata','Drinks','Desserts'].map((c,i)=>`<button class="filter ${!i?'selected':''}" data-category="${c}" aria-pressed="${!i}">${c}</button>`).join('')}</div><label class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/></svg><input id="search" type="search" placeholder="Search stalls or dishes" aria-label="Search stalls or dishes"></label></div><p id="results-status" class="sr-only" role="status"></p><div class="stall-grid" id="stall-grid">${stalls.map(stallCard).join('')}</div><p class="no-results" id="no-results" hidden>No stalls found. Try another dish or category.</p></section><section class="bottom-note"><span class="note-symbol" aria-hidden="true">✳</span><div><h2>All your favourites. One happy cart.</h2><p>Mix it up across stalls and make your next meal a good one.</p></div><a href="${url('cart')}">See your cart <span aria-hidden="true">→</span></a></section></main>`;
  }
  function stallCard(s) {
    return `<a class="stall-card" href="${url(s.slug)}"><div class="card-visual" style="--food-bg:${s.color}"><span class="stall-unit">STALL ${s.unit}</span>${art(s.icon,s.label,s.unit==='03')}<span class="category-tag">${s.category}</span></div><div class="card-body"><div class="card-heading"><h3>${s.name}</h3><span class="card-arrow" aria-hidden="true">↗</span></div><p>${s.label}</p><div class="card-bottom">${wait}<span class="starting-price">From ${money(Math.min(...s.menu.map(m=>m[3])))}</span></div></div></a>`;
  }
  function stallPage(s) {
    return `<main id="main" class="menu-page"><a class="back-link" href="${url('')}">← All stalls</a><section class="stall-hero" style="--food-bg:${s.color}"><div><p class="eyebrow">STALL ${s.unit} <span> / </span> ${s.category.toUpperCase()}</p><h1>${s.name}</h1><p class="stall-description">${s.description}</p>${wait}</div><div class="stall-hero-art">${art(s.icon,s.label,s.unit==='03')}</div></section><div class="menu-heading"><div><p class="eyebrow">FRESH FROM THE STALL</p><h2>The good stuff</h2></div><span>All prices in SGD</span></div><div class="menu-grid">${s.menu.map((m,i)=>`<article class="menu-item"><div class="menu-item-copy">${i===0?'<span class="popular">HOUSE FAVOURITE</span>':''}<h3>${m[1]}</h3><p>${m[2]}</p><strong>${money(m[3])}</strong></div><div class="menu-item-action"><span class="dish-number" aria-hidden="true">0${i+1}</span><button class="add-button" data-add="${s.slug}:${m[0]}" aria-label="Add ${m[1]} to cart"><span aria-hidden="true">+</span> Add</button></div></article>`).join('')}</div><div class="menu-cart-bar"><span>${bag}<span><strong data-item-summary>${count()} ${count()===1?'item':'items'} in your cart</strong><small>Something good is coming together.</small></span></span><a class="button" href="${url('cart')}">View cart <span data-cart-total>${money(total())}</span> →</a></div></main>`;
  }
  function quantity(key,qty,name) {
    return `<div class="quantity"><button data-change="${key}" data-delta="-1" aria-label="${qty===1?'Remove':'Decrease quantity of'} ${name}">−</button><span aria-label="Quantity ${qty}">${qty}</span><button data-change="${key}" data-delta="1" aria-label="Increase quantity of ${name}" ${qty>=99?'disabled':''}>+</button></div>`;
  }
  function cartPage() {
    const groups = stalls.filter(s=>s.menu.some(m=>cart[s.slug+':'+m[0]]));
    return `<main id="main" class="cart-page"><a class="back-link" href="${url('')}">← Keep exploring</a><div class="cart-title"><p class="eyebrow">YOUR NEXT GOOD MEAL</p><h1>Your cart<span class="serif">.</span></h1><p>${count()?`${count()} ${count()===1?'item':'items'} from ${groups.length} ${groups.length===1?'stall':'stalls'}. A little of what you love.`:'A good meal starts with a little exploring.'}</p></div>${count()?`<div class="cart-layout"><div class="cart-groups">${groups.map(s=>`<section class="cart-group"><div class="cart-group-header"><div><span class="eyebrow">STALL ${s.unit}</span><h2><a href="${url(s.slug)}">${s.name}</a></h2></div><a class="text-link" href="${url(s.slug)}">Add more ↗</a></div><div class="cart-wait">${wait}</div>${s.menu.filter(m=>cart[s.slug+':'+m[0]]).map(m=>{const key=s.slug+':'+m[0],qty=cart[key];return `<article class="cart-row"><div><h3>${m[1]}</h3><span class="unit-price">${money(m[3])} each</span></div><div class="cart-row-actions">${quantity(key,qty,m[1])}<strong>${money(m[3]*qty)}</strong><button class="remove-button" data-remove="${key}" aria-label="Remove all ${m[1]} from cart">Remove</button></div></article>`;}).join('')}</section>`).join('')}</div><aside class="order-summary"><p class="eyebrow">LOOKING GOOD</p><h2>Your meal, sorted.</h2><div class="summary-line"><span>Subtotal (${count()} ${count()===1?'item':'items'})</span><span>${money(total())}</span></div><div class="summary-total"><span>Total</span><strong>${money(total())}</strong></div><a class="button" href="${url('checkout')}">Continue to checkout <span aria-hidden="true">→</span></a><p class="summary-note">All prices in Singapore dollars.</p></aside></div>`:`<section class="empty-cart"><span class="empty-bag">${bag}</span><h2>Room for something shiok.</h2><p>Pick a stall, find your favourites, and add them here.</p><a class="button" href="${url('')}">Explore the stalls <span aria-hidden="true">↗</span></a></section>`}</main>`;
  }
  const app = document.getElementById('app');
  function render() {
    const stall = stalls.find(s=>s.slug===page);
    app.innerHTML = header() + (page==='cart'?cartPage():stall?stallPage(stall):home()) + footer();
  }
  let toastTimer;
  function announce(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>toast.classList.remove('visible'),2500);
  }
  function save() {
    try { localStorage.setItem(cartKey, JSON.stringify(cart)); }
    catch { storageAvailable = false; }
    document.querySelectorAll('.cart-count').forEach(el=>{el.textContent=count();el.setAttribute('aria-label',`${count()} items`);});
    document.querySelectorAll('[data-item-summary]').forEach(el=>el.textContent=`${count()} ${count()===1?'item':'items'} in your cart`);
    document.querySelectorAll('[data-cart-total]').forEach(el=>el.textContent=money(total()));
    if (!storageAvailable) announce('Your browser cannot save this cart. Please enable local storage to keep your items between pages.');
  }
  app.addEventListener('click',event=>{
    const add = event.target.closest('[data-add]');
    const change = event.target.closest('[data-change]');
    const remove = event.target.closest('[data-remove]');
    const filter = event.target.closest('[data-category]');
    if (add) {
      const key=add.dataset.add;
      if ((cart[key]||0)>=99) { announce('You can add up to 99 of each item.'); return; }
      cart[key]=(cart[key]||0)+1;
      save();
      if (storageAvailable) announce(`${catalogue.get(key).item[1]} added to your cart`);
    }
    if (change || remove) {
      const key = change ? change.dataset.change : remove.dataset.remove;
      const oldQty = cart[key];
      const next = change ? Math.min(99,oldQty+Number(change.dataset.delta)) : 0;
      if (next>0) cart[key]=next; else delete cart[key];
      const delta = change?.dataset.delta;
      save(); render();
      const buttons = [...app.querySelectorAll('[data-change]')];
      const replacement = buttons.find(b=>b.dataset.change===key && b.dataset.delta===delta) || buttons[0] || app.querySelector('.empty-cart .button');
      replacement?.focus({preventScroll:true});
      announce(next ? `${catalogue.get(key).item[1]} quantity ${next}` : `${catalogue.get(key).item[1]} removed from cart`);
    }
    if (filter) {
      app.querySelectorAll('[data-category]').forEach(b=>{const selected=b===filter;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected);});
      filterStalls();
    }
  });
  function filterStalls() {
    const category=app.querySelector('.filter.selected').dataset.category;
    const query=app.querySelector('#search').value.trim().toLowerCase();
    const matches=stalls.filter(s=>(category==='All stalls'||s.category===category) && [s.name,s.label,...s.menu.map(m=>m[1])].join(' ').toLowerCase().includes(query));
    app.querySelector('#stall-grid').innerHTML=matches.map(stallCard).join('');
    app.querySelector('#no-results').hidden=matches.length>0;
    app.querySelector('#results-status').textContent=`${matches.length} ${matches.length===1?'stall':'stalls'} found`;
  }
  app.addEventListener('input',event=>{if(event.target.id==='search')filterStalls();});
  window.addEventListener('storage',event=>{if(event.key===cartKey)location.reload();});
  render();
})();
