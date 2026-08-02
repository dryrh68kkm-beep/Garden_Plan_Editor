const canvas=document.getElementById("gardenCanvas"),ctx=canvas.getContext("2d");
let objects=[],selected=null,currentTool="select",drawing=null,history=[],redoStack=[];
let garden={width:6,height:4,scale:50,grid:true,snap:true,pixelsPerMeter:100};

const $=id=>document.getElementById(id);
const colors={planting:"#dcedc8",lawn:"#a5d66a",path:"#bdbdbd",deck:"#a67c52",pond:"#80deea",light:"#ffd54f"};
const toolNames={select:"เลือก/ย้าย",planting:"แปลงปลูก",lawn:"สนามหญ้า",path:"ทางเดิน",deck:"พื้นไม้",pond:"บ่อน้ำ",light:"ไฟสนาม",text:"ข้อความ"};

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

$("applySizeBtn").onclick=()=>{snapshot();resizeCanvas()};$("gridToggle").onchange=()=>{garden.grid=$("gridToggle").checked;draw()};$("snapToggle").onchange=()=>garden.snap=$("snapToggle").checked;
$("plantSearch").oninput=renderPlantList;$("plantCategory").onchange=renderPlantList;
$("duplicateBtn").onclick=duplicate;$("deleteBtn").onclick=del;$("frontBtn").onclick=()=>moveLayer(true);$("backBtn").onclick=()=>moveLayer(false);$("undoBtn").onclick=undo;$("redoBtn").onclick=redo;
$("saveBtn").onclick=saveJSON;$("loadBtn").onclick=()=>$("fileInput").click();$("fileInput").onchange=e=>e.target.files[0]&&loadJSON(e.target.files[0]);$("exportBtn").onclick=exportPNG;
$("refreshBoqBtn").onclick=updateBOQ;$("csvBtn").onclick=exportCSV;$("newBtn").onclick=()=>{if(confirm("สร้างแบบใหม่และล้างข้อมูลเดิม?")){snapshot();objects=[];selected=null;updateAll()}};

const cats=[...new Set(PLANTS.map(p=>p.category))].sort();cats.forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;$("plantCategory").appendChild(o)});
setTool("select");resizeCanvas();renderPlantList();updateAll();