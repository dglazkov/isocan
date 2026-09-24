import{a3 as M,ad as y,B as l,b0 as g,bc as p,b2 as E,ei as S,b6 as w}from"./index-CbizLnJ0.js";import{f as C}from"./fit-DS24DxlQ.js";const T=2400,f={width:1280,height:800},m=e=>Math.max(80,Math.min(T,Math.round(e)));async function W(e,r,n){if(n.startsWith("image/")&&n!=="image/svg+xml"){const t=new Image;t.src=M(e,r);try{return await t.decode(),{width:m(t.naturalWidth),height:m(t.naturalHeight)}}catch{return f}}if(n==="text/html"||n==="image/svg+xml"){const t=await y(e,r).catch(()=>null);if(t===null)return f;const s=await z(t,n);if(s)return s}return f}const b=`<script>
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
<\/script>`;function z(e,r){return new Promise(n=>{const t=document.createElement("iframe");t.setAttribute("sandbox","allow-scripts"),t.style.cssText="position:fixed; left:-10000px; top:0; width:2400px; height:1400px; border:0; visibility:hidden;";const s=d=>{window.removeEventListener("message",a),clearTimeout(h),t.remove(),n(d)},a=d=>{if(d.source!==t.contentWindow)return;const c=d.data;!c?.isocanMeasure||!c.width||!c.height||s({width:m(c.width),height:m(c.height)})},h=setTimeout(()=>s(null),2500);window.addEventListener("message",a),t.srcdoc=r==="image/svg+xml"?`<body style="margin:0">${e}${b}`:e+b,document.body.appendChild(t)})}async function A(e,r,n){const t=l.getState();if(t.canvasId!==e)return;const s=t.canvas;if(!s)return;const a=[];for(const o of n){const i=s.items[o];if(!i||g()&&p(i))continue;const u=i.versions.find(x=>x.id===i.currentVersionId)??i.versions.at(-1);if(!u)continue;const v=await W(e,u.blobHash,u.mimeType);a.push({itemId:o,...v})}if(l.getState().canvasId!==e)return;if(g()){const o=n.filter(i=>s.items[i]&&p(s.items[i])).map(i=>({itemId:i}));(o.length||a.length)&&await E(e,r,S({project:t.project,canvas:s},[...o,...a]));return}if(a.length===0)return;const h=l.getState().canvas;if(!h)return;const{resizes:d,moves:c}=C(h,a);for(const o of d)await w(e,r,{type:"item.resize",itemId:o.itemId,width:o.width,height:o.height});c.length>0&&await w(e,r,{type:"items.move",moves:c})}export{A as fitToContent};
