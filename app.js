const STORAGE = {
  customers: "garden_customers_v1",
  projects: "garden_projects_v1",
  boq: "garden_boq_v1"
};

const gardenStyles = [
  {id:"modern-minimal",name:"โมเดิร์นมินิมอล",icon:"◻️",desc:"เส้นสายเรียบง่าย ดูสะอาด ใช้ต้นไม้น้อยชนิด",tags:["เรียบง่าย","ดูแลง่าย","บ้านสมัยใหม่"]},
  {id:"modern-tropical",name:"โมเดิร์นทรอปิคอล",icon:"🌿",desc:"ผสมความทันสมัยกับพรรณไม้เขตร้อน",tags:["ร่มรื่น","ร่วมสมัย","ยอดนิยม"]},
  {id:"tropical",name:"สวนทรอปิคอล",icon:"🌴",desc:"บรรยากาศป่าร้อนชื้น เน้นใบเขียวหลายระดับ",tags:["ร่มรื่น","ใบใหญ่","ธรรมชาติ"]},
  {id:"japanese",name:"สวนญี่ปุ่น",icon:"⛩️",desc:"สงบ สมดุล ใช้หิน น้ำ และไม้ทรงธรรมชาติ",tags:["สงบ","หิน","น้ำ"]},
  {id:"zen",name:"สวนเซน",icon:"🪨",desc:"พื้นที่พักใจ ใช้กรวด หิน และองค์ประกอบน้อยชิ้น",tags:["สมาธิ","มินิมอล","ดูแลง่าย"]},
  {id:"english",name:"สวนอังกฤษ",icon:"🌹",desc:"โรแมนติก มีไม้ดอก ทางเดิน และมุมนั่งเล่น",tags:["ไม้ดอก","คลาสสิก","โรแมนติก"]},
  {id:"bali",name:"สวนบาหลี",icon:"🗿",desc:"รีสอร์ตเขตร้อน ผสมน้ำ หิน และประติมากรรม",tags:["รีสอร์ต","น้ำตก","ทรอปิคอล"]},
  {id:"thai",name:"สวนไทยร่วมสมัย",icon:"🏡",desc:"กลิ่นอายไทยที่เข้ากับบ้านยุคใหม่",tags:["ไทย","ร่วมสมัย","ไม้หอม"]},
  {id:"forest",name:"สวนป่า",icon:"🌳",desc:"จำลองธรรมชาติให้ร่มครึ้มและเป็นระบบนิเวศ",tags:["ธรรมชาติ","ร่มเงา","หลายชั้น"]},
  {id:"rock",name:"สวนหิน",icon:"🪨",desc:"ใช้หินเป็นองค์ประกอบหลัก เหมาะพื้นที่ดูแลง่าย",tags:["ดูแลง่าย","แห้ง","ตกแต่ง"]},
  {id:"cactus",name:"สวนแคคตัส",icon:"🌵",desc:"สวนทนแล้ง ใช้แคคตัส ไม้อวบน้ำ และกรวด",tags:["ทนแล้ง","แดดจัด","ประหยัดน้ำ"]},
  {id:"small-space",name:"สวนพื้นที่ขนาดเล็ก",icon:"🪴",desc:"ออกแบบสำหรับทาวน์โฮม ระเบียง และคอร์ตยาร์ด",tags:["พื้นที่เล็ก","คุ้มพื้นที่","แนวตั้ง"]}
];

let customers = load(STORAGE.customers, []);
let projects = load(STORAGE.projects, []);
let boqItems = load(STORAGE.boq, []);
let selectedBoqProjectId = "";

