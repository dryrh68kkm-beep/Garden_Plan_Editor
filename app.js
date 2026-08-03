const STORAGE = {
  plantOverrides: "garden_plant_overrides_v1",
  styleOverrides: "garden_style_overrides_v1",
  customPlants: "garden_custom_plants_v1"
};

// gardenStyles is defined in data/garden-styles-data.js, loaded via a <script> tag before this file.

let plants = [];
let selectedPlantId = "";

let plantOverrides = load(STORAGE.plantOverrides, {});
let styleOverrides = load(STORAGE.styleOverrides, {});

// The 300-item catalog from data/plants.json (read-only) plus plants the
// admin adds themselves, stored fully in Firestore ("customPlants") since
// there's no server to write back into the static JSON file.
let basePlants = [];
let customPlants = load(STORAGE.customPlants, []);
function rebuildPlantsList(){
  plants = [...basePlants, ...customPlants];
  fillPlantFilters();
}

async function savePlantOverrides(id){
  localStorage.setItem(STORAGE.plantOverrides, JSON.stringify(plantOverrides));
  if(id) await cloudSave(()=>fbSet("plantOverrides",id,plantOverrides[id]),"ข้อมูลต้นไม้");
}
async function saveCustomPlant(plant){
  localStorage.setItem(STORAGE.customPlants, JSON.stringify(customPlants));
  await cloudSave(()=>fbSet("customPlants",plant.id,plant),"ต้นไม้ที่เพิ่มเอง");
}
async function deleteCustomPlant(id){
  if(!confirm("ลบต้นไม้ที่เพิ่มเองรายการนี้หรือไม่?")) return;
  customPlants=customPlants.filter(p=>p.id!==id);
  rebuildPlantsList();
  resetPlantPaging();
  localStorage.setItem(STORAGE.customPlants, JSON.stringify(customPlants));
  document.getElementById("plantAddDialog").close();
  await cloudSave(()=>fbDelete("customPlants",id),"การลบต้นไม้ที่เพิ่มเอง");
}
function getPlant(id){
  const p=plants.find(x=>x.id===id);
  return p ? {...p, ...plantOverrides[id]} : null;
}
async function saveStyleOverrides(id){
  localStorage.setItem(STORAGE.styleOverrides, JSON.stringify(styleOverrides));
  if(id) await cloudSave(()=>fbSet("styleOverrides",id,styleOverrides[id]),"ข้อมูลแบบสวน");
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

function load(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function uid(prefix){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }
function money(v){ return new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(Number(v)||0); }
function esc(s=""){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function styleName(id){ return gardenStyles.find(s=>s.id===id)?.name || "-"; }

document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.page)));
function showPage(name){
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.page===name));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(`${name}Page`).classList.add("active");
}
document.querySelectorAll(".close-dialog").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));

