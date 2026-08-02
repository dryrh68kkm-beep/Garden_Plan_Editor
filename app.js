const canvas=document.getElementById("gardenCanvas"),ctx=canvas.getContext("2d");
let objects=[],selected=null,currentTool="select",drawing=null,history=[],redoStack=[];
let garden={width:6,height:4,scale:50,grid:true,snap:true,pixelsPerMeter:100};

const $=id=>document.getElementById(id);
const colors={planting:"#dcedc8",lawn:"#a5d66a",path:"#bdbdbd",deck:"#a67c52",pond:"#80deea",light:"#ffd54f"};
const toolNames={select:"เลือก/ย้าย",planting:"แปลงปลูก",lawn:"สนามหญ้า",path:"ทางเดิน",deck:"พื้นไม้",pond:"บ่อน้ำ",light:"ไฟสนาม",text:"ข้อความ"};

const TEMPLATE_INFO={
  tropical:{name:"สวนทรอปิคอล",size:"6 × 4 เมตร",description:"ใบไม้ใหญ่ซ้อนชั้น มีมอนสเตอร่า กล้วย หมากเขียว เฟิร์น ทางเดิน และบ่อน้ำเล็ก"},
  minimal:{name:"สวนมินิมอลโมเดิร์น",size:"6 × 4 เมตร",description:"เส้นสายเรียบง่าย ใช้ไทรใบสัก โมกพวง ลิ้นมังกร แผ่นทางเดิน และกรวด"},
  japanese:{name:"สวนญี่ปุ่น",size:"6 × 4 เมตร",description:"จัดองค์ประกอบโล่ง มีไผ่ พุ่มไม้ หิน ทางเดิน และบ่อน้ำแบบสงบ"},
  backyard:{name:"สวนหลังบ้านพักผ่อน",size:"7 × 5 เมตร",description:"มีพื้นไม้ สนามหญ้า ทางเดิน มุมต้นไม้ และไฟสนามสำหรับใช้งานช่วงเย็น"},
  condo:{name:"สวนระเบียง/คอนโด",size:"4 × 2.5 เมตร",description:"พื้นที่กะทัดรัด มีพื้นไม้ กระถางไม้ใบ ลิ้นมังกร และมุมนั่งเล่น"},
  pool:{name:"สวนริมสระ",size:"8 × 5 เมตร",description:"มีสระน้ำ ทางเดิน ไฟสนาม ปาล์ม และไม้พุ่มที่ดูแลง่าย"}
};

function plantData(id){return PLANTS.find(p=>p.id===id)}
function rectObj(type,x,y,w,h,name,price){
  return {id:Date.now()+Math.random(),type,x:x*garden.pixelsPerMeter,y:y*garden.pixelsPerMeter,w:w*garden.pixelsPerMeter,h:h*garden.pixelsPerMeter,color:colors[type],name:name||toolNames[type],price:price||0,unit:"ตร.ม."};
}
function plantObj(id,x,y,rScale=1){
  const p=plantData(id); if(!p)return null;
  return {id:Date.now()+Math.random(),type:"plant",plantId:p.id,name:p.name,category:p.category,price:p.price,unit:p.unit,color:p.color,x:x*garden.pixelsPerMeter,y:y*garden.pixelsPerMeter,r:p.radius*rScale*garden.pixelsPerMeter};
}
function lightObj(x,y){return {id:Date.now()+Math.random(),type:"light",x:x*garden.pixelsPerMeter,y:y*garden.pixelsPerMeter,name:"ไฟสนาม",price:650,unit:"ดวง"}}

