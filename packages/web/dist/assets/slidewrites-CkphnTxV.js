import{aR as u,aS as a,aT as i,aU as f,aV as p,m as P}from"./index-DjPgHLgQ.js";function E(t){return t?{properties:{[i]:"yes"}}:{removeProperties:[i]}}function _(t){const n=!(t.length>0&&t.every(a));return{on:n,changing:t.filter(r=>a(r)!==n)}}const h=24,O=160;function T(t,n){return Object.values(t.items).filter(e=>u(e)===n).sort((e,o)=>e.id.localeCompare(o.id))[0]??null}function d(t){return P(t).map(n=>({slide:n,note:T(t,n.id)}))}function m(t){return{x:t.x,y:t.y+t.height+h,width:t.width,height:O}}function g(t){return{...f,[p]:t}}function R(t,n){return d(t).map(({slide:e,note:o},c)=>{const s=o?n(o).trim():"";return`## ${c+1}. ${e.title}

${s===""?"_No notes._":s}
`}).join(`
`)}export{h as N,m as a,g as b,E as c,O as d,R as e,d as f,T as n,_ as s};
