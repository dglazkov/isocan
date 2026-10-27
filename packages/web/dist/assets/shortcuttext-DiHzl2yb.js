import{bc as a,bd as m}from"./index-wIN2T9jm.js";import{S as c,a as i,s as p}from"./shortcuts-CH1vxaKK.js";function d(){return a().filter(o=>o.key).map(o=>({keys:[`⇧${o.key}`],does:`${o.emoji} ${o.on}, or ${o.off.toLowerCase()} — on the selection`,group:"Items",note:"A property on the item, so anybody can take it off"}))}function $(){const o=t=>t.keys.map(n=>m(n)).join(" / "),s=Math.max(...c.map(t=>o(t).length))+2;return i.map(t=>{const n=[...p(t),...d().filter(e=>e.group===t)].map(e=>{const r=`  ${o(e).padEnd(s)}${e.does}`;return e.note?`${r}
  ${"".padEnd(s)}${e.note}`:r});return`${t}
${n.join(`
`)}`}).join(`

`)}export{d as m,$ as s};
