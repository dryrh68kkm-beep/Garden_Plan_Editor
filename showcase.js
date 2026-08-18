const STORAGE = {
  plantOverrides: "garden_plant_overrides_v1",
  styleOverrides: "garden_style_overrides_v1",
  customPlants: "garden_custom_plants_v1",
  plantShowcaseIndex: "garden_plant_showcase_index_v1",
  gardenPortfolio: "garden_portfolio_v1",
  gardenSupplies: "garden_supplies_v1"
};

function esc(s=""){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function money(v){ return new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(Number(v)||0); }
// Opens a LINE chat with the shop's Official Account, pre-filled with a
// message about the specific plant — LINE's oaMessage deep link supports
// prefilling text this way (no LINE Login/Messaging API needed).
const LINE_OA_ID="@225yhyoy";
function lineOrderUrl(p){
  const priceText=p.salePrice?` ราคา ${money(p.salePrice)}${p.unit?`/${p.unit}`:""}`:"";
  const sizeText=plantSizeLabel(p)?` ขนาด ${plantSizeLabel(p)}`:"";
  const visibleCode=publicInventoryCode(p);
  const codeText=visibleCode?` รหัส ${visibleCode}`:"";
  const text=`สนใจสอบถาม: ${p.thaiName}${codeText}${sizeText}${priceText}`;
  return `https://line.me/R/oaMessage/${LINE_OA_ID}/?${encodeURIComponent(text)}`;
}
// Without SHOWCASE_WORKER_URL (see firebase-client.js) configured, the site
// is a single-page app with no per-plant URL — a shared link always opens
// the same generic showcase.html, so the plant's name/price ride along as
// the share *text* instead. Once the Worker is deployed, shares use its
// /plant/<id> link instead, which gives Facebook/LINE a real per-plant
// preview (photo + price) and still lands the customer on this exact plant
// (see openSharedPlantFromHash below).
const SHOWCASE_SHARE_URL="https://dryrh68kkm-beep.github.io/Garden_Plan_Editor/showcase.html";
let scLightboxPlant=null;
function sharePlantText(p){
  const priceText=p.salePrice?` ราคา ${money(p.salePrice)}${p.unit?`/${p.unit}`:""}`:"";
  const sizeText=plantSizeLabel(p)?` ขนาด ${plantSizeLabel(p)}`:"";
  return `${p.thaiName}${sizeText}${priceText} — ดูรูปและสั่งซื้อได้ที่ร้านรินลดา พันธุ์ไม้`;
}
function sharePlantUrl(p){
  return SHOWCASE_WORKER_URL?`${SHOWCASE_WORKER_URL}/plant/${encodeURIComponent(p.id)}`:SHOWCASE_SHARE_URL;
}
async function scSharePlant(p=scLightboxPlant){
  if(!p) return;
  const shareData={title:p.thaiName,text:sharePlantText(p),url:sharePlantUrl(p)};
  if(navigator.share){
    try{ await navigator.share(shareData); }catch(error){ /* user cancelled the native share sheet — nothing to do */ }
    return;
  }
  const clipboardText=`${shareData.text}\n${shareData.url}`;
  try{
    await navigator.clipboard.writeText(clipboardText);
    alert("คัดลอกข้อความและลิงก์ร้านแล้ว นำไปวางแชร์ต่อได้เลย");
  }catch(error){
    prompt("คัดลอกข้อความนี้เพื่อแชร์:",clipboardText);
  }
}
// Maps both the new ง่าย/ปานกลาง/ยาก scale and the older ต่ำ/กลาง/สูง values
// (still used by the static 300-item catalog) to the same colored-dot label.
const MAINTENANCE_LABELS={"ต่ำ":"🟢 ง่าย","กลาง":"🟡 ปานกลาง","สูง":"🔴 ยาก","ง่าย":"🟢 ง่าย","ปานกลาง":"🟡 ปานกลาง","ยาก":"🔴 ยาก"};
function maintenanceLabel(m){ return MAINTENANCE_LABELS[m]||m||"-"; }
// Mirrors app.js — admins can type an exact size (cm/m) per plant record
// instead of the catalog's fixed preset labels (เล็ก/กลาง/ใหญ่/...).
function plantSizeLabel(p){
  if(p.customSizeValue) return `${p.customSizeValue} ${p.customSizeUnit==="m"?"ม.":"ซม."}`;
  return p.sizeLabel||p.sizeCode||"";
}

// data/garden-styles-data.js and data/plants.json use a different field
// schema than this app was built against (window.GARDEN_STYLES instead of
// a bare gardenStyles global; nameTh/categoryId/price/careLevel/English
// light-water codes instead of name/category/salePrice/maintenance/Thai
// strings) — see the matching adapter + comment in app.js for the full
// story. Kept in sync here since both files consume the same data files.
const CARE_LEVEL_TO_MAINTENANCE={low:"ต่ำ",medium:"กลาง",high:"สูง"};
const LIGHT_CODE_TO_TH={fullSun:"แดดจัด",partialSun:"รำไรถึงแดด",brightShade:"แดดรำไร",shade:"ร่ม"};
const WATER_CODE_TO_TH={low:"น้อย",medium:"ปานกลาง",high:"มาก",aquatic:"มาก"};
const MAINTENANCE_TO_DIFFICULTY={"ต่ำ":"ง่าย","กลาง":"ปานกลาง","สูง":"ยาก"};
function adaptStyle(s){
  return {
    id:s.id,
    name:s.nameTh||s.nameEn||s.id,
    category:s.category||"",
    desc:s.description||"",
    budget:[s.budgetPerSqm?`${s.budgetPerSqm} บาท/ตร.ม.`:"",s.minimumProjectBudget?`งานเริ่มต้น ${new Intl.NumberFormat("th-TH").format(s.minimumProjectBudget)} บาท`:""].filter(Boolean).join(" · "),
    budgetNote:s.budgetNote||"",
    designFeePercent:s.designFeePercent||"",
    priceUpdatedAt:s.priceUpdatedAt||"",
    maintenance:s.maintenance||"",
    difficulty:MAINTENANCE_TO_DIFFICULTY[s.maintenance]||s.maintenance||"-",
    suitableFor:Array.isArray(s.suitableFor)?s.suitableFor:[],
    plants:Array.isArray(s.recommendedPlants)?s.recommendedPlants:[],
    materials:Array.isArray(s.materials)?s.materials:[],
    mood:Array.isArray(s.palette)?s.palette.join(", "):(s.palette||""),
    icon:"🌿",
    plantPlan:Array.isArray(s.plantPalette)?s.plantPalette:[],
    plantIds:Array.isArray(s.plantPalette)?s.plantPalette.map(p=>p.plantId).filter(Boolean):[],
    image:(window.GARDEN_STYLE_IMAGES&&window.GARDEN_STYLE_IMAGES[s.id])||s.image||""
  };
}
if(!Array.isArray(window.GARDEN_STYLES)) console.error("window.GARDEN_STYLES missing or invalid — check data/garden-styles-data.js");
const gardenStyles = Array.isArray(window.GARDEN_STYLES) ? window.GARDEN_STYLES.map(adaptStyle) : [];

let categoriesById = new Map();
async function loadCategories(){
  try{
    const response=await fetch("./data/categories.json",{cache:"no-store"});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(Array.isArray(data)) categoriesById=new Map(data.map(c=>[c.id,c.nameTh]));
  }catch(error){
    console.error("Category lookup error (categories will show as raw codes):",error);
  }
}
function adaptPlant(p){
  return {
    ...p,
    id:p.id,
    thaiName:p.nameTh||p.nameEn||p.id,
    englishName:p.nameEn||"",
    scientificName:p.scientificName||"",
    category:categoriesById.get(p.categoryId)||p.categoryId||"",
    light:LIGHT_CODE_TO_TH[p.light]||p.light||"",
    water:WATER_CODE_TO_TH[p.water]||p.water||"",
    maintenance:CARE_LEVEL_TO_MAINTENANCE[p.careLevel]||p.careLevel||"",
    unit:p.unit||"ต้น",
    costPrice:0,
    salePrice:Number(p.price)||0,
    bestSeller:false,
    isFocalPlant:false
  };
}

// Seeded from the local cache first (instant, works offline / same-browser
// as admin), then overwritten by initFromFirestore() once the cloud data
// arrives so the showcase reflects the back office from any device. Reading
// the cache (IndexedDB via local-store.js — see the comment on this in
// app.js) is async, so these start empty and hydrateFromLocalCache() below
// fills them in and re-renders as soon as it resolves, same pattern as the
// cloud sync already uses.
let styleOverrides = {};
let plantOverrides = {};
let customPlants = [];
let portfolioItems = [];
let DEFAULT_SUPPLIES=Array.isArray(window.GARDEN_SUPPLIES)?window.GARDEN_SUPPLIES:[];
async function ensureSupplyCatalog(){
  if(DEFAULT_SUPPLIES.length) return;
  await new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=`data/garden-supplies-data.js?v=202608130020-${Date.now()}`;
    script.onload=resolve;
    script.onerror=()=>reject(new Error("โหลดข้อมูลอุปกรณ์และปุ๋ยไม่สำเร็จ"));
    document.head.appendChild(script);
  });
  DEFAULT_SUPPLIES=Array.isArray(window.GARDEN_SUPPLIES)?window.GARDEN_SUPPLIES:[];
  supplyItems=mergeSupplyItems(supplyItems);
}
function mergeSupplyItems(rows=[]){const byId=new Map(DEFAULT_SUPPLIES.map(p=>[p.id,{...p}]));rows.forEach(p=>byId.set(p.id,{...(byId.get(p.id)||{}),...p}));return [...byId.values()].filter(p=>!p.deleted);}
let supplyItems = mergeSupplyItems();
async function hydrateFromLocalCache(){
  await LS.migrateFromLocalStorage([STORAGE.styleOverrides, STORAGE.plantOverrides, STORAGE.plantShowcaseIndex, STORAGE.gardenPortfolio, STORAGE.gardenSupplies]);
  const [sO,pO,cP,pI,sI]=await Promise.all([
    LS.get(STORAGE.styleOverrides,{}),
    LS.get(STORAGE.plantOverrides,{}),
    LS.get(STORAGE.plantShowcaseIndex,[]),
    LS.get(STORAGE.gardenPortfolio,[]),
    LS.get(STORAGE.gardenSupplies,[])
  ]);
  styleOverrides=sO;
  plantOverrides=pO;
  customPlants=cP;
  portfolioItems=pI;
  supplyItems=mergeSupplyItems(sI);
  renderScStyles();
  renderScPortfolio();
  rebuildAllPlants();
  fillScPlantCategoryFilter();
  renderScPlantGallery();
  fillScSupplyCategories();
  renderScSupplies();
}

