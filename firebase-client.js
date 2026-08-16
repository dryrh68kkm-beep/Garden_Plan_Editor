// Firestore + Auth via plain REST calls (fetch) — no SDK, no CDN.
// Shared between the admin app (app.js) and the public showcase (showcase.js).
//
// SECURITY MODEL (rewritten — no shared credentials in client code):
// - The showcase (public site) never authenticates. It calls Firestore
//   completely unauthenticated, relying on firestore.rules to allow public
//   READ of the collections it needs and to deny ALL writes without auth.
// - The admin app authenticates as a real Firebase Auth user (email +
//   password typed into a login form — see fbAdminLogin below). There is no
//   embedded password anywhere in this file or shipped to any browser.
// - `apiKey` below is NOT a secret — it's the public identifier Firebase's
//   own client SDKs always ship in browser code; access control lives
//   entirely in firestore.rules, never in this key. See docs/firestore-ops.md.
const FB_CONFIG = {
  apiKey: "AIzaSyDBIRpyH5Hvp-mMqs5i9LmWzk1w0toYQZw",
  projectId: "rinlada-plant-stock"
};
const FB_BASE = `https://firestore.googleapis.com/v1/projects/${FB_CONFIG.projectId}/databases/(default)/documents`;

let fbIdToken = null;
let fbTokenExpiry = 0;
let fbRefreshToken = null;
const FB_REFRESH_TOKEN_KEY = "garden_admin_refresh_token_v1";

// Plain fetch() has no built-in timeout — on a slow/flaky connection (not
// fully offline, just stalling) it can hang for a very long time before the
// browser itself gives up, leaving a "saving..." button stuck far longer
// than the UI implies. Force every request to fail fast instead so the
// existing offline fallback actually kicks in promptly.
//
// The timeout scales with request size: a plant/style/hero photo save can
// be several hundred KB, and mobile *upload* speed is often much slower
// than download (a weak signal can be under 50KB/s) — a flat short timeout
// would keep cutting those off mid-upload while small text-only saves
// (customers, BOQ) stay fast. Base 12s covers normal round-trips; add ~40ms
// per KB of body (≈25KB/s assumed floor) up to a 45s ceiling.
const FB_BASE_TIMEOUT_MS = 12000;
const FB_MAX_TIMEOUT_MS = 45000;
function fbTimeoutFor(options){
  const bodyLen = typeof options.body === "string" ? options.body.length : 0;
  return Math.min(FB_MAX_TIMEOUT_MS, FB_BASE_TIMEOUT_MS + Math.round(bodyLen/1024*40));
}
async function fbFetchOnce(url, options={}){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), fbTimeoutFor(options));
  try{
    return await fetch(url, {...options, signal: controller.signal});
  }catch(err){
    if(err.name==="AbortError") throw new Error("หมดเวลาเชื่อมต่อ กรุณาลองใหม่หรือตรวจสอบสัญญาณอินเทอร์เน็ต");
    throw err;
  }finally{
    clearTimeout(timer);
  }
}
// One automatic retry after a short pause — a single dropped packet or brief
// WiFi/mobile-data hiccup shouldn't force the user to notice a failure and
// manually redo the save; only a second consecutive failure counts as real.
async function fbFetch(url, options={}){
  try{
    return await fbFetchOnce(url, options);
  }catch(err){
    await new Promise(r=>setTimeout(r,600));
    return await fbFetchOnce(url, options);
  }
}

