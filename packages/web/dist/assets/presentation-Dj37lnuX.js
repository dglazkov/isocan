import{O as j,N as Y,hG as Z,a4 as ee,r as s,a2 as N,aC as te,j as q,J as ne,hH as D,U as re,aM as oe}from"./index-D-Na_X_G.js";import{M as se,s as ae,p as ie,m as ce}from"./morph-B4Mv3qYw.js";const ue=`(function(){
var MAX=${se};
var els=[],ground=null,anims=[];
function vis(cs){return cs.display!=="none"&&cs.visibility!=="hidden"&&parseFloat(cs.opacity)>0}
var MEDIA=/^(img|svg|video|canvas|picture|iframe|input|button|select|textarea|hr)$/;
function inl(cs,tag){return (cs.display==="inline"||cs.display==="contents")&&!MEDIA.test(tag)}
function decorated(cs){
  var bg=cs.backgroundColor;
  if(bg&&bg!=="transparent"&&!/rgba\\([^)]*,\\s*0\\)$/.test(bg))return true;
  if(cs.backgroundImage&&cs.backgroundImage!=="none")return true;
  if(cs.boxShadow&&cs.boxShadow!=="none")return true;
  return ["Top","Right","Bottom","Left"].some(function(s){return parseFloat(cs["border"+s+"Width"])>0&&cs["border"+s+"Style"]!=="none"});
}
function textBlock(el){
  if(!(el.textContent||"").trim())return false;
  for(var c=el.firstElementChild;c;c=c.nextElementSibling){
    var cs=getComputedStyle(c);
    if(cs.display!=="none"&&cs.display.indexOf("inline")!==0)return false;
  }
  return true;
}
function sig(el){var c=(el.getAttribute("class")||"").trim().split(/\\s+/).filter(Boolean).slice(0,4);return c.length?c.join(" "):undefined}
function scene(){
  els=[];var out=[],W=innerWidth,H=innerHeight;
  function walk(el,up){
    var tag=el.tagName.toLowerCase();
    if(/^(script|style|template|noscript|head|meta|link|title)$/.test(tag))return;
    var cs=getComputedStyle(el);if(!vis(cs))return;
    var r=el.getBoundingClientRect();
    var media=MEDIA.test(tag),text=!media&&!inl(cs,tag)&&textBlock(el);
    var box=!media&&!text&&!inl(cs,tag)&&decorated(cs)&&r.width*r.height<W*H*0.9;
    var on=r.width>=2&&r.height>=2&&r.bottom>0&&r.right>0&&r.top<H&&r.left<W;
    var at=up;
    if((media||text||box)&&on&&(cs.transform==="none"||cs.transform==="matrix(1, 0, 0, 1, 0, 0)")&&out.length<MAX){
      at=out.length;els.push(el);
      out.push({i:at,parent:up,kind:media?"media":text?"text":"box",tag:tag,
        key:el.getAttribute("data-morph")||el.id||undefined,
        text:text?(el.textContent||"").replace(/\\s+/g," ").trim().slice(0,160):undefined,
        src:media?(el.currentSrc||el.getAttribute("src")||undefined):undefined,
        cls:sig(el),x:r.left,y:r.top,w:r.width,h:r.height});
    }
    if(media||text)return;
    for(var c=el.firstElementChild;c;c=c.nextElementSibling)walk(c,at);
  }
  /* Measured as shown: a twin resting invisible (its pose) has a body at
     opacity 0, and every piece in it would read as hidden. */
  var b=document.body,was=b?b.style.opacity:"";
  if(b){b.style.opacity="";walk(b,-1);b.style.opacity=was}
  prep();
  parent.postMessage({type:"isocan:morph:scene",w:W,h:H,pieces:out},"*");
}
/* **Every layer the morph will move exists, and has been painted, long
   before the morph.** Promoting a piece to its own layer at the moment it
   starts to move means painting it for the first time in front of the room:
   the first morphs opened on a blank stage, then a ground with no pieces on
   it, for three or four frames (measured 19 Oct). So the twin is laid out
   for the motion as soon as its pieces are known — the background lifted
   into its own layer, each piece promoted — and looks exactly the same. */
function prep(){
  if(!ground)lay();
  els.forEach(function(el){el.style.transformOrigin="0 0";el.style.willChange="transform, opacity"});
}
function lay(){
  /* The slide's own background becomes a layer of its own, so it can fade
     while the pieces stand in front of it. */
  var de=document.documentElement,b=document.body,src=getComputedStyle(de);
  var bs=b?getComputedStyle(b):src;
  var pick=(src.backgroundColor!=="rgba(0, 0, 0, 0)"||src.backgroundImage!=="none")?src:bs;
  ground=document.createElement("div");
  var g=ground.style;g.position="fixed";g.inset="0";g.zIndex="-2147483647";g.pointerEvents="none";g.transformOrigin="0 0";g.willChange="transform, opacity";
  g.backgroundColor=pick.backgroundColor;g.backgroundImage=pick.backgroundImage;g.backgroundSize=pick.backgroundSize;
  g.backgroundPosition=pick.backgroundPosition;g.backgroundRepeat=pick.backgroundRepeat;
  /* Nothing painted: the browser's own page colour, which is what the live frame shows. */
  if(pick.backgroundColor==="rgba(0, 0, 0, 0)"&&pick.backgroundImage==="none")g.backgroundColor="Canvas";
  de.style.background="transparent";if(b)b.style.background="transparent";
  (b||de).appendChild(ground);
}
function reset(){
  anims.forEach(function(a){a.cancel()});anims=[];
}
/* **A pose: shown, or not at all.** A twin can take a frame or two to put
   a new picture on screen. So each twin rests in the pose its morph will
   START from — the slide on screen shown, its neighbours invisible — and
   arming changes nothing anybody could see in the meantime. */
function pose(shown){if(document.body)document.body.style.opacity=shown?"":"0"}
addEventListener("message",function(e){
  if(e.source!==parent||!e.data)return;var d=e.data;
  if(d.type==="isocan:morph:reset"){reset();return}
  if(d.type==="isocan:morph:pose"){if(!anims.length)pose(!!d.shown);return}
  if(d.type==="isocan:morph:play"){anims.forEach(function(a){a.play()});return}
  if(d.type!=="isocan:morph:arm"||!d.side)return;
  reset();prep();pose(true);var ms=+d.ms||1400;
  anims.push(ground.animate(d.side.ground,{duration:ms,fill:"both",easing:"linear"}));
  /* A track may carry its own timing: the flat content swaps run two
     keyframes per piece, staggered, on the compositor; the morph samples
     the whole beat linearly. */
  d.side.tracks.forEach(function(t){
    var el=els[t.i];if(!el)return;
    anims.push(el.animate(t.frames,{duration:+t.duration||ms,delay:+t.delay||0,fill:"both",easing:t.easing||"linear"}));
  });
  anims.forEach(function(a){a.pause();a.currentTime=0});
  requestAnimationFrame(function(){requestAnimationFrame(function(){parent.postMessage({type:"isocan:morph:armed"},"*")})});
});
function ready(){
  var fonts=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();
  fonts.then(function(){requestAnimationFrame(function(){requestAnimationFrame(scene)})});
}
if(document.readyState==="complete")ready();else addEventListener("load",ready);
/* The twin follows the live frame's size; pieces measured at the old size
   would land somewhere else. */
var again;addEventListener("resize",function(){if(anims.length)return;clearTimeout(again);again=setTimeout(scene,150)});
})();`;function de(a){const i=`<script>${ue}<\/script>`,u=a.search(/<\/body\s*>/i);return u===-1?a+i:a.slice(0,u)+i+a.slice(u)}function le(a){if(!a)return null;const i=a.versions.find(A=>A.id===a.currentVersionId)??a.versions[0];if(!i)return null;const u=ne(i,a.properties.face);return u.mimeType==="text/html"?u.blobHash:null}function pe({canvasId:a,itemId:i}){const u=j(e=>e.canvas),A=Y(),$=j(e=>Z(ee(e.record??{})))&&A,_=s.useMemo(()=>typeof window<"u"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches,[]),p=$&&!_,y=s.useMemo(()=>{if(!p||!u)return[];const e=u.items[i],t=new Set;return[e,N(u,i,1),N(u,i,-1)].map(n=>n?{itemId:n.id,hash:le(n)}:null).filter(n=>!n?.hash||t.has(n.hash)?!1:(t.add(n.hash),!0))},[p,u,i]),[k,U]=s.useState({}),[E,X]=s.useState({}),[b,K]=s.useState(null),[d,x]=s.useState(null),S=s.useRef(new Set),P=s.useRef(()=>{}),g=s.useRef(new Map),R=y.map(e=>e.hash).join(" ");s.useEffect(()=>{if(!R)return;let e=!0;for(const t of R.split(" "))k[t]===void 0&&te(a,t).then(n=>e&&U(r=>r[t]!==void 0?r:{...r,[t]:de(n)})).catch(()=>{});return()=>{e=!1}},[R,a,k]),s.useEffect(()=>{if(!p)return;let e=null;const t=()=>{const c=document.querySelector(".fullscreen-stage .html-view-stack");if(c&&c!==e&&(n.disconnect(),n.observe(c),e=c),!c)return;const o=c.getBoundingClientRect();o.width<2||o.height<2||K(l=>l&&l.left===o.left&&l.top===o.top&&l.width===o.width&&l.height===o.height?l:{left:o.left,top:o.top,width:o.width,height:o.height})},n=new ResizeObserver(t);t();const r=window.setInterval(t,500);return window.addEventListener("resize",t),()=>{n.disconnect(),clearInterval(r),window.removeEventListener("resize",t)}},[p,i]),s.useEffect(()=>{if(!p)return;const e=t=>{for(const[n,r]of g.current){if(r.contentWindow!==t.source)continue;if(t.data?.type==="isocan:morph:armed")return P.current(n);const c=ae(t.data);c&&X(o=>({...o,[n]:c}));return}};return window.addEventListener("message",e),()=>window.removeEventListener("message",e)},[p]);const W=y.find(e=>e.itemId===i)?.hash,G=Object.keys(E).sort().join(" ");s.useEffect(()=>{if(!(!p||d))for(const[e,t]of g.current)t.contentWindow?.postMessage({type:"isocan:morph:pose",shown:e===W},"*")},[p,d,W,G]);const z=s.useRef({slides:y,scenes:E,playing:d,itemId:i});z.current={slides:y,scenes:E,playing:d,itemId:i},s.useEffect(()=>{if(!p)return;let e=[],t=0,n=0;const r=(c,o)=>g.current.get(c)?.contentWindow?.postMessage(o,"*");return D((c,o,l,B)=>{const w=z.current,m=w.slides.find(h=>h.itemId===w.itemId)?.hash,f=w.slides.find(h=>re(a,h.itemId)===c)?.hash;if(!m||!f||m===f||w.playing)return!1;const I=w.scenes[m],O=w.scenes[f],F=g.current.get(m),L=g.current.get(f);if(!I||!O||!F?.contentWindow||!L?.contentWindow)return!1;const v=oe[l],M=l==="poof"||l==="drift"||l==="rise"?ie(l,I,O,o,v):ce(I,O,o);S.current=new Set;let T=!1;const Q=()=>{T||(T=!0,clearTimeout(n),r(m,{type:"isocan:morph:play"}),r(f,{type:"isocan:morph:play"}),e=M.scene.length?[F,L].map(h=>h.animate(M.scene,{duration:v,fill:"both",easing:"linear"})):[],x({from:m,to:f,armed:!0}),document.documentElement.dataset.morph="playing",B(),clearTimeout(t),t=window.setTimeout(()=>{document.documentElement.dataset.morph="ready",x(null),requestAnimationFrame(()=>{e.forEach(h=>h.cancel()),e=[],r(m,{type:"isocan:morph:reset"}),r(f,{type:"isocan:morph:reset"}),r(m,{type:"isocan:morph:pose",shown:!1}),r(f,{type:"isocan:morph:pose",shown:!0})})},v))};return P.current=h=>{S.current.add(h),S.current.has(m)&&S.current.has(f)&&Q()},n=window.setTimeout(()=>{T||(T=!0,r(m,{type:"isocan:morph:reset"}),r(f,{type:"isocan:morph:reset"}),x(null),B())},900),r(m,{type:"isocan:morph:arm",side:M.out,ms:v}),r(f,{type:"isocan:morph:arm",side:M.in,ms:v}),x({from:m,to:f,armed:!1}),!0}),document.documentElement.dataset.morph="ready",()=>{delete document.documentElement.dataset.morph,D(null),clearTimeout(t),clearTimeout(n),e.forEach(c=>c.cancel())}},[p,a]);const H=new Set([...y.map(e=>e.hash),...d?[d.from,d.to]:[]]),C=s.useRef([]);C.current=[...C.current.filter(e=>H.has(e)),...[...H].filter(e=>!C.current.includes(e))];const J=C.current;if(!p||!b)return null;const V=d?d.from:y.find(e=>e.itemId===i)?.hash;return q.jsx("div",{className:"morph-stage","data-playing":d?.armed?"":void 0,"aria-hidden":!0,style:{left:b.left,top:b.top,width:b.width,height:b.height},children:J.map(e=>k[e]===void 0?null:q.jsx("iframe",{ref:t=>{t?g.current.set(e,t):g.current.delete(e)},className:"morph-frame","data-role":d?.from===e?"out":d?.to===e?"in":void 0,"data-current":e===V?"":void 0,"data-ready":E[e]?"":void 0,sandbox:"allow-scripts",srcDoc:k[e],tabIndex:-1,title:""},e))})}export{pe as M};
