import{de as E,aD as v,h as m,b1 as p,bd as w,q as S,fr as T,b3 as C,fs as F,b6 as b}from"./index-BJq-B_kE.js";import{f as W}from"./fit-YAy8MM6A.js";const z=2400,f={width:1280,height:800},u=e=>Math.max(80,Math.min(z,Math.round(e)));async function H(e,r,i){if(i.startsWith("image/")&&i!=="image/svg+xml"){const t=new Image;t.src=E(e,r);try{return await t.decode(),{width:u(t.naturalWidth),height:u(t.naturalHeight)}}catch{return f}}if(i==="text/html"||i==="image/svg+xml"){const t=await v(e,r).catch(()=>null);if(t===null)return f;const n=await I(t,i);if(n)return n}return f}const x=`<script>
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
<\/script>`;function I(e,r){return new Promise(i=>{const t=document.createElement("iframe");t.setAttribute("sandbox","allow-scripts"),t.style.cssText="position:fixed; left:-10000px; top:0; width:2400px; height:1400px; border:0; visibility:hidden;";const n=d=>{window.removeEventListener("message",a),clearTimeout(h),t.remove(),i(d)},a=d=>{if(d.source!==t.contentWindow)return;const c=d.data;!c?.isocanMeasure||!c.width||!c.height||n({width:u(c.width),height:u(c.height)})},h=setTimeout(()=>n(null),2500);window.addEventListener("message",a),t.srcdoc=r==="image/svg+xml"?`<body style="margin:0">${e}${x}`:e+x,document.body.appendChild(t)})}async function G(e,r,i){const t=m.getState();if(t.canvasId!==e)return;const n=t.canvas;if(!n)return;const a=[];for(const o of i){const s=n.items[o];if(!s||p()&&w(s))continue;const l=s.versions.find(y=>y.id===s.currentVersionId)??s.versions.at(-1);if(!l)continue;const g=S(s)?await v(e,l.blobHash).catch(()=>null):null,M=(g===null?null:T(s,g))??await H(e,l.blobHash,l.mimeType);a.push({itemId:o,...M})}if(m.getState().canvasId!==e)return;if(p()){const o=i.filter(s=>n.items[s]&&w(n.items[s])).map(s=>({itemId:s}));(o.length||a.length)&&await C(e,r,F({project:t.record,canvas:n},[...o,...a]));return}if(a.length===0)return;const h=m.getState().canvas;if(!h)return;const{resizes:d,moves:c}=W(h,a);for(const o of d)await b(e,r,{type:"item.resize",itemId:o.itemId,width:o.width,height:o.height});c.length>0&&await b(e,r,{type:"items.move",moves:c})}export{G as fitToContent};
