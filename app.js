const STORAGE = {
  plantOverrides: "garden_plant_overrides_v1",
  styleOverrides: "garden_style_overrides_v1",
  customPlants: "garden_custom_plants_v1",
  plantShowcaseIndex: "garden_plant_showcase_index_v1",
  gardenPortfolio: "garden_portfolio_v1",
  gardenSupplies: "garden_supplies_v1"
};

// data/garden-styles-data.js sets window.GARDEN_STYLES with a different
// field schema than this app was built against (nameTh/description/
// budgetPerSqm/recommendedPlants/plantPalette/... instead of name/desc/
// budget/plants/plantIds/...) and no longer declares a bare `gardenStyles`
// global at all — that data file is regenerated and re-uploaded wholesale
// from time to time (see README-UPDATE.md), so this adapter belongs here,
// not patched into the generated file itself where it would just get
// overwritten again. Everything below keeps using the plain `gardenStyles`
// shape it always has; only this translation step is new.
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
    aiPrompt:s.aiPrompt||buildStyleAiPrompt(s),
    icon:"🌿",
    plantPlan:Array.isArray(s.plantPalette)?s.plantPalette:[],
    plantIds:Array.isArray(s.plantPalette)?s.plantPalette.map(p=>p.plantId).filter(Boolean):[],
    image:(window.GARDEN_STYLE_IMAGES&&window.GARDEN_STYLE_IMAGES[s.id])||s.image||""
  };
}
if(!Array.isArray(window.GARDEN_STYLES)) console.error("window.GARDEN_STYLES missing or invalid — check data/garden-styles-data.js");
const gardenStyles = Array.isArray(window.GARDEN_STYLES) ? window.GARDEN_STYLES.map(adaptStyle) : [];

// Same idea for data/plants.json: nameTh/categoryId/price/careLevel/... with
// English light/water/careLevel codes instead of the Thai strings and
// costPrice/salePrice split this app expects. categoriesById resolves
// categoryId ("CAT01") to its Thai name, fetched alongside plants.json.
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

// Local cache writes go through LS (IndexedDB, see local-store.js) instead
// of localStorage directly — its quota is tied to actual free disk space
// rather than localStorage's small (often ~5MB on mobile Safari) per-origin
// cap, which this app could fill just from accumulated base64 photos.
// safeSetLocal() also used to matter for a now-fixed bug: save* functions
// wrote the local cache BEFORE awaiting the actual Firestore save, so a
// quota error there threw synchronously and the cloud save was never even
// attempted — no alert, nothing queued for retry, dialog already closed
// looking successful, photo "vanished" later once a sync refetched the
// cloud copy that, correctly, never had it. Kept as its own helper (rather
// than calling LS.set directly) so that failure mode stays impossible
// regardless of which storage backend is underneath.
let localCacheWriteFailWarned = false;
async function safeSetLocal(key, valueObj){
  const ok = await LS.set(key, valueObj);
  if(!ok && !localCacheWriteFailWarned){
    localCacheWriteFailWarned = true;
    alert("⚠️ ไม่สามารถบันทึกสำเนาสำรองข้อมูลในเครื่องนี้ได้\n\nข้อมูลจะยังพยายามบันทึกขึ้นคลาวด์ตามปกติ กรุณาตรวจสอบพื้นที่ว่างในอุปกรณ์นี้");
  }
  return ok;
}

let plants = [];
let selectedPlantId = "";

let plantOverrides = {};
let styleOverrides = {};

// The curated active catalog from data/plants.json (read-only) plus plants the
// admin adds themselves, stored fully in Firestore ("customPlants") since
// there's no server to write back into the static JSON file.
let basePlants = [];
let customPlants = [];
function rebuildPlantsList(){
  plants = [...basePlants, ...customPlants];
  fillPlantFilters();
}

async function savePlantOverrides(id){
  safeSetLocal(STORAGE.plantOverrides, plantOverrides);
  if(id) await saveDoc("plantOverrides",id,plantOverrides[id],"ข้อมูลต้นไม้");
}
function plantShowcaseIndexRecord(plant){
  const {id,images,thumbs,...meta}=plant;
  const thumb=(thumbs&&thumbs[0])||"";
  return {...meta,thumbs:thumb?[thumb]:[],images:thumb?[thumb]:[],detailLoaded:false};
}
async function thumbnailFromDataUrl(src){
  if(!src) return "";
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onerror=()=>reject(new Error("สร้างรูปย่อไม่สำเร็จ"));
    img.onload=()=>{
      const side=Math.min(img.width,img.height);
      resolve(renderSquareVariant(img,side,(img.width-side)/2,(img.height-side)/2,280,45*1024));
    };
    img.src=src;
  });
}
async function ensureCustomPlantThumbnail(plant){
  if(plant.thumbs&&plant.thumbs[0]) return plant;
  const source=plant.images&&plant.images[0];
  if(!source) return plant;
  const thumb=await thumbnailFromDataUrl(source);
  const updated={...plant,thumbs:thumb?[thumb]:[]};
  customPlants=customPlants.map(p=>p.id===plant.id?updated:p);
  await saveDoc("customPlants",updated.id,updated,"รูปย่อต้นไม้เดิม");
  return updated;
}
async function cachePlantShowcaseIndex(index){
  await safeSetLocal(STORAGE.plantShowcaseIndex,index);
}
async function syncPlantShowcaseIndexes(rows,remoteRows=[]){
  const remoteById=new Map(remoteRows.map(p=>[p.id,p]));
  for(const original of rows){
    try{
      const plant=await ensureCustomPlantThumbnail(original);
      const index=plantShowcaseIndexRecord(plant);
      const current=remoteById.get(plant.id);
      const cleanCurrent=current?Object.fromEntries(Object.entries(current).filter(([k])=>k!=="id")):null;
      if(!cleanCurrent||JSON.stringify(cleanCurrent)!==JSON.stringify(index)){
        await saveDoc("plantShowcaseIndex",plant.id,index,"ข้อมูลย่อหน้า Showcase");
      }
    }catch(error){
      console.error("Could not build plant showcase index:",original.id,error);
    }
  }
  safeSetLocal(STORAGE.customPlants,customPlants);
  cachePlantShowcaseIndex(customPlants.map(p=>({...plantShowcaseIndexRecord(p),id:p.id})));
  rebuildPlantsList();
  resetPlantPaging();
}
async function saveCustomPlant(plant){
  safeSetLocal(STORAGE.customPlants, customPlants);
  await saveDoc("customPlants",plant.id,plant,"ต้นไม้ที่เพิ่มเอง");
  const index=plantShowcaseIndexRecord(plant);
  await saveDoc("plantShowcaseIndex",plant.id,index,"ข้อมูลย่อหน้า Showcase");
  const cached=await LS.get(STORAGE.plantShowcaseIndex,[]);
  cachePlantShowcaseIndex(cached.some(p=>p.id===plant.id)?cached.map(p=>p.id===plant.id?{...index,id:plant.id}:p):[...cached,{...index,id:plant.id}]);
}
// The Rinlada LINE bot (repo Rinlada-AI-V3-) reads live prices for its own
// order flow from the SAME Firestore project this app already writes to
// (rinlada-plant-stock), but a separate `plants` collection the bot queries
// by exact `name` match (see worker/src/order.ts's findProductByName). The
// bot's static knowledge sync uses the Thai name as `name`, so we mirror
// that here rather than English/scientific name, or the bot's exact-match
// lookup would silently never find this plant.
//
// That collection is also written to directly by admins issuing stock
// commands to the bot itself (findProductByName's own docs, auto-generated
// ids like "p1785683997356") — so a plant that already exists there under
// a different doc id than ours must be UPDATED in place, never re-created
// under our own id, or the collection ends up with two docs sharing the
// same name and the bot's `limit:1` query returns whichever one it feels
// like, i.e. customers could get a stale/wrong price at random. Look the
// doc up by name first; only fall back to creating a new one (keyed by our
// own plant id, so re-saves update instead of piling up duplicates) when no
// existing doc for that name is found. The update path uses fbPatchFields
// (not fbSet) so it only touches the fields we actually send, leaving any
// stock/category/bestseller fields the bot itself manages untouched.
//
// sizeLabel/potSize are optional — the bot's own docs (page said to fall
// back to whatever value is already there when these are omitted), and not
// every plant has both: custom ("เพิ่มเอง") plants have no potSize at all
// (that's a catalog-only field), and a plant with no custom size entered
// falls back through plantSizeLabel() to the catalog's preset label.
async function syncPlantPriceToBot(id,thaiName,salePrice,sizeLabel,potSize){
  if(!thaiName) return;
  const fields={name:thaiName,price:Number(salePrice)||0};
  if(sizeLabel) fields.sizeLabel=sizeLabel;
  if(potSize) fields.potSize=potSize;
  try{
    const existingId=await fbFindByField("plants","name",thaiName);
    if(existingId) await fbPatchFields("plants",existingId,fields);
    else await saveDoc("plants",id,fields,"ราคาต้นไม้ (ซิงก์ไปบอท LINE)");
  }catch(err){
    console.error("Sync plant price to LINE bot failed:",err);
  }
}
// ---- Garden portfolio (real completed projects, shown to build trust
// alongside the 50 style templates — a separate collection since these are
// actual jobs done for actual customers, not reusable style presets). ----
let portfolioItems = [];
const DEFAULT_SUPPLIES=Array.isArray(window.GARDEN_SUPPLIES)?window.GARDEN_SUPPLIES:[];
let deletedSupplyItems=[];
function mergeSupplyItems(rows=[]){
  const byId=new Map(DEFAULT_SUPPLIES.map(p=>[p.id,{...p}]));
  rows.forEach(p=>byId.set(p.id,{...(byId.get(p.id)||{}),...p}));
  deletedSupplyItems=[...byId.values()].filter(p=>p.deleted);
  return [...byId.values()].filter(p=>!p.deleted);
}
let supplyItems = mergeSupplyItems();

