// rinlada-showcase-og — Cloudflare Worker
//
// Two jobs, both in service of the showcase's "share this plant" feature:
//
//   1. POST /upload      — accepts one photo from the ADMIN app only,
//      checked against a real Firebase Auth session (the same login
//      firebase-client.js already uses for Firestore writes — no separate
//      password or secret lives in this file or any browser-shipped code).
//      Stores it in R2 and returns a permanent URL any device can load the
//      photo from.
//   2. GET /photo/<key>  — serves a photo previously stored by /upload.
//      The showcase/admin never talk to R2 directly; this Worker is the
//      only thing with R2 access, via its bucket binding.
//   3. GET /plant/<id>   — public. Reads that plant's Firestore doc
//      (already publicly readable — see firestore.rules) and returns a
//      tiny HTML page whose Open Graph tags carry THAT plant's own
//      name/price/photo, then redirects real visitors on to the actual
//      showcase. Facebook/LINE/etc. link-preview crawlers only read a
//      page's <head> and never run JS, so they see the per-plant preview;
//      a real person following the link gets bounced through instantly.
//
// Bindings this Worker needs, set in the Cloudflare dashboard — nothing
// secret is hardcoded in this file:
//   - R2 bucket binding named PLANT_PHOTOS, pointed at the
//     "rinlada-plant-photos" bucket.
//   - Variable FIREBASE_API_KEY — same public value as FB_CONFIG.apiKey in
//     firebase-client.js (not a secret; see that file's comment on why).
//   - Variable FIREBASE_PROJECT_ID — "rinlada-plant-stock".
//   - Variable SHOWCASE_URL —
//     "https://dryrh68kkm-beep.github.io/Garden_Plan_Editor/showcase.html"
//
// Deploy steps: see docs/cloudflare-worker-ops.md.

const CORS_HEADERS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type, Authorization, X-Photo-Name"
};
function withCors(response){
  const headers=new Headers(response.headers);
  for(const [k,v] of Object.entries(CORS_HEADERS)) headers.set(k,v);
  return new Response(response.body,{status:response.status,headers});
}
function escapeHtml(s=""){
  return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}
// Verifying the token against Firebase's own accounts:lookup endpoint (same
// approach as firebase-client.js's REST-only pattern) is simpler and more
// robust than reimplementing JWT signature verification here — it also
// naturally rejects a revoked/disabled admin account, not just an expired one.
async function verifyFirebaseIdToken(idToken,apiKey){
  if(!idToken) return false;
  try{
    const res=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken})
    });
    const data=await res.json();
    return !data.error&&Array.isArray(data.users)&&data.users.length>0;
  }catch{
    return false;
  }
}
function fsField(doc,name){
  const f=doc?.fields?.[name];
  if(!f) return null;
  if("stringValue" in f) return f.stringValue;
  if("integerValue" in f) return Number(f.integerValue);
  if("doubleValue" in f) return f.doubleValue;
  if("arrayValue" in f) return (f.arrayValue.values||[]).map(v=>v.stringValue??null);
  return null;
}
async function fetchPlantDoc(env,id){
  const base=`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  // Try the lightweight public index first (what the showcase itself
  // reads), fall back to the full collection for older/edge-case ids.
  for(const collection of ["plantShowcaseIndex","customPlants"]){
    const res=await fetch(`${base}/${collection}/${encodeURIComponent(id)}`);
    if(res.ok) return await res.json();
  }
  return null;
}
const FALLBACK_IMAGE="https://dryrh68kkm-beep.github.io/Garden_Plan_Editor/assets/garden-card.webp";
async function handlePlantPreview(env,id){
  const doc=await fetchPlantDoc(env,id);
  const name=doc?(fsField(doc,"thaiName")||"ต้นไม้"):"รินลดา พันธุ์ไม้";
  const price=doc?fsField(doc,"salePrice"):null;
  const thumbs=doc?fsField(doc,"thumbs"):null;
  // Only ever use a real hosted photo (uploaded via /upload) as the preview
  // image — a base64 data: URI (older photos, pre-migration) can't be used
  // as og:image, so those plants just get the shop's generic card instead.
  const photoUrl=thumbs&&thumbs[0]&&/^https?:\/\//.test(thumbs[0])?thumbs[0]:FALLBACK_IMAGE;
  const title=price?`${name} ราคา ${Number(price).toLocaleString("th-TH")} บาท`:name;
  const description="ดูรูปเพิ่มเติมและสั่งซื้อได้ที่ร้านรินลดา พันธุ์ไม้";
  const target=`${env.SHOWCASE_URL}#plant=${encodeURIComponent(id)}`;
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(photoUrl)}" />
<meta property="og:type" content="product" />
<meta property="og:url" content="${escapeHtml(target)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta http-equiv="refresh" content="0;url=${escapeHtml(target)}" />
</head><body>
<p>กำลังพาไปหน้าต้นไม้... ถ้าไม่ไปอัตโนมัติ <a href="${escapeHtml(target)}">กดที่นี่</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`;
  return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8"}});
}
async function handleUpload(request,env){
  const auth=request.headers.get("Authorization")||"";
  const idToken=auth.startsWith("Bearer ")?auth.slice(7):"";
  const valid=await verifyFirebaseIdToken(idToken,env.FIREBASE_API_KEY);
  if(!valid) return withCors(new Response("Unauthorized",{status:401}));

  const contentType=request.headers.get("Content-Type")||"application/octet-stream";
  const name=request.headers.get("X-Photo-Name")||"photo";
  const ext=contentType.includes("webp")?"webp":contentType.includes("png")?"png":"jpg";
  const safeName=name.replace(/[^a-z0-9.-]/gi,"").slice(0,40)||"photo";
  const key=`plants/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safeName}.${ext}`;

  const body=await request.arrayBuffer();
  if(body.byteLength===0||body.byteLength>6*1024*1024){
    return withCors(new Response("Invalid image size",{status:400}));
  }
  await env.PLANT_PHOTOS.put(key,body,{httpMetadata:{contentType}});

  const url=`${new URL(request.url).origin}/photo/${key}`;
  return withCors(new Response(JSON.stringify({url}),{headers:{"Content-Type":"application/json"}}));
}
async function handlePhoto(env,key){
  const obj=await env.PLANT_PHOTOS.get(key);
  if(!obj) return new Response("Not found",{status:404});
  const headers=new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag",obj.httpEtag);
  headers.set("Cache-Control","public, max-age=31536000, immutable");
  return new Response(obj.body,{headers});
}

export default{
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method==="OPTIONS") return withCors(new Response(null,{status:204}));
    if(request.method==="POST"&&url.pathname==="/upload") return handleUpload(request,env);
    if(request.method==="GET"&&url.pathname.startsWith("/photo/")) return handlePhoto(env,url.pathname.slice("/photo/".length));
    if(request.method==="GET"&&url.pathname.startsWith("/plant/")) return handlePlantPreview(env,url.pathname.slice("/plant/".length));
    return new Response("Not found",{status:404});
  }
};
