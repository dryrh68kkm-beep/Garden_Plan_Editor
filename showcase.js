const STORAGE = {
  plantOverrides: "garden_plant_overrides_v1",
  styleOverrides: "garden_style_overrides_v1",
  siteSettings: "garden_site_settings_v1"
};

function load(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function esc(s=""){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }

// Seeded from localStorage first (instant, works offline / same-browser as
// admin), then overwritten by initFromFirestore() once the cloud data
// arrives so the showcase reflects the back office from any device.
let styleOverrides = load(STORAGE.styleOverrides, {});
let plantOverrides = load(STORAGE.plantOverrides, {});
let siteSettings = load(STORAGE.siteSettings, {});

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

// Home hero uses a single photo set by the back office (Garden_Plan_Editor
// > "ตั้งค่ารูปหน้าแรกโชว์เคส") as one seamless full-bleed backdrop — no
// splitting or blending of separate photos. Falls back to a warm gradient
// (not flat green) until an admin uploads one.
function applyHeroBackground(){
  if(siteSettings.heroImage){
    document.getElementById("scHeroBg").style.backgroundImage=`url('${siteSettings.heroImage}')`;
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
    const cover=styleImages(s)[0];
    return `
    <article class="style-card">
      <div class="style-cover"${cover?` style="background-image:url('${esc(cover)}')"`:""}>${cover?"":s.icon}</div>
      <div class="style-body">
        <div class="category-label">${esc(s.category)}</div>
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.desc)}</p>
        <div class="chips">
          <span class="chip">ดูแล ${esc(s.maintenance)}</span>
          <span class="chip">${esc(s.budget)}</span>
        </div>
        <div class="style-actions">
          <button class="btn btn-primary" onclick="openScStyleDetail('${s.id}')">ดูรายละเอียด</button>
        </div>
      </div>
    </article>`;
  }).join(""):'<div class="empty">ไม่พบแบบสวนที่ค้นหา</div>';
}
function renderScStyleGallery(images,icon){
  const hero=document.getElementById("scStyleDetailHero");
  const thumbs=document.getElementById("scStyleDetailThumbs");
  const setActive=idx=>{
    if(images.length){ hero.style.backgroundImage=`url('${images[idx]}')`; hero.textContent=""; }
    else{ hero.style.backgroundImage=""; hero.textContent=icon; }
    thumbs.querySelectorAll("img").forEach((el,i)=>el.classList.toggle("active",i===idx));
  };
  thumbs.innerHTML=images.length>1?images.map((src,i)=>`<img src="${esc(src)}" data-idx="${i}" alt="" />`).join(""):"";
  thumbs.querySelectorAll("img").forEach(el=>el.addEventListener("click",()=>setActive(Number(el.dataset.idx))));
  setActive(0);
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
      <img src="${esc(p.image)}" alt="${esc(p.thaiName)}" loading="lazy" />
      <div class="showcase-plant-caption">${esc(p.thaiName)}</div>
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
  document.getElementById("scPlantLightbox").showModal();
}
document.getElementById("scPlantSearch").addEventListener("input",resetScPlantPaging);
document.getElementById("scLoadMorePlantsBtn").addEventListener("click",()=>{
  scPlantVisibleCount+=PLANT_PAGE_SIZE;
  renderScPlantGallery();
});

renderScStyles();
loadAllPlants();
applyHeroBackground();

// Pull the latest overrides/hero photo from Firestore so this page reflects
// the back office from any device, not just the browser that saved them.
// Falls back to whatever localStorage already had (or nothing) if the
// cloud is unreachable — the showcase must still render either way.
async function initFromFirestore(){
  try{
    const [remoteStyleOverrides,remotePlantOverrides,remoteHero]=await Promise.all([
      fbList("styleOverrides"),
      fbList("plantOverrides"),
      fbGet("siteSettings","hero")
    ]);
    styleOverrides={};
    remoteStyleOverrides.forEach(s=>{const {id,...rest}=s;styleOverrides[id]=rest;});
    plantOverrides={};
    remotePlantOverrides.forEach(p=>{const {id,...rest}=p;plantOverrides[id]=rest;});
    if(remoteHero){const {id,...rest}=remoteHero;siteSettings=rest;}
    renderScStyles();
    rebuildAllPlants();
    renderScPlantGallery();
    applyHeroBackground();
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
