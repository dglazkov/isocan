import{a4 as M,dn as y,B as l,aG as g,aS as p,aI as E,e8 as S,aM as w}from"./index-BCcvSze5.js";import{f as C}from"./fit-C0hGNr1c.js";const I=2400,f={width:1280,height:800},m=e=>Math.max(80,Math.min(I,Math.round(e)));async function T(e,r,s){if(s.startsWith("image/")&&s!=="image/svg+xml"){const t=new Image;t.src=M(e,r);try{return await t.decode(),{width:m(t.naturalWidth),height:m(t.naturalHeight)}}catch{return f}}if(s==="text/html"||s==="image/svg+xml"){const t=await y(e,r).catch(()=>null);if(t===null)return f;const n=await W(t,s);if(n)return n}return f}const v=`<script>
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
<\/script>`;function W(e,r){return new Promise(s=>{const t=document.createElement("iframe");t.setAttribute("sandbox","allow-scripts"),t.style.cssText="position:fixed; left:-10000px; top:0; width:2400px; height:1400px; border:0; visibility:hidden;";const n=d=>{window.removeEventListener("message",a),clearTimeout(h),t.remove(),s(d)},a=d=>{if(d.source!==t.contentWindow)return;const c=d.data;!c?.isocanMeasure||!c.width||!c.height||n({width:m(c.width),height:m(c.height)})},h=setTimeout(()=>n(null),2500);window.addEventListener("message",a),t.srcdoc=r==="image/svg+xml"?`<body style="margin:0">${e}${v}`:e+v,document.body.appendChild(t)})}async function A(e,r,s){const t=l.getState();if(t.canvasId!==e)return;const n=t.canvas;if(!n)return;const a=[];for(const o of s){const i=n.items[o];if(!i||g()&&p(i))continue;const u=i.versions.find(x=>x.id===i.currentVersionId)??i.versions.at(-1);if(!u)continue;const b=await T(e,u.blobHash,u.mimeType);a.push({itemId:o,...b})}if(l.getState().canvasId!==e)return;if(g()){const o=s.filter(i=>n.items[i]&&p(n.items[i])).map(i=>({itemId:i}));(o.length||a.length)&&await E(e,r,S({project:t.project,canvas:n},[...o,...a]));return}if(a.length===0)return;const h=l.getState().canvas;if(!h)return;const{resizes:d,moves:c}=C(h,a);for(const o of d)await w(e,r,{type:"item.resize",itemId:o.itemId,width:o.width,height:o.height});c.length>0&&await w(e,r,{type:"items.move",moves:c})}export{A as fitToContent};
