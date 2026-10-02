import{aM as u,aN as a,aO as i,aP as f,aQ as P,m as p}from"./index-DfnC2Hex.js";function T(t){return t?{properties:{[i]:"yes"}}:{removeProperties:[i]}}function _(t){const n=!(t.length>0&&t.every(a));return{on:n,changing:t.filter(r=>a(r)!==n)}}const O=24,h=160;function d(t,n){return Object.values(t.items).filter(e=>u(e)===n).sort((e,o)=>e.id.localeCompare(o.id))[0]??null}function l(t){return p(t).map(n=>({slide:n,note:d(t,n.id)}))}function m(t){return{x:t.x,y:t.y+t.height+O,width:t.width,height:h}}function g(t){return{...f,[P]:t}}function N(t,n){return l(t).map(({slide:e,note:o},c)=>{const s=o?n(o).trim():"";return`## ${c+1}. ${e.title}

${s===""?"_No notes._":s}
`}).join(`
`)}export{O as N,m as a,g as b,T as c,h as d,N as e,l as f,d as n,_ as s};
