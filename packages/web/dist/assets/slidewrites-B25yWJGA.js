import{b3 as u,b4 as i,b5 as a,b6 as f,b7 as p,J as P}from"./index-CKPAq2G8.js";function E(t){return t?{properties:{[a]:"yes"}}:{removeProperties:[a]}}function T(t){const n=!(t.length>0&&t.every(i));return{on:n,changing:t.filter(r=>i(r)!==n)}}const h=24,O=160;function b(t,n){return Object.values(t.items).filter(e=>u(e)===n).sort((e,o)=>e.id.localeCompare(o.id))[0]??null}function d(t){return P(t).map(n=>({slide:n,note:b(t,n.id)}))}function _(t){return{x:t.x,y:t.y+t.height+h,width:t.width,height:O}}function g(t){return{...f,[p]:t}}function m(t,n){return d(t).map(({slide:e,note:o},c)=>{const s=o?n(o).trim():"";return`## ${c+1}. ${e.title}

${s===""?"_No notes._":s}
`}).join(`
`)}export{h as N,_ as a,g as b,E as c,O as d,m as e,d as f,b as n,T as s};