document.getElementById("resetAllBtn").onclick=()=>{
  if(confirm("ต้องการล้างข้อมูลแบบสวน ต้นไม้ที่เพิ่มเอง และรูปภาพที่แนบทั้งหมดหรือไม่?")){
    plantOverrides={};styleOverrides={};customPlants=[];
    Object.values(STORAGE).forEach(k=>localStorage.removeItem(k));
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
}
let selectedStyleId="";
document.getElementById("styleSearch").addEventListener("input",renderStyles);
document.getElementById("styleCategoryFilter").addEventListener("change",renderStyles);

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
function linkedPlantsHtml(plantIds,onClickFn){
  if(!plantIds||!plantIds.length) return '<div class="meta">ยังไม่ได้เลือกต้นไม้สำหรับสวนนี้</div>';
  return plantIds.map(id=>{
    const p=getPlant(id);
    if(!p) return "";
    return `<div class="linked-plant-tile" onclick="${onClickFn}('${p.id}')">
      <div class="linked-plant-thumb">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.thaiName)}" loading="lazy"/>`:"🌱"}</div>
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
  styleOverrides[id]=override;
  renderStyles();
  const btn=e.target.querySelector("button.btn-primary");
  const originalLabel=btn.textContent;
  btn.disabled=true; btn.textContent="กำลังบันทึกขึ้นคลาวด์...";
  await saveStyleOverrides(id);
  btn.disabled=false; btn.textContent=originalLabel;
  document.getElementById("styleEditDialog").close();
});
document.getElementById("editStyleBtn").addEventListener("click",()=>{
  document.getElementById("styleDetailDialog").close();
  openStyleEdit(selectedStyleId);
});

async function loadPlantDatabase(){
  const counter=document.getElementById("plantCount");
  if(counter) counter.textContent="กำลังโหลดฐานข้อมูล...";
  try{
    const response=await fetch("./data/plants.json",{cache:"no-store"});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!Array.isArray(data)) throw new Error("รูปแบบฐานข้อมูลไม่ถูกต้อง");
    basePlants=data;
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
}

const PLANT_PAGE_SIZE=24;
let plantVisibleCount=PLANT_PAGE_SIZE;
function resetPlantPaging(){
  plantVisibleCount=PLANT_PAGE_SIZE;
  renderPlants();
}
function renderPlants(){
  const q=(document.getElementById("plantSearch")?.value||"").toLowerCase();
  const category=document.getElementById("plantCategoryFilter")?.value||"";
  const light=document.getElementById("plantLightFilter")?.value||"";
  const rows=mergedPlants().filter(p=>{
    const hay=[p.id,p.thaiName,p.englishName,p.scientificName,p.category,p.light].join(" ").toLowerCase();
    return hay.includes(q)&&(!category||p.category===category)&&(!light||p.light===light);
  }).sort((a,b)=>(b.bestSeller?1:0)-(a.bestSeller?1:0));
  const visibleRows=rows.slice(0,plantVisibleCount);
  document.getElementById("plantCount").textContent=`แสดง ${visibleRows.length} จาก ${rows.length} รายการ (ทั้งหมด ${plants.length})`;
  document.getElementById("plantList").innerHTML=visibleRows.length?visibleRows.map(p=>`
    <article class="plant-card">
      <div class="plant-thumb">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.thaiName)}" loading="lazy" />`:"🌱"}${p.bestSeller?'<span class="best-seller-badge">🔥 ขายดี</span>':""}</div>
      <div class="plant-code">${esc(p.id)} · ${esc(p.category)}${p.custom?' · <span class="chip">เพิ่มเอง</span>':""}</div>
      <h3>${esc(p.thaiName)}</h3>
      <div>${esc(p.englishName||"-")}</div>
      <div class="plant-scientific">${esc(p.scientificName||"")}</div>
      <div class="chips">
        <span class="chip">${esc(p.light)}</span>
        <span class="chip">น้ำ ${esc(p.water)}</span>
        <span class="chip">ดูแล ${esc(p.maintenance)}</span>
      </div>
      <div class="plant-price-row">
        <div><span>ต้นทุน</span><strong>${money(p.costPrice)}</strong></div>
        <div><span>ราคาขาย</span><strong>${money(p.salePrice)}</strong></div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" onclick="openPlantDetail('${p.id}')">ดูรายละเอียด</button>
        <button class="small-btn" onclick="openPlantEdit('${p.id}')">แก้ไข</button>
      </div>
    </article>`).join(""):'<div class="empty">ไม่พบต้นไม้ที่ค้นหา</div>';
  const loadMoreBtn=document.getElementById("loadMorePlantsBtn");
  const remaining=rows.length-visibleRows.length;
  if(remaining>0){
    loadMoreBtn.textContent=`โหลดเพิ่ม (เหลืออีก ${remaining} รายการ)`;
    loadMoreBtn.style.display="inline-flex";
  } else {
    loadMoreBtn.style.display="none";
  }
}

function openPlantDetail(id){
  const p=getPlant(id);
  if(!p) return;
  selectedPlantId=id;
  document.getElementById("plantDetailCode").textContent=p.id+" · "+(p.englishName||"");
  document.getElementById("plantDetailName").textContent=p.thaiName;
  document.getElementById("plantDetailScientific").textContent=p.scientificName||"-";
  document.getElementById("plantDetailCategory").textContent=p.category||"-";
  document.getElementById("plantDetailLight").textContent=p.light||"-";
  document.getElementById("plantDetailWater").textContent=p.water||"-";
  document.getElementById("plantDetailMaintenance").textContent=p.maintenance||"-";
  document.getElementById("plantDetailHeight").textContent=(p.heightCm||0)+" ซม.";
  document.getElementById("plantDetailSpacing").textContent=(p.spacingCm||0)+" ซม.";
  document.getElementById("plantDetailCost").textContent=money(p.costPrice)+" / "+p.unit;
  document.getElementById("plantDetailPrice").textContent=money(p.salePrice)+" / "+p.unit;
  document.getElementById("plantDetailStyles").innerHTML=(p.styles||[]).map(id=>`<span class="chip">${esc(styleName(id))}</span>`).join("");
  const icon=document.getElementById("plantDetailIcon");
  if(p.image){ icon.style.backgroundImage=`url('${p.image}')`; icon.textContent=""; }
  else{ icon.style.backgroundImage=""; icon.textContent="🌱"; }
  document.getElementById("plantDetailDialog").showModal();
}

document.getElementById("plantSearch").addEventListener("input",resetPlantPaging);
document.getElementById("plantCategoryFilter").addEventListener("change",resetPlantPaging);
document.getElementById("plantLightFilter").addEventListener("change",resetPlantPaging);
document.getElementById("reloadPlantDbBtn").addEventListener("click",loadPlantDatabase);
document.getElementById("loadMorePlantsBtn").addEventListener("click",()=>{
  plantVisibleCount+=PLANT_PAGE_SIZE;
  renderPlants();
});

let plantEditImageData;
function resizeImageToDataURL(file,targetDim=800,maxBytes=250*1024){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error);
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error("โหลดรูปภาพไม่สำเร็จ"));
      img.onload=()=>{
        // Crop to a centered square, then scale to the target cover size.
        const side=Math.min(img.width,img.height);
        const sx=(img.width-side)/2, sy=(img.height-side)/2;
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
        resolve(dataUrl);
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function openPlantEdit(id){
  const p=getPlant(id);
  if(!p) return;
  if(p.custom){ openCustomPlantEdit(id); return; }
  document.getElementById("plantEditId").value=id;
  document.getElementById("plantEditTitle").textContent=`แก้ไข: ${p.thaiName}`;
  document.getElementById("plantEditCost").value=p.costPrice||0;
  document.getElementById("plantEditPrice").value=p.salePrice||0;
  document.getElementById("plantEditBestSeller").checked=!!p.bestSeller;
  document.getElementById("plantEditImage").value="";
  plantEditImageData=p.image||"";
  const preview=document.getElementById("plantEditPreview");
  const wrap=document.getElementById("plantEditPreviewWrap");
  if(plantEditImageData){ preview.src=plantEditImageData; wrap.style.display="flex"; }
  else{ preview.src=""; wrap.style.display="none"; }
  document.getElementById("plantEditDialog").showModal();
}
document.getElementById("plantEditImage").addEventListener("change",async e=>{
  const file=e.target.files[0];
  if(!file) return;
  try{
    plantEditImageData=await resizeImageToDataURL(file);
    const preview=document.getElementById("plantEditPreview");
    preview.src=plantEditImageData;
    document.getElementById("plantEditPreviewWrap").style.display="flex";
  }catch{
    alert("ไม่สามารถอ่านไฟล์รูปภาพนี้ได้");
  }
});
document.getElementById("plantEditRemoveImageBtn").addEventListener("click",()=>{
  plantEditImageData="";
  document.getElementById("plantEditImage").value="";
  document.getElementById("plantEditPreview").src="";
  document.getElementById("plantEditPreviewWrap").style.display="none";
});
document.getElementById("plantEditForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const id=document.getElementById("plantEditId").value;
  const override={
    costPrice:Number(document.getElementById("plantEditCost").value)||0,
    salePrice:Number(document.getElementById("plantEditPrice").value)||0,
    bestSeller:document.getElementById("plantEditBestSeller").checked
  };
  if(plantEditImageData) override.image=plantEditImageData;
  plantOverrides[id]=override;
  renderPlants();
  const btn=e.target.querySelector("button.btn-primary");
  const originalLabel=btn.textContent;
  btn.disabled=true; btn.textContent="กำลังบันทึกขึ้นคลาวด์...";
  await savePlantOverrides(id);
  btn.disabled=false; btn.textContent=originalLabel;
  document.getElementById("plantEditDialog").close();
});
document.getElementById("editPlantBtn").addEventListener("click",()=>{
  document.getElementById("plantDetailDialog").close();
  openPlantEdit(selectedPlantId);
});

// ---- Custom plants (added by the admin, not part of the 300-item catalog) ----
let plantAddImageData="";
function fillPlantAddCategoryOptions(){
  const categories=[...new Set(plants.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"th"));
  document.getElementById("plantAddCategoryOptions").innerHTML=categories.map(x=>`<option value="${esc(x)}"></option>`).join("");
}
function openCustomPlantAdd(){
  fillPlantAddCategoryOptions();
  document.getElementById("plantAddId").value="";
  document.getElementById("plantAddTitle").textContent="เพิ่มต้นไม้ใหม่";
  document.getElementById("plantAddThaiName").value="";
  document.getElementById("plantAddEnglishName").value="";
  document.getElementById("plantAddScientificName").value="";
  document.getElementById("plantAddCategory").value="";
  document.getElementById("plantAddLight").value="";
  document.getElementById("plantAddWater").value="";
  document.getElementById("plantAddMaintenance").value="";
  document.getElementById("plantAddUnit").value="ต้น";
  document.getElementById("plantAddCost").value=0;
  document.getElementById("plantAddPrice").value=0;
  document.getElementById("plantAddBestSeller").checked=false;
  document.getElementById("plantAddImage").value="";
  plantAddImageData="";
  document.getElementById("plantAddPreview").src="";
  document.getElementById("plantAddPreviewWrap").style.display="none";
  document.getElementById("plantAddDeleteBtn").style.display="none";
  document.getElementById("plantAddDialog").showModal();
}
function openCustomPlantEdit(id){
  const p=customPlants.find(x=>x.id===id);
  if(!p) return;
  fillPlantAddCategoryOptions();
  document.getElementById("plantAddId").value=p.id;
  document.getElementById("plantAddTitle").textContent=`แก้ไข: ${p.thaiName}`;
  document.getElementById("plantAddThaiName").value=p.thaiName||"";
  document.getElementById("plantAddEnglishName").value=p.englishName||"";
  document.getElementById("plantAddScientificName").value=p.scientificName||"";
  document.getElementById("plantAddCategory").value=p.category||"";
  document.getElementById("plantAddLight").value=p.light||"";
  document.getElementById("plantAddWater").value=p.water||"";
  document.getElementById("plantAddMaintenance").value=p.maintenance||"";
  document.getElementById("plantAddUnit").value=p.unit||"ต้น";
  document.getElementById("plantAddCost").value=p.costPrice||0;
  document.getElementById("plantAddPrice").value=p.salePrice||0;
  document.getElementById("plantAddBestSeller").checked=!!p.bestSeller;
  document.getElementById("plantAddImage").value="";
  plantAddImageData=p.image||"";
  const preview=document.getElementById("plantAddPreview");
  const wrap=document.getElementById("plantAddPreviewWrap");
  if(plantAddImageData){ preview.src=plantAddImageData; wrap.style.display="flex"; }
  else{ preview.src=""; wrap.style.display="none"; }
  document.getElementById("plantAddDeleteBtn").style.display="inline-flex";
  document.getElementById("plantAddDialog").showModal();
}
document.getElementById("addCustomPlantBtn").addEventListener("click",openCustomPlantAdd);
document.getElementById("plantAddImage").addEventListener("change",async e=>{
  const file=e.target.files[0];
  if(!file) return;
  try{
    plantAddImageData=await resizeImageToDataURL(file);
    document.getElementById("plantAddPreview").src=plantAddImageData;
    document.getElementById("plantAddPreviewWrap").style.display="flex";
  }catch{
    alert("ไม่สามารถอ่านไฟล์รูปภาพนี้ได้");
  }
});
document.getElementById("plantAddRemoveImageBtn").addEventListener("click",()=>{
  plantAddImageData="";
  document.getElementById("plantAddImage").value="";
  document.getElementById("plantAddPreview").src="";
  document.getElementById("plantAddPreviewWrap").style.display="none";
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
  const plant={
    id, custom:true,
    thaiName,
    englishName:document.getElementById("plantAddEnglishName").value.trim(),
    scientificName:document.getElementById("plantAddScientificName").value.trim(),
    category:document.getElementById("plantAddCategory").value.trim(),
    light:document.getElementById("plantAddLight").value,
    water:document.getElementById("plantAddWater").value,
    maintenance:document.getElementById("plantAddMaintenance").value,
    unit:document.getElementById("plantAddUnit").value.trim()||"ต้น",
    costPrice:Number(document.getElementById("plantAddCost").value)||0,
    salePrice:Number(document.getElementById("plantAddPrice").value)||0,
    bestSeller:document.getElementById("plantAddBestSeller").checked,
    image:plantAddImageData||""
  };
  customPlants=existingId
    ? customPlants.map(p=>p.id===id?plant:p)
    : [...customPlants, plant];
  rebuildPlantsList();
  resetPlantPaging();
  const btn=e.target.querySelector("button.btn-primary");
  const originalLabel=btn.textContent;
  btn.disabled=true; btn.textContent="กำลังบันทึกขึ้นคลาวด์...";
  await saveCustomPlant(plant);
  btn.disabled=false; btn.textContent=originalLabel;
  document.getElementById("plantAddDialog").close();
});

function renderAll(){renderStyles();}
renderAll();
loadPlantDatabase();

function setCloudStatus(ok){
  const el=document.getElementById("cloudStatus");
  if(!el) return;
  el.textContent=ok?"☁️ ซิงก์ข้อมูลแล้ว":"📴 ออฟไลน์ (ใช้ข้อมูลในเครื่อง)";
  el.style.color=ok?"var(--primary)":"var(--danger)";
}
// Every save must actually wait for this before letting the user navigate
// away (e.g. close a dialog) — otherwise a quick tab switch or page nav can
// cancel the in-flight fetch and the write never reaches Firestore, even
// though localStorage already looks saved.
async function cloudSave(fn,label){
  try{
    await fn();
    setCloudStatus(true);
    return true;
  }catch(err){
    console.error("Firestore save failed, staying on local data:",err);
    setCloudStatus(false);
    // A quiet status badge is easy to miss — for saves that matter (a photo,
    // a customer record) the user needs an unmissable signal that it only
    // saved on this device, not the cloud, or they'll assume it's safe and
    // the next background sync will silently overwrite it with the old
    // (unsaved) cloud state — exactly what happened with a lost plant photo.
    // Show the actual error text too — a generic "connection failed" message
    // looks the same whether it's really the network, a permissions issue,
    // or a bug, and there's no devtools console to check on a phone.
    alert(`⚠️ บันทึก${label||"ข้อมูล"}ขึ้นคลาวด์ไม่สำเร็จ\n\nสาเหตุ: ${err.message||err}\n\nข้อมูลบันทึกไว้ในเครื่องนี้ชั่วคราวเท่านั้น กรุณาลองบันทึกซ้ำอีกครั้ง ไม่เช่นนั้นข้อมูลอาจหายไปเมื่อซิงก์ครั้งถัดไป`);
    return false;
  }
}

// On load, pull the latest data from Firestore (source of truth across
// devices) and overlay it on top of whatever localStorage already showed,
// so the page is usable instantly and then refreshes once the cloud data
// arrives. If Firestore is unreachable, silently keep using localStorage —
// the app must keep working offline.
async function initFromFirestore(){
  try{
    const [remotePlantOverrides,remoteStyleOverrides,remoteCustomPlants]=await Promise.all([
      fbList("plantOverrides"),
      fbList("styleOverrides"),
      fbList("customPlants")
    ]);
    plantOverrides={};
    remotePlantOverrides.forEach(p=>{const {id,...rest}=p;plantOverrides[id]=rest;});
    styleOverrides={};
    remoteStyleOverrides.forEach(s=>{const {id,...rest}=s;styleOverrides[id]=rest;});
    customPlants=remoteCustomPlants;
    localStorage.setItem(STORAGE.plantOverrides,JSON.stringify(plantOverrides));
    localStorage.setItem(STORAGE.styleOverrides,JSON.stringify(styleOverrides));
    localStorage.setItem(STORAGE.customPlants,JSON.stringify(customPlants));
    renderAll();
    rebuildPlantsList();
    if(plants.length) renderPlants();
    setCloudStatus(true);
    return true;
  }catch(error){
    console.error("Firestore initial sync failed, staying on local data:",error);
    setCloudStatus(false);
    return false;
  }
}
initFromFirestore();

document.getElementById("manualSyncBtn").addEventListener("click",async()=>{
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
// needing a manual reload. Skipped while any dialog is open so a background
// refresh can't blow away a form the user is actively filling in.
const FIRESTORE_POLL_MS=20000;
setInterval(()=>{
  if(document.querySelector("dialog[open]")) return;
  initFromFirestore();
},FIRESTORE_POLL_MS);
