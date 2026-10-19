import{eu as E,aK as x,g as u,bj as p,bv as w,n as S,f_ as T,bl as C,bm as b}from"./index-DltDbmGX.js";import{b as F}from"./canvas-group-arrange-HlcoDhfT.js";import{f as W}from"./fit-CcP8Hq2n.js";import"./tidy-DQtYrGdl.js";const z=2400,f={width:1280,height:800},m=e=>Math.max(80,Math.min(z,Math.round(e)));async function H(e,r,i){if(i.startsWith("image/")&&i!=="image/svg+xml"){const t=new Image;t.src=E(e,r);try{return await t.decode(),{width:m(t.naturalWidth),height:m(t.naturalHeight)}}catch{return f}}if(i==="text/html"||i==="image/svg+xml"){const t=await x(e,r).catch(()=>null);if(t===null)return f;const s=await I(t,i);if(s)return s}return f}const v=`<script>
  // Measured at the widest the content would ever be asked for, so a
  // responsive page reports the layout it prefers rather than the one this
  // frame happens to force on it.
  const send = () => {
    const d = document.documentElement, b = document.body;
    parent.postMessage({ isocanMeasure: true,
      width: Math.max(d.scrollWidth, b ? b.scrollWidth : 0),
      height: Math.max(d.scrollHeight, b ? b.scrollHeight : 0) }, "*");
  };
  if (document.readyState === "complete") send();
  else addEventListener("load", send);
  setTimeout(send, 700);
<\/script>`;function I(e,r){return new Promise(i=>{const t=document.createElement("iframe");t.setAttribute("sandbox","allow-scripts"),t.style.cssText="position:fixed; left:-10000px; top:0; width:2400px; height:1400px; border:0; visibility:hidden;";const s=h=>{window.removeEventListener("message",a),clearTimeout(d),t.remove(),i(h)},a=h=>{if(h.source!==t.contentWindow)return;const c=h.data;!c?.isocanMeasure||!c.width||!c.height||s({width:m(c.width),height:m(c.height)})},d=setTimeout(()=>s(null),2500);window.addEventListener("message",a),t.srcdoc=r==="image/svg+xml"?`<body style="margin:0">${e}${v}`:e+v,document.body.appendChild(t)})}async function G(e,r,i){const t=u.getState();if(t.canvasId!==e)return;const s=t.canvas;if(!s)return;const a=[];for(const o of i){const n=s.items[o];if(!n||p()&&w(n))continue;const l=n.versions.find(y=>y.id===n.currentVersionId)??n.versions.at(-1);if(!l)continue;const g=S(n)?await x(e,l.blobHash).catch(()=>null):null,M=(g===null?null:T(n,g))??await H(e,l.blobHash,l.mimeType);a.push({itemId:o,...M})}if(u.getState().canvasId!==e)return;if(p()){const o=i.filter(n=>s.items[n]&&w(s.items[n])).map(n=>({itemId:n}));(o.length||a.length)&&await C(e,r,F({project:t.record,canvas:s},[...o,...a]));return}if(a.length===0)return;const d=u.getState().canvas;if(!d)return;const{resizes:h,moves:c}=W(d,a);for(const o of h)await b(e,r,{type:"item.resize",itemId:o.itemId,width:o.width,height:o.height});c.length>0&&await b(e,r,{type:"items.move",moves:c})}export{G as fitToContent};
