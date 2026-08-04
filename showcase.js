const STORAGE = {
  plantOverrides: "garden_plant_overrides_v1",
  styleOverrides: "garden_style_overrides_v1",
  customPlants: "garden_custom_plants_v1",
  gardenPortfolio: "garden_portfolio_v1"
};

function esc(s=""){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function money(v){ return new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(Number(v)||0); }
// Opens a LINE chat with the shop's Official Account, pre-filled with a
// message about the specific plant — LINE's oaMessage deep link supports
// prefilling text this way (no LINE Login/Messaging API needed).
const LINE_OA_ID="@225yhyoy";
function lineOrderUrl(p){
  const priceText=p.salePrice?` ราคา ${money(p.salePrice)}${p.unit?`/${p.unit}`:""}`:"";
  const text=`สนใจสั่งซื้อ: ${p.thaiName}${priceText}`;
  return `https://line.me/R/oaMessage/${LINE_OA_ID}/?${encodeURIComponent(text)}`;
}
// Maps both the new ง่าย/ปานกลาง/ยาก scale and the older ต่ำ/กลาง/สูง values
// (still used by the static 300-item catalog) to the same colored-dot label.
const MAINTENANCE_LABELS={"ต่ำ":"🟢 ง่าย","กลาง":"🟡 ปานกลาง","สูง":"🔴 ยาก","ง่าย":"🟢 ง่าย","ปานกลาง":"🟡 ปานกลาง","ยาก":"🔴 ยาก"};
function maintenanceLabel(m){ return MAINTENANCE_LABELS[m]||m||"-"; }

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
function buildStyleAiPrompt(s){
  return [
    `ออกแบบภาพสวนสไตล์ "${s.nameTh||s.nameEn||""}" หมวด ${s.category||""}`,
    s.description||"",
    Array.isArray(s.recommendedPlants)&&s.recommendedPlants.length?`ใช้พรรณไม้: ${s.recommendedPlants.join(", ")}`:"",
    Array.isArray(s.materials)&&s.materials.length?`วัสดุ: ${s.materials.join(", ")}`:"",
    Array.isArray(s.palette)&&s.palette.length?`โทนสี: ${s.palette.join(", ")}`:""
  ].filter(Boolean).join(" ");
}
function adaptStyle(s){
  return {
    id:s.id,
    name:s.nameTh||s.nameEn||s.id,
    category:s.category||"",
    desc:s.description||"",
    budget:s.budgetPerSqm?`${s.budgetPerSqm} บาท/ตร.ม.`:"",
    maintenance:s.maintenance||"",
    difficulty:MAINTENANCE_TO_DIFFICULTY[s.maintenance]||s.maintenance||"-",
    suitableFor:Array.isArray(s.suitableFor)?s.suitableFor:[],
    plants:Array.isArray(s.recommendedPlants)?s.recommendedPlants:[],
    materials:Array.isArray(s.materials)?s.materials:[],
    mood:Array.isArray(s.palette)?s.palette.join(", "):(s.palette||""),
    aiPrompt:s.aiPrompt||buildStyleAiPrompt(s),
    icon:"🌿",
    plantIds:Array.isArray(s.plantPalette)?s.plantPalette.map(p=>p.plantId).filter(Boolean):[],
    image:s.image||""
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
    bestSeller:false
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
async function hydrateFromLocalCache(){
  await LS.migrateFromLocalStorage([STORAGE.styleOverrides, STORAGE.plantOverrides, STORAGE.customPlants, STORAGE.gardenPortfolio]);
  const [sO,pO,cP,pI]=await Promise.all([
    LS.get(STORAGE.styleOverrides,{}),
    LS.get(STORAGE.plantOverrides,{}),
    LS.get(STORAGE.customPlants,[]),
    LS.get(STORAGE.gardenPortfolio,[])
  ]);
  styleOverrides=sO;
  plantOverrides=pO;
  customPlants=cP;
  portfolioItems=pI;
  renderScStyles();
  renderScPortfolio();
  rebuildAllPlants();
  fillScPlantCategoryFilter();
  renderScPlantGallery();
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

// Every page change slides the outgoing page out to the right and brings
// the incoming page in from the left — the same direction as the
// swipe-right-to-go-back gesture, so navigating (by tap or swipe) feels
// like one consistent "back" motion instead of an instant cut.
const SC_PAGE_TRANSITION_MS=340;
function showPage(name){
  const next=document.getElementById(`${name}Page`);
  const current=document.querySelector(".page.active");
  if(!current||current===next){
    document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
    next.classList.add("active");
    next.scrollTop=0;
    window.scrollTo({top:0,left:0,behavior:"instant"});
    return;
  }
  // Reset scroll position on both the outgoing element (so it doesn't
  // still show mid-scroll once it becomes a fixed overlay) and the
  // incoming one, using "instant" — html{scroll-behavior:smooth} would
  // otherwise animate this scroll at the same time as the slide
  // transform, fighting it and making the whole thing look janky.
  current.scrollTop=0;
  next.scrollTop=0;
  window.scrollTo({top:0,left:0,behavior:"instant"});
  // Both pages carry .active during the transition so each still resolves
  // its own display value normally (e.g. the mobile home page's grid
  // layout override) — the transition classes only add position/transform.
  current.classList.add("sc-page-exit");
  next.classList.add("active","sc-page-enter");
  void next.offsetWidth;
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      current.classList.add("sc-page-exit-active");
      next.classList.add("sc-page-enter-active");
    });
  });
  setTimeout(()=>{
    current.classList.remove("active","sc-page-exit","sc-page-exit-active");
    next.classList.remove("sc-page-enter","sc-page-enter-active");
  },SC_PAGE_TRANSITION_MS);
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
  },SC_PAGE_TRANSITION_MS);
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
document.getElementById("scBellBtn").addEventListener("click",()=>alert("ยังไม่มีการแจ้งเตือนใหม่"));