function buildTemplate(key){
  const templates={
    tropical:()=>[
      rectObj("lawn",0.4,0.4,5.2,3.2,"สนามหญ้า"),
      rectObj("path",2.55,0.3,0.9,3.4,"ทางเดินหิน"),
      rectObj("pond",4.35,2.35,1.0,0.9,"บ่อน้ำเล็ก"),
      plantObj("P002",0.9,0.9),plantObj("P003",1.7,0.8),plantObj("P004",4.9,0.85,.8),
      plantObj("P001",0.95,2.7),plantObj("P001",1.7,2.9,.8),plantObj("P008",4.7,3.25),
      plantObj("P005",3.8,0.9,.8),plantObj("P006",3.85,3.2,.8),
      lightObj(2.2,1.0),lightObj(3.8,2.0),lightObj(2.2,3.0)
    ],
    minimal:()=>[
      rectObj("planting",0.35,0.35,1.35,3.3,"แปลงปลูกแนวตั้ง"),
      rectObj("lawn",1.85,0.35,3.75,3.3,"สนามหญ้า"),
      rectObj("path",2.15,2.75,3.15,.65,"แผ่นทางเดิน"),
      plantObj("P004",1.0,1.0,.8),plantObj("P005",1.0,2.05,.7),plantObj("P006",1.0,3.05,.7),
      plantObj("P007",4.85,.95),plantObj("P006",4.8,2.0,.75),plantObj("P005",4.8,3.15,.65),
      lightObj(2.3,1.0),lightObj(3.5,1.0),lightObj(4.6,1.0)
    ],
    japanese:()=>[
      rectObj("lawn",0.4,0.4,5.2,3.2,"ลานมอส/หญ้า"),
      rectObj("path",0.65,2.7,4.7,.55,"ทางเดินหิน"),
      rectObj("pond",3.75,.55,1.45,1.15,"บ่อน้ำ"),
      plantObj("P009",.9,.9,.8),plantObj("P009",1.5,1.0,.7),plantObj("P005",2.45,.95,.6),
      plantObj("P008",4.9,2.25,.8),plantObj("P006",2.0,2.3,.6),
      lightObj(1.0,3.35),lightObj(3.0,3.35),lightObj(5.0,3.35)
    ],
    backyard:()=>[
      rectObj("deck",0.25,0.25,2.2,4.5,"พื้นไม้พักผ่อน"),
      rectObj("lawn",2.65,.35,4.0,4.3,"สนามหญ้า"),
      rectObj("path",2.4,2.1,4.2,.65,"ทางเดิน"),
      rectObj("planting",5.75,.35,.85,4.3,"แปลงปลูกริมรั้ว"),
      plantObj("P004",6.15,.9,.75),plantObj("P003",6.15,2.1,.75),plantObj("P002",6.1,3.65,.75),
      plantObj("P001",3.2,.85,.8),plantObj("P008",4.4,4.2,.7),
      lightObj(2.75,1.55),lightObj(4.2,1.55),lightObj(5.45,1.55)
    ],
    condo:()=>[
      rectObj("deck",0.15,.15,3.7,2.2,"พื้นไม้ระเบียง"),
      rectObj("planting",.2,.2,.65,2.1,"กระบะปลูก"),
      plantObj("P006",.55,.55,.65),plantObj("P006",.55,1.25,.65),plantObj("P006",.55,1.95,.65),
      plantObj("P001",3.25,.6,.65),plantObj("P008",3.25,1.7,.65),
      lightObj(1.4,2.0),lightObj(2.5,2.0)
    ],
    pool:()=>[
      rectObj("pond",1.2,.65,5.6,3.1,"สระน้ำ"),
      rectObj("deck",.25,.25,7.5,.4,"ทางเดินรอบสระ"),
      rectObj("deck",.25,4.05,7.5,.55,"ชานพัก"),
      plantObj("P003",.65,.9,.75),plantObj("P003",.65,2.3,.75),plantObj("P003",.65,3.65,.75),
      plantObj("P007",7.35,.9,.7),plantObj("P005",7.35,2.2,.65),plantObj("P007",7.35,3.55,.7),
      lightObj(1.15,4.35),lightObj(3.0,4.35),lightObj(5.0,4.35),lightObj(6.85,4.35)
    ]
  };
  return templates[key]?templates[key]().filter(Boolean):[];
}

