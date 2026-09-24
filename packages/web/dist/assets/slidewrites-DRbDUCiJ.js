import{aE as u,aF as a,aG as i,aH as f,aI as p,ar as P}from"./index-LSanXvGu.js";function T(t){return t?{properties:{[i]:"yes"}}:{removeProperties:[i]}}function _(t){const n=!(t.length>0&&t.every(a));return{on:n,changing:t.filter(r=>a(r)!==n)}}const h=24,E=160;function O(t,n){return Object.values(t.items).filter(e=>u(e)===n).sort((e,o)=>e.id.localeCompare(o.id))[0]??null}function d(t){return P(t).map(n=>({slide:n,note:O(t,n.id)}))}function g(t){return{x:t.x,y:t.y+t.height+h,width:t.width,height:E}}function m(t){return{...f,[p]:t}}function y(t,n){return d(t).map(({slide:e,note:o},c)=>{const s=o?n(o).trim():"";return`## ${c+1}. ${e.title}

${s===""?"_No notes._":s}
`}).join(`
`)}export{h as N,g as a,m as b,T as c,E as d,y as e,d as f,O as n,_ as s};
