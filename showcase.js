const STORAGE = {
  plantOverrides: "garden_plant_overrides_v1",
  styleOverrides: "garden_style_overrides_v1"
};

function load(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function esc(s=""){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function money(v){ return new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(Number(v)||0); }

// Seeded from localStorage first (instant, works offline / same-browser as
// admin), then overwritten by initFromFirestore() once the cloud data
// arrives so the showcase reflects the back office from any device.
let styleOverrides = load(STORAGE.styleOverrides, {});
let plantOverrides = load(STORAGE.plantOverrides, {});

function mergedStyles(){
  return gardenStyles.map(s=>styleOverrides[s.id] ? {...s, ...styleOverrides[s.id]} : s);
}
// Supports styles saved before multi-photo galleries existed (single s.image string).
function styleImages(s){
  if(s.images && s.images.length) return s.images;
  if(s.image) return [s.image];
  return [];
}

function showPage(name){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(`${name}Page`).classList.add("active");
  window.scrollTo(0,0);
}
document.querySelectorAll(".close-dialog").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));

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
  allPlants=rawPlants.map(p=>plantOverrides[p.id] ? {...p, ...plantOverrides[p.id]} : p);
  plantById=new Map(allPlants.map(p=>[p.id,p]));
}
async function loadAllPlants(){
  try{
    const response=await fetch("./data/plants.json",{cache:"no-store"});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!Array.isArray(data)) throw new Error("รูปแบบฐานข้อมูลไม่ถูกต้อง");
    rawPlants=data;
    rebuildAllPlants();
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
function renderScStyleGallery(images,icon){
  const hero=document.getElementById("scStyleDetailHero");
  const thumbs=document.getElementById("scStyleDetailThumbs");
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
    return `<div class="linked-plant-tile" onclick="openScPlantLightbox('${p.id}')">
      <div class="linked-plant-thumb">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.thaiName)}" loading="lazy"/>`:"🌱"}</div>
      <div class="linked-plant-name">${esc(p.thaiName)}</div>
    </div>`;
  }).join("");
}
function openScStyleDetail(id){
  const s=mergedStyles().find(x=>x.id===id);
  if(!s) return;
  document.getElementById("scStyleDetailCategory").textContent=s.category;
  document.getElementById("scStyleDetailName").textContent=s.name;
  renderScStyleGallery(styleImages(s),s.icon);
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

// ---- Plant gallery (photos attached in the back office only) ----
const PLANT_PAGE_SIZE=24;
let scPlantVisibleCount=PLANT_PAGE_SIZE;

function resetScPlantPaging(){
  scPlantVisibleCount=PLANT_PAGE_SIZE;
  renderScPlantGallery();
}
function renderScPlantGallery(){
  const q=(document.getElementById("scPlantSearch").value||"").toLowerCase();
  const rows=allPlants.filter(p=>!!p.image&&[p.thaiName,p.englishName,p.scientificName].join(" ").toLowerCase().includes(q));
  const visibleRows=rows.slice(0,scPlantVisibleCount);
  document.getElementById("scPlantCount").textContent=rows.length
    ? `แสดง ${visibleRows.length} จาก ${rows.length} รายการ`
    : "ยังไม่มีรูปต้นไม้ในผลงาน";
  document.getElementById("scPlantList").innerHTML=visibleRows.length?visibleRows.map(p=>`
    <article class="showcase-plant-tile" onclick="openScPlantLightbox('${p.id}')">
      <div class="showcase-plant-photo"><img src="${esc(p.image)}" alt="${esc(p.thaiName)}" loading="lazy" /></div>
      <div class="showcase-plant-info">
        <div class="showcase-plant-caption">${esc(p.thaiName)}</div>
        ${p.salePrice?`<div class="showcase-plant-price-tag">🏷️ ${money(p.salePrice)}${p.unit?` / ${esc(p.unit)}`:""}</div>`:""}
      </div>
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
function openScPlantLightbox(id){
  const p=plantById.get(id);
  if(!p||!p.image) return;
  document.getElementById("scPlantLightboxName").textContent=p.thaiName+(p.englishName?` · ${p.englishName}`:"");
  document.getElementById("scPlantLightboxImage").src=p.image;
  const priceTag=document.getElementById("scPlantLightboxPriceTag");
  if(p.salePrice){
    priceTag.textContent=`🏷️ ${money(p.salePrice)}${p.unit?` / ${p.unit}`:""}`;
    priceTag.style.display="inline-flex";
  } else {
    priceTag.style.display="none";
  }
  document.getElementById("scPlantLightbox").showModal();
}
document.getElementById("scPlantSearch").addEventListener("input",resetScPlantPaging);
document.getElementById("scLoadMorePlantsBtn").addEventListener("click",()=>{
  scPlantVisibleCount+=PLANT_PAGE_SIZE;
  renderScPlantGallery();
});

renderScStyles();
loadAllPlants();

// Pull the latest overrides from Firestore so this page reflects the back
// office from any device, not just the browser that saved them. Falls back
// to whatever localStorage already had (or nothing) if the cloud is
// unreachable — the showcase must still render either way.
async function initFromFirestore(){
  try{
    const [remoteStyleOverrides,remotePlantOverrides]=await Promise.all([
      fbList("styleOverrides"),
      fbList("plantOverrides")
    ]);
    styleOverrides={};
    remoteStyleOverrides.forEach(s=>{const {id,...rest}=s;styleOverrides[id]=rest;});
    plantOverrides={};
    remotePlantOverrides.forEach(p=>{const {id,...rest}=p;plantOverrides[id]=rest;});
    renderScStyles();
    rebuildAllPlants();
    renderScPlantGallery();
  }catch(error){
    console.error("Showcase Firestore sync failed, staying on local data:",error);
  }
}
initFromFirestore();

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