function loadTemplate(key){
  if(!key||!TEMPLATE_INFO[key]){alert("กรุณาเลือกแบบสวน");return}
  if(objects.length&&!confirm("การโหลดแบบสำเร็จรูปจะล้างวัตถุในผังปัจจุบัน ต้องการดำเนินการต่อหรือไม่?"))return;
  snapshot();
  const sizes={tropical:[6,4],minimal:[6,4],japanese:[6,4],backyard:[7,5],condo:[4,2.5],pool:[8,5]};
  garden.width=sizes[key][0];garden.height=sizes[key][1];
  $("gardenWidth").value=garden.width;$("gardenHeight").value=garden.height;
  resizeCanvas();
  objects=buildTemplate(key);
  selected=null;
  updateAll();
}
function clearAllObjects(){
  if(!objects.length)return;
  if(confirm("ล้างต้นไม้ วัสดุ และวัตถุทั้งหมดออกจากผังใช่หรือไม่?")){
    snapshot();objects=[];selected=null;updateAll();
  }
}


function resizeCanvas(){
  garden.width=+$("gardenWidth").value||6; garden.height=+$("gardenHeight").value||4;
  garden.scale=+$("scaleSelect").value||50;
  garden.grid=$("gridToggle").checked; garden.snap=$("snapToggle").checked;
  const maxW=1100,maxH=760;
  garden.pixelsPerMeter=Math.min(maxW/garden.width,maxH/garden.height);
  canvas.width=Math.round(garden.width*garden.pixelsPerMeter);
  canvas.height=Math.round(garden.height*garden.pixelsPerMeter);
  $("areaInfo").textContent=`พื้นที่ ${(garden.width*garden.height).toFixed(2)} ตร.ม.`;
  draw();
}
function snapshot(){history.push(JSON.stringify({objects,garden}));if(history.length>50)history.shift();redoStack=[]}
function undo(){if(!history.length)return;redoStack.push(JSON.stringify({objects,garden}));const s=JSON.parse(history.pop());objects=s.objects;garden=s.garden;syncControls();selected=null;draw();updateAll()}
function redo(){if(!redoStack.length)return;history.push(JSON.stringify({objects,garden}));const s=JSON.parse(redoStack.pop());objects=s.objects;garden=s.garden;syncControls();selected=null;draw();updateAll()}
function syncControls(){$("gardenWidth").value=garden.width;$("gardenHeight").value=garden.height;$("scaleSelect").value=garden.scale;$("gridToggle").checked=garden.grid;$("snapToggle").checked=garden.snap;resizeCanvas()}
function snap(v){if(!garden.snap)return v;const g=.25*garden.pixelsPerMeter;return Math.round(v/g)*g}
function pos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(canvas.width/r.width),y:(e.clientY-r.top)*(canvas.height/r.height)}}
function meter(px){return px/garden.pixelsPerMeter}
function drawGrid(){if(!garden.grid)return;ctx.save();ctx.strokeStyle="#e8ece9";ctx.lineWidth=1;const step=.25*garden.pixelsPerMeter;for(let x=0;x<=canvas.width;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}for(let y=0;y<=canvas.height;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}ctx.strokeStyle="#cfd8d2";ctx.lineWidth=1.5;const major=garden.pixelsPerMeter;for(let x=0;x<=canvas.width;x+=major){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}for(let y=0;y<=canvas.height;y+=major){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}ctx.restore()}
function drawObject(o){
  ctx.save();
  if(o.type==="plant"){
    ctx.fillStyle=o.color;ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle="#173f2a";ctx.font="12px sans-serif";ctx.textAlign="center";ctx.fillText(o.name,o.x,o.y+o.r+14);
  }else if(o.type==="light"){
    ctx.fillStyle=colors.light;ctx.beginPath();ctx.arc(o.x,o.y,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#8d6e00";ctx.stroke();
  }else if(o.type==="text"){
    ctx.fillStyle=o.color||"#1f2937";ctx.font=`${o.size||18}px sans-serif`;ctx.fillText(o.text,o.x,o.y);
  }else{
    ctx.fillStyle=o.color||colors[o.type]||"#ddd";ctx.globalAlpha=.75;ctx.fillRect(o.x,o.y,o.w,o.h);ctx.globalAlpha=1;ctx.strokeStyle="#546e5d";ctx.strokeRect(o.x,o.y,o.w,o.h);
  }
  if(selected&&selected.id===o.id){
    ctx.strokeStyle="#d4a017";ctx.lineWidth=3;ctx.setLineDash([6,4]);
    if(o.type==="plant")ctx.strokeRect(o.x-o.r-5,o.y-o.r-5,o.r*2+10,o.r*2+10);
    else if(o.type==="light")ctx.strokeRect(o.x-15,o.y-15,30,30);
    else if(o.type==="text")ctx.strokeRect(o.x-3,o.y-(o.size||18),ctx.measureText(o.text).width+6,(o.size||18)+6);
    else ctx.strokeRect(o.x-4,o.y-4,o.w+8,o.h+8);
  }
  ctx.restore();
}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);drawGrid();objects.forEach(drawObject);if(drawing)drawObject(drawing)}
function hit(o,x,y){
  if(o.type==="plant")return Math.hypot(x-o.x,y-o.y)<=o.r;
  if(o.type==="light")return Math.hypot(x-o.x,y-o.y)<=15;
  if(o.type==="text"){ctx.font=`${o.size||18}px sans-serif`;return x>=o.x&&x<=o.x+ctx.measureText(o.text).width&&y<=o.y&&y>=o.y-(o.size||18)}
  return x>=o.x&&x<=o.x+o.w&&y>=o.y&&y<=o.y+o.h;
}
function selectAt(x,y){selected=null;for(let i=objects.length-1;i>=0;i--)if(hit(objects[i],x,y)){selected=objects[i];break}renderProperties();renderLayers();draw()}
let dragging=false,dragOffset={x:0,y:0};
canvas.addEventListener("pointerdown",e=>{
  const p=pos(e);
  if(currentTool==="select"){
    selectAt(p.x,p.y);
    if(selected){dragging=true;dragOffset={x:p.x-selected.x,y:p.y-selected.y};snapshot()}
  }else if(["planting","lawn","path","deck","pond"].includes(currentTool)){
    snapshot();drawing={id:Date.now(),type:currentTool,x:snap(p.x),y:snap(p.y),w:0,h:0,color:colors[currentTool]};dragging=true;
  }else if(currentTool==="light"){snapshot();objects.push({id:Date.now(),type:"light",x:snap(p.x),y:snap(p.y),name:"ไฟสนาม",price:650,unit:"ดวง"});updateAll()}
  else if(currentTool==="text"){const t=prompt("ข้อความบนผัง","ชื่อพื้นที่");if(t){snapshot();objects.push({id:Date.now(),type:"text",x:p.x,y:p.y,text:t,size:18,color:"#1f2937"});updateAll()}}
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove",e=>{
  const p=pos(e);$("cursorPos").textContent=`X: ${meter(p.x).toFixed(2)} m, Y: ${meter(p.y).toFixed(2)} m`;
  if(!dragging)return;
  if(currentTool==="select"&&selected){selected.x=snap(p.x-dragOffset.x);selected.y=snap(p.y-dragOffset.y);draw();renderProperties()}
  else if(drawing){drawing.w=snap(p.x)-drawing.x;drawing.h=snap(p.y)-drawing.y;draw()}
});
canvas.addEventListener("pointerup",e=>{
  if(drawing){if(drawing.w<0){drawing.x+=drawing.w;drawing.w=Math.abs(drawing.w)}if(drawing.h<0){drawing.y+=drawing.h;drawing.h=Math.abs(drawing.h)}if(drawing.w>5&&drawing.h>5)objects.push(drawing);drawing=null}
  dragging=false;updateAll();
});

