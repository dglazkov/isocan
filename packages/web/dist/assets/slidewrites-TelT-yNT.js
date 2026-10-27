import{aJ as u,aK as a,aL as i,aM as f,aN as p,k as P}from"./index-wIN2T9jm.js";function T(t){return t?{properties:{[i]:"yes"}}:{removeProperties:[i]}}function _(t){const n=!(t.length>0&&t.every(a));return{on:n,changing:t.filter(r=>a(r)!==n)}}const h=24,O=160;function d(t,n){return Object.values(t.items).filter(e=>u(e)===n).sort((e,o)=>e.id.localeCompare(o.id))[0]??null}function l(t){return P(t).map(n=>({slide:n,note:d(t,n.id)}))}function g(t){return{x:t.x,y:t.y+t.height+h,width:t.width,height:O}}function m(t){return{...f,[p]:t}}function N(t,n){return l(t).map(({slide:e,note:o},c)=>{const s=o?n(o).trim():"";return`## ${c+1}. ${e.title}

${s===""?"_No notes._":s}
`}).join(`
`)}export{h as N,g as a,m as b,T as c,O as d,N as e,l as f,d as n,_ as s};
