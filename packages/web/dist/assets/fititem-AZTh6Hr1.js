import{a4 as E,ae as v,F as m,bb as p,bn as w,R as S,et as F,bd as T,eu as C,bh as b}from"./index-CVzgfP5x.js";import{f as W}from"./fit-DBCWKsBT.js";const z=2400,f={width:1280,height:800},l=e=>Math.max(80,Math.min(z,Math.round(e)));async function H(e,r,i){if(i.startsWith("image/")&&i!=="image/svg+xml"){const t=new Image;t.src=E(e,r);try{return await t.decode(),{width:l(t.naturalWidth),height:l(t.naturalHeight)}}catch{return f}}if(i==="text/html"||i==="image/svg+xml"){const t=await v(e,r).catch(()=>null);if(t===null)return f;const s=await I(t,i);if(s)return s}return f}const x=`<script>
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
<\/script>`;function I(e,r){return new Promise(i=>{const t=document.createElement("iframe");t.setAttribute("sandbox","allow-scripts"),t.style.cssText="position:fixed; left:-10000px; top:0; width:2400px; height:1400px; border:0; visibility:hidden;";const s=h=>{window.removeEventListener("message",a),clearTimeout(d),t.remove(),i(h)},a=h=>{if(h.source!==t.contentWindow)return;const c=h.data;!c?.isocanMeasure||!c.width||!c.height||s({width:l(c.width),height:l(c.height)})},d=setTimeout(()=>s(null),2500);window.addEventListener("message",a),t.srcdoc=r==="image/svg+xml"?`<body style="margin:0">${e}${x}`:e+x,document.body.appendChild(t)})}async function B(e,r,i){const t=m.getState();if(t.canvasId!==e)return;const s=t.canvas;if(!s)return;const a=[];for(const o of i){const n=s.items[o];if(!n||p()&&w(n))continue;const u=n.versions.find(y=>y.id===n.currentVersionId)??n.versions.at(-1);if(!u)continue;const g=S(n)?await v(e,u.blobHash).catch(()=>null):null,M=(g===null?null:F(n,g))??await H(e,u.blobHash,u.mimeType);a.push({itemId:o,...M})}if(m.getState().canvasId!==e)return;if(p()){const o=i.filter(n=>s.items[n]&&w(s.items[n])).map(n=>({itemId:n}));(o.length||a.length)&&await T(e,r,C({project:t.record,canvas:s},[...o,...a]));return}if(a.length===0)return;const d=m.getState().canvas;if(!d)return;const{resizes:h,moves:c}=W(d,a);for(const o of h)await b(e,r,{type:"item.resize",itemId:o.itemId,width:o.width,height:o.height});c.length>0&&await b(e,r,{type:"items.move",moves:c})}export{B as fitToContent};