function setTool(t){currentTool=t;document.querySelectorAll(".tool").forEach(b=>b.classList.toggle("active",b.dataset.tool===t));$("toolStatus").textContent="เครื่องมือ: "+toolNames[t]}
document.querySelectorAll(".tool").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));

function renderPlantList(){
 const q=$("plantSearch").value.toLowerCase(),cat=$("plantCategory").value;
 $("plantList").innerHTML="";
 PLANTS.filter(p=>(!q||(p.name+" "+p.id).toLowerCase().includes(q))&&(!cat||p.category===cat)).forEach(p=>{
  const d=document.createElement("div");d.className="plant-item";d.innerHTML=`<span class="swatch" style="background:${p.color}"></span><div><b>${p.name}</b><small>${p.category} • ${p.price} บาท/${p.unit}</small></div><span>＋</span>`;
  d.onclick=()=>{snapshot();objects.push({id:Date.now()+Math.random(),type:"plant",plantId:p.id,name:p.name,category:p.category,price:p.price,unit:p.unit,color:p.color,x:canvas.width/2,y:canvas.height/2,r:p.radius*garden.pixelsPerMeter});updateAll()};
  $("plantList").appendChild(d);
 });
}
function renderProperties(){
 const box=$("properties");if(!selected){box.innerHTML='<p class="muted">เลือกวัตถุเพื่อแก้ไข</p>';return}
 let h=`<label>ชื่อ<input id="propName" value="${selected.name||selected.text||selected.type}"></label><div class="prop-row"><label>X (ม.)<input id="propX" type="number" step=".1" value="${meter(selected.x).toFixed(2)}"></label><label>Y (ม.)<input id="propY" type="number" step=".1" value="${meter(selected.y).toFixed(2)}"></label></div>`;
 if(selected.type==="plant")h+=`<label>รัศมีทรงพุ่ม (ม.)<input id="propR" type="number" step=".1" value="${meter(selected.r).toFixed(2)}"></label><label>ราคาต่อหน่วย<input id="propPrice" type="number" value="${selected.price||0}"></label>`;
 else if(!["light","text"].includes(selected.type))h+=`<div class="prop-row"><label>กว้าง (ม.)<input id="propW" type="number" step=".1" value="${meter(selected.w).toFixed(2)}"></label><label>ยาว (ม.)<input id="propH" type="number" step=".1" value="${meter(selected.h).toFixed(2)}"></label></div>`;
 box.innerHTML=h;
 box.querySelectorAll("input").forEach(inp=>inp.onchange=()=>{snapshot();selected.x=(+$("propX").value||0)*garden.pixelsPerMeter;selected.y=(+$("propY").value||0)*garden.pixelsPerMeter;if($("propName")){if(selected.type==="text")selected.text=$("propName").value;else selected.name=$("propName").value}if($("propR"))selected.r=(+$("propR").value||.1)*garden.pixelsPerMeter;if($("propW"))selected.w=(+$("propW").value||.1)*garden.pixelsPerMeter;if($("propH"))selected.h=(+$("propH").value||.1)*garden.pixelsPerMeter;if($("propPrice"))selected.price=+$("propPrice").value||0;updateAll()});
}
function renderLayers(){$("layerList").innerHTML="";[...objects].reverse().forEach(o=>{const d=document.createElement("div");d.className="layer-item"+(selected&&selected.id===o.id?" selected":"");d.innerHTML=`<span>${o.name||o.text||toolNames[o.type]||o.type}</span><small>${o.type}</small>`;d.onclick=()=>{selected=o;renderProperties();renderLayers();draw()};$("layerList").appendChild(d)})}
function updateBOQ(){
 const map={};
 objects.forEach(o=>{
  if(o.type==="plant"||o.type==="light"){const key=o.plantId||o.type;map[key]??={name:o.name||"ไฟสนาม",qty:0,unit:o.unit||"ดวง",price:o.price||650};map[key].qty++}
  else if(["lawn","path","deck","planting","pond"].includes(o.type)){const area=Math.abs(o.w*o.h)/(garden.pixelsPerMeter**2);const price={lawn:120,path:450,deck:1800,planting:250,pond:2500}[o.type];const name={lawn:"สนามหญ้า",path:"ทางเดิน",deck:"พื้นไม้",planting:"แปลงปลูก",pond:"บ่อน้ำ"}[o.type];map[o.type]??={name,qty:0,unit:"ตร.ม.",price};map[o.type].qty+=area}
 });
 $("boqBody").innerHTML="";let total=0;Object.values(map).forEach(i=>{const sum=i.qty*i.price;total+=sum;const tr=document.createElement("tr");tr.innerHTML=`<td>${i.name}</td><td>${i.qty.toFixed(i.unit==="ตร.ม."?2:0)} ${i.unit}</td><td>${sum.toLocaleString("th-TH",{maximumFractionDigits:2})}</td>`;$("boqBody").appendChild(tr)});$("boqTotal").textContent=total.toLocaleString("th-TH",{maximumFractionDigits:2})+" บาท";
}
function updateAll(){draw();renderProperties();renderLayers();updateBOQ()}
function duplicate(){if(!selected)return;snapshot();const c=JSON.parse(JSON.stringify(selected));c.id=Date.now();c.x+=20;c.y+=20;objects.push(c);selected=c;updateAll()}
function del(){if(!selected)return;snapshot();objects=objects.filter(o=>o.id!==selected.id);selected=null;updateAll()}
function moveLayer(front){if(!selected)return;snapshot();objects=objects.filter(o=>o.id!==selected.id);front?objects.push(selected):objects.unshift(selected);updateAll()}
function saveJSON(){const data={version:1,garden,objects};const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="garden-plan.json";a.click()}
function loadJSON(file){const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);garden=d.garden;objects=d.objects||[];selected=null;syncControls();updateAll()}catch(e){alert("ไฟล์ไม่ถูกต้อง")}};r.readAsText(file)}
function exportPNG(){selected=null;draw();const a=document.createElement("a");a.href=canvas.toDataURL("image/png");a.download="garden-plan.png";a.click()}
function exportCSV(){
 updateBOQ();const rows=[["รายการ","จำนวน","หน่วย","ราคาต่อหน่วย","รวม"]];const map={};
 objects.forEach(o=>{if(o.type==="plant"||o.type==="light"){const k=o.plantId||o.type;map[k]??={name:o.name||"ไฟสนาม",qty:0,unit:o.unit||"ดวง",price:o.price||650};map[k].qty++}else if(["lawn","path","deck","planting","pond"].includes(o.type)){const area=Math.abs(o.w*o.h)/(garden.pixelsPerMeter**2),price={lawn:120,path:450,deck:1800,planting:250,pond:2500}[o.type],name={lawn:"สนามหญ้า",path:"ทางเดิน",deck:"พื้นไม้",planting:"แปลงปลูก",pond:"บ่อน้ำ"}[o.type];map[o.type]??={name,qty:0,unit:"ตร.ม.",price};map[o.type].qty+=area}});
 Object.values(map).forEach(i=>rows.push([i.name,i.qty.toFixed(2),i.unit,i.price,(i.qty*i.price).toFixed(2)]));
 const csv="\ufeff"+rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="garden-boq.csv";a.click();
}

