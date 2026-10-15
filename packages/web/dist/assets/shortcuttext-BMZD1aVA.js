import{a$ as a,b0 as m}from"./index-CTLJy36f.js";import{S as i,a as c,s as p}from"./shortcuts-BeWjwMWR.js";function $(){return a().filter(o=>o.key).map(o=>({keys:[`⇧${o.key}`],does:`${o.emoji} ${o.on}, or ${o.off.toLowerCase()} — on the selection`,group:"Items",note:"A property on the item, so anybody can take it off"}))}function d(){const o=t=>t.keys.map(n=>m(n)).join(" / "),s=Math.max(...i.map(t=>o(t).length))+2;return c.map(t=>{const n=[...p(t),...$().filter(e=>e.group===t)].map(e=>{const r=`  ${o(e).padEnd(s)}${e.does}`;return e.note?`${r}
  ${"".padEnd(s)}${e.note}`:r});return`${t}
${n.join(`
`)}`}).join(`

`)}export{$ as m,d as s};
