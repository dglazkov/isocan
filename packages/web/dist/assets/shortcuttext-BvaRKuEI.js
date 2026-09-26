import{aC as r,aD as c,aE as i,aF as m,aG as p}from"./index-CHEIHVlA.js";function u(){return r().filter(o=>o.key).map(o=>({keys:[`⇧${o.key}`],does:`${o.emoji} ${o.on}, or ${o.off.toLowerCase()} — on the selection`,group:"Items",note:"A property on the item, so anybody can take it off"}))}function d(){const o=e=>e.keys.map(n=>p(n)).join(" / "),s=Math.max(...c.map(e=>o(e).length))+2;return i.map(e=>{const n=[...m(e),...u().filter(t=>t.group===e)].map(t=>{const a=`  ${o(t).padEnd(s)}${t.does}`;return t.note?`${a}
  ${"".padEnd(s)}${t.note}`:a});return`${e}
${n.join(`
`)}`}).join(`

`)}export{u as m,d as s};
