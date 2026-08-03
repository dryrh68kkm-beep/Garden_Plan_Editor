// Firestore + Auth via plain REST calls (fetch) — no SDK, no CDN.
// Shared between the admin app (app.js) and the public showcase (showcase.js)
// so both read/write the same backend instead of per-browser localStorage.
const FB_CONFIG = {
  apiKey: "AIzaSyDBIRpyH5Hvp-mMqs5i9LmWzk1w0toYQZw",
  projectId: "rinlada-plant-stock"
};
const FB_BASE = `https://firestore.googleapis.com/v1/projects/${FB_CONFIG.projectId}/databases/(default)/documents`;
// Technical shared account (not an end-user login) so both pages can read/write
// without anyone typing credentials. Auth is required only because Firestore
// security rules require request.auth != null; the real access control is
// those rules, not this password.
const FB_SHARED_EMAIL = "backend@rinlada-plant-stock.local";
const FB_SHARED_PASSWORD = "sSZCkeNxcoGz4kIWzNHl";

let fbIdToken = null;
let fbTokenExpiry = 0;

async function fbAutoLogin(){
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_CONFIG.apiKey}`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email:FB_SHARED_EMAIL,password:FB_SHARED_PASSWORD,returnSecureToken:true})
  });
  const data=await res.json();
  if(data.error) throw new Error(data.error.message);
  fbIdToken=data.idToken;
  fbTokenExpiry=Date.now()+50*60*1000; // refresh a bit before the real 1h expiry
  return fbIdToken;
}
let fbLoginPromise=null;
async function fbHeaders(){
  if(!fbIdToken||Date.now()>fbTokenExpiry){
    // Share one in-flight login across concurrent callers instead of each
    // of them firing its own sign-in request (Promise.all at startup calls
    // this from several requests at once).
    if(!fbLoginPromise) fbLoginPromise=fbAutoLogin().finally(()=>{fbLoginPromise=null;});
    await fbLoginPromise;
  }
  return {"Content-Type":"application/json","Authorization":"Bearer "+fbIdToken};
}

function fbToValue(v){
  if(v===null||v===undefined) return {nullValue:null};
  if(typeof v==="string") return {stringValue:v};
  if(typeof v==="boolean") return {booleanValue:v};
  if(typeof v==="number") return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(Array.isArray(v)) return {arrayValue:{values:v.map(fbToValue)}};
  if(typeof v==="object"){
    const fields={};
    for(const k in v) fields[k]=fbToValue(v[k]);
    return {mapValue:{fields}};
  }
  return {stringValue:String(v)};
}
function fbFromValue(f){
  if(!f) return null;
  if("stringValue" in f) return f.stringValue;
  if("booleanValue" in f) return f.booleanValue;
  if("integerValue" in f) return parseInt(f.integerValue,10);
  if("doubleValue" in f) return f.doubleValue;
  if("nullValue" in f) return null;
  if("arrayValue" in f) return (f.arrayValue.values||[]).map(fbFromValue);
  if("mapValue" in f){
    const o={};
    const fl=f.mapValue.fields||{};
    for(const k in fl) o[k]=fbFromValue(fl[k]);
    return o;
  }
  return null;
}
function fbDocToObj(doc){
  const o=fbFromValue({mapValue:{fields:doc.fields||{}}});
  o.id=doc.name.split("/").pop();
  return o;
}

async function fbList(col){
  let out=[], pageToken="";
  do{
    const url=`${FB_BASE}/${col}?pageSize=300`+(pageToken?`&pageToken=${pageToken}`:"");
    const res=await fetch(url,{headers:await fbHeaders()});
    const data=await res.json();
    if(data.error) throw new Error(data.error.message);
    (data.documents||[]).forEach(doc=>out.push(fbDocToObj(doc)));
    pageToken=data.nextPageToken||"";
  }while(pageToken);
  return out;
}
async function fbGet(col,id){
  const res=await fetch(`${FB_BASE}/${col}/${encodeURIComponent(id)}`,{headers:await fbHeaders()});
  if(res.status===404) return null;
  const data=await res.json();
  if(data.error) throw new Error(data.error.message);
  return fbDocToObj(data);
}
// PATCH with no updateMask replaces the whole document (and creates it if
// missing), so this doubles as both create and update — we always send the
// full current object anyway, never a partial patch.
async function fbSet(col,id,obj){
  const fields={};
  for(const k in obj) fields[k]=fbToValue(obj[k]);
  const res=await fetch(`${FB_BASE}/${col}/${encodeURIComponent(id)}`,{
    method:"PATCH",headers:await fbHeaders(),body:JSON.stringify({fields})
  });
  const data=await res.json();
  if(data.error) throw new Error(data.error.message);
  return data;
}
async function fbDelete(col,id){
  const res=await fetch(`${FB_BASE}/${col}/${encodeURIComponent(id)}`,{method:"DELETE",headers:await fbHeaders()});
  return res.ok;
}