// ---- Admin authentication (real Firebase Auth user, typed credentials) ----
// Nothing here runs unless the admin app explicitly calls fbAdminLogin() —
// the showcase never imports/calls any of this, so it never holds a token.
function fbApplyAuthResult(data){
  fbIdToken=data.idToken;
  fbTokenExpiry=Date.now()+50*60*1000; // refresh a bit before the real 1h expiry
  fbRefreshToken=data.refreshToken||fbRefreshToken;
  if(fbRefreshToken){
    try{ localStorage.setItem(FB_REFRESH_TOKEN_KEY, fbRefreshToken); }catch{}
  }
}
async function fbAdminLogin(email,password){
  const res = await fbFetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_CONFIG.apiKey}`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email,password,returnSecureToken:true})
  });
  const data=await res.json();
  if(data.error) throw new Error(data.error.message==="INVALID_LOGIN_CREDENTIALS"||data.error.message==="EMAIL_NOT_FOUND"||data.error.message==="INVALID_PASSWORD" ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : data.error.message);
  fbApplyAuthResult(data);
  return fbIdToken;
}
async function fbRefreshIdToken(){
  if(!fbRefreshToken) return null;
  const res = await fbFetch(`https://securetoken.googleapis.com/v1/token?key=${FB_CONFIG.apiKey}`,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:`grant_type=refresh_token&refresh_token=${encodeURIComponent(fbRefreshToken)}`
  });
  const data=await res.json();
  if(data.error){
    fbIdToken=null; fbRefreshToken=null;
    try{ localStorage.removeItem(FB_REFRESH_TOKEN_KEY); }catch{}
    return null;
  }
  fbIdToken=data.id_token;
  fbTokenExpiry=Date.now()+50*60*1000;
  fbRefreshToken=data.refresh_token||fbRefreshToken;
  try{ localStorage.setItem(FB_REFRESH_TOKEN_KEY, fbRefreshToken); }catch{}
  return fbIdToken;
}
// Called once on the admin page's startup so a returning admin doesn't have
// to retype their password every visit — silently exchanges the saved
// refresh token for a fresh session if one exists. Returns true if a
// session was restored, false if the admin still needs to log in.
async function fbTryRestoreSession(){
  try{ fbRefreshToken=localStorage.getItem(FB_REFRESH_TOKEN_KEY); }catch{ fbRefreshToken=null; }
  if(!fbRefreshToken) return false;
  const token=await fbRefreshIdToken();
  return !!token;
}
function fbAdminLogout(){
  fbIdToken=null; fbTokenExpiry=0; fbRefreshToken=null;
  try{ localStorage.removeItem(FB_REFRESH_TOKEN_KEY); }catch{}
}
function fbIsLoggedIn(){ return !!fbIdToken; }

let fbLoginPromise=null;
// Public reads (showcase) never have a token and never try to get one — this
// just returns plain JSON headers, which is exactly what an unauthenticated
// Firestore REST read needs. Admin calls only work once fbAdminLogin() has
// run; if the token is close to expiring and a refresh token is available,
// this transparently refreshes it first.
async function fbHeaders(){
  if(fbIdToken && Date.now()>fbTokenExpiry && fbRefreshToken){
    if(!fbLoginPromise) fbLoginPromise=fbRefreshIdToken().finally(()=>{fbLoginPromise=null;});
    await fbLoginPromise;
  }
  return fbIdToken
    ? {"Content-Type":"application/json","Authorization":"Bearer "+fbIdToken}
    : {"Content-Type":"application/json"};
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
    const res=await fbFetch(url,{headers:await fbHeaders()});
    const data=await res.json();
    if(data.error) throw new Error(data.error.message);
    (data.documents||[]).forEach(doc=>out.push(fbDocToObj(doc)));
    pageToken=data.nextPageToken||"";
  }while(pageToken);
  return out;
}
async function fbGet(col,id){
  const res=await fbFetch(`${FB_BASE}/${col}/${encodeURIComponent(id)}`,{headers:await fbHeaders()});
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
  const res=await fbFetch(`${FB_BASE}/${col}/${encodeURIComponent(id)}`,{
    method:"PATCH",headers:await fbHeaders(),body:JSON.stringify({fields})
  });
  const data=await res.json();
  if(data.error) throw new Error(data.error.message);
  return data;
}
async function fbDelete(col,id){
  const res=await fbFetch(`${FB_BASE}/${col}/${encodeURIComponent(id)}`,{method:"DELETE",headers:await fbHeaders()});
  return res.ok;
}
// Exact-match lookup by a single field (Firestore structured query), e.g.
// finding a doc some OTHER system already created by name rather than by
// our own doc id — returns the matching doc's id, or null if none exists.
async function fbFindByField(col,field,value){
  const res=await fbFetch(`${FB_BASE}:runQuery`,{
    method:"POST",headers:await fbHeaders(),
    body:JSON.stringify({structuredQuery:{
      from:[{collectionId:col}],
      where:{fieldFilter:{field:{fieldPath:field},op:"EQUAL",value:fbToValue(value)}},
      limit:1
    }})
  });
  const rows=await res.json();
  if(!Array.isArray(rows)) throw new Error(rows?.error?.message||"ค้นหาข้อมูลไม่สำเร็จ");
  const doc=rows.find(r=>r.document)?.document;
  return doc ? doc.name.split("/").pop() : null;
}
// PATCH limited to only the given field names via updateMask, so fields set
// by some OTHER writer on this same document (e.g. stock/category from the
// LINE bot's own admin-chat commands) are left untouched instead of being
// wiped by a full-document overwrite like fbSet does.
async function fbPatchFields(col,id,fields){
  const mask=Object.keys(fields).map(k=>`updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const body={fields:{}};
  for(const k in fields) body.fields[k]=fbToValue(fields[k]);
  const res=await fbFetch(`${FB_BASE}/${col}/${encodeURIComponent(id)}?${mask}`,{
    method:"PATCH",headers:await fbHeaders(),body:JSON.stringify(body)
  });
  const data=await res.json();
  if(data.error) throw new Error(data.error.message);
  return data;
}
