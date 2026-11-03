import{bd as a,be as m}from"./index-DFL-ONZJ.js";import{S as i,a as c,s as p}from"./shortcuts-CH1vxaKK.js";function d(){return a().filter(o=>o.key).map(o=>({keys:[`⇧${o.key}`],does:`${o.emoji} ${o.on}, or ${o.off.toLowerCase()} — on the selection`,group:"Items",note:"A property on the item, so anybody can take it off"}))}function $(){const o=e=>e.keys.map(n=>m(n)).join(" / "),s=Math.max(...i.map(e=>o(e).length))+2;return c.map(e=>{const n=[...p(e),...d().filter(t=>t.group===e)].map(t=>{const r=`  ${o(t).padEnd(s)}${t.does}`;return t.note?`${r}
  ${"".padEnd(s)}${t.note}`:r});return`${e}
${n.join(`
`)}`}).join(`

`)}export{d as m,$ as s};