// ---- Plant data (all 300, merged with back-office overrides) ----
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
    rawPlants=data.map(adaptPlant);
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
function scLinkedPlantsHtml(plantIds){
  if(!plantIds||!plantIds.length) return '<div class="meta">ยังไม่ได้ระบุต้นไม้สำหรับสวนนี้</div>';
  return plantIds.map(id=>{
    const p=plantById.get(id);
    if(!p) return "";
    const cover=plantImages(p)[0];
    return `<div class="linked-plant-tile" onclick="openScPlantLightbox('${p.id}')">
      <div class="linked-plant-thumb">${cover?`<img src="${esc(cover)}" alt="${esc(p.thaiName)}" loading="lazy"/>`:"🌱"}</div>
      <div class="linked-plant-name">${esc(p.thaiName)}</div>
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
  document.getElementById("scStyleDetailMaintenance").textContent=s.maintenance;
  document.getElementById("scStyleDetailDifficulty").textContent=s.difficulty;
  document.getElementById("scStyleDetailSuitable").textContent=(s.suitableFor||[]).join(", ");
  document.getElementById("scStyleDetailLinkedPlants").innerHTML=scLinkedPlantsHtml(s.plantIds);
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
function renderScPlantGallery(){
  const q=(document.getElementById("scPlantSearch").value||"").toLowerCase();
  const category=document.getElementById("scPlantCategoryFilter").value||"";
  const bestSellerOnly=document.getElementById("scPlantBestSellerFilter").checked;
  const rows=allPlants.filter(p=>!!plantImages(p).length
    &&[p.thaiName,p.englishName,p.scientificName].join(" ").toLowerCase().includes(q)
    &&(!category||p.category===category)
    &&(!bestSellerOnly||p.bestSeller))
    .sort((a,b)=>(b.bestSeller?1:0)-(a.bestSeller?1:0));
  const visibleRows=rows.slice(0,scPlantVisibleCount);
  document.getElementById("scPlantCount").textContent=rows.length
    ? `แสดง ${visibleRows.length} จาก ${rows.length} รายการ`
    : "ยังไม่มีรูปต้นไม้ในผลงาน";
  document.getElementById("scPlantList").innerHTML=visibleRows.length?visibleRows.map(p=>`
    <article class="showcase-plant-tile" onclick="openScPlantLightbox('${p.id}')">
      <div class="showcase-plant-photo"><img src="${esc(plantImages(p)[0])}" alt="${esc(p.thaiName)}" loading="lazy" />${p.bestSeller?'<span class="best-seller-badge">🔥 ขายดี</span>':""}</div>
      <div class="showcase-plant-info">
        <div class="showcase-plant-caption">${esc(p.thaiName)}${p.sizeLabel?` <span class="plant-size-tag">ขนาด${esc(p.sizeLabel)}</span>`:""}</div>
        ${p.salePrice?`<div class="showcase-plant-price-tag">🏷️ ${money(p.salePrice)}${p.unit?` / ${esc(p.unit)}`:""}</div>`:""}
      </div>
      <a class="showcase-order-btn" href="${esc(lineOrderUrl(p))}" target="_blank" rel="noopener" onclick="event.stopPropagation()">💬 สั่งซื้อผ่าน LINE</a>
    </article>`).join(""):'<div class="empty">ยังไม่มีรูปต้นไม้ในผลงาน</div>';
  const loadMoreBtn=document.getElementById("scLoadMorePlantsBtn");
  const remaining=rows.length-visibleRows.length;
  if(remaining>0){
    loadMoreBtn.textContent=`โหลดเพิ่ม (เหลืออีก ${remaining} รายการ)`;
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
function openScPlantLightbox(id){
  const p=plantById.get(id);
  const images=p?plantImages(p):[];
  if(!p||!images.length) return;
  document.getElementById("scPlantLightboxName").textContent=[p.thaiName,p.sizeLabel?`ขนาด${p.sizeLabel}`:"",p.englishName].filter(Boolean).join(" · ");
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
  },SC_PAGE_TRANSITION_MS);
}
document.getElementById("scPlantSearch").addEventListener("input",resetScPlantPaging);
document.getElementById("scPlantCategoryFilter").addEventListener("change",resetScPlantPaging);
document.getElementById("scPlantBestSellerFilter").addEventListener("change",resetScPlantPaging);
document.getElementById("scLoadMorePlantsBtn").addEventListener("click",()=>{
  scPlantVisibleCount+=PLANT_PAGE_SIZE;
  renderScPlantGallery();
});

renderScStyles();
renderScPortfolio();
loadAllPlants();
loadCareBeliefs();

// Pull the latest overrides from Firestore so this page reflects the back
// office from any device, not just the browser that saved them. Falls back
// to whatever the local cache already had (or nothing) if the cloud is
// unreachable — the showcase must still render either way.
async function initFromFirestore(){
  try{
    const [remoteStyleOverrides,remotePlantOverrides,remoteCustomPlants,remotePortfolio]=await Promise.all([
      fbList("styleOverrides"),
      fbList("plantOverrides"),
      fbList("customPlants"),
      fbList("gardenPortfolio")
    ]);
    styleOverrides={};
    remoteStyleOverrides.forEach(s=>{const {id,...rest}=s;styleOverrides[id]=rest;});
    plantOverrides={};
    remotePlantOverrides.forEach(p=>{const {id,...rest}=p;plantOverrides[id]=rest;});
    customPlants=remoteCustomPlants;
    portfolioItems=remotePortfolio;
    // A full local-cache quota on the visitor's own device (unrelated to
    // this site) must never stop the page from rendering the data it just
    // fetched — caching locally is a nice-to-have for instant reloads, not
    // a requirement. LS.set() never throws (see local-store.js), so this
    // can't skip the render calls below it the way a raw localStorage write
    // once could.
    LS.set(STORAGE.gardenPortfolio,portfolioItems);
    renderScStyles();
    renderScPortfolio();
    rebuildAllPlants();
    fillScPlantCategoryFilter();
    renderScPlantGallery();
  }catch(error){
    console.error("Showcase Firestore sync failed, staying on local data:",error);
  }
}
hydrateFromLocalCache().then(initFromFirestore);

// REST-only Firestore has no realtime listener (that needs the SDK), so we
// poll instead: refetch periodically so a photo/style added on another
// device (e.g. the back office) shows up here without a manual reload.
// Skipped while a detail dialog/lightbox is open so a background refresh
// doesn't yank content out from under someone mid-view.
const FIRESTORE_POLL_MS=20000;
setInterval(()=>{
  if(document.querySelector("dialog[open]")) return;
  initFromFirestore();
},FIRESTORE_POLL_MS);