function renderSupplies(){
  const q=(document.getElementById("supplySearch")?.value||"").trim().toLowerCase();
  const category=document.getElementById("supplyCategoryFilter")?.value||"";
  const rows=supplyItems.filter(p=>(!category||p.category===category)&&(!q||[p.name,p.code,p.category,p.description,p.suitableFor,p.usage].join(" ").toLowerCase().includes(q)));
  document.getElementById("supplyCount").textContent=`${rows.length} สินค้า`;
  document.getElementById("supplyList").innerHTML=rows.length?rows.map(p=>`<article class="plant-card supply-card"><div class="plant-thumb">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" />`:"🧰"}</div><p class="plant-code">${esc(p.code||p.category)}</p><h3>${esc(p.name)}</h3><p class="meta">${esc(p.category)} · คงเหลือ ${Number(p.stock)||0} ${esc(p.unit||"ชิ้น")}</p><div class="plant-price-row"><div><span>ราคาขาย</span><strong>${money(p.price)}</strong></div><span>${p.available!==false?"พร้อมขาย":"ซ่อนจากหน้าร้าน"}</span></div><button class="btn btn-primary" onclick="openSupplyEdit('${p.id}')">แก้ไขสินค้า</button></article>`).join(""):'<div class="empty">ยังไม่มีสินค้า กด "+ เพิ่มสินค้า" เพื่อเริ่มต้น</div>';
  const restoreBtn=document.getElementById("restoreSuppliesBtn");
  restoreBtn.style.display=deletedSupplyItems.length?"inline-flex":"none";
  restoreBtn.textContent=`กู้คืนสินค้าที่ลบ${deletedSupplyItems.length?` (${deletedSupplyItems.length})`:""}`;
}
function renderDeletedSupplies(){
  const list=document.getElementById("deletedSuppliesList");
  list.innerHTML=deletedSupplyItems.length?deletedSupplyItems.map(p=>{const fallback=DEFAULT_SUPPLIES.find(x=>x.id===p.id)||{};return `<div class="deleted-supply-item"><div><strong>${esc(p.name||fallback.name||p.id)}</strong><span>${esc(p.code||fallback.code||p.id)} · ${esc(p.category||fallback.category||"สินค้า")}</span></div><button type="button" class="btn btn-secondary" onclick="restoreSupply('${p.id}')">กู้คืน</button></div>`}).join(""):'<div class="empty">ไม่มีสินค้าที่ลบ</div>';
}
window.restoreSupply=async function(id){
  const deleted=deletedSupplyItems.find(x=>x.id===id)||{};
  const fallback=DEFAULT_SUPPLIES.find(x=>x.id===id)||{};
  const item={...fallback,...deleted,deleted:false,updatedAt:new Date().toISOString()};
  if(!item.name){alert("ไม่พบข้อมูลสินค้าสำหรับกู้คืน");return;}
  deletedSupplyItems=deletedSupplyItems.filter(x=>x.id!==id);
  supplyItems=[...supplyItems,item];
  safeSetLocal(STORAGE.gardenSupplies,[...supplyItems,...deletedSupplyItems]);
  renderSupplies();renderDeletedSupplies();
  await saveDoc("gardenSupplies",id,item,"การกู้คืนสินค้า");
};
let supplyEditImage="";
function renderSupplyImagePreview(){
  document.getElementById("supplyImagePreview").innerHTML=supplyEditImage?`<div class="supply-preview-frame"><img src="${esc(supplyEditImage)}" alt="รูปสินค้า" /><button type="button" class="small-btn danger supply-image-remove">ลบรูปสินค้า</button></div>`:"";
  document.querySelector(".supply-image-remove")?.addEventListener("click",()=>{supplyEditImage="";document.getElementById("supplyImage").value="";renderSupplyImagePreview();});
}
function openSupplyEdit(id=""){
  const p=supplyItems.find(x=>x.id===id)||{};
  document.getElementById("supplyEditId").value=p.id||"";
  document.getElementById("supplyEditTitle").textContent=p.id?`แก้ไข: ${p.name}`:"เพิ่มอุปกรณ์หรือปุ๋ย";
  ["Name","Code","Description","SuitableFor","Usage","Frequency","Caution","Price","Unit","Stock"].forEach(k=>document.getElementById(`supply${k}`).value=p[k.charAt(0).toLowerCase()+k.slice(1)]??"");
  document.getElementById("supplyCategory").value=p.category||"ปุ๋ย";
  document.getElementById("supplyAvailable").checked=p.available!==false;
  document.getElementById("supplyDeleteBtn").style.display=p.id?"inline-flex":"none";
  supplyEditImage=p.image||"";
  renderSupplyImagePreview();
  document.getElementById("supplyImage").value="";
  document.getElementById("supplyEditDialog").showModal();
}
document.getElementById("addSupplyBtn").addEventListener("click",()=>openSupplyEdit());
document.getElementById("restoreSuppliesBtn").addEventListener("click",()=>{renderDeletedSupplies();document.getElementById("restoreSuppliesDialog").showModal();});
document.getElementById("supplySearch").addEventListener("input",renderSupplies);
document.getElementById("supplyCategoryFilter").addEventListener("change",renderSupplies);
document.getElementById("supplyImage").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;supplyEditImage=await resizeImageToDataURL(file,900,260*1024);renderSupplyImagePreview();});
document.getElementById("supplyEditForm").addEventListener("submit",e=>{e.preventDefault();const existing=document.getElementById("supplyEditId").value;const item={id:existing||uid("supply"),name:document.getElementById("supplyName").value.trim(),code:document.getElementById("supplyCode").value.trim(),category:document.getElementById("supplyCategory").value,description:document.getElementById("supplyDescription").value.trim(),suitableFor:document.getElementById("supplySuitableFor").value.trim(),usage:document.getElementById("supplyUsage").value.trim(),frequency:document.getElementById("supplyFrequency").value.trim(),caution:document.getElementById("supplyCaution").value.trim(),price:Number(document.getElementById("supplyPrice").value)||0,unit:document.getElementById("supplyUnit").value.trim()||"ชิ้น",stock:Number(document.getElementById("supplyStock").value)||0,available:document.getElementById("supplyAvailable").checked,image:supplyEditImage,updatedAt:new Date().toISOString()};if(!checkDocSizeOrWarn(item,"สินค้า"))return;supplyItems=existing?supplyItems.map(x=>x.id===existing?item:x):[...supplyItems,item];safeSetLocal(STORAGE.gardenSupplies,supplyItems);renderSupplies();document.getElementById("supplyEditDialog").close();saveDoc("gardenSupplies",item.id,item,"อุปกรณ์และปุ๋ย");});
document.getElementById("supplyDeleteBtn").addEventListener("click",async()=>{const id=document.getElementById("supplyEditId").value;const item=supplyItems.find(x=>x.id===id);if(!id||!item||!confirm(`ย้าย “${item.name}” ไปสินค้าที่ลบแล้วหรือไม่?\nสามารถกู้คืนภายหลังได้`))return;const tombstone={...item,deleted:true,updatedAt:new Date().toISOString()};supplyItems=supplyItems.filter(x=>x.id!==id);deletedSupplyItems=[...deletedSupplyItems.filter(x=>x.id!==id),tombstone];safeSetLocal(STORAGE.gardenSupplies,[...supplyItems,...deletedSupplyItems]);renderSupplies();document.getElementById("supplyEditDialog").close();await saveDoc("gardenSupplies",id,tombstone,"การย้ายสินค้าไปถังขยะ");});
async function savePortfolioItem(item){
  safeSetLocal(STORAGE.gardenPortfolio, portfolioItems);
  await saveDoc("gardenPortfolio",item.id,item,"ผลงานจัดสวน");
}
async function deletePortfolioItem(id){
  if(!confirm("ลบผลงานจัดสวนรายการนี้หรือไม่?")) return;
  portfolioItems=portfolioItems.filter(x=>x.id!==id);
  failedSaves.delete(saveDocKey("gardenPortfolio",id));
  persistFailedSaves();
  renderPortfolio();
  safeSetLocal(STORAGE.gardenPortfolio, portfolioItems);
  document.getElementById("portfolioEditDialog").close();
  await cloudSave(()=>fbDelete("gardenPortfolio",id),"การลบผลงานจัดสวน");
}
async function deleteCustomPlant(id){
  if(!confirm("ลบต้นไม้ที่เพิ่มเองรายการนี้หรือไม่?")) return;
  customPlants=customPlants.filter(p=>p.id!==id);
  failedSaves.delete(saveDocKey("customPlants",id));
  persistFailedSaves();
  rebuildPlantsList();
  resetPlantPaging();
  safeSetLocal(STORAGE.customPlants, customPlants);
  LS.get(STORAGE.plantShowcaseIndex,[]).then(rows=>cachePlantShowcaseIndex(rows.filter(p=>p.id!==id)));
  document.getElementById("plantAddDialog").close();
  await Promise.all([
    cloudSave(()=>fbDelete("customPlants",id),"การลบต้นไม้ที่เพิ่มเอง"),
    cloudSave(()=>fbDelete("plantShowcaseIndex",id),"การลบข้อมูลย่อหน้า Showcase")
  ]);
}
function getPlant(id){
  const p=plants.find(x=>x.id===id);
  return p ? {...p, ...plantOverrides[id]} : null;
}
async function saveStyleOverrides(id){
  safeSetLocal(STORAGE.styleOverrides, styleOverrides);
  if(id) await saveDoc("styleOverrides",id,styleOverrides[id],"ข้อมูลแบบสวน");
}
function getStyle(id){
  const s=gardenStyles.find(x=>x.id===id);
  return s ? {...s, ...styleOverrides[id]} : null;
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
function mergedPlants(){
  return plants.map(p=>plantOverrides[p.id] ? {...p, ...plantOverrides[p.id]} : p);
}
// Supports plants saved before multi-photo galleries existed (single p.image string).
function plantImages(p){
  if(p.images && p.images.length) return p.images;
  if(p.image) return [p.image];
  return [];
}
// Card-grid cover: prefer the small companion thumbnail (see
// resizeImageWithThumb) so the list view doesn't have to download/decode
// the full-size photo for every card; falls back to the full image for
// plants saved before thumbnails existed.
function plantCoverThumb(p){
  return (p.thumbs&&p.thumbs[0])||plantImages(p)[0];
}

function uid(prefix){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }
function money(v){ return new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(Number(v)||0); }
function esc(s=""){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
// Maps both the new ง่าย/ปานกลาง/ยาก scale and the older ต่ำ/กลาง/สูง values
// (still used by the static 300-item catalog and any not-yet-resaved custom
// plants) to the same colored-dot label for consistent display everywhere.
const MAINTENANCE_LABELS={"ต่ำ":"🟢 ง่าย","กลาง":"🟡 ปานกลาง","สูง":"🔴 ยาก","ง่าย":"🟢 ง่าย","ปานกลาง":"🟡 ปานกลาง","ยาก":"🔴 ยาก"};
function maintenanceLabel(m){ return MAINTENANCE_LABELS[m]||m||"-"; }
function styleName(id){ return gardenStyles.find(s=>s.id===id)?.name || "-"; }
// Admins can now type an exact size (cm or m) per plant record instead of
// being stuck with the catalog's fixed preset labels (เล็ก/กลาง/ใหญ่/...) —
// falls back to that preset only until the admin has entered their own.
function plantSizeLabel(p){
  if(p.customSizeValue) return `${p.customSizeValue} ${p.customSizeUnit==="m"?"ม.":"ซม."}`;
  return p.sizeLabel||p.sizeCode||"";
}
// Firestore rejects any document over 1,048,576 bytes. A gallery of several
// photos (each ~250-330KB once base64-encoded) can quietly cross that line —
// catch it here, before the round-trip to the cloud, with a clear Thai
// message telling the admin to remove a photo, instead of a cryptic failure
// after "saving...".
const FIRESTORE_DOC_BYTE_LIMIT=1048576;
function checkDocSizeOrWarn(obj,label){
  const bytes=new Blob([JSON.stringify(obj)]).size;
  if(bytes<=FIRESTORE_DOC_BYTE_LIMIT-20000) return true;
  alert(`⚠️ รูปภาพของ${label||"รายการนี้"}มีขนาดรวมใหญ่เกินไป (${(bytes/1024/1024).toFixed(2)}MB จากสูงสุด 1MB)\n\nกรุณาลบรูปออกบางรูปแล้วลองบันทึกใหม่อีกครั้ง`);
  return false;
}

document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.page)));
function showPage(name){
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.page===name));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(`${name}Page`).classList.add("active");
}
document.querySelectorAll(".close-dialog").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));

document.getElementById("resetAllBtn").onclick=()=>{
  if(confirm("ต้องการล้างข้อมูลแบบสวน ต้นไม้ที่เพิ่มเอง และรูปภาพที่แนบทั้งหมดหรือไม่?")){
    plantOverrides={};styleOverrides={};customPlants=[];portfolioItems=[];supplyItems=[];failedSaves=new Map();
    [STORAGE.plantOverrides,STORAGE.styleOverrides,STORAGE.customPlants,STORAGE.plantShowcaseIndex,STORAGE.gardenPortfolio,STORAGE.gardenSupplies,FAILED_SAVES_KEY].forEach(k=>LS.remove(k));
    rebuildPlantsList();
    resetPlantPaging();
    renderAll();
  }
};

function renderStyles(){
  const q=(document.getElementById("styleSearch")?.value||"").toLowerCase();
  const category=document.getElementById("styleCategoryFilter")?.value||"";
  const rows=mergedStyles().filter(s=>{
    const hay=[s.name,s.category,s.desc,s.mood,...s.plants,...s.materials].join(" ").toLowerCase();
    return (!category||s.category===category)&&hay.includes(q);
  });
  document.getElementById("styleCount").textContent=`แสดง ${rows.length} จาก ${gardenStyles.length} แบบ`;
  document.getElementById("styleList").innerHTML=rows.length?rows.map(s=>{
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
          <button class="btn btn-primary" onclick="openStyleDetail('${s.id}')">ดูรายละเอียด</button>
          <button class="small-btn" onclick="openStyleEdit('${s.id}')">แก้ไข</button>
        </div>
      </div>
    </article>`;
  }).join(""):'<div class="empty">ไม่พบแบบสวนที่ค้นหา</div>';
  fillStyleQuickEdit();
}
// Lets the admin jump straight to editing a style by name instead of
// scrolling/searching the 50-card grid for its "แก้ไข" button. Always lists
// every style regardless of the current search/category filter above.
function fillStyleQuickEdit(){
  const select=document.getElementById("styleQuickEdit");
  const rows=mergedStyles().slice().sort((a,b)=>a.name.localeCompare(b.name,"th"));
  select.innerHTML='<option value="">✏️ แก้ไขด่วน: เลือกแบบสวนที่ต้องการแก้ไข...</option>'
    +rows.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.category)})</option>`).join("");
}
document.getElementById("styleQuickEdit").addEventListener("change",e=>{
  const id=e.target.value;
  if(id) openStyleEdit(id);
  e.target.value="";
});
let selectedStyleId="";
document.getElementById("styleSearch").addEventListener("input",renderStyles);
document.getElementById("styleCategoryFilter").addEventListener("change",renderStyles);

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
wireSearchClear("styleSearch");
wireSearchClear("plantSearch");

function renderStyleDetailGallery(images,icon,heroId,thumbsId){
  const hero=document.getElementById(heroId);
  const thumbs=document.getElementById(thumbsId);
  const setActive=idx=>{
    if(images.length){ hero.style.backgroundImage=`url('${images[idx]}')`; hero.textContent=""; }
    else{ hero.style.backgroundImage=""; hero.textContent=icon; }
    thumbs.querySelectorAll("img").forEach((el,i)=>el.classList.toggle("active",i===idx));
  };
  thumbs.innerHTML=images.length>1?images.map((src,i)=>`<img src="${esc(src)}" data-idx="${i}" alt="" />`).join(""):"";
  thumbs.querySelectorAll("img").forEach(el=>el.addEventListener("click",()=>setActive(Number(el.dataset.idx))));
  setActive(0);
}
function renderPortfolio(){
  document.getElementById("portfolioCount").textContent=portfolioItems.length?`${portfolioItems.length} ผลงาน`:"";
  document.getElementById("portfolioList").innerHTML=portfolioItems.length?portfolioItems.map(item=>{
    const cover=(item.images||[])[0];
    return `
    <article class="style-card portfolio-card">
      <div class="style-cover"${cover?` style="background-image:url('${esc(cover)}')"`:""}>${cover?"":"🏡"}</div>
      <div class="style-body">
        <h3>${esc(item.title||"ผลงานจัดสวน")}</h3>
        ${item.location?`<p class="meta">📍 ${esc(item.location)}</p>`:""}
        <div class="chips">
          ${item.budget?`<span class="chip">งบประมาณ ${esc(item.budget)}</span>`:""}
          ${item.duration?`<span class="chip">ใช้เวลา ${esc(item.duration)}</span>`:""}
        </div>
        <div class="style-actions">
          <button class="btn btn-primary" onclick="openPortfolioDetail('${item.id}')">ดูรายละเอียด</button>
          <button class="small-btn" onclick="openPortfolioEdit('${item.id}')">แก้ไข</button>
        </div>
      </div>
    </article>`;
  }).join(""):'<div class="empty">ยังไม่มีผลงานจัดสวน กด "+ เพิ่มผลงาน" เพื่อเริ่มเพิ่มรูปผลงานจริง</div>';
  fillPortfolioQuickEdit();
}
function fillPortfolioQuickEdit(){
  const select=document.getElementById("portfolioQuickEdit");
  const rows=portfolioItems.slice().sort((a,b)=>(a.title||"").localeCompare(b.title||"","th"));
  select.innerHTML='<option value="">✏️ แก้ไขด่วน: เลือกผลงานที่ต้องการแก้ไข...</option>'
    +rows.map(item=>`<option value="${esc(item.id)}">${esc(item.title||"ผลงานจัดสวน")}</option>`).join("");
}
document.getElementById("portfolioQuickEdit").addEventListener("change",e=>{
  const id=e.target.value;
  if(id) openPortfolioEdit(id);
  e.target.value="";
});
function openPortfolioDetail(id){
  const item=portfolioItems.find(x=>x.id===id);
  if(!item) return;
  selectedPortfolioId=id;
  document.getElementById("portfolioDetailName").textContent=item.title||"ผลงานจัดสวน";
  document.getElementById("portfolioDetailLocation").textContent=item.location||"-";
  renderStyleDetailGallery(item.images||[],"🏡","portfolioDetailHero","portfolioDetailThumbs");
  document.getElementById("portfolioDetailBudget").textContent=item.budget||"-";
  document.getElementById("portfolioDetailDuration").textContent=item.duration||"-";
  document.getElementById("portfolioDetailDescription").textContent=item.description||"";
  document.getElementById("portfolioDetailDialog").showModal();
}
document.getElementById("editPortfolioBtn").addEventListener("click",()=>{
  document.getElementById("portfolioDetailDialog").close();
  openPortfolioEdit(selectedPortfolioId);
});
let selectedPortfolioId="";
let portfolioEditImages=[];
function renderPortfolioEditGallery(){
  document.getElementById("portfolioEditGallery").innerHTML=portfolioEditImages.map((src,i)=>`
    <div class="style-edit-gallery-item">
      <img src="${esc(src)}" alt="" />
      <button type="button" class="style-edit-gallery-remove" onclick="removePortfolioEditImage(${i})">×</button>
    </div>`).join("");
}
function removePortfolioEditImage(idx){
  portfolioEditImages.splice(idx,1);
  renderPortfolioEditGallery();
}
function openPortfolioAdd(){
  document.getElementById("portfolioEditId").value="";
  document.getElementById("portfolioEditFormTitle").textContent="เพิ่มผลงานจัดสวน";
  document.getElementById("portfolioEditTitleInput").value="";
  document.getElementById("portfolioEditLocation").value="";
  document.getElementById("portfolioEditBudget").value="";
  document.getElementById("portfolioEditDuration").value="";
  document.getElementById("portfolioEditDescription").value="";
  document.getElementById("portfolioEditImage").value="";
  portfolioEditImages=[];
  renderPortfolioEditGallery();
  document.getElementById("portfolioEditDeleteBtn").style.display="none";
  document.getElementById("portfolioEditDialog").showModal();
}
function openPortfolioEdit(id){
  const item=portfolioItems.find(x=>x.id===id);
  if(!item) return;
  document.getElementById("portfolioEditId").value=item.id;
  document.getElementById("portfolioEditFormTitle").textContent=`แก้ไข: ${item.title||"ผลงานจัดสวน"}`;
  document.getElementById("portfolioEditTitleInput").value=item.title||"";
  document.getElementById("portfolioEditLocation").value=item.location||"";
  document.getElementById("portfolioEditBudget").value=item.budget||"";
  document.getElementById("portfolioEditDuration").value=item.duration||"";
  document.getElementById("portfolioEditDescription").value=item.description||"";
  document.getElementById("portfolioEditImage").value="";
  portfolioEditImages=(item.images||[]).slice();
  renderPortfolioEditGallery();
  document.getElementById("portfolioEditDeleteBtn").style.display="inline-flex";
  document.getElementById("portfolioEditDialog").showModal();
}
document.getElementById("addPortfolioBtn").addEventListener("click",openPortfolioAdd);
document.getElementById("portfolioEditImage").addEventListener("change",async e=>{
  const files=Array.from(e.target.files||[]);
  if(!files.length) return;
  try{
    for(const file of files){
      portfolioEditImages.push(await resizeImageToDataURL(file));
    }
    renderPortfolioEditGallery();
  }catch{
    alert("ไม่สามารถอ่านไฟล์รูปภาพนี้ได้");
  }
  e.target.value="";
});
document.getElementById("portfolioEditDeleteBtn").addEventListener("click",()=>{
  const id=document.getElementById("portfolioEditId").value;
  if(id) deletePortfolioItem(id);
});
document.getElementById("portfolioEditForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const title=document.getElementById("portfolioEditTitleInput").value.trim();
  if(!title){ alert("กรุณาระบุชื่อ/สถานที่โครงการ"); return; }
  const existingId=document.getElementById("portfolioEditId").value;
  const id=existingId||uid("portfolio");
  const item={
    id, title,
    location:document.getElementById("portfolioEditLocation").value.trim(),
    budget:document.getElementById("portfolioEditBudget").value.trim(),
    duration:document.getElementById("portfolioEditDuration").value.trim(),
    description:document.getElementById("portfolioEditDescription").value.trim(),
    images:portfolioEditImages.slice()
  };
  if(!checkDocSizeOrWarn(item,"ผลงานนี้")) return;
  portfolioItems=existingId
    ? portfolioItems.map(x=>x.id===id?item:x)
    : [...portfolioItems, item];
  renderPortfolio();
  document.getElementById("portfolioEditDialog").close();
  // Save to the cloud in the background instead of blocking the dialog open
  // with a disabled "saving..." button — the item is already visible in the
  // list from the in-memory update above, and cloudSave() still alerts on
  // a real failure (it never throws), so nothing silently gets lost.
  savePortfolioItem(item);
});
function linkedPlantsHtml(plantIds,onClickFn){
  if(!plantIds||!plantIds.length) return '<div class="meta">ยังไม่ได้เลือกต้นไม้สำหรับสวนนี้</div>';
  return plantIds.map(id=>{
    const p=getPlant(id);
    if(!p) return "";
    const cover=plantCoverThumb(p);
    return `<div class="linked-plant-tile" onclick="${onClickFn}('${p.id}')">
      <div class="linked-plant-thumb">${cover?`<img src="${esc(cover)}" alt="${esc(p.thaiName)}" loading="lazy"/>`:"🌱"}</div>
      <div class="linked-plant-name">${esc(p.thaiName)}</div>
    </div>`;
  }).join("");
}
function openStyleDetail(id){
  const s=getStyle(id);
  if(!s) return;
  selectedStyleId=id;
  document.getElementById("styleDetailCategory").textContent=s.category;
  document.getElementById("styleDetailName").textContent=s.name;
  renderStyleDetailGallery(styleImages(s),s.icon,"styleDetailHero","styleDetailThumbs");
  document.getElementById("styleDetailDescription").textContent=s.desc;
  document.getElementById("styleDetailBudget").textContent=s.budget;
  document.getElementById("styleDetailMaintenance").textContent=s.maintenance;
  document.getElementById("styleDetailDifficulty").textContent=s.difficulty;
  document.getElementById("styleDetailSuitable").textContent=s.suitableFor.join(", ");
  document.getElementById("styleDetailLinkedPlants").innerHTML=linkedPlantsHtml(s.plantIds,"openPlantDetail");
  document.getElementById("styleDetailPlants").innerHTML=s.plants.map(x=>`<span class="chip">${esc(x)}</span>`).join("");
  document.getElementById("styleDetailMaterials").innerHTML=s.materials.map(x=>`<span class="chip">${esc(x)}</span>`).join("");
  document.getElementById("styleDetailMood").textContent=s.mood;
  document.getElementById("styleDetailPrompt").textContent=s.aiPrompt;
  document.getElementById("styleDetailDialog").showModal();
}
document.getElementById("copyStylePromptBtn").addEventListener("click",async()=>{
  const s=gardenStyles.find(x=>x.id===selectedStyleId);
  if(!s) return;
  try{
    await navigator.clipboard.writeText(s.aiPrompt);
    alert("คัดลอก Prompt แล้ว");
  }catch{
    prompt("คัดลอกข้อความนี้",s.aiPrompt);
  }
});

let styleEditImages=[];
let styleEditPlantIds=[];
function renderStyleEditGallery(){
  document.getElementById("styleEditGallery").innerHTML=styleEditImages.map((src,i)=>`
    <div class="style-edit-gallery-item">
      <img src="${esc(src)}" alt="" />
      <button type="button" class="style-edit-gallery-remove" onclick="removeStyleEditImage(${i})">×</button>
    </div>`).join("");
}
function removeStyleEditImage(idx){
  styleEditImages.splice(idx,1);
  renderStyleEditGallery();
}
function renderStyleEditPlantChips(){
  const wrap=document.getElementById("styleEditPlantSelected");
  wrap.innerHTML=styleEditPlantIds.length?styleEditPlantIds.map(id=>{
    const p=getPlant(id);
    return `<span class="chip removable">${esc(p?p.thaiName:id)}<button type="button" onclick="removeStyleEditPlant('${id}')">×</button></span>`;
  }).join(""):'<span class="meta">ยังไม่ได้เลือกต้นไม้</span>';
}
function removeStyleEditPlant(id){
  styleEditPlantIds=styleEditPlantIds.filter(x=>x!==id);
  renderStyleEditPlantChips();
}
function addStyleEditPlant(id){
  if(!styleEditPlantIds.includes(id)) styleEditPlantIds.push(id);
  document.getElementById("styleEditPlantSearch").value="";
  document.getElementById("styleEditPlantResults").innerHTML="";
  renderStyleEditPlantChips();
}
function openStyleEdit(id){
  const s=getStyle(id);
  if(!s) return;
  document.getElementById("styleEditId").value=id;
  document.getElementById("styleEditTitle").textContent=`แก้ไข: ${s.name}`;
  document.getElementById("styleEditDesc").value=s.desc||"";
  document.getElementById("styleEditBudget").value=s.budget||"";
  document.getElementById("styleEditMaintenance").value=s.maintenance||"";
  document.getElementById("styleEditDifficulty").value=s.difficulty||"";
  document.getElementById("styleEditSuitable").value=(s.suitableFor||[]).join(", ");
  document.getElementById("styleEditPlants").value=(s.plants||[]).join(", ");
  document.getElementById("styleEditMaterials").value=(s.materials||[]).join(", ");
  document.getElementById("styleEditMood").value=s.mood||"";
  document.getElementById("styleEditImage").value="";
  styleEditImages=styleImages(s).slice();
  renderStyleEditGallery();
  styleEditPlantIds=(s.plantIds||[]).slice();
  document.getElementById("styleEditPlantSearch").value="";
  document.getElementById("styleEditPlantResults").innerHTML="";
  renderStyleEditPlantChips();
  document.getElementById("styleEditDialog").showModal();
}
document.getElementById("styleEditImage").addEventListener("change",async e=>{
  const files=Array.from(e.target.files||[]);
  if(!files.length) return;
  try{
    for(const file of files){
      styleEditImages.push(await resizeImageToDataURL(file));
    }
    renderStyleEditGallery();
  }catch{
    alert("ไม่สามารถอ่านไฟล์รูปภาพนี้ได้");
  }
  e.target.value="";
});
document.getElementById("styleEditPlantSearch").addEventListener("input",e=>{
  const q=e.target.value.trim().toLowerCase();
  const results=document.getElementById("styleEditPlantResults");
  if(!q){ results.innerHTML=""; return; }
  const matches=plants.filter(p=>!styleEditPlantIds.includes(p.id)&&[p.thaiName,p.englishName,p.scientificName].join(" ").toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length?matches.map(p=>`<button type="button" class="style-edit-plant-result" onclick="addStyleEditPlant('${p.id}')">${esc(p.thaiName)} <span class="meta">${esc(p.englishName||"")}</span></button>`).join(""):'<div class="meta">ไม่พบต้นไม้ที่ค้นหา</div>';
});
const splitTags=v=>v.split(",").map(x=>x.trim()).filter(Boolean);
document.getElementById("styleEditForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const id=document.getElementById("styleEditId").value;
  const override={
    desc:document.getElementById("styleEditDesc").value.trim(),
    budget:document.getElementById("styleEditBudget").value.trim(),
    maintenance:document.getElementById("styleEditMaintenance").value.trim(),
    difficulty:document.getElementById("styleEditDifficulty").value.trim(),
    suitableFor:splitTags(document.getElementById("styleEditSuitable").value),
    plants:splitTags(document.getElementById("styleEditPlants").value),
    materials:splitTags(document.getElementById("styleEditMaterials").value),
    mood:document.getElementById("styleEditMood").value.trim(),
    images:styleEditImages.slice(),
    plantIds:styleEditPlantIds.slice()
  };
  if(!checkDocSizeOrWarn(override,"แบบสวนนี้")) return;
  styleOverrides[id]=override;
  renderStyles();
  document.getElementById("styleEditDialog").close();
  // Background save — see the comment on the portfolio form's submit handler.
  saveStyleOverrides(id);
});
document.getElementById("editStyleBtn").addEventListener("click",()=>{
  document.getElementById("styleDetailDialog").close();
  openStyleEdit(selectedStyleId);
});

// Supplementary care/belief info for the 300-item catalog (data/plant-care-beliefs.json),
// keyed by plantId. Not part of the editable plant record — belief text is
// only surfaced once hasVerifiedBelief is true, per that file's own policy
// ("ข้อมูลความเชื่อต้องมีแหล่งอ้างอิงก่อนเปลี่ยน sourceStatus เป็น verified").
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
// Merges admin-entered fields (which always win when set) with the
// supplementary care/belief dataset for the 300-item catalog.
function plantCareInfo(p){
  const cb=careBeliefsById.get(p.id);
  const care=cb?.care||{};
  const belief=cb?.belief;
  return {
    wateringInstruction:care.wateringInstruction||"",
    lightInstruction:care.lightInstruction||"",
    pruning:care.pruning||"",
    fertilizer:care.fertilizer||"",
    pestCheck:care.pestCheck||"",
    careNotes:care.careNotes||"",
    auspicious:p.auspicious||(belief&&belief.hasVerifiedBelief?belief.summary:""),
    auspiciousTitle:belief&&belief.hasVerifiedBelief?belief.title:"",
    placementBelief:belief&&belief.hasVerifiedBelief?belief.placementBelief:""
  };
}
async function loadPlantDatabase(){
  const counter=document.getElementById("plantCount");
  if(counter) counter.textContent="กำลังโหลดฐานข้อมูล...";
  try{
    await loadCategories();
    const response=await fetch("./data/plants.json",{cache:"no-store"});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!Array.isArray(data)) throw new Error("รูปแบบฐานข้อมูลไม่ถูกต้อง");
    basePlants=data.filter(p=>p.active!==false).map(adaptPlant);
    rebuildPlantsList();
    resetPlantPaging();
  }catch(error){
    console.error("Plant database error:",error);
    basePlants=[];
    rebuildPlantsList();
    if(counter) counter.textContent="โหลดฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบไฟล์ data/plants.json";
    document.getElementById("plantList").innerHTML='<div class="empty">ไม่สามารถโหลดฐานข้อมูลต้นไม้ได้</div>';
  }
}

function fillPlantFilters(){
  const select=document.getElementById("plantCategoryFilter");
  const current=select.value;
  const categories=[...new Set(plants.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"th"));
  select.innerHTML='<option value="">ทุกประเภท</option>'+categories.map(x=>`<option>${esc(x)}</option>`).join("");
  select.value=current;
  fillPlantQuickEdit();
}
// Lets the admin jump straight to editing a plant by name instead of
// scrolling/searching the (potentially 300+ card) grid below.
function fillPlantQuickEdit(){
  const select=document.getElementById("plantQuickEdit");
  const rows=plants.slice().sort((a,b)=>a.thaiName.localeCompare(b.thaiName,"th"));
  select.innerHTML='<option value="">✏️ แก้ไขด่วน: เลือกต้นไม้ที่ต้องการแก้ไข...</option>'
    +rows.map(p=>`<option value="${esc(p.id)}">${esc(p.id)} · ${esc(p.thaiName)} (ขนาด${esc(plantSizeLabel(p))})${p.englishName?` — ${esc(p.englishName)}`:""}</option>`).join("");
}
document.getElementById("plantQuickEdit").addEventListener("change",e=>{
  const id=e.target.value;
  if(id) openPlantEdit(id);
  e.target.value="";
});

const PLANT_PAGE_SIZE=24;
let plantVisibleCount=PLANT_PAGE_SIZE;
function resetPlantPaging(){
  plantVisibleCount=PLANT_PAGE_SIZE;
  renderPlants();
}
// The catalog is 50 species × 6 size/grade variants each (300 records) —
// showing one full card per record meant scrolling past the same name 6
// times in a row with nothing but a size tag to tell them apart. Grouping
// by speciesId puts all size variants of the same plant into one card with
// a size picker instead; a record with no speciesId (an admin-added custom
// plant) just becomes its own single-variant group.
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
let plantGroupsByKey=new Map();
function renderPlantCardHtml(variants,selectedId){
  const p=variants.find(v=>v.id===selectedId)||variants[0];
  const cover=plantCoverThumb(p);
  const realItems=variants.filter(v=>v.custom);
  const availableCount=realItems.filter(isAvailablePlant).length;
  return `
    <article class="plant-card" data-group-key="${esc(plantGroupKey(p))}">
      <div class="plant-thumb">${cover?`<img src="${esc(cover)}" alt="${esc(p.thaiName)}" loading="lazy" />`:"🌱"}${p.bestSeller?'<span class="best-seller-badge">🔥 ขายดี</span>':""}${p.isFocalPlant?'<span class="focal-plant-badge">🌳 ไม้ประธาน</span>':""}</div>
      <div class="plant-code">${esc(p.inventoryCode||p.id)} · ${esc(p.category)}${realItems.length?` · <span class="chip">สินค้าจริง ${realItems.length} ต้น</span><span class="chip">พร้อมขาย ${availableCount} ต้น</span>`:""}</div>
      <h3>${esc(p.thaiName)}</h3>
      <div>${esc(p.englishName||"-")}</div>
      <div class="plant-scientific">${esc(p.scientificName||"")}</div>
      ${variants.length>1?`<div class="plant-size-picker">${variants.map(v=>`<button type="button" class="plant-size-chip${v.id===p.id?" active":""}" data-plant-id="${esc(v.id)}">${esc(v.custom?(v.inventoryCode||v.id):(plantSizeLabel(v)||"?"))}</button>`).join("")}</div>`:(plantSizeLabel(p)?`<div class="meta">ขนาด ${esc(plantSizeLabel(p))}</div>`:"")}
      ${p.custom?`<div class="meta">สถานะ ${p.stockStatus==="sold"?"ขายแล้ว":p.stockStatus==="reserved"?"จองแล้ว":"พร้อมขาย"}${p.arrivalDate?` · เข้า ${esc(p.arrivalDate)}`:""}</div>`:""}
      <div class="chips">
        <span class="chip">${esc(p.light)}</span>
        <span class="chip">น้ำ ${esc(p.water)}</span>
        <span class="chip">ดูแล ${esc(maintenanceLabel(p.maintenance))}</span>
      </div>
      <div class="plant-price-row">
        <div><span>ต้นทุน</span><strong>${money(p.costPrice)}</strong></div>
        <div><span>ราคาขาย</span><strong>${money(p.salePrice)}</strong></div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" onclick="openPlantDetail('${p.id}')">ดูรายละเอียด</button>
        <button class="small-btn" onclick="${p.custom?"openCustomPlantEdit":"openPlantEdit"}('${p.id}')">แก้ไข</button>
        ${realItems.length?`<button class="small-btn" onclick="openCustomPlantAddForSpecies('${p.id}')">+ เพิ่มต้นจริงพันธุ์นี้</button>`:""}
      </div>
    </article>`;
}
document.getElementById("plantList").addEventListener("click",e=>{
  const chip=e.target.closest(".plant-size-chip");
  if(!chip) return;
  const card=chip.closest(".plant-card");
  const variants=plantGroupsByKey.get(card.dataset.groupKey);
  if(!variants) return;
  card.outerHTML=renderPlantCardHtml(variants,chip.dataset.plantId);
});
function renderPlants(){
  const q=(document.getElementById("plantSearch")?.value||"").toLowerCase();
  const category=document.getElementById("plantCategoryFilter")?.value||"";
  const light=document.getElementById("plantLightFilter")?.value||"";
  const focalOnly=document.getElementById("plantFocalFilter")?.checked||false;
  const rows=mergedPlants().filter(p=>{
    const hay=[p.id,p.thaiName,p.englishName,p.scientificName,p.category,p.light].join(" ").toLowerCase();
    return hay.includes(q)&&(!category||p.category===category)&&(!light||p.light===light)&&(!focalOnly||p.isFocalPlant);
  });
  // Recently-edited plants surface first so the admin can quickly spot and
  // double-check what they just changed, without hunting through the whole
  // 300+ item catalog. plantOverrides carries the edit timestamp for base
  // catalog plants; custom (real-inventory) plants carry it directly.
  const groupLastEditedAt=group=>Math.max(0,...group.map(p=>{
    const t=plantOverrides[p.id]?.updatedAt||p.updatedAt;
    return t?Date.parse(t):0;
  }));
  const groups=groupPlantsBySpecies(rows)
    .sort((a,b)=>groupLastEditedAt(b)-groupLastEditedAt(a)||(b.some(p=>p.bestSeller)?1:0)-(a.some(p=>p.bestSeller)?1:0));
  plantGroupsByKey=new Map(groups.map(g=>[plantGroupKey(g[0]),g]));
  const visibleGroups=groups.slice(0,plantVisibleCount);
  document.getElementById("plantCount").textContent=`แสดง ${visibleGroups.length} จาก ${groups.length} ชนิด (${rows.length} รายการ จากทั้งหมด ${plants.length})`;
  document.getElementById("plantList").innerHTML=visibleGroups.length
    ?visibleGroups.map(g=>renderPlantCardHtml(g,g[0].id)).join("")
    :'<div class="empty">ไม่พบต้นไม้ที่ค้นหา</div>';
  const loadMoreBtn=document.getElementById("loadMorePlantsBtn");
  const remaining=groups.length-visibleGroups.length;
  if(remaining>0){
    loadMoreBtn.textContent=`โหลดเพิ่ม (เหลืออีก ${remaining} ชนิด)`;
    loadMoreBtn.style.display="inline-flex";
  } else {
    loadMoreBtn.style.display="none";
  }
}

function openPlantDetail(id){
  const p=getPlant(id);
  if(!p) return;
  selectedPlantId=id;
  document.getElementById("plantDetailCode").textContent=[p.id,p.englishName,plantSizeLabel(p)?`ขนาด${plantSizeLabel(p)}`:"",p.potSize?`กระถาง ${p.potSize}`:""].filter(Boolean).join(" · ");
  document.getElementById("plantDetailName").textContent=p.thaiName+(p.isFocalPlant?" 🌳 ไม้ประธาน":"");
  document.getElementById("plantDetailScientific").textContent=p.scientificName||"-";
  document.getElementById("plantDetailCategory").textContent=p.category||"-";
  document.getElementById("plantDetailLight").textContent=p.light||"-";
  document.getElementById("plantDetailWater").textContent=p.water||"-";
  document.getElementById("plantDetailMaintenance").textContent=maintenanceLabel(p.maintenance);
  document.getElementById("plantDetailHeight").textContent=(p.heightCm||0)+" ซม.";
  document.getElementById("plantDetailSpacing").textContent=(p.spacingCm||0)+" ซม.";
  document.getElementById("plantDetailCost").textContent=money(p.costPrice)+" / "+p.unit;
  document.getElementById("plantDetailPrice").textContent=money(p.salePrice)+" / "+p.unit;
  document.getElementById("plantDetailStyles").innerHTML=(p.styles||[]).map(id=>`<span class="chip">${esc(styleName(id))}</span>`).join("");
  renderStyleDetailGallery(plantImages(p),"🌱","plantDetailIcon","plantDetailThumbs");
  const info=plantCareInfo(p);
  const careItems=[
    info.wateringInstruction&&["💧 การรดน้ำ",info.wateringInstruction],
    info.lightInstruction&&["☀️ แสง",info.lightInstruction],
    info.pruning&&["✂️ การตัดแต่ง",info.pruning],
    info.fertilizer&&["🌱 ปุ๋ย",info.fertilizer],
    info.pestCheck&&["🔍 ตรวจโรค/แมลง",info.pestCheck],
    info.careNotes&&["📝 หมายเหตุ",info.careNotes]
  ].filter(Boolean);
  const careSection=document.getElementById("plantDetailCareSection");
  if(careItems.length){
    document.getElementById("plantDetailCareList").innerHTML=careItems.map(([label,text])=>`<li><b>${esc(label)}:</b> ${esc(text)}</li>`).join("");
    careSection.style.display="block";
  } else {
    careSection.style.display="none";
  }
  const auspiciousSection=document.getElementById("plantDetailAuspiciousSection");
  if(info.auspicious){
    document.getElementById("plantDetailAuspiciousTitle").textContent=info.auspiciousTitle?`ความเชื่อ / ความมงคล — ${info.auspiciousTitle}`:"ความเชื่อ / ความมงคล";
    document.getElementById("plantDetailAuspicious").textContent=info.auspicious+(info.placementBelief?` (${info.placementBelief})`:"");
    auspiciousSection.style.display="block";
  } else {
    auspiciousSection.style.display="none";
  }
  document.getElementById("plantDetailDialog").showModal();
}

document.getElementById("plantSearch").addEventListener("input",resetPlantPaging);
document.getElementById("plantCategoryFilter").addEventListener("change",resetPlantPaging);
document.getElementById("plantLightFilter").addEventListener("change",resetPlantPaging);
document.getElementById("plantFocalFilter").addEventListener("change",resetPlantPaging);
document.getElementById("reloadPlantDbBtn").addEventListener("click",loadPlantDatabase);
document.getElementById("loadMorePlantsBtn").addEventListener("click",()=>{
  plantVisibleCount+=PLANT_PAGE_SIZE;
  renderPlants();
});

let plantEditImages=[];
let plantEditThumbs=[];
function renderPlantEditGallery(){
  document.getElementById("plantEditGallery").innerHTML=plantEditImages.map((src,i)=>`
    <div class="style-edit-gallery-item">
      <img src="${esc(src)}" alt="" />
      <button type="button" class="style-edit-gallery-remove" onclick="removePlantEditImage(${i})">×</button>
    </div>`).join("");
}
function removePlantEditImage(idx){
  plantEditImages.splice(idx,1);
  plantEditThumbs.splice(idx,1);
  renderPlantEditGallery();
}
function renderSquareVariant(img,side,sx,sy,targetDim,maxBytes){
  const canvas=document.createElement("canvas");
  canvas.width=targetDim;
  canvas.height=targetDim;
  const ctx=canvas.getContext("2d");
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(img,sx,sy,side,side,0,0,targetDim,targetDim);
  // Safari has historically not supported WebP canvas export: per spec,
  // an unsupported requested type silently falls back to PNG — which
  // ignores the quality parameter entirely, so our size-reduction loop
  // would do nothing and ship a multi-MB lossless PNG instead of a
  // ~250KB photo. That matches exactly what was reported (uploads that
  // work fine for text but hang/fail once a photo is attached). Detect
  // the fallback by checking the returned data URL's actual mime type,
  // and use JPEG instead — quality-adjustable and reliable everywhere.
  const mime=canvas.toDataURL("image/webp",0.92).startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
  let quality=0.92;
  let dataUrl=canvas.toDataURL(mime,quality);
  // Back off quality in small steps until the encoded size fits the budget
  // (base64 ~= 4/3 of raw bytes), but don't go below a floor that turns visibly soft.
  while(dataUrl.length*0.75>maxBytes && quality>0.55){
    quality-=0.05;
    dataUrl=canvas.toDataURL(mime,quality);
  }
  return dataUrl;
}
// variants: [{targetDim,maxBytes}, ...] — resolves to an array of data URLs in
// the same order, all cropped/scaled from a single decode of the source file
// so adding a second (e.g. thumbnail) size doesn't cost a second file read.
function resizeImageVariants(file,variants){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error);
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error("โหลดรูปภาพไม่สำเร็จ"));
      img.onload=()=>{
        // Crop to a centered square, then scale to each requested size.
        const side=Math.min(img.width,img.height);
        const sx=(img.width-side)/2, sy=(img.height-side)/2;
        resolve(variants.map(({targetDim,maxBytes})=>renderSquareVariant(img,side,sx,sy,targetDim,maxBytes)));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function resizeImageToDataURL(file,targetDim=800,maxBytes=250*1024){
  return resizeImageVariants(file,[{targetDim,maxBytes}]).then(r=>r[0]);
}
// Plant photos are shown at gallery-tile size almost everywhere (admin card
// grid, showcase plant grid, linked-plant chips) and only need full
// resolution in the one-at-a-time lightbox/detail view. Producing a small
// companion thumbnail at upload time means those list views can skip
// downloading/decoding the full ~250KB photo for every tile.
function resizeImageWithThumb(file){
  return resizeImageVariants(file,[{targetDim:800,maxBytes:250*1024},{targetDim:280,maxBytes:45*1024}]);
}
// Uploads one already-resized photo to R2 via the Cloudflare Worker
// (verifies the same Firebase admin session already used for Firestore
// writes — see cloudflare-worker/worker.js). Returns the hosted URL, or
// null on ANY failure (Worker not deployed yet, offline, not logged in,
// etc.) — callers must fall back to the original base64 string, never
// drop the photo.
async function uploadPlantPhotoToR2(dataUrl,filename){
  if(!SHOWCASE_WORKER_URL) return null;
  try{
    const headers=await fbHeaders();
    if(!headers.Authorization) return null;
    const blob=await (await fetch(dataUrl)).blob();
    const res=await fetch(`${SHOWCASE_WORKER_URL}/upload`,{
      method:"POST",
      headers:{"Content-Type":blob.type||"image/jpeg","Authorization":headers.Authorization,"X-Photo-Name":filename},
      body:blob
    });
    if(!res.ok) return null;
    const data=await res.json();
    return data.url||null;
  }catch{
    return null;
  }
}
// Tries to host both the full photo and its thumbnail on R2 so the
// Firestore doc stores real URLs instead of base64 — smaller documents, and
// lets the per-plant share link show the actual photo. Falls back to the
// original base64 pair untouched if either upload doesn't succeed; a
// plant's photo must never be lost or left broken because of this.
async function hostPlantPhotoPair(full,thumb,baseName){
  const [fullUrl,thumbUrl]=await Promise.all([
    uploadPlantPhotoToR2(full,`${baseName}-full`),
    uploadPlantPhotoToR2(thumb,`${baseName}-thumb`)
  ]);
  return (fullUrl&&thumbUrl)?[fullUrl,thumbUrl]:[full,thumb];
}
function openPlantEdit(id){
  const p=getPlant(id);
  if(!p) return;
  if(p.custom){ openCustomPlantEdit(id); return; }
  document.getElementById("plantEditId").value=id;
  document.getElementById("plantEditTitle").textContent=`แก้ไข: ${p.thaiName}`;
  document.getElementById("plantEditSizeValue").value=p.customSizeValue||"";
  document.getElementById("plantEditSizeUnit").value=p.customSizeUnit||"cm";
  document.getElementById("plantEditCost").value=p.costPrice||0;
  document.getElementById("plantEditPrice").value=p.salePrice||0;
  document.getElementById("plantEditBestSeller").checked=!!p.bestSeller;
  document.getElementById("plantEditFocal").checked=!!p.isFocalPlant;
  document.getElementById("plantEditAuspicious").value=p.auspicious||"";
  document.getElementById("plantEditImage").value="";
  plantEditImages=plantImages(p).slice();
  plantEditThumbs=(p.thumbs||[]).slice();
  renderPlantEditGallery();
  document.getElementById("plantEditDialog").showModal();
}
document.getElementById("plantEditImage").addEventListener("change",async e=>{
  const files=Array.from(e.target.files||[]);
  if(!files.length) return;
  try{
    for(const file of files){
      const [full,thumb]=await resizeImageWithThumb(file);
      const [hostedFull,hostedThumb]=await hostPlantPhotoPair(full,thumb,file.name||"photo");
      plantEditImages.push(hostedFull);
      plantEditThumbs.push(hostedThumb);
    }
    renderPlantEditGallery();
  }catch{
    alert("ไม่สามารถอ่านไฟล์รูปภาพนี้ได้");
  }
  e.target.value="";
});
document.getElementById("plantEditForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const id=document.getElementById("plantEditId").value;
  const override={
    customSizeValue:Number(document.getElementById("plantEditSizeValue").value)||0,
    customSizeUnit:document.getElementById("plantEditSizeUnit").value,
    costPrice:Number(document.getElementById("plantEditCost").value)||0,
    salePrice:Number(document.getElementById("plantEditPrice").value)||0,
    bestSeller:document.getElementById("plantEditBestSeller").checked,
    isFocalPlant:document.getElementById("plantEditFocal").checked,
    auspicious:document.getElementById("plantEditAuspicious").value.trim(),
    images:plantEditImages.slice(),
    thumbs:plantEditThumbs.slice(),
    updatedAt:new Date().toISOString()
  };
  if(!checkDocSizeOrWarn(override,"ต้นไม้นี้")) return;
  plantOverrides[id]=override;
  renderPlants();
  document.getElementById("plantEditDialog").close();
  // Background save — see the comment on the portfolio form's submit handler.
  savePlantOverrides(id);
  const merged=getPlant(id);
  syncPlantPriceToBot(id,merged?.thaiName,override.salePrice,merged&&plantSizeLabel(merged),merged?.potSize);
});
document.getElementById("editPlantBtn").addEventListener("click",()=>{
  document.getElementById("plantDetailDialog").close();
  openPlantEdit(selectedPlantId);
});

// ---- Custom plants (added by the admin, not part of the 300-item catalog) ----
let plantAddImages=[];
let plantAddThumbs=[];
function renderPlantAddGallery(){
  document.getElementById("plantAddGallery").innerHTML=plantAddImages.map((src,i)=>`
    <div class="style-edit-gallery-item">
      <img src="${esc(src)}" alt="" />
      <button type="button" class="style-edit-gallery-remove" onclick="removePlantAddImage(${i})">×</button>
    </div>`).join("");
}
function removePlantAddImage(idx){
  plantAddImages.splice(idx,1);
  plantAddThumbs.splice(idx,1);
  renderPlantAddGallery();
}
function fillPlantAddCategoryOptions(){
  const categories=[...new Set(plants.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"th"));
  document.getElementById("plantAddCategoryOptions").innerHTML=categories.map(x=>`<option value="${esc(x)}"></option>`).join("");
}
function makeInventoryCode(thaiName="ต้นไม้"){
  const species=String(thaiName).trim().replace(/\s+/g,"-")||"ต้นไม้";
  const suffix=Date.now().toString(36).slice(-4).toUpperCase()+Math.random().toString(36).slice(2,4).toUpperCase();
  return `${species}-${suffix}`;
}
function openCustomPlantAdd(){
  fillPlantAddCategoryOptions();
  document.getElementById("plantAddId").value="";
  document.getElementById("plantAddSpeciesId").value="";
  document.getElementById("plantAddTitle").textContent="เพิ่มต้นไม้ใหม่";
  document.getElementById("plantAddThaiName").value="";
  document.getElementById("plantAddEnglishName").value="";
  document.getElementById("plantAddScientificName").value="";
  document.getElementById("plantAddCategory").value="";
  document.getElementById("plantAddLight").value="";
  document.getElementById("plantAddWater").value="";
  document.getElementById("plantAddMaintenance").value="";
  document.getElementById("plantAddSizeValue").value="";
  document.getElementById("plantAddSizeUnit").value="cm";
  document.getElementById("plantAddUnit").value="ต้น";
  document.getElementById("plantAddInventoryCode").value="";
  document.getElementById("plantAddStockStatus").value="available";
  document.getElementById("plantAddArrivalDate").value=new Date().toISOString().slice(0,10);
  document.getElementById("plantAddCost").value=0;
  document.getElementById("plantAddPrice").value=0;
  document.getElementById("plantAddAuspicious").value="";
  document.getElementById("plantAddBestSeller").checked=false;
  document.getElementById("plantAddFocal").checked=false;
  document.getElementById("plantAddImage").value="";
  plantAddImages=[];
  plantAddThumbs=[];
  renderPlantAddGallery();
  document.getElementById("plantAddDeleteBtn").style.display="none";
  document.getElementById("plantAddDialog").showModal();
}
function openCustomPlantAddForSpecies(id){
  const source=customPlants.find(x=>x.id===id);
  if(!source) return;
  openCustomPlantAdd();
  document.getElementById("plantAddTitle").textContent=`เพิ่มต้นจริง: ${source.thaiName}`;
  document.getElementById("plantAddSpeciesId").value=source.speciesId||plantGroupKey(source);
  document.getElementById("plantAddThaiName").value=source.thaiName||"";
  document.getElementById("plantAddEnglishName").value=source.englishName||"";
  document.getElementById("plantAddScientificName").value=source.scientificName||"";
  document.getElementById("plantAddCategory").value=source.category||"";
  document.getElementById("plantAddLight").value=source.light||"";
  document.getElementById("plantAddWater").value=source.water||"";
  document.getElementById("plantAddMaintenance").value=source.maintenance||"";
  document.getElementById("plantAddUnit").value=source.unit||"ต้น";
  document.getElementById("plantAddBestSeller").checked=!!source.bestSeller;
  document.getElementById("plantAddFocal").checked=!!source.isFocalPlant;
}
function openCustomPlantEdit(id){
  const p=customPlants.find(x=>x.id===id);
  if(!p) return;
  fillPlantAddCategoryOptions();
  document.getElementById("plantAddId").value=p.id;
  document.getElementById("plantAddSpeciesId").value=p.speciesId||plantGroupKey(p);
  document.getElementById("plantAddTitle").textContent=`แก้ไข: ${p.thaiName}`;
  document.getElementById("plantAddThaiName").value=p.thaiName||"";
  document.getElementById("plantAddEnglishName").value=p.englishName||"";
  document.getElementById("plantAddScientificName").value=p.scientificName||"";
  document.getElementById("plantAddCategory").value=p.category||"";
  document.getElementById("plantAddLight").value=p.light||"";
  document.getElementById("plantAddWater").value=p.water||"";
  document.getElementById("plantAddMaintenance").value=p.maintenance||"";
  document.getElementById("plantAddSizeValue").value=p.customSizeValue||"";
  document.getElementById("plantAddSizeUnit").value=p.customSizeUnit||"cm";
  document.getElementById("plantAddUnit").value=p.unit||"ต้น";
  document.getElementById("plantAddInventoryCode").value=p.inventoryCode||p.id;
  document.getElementById("plantAddStockStatus").value=p.stockStatus||"available";
  document.getElementById("plantAddArrivalDate").value=p.arrivalDate||"";
  document.getElementById("plantAddCost").value=p.costPrice||0;
  document.getElementById("plantAddPrice").value=p.salePrice||0;
  document.getElementById("plantAddAuspicious").value=p.auspicious||"";
  document.getElementById("plantAddBestSeller").checked=!!p.bestSeller;
  document.getElementById("plantAddFocal").checked=!!p.isFocalPlant;
  document.getElementById("plantAddImage").value="";
  plantAddImages=plantImages(p).slice();
  plantAddThumbs=(p.thumbs||[]).slice();
  renderPlantAddGallery();
  document.getElementById("plantAddDeleteBtn").style.display="inline-flex";
  document.getElementById("plantAddDialog").showModal();
}
document.getElementById("addCustomPlantBtn").addEventListener("click",openCustomPlantAdd);
document.getElementById("plantAddImage").addEventListener("change",async e=>{
  const files=Array.from(e.target.files||[]);
  if(!files.length) return;
  try{
    for(const file of files){
      const [full,thumb]=await resizeImageWithThumb(file);
      const [hostedFull,hostedThumb]=await hostPlantPhotoPair(full,thumb,file.name||"photo");
      plantAddImages.push(hostedFull);
      plantAddThumbs.push(hostedThumb);
    }
    renderPlantAddGallery();
  }catch{
    alert("ไม่สามารถอ่านไฟล์รูปภาพนี้ได้");
  }
  e.target.value="";
});
document.getElementById("plantAddDeleteBtn").addEventListener("click",()=>{
  const id=document.getElementById("plantAddId").value;
  if(id) deleteCustomPlant(id);
});
document.getElementById("plantAddForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const thaiName=document.getElementById("plantAddThaiName").value.trim();
  if(!thaiName){ alert("กรุณาระบุชื่อไทยของต้นไม้"); return; }
  const existingId=document.getElementById("plantAddId").value;
  const id=existingId||uid("plant");
  const existing=existingId?customPlants.find(p=>p.id===existingId):null;
  const speciesId=document.getElementById("plantAddSpeciesId").value||existing?.speciesId||`custom:${normalizedPlantSpeciesName(thaiName)}`;
  const plant={
    id, custom:true, speciesId,
    inventoryCode:document.getElementById("plantAddInventoryCode").value.trim()||existing?.inventoryCode||makeInventoryCode(thaiName),
    stockStatus:document.getElementById("plantAddStockStatus").value||"available",
    arrivalDate:document.getElementById("plantAddArrivalDate").value||new Date().toISOString().slice(0,10),
    thaiName,
    englishName:document.getElementById("plantAddEnglishName").value.trim(),
    scientificName:document.getElementById("plantAddScientificName").value.trim(),
    category:document.getElementById("plantAddCategory").value.trim(),
    light:document.getElementById("plantAddLight").value,
    water:document.getElementById("plantAddWater").value,
    maintenance:document.getElementById("plantAddMaintenance").value,
    customSizeValue:Number(document.getElementById("plantAddSizeValue").value)||0,
    customSizeUnit:document.getElementById("plantAddSizeUnit").value,
    unit:document.getElementById("plantAddUnit").value.trim()||"ต้น",
    costPrice:Number(document.getElementById("plantAddCost").value)||0,
    salePrice:Number(document.getElementById("plantAddPrice").value)||0,
    bestSeller:document.getElementById("plantAddBestSeller").checked,
    isFocalPlant:document.getElementById("plantAddFocal").checked,
    auspicious:document.getElementById("plantAddAuspicious").value.trim(),
    images:plantAddImages.slice(),
    thumbs:plantAddThumbs.slice(),
    updatedAt:new Date().toISOString()
  };
  if(!checkDocSizeOrWarn(plant,"ต้นไม้นี้")) return;
  customPlants=existingId
    ? customPlants.map(p=>p.id===id?plant:p)
    : [...customPlants, plant];
  rebuildPlantsList();
  resetPlantPaging();
  document.getElementById("plantAddDialog").close();
  // Background save — see the comment on the portfolio form's submit handler.
  saveCustomPlant(plant);
  syncPlantPriceToBot(plant.id,plant.thaiName,plant.salePrice,plantSizeLabel(plant),plant.potSize);
});

function renderAll(){renderStyles();renderPortfolio();renderSupplies();}
renderAll();
loadPlantDatabase();
loadCareBeliefs();

// Reading the local cache is async now (IndexedDB), so it can't populate
// plantOverrides/styleOverrides/customPlants/portfolioItems/failedSaves via
// a plain top-level `let x = load(...)` the way localStorage did — the page
// renders once immediately above with empty local overrides (still shows
// the 50 built-in styles fine), then this re-renders with the real local
// backup as soon as it's read. initFromFirestore() is chained after it so
// failedSaves is populated before the very first cloud sync tries to merge
// it in.
async function hydrateFromLocalCache(){
  await LS.migrateFromLocalStorage([
    STORAGE.plantOverrides, STORAGE.styleOverrides, STORAGE.customPlants,
    STORAGE.plantShowcaseIndex, STORAGE.gardenPortfolio, STORAGE.gardenSupplies, FAILED_SAVES_KEY
  ]);
  const [pO,sO,cP,pI,sI,fS]=await Promise.all([
    LS.get(STORAGE.plantOverrides,{}),
    LS.get(STORAGE.styleOverrides,{}),
    LS.get(STORAGE.customPlants,[]),
    LS.get(STORAGE.gardenPortfolio,[]),
    LS.get(STORAGE.gardenSupplies,[]),
    LS.get(FAILED_SAVES_KEY,[])
  ]);
  plantOverrides=pO;
  styleOverrides=sO;
  customPlants=cP;
  portfolioItems=pI;
  supplyItems=mergeSupplyItems(sI);
  failedSaves=new Map((fS||[]).map(e=>[saveDocKey(e.collection,e.id),e]));
  rebuildPlantsList();
  renderAll();
  if(plants.length) renderPlants();
}

function setCloudStatus(ok){
  const el=document.getElementById("cloudStatus");
  if(!el) return;
  el.textContent=ok?"☁️ ซิงก์ข้อมูลแล้ว":"📴 ออฟไลน์ (ใช้ข้อมูลในเครื่อง)";
  el.style.color=ok?"var(--primary)":"var(--danger)";
}
// Form submits fire cloudSave() in the background instead of awaiting it
// (so the dialog can close immediately) — which means a save can still be
// in flight after the dialog is gone. The periodic Firestore poll below used
// to only check "is a dialog open" to avoid clobbering in-progress work; now
// that saves outlive the dialog, it also needs to know "is a save still in
// flight", or it can refetch the pre-save cloud copy mid-upload and stomp
// the just-added item/photo back out of the local view until the write
// finally lands. pendingCloudSaves tracks that.
let pendingCloudSaves = 0;
async function cloudSave(fn,label){
  pendingCloudSaves++;
  try{
    await fn();
    setCloudStatus(true);
    bumpCatalogRevision();
    return true;
  }catch(err){
    console.error("Firestore save failed, staying on local data:",err);
    setCloudStatus(false);
    alert(`⚠️ บันทึก${label||"ข้อมูล"}ขึ้นคลาวด์ไม่สำเร็จ\n\nสาเหตุ: ${err.message||err}\n\nข้อมูลบันทึกไว้ในเครื่องนี้ชั่วคราวเท่านั้น กรุณาลองบันทึกซ้ำอีกครั้ง`);
    return false;
  }finally{
    pendingCloudSaves--;
  }
}

// Same background-save timeout risk as pendingCloudSaves above, but for the
// data itself, not just the sync guard: a weak connection (common on a job
// site, not just a brief hiccup) can make fbSet() genuinely fail rather than
// just run long. Previously that meant the item silently vanished on the
// very next sync — it was never actually in Firestore, so refetching "the
// truth" from the cloud dropped it, with only an easy-to-miss alert as
// warning. Now a failed save is queued here, re-merged back into the local
// data on every sync (so it keeps showing up), and retried automatically —
// the admin doesn't have to notice the alert or manually redo anything.
// Persisted to the local cache (not just kept in memory) because a Map that
// only lives in a JS variable is gone the instant the tab reloads or gets
// discarded (very easy to trigger on mobile Safari) — which silently
// defeated the whole point of this queue: on the very next load,
// initFromFirestore() would fetch the cloud copy that still lacks the
// item (it genuinely never saved) with nothing left to re-merge it back
// from, reproducing the exact "added it, then it vanished" bug this queue
// exists to prevent. Populated by hydrateFromLocalCache() below, not here —
// reading it is async now (IndexedDB), so it can't be a plain top-level
// `let failedSaves = ...` initializer anymore.
const FAILED_SAVES_KEY = "garden_failed_saves_v1";
let failedSaves = new Map();
function saveDocKey(collection,id){ return `${collection}:${id}`; }
function persistFailedSaves(){
  safeSetLocal(FAILED_SAVES_KEY, [...failedSaves.values()]);
}
// Collections that either ARE the revision marker itself, or are never read
// by the showcase, so writing them shouldn't trigger a showcase refetch.
const NO_REVISION_BUMP_COLLECTIONS=new Set(["catalogMeta","plants"]);
// Lets the showcase know new data exists without it re-downloading all 6
// collections on every poll cycle: the showcase just checks this one tiny
// doc's revision and only re-fetches everything when the number changed.
// Best-effort and silent — losing this bump would only make the showcase's
// next scheduled metadata check (still running on its own interval) require
// an extra cycle, not lose any data.
async function bumpCatalogRevision(){
  try{
    await fbSet("catalogMeta","public",{revision:Date.now(),updatedAt:new Date().toISOString()});
  }catch(err){
    console.error("Catalog revision bump failed (showcase will still refresh on its own next check):",err);
  }
}
async function saveDoc(collection,id,obj,label){
  pendingCloudSaves++;
  try{
    await fbSet(collection,id,obj);
    failedSaves.delete(saveDocKey(collection,id));
    persistFailedSaves();
    setCloudStatus(true);
    if(!NO_REVISION_BUMP_COLLECTIONS.has(collection)) bumpCatalogRevision();
    return true;
  }catch(err){
    console.error("Firestore save failed, will keep retrying in the background:",err);
    setCloudStatus(false);
    failedSaves.set(saveDocKey(collection,id),{collection,id,obj,label});
    persistFailedSaves();
    alert(`⚠️ บันทึก${label||"ข้อมูล"}ขึ้นคลาวด์ไม่สำเร็จ\n\nสาเหตุ: ${err.message||err}\n\nข้อมูลยังอยู่ในเครื่องนี้ ระบบจะลองบันทึกขึ้นคลาวด์ให้อัตโนมัติอีกครั้งเมื่อสัญญาณดีขึ้น ไม่ต้องกดบันทึกซ้ำ`);
    return false;
  }finally{
    pendingCloudSaves--;
  }
}
async function retryFailedSaves(){
  for(const {collection,id,obj} of [...failedSaves.values()]){
    pendingCloudSaves++;
    try{
      await fbSet(collection,id,obj);
      failedSaves.delete(saveDocKey(collection,id));
      persistFailedSaves();
      setCloudStatus(true);
      if(!NO_REVISION_BUMP_COLLECTIONS.has(collection)) bumpCatalogRevision();
    }catch(err){
      console.error("Retry save still failing, will try again on the next sync:",err);
    }finally{
      pendingCloudSaves--;
    }
  }
}

// On load, pull the latest data from Firestore (source of truth across
// devices) and overlay it on top of whatever the local cache already
// showed, so the page is usable instantly and then refreshes once the
// cloud data arrives. If Firestore is unreachable, silently keep using the
// local cache — the app must keep working offline.
async function initFromFirestore(){
  try{
    const [remotePlantOverrides,remoteStyleOverrides,remoteCustomPlants,remotePortfolio,remotePlantShowcaseIndex,remoteSupplies]=await Promise.all([
      fbList("plantOverrides"),
      fbList("styleOverrides"),
      fbList("customPlants"),
      fbList("gardenPortfolio"),
      fbList("plantShowcaseIndex"),
      fbList("gardenSupplies")
    ]);
    plantOverrides={};
    remotePlantOverrides.forEach(p=>{const {id,...rest}=p;plantOverrides[id]=rest;});
    styleOverrides={};
    remoteStyleOverrides.forEach(s=>{const {id,...rest}=s;styleOverrides[id]=rest;});
    customPlants=remoteCustomPlants;
    portfolioItems=remotePortfolio;
    supplyItems=mergeSupplyItems(remoteSupplies);
    // Re-apply any edit that's still waiting to reach the cloud (see
    // failedSaves above) so this refresh doesn't wipe it back out just
    // because it isn't in Firestore yet.
    failedSaves.forEach(({collection,id,obj})=>{
      if(collection==="plantOverrides") plantOverrides[id]=obj;
      else if(collection==="styleOverrides") styleOverrides[id]=obj;
      else if(collection==="customPlants") customPlants=customPlants.some(p=>p.id===id)?customPlants.map(p=>p.id===id?obj:p):[...customPlants,obj];
      else if(collection==="gardenPortfolio") portfolioItems=portfolioItems.some(p=>p.id===id)?portfolioItems.map(p=>p.id===id?obj:p):[...portfolioItems,obj];
      else if(collection==="gardenSupplies") supplyItems=obj.deleted?supplyItems.filter(p=>p.id!==id):(supplyItems.some(p=>p.id===id)?supplyItems.map(p=>p.id===id?obj:p):[...supplyItems,obj]);
    });
    safeSetLocal(STORAGE.plantOverrides,plantOverrides);
    safeSetLocal(STORAGE.styleOverrides,styleOverrides);
    safeSetLocal(STORAGE.customPlants,customPlants);
    safeSetLocal(STORAGE.gardenPortfolio,portfolioItems);
    safeSetLocal(STORAGE.gardenSupplies,supplyItems);
    renderAll();
    rebuildPlantsList();
    if(plants.length) renderPlants();
    setCloudStatus(true);
    if(failedSaves.size) retryFailedSaves();
    // One-time/background migration: old records had only 800px full images.
    // Create 280px thumbnails and a lightweight public index without blocking Admin.
    syncPlantShowcaseIndexes(customPlants,remotePlantShowcaseIndex);
    return true;
  }catch(error){
    console.error("Firestore initial sync failed, staying on local data:",error);
    setCloudStatus(false);
    return false;
  }
}
// ---- Admin login gate ----
// The whole admin UI stays hidden behind #loginScreen until a real Firebase
// Auth session exists (see firebase-client.js — no more shared password).
// A returning admin's session is restored silently from a saved refresh
// token; a brand-new admin (or one whose session expired/was revoked) sees
// the login form. See docs/firestore-ops.md for creating the account.
function showAdminApp(){
  document.getElementById("loginScreen").style.display="none";
  document.getElementById("adminApp").style.display="";
  hydrateFromLocalCache().then(initFromFirestore);
}
document.getElementById("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=document.getElementById("loginEmail").value.trim();
  const password=document.getElementById("loginPassword").value;
  const errorEl=document.getElementById("loginError");
  const submitBtn=document.getElementById("loginSubmitBtn");
  errorEl.style.display="none";
  submitBtn.disabled=true;
  submitBtn.textContent="กำลังเข้าสู่ระบบ...";
  try{
    await fbAdminLogin(email,password);
    showAdminApp();
  }catch(err){
    errorEl.textContent=err.message||"เข้าสู่ระบบไม่สำเร็จ";
    errorEl.style.display="block";
  }finally{
    submitBtn.disabled=false;
    submitBtn.textContent="เข้าสู่ระบบ";
  }
});
document.getElementById("logoutBtn").addEventListener("click",()=>{
  if(!confirm("ออกจากระบบ?")) return;
  fbAdminLogout();
  location.reload();
});
// Fires only when Firebase explicitly rejects the saved refresh token (not
// on a network blip) — bring back the login screen so the admin sees why
// saves stopped working, instead of writes silently failing forever.
fbSetSessionExpiredHandler(()=>{
  document.getElementById("adminApp").style.display="none";
  const errorEl=document.getElementById("loginError");
  errorEl.textContent="เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง (ข้อมูลที่แก้ไว้ยังอยู่ในเครื่องนี้ ไม่หายไปไหน)";
  errorEl.style.display="block";
  document.getElementById("loginScreen").style.display="flex";
  document.getElementById("loginEmail").focus();
});
fbTryRestoreSession().then(restored=>{
  if(restored) showAdminApp();
  else document.getElementById("loginEmail").focus();
});

document.getElementById("manualSyncBtn").addEventListener("click",async()=>{
  if(pendingCloudSaves>0){
    alert("⏳ กำลังบันทึกข้อมูลขึ้นคลาวด์อยู่ กรุณารอสักครู่แล้วลองซิงก์อีกครั้ง");
    return;
  }
  const btn=document.getElementById("manualSyncBtn");
  btn.disabled=true;
  btn.textContent="🔄 กำลังซิงก์...";
  const ok=await initFromFirestore();
  btn.disabled=false;
  btn.textContent="🔄 ซิงก์ข้อมูล";
  if(!ok) alert("⚠️ ซิงก์ข้อมูลไม่สำเร็จ (เชื่อมต่อคลาวด์ไม่ได้)\n\nยังใช้ข้อมูลในเครื่องนี้อยู่ ลองใหม่อีกครั้งภายหลัง");
});

// REST-only Firestore has no realtime listener (that needs the SDK), so we
// poll instead: refetch periodically and re-render if the page has been
// open a while, so a change made on another device shows up here without
// needing a manual reload. Skipped while any dialog is open (still filling
// in a form), while a save is still in flight (see pendingCloudSaves
// above), or before the admin has actually logged in — otherwise this
// fires every 20s on the bare login screen, and a stuck failedSaves retry
// (see retryFailedSaves inside initFromFirestore) rejects with no auth and
// pops a blocking alert() right on top of the password field, over and
// over, making it impossible to type.
const FIRESTORE_POLL_MS=20000;
setInterval(()=>{
  if(!fbIsLoggedIn()) return;
  if(document.querySelector("dialog[open]")) return;
  if(pendingCloudSaves>0) return;
  initFromFirestore();
},FIRESTORE_POLL_MS);