function load(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save(){
  localStorage.setItem(STORAGE.customers, JSON.stringify(customers));
  localStorage.setItem(STORAGE.projects, JSON.stringify(projects));
  localStorage.setItem(STORAGE.boq, JSON.stringify(boqItems));
  renderAll();
}
function uid(prefix){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }
function money(v){ return new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(Number(v)||0); }
function esc(s=""){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function styleName(id){ return gardenStyles.find(s=>s.id===id)?.name || "-"; }
function customerName(id){ return customers.find(c=>c.id===id)?.name || "ไม่ระบุลูกค้า"; }

document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.page)));
function showPage(name){
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.page===name));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(`${name}Page`).classList.add("active");
}
document.querySelectorAll(".close-dialog").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));

document.getElementById("addCustomerBtn").onclick=()=>openCustomer();
document.getElementById("addProjectBtn").onclick=()=>openProject();
document.getElementById("quickProjectBtn").onclick=()=>{showPage("projects");openProject();};
document.getElementById("addBoqBtn").onclick=()=>{
  if(!selectedBoqProjectId){ alert("กรุณาเลือกโครงการก่อนเพิ่มรายการ BOQ"); return; }
  document.getElementById("boqForm").reset();
  document.getElementById("boqQty").value=1;
  document.getElementById("boqUnit").value="รายการ";
  document.getElementById("boqCost").value=0;
  document.getElementById("boqPrice").value=0;
  document.getElementById("boqDialog").showModal();
};
document.getElementById("printBoqBtn").onclick=()=>window.print();
document.getElementById("customerSearch").oninput=renderCustomers;
document.getElementById("projectSearch").oninput=renderProjects;
document.getElementById("projectStatusFilter").onchange=renderProjects;
document.getElementById("boqProjectSelect").onchange=e=>{selectedBoqProjectId=e.target.value;renderBoq();};
document.getElementById("resetAllBtn").onclick=()=>{
  if(confirm("ต้องการล้างข้อมูลลูกค้า โครงการ และ BOQ ทั้งหมดหรือไม่?")){
    customers=[];projects=[];boqItems=[];selectedBoqProjectId="";
    Object.values(STORAGE).forEach(k=>localStorage.removeItem(k));
    renderAll();
  }
};

function openCustomer(id=""){
  const c=customers.find(x=>x.id===id);
  document.getElementById("customerDialogTitle").textContent=c?"แก้ไขลูกค้า":"เพิ่มลูกค้า";
  document.getElementById("customerId").value=c?.id||"";
  document.getElementById("customerName").value=c?.name||"";
  document.getElementById("customerPhone").value=c?.phone||"";
  document.getElementById("customerLine").value=c?.line||"";
  document.getElementById("customerAddress").value=c?.address||"";
  document.getElementById("customerNote").value=c?.note||"";
  document.getElementById("customerDialog").showModal();
}
document.getElementById("customerForm").addEventListener("submit",e=>{
  e.preventDefault();
  const id=document.getElementById("customerId").value;
  const data={id:id||uid("cus"),name:document.getElementById("customerName").value.trim(),phone:document.getElementById("customerPhone").value.trim(),line:document.getElementById("customerLine").value.trim(),address:document.getElementById("customerAddress").value.trim(),note:document.getElementById("customerNote").value.trim()};
  if(id) customers=customers.map(c=>c.id===id?data:c); else customers.unshift(data);
  document.getElementById("customerDialog").close(); save();
});

