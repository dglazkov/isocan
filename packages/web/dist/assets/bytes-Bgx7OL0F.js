const r=["KB","MB","GB","TB"];function f(n){if(n<1024)return`${n} B`;let t=n,o="B";for(const e of r){if(t<1024)break;t/=1024,o=e}return`${t.toFixed(t>=100?0:1)} ${o}`}export{f};