function supplyLineUrl(p){
  const text=`สนใจสอบถามสินค้า: ${p.name}${p.code?` รหัส ${p.code}`:""}${p.price?` ราคา ${money(p.price)}/${p.unit||"ชิ้น"}`:""}`;
  return `https://line.me/R/oaMessage/${LINE_OA_ID}/?${encodeURIComponent(text)}`;
}
function renderScSupplies(){
  const list=document.getElementById("scSupplyList");
  if(!list) return;
  const q=(document.getElementById("scSupplySearch")?.value||"").trim().toLowerCase();
  const category=document.getElementById("scSupplyCategoryFilter")?.value||"";
  const rows=supplyItems.filter(p=>p.available!==false&&(!category||p.category===category)&&(!q||[p.name,p.code,p.category,p.description,p.suitableFor,p.usage].join(" ").toLowerCase().includes(q)));
  document.getElementById("scSupplyCount").textContent=`${rows.length} สินค้าพร้อมขาย`;
  list.innerHTML=rows.length?rows.map(p=>`<article class="showcase-supply-card"><div class="showcase-supply-photo">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" />`:`<div class="supply-photo-placeholder"><span>${esc(p.code||"GARDEN")}</span><small>${esc(p.category||"สินค้าในร้าน")}</small></div>`}</div><div class="showcase-supply-body"><p class="eyebrow">${esc(p.category||"GARDEN SHOP")}</p><h3>${esc(p.name)}</h3>${p.description?`<p class="meta supply-description">${esc(p.description)}</p>`:""}<details class="supply-usage"><summary>วิธีใช้และคำแนะนำ</summary>${p.suitableFor?`<p><b>เหมาะกับ:</b> ${esc(p.suitableFor)}</p>`:""}${p.usage?`<p><b>วิธีใช้:</b> ${esc(p.usage)}</p>`:""}${p.frequency?`<p><b>ความถี่:</b> ${esc(p.frequency)}</p>`:""}${p.caution?`<p class="supply-caution"><b>คำเตือน:</b> ${esc(p.caution)}</p>`:""}</details><div class="showcase-supply-price"><strong>${p.price?money(p.price):"สอบถามราคา"}</strong><span>${p.stock>0?`เหลือ ${p.stock} ${esc(p.unit||"ชิ้น")}`:"สอบถามสต็อก"}</span></div><a class="showcase-order-btn" href="${supplyLineUrl(p)}" target="_blank" rel="noopener">สอบถามผ่าน LINE</a></div></article>`).join(""):'<div class="empty">ยังไม่มีสินค้าในหมวดนี้</div>';
}
function fillScSupplyCategories(){
  const select=document.getElementById("scSupplyCategoryFilter");
  if(!select) return;
  const value=select.value;
  const categories=[...new Set(supplyItems.filter(p=>p.available!==false).map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"th"));
  select.innerHTML='<option value="">ทุกหมวด</option>'+categories.map(x=>`<option>${esc(x)}</option>`).join("");
  select.value=value;
}

function mergedStyles(){
  return gardenStyles.map(s=>styleOverrides[s.id] ? {...s, ...styleOverrides[s.id]} : s);
}
// Supports styles saved before multi-photo galleries existed (single s.image string).
function styleImages(s){
  if(s.images && s.images.length) return s.images;
  if(s.image) return [s.image];
  return [];
}
// Supports plants saved before multi-photo galleries existed (single p.image string).
function plantImages(p){
  if(p.images && p.images.length) return p.images;
  if(p.image) return [p.image];
  return [];
}
// Tile-grid cover: prefer the small companion thumbnail the admin generates
// alongside each full photo (see resizeImageWithThumb in app.js) so the
// gallery grid doesn't have to download/decode the full-size image for
// every tile — only the lightbox needs full resolution. Falls back to the
// full image for plants saved before thumbnails existed.
function plantCoverThumb(p){
  return (p.thumbs&&p.thumbs[0])||plantImages(p)[0];
}

// Full scene transition: the old page exits while the new page enters.
// Both scenes are isolated as fixed layers, so layout cannot shove either one.
const SC_MODAL_TRANSITION_MS=340;
const SC_PAGE_TRANSITION_MS=380;
let scPageTransitioning=false;
function showPage(name){
  const next=document.getElementById(`${name}Page`);
  const current=document.querySelector(".page.active");
  if(!next||current===next||scPageTransitioning) return;

  const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reducedMotion||!next.animate){
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
    current.classList.remove("active");
    next.classList.add("active");
    return;
  }

  scPageTransitioning=true;
  const returningHome=name==="showcaseHome";
  const direction=returningHome?-1:1;
  const scrollY=window.scrollY;

  next.classList.add("active","sc-page-scene","sc-page-incoming");
  current.classList.add("sc-page-scene");
  next.scrollTop=0;
  current.scrollTop=scrollY;
  document.body.classList.add("sc-page-transitioning");
  // Force the browser to commit the layout/style changes above (both pages
  // going position:fixed, scroll offsets applied) in one clean paint before
  // the transform animation starts below. Without this, the class change and
  // the animation's very first frame can get bundled unpredictably across
  // the two elements, which is what showed up as a visible flicker when
  // switching tabs.
  void next.offsetHeight;

  const options={
    duration:SC_PAGE_TRANSITION_MS,
    easing:"cubic-bezier(.4,0,.2,1)",
    fill:"both"
  };
  const outgoing=current.animate(
    [
      {transform:"translate3d(0,0,0)"},
      {transform:`translate3d(${-direction*100}vw,0,0)`}
    ],
    options
  );
  const incoming=next.animate(
    [
      {transform:`translate3d(${direction*100}vw,0,0)`},
      {transform:"translate3d(0,0,0)"}
    ],
    options
  );

  incoming.finished.catch(()=>{}).then(()=>{
    outgoing.cancel();
    incoming.cancel();
    current.classList.remove("active","sc-page-scene");
    next.classList.remove("sc-page-scene","sc-page-incoming");
    document.body.classList.remove("sc-page-transitioning");
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
    scPageTransitioning=false;
  });
}

// The plant lightbox slides in/out (see openScPlantLightbox / closeScPlantLightboxAnimated);
// every other dialog just closes instantly as before.
document.querySelectorAll(".close-dialog").forEach(b=>b.addEventListener("click",()=>{
  const dlg=b.closest("dialog");
  if(dlg.id==="scPlantLightbox") closeScPlantLightboxAnimated();
  else dlg.close();
}));
document.getElementById("scPlantLightbox").addEventListener("cancel",e=>{
  e.preventDefault();
  closeScPlantLightboxAnimated();
});
function closeScPlantLightboxAnimated(){
  const dlg=document.getElementById("scPlantLightbox");
  if(!dlg.open) return;
  dlg.classList.remove("sc-modal-enter","sc-modal-enter-active");
  void dlg.offsetWidth;
  dlg.classList.add("sc-modal-exit-active");
  setTimeout(()=>{
    dlg.classList.remove("sc-modal-exit-active");
    dlg.close();
  },SC_MODAL_TRANSITION_MS);
}

// Swipe right (like a mobile "back" gesture) on a content page returns to
// the showcase home page. Skipped while a dialog (lightbox/detail) is open
// so swiping inside a photo carousel there doesn't also navigate the page
// underneath, and ignored on mostly-vertical swipes (page scrolling).
let scSwipeStartX=0, scSwipeStartY=0;
document.addEventListener("touchstart",e=>{
  if(e.touches.length!==1) return;
  scSwipeStartX=e.touches[0].clientX;
  scSwipeStartY=e.touches[0].clientY;
},{passive:true});
document.addEventListener("touchend",e=>{
  if(document.querySelector("dialog[open]")) return;
  const activePage=document.querySelector(".page.active");
  if(!activePage||activePage.id==="showcaseHomePage") return;
  const touch=e.changedTouches[0];
  if(!touch) return;
  const dx=touch.clientX-scSwipeStartX;
  const dy=touch.clientY-scSwipeStartY;
  if(dx>80&&Math.abs(dy)<60) showPage("showcaseHome");
},{passive:true});

function closeScMenu(){ document.getElementById("scMenuDropdown").classList.remove("open"); }
document.getElementById("scMenuBtn").addEventListener("click",e=>{
  e.stopPropagation();
  document.getElementById("scMenuDropdown").classList.toggle("open");
});
document.addEventListener("click",e=>{
  if(!e.target.closest("#scMenuDropdown")&&!e.target.closest("#scMenuBtn")) closeScMenu();
});

// ---- Curated active plant data, merged with back-office overrides ----
// Loaded once up front so garden-style detail pages can show linked real
// plants even before the visitor opens the plant gallery tab.
let rawPlants=[];
let allPlants=[];
let plantById=new Map();
function rebuildAllPlants(){
  allPlants=[...rawPlants, ...customPlants].map(p=>plantOverrides[p.id] ? {...p, ...plantOverrides[p.id]} : p);
  plantById=new Map(allPlants.map(p=>[p.id,p]));
}
function fillScPlantCategoryFilter(){
  const select=document.getElementById("scPlantCategoryFilter");
  const current=select.value;
  const categories=[...new Set(allPlants.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"th"));
  select.innerHTML='<option value="">ทุกประเภท</option>'+categories.map(x=>`<option>${esc(x)}</option>`).join("");
  select.value=current;
}
// Supplementary care/belief info for the 300-item catalog (data/plant-care-beliefs.json),
// keyed by plantId. Belief text is only surfaced once hasVerifiedBelief is
// true, per that file's own policy.
let careBeliefsById=new Map();
async function loadCareBeliefs(){
  try{
    const response=await fetch("./data/plant-care-beliefs.json",{cache:"no-store"});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!Array.isArray(data)) throw new Error("รูปแบบฐานข้อมูลไม่ถูกต้อง");
    careBeliefsById=new Map(data.map(r=>[r.plantId,r]));
  }catch(error){
    console.error("Plant care/beliefs database error:",error);
    careBeliefsById=new Map();
  }
}
function plantCareInfo(p){
  const cb=careBeliefsById.get(p.id);
  const care=cb?.care||{};
  const belief=cb?.belief;
  return {
    wateringInstruction:care.wateringInstruction||"",
    lightInstruction:care.lightInstruction||"",
    auspicious:p.auspicious||(belief&&belief.hasVerifiedBelief?belief.summary:""),
    auspiciousTitle:belief&&belief.hasVerifiedBelief?belief.title:"",
    placementBelief:belief&&belief.hasVerifiedBelief?belief.placementBelief:""
  };
}
async function loadAllPlants(){
  try{
    await loadCategories();
    const response=await fetch("./data/plants.json",{cache:"no-store"});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!Array.isArray(data)) throw new Error("รูปแบบฐานข้อมูลไม่ถูกต้อง");
    rawPlants=data.filter(p=>p.active!==false).map(adaptPlant);
    rebuildAllPlants();
    fillScPlantCategoryFilter();
    renderScPlantGallery();
  }catch(error){
    console.error("Showcase plant data error:",error);
    rawPlants=[];
    allPlants=[];
    plantById=new Map();
    document.getElementById("scPlantCount").textContent="โหลดข้อมูลไม่สำเร็จ";
    document.getElementById("scPlantList").innerHTML='<div class="empty">ไม่สามารถโหลดข้อมูลต้นไม้ได้</div>';
  }
}

// ---- Garden styles ----
function renderScStyles(){
  const q=(document.getElementById("scStyleSearch").value||"").toLowerCase();
  const category=document.getElementById("scStyleCategoryFilter").value||"";
  const rows=mergedStyles().filter(s=>{
    const hay=[s.name,s.category,s.desc,s.mood,...(s.plants||[]),...(s.materials||[])].join(" ").toLowerCase();
    return (!category||s.category===category)&&hay.includes(q);
  });
  document.getElementById("scStyleCount").textContent=`แสดง ${rows.length} จาก ${gardenStyles.length} แบบ`;
  document.getElementById("scStyleList").innerHTML=rows.length?rows.map(s=>{
    const images=styleImages(s);
    const cover=images[0];
    const extraThumbs=images.slice(1,4);
    return `
    <article class="style-card" onclick="openScStyleDetail('${s.id}')">
      <div class="style-cover"${cover?` style="background-image:url('${esc(cover)}')"`:""}>${cover?"":s.icon}</div>
      ${extraThumbs.length?`<div class="style-cover-thumbs">${extraThumbs.map(src=>`<div class="style-cover-thumb" style="background-image:url('${esc(src)}')"></div>`).join("")}</div>`:""}
      <div class="style-body">
        <div class="category-label">${esc(s.category)}</div>
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.desc)}</p>
        <div class="chips">
          <span class="chip">ดูแล ${esc(s.maintenance)}</span>
          <span class="chip">${esc(s.budget)}</span>
        </div>
        <div class="style-actions">
          <button class="btn btn-primary" onclick="event.stopPropagation();openScStyleDetail('${s.id}')">ดูรายละเอียด</button>
        </div>
      </div>
    </article>`;
  }).join(""):'<div class="empty">ไม่พบแบบสวนที่ค้นหา</div>';
}
// Renders the hero as a horizontally scrollable, scroll-snapped track so
// visitors can swipe between photos with a native touch gesture instead of
// only tapping thumbnails.
// Generic swipeable, scroll-snapped photo carousel shared by the garden
// style detail view and the plant photo lightbox.
function renderScGallery(images,icon,heroId,thumbsId){
  const hero=document.getElementById(heroId);
  const thumbs=document.getElementById(thumbsId);
  if(!images.length){
    hero.innerHTML=`<div class="style-detail-hero-slide style-detail-hero-empty">${icon}</div>`;
    thumbs.innerHTML="";
    hero.onscroll=null;
    return;
  }
  hero.innerHTML=images.map(src=>`<div class="style-detail-hero-slide" style="background-image:url('${esc(src)}')"></div>`).join("");
  thumbs.innerHTML=images.length>1?images.map((src,i)=>`<img src="${esc(src)}" data-idx="${i}" alt="" class="${i===0?"active":""}" />`).join(""):"";
  const slides=hero.querySelectorAll(".style-detail-hero-slide");
  const thumbEls=thumbs.querySelectorAll("img");
  thumbEls.forEach(el=>el.addEventListener("click",()=>{
    slides[Number(el.dataset.idx)].scrollIntoView({behavior:"smooth",inline:"start",block:"nearest"});
  }));
  let ticking=false;
  hero.onscroll=()=>{
    if(ticking) return;
    ticking=true;
    requestAnimationFrame(()=>{
      const idx=Math.round(hero.scrollLeft/hero.clientWidth);
      thumbEls.forEach((el,i)=>el.classList.toggle("active",i===idx));
      ticking=false;
    });
  };
  hero.scrollLeft=0;
}
function scLinkedPlantsHtml(plantIds,plantPlan){
  if(!plantIds||!plantIds.length) return '<div class="meta">ยังไม่ได้ระบุต้นไม้สำหรับสวนนี้</div>';
  const planById=new Map((plantPlan||[]).map(item=>[item.plantId,item]));
  return plantIds.map(id=>{
    const p=plantById.get(id);
    if(!p) return "";
    const plan=planById.get(id)||{};
    const cover=plantCoverThumb(p);
    const usage=[plan.role,plan.position].filter(Boolean).map(esc).join(" · ");
    const amount=[plan.recommendedQty?`จำนวน ${esc(plan.recommendedQty)}`:"",plan.spacing?`ระยะปลูก ${esc(plan.spacing)}`:""].filter(Boolean).join(" · ");
    return `<div class="linked-plant-tile sc-plant-plan-tile" onclick="openScPlantLightbox('${p.id}')">
      <div class="linked-plant-thumb">${cover?`<img src="${esc(cover)}" alt="${esc(p.thaiName)}" loading="lazy"/>`:"🌱"}</div>
      <div class="sc-plant-plan-copy"><div class="linked-plant-name">${esc(p.thaiName)}</div>${usage?`<div class="sc-plant-plan-use">${usage}</div>`:""}${amount?`<div class="sc-plant-plan-amount">${amount}</div>`:""}</div>
    </div>`;
  }).join("");
}
function openScStyleDetail(id){
  const s=mergedStyles().find(x=>x.id===id);
  if(!s) return;
  document.getElementById("scStyleDetailCategory").textContent=s.category;
  document.getElementById("scStyleDetailName").textContent=s.name;
  renderScGallery(styleImages(s),s.icon,"scStyleDetailHero","scStyleDetailThumbs");
  document.getElementById("scStyleDetailDescription").textContent=s.desc;
  document.getElementById("scStyleDetailBudget").textContent=s.budget;
  document.getElementById("scStyleDetailPricingNote").textContent=[s.budgetNote,s.designFeePercent?`ค่าออกแบบโดยทั่วไป ${s.designFeePercent}`:"",s.priceUpdatedAt?`อัปเดตราคา ${s.priceUpdatedAt}`:""].filter(Boolean).join(" · ");
  document.getElementById("scStyleDetailMaintenance").textContent=s.maintenance;
  document.getElementById("scStyleDetailDifficulty").textContent=s.difficulty;
  document.getElementById("scStyleDetailSuitable").textContent=(s.suitableFor||[]).join(", ");
  document.getElementById("scStyleDetailLinkedPlants").innerHTML=scLinkedPlantsHtml(s.plantIds,s.plantPlan);
  document.getElementById("scStyleDetailPlants").innerHTML=(s.plants||[]).map(x=>`<span class="chip">${esc(x)}</span>`).join("");
  document.getElementById("scStyleDetailMaterials").innerHTML=(s.materials||[]).map(x=>`<span class="chip">${esc(x)}</span>`).join("");
  document.getElementById("scStyleDetailMood").textContent=s.mood;
  document.getElementById("scStyleDetailDialog").showModal();
  // Reset the hero scroll position after the dialog is actually visible —
  // setting it while the <dialog> is still closed/hidden gets discarded by
  // the browser's scroll-snap layout once it opens.
  requestAnimationFrame(()=>{ document.getElementById("scStyleDetailHero").scrollLeft=0; });
}
document.getElementById("scStyleSearch").addEventListener("input",renderScStyles);
document.getElementById("scStyleCategoryFilter").addEventListener("change",renderScStyles);

function wireSearchClear(inputId){
  const input=document.getElementById(inputId);
  const btn=document.querySelector(`.search-clear-btn[data-clear="${inputId}"]`);
  if(!input||!btn) return;
  const sync=()=>{ btn.style.display=input.value?"flex":"none"; };
  input.addEventListener("input",sync);
  btn.addEventListener("click",()=>{
    input.value="";
    input.dispatchEvent(new Event("input"));
    input.focus();
    sync();
  });
  sync();
}
wireSearchClear("scStyleSearch");
wireSearchClear("scPlantSearch");

// ---- Garden portfolio (real completed projects) ----
function renderScPortfolio(){
  const list=document.getElementById("scPortfolioList");
  list.innerHTML=portfolioItems.length?portfolioItems.map(item=>{
    const images=(item.images||[]);
    const cover=images[0];
    const extraThumbs=images.slice(1,4);
    return `
    <article class="style-card" onclick="openScPortfolioDetail('${item.id}')">
      <div class="style-cover"${cover?` style="background-image:url('${esc(cover)}')"`:""}>${cover?"":"🏡"}</div>
      ${extraThumbs.length?`<div class="style-cover-thumbs">${extraThumbs.map(src=>`<div class="style-cover-thumb" style="background-image:url('${esc(src)}')"></div>`).join("")}</div>`:""}
      <div class="style-body">
        <h3>${esc(item.title||"ผลงานจัดสวน")}</h3>
        ${item.location?`<p class="meta">📍 ${esc(item.location)}</p>`:""}
        <div class="chips">
          ${item.budget?`<span class="chip">งบประมาณ ${esc(item.budget)}</span>`:""}
          ${item.duration?`<span class="chip">ใช้เวลา ${esc(item.duration)}</span>`:""}
        </div>
        <div class="style-actions">
          <button class="btn btn-primary" onclick="event.stopPropagation();openScPortfolioDetail('${item.id}')">ดูรายละเอียด</button>
        </div>
      </div>
    </article>`;
  }).join(""):'<div class="empty">เร็วๆ นี้เราจะนำผลงานจัดสวนจริงมาให้ชมครับ</div>';
}
function openScPortfolioDetail(id){
  const item=portfolioItems.find(x=>x.id===id);
  if(!item) return;
  document.getElementById("scPortfolioDetailName").textContent=item.title||"ผลงานจัดสวน";
  renderScGallery(item.images||[],"🏡","scPortfolioDetailHero","scPortfolioDetailThumbs");
  document.getElementById("scPortfolioDetailLocation").textContent=item.location||"-";
  document.getElementById("scPortfolioDetailBudget").textContent=item.budget||"-";
  document.getElementById("scPortfolioDetailDuration").textContent=item.duration||"-";
  document.getElementById("scPortfolioDetailDescription").textContent=item.description||"";
  document.getElementById("scPortfolioDetailDialog").showModal();
  requestAnimationFrame(()=>{ document.getElementById("scPortfolioDetailHero").scrollLeft=0; });
}

// ---- Plant gallery (photos attached in the back office only) ----
const PLANT_PAGE_SIZE=24;
let scPlantVisibleCount=PLANT_PAGE_SIZE;

function resetScPlantPaging(){
  scPlantVisibleCount=PLANT_PAGE_SIZE;
  renderScPlantGallery();
}
// Same species/size grouping as the admin plant grid (see app.js) — the
// catalog is 50 species × 6 size/grade variants, so without grouping a
// visitor scrolling the gallery would see the same plant name repeated up
// to 6 times with nothing but a tiny size tag to tell them apart.
const PLANT_SIZE_ORDER=["S","M","L","XL","STD","PRE"];
function normalizedPlantSpeciesName(name=""){
  return String(name).trim().toLocaleLowerCase("th-TH").replace(/\s+/g," ");
}
function plantGroupKey(p){
  if(p.speciesId) return String(p.speciesId);
  if(p.custom&&p.thaiName) return `custom:${normalizedPlantSpeciesName(p.thaiName)}`;
  return String(p.id);
}
function isAvailablePlant(p){ return !p.stockStatus||p.stockStatus==="available"; }
function groupPlantsBySpecies(rows){
  const groups=new Map();
  const order=[];
  for(const p of rows){
    const key=plantGroupKey(p);
    if(!groups.has(key)){ groups.set(key,[]); order.push(key); }
    groups.get(key).push(p);
  }
  order.forEach(key=>groups.get(key).sort((a,b)=>{
    if(a.custom||b.custom) return String(b.arrivalDate||"").localeCompare(String(a.arrivalDate||""))||String(a.inventoryCode||a.id).localeCompare(String(b.inventoryCode||b.id),"th");
    return PLANT_SIZE_ORDER.indexOf(a.sizeCode)-PLANT_SIZE_ORDER.indexOf(b.sizeCode);
  }));
  return order.map(key=>groups.get(key));
}
let scPlantGroupsByKey=new Map();
let scPublicInventoryCodes=new Map();
function publicInventoryCode(p){
  return scPublicInventoryCodes.get(p.id)||p.inventoryCode||"";
}
function displayInventoryCode(p,index){
  const stored=String(p.inventoryCode||p.id||"");
  if(stored&&!/^(plant_|TREE-)/i.test(stored)) return stored;
  return `${p.thaiName||"ต้นไม้"}-${String(index+1).padStart(2,"0")}`;
}
function renderScPlantTileHtml(variants,selectedId){
  const realItems=variants.filter(p=>p.custom&&isAvailablePlant(p));
  if(realItems.length){
    const p=realItems[0];
    const prices=realItems.map(x=>Number(x.salePrice)||0).filter(Boolean);
    const minPrice=prices.length?Math.min(...prices):0;
    return `
      <article class="showcase-plant-tile sc-species-card" data-group-key="${esc(plantGroupKey(p))}" onclick="openScPlantGroup('${esc(plantGroupKey(p))}')">
        <div class="showcase-plant-photo"><img src="${esc(plantCoverThumb(p))}" alt="${esc(p.thaiName)}" loading="lazy" /><span class="sc-new-stock-badge">เข้าใหม่ ${realItems.length} ต้น</span>${p.bestSeller?'<span class="best-seller-badge badge-stacked">🔥 ขายดี</span>':""}</div>
        <div class="showcase-plant-info">
          <div class="showcase-plant-title-wrap"><div class="showcase-plant-caption">${esc(p.thaiName)}</div><div class="showcase-plant-meta">ต้นไม้จริงพร้อมขาย ${realItems.length} ต้น</div></div>
          <div class="showcase-plant-price-row">${minPrice?`<div class="showcase-plant-price-tag">เริ่ม ${money(minPrice)}</div>`:`<div class="showcase-plant-price-tag showcase-plant-price-tag--ask">สอบถามราคา</div>`}<span>อัปเดตจากสต็อกร้าน</span></div>
        </div>
        <button type="button" class="showcase-order-btn sc-view-stock-btn" onclick="event.stopPropagation();openScPlantGroup('${esc(plantGroupKey(p))}')">ดูต้นจริงทั้งหมด ${realItems.length} ต้น →</button>
      </article>`;
  }
  const p=variants.find(v=>v.id===selectedId)||variants[0];
  const size=plantSizeLabel(p);
  const availability=p.salePrice?"สอบถามจำนวนคงเหลือ":"สอบถามราคาและขนาด";
  return `
    <article class="showcase-plant-tile" data-group-key="${esc(plantGroupKey(p))}" onclick="openScPlantLightbox('${esc(p.id)}')">
      <div class="showcase-plant-photo"><img src="${esc(plantCoverThumb(p))}" alt="${esc(p.thaiName)}" loading="lazy" />${p.bestSeller?'<span class="best-seller-badge">🔥 ขายดี</span>':""}${p.isFocalPlant?'<span class="focal-plant-badge">🌳 ไม้ประธาน</span>':""}</div>
      <div class="showcase-plant-info">
        <div class="showcase-plant-title-wrap"><div class="showcase-plant-caption">${esc(p.thaiName)}</div><div class="showcase-plant-meta">${[size?`ขนาด ${size}`:"",p.light||""].filter(Boolean).map(esc).join(" · ")}</div></div>
        ${variants.length>1?`<div class="plant-size-picker">${variants.map(v=>`<button type="button" class="plant-size-chip${v.id===p.id?" active":""}" data-plant-id="${esc(v.id)}" onclick="event.stopPropagation();scSwitchPlantVariant(this)">${esc(plantSizeLabel(v)||"?")}</button>`).join("")}</div>`:""}
        <div class="showcase-plant-price-row">${p.salePrice?`<div class="showcase-plant-price-tag">${money(p.salePrice)}${p.unit?` / ${esc(p.unit)}`:""}</div>`:`<div class="showcase-plant-price-tag showcase-plant-price-tag--ask">สอบถามราคา</div>`}<span>${availability}</span></div>
      </div>
      <a class="showcase-order-btn" href="${esc(lineOrderUrl(p))}" target="_blank" rel="noopener" onclick="event.stopPropagation()">💬 สอบถามต้นนี้ผ่าน LINE</a>
    </article>`;
}
function scSwitchPlantVariant(btn){
  const tile=btn.closest(".showcase-plant-tile");
  const variants=scPlantGroupsByKey.get(tile.dataset.groupKey);
  if(!variants) return;
  tile.outerHTML=renderScPlantTileHtml(variants,btn.dataset.plantId);
}
function renderScSpecimenHtml(p,index){
  const cover=plantCoverThumb(p);
  const code=displayInventoryCode(p,index);
  return `<article class="sc-specimen-card" onclick="openScSpecimen('${esc(p.id)}')">
    <div class="sc-specimen-photo">${cover?`<img src="${esc(cover)}" alt="${esc(p.thaiName)} ${esc(code)}" loading="lazy" />`:"🌱"}<span class="sc-specimen-number">ต้นที่ ${index+1}</span></div>
    <div class="sc-specimen-info">
      <h4>${esc(p.thaiName)}</h4>
      <strong>รหัส ${esc(code)}</strong>
      <span>${[plantSizeLabel(p)?`ขนาด ${plantSizeLabel(p)}`:"",p.arrivalDate?`เข้า ${p.arrivalDate}`:""].filter(Boolean).map(esc).join(" · ")}</span>
      <b>${p.salePrice?money(p.salePrice):"สอบถามราคา"}</b>
      <button type="button" class="small-btn" onclick="event.stopPropagation();openScSpecimen('${esc(p.id)}')">ดูรูปและรายละเอียด →</button>
    </div>
  </article>`;
}
// Shares the group's first specimen — same one the tile card itself
// represents (name/price shown on the grid) — since the group as a whole
// doesn't have its own id, only its individual specimens do.
let scGroupSharePlant=null;
function openScPlantGroup(key){
  const items=(scPlantGroupsByKey.get(key)||[]).filter(p=>p.custom&&isAvailablePlant(p));
  if(!items.length) return;
  scPublicInventoryCodes=new Map(items.map((p,index)=>[p.id,displayInventoryCode(p,index)]));
  scGroupSharePlant=items[0];
  document.getElementById("scPlantGroupName").textContent=items[0].thaiName;
  document.getElementById("scPlantGroupCount").textContent=`มีต้น${items[0].thaiName}จริงพร้อมขาย ${items.length} ต้น · แต่ละการ์ดคือสินค้าจริงคนละต้น`;
  document.getElementById("scPlantGroupList").innerHTML=items.map(renderScSpecimenHtml).join("");
  document.getElementById("scPlantGroupDialog").showModal();
}
function openScSpecimen(id){
  document.getElementById("scPlantGroupDialog").close();
  openScPlantLightbox(id);
}
function renderScPlantGallery(){
  const q=(document.getElementById("scPlantSearch").value||"").toLowerCase();
  const category=document.getElementById("scPlantCategoryFilter").value||"";
  const special=document.getElementById("scPlantSpecialFilter").value;
  const rows=allPlants.filter(p=>!!plantImages(p).length
    &&(!p.custom||isAvailablePlant(p))
    &&[p.thaiName,p.englishName,p.scientificName,p.inventoryCode].join(" ").toLowerCase().includes(q)
    &&(!category||p.category===category)
    &&(special!=="bestSeller"||p.bestSeller)
    &&(special!=="focal"||p.isFocalPlant));
  const groups=groupPlantsBySpecies(rows)
    .sort((a,b)=>{
      // Best sellers always lead the gallery, regardless of arrival date;
      // within each of those two tiers, newest arrivals still show first.
      const bestSeller=(b.some(p=>p.bestSeller)?1:0)-(a.some(p=>p.bestSeller)?1:0);
      if(bestSeller) return bestSeller;
      return String(b[0]?.arrivalDate||"").localeCompare(String(a[0]?.arrivalDate||""));
    });
  scPlantGroupsByKey=new Map(groups.map(g=>[plantGroupKey(g[0]),g]));
  const visibleGroups=groups.slice(0,scPlantVisibleCount);
  document.getElementById("scPlantCount").textContent=groups.length
    ? `พรรณไม้พร้อมรูป ${groups.length} ชนิด · กำลังแสดง ${visibleGroups.length} ชนิด`
    : "ยังไม่มีรูปต้นไม้ในผลงาน";
  document.getElementById("scPlantList").innerHTML=visibleGroups.length
    ?visibleGroups.map(g=>renderScPlantTileHtml(g,g[0].id)).join("")
    :'<div class="empty">ยังไม่มีรูปต้นไม้ในผลงาน</div>';
  const loadMoreBtn=document.getElementById("scLoadMorePlantsBtn");
  const remaining=groups.length-visibleGroups.length;
  if(remaining>0){
    loadMoreBtn.textContent=`โหลดเพิ่ม (เหลืออีก ${remaining} ชนิด)`;
    loadMoreBtn.style.display="inline-flex";
  } else {
    loadMoreBtn.style.display="none";
  }
}
// Swipeable, scroll-snapped photo carousel for the plant lightbox — a
// separate implementation from renderScGallery() since photos here show
// full-frame (object-fit:contain) rather than cropped as a cover banner.
function renderScPlantLightboxGallery(images){
  const carousel=document.getElementById("scPlantLightboxCarousel");
  const thumbs=document.getElementById("scPlantLightboxThumbs");
  carousel.innerHTML=images.map(src=>`<div class="showcase-lightbox-slide"><img src="${esc(src)}" class="showcase-lightbox-img" alt="" loading="lazy" /></div>`).join("");
  thumbs.innerHTML=images.length>1?images.map((src,i)=>`<img src="${esc(src)}" data-idx="${i}" alt="" class="${i===0?"active":""}" />`).join(""):"";
  const slides=carousel.querySelectorAll(".showcase-lightbox-slide");
  const thumbEls=thumbs.querySelectorAll("img");
  thumbEls.forEach(el=>el.addEventListener("click",()=>{
    slides[Number(el.dataset.idx)].scrollIntoView({behavior:"smooth",inline:"start",block:"nearest"});
  }));
  let ticking=false;
  carousel.onscroll=()=>{
    if(ticking) return;
    ticking=true;
    requestAnimationFrame(()=>{
      const idx=Math.round(carousel.scrollLeft/carousel.clientWidth);
      thumbEls.forEach((el,i)=>el.classList.toggle("active",i===idx));
      ticking=false;
    });
  };
  carousel.scrollLeft=0;
}
async function openScPlantLightbox(id){
  let p=plantById.get(id);
  if(!p) return;
  // Public inventory index contains only a small thumbnail. Fetch the full
  // Firestore document for this one physical tree only after the customer clicks.
  if(p.custom&&!p.detailLoaded){
    try{
      const detail=await fbGet("customPlants",id);
      if(detail){
        p={...p,...detail,detailLoaded:true};
        customPlants=customPlants.map(x=>x.id===id?p:x);
        rebuildAllPlants();
      }
    }catch(error){
      console.error("Could not load full plant detail, using thumbnail:",error);
    }
  }
  const images=plantImages(p);
  if(!images.length) return;
  scLightboxPlant=p;
  document.getElementById("scPlantLightboxName").textContent=[p.thaiName,publicInventoryCode(p)?`รหัส ${publicInventoryCode(p)}`:"",plantSizeLabel(p)?`ขนาด${plantSizeLabel(p)}`:"",p.englishName].filter(Boolean).join(" · ");
  renderScPlantLightboxGallery(images);
  const priceTag=document.getElementById("scPlantLightboxPriceTag");
  if(p.salePrice){
    priceTag.textContent=`🏷️ ${money(p.salePrice)}${p.unit?` / ${p.unit}`:""}`;
    priceTag.style.display="inline-flex";
  } else {
    priceTag.style.display="none";
  }
  const lightboxBestSeller=document.getElementById("scPlantLightboxBestSeller");
  lightboxBestSeller.textContent="🔥 สินค้าขายดี";
  lightboxBestSeller.style.display=p.bestSeller?"inline-flex":"none";
  const lightboxFocal=document.getElementById("scPlantLightboxFocal");
  lightboxFocal.textContent="🌳 ไม้ประธาน";
  lightboxFocal.style.display=p.isFocalPlant?"inline-flex":"none";
  // Both badges anchor to the same corner now — when best-seller is also
  // showing, nudge focal down below it instead of the two overlapping.
  lightboxFocal.classList.toggle("badge-stacked",!!p.bestSeller);
  document.getElementById("scPlantLightboxOrderBtn").href=lineOrderUrl(p);
  document.getElementById("scPlantLightboxLight").textContent=p.light||"-";
  document.getElementById("scPlantLightboxWater").textContent=p.water||"-";
  document.getElementById("scPlantLightboxMaintenance").textContent=maintenanceLabel(p.maintenance);
  const info=plantCareInfo(p);
  const wateringNote=document.getElementById("scPlantLightboxWateringNote");
  if(info.wateringInstruction){
    wateringNote.textContent=`💧 ${info.wateringInstruction}`;
    wateringNote.style.display="block";
  } else {
    wateringNote.style.display="none";
  }
  const auspiciousSection=document.getElementById("scPlantLightboxAuspiciousSection");
  if(info.auspicious){
    document.getElementById("scPlantLightboxAuspiciousTitle").textContent=info.auspiciousTitle?`ความเชื่อ / ความมงคล — ${info.auspiciousTitle}`:"ความเชื่อ / ความมงคล";
    document.getElementById("scPlantLightboxAuspicious").textContent=info.auspicious+(info.placementBelief?` (${info.placementBelief})`:"");
    auspiciousSection.style.display="block";
  } else {
    auspiciousSection.style.display="none";
  }
  const dlg=document.getElementById("scPlantLightbox");
  dlg.classList.remove("sc-modal-exit-active");
  dlg.classList.add("sc-modal-enter");
  dlg.showModal();
  document.getElementById("scPlantLightboxCarousel").scrollLeft=0;
  // Force layout with the entering transform applied first, then flip to
  // the resting position on the next frame so the transition actually
  // animates instead of jumping straight to the end state.
  void dlg.offsetWidth;
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      dlg.classList.add("sc-modal-enter-active");
    });
  });
  setTimeout(()=>{
    dlg.classList.remove("sc-modal-enter","sc-modal-enter-active");
  },SC_MODAL_TRANSITION_MS);
}
document.getElementById("scPlantSearch").addEventListener("input",resetScPlantPaging);
document.getElementById("scPlantCategoryFilter").addEventListener("change",resetScPlantPaging);
document.getElementById("scPlantSpecialFilter").addEventListener("change",resetScPlantPaging);
document.getElementById("scLoadMorePlantsBtn").addEventListener("click",()=>{
  scPlantVisibleCount+=PLANT_PAGE_SIZE;
  renderScPlantGallery();
});
document.getElementById("scSupplySearch").addEventListener("input",renderScSupplies);
document.getElementById("scSupplyCategoryFilter").addEventListener("change",renderScSupplies);
document.getElementById("scPlantLightboxShareBtn").addEventListener("click",()=>scSharePlant());
document.getElementById("scPlantGroupShareBtn").addEventListener("click",()=>scSharePlant(scGroupSharePlant));

renderScStyles();
renderScPortfolio();
fillScSupplyCategories();
renderScSupplies();
loadAllPlants();
loadCareBeliefs();

// Pull the latest overrides from Firestore so this page reflects the back
// office from any device, not just the browser that saved them. Falls back
// to whatever the local cache already had (or nothing) if the cloud is
// unreachable — the showcase must still render either way.
//
// Cost note: this is the expensive path (6-7 document-list reads). It only
// ever runs on first load and when checkForCatalogUpdates() (below) detects
// the admin side's catalogMeta/public revision has actually changed — never
// on a plain timer. That's what keeps a showcase tab left open for hours
// from re-downloading the whole catalog over and over.
let lastFetchSignature=null;
async function initFromFirestore(){
  try{
    const [remoteStyleOverrides,remotePlantOverrides,remotePlantShowcaseIndex,remotePortfolio,remoteSupplies,remoteCatalogMeta,remoteAuthoritativeFields]=await Promise.all([
      fbList("styleOverrides"),
      fbList("plantOverrides"),
      fbList("plantShowcaseIndex"),
      fbList("gardenPortfolio"),
      fbList("gardenSupplies"),
      fbGet("catalogMeta","public"),
      // plantShowcaseIndex is a denormalized copy of customPlants written as
      // a separate operation (see saveCustomPlant/syncPlantShowcaseIndexes
      // in app.js) — it can lag behind if that second write hasn't landed
      // yet. Availability, price, and grid-thumbnail decisions must never
      // trust a stale copy, so this reads stockStatus/salePrice/thumbs
      // straight from customPlants itself, using a field mask so nothing
      // else comes along for the ride. `images` (the full gallery) is
      // deliberately NOT masked in here — some older, not-yet-migrated
      // plants still carry base64 in `images`, and pulling that for every
      // plant on every catalog load would bloat this request for the whole
      // grid. The grid only ever needs `thumbs`; the full gallery is fetched
      // lazily, one plant at a time, when a customer opens its Detail view
      // (see openScPlantLightbox's detailLoaded fetch below).
      fbList("customPlants",["stockStatus","salePrice","thumbs"])
    ]);
    // Compatibility during rollout: before an admin has opened the back office
    // once to create the lightweight index, fall back to the old full collection.
    const authoritativeById=new Map(remoteAuthoritativeFields.map(p=>[p.id,p]));
    // An authoritative empty array must win over a stale non-empty one (the
    // admin may have deleted every photo) — only a field that's genuinely
    // absent (very old, pre-thumbnail-era docs) falls back to the index's copy.
    const overlayField=(authoritative,fallback,key)=>authoritative[key]!==undefined?authoritative[key]:fallback[key];
    const remoteCustomPlants=(remotePlantShowcaseIndex.length
      ? remotePlantShowcaseIndex
      : await fbList("customPlants")
    ).map(p=>{
      const authoritative=authoritativeById.get(p.id);
      if(!authoritative) return p;
      return {
        ...p,
        stockStatus:authoritative.stockStatus,
        salePrice:authoritative.salePrice,
        thumbs:overlayField(authoritative,p,"thumbs")
      };
    });
    // Poll only lightweight metadata and thumbnails. Full galleries are
    // fetched one physical tree at a time when a customer opens its detail.
    const signature=JSON.stringify([remoteStyleOverrides,remotePlantOverrides,remoteCustomPlants,remotePortfolio,remoteSupplies]);
    rememberCatalogRevision(remoteCatalogMeta);
    if(signature===lastFetchSignature) return;
    lastFetchSignature=signature;
    styleOverrides={};
    remoteStyleOverrides.forEach(s=>{const {id,...rest}=s;styleOverrides[id]=rest;});
    plantOverrides={};
    remotePlantOverrides.forEach(p=>{const {id,...rest}=p;plantOverrides[id]=rest;});
    customPlants=remoteCustomPlants;
    portfolioItems=remotePortfolio;
    supplyItems=mergeSupplyItems(remoteSupplies);
    // A full local-cache quota on the visitor's own device (unrelated to
    // this site) must never stop the page from rendering the data it just
    // fetched — caching locally is a nice-to-have for instant reloads, not
    // a requirement. LS.set() never throws (see local-store.js), so this
    // can't skip the render calls below it the way a raw localStorage write
    // once could.
    LS.set(STORAGE.gardenPortfolio,portfolioItems);
    LS.set(STORAGE.plantShowcaseIndex,customPlants);
    LS.set(STORAGE.gardenSupplies,supplyItems);
    renderScStyles();
    renderScPortfolio();
    rebuildAllPlants();
    fillScPlantCategoryFilter();
    renderScPlantGallery();
    fillScSupplyCategories();
    renderScSupplies();
    hideStaleDataNotice();
  }catch(error){
    console.error("Showcase Firestore sync failed, staying on local data:",error);
    showStaleDataNoticeIfConnectionLost();
  }
}

// ---- Revision-based refresh (avoids re-downloading the whole catalog) ----
// The admin app bumps catalogMeta/public's `revision` field on every save,
// delete, or restore (see app.js's bumpCatalogRevision()). The showcase only
// needs to compare that one small number against the last one it saw; a
// match means nothing changed and the expensive 6-collection fetch above
// can be skipped entirely.
const CATALOG_REVISION_KEY="garden_catalog_revision_v1";
let lastKnownCatalogRevision=null;
try{ lastKnownCatalogRevision=localStorage.getItem(CATALOG_REVISION_KEY)||null; }catch{}
function rememberCatalogRevision(catalogMetaDoc){
  const revision=catalogMetaDoc && catalogMetaDoc.revision!=null ? String(catalogMetaDoc.revision) : null;
  if(revision===null) return;
  lastKnownCatalogRevision=revision;
  try{ localStorage.setItem(CATALOG_REVISION_KEY,revision); }catch{}
}
let catalogSyncInFlight=false;
// Cheap check (1 document read) run on a timer and on tab refocus. Only
// triggers the full initFromFirestore() fetch when the admin side's
// revision actually moved, or when this tab has no data to show yet.
async function checkForCatalogUpdates(){
  if(catalogSyncInFlight) return;
  if(document.querySelector("dialog[open]")) return; // don't yank content from under someone mid-view
  catalogSyncInFlight=true;
  try{
    const hasContent=customPlants.length>0||portfolioItems.length>0;
    let meta=null;
    try{
      meta=await fbGet("catalogMeta","public");
    }catch(error){
      console.error("Catalog revision check failed, staying on current data:",error);
      showStaleDataNoticeIfConnectionLost();
      return;
    }
    const revision=meta && meta.revision!=null ? String(meta.revision) : null;
    if(hasContent && revision!==null && revision===lastKnownCatalogRevision) return;
    await initFromFirestore();
  }finally{
    catalogSyncInFlight=false;
  }
}
// "ข้อมูลอาจยังไม่ใช่ข้อมูลล่าสุด" must only ever appear when Firestore is
// genuinely unreachable (offline, quota exhausted, etc.) — never merely
// because the revision hasn't changed, which is the normal, expected case.
function showStaleDataNoticeIfConnectionLost(){
  const el=document.getElementById("scStaleDataNotice");
  if(el) el.style.display="block";
}
function hideStaleDataNotice(){
  const el=document.getElementById("scStaleDataNotice");
  if(el) el.style.display="none";
}

// Entry point for per-plant share links: the Cloudflare Worker's
// /plant/<id> preview page (see cloudflare-worker/worker.js) redirects real
// visitors here with #plant=<id> in the URL, after Facebook/LINE/etc.'s
// crawler has already read that page's per-plant Open Graph tags. Once the
// catalog has loaded, jump straight to that plant's detail view.
async function openSharedPlantFromHash(){
  const match=/^#plant=(.+)$/.exec(location.hash);
  if(!match) return;
  const id=decodeURIComponent(match[1]);
  if(!plantById.has(id)){
    // Cold-start edge case: a brand-new browser (e.g. LINE's in-app
    // browser, no local cache yet) may reach this before the full catalog
    // has loaded, or the initial Firestore sync above may have failed
    // outright — either way, fetch this one specimen directly rather than
    // silently stranding the visitor on the home page.
    try{
      const doc=await fbGet("plantShowcaseIndex",id) || await fbGet("customPlants",id);
      if(!doc) return;
      customPlants=[...customPlants,doc];
      rebuildAllPlants();
    }catch(error){
      console.error("Could not load shared plant link:",error);
      return;
    }
  }
  const p=plantById.get(id);
  if(!p) return;
  showPage("showcasePlants");
  // Same routing a customer browsing the gallery gets: a real-inventory
  // plant with stock opens the "สินค้าจริงในร้าน" group dialog (its tile
  // card's own onclick uses this, not the single-plant lightbox); anything
  // else opens the lightbox directly. renderScPlantGallery() rebuilds
  // scPlantGroupsByKey first in case this plant was only just fetched above
  // and never made it into the gallery's own render pass.
  if(p.custom&&isAvailablePlant(p)){
    renderScPlantGallery();
    openScPlantGroup(plantGroupKey(p));
  }else{
    openScPlantLightbox(id);
  }
}
ensureSupplyCatalog()
  .catch(error=>console.error(error))
  .then(hydrateFromLocalCache)
  .catch(error=>console.error("Local cache hydrate failed:",error))
  .then(initFromFirestore)
  .catch(error=>console.error("Initial Firestore sync failed:",error))
  .then(openSharedPlantFromHash)
  .catch(error=>console.error("Could not open shared plant link:",error));

// REST-only Firestore has no realtime listener (that needs the SDK), so we
// poll instead — but only the tiny catalogMeta/public document, not the
// whole catalog. A full refetch only happens when that document's revision
// actually changed (see checkForCatalogUpdates above). Also re-checked on
// visibilitychange so returning to a backgrounded tab picks up new data
// immediately instead of waiting out the rest of the interval.
const CATALOG_CHECK_MS=600000; // 10 minutes
setInterval(checkForCatalogUpdates,CATALOG_CHECK_MS);
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible") checkForCatalogUpdates();
});