$("templateSelect").onchange=()=>{
  const key=$("templateSelect").value,info=TEMPLATE_INFO[key];
  $("templatePreview").innerHTML=info?`<strong>${info.name}</strong><small>ขนาด ${info.size}<br>${info.description}</small>`:"<strong>เลือกแบบเพื่อดูรายละเอียด</strong><small>สามารถโหลดแล้วแก้ไข ย้ายต้นไม้ หรือเพิ่มรายการได้</small>";
};
$("loadTemplateBtn").onclick=() => loadTemplate($("templateSelect").value);
$("clearBtn").onclick=clearAllObjects;
$("clearObjectsBtn").onclick=clearAllObjects;
$("applySizeBtn").onclick=()=>{snapshot();resizeCanvas()};$("gridToggle").onchange=()=>{garden.grid=$("gridToggle").checked;draw()};$("snapToggle").onchange=()=>garden.snap=$("snapToggle").checked;
$("plantSearch").oninput=renderPlantList;$("plantCategory").onchange=renderPlantList;
$("duplicateBtn").onclick=duplicate;$("deleteBtn").onclick=del;$("frontBtn").onclick=()=>moveLayer(true);$("backBtn").onclick=()=>moveLayer(false);$("undoBtn").onclick=undo;$("redoBtn").onclick=redo;
$("saveBtn").onclick=saveJSON;$("loadBtn").onclick=()=>$("fileInput").click();$("fileInput").onchange=e=>e.target.files[0]&&loadJSON(e.target.files[0]);$("exportBtn").onclick=exportPNG;
$("refreshBoqBtn").onclick=updateBOQ;$("csvBtn").onclick=exportCSV;$("newBtn").onclick=()=>{if(confirm("สร้างแบบใหม่และล้างข้อมูลเดิม?")){snapshot();objects=[];selected=null;updateAll()}};