function openProject(id=""){
  fillProjectOptions();
  const p=projects.find(x=>x.id===id);
  document.getElementById("projectDialogTitle").textContent=p?"แก้ไขโครงการ":"สร้างโครงการ";
  document.getElementById("projectId").value=p?.id||"";
  document.getElementById("projectName").value=p?.name||"";
  document.getElementById("projectCustomer").value=p?.customerId||"";
  document.getElementById("projectLocation").value=p?.location||"";
  document.getElementById("projectArea").value=p?.area||"";
  document.getElementById("projectBudget").value=p?.budget||"";
  document.getElementById("projectStyle").value=p?.styleId||gardenStyles[0].id;
  document.getElementById("projectStatus").value=p?.status||"รอประเมิน";
  document.getElementById("projectStartDate").value=p?.startDate||"";
  document.getElementById("projectNote").value=p?.note||"";
  document.getElementById("projectDialog").showModal();
}
document.getElementById("projectForm").addEventListener("submit",e=>{
  e.preventDefault();
  const id=document.getElementById("projectId").value;
  const existing=projects.find(x=>x.id===id);
  const data={id:id||uid("pro"),name:document.getElementById("projectName").value.trim(),customerId:document.getElementById("projectCustomer").value,location:document.getElementById("projectLocation").value.trim(),area:Number(document.getElementById("projectArea").value)||0,budget:Number(document.getElementById("projectBudget").value)||0,styleId:document.getElementById("projectStyle").value,status:document.getElementById("projectStatus").value,startDate:document.getElementById("projectStartDate").value,note:document.getElementById("projectNote").value.trim(),createdAt:existing?.createdAt||new Date().toISOString()};
  if(id) projects=projects.map(p=>p.id===id?data:p); else projects.unshift(data);
  document.getElementById("projectDialog").close(); save();
});

document.getElementById("boqForm").addEventListener("submit",e=>{
  e.preventDefault();
  boqItems.unshift({id:uid("boq"),projectId:selectedBoqProjectId,category:document.getElementById("boqCategory").value,item:document.getElementById("boqItem").value.trim(),qty:Number(document.getElementById("boqQty").value)||0,unit:document.getElementById("boqUnit").value.trim(),cost:Number(document.getElementById("boqCost").value)||0,price:Number(document.getElementById("boqPrice").value)||0});
  document.getElementById("boqDialog").close(); save();
});

