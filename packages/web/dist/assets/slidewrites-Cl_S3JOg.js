import{aK as u,aL as a,aM as i,aN as f,aO as p,m as O}from"./index-B350L7xU.js";function T(t){return t?{properties:{[i]:"yes"}}:{removeProperties:[i]}}function _(t){const n=!(t.length>0&&t.every(a));return{on:n,changing:t.filter(r=>a(r)!==n)}}const P=24,h=160;function d(t,n){return Object.values(t.items).filter(e=>u(e)===n).sort((e,o)=>e.id.localeCompare(o.id))[0]??null}function l(t){return O(t).map(n=>({slide:n,note:d(t,n.id)}))}function m(t){return{x:t.x,y:t.y+t.height+P,width:t.width,height:h}}function g(t){return{...f,[p]:t}}function N(t,n){return l(t).map(({slide:e,note:o},c)=>{const s=o?n(o).trim():"";return`## ${c+1}. ${e.title}

${s===""?"_No notes._":s}
`}).join(`
`)}export{P as N,m as a,g as b,T as c,h as d,N as e,l as f,d as n,_ as s};