let customDesigns = JSON.parse(localStorage.getItem("customGardenDesigns") || "[]");
let favorites = JSON.parse(localStorage.getItem("gardenDesignFavorites") || "[]");
let activeDesign = null;

function allDesigns(){ return [...AI_DESIGNS, ...customDesigns]; }
function isFavorite(id){ return favorites.includes(id); }
function toggleFavorite(id){
  favorites = isFavorite(id) ? favorites.filter(x=>x!==id) : [...favorites,id];
  localStorage.setItem("gardenDesignFavorites", JSON.stringify(favorites));
  renderGallery();
}
function openGallery(){
  $("galleryModal").classList.remove("hidden");
  renderGallery();
}
function closeGallery(){ $("galleryModal").classList.add("hidden"); }
function renderGallery(){
  const q = $("gallerySearch").value.toLowerCase();
  const style = $("galleryStyle").value;
  const favOnly = $("galleryFavorite").value === "favorite";
  const data = allDesigns().filter(d => {
    const hay = [d.title,d.style,d.location,d.area,d.budget,(d.plants||[]).join(" "),(d.materials||[]).join(" ")].join(" ").toLowerCase();
    return (!q || hay.includes(q)) && (!style || d.style===style) && (!favOnly || isFavorite(d.id));
  });
  $("galleryGrid").innerHTML = "";
  if(!data.length){
    $("galleryGrid").innerHTML = '<div class="detail-info-card"><h3>ไม่พบแบบสวน</h3><p>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p></div>';
    return;
  }
  data.forEach(d=>{
    const card=document.createElement("article");
    card.className="design-card";
    card.innerHTML=`
      <button class="favorite-btn ${isFavorite(d.id)?"active":""}" title="รายการโปรด">${isFavorite(d.id)?"★":"☆"}</button>
      <img src="${d.image}" alt="${d.title}">
      <div class="design-card-body">
        <span class="design-badge">${d.style}</span>
        <span class="design-badge">${d.location||"แบบสวน"}</span>
        <h3>${d.title}</h3>
        <p>${d.area||"-"} • ${d.budget||"-"}</p>
        <p>${(d.plants||[]).slice(0,4).join(" • ")}</p>
        <div class="design-card-actions">
          <button class="viewDesign">ดูรายละเอียด</button>
          ${d.template ? '<button class="useDesign">โหลดผังนี้</button>' : ''}
          ${d.custom ? '<button class="deleteDesign danger">ลบรูป</button>' : ''}
        </div>
      </div>`;
    card.querySelector(".favorite-btn").onclick=()=>toggleFavorite(d.id);
    card.querySelector(".viewDesign").onclick=()=>showDesignDetail(d.id);
    if(card.querySelector(".useDesign"))card.querySelector(".useDesign").onclick=()=>useDesignTemplate(d.id);
    if(card.querySelector(".deleteDesign"))card.querySelector(".deleteDesign").onclick=()=>deleteCustomDesign(d.id);
    $("galleryGrid").appendChild(card);
  });
}
function showDesignDetail(id){
  const d=allDesigns().find(x=>x.id===id); if(!d)return;
  activeDesign=d;
  $("detailTitle").textContent=d.title;
  $("detailImage").src=d.image;
  $("detailInfo").innerHTML=`
    <div class="detail-info-card">
      <h3>ข้อมูลแบบ</h3>
      <p><b>รหัส:</b> ${d.id}</p>
      <p><b>สไตล์:</b> ${d.style}</p>
      <p><b>พื้นที่:</b> ${d.area||"-"}</p>
      <p><b>ตำแหน่ง:</b> ${d.location||"-"}</p>
      <p><b>งบประมาณ:</b> ${d.budget||"-"}</p>
    </div>
    <div class="detail-info-card">
      <h3>พรรณไม้</h3>
      <p>${(d.plants||[]).map(x=>`<span class="design-badge">${x}</span>`).join("")||"-"}</p>
    </div>
    <div class="detail-info-card">
      <h3>วัสดุ</h3>
      <p>${(d.materials||[]).map(x=>`<span class="design-badge">${x}</span>`).join("")||"-"}</p>
    </div>
    <div class="detail-info-card">
      <h3>Prompt ที่ใช้</h3>
      <p>${d.prompt||"รูปที่ผู้ใช้อัปโหลดเอง"}</p>
      ${d.template?'<button id="detailUseBtn">โหลดผังสำเร็จรูปนี้</button>':""}
    </div>`;
  const btn=document.getElementById("detailUseBtn");
  if(btn)btn.onclick=()=>useDesignTemplate(d.id);
  $("designDetailModal").classList.remove("hidden");
}
function useDesignTemplate(id){
  const d=allDesigns().find(x=>x.id===id); if(!d||!d.template)return;
  if(objects.length&&!confirm("โหลดผังนี้และแทนที่ผังปัจจุบันใช่หรือไม่?"))return;
  $("designDetailModal").classList.add("hidden");
  closeGallery();
  $("templateSelect").value=d.template;
  loadTemplate(d.template);
}
function deleteCustomDesign(id){
  if(!confirm("ลบรูปแบบสวนนี้ออกจากคลังใช่หรือไม่?"))return;
  customDesigns=customDesigns.filter(x=>x.id!==id);
  localStorage.setItem("customGardenDesigns",JSON.stringify(customDesigns));
  favorites=favorites.filter(x=>x!==id);
  localStorage.setItem("gardenDesignFavorites",JSON.stringify(favorites));
  renderGallery();
}
function uploadCustomDesign(file){
  const reader=new FileReader();
  reader.onload=()=>{
    const title=prompt("ชื่อแบบสวน","แบบสวนของฉัน")||"แบบสวนของฉัน";
    const style=prompt("สไตล์สวน","ทรอปิคอล")||"อื่นๆ";
    const area=prompt("ขนาดพื้นที่","6 × 4 เมตร")||"-";
    const plants=(prompt("รายชื่อต้นไม้ คั่นด้วยเครื่องหมาย ,","มอนสเตอร่า, หมากเขียว")||"").split(",").map(x=>x.trim()).filter(Boolean);
    const d={id:"USER-"+Date.now(),title,style,area,location:"ผู้ใช้อัปโหลด",budget:"กรอกภายหลัง",plants,materials:[],image:reader.result,prompt:"รูปที่ผู้ใช้อัปโหลดเอง",custom:true};
    customDesigns.push(d);
    try{
      localStorage.setItem("customGardenDesigns",JSON.stringify(customDesigns));
      renderGallery();
    }catch(e){
      customDesigns.pop();
      alert("ไฟล์รูปมีขนาดใหญ่เกินพื้นที่จัดเก็บในเบราว์เซอร์ กรุณาใช้รูปขนาดเล็กลง");
    }
  };
  reader.readAsDataURL(file);
}

$("galleryBtn").onclick=openGallery;
$("closeGalleryBtn").onclick=closeGallery;
$("closeDetailBtn").onclick=()=>$("designDetailModal").classList.add("hidden");
$("gallerySearch").oninput=renderGallery;
$("galleryStyle").onchange=renderGallery;
$("galleryFavorite").onchange=renderGallery;
$("uploadDesignBtn").onclick=()=>$("designUploadInput").click();
$("designUploadInput").onchange=e=>{if(e.target.files[0])uploadCustomDesign(e.target.files[0]);e.target.value=""};
$("galleryModal").addEventListener("click",e=>{if(e.target===$("galleryModal"))closeGallery()});
$("designDetailModal").addEventListener("click",e=>{if(e.target===$("designDetailModal"))$("designDetailModal").classList.add("hidden")});

const cats=[...new Set(PLANTS.map(p=>p.category))].sort();cats.forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;$("plantCategory").appendChild(o)});
setTool("select");resizeCanvas();renderPlantList();updateAll();