function fillProjectOptions(){
  document.getElementById("projectCustomer").innerHTML='<option value="">ไม่ระบุลูกค้า</option>'+customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
  document.getElementById("projectStyle").innerHTML=gardenStyles.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
}
function renderDashboard(){
  document.getElementById("statCustomers").textContent=customers.length;
  document.getElementById("statProjects").textContent=projects.length;
  document.getElementById("statActive").textContent=projects.filter(p=>["กำลังออกแบบ","รอลูกค้าอนุมัติ","กำลังดำเนินงาน"].includes(p.status)).length;
  document.getElementById("statBoq").textContent=money(boqItems.reduce((s,i)=>s+i.qty*i.price,0));
  const recent=projects.slice(0,5);
  document.getElementById("recentProjects").innerHTML=recent.length?recent.map(projectCard).join(""):'<div class="empty">ยังไม่มีโครงการ กด “สร้างโครงการใหม่” เพื่อเริ่มต้น</div>';
}
function renderCustomers(){
  const q=document.getElementById("customerSearch").value.toLowerCase();
  const rows=customers.filter(c=>[c.name,c.phone,c.line].join(" ").toLowerCase().includes(q));
  document.getElementById("customerList").innerHTML=rows.length?rows.map(c=>`<article class="item-card"><h3>${esc(c.name)}</h3><div class="meta">โทร: ${esc(c.phone||"-")}<br>LINE: ${esc(c.line||"-")}<br>${esc(c.address||"")}</div><div class="actions"><button class="small-btn" onclick="openCustomer('${c.id}')">แก้ไข</button><button class="small-btn danger" onclick="deleteCustomer('${c.id}')">ลบ</button></div></article>`).join(""):'<div class="empty">ยังไม่มีข้อมูลลูกค้า</div>';
}
function projectCard(p){
  return `<article class="item-card"><span class="status">${esc(p.status)}</span><h3>${esc(p.name)}</h3><div class="meta">ลูกค้า: ${esc(customerName(p.customerId))}<br>แบบสวน: ${esc(styleName(p.styleId))}<br>พื้นที่: ${p.area||0} ตร.ม. · งบ ${money(p.budget)}</div><div class="actions"><button class="small-btn" onclick="openProject('${p.id}')">แก้ไข</button><button class="small-btn" onclick="openProjectBoq('${p.id}')">เปิด BOQ</button><button class="small-btn danger" onclick="deleteProject('${p.id}')">ลบ</button></div></article>`;
}
function renderProjects(){
  const q=document.getElementById("projectSearch").value.toLowerCase();
  const status=document.getElementById("projectStatusFilter").value;
  const rows=projects.filter(p=>(!status||p.status===status)&&[p.name,customerName(p.customerId),p.location].join(" ").toLowerCase().includes(q));
  document.getElementById("projectList").innerHTML=rows.length?rows.map(projectCard).join(""):'<div class="empty">ยังไม่มีโครงการ</div>';
}
function renderStyles(){
  document.getElementById("styleList").innerHTML=gardenStyles.map(s=>`<article class="style-card"><div class="style-cover">${s.icon}</div><div class="style-body"><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p><div class="chips">${s.tags.map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</div><div class="actions"><button class="btn btn-secondary" onclick="createFromStyle('${s.id}')">ใช้แบบนี้สร้างโครงการ</button></div></div></article>`).join("");
}
function renderBoqProjectSelect(){
  const sel=document.getElementById("boqProjectSelect");
  sel.innerHTML='<option value="">เลือกโครงการ</option>'+projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  if(selectedBoqProjectId && projects.some(p=>p.id===selectedBoqProjectId)) sel.value=selectedBoqProjectId;
  else if(!selectedBoqProjectId && projects.length){selectedBoqProjectId=projects[0].id;sel.value=selectedBoqProjectId;}
}
function renderBoq(){
  const rows=boqItems.filter(i=>i.projectId===selectedBoqProjectId);
  document.getElementById("boqTableBody").innerHTML=rows.length?rows.map(i=>`<tr><td>${esc(i.category)}</td><td>${esc(i.item)}</td><td>${i.qty}</td><td>${esc(i.unit)}</td><td>${money(i.cost)}</td><td>${money(i.price)}</td><td>${money(i.qty*i.price)}</td><td><button class="small-btn danger" onclick="deleteBoq('${i.id}')">ลบ</button></td></tr>`).join(""):'<tr><td colspan="8" class="empty">ยังไม่มีรายการ BOQ สำหรับโครงการนี้</td></tr>';
  const cost=rows.reduce((s,i)=>s+i.qty*i.cost,0), sale=rows.reduce((s,i)=>s+i.qty*i.price,0), profit=sale-cost, margin=sale?profit/sale*100:0;
  document.getElementById("boqCostTotal").textContent=money(cost);
  document.getElementById("boqSaleTotal").textContent=money(sale);
  document.getElementById("boqProfit").textContent=money(profit);
  document.getElementById("boqMargin").textContent=`${margin.toFixed(1)}%`;
}
function deleteCustomer(id){
  if(confirm("ลบลูกค้ารายนี้หรือไม่?")){customers=customers.filter(c=>c.id!==id);projects=projects.map(p=>p.customerId===id?{...p,customerId:""}:p);save();}
}
function deleteProject(id){
  if(confirm("ลบโครงการและรายการ BOQ ของโครงการนี้หรือไม่?")){projects=projects.filter(p=>p.id!==id);boqItems=boqItems.filter(i=>i.projectId!==id);if(selectedBoqProjectId===id)selectedBoqProjectId="";save();}
}
function deleteBoq(id){if(confirm("ลบรายการนี้หรือไม่?")){boqItems=boqItems.filter(i=>i.id!==id);save();}}
function openProjectBoq(id){selectedBoqProjectId=id;showPage("boq");renderBoqProjectSelect();renderBoq();}
function createFromStyle(id){showPage("projects");openProject();document.getElementById("projectStyle").value=id;}
function renderAll(){fillProjectOptions();renderDashboard();renderCustomers();renderProjects();renderStyles();renderBoqProjectSelect();renderBoq();}
renderAll();
