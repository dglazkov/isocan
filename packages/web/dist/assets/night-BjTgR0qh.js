import{a as F,p as q,u as Q,F as ce}from"./LivingGround-DigOROyV.js";/* empty css              */import"./index-D_y8oGe9.js";import"./CanvasThemeLayer-Co9LQ3he.js";/* empty css               */const te=16,fe=.6,j=120,he=5,le=5,me=.4,ie=1.8,oe=s=>{const i=Math.min(1,Math.max(0,s));return i*i*(3-2*i)};function ve(s,i,n,f,o,r,a=Math.random,b=j){let m=i+Math.max(0,o);for(;m>te;)if(m-=te,a()<fe&&s.length<b){const v=a();s.push({x:n.x+(f.x-n.x)*v+(a()-.5)*34/r,y:n.y+(f.y-n.y)*v+(8+a()*16)/r,vx:(a()-.5)*20/r,vy:(-14-a()*18)/r,age:0,life:he+a()*le,ph:a()*6.28,rate:1.1+a()*1.3,seed:a()*100})}return m}function xe(s,i,n){const f=[];for(const o of s){if(o.age+=i,o.age>=o.life)continue;const r=Math.sin(o.age*.9+o.seed)*22,a=Math.cos(o.age*.7+o.seed*1.7)*10-12;o.vx+=(r/n-o.vx)*Math.min(1,i*1.2),o.vy+=(a/n-o.vy)*Math.min(1,i*1.2),o.x+=o.vx*i,o.y+=o.vy*i,f.push(o)}return f}function de(s,i){const n=oe(s.age/me)*(1-oe((s.age-(s.life-ie))/ie)),f=.18+.82*Math.max(0,Math.sin(s.age*s.rate+s.ph))**6;return n*f*i}function ye(s){return .32+.68*Math.min(1,Math.max(0,s/520))}const k=300,pe=.55;function we(s,i,n,f,o){let r=0;for(const a of o){const b=Math.max(s-a.x,0,a.x-(s+n)),m=Math.max(i-a.y,0,a.y-(i+f)),v=Math.hypot(b,m);v>k||(r+=a.i*Math.exp(-v/70))}return Math.min(pe,r*.3)}const re=.02;function be(s,i){const n=i<re?0:Math.round(i*100)/100;return n===0?s===0?null:0:Math.abs(n-s)>re?n:null}const Ae=.4,se={x:12.7,y:13.7},Le=7.5/Math.SQRT1_2,Z=30,Me=24e3,G=24,M=16,ne=`#version 300 es
precision highp float; precision highp int;
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hash(ivec2 c, uint salt){ uint x = uint(c.x + 1073741824); uint y = uint(c.y + 1073741824);
  return float(pcg(x * 1973u + pcg(y * 9277u + salt))) * (1.0 / 4294967296.0); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); ivec2 c = ivec2(i);
  float a = hash(c, 1u), b = hash(c + ivec2(1,0), 1u), d = hash(c + ivec2(0,1), 1u), e = hash(c + ivec2(1,1), 1u);
  vec2 u = f * f * (3. - 2. * f); return mix(mix(a, b, u.x), mix(d, e, u.x), u.y); }
float fbm(vec2 p, int oct){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ if (i >= oct) break; s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; } return s; }
float rectSd(vec2 p, vec4 r){ vec2 c = r.xy + r.zw * .5; vec2 d = abs(p - c) - r.zw * .5; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
vec2 rectN(vec2 p, vec4 r){ vec2 q = p - (r.xy + r.zw * .5); vec2 d = abs(q) - r.zw * .5; return d.x > d.y ? vec2(sign(q.x), 0.) : vec2(0., sign(q.y)); }
`,Re=ne+`
in vec2 vUv;
out vec4 o;
uniform vec3 uView; uniform vec2 uRes; uniform float uBufH, uDpr, uTime, uAmb, uHorizon;
uniform vec4 uItems[${M}]; uniform int uNI; uniform float uGlow[${M}];
uniform vec4 uLight[${G}]; uniform int uNL;
void main(){
  vec2 scr = vec2(gl_FragCoord.x, uBufH - gl_FragCoord.y) / uDpr;
  vec2 w = (scr - uView.yz) / uView.x; float hz = uHorizon;
  vec3 c = mix(vec3(.012, .02, .05), vec3(.07, .075, .13), pow(smoothstep(0., hz, scr.y), 1.6));
  c += vec3(.15, .085, .05) * exp(-abs(scr.y - hz) / 46.);                        // a town's glow on the haze
  vec2 sk = floor(scr / 3.); float st = hash(ivec2(sk) + ivec2(int(uView.y * .02), 0), 70u);
  c += vec3(.7, .75, .9) * step(.9975, st) * .35 * (1. - smoothstep(0., hz, scr.y));
  float px = -uView.y * .04;                                                       // the far lights barely move with a pan
  if (scr.y > hz - 60. && scr.y < hz + 30.) for (int i = 0; i < 30; i++) {
    ivec2 hi = ivec2(i, 3); float x = mod(hash(hi, 1u) * uRes.x * 1.3 + px, uRes.x * 1.3) - uRes.x * .15;
    float y = hz - 4. - 30. * pow(hash(hi, 2u), 1.5); float r = 5. + 17. * pow(hash(hi, 3u), 2.);
    float dd = length(scr - vec2(x, y));
    float disc = smoothstep(r, r - 1.6, dd) * (.55 + .45 * smoothstep(r * .5, r, dd));
    vec3 lc = hash(hi, 4u) < .78 ? mix(vec3(1., .66, .32), vec3(1., .86, .58), hash(hi, 5u)) : vec3(.6, .74, 1.);
    c += lc * disc * (.12 + .26 * hash(hi, 6u)) * (1. + .15 * uAmb * sin(uTime * (.6 + hash(hi, 7u)) + 6.28 * hash(hi, 8u)));
  }
  float hill = hz + 4. - 16. * fbm(vec2((scr.x - uView.y * .12) * .006, 0.), 2) - 6. * vnoise(vec2((scr.x - uView.y * .25) * .05, 3.));
  if (scr.y > hill) {
    c = mix(vec3(.013, .024, .024), vec3(.032, .055, .05), fbm(w * .006, 2));
    vec3 L = vec3(0.);
    for (int i = 0; i < 12; i++) { if (i >= uNL) break; vec2 d = scr - uLight[i].xy; float rr = uLight[i].w * 1.7; L += vec3(1., .72, .32) * uLight[i].z / (1. + dot(d, d) / (rr * rr)); }
    c += L * .16;
  }
  for (int i = 0; i < ${M}; i++) { if (i >= uNI) break;
    vec4 r = vec4(uItems[i].xy * uView.x + uView.yz, uItems[i].zw * uView.x);
    float sd = rectSd(scr, r);
    c += vec3(1., .7, .35) * uGlow[i] * .55 * exp(-max(sd, 0.) / 18.) * step(0., sd);
    c *= 1. - .35 * exp(-max(sd, 0.) / 10.) * (1. - uGlow[i]); }
  o = vec4(c, 1.);
}`,Ie=ne+`
uniform vec3 uView; uniform vec2 uRes; uniform float uTime, uAmb, uLodA, uFade, uS, uH, uHorizon;
uniform ivec2 uCell0; uniform int uCols, uLevel;
uniform sampler2D uTrail; uniform vec3 uTR; uniform float uHasTrail;
uniform vec4 uPtr[${F}]; uniform int uNP;
uniform vec4 uItems[${M}]; uniform int uNI;
uniform vec4 uLight[${G}]; uniform int uNL;
out vec4 vCol;
float trailAt(vec2 p) {
  vec2 uv = (p - uTR.xy) / uTR.z;
  if (uHasTrail < .5 || any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) return 0.;
  return textureLod(uTrail, uv, 0.).r;
}
void main(){
  int id = gl_InstanceID; ivec2 cell = uCell0 + ivec2(id % uCols, id / uCols);
  ivec2 c0 = cell * (1 << uLevel);
  float r1 = hash(c0, 11u), r2 = hash(c0, 23u), r3 = hash(c0, 37u), r4 = hash(c0, 51u);
  vec2 base = (vec2(cell) + vec2(r1, r2)) * uS;
  float alpha = uLodA;
  if (((cell.x | cell.y) & 1) == 1) alpha *= uFade;      // these leave at the next level out: fade, don't pop
  float h = uH * (.62 + .55 * r3);
  vec2 sb = base * uView.x + uView.yz;
  float k = smoothstep(uHorizon, uRes.y * 1.05, sb.y); alpha *= smoothstep(uHorizon + 2., uHorizon + 26., sb.y); h *= mix(.35, 1.15, k);
  if (alpha < .01) { gl_Position = vec4(2., 2., 2., 1.); vCol = vec4(0.); return; }
  // History: the trail, pressed away down its slope. Now: every pointer, radially. Items: flat, leaning out at the edges.
  float tx = uTR.z / 256. * 1.5;
  float press = trailAt(base);
  vec2 g = vec2(trailAt(base + vec2(tx, 0.)) - trailAt(base - vec2(tx, 0.)), trailAt(base + vec2(0., tx)) - trailAt(base - vec2(0., tx)));
  vec2 push = length(g) > 1e-4 ? -normalize(g) * press * .9 : vec2(0.);
  for (int i = 0; i < ${F}; i++) { if (i >= uNP) break;
    vec2 d = base - uPtr[i].xy; float L = length(d), R = uPtr[i].w;
    if (L < R) { float f = 1. - L / R; f *= f * uPtr[i].z; push += (L > 1e-3 ? d / L : vec2(0.)) * f * 1.1; press = max(press, f * .9); }
  }
  for (int i = 0; i < ${M}; i++) { if (i >= uNI) break;
    float sd = rectSd(base, uItems[i]);
    if (sd < 14.) { float f = 1. - smoothstep(-3., 14., sd); push += rectN(base, uItems[i]) * f * 1.15; press = max(press, f); if (sd < 0.) h *= .3; }
  }
  float wind = uAmb * (.17 * sin(uTime * 1.05 + base.x * .011 + base.y * .006) + .07 * sin(uTime * 2.3 + base.x * .045 + r4 * 6.28));
  float pl = length(push); if (pl > 1.) { push /= pl; pl = 1.; }
  vec2 lean = vec2(push.x + (wind + (r1 - .5) * .22) * (1. - pl), push.y);
  vec2 tip = vec2(lean.x * .95, -(1. - .82 * pl) + lean.y * .3) * h;
  float t = gl_VertexID >= 2 ? 1. : 0.; float side = (gl_VertexID == 1 || gl_VertexID == 3) ? .5 : -.5;
  float al = max(length(tip), 1e-3); vec2 nrm = vec2(-tip.y, tip.x) / al;
  float wd = max(2.3 * (.7 + .6 * r4), .9 / uView.x) * mix(1., .14, t);
  vec2 s = (base + tip * t + nrm * side * wd) * uView.x + uView.yz;
  gl_Position = vec4(s.x / uRes.x * 2. - 1., 1. - s.y / uRes.y * 2., 0., 1.);
  // Moonlit, not black (Dion, 9 Oct: "you should be able to tell it's grass when dark").
  vec3 c = mix(vec3(.018, .042, .04), vec3(.13, .24, .2), t * (.7 + .4 * r2)) * (.82 + .32 * r3);
  c = mix(c, vec3(.17, .27, .23), press * (.2 + .45 * t));
  vec3 L = vec3(0.);
  for (int i = 0; i < ${G}; i++) { if (i >= uNL) break; vec2 d = s - uLight[i].xy; L += uLight[i].z / (1. + dot(d, d) / (uLight[i].w * uLight[i].w)); }
  c += vec3(1., .74, .34) * L * (.18 + .82 * t) * .85;
  vCol = vec4(c, alpha);
}`,_e=`#version 300 es
precision mediump float; in vec4 vCol; out vec4 o; void main(){ o = vCol; }`,Ne=`#version 300 es
precision highp float;
layout(location = 0) in vec4 aF;   // ground x, y, intensity, radius (css px)
uniform vec3 uView; uniform vec2 uRes; out vec2 vQ; out float vI;
void main(){
  vec2 q = vec2((gl_VertexID & 1) == 1 ? 1. : -1., (gl_VertexID & 2) == 2 ? 1. : -1.);
  vec2 s = aF.xy * uView.x + uView.yz + q * aF.w; vQ = q; vI = aF.z;
  gl_Position = vec4(s.x / uRes.x * 2. - 1., 1. - s.y / uRes.y * 2., 0., 1.);
}`,Te=`#version 300 es
precision mediump float; in vec2 vQ; in float vI; out vec4 o;
void main(){ float r2 = dot(vQ, vQ); float edge = 1. - smoothstep(.7, 1., sqrt(r2));
  vec3 c = vec3(1., .95, .7) * exp(-r2 * 70.) * 1.5 + vec3(1., .72, .3) * exp(-r2 * 6.) * .5 + vec3(.75, 1., .35) * exp(-r2 * 22.) * .25;
  o = vec4(c * vI * edge, 1.); }`,Ve=(s,i)=>{const n=document.querySelector(`.item[data-item-id="${CSS.escape(s)}"]`);n&&(i>0?n.style.setProperty("--ground-glow",i.toFixed(2)):n.style.removeProperty("--ground-glow"))},Se=s=>{const i=Math.min(1,Math.max(0,s));return i*i*(3-2*i)};function He(s=Ve){let i=null,n=null,f=null,o={},r={},a={},b=null,m=null,v=null,R=[],J=0,U=0;const O=new Map,W=new Map,I=new Map,X=new Float32Array(4*(j+F));let _=0;const $=new Float32Array(G*4);let g=0;const K=new Float32Array(F*4);let z=0;const Y=new Float32Array(M),ue=()=>{for(const e of I.keys())s(e,0);I.clear()};return{name:"night",cursor:"firefly",flies:()=>R.length,setup(e){i=q(e,ce,Re),n=q(e,Ie,_e),f=q(e,Ne,Te),o=Q(e,i),r=Q(e,n),a=Q(e,f),b=e.createVertexArray(),m=e.createVertexArray(),v=e.createBuffer(),e.bindVertexArray(m),e.bindBuffer(e.ARRAY_BUFFER,v),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,4,e.FLOAT,!1,16,0),e.vertexAttribDivisor(0,1),e.bindVertexArray(null)},step(e,c){const{scale:u,tx:p,ty:w}=c.view,h=c.ambient,P=performance.now();U+=e*h;const d=[],D=new Set;z=0,_=0;for(const t of c.pointers){D.add(t.id);const l=O.get(t.id);l&&h>.002&&(J=ve(R,J,l,t,Math.hypot(t.x-l.x,t.y-l.y)*u,u)),O.set(t.id,{x:t.x,y:t.y});const x=ye(P-t.at<250?t.speed:0),A=W.get(t.id)??.32,T=A+(x-A)*(1-Math.exp(-e*4));W.set(t.id,T);const B=T*t.weight*h,V=t.x*u+p+se.x,y=t.y*u+w+se.y;d.push({x:V,y,i:B,r:46}),z<F&&K.set([t.x,t.y,t.weight,26/u],4*z++),X.set([(V-p)/u,(y-w)/u,B,50],4*_++)}for(const t of[...O.keys()])D.has(t)||(O.delete(t),W.delete(t));R=h>.002?xe(R,e*h,u):[];for(const t of R){const l=de(t,h);d.push({x:t.x*u+p,y:t.y*u+w,i:l,r:30}),_<j+F&&X.set([t.x,t.y,l,26],4*_++)}const N=d.filter(t=>t.i>.003).sort((t,l)=>l.i-t.i).slice(0,G);g=N.length,$.fill(0),N.forEach((t,l)=>$.set([t.x,t.y,t.i,t.r],l*4));const H=c.items.length/4,L=c.itemIds??[];Y.fill(0);const C=new Set;for(let t=0;t<H;t++){const l=c.items[t*4]*u+p,x=c.items[t*4+1]*u+w,A=c.items[t*4+2]*u,T=c.items[t*4+3]*u,V=N.some(E=>E.x>l-k&&E.x<l+A+k&&E.y>x-k&&E.y<x+T+k)?we(l,x,A,T,N):0;t<M&&(Y[t]=V);const y=L[t];if(!y)continue;C.add(y);const S=be(I.get(y)??0,V);S!==null&&(s(y,S),S===0?I.delete(y):I.set(y,S))}for(const t of[...I.keys()])C.has(t)||(s(t,0),I.delete(t));return h>.002||R.length>0},draw(e,c){if(!i||!n||!f)return;const{view:u,width:p,height:w}=c,h=u.scale,P=Math.round(w*Ae);e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight),e.disable(e.DEPTH_TEST),e.disable(e.BLEND);const d=Math.min(c.items.length/4,M);e.bindVertexArray(b),e.useProgram(i),e.uniform3f(o.uView,h,u.tx,u.ty),e.uniform2f(o.uRes,p,w),e.uniform1f(o.uBufH,e.drawingBufferHeight),e.uniform1f(o.uDpr,e.drawingBufferWidth/Math.max(1,p)),e.uniform1f(o.uTime,U),e.uniform1f(o.uAmb,c.ambient),e.uniform1f(o.uHorizon,P),e.uniform1i(o.uNI,d),d>0&&(e.uniform4fv(o.uItems,c.items.subarray(0,d*4)),e.uniform1fv(o.uGlow,Y.subarray(0,d))),e.uniform4fv(o.uLight,$),e.uniform1i(o.uNL,g),e.drawArrays(e.TRIANGLES,0,3);const D=Se((Z*h-4)/7);if(D>=.01){const N=l=>{const x=Le*2**l,A=Z*1.2,T=-u.tx/h,B=(p-u.tx)/h,V=(Math.max(0,P)-u.ty)/h,y=(w-u.ty)/h,S=Math.floor((T-A)/x),E=Math.ceil((B+A)/x),ee=Math.floor((V-x)/x),ae=Math.ceil((y+A)/x);return{S:x,ix0:S,iy0:ee,cols:Math.max(0,E-S),rows:Math.max(0,ae-ee)}},H=Math.log2(1/h);let L=Math.max(0,Math.floor(H)),C=H<=0?1:1-(H-L),t=N(L);for(;t.cols*t.rows>Me&&L<12;)L++,C=1,t=N(L);e.useProgram(n),e.uniform3f(r.uView,h,u.tx,u.ty),e.uniform2f(r.uRes,p,w),e.uniform1f(r.uTime,U),e.uniform1f(r.uAmb,c.ambient),e.uniform1f(r.uLodA,D),e.uniform1f(r.uFade,C),e.uniform1f(r.uS,t.S),e.uniform1f(r.uH,Z),e.uniform1f(r.uHorizon,P),e.uniform2i(r.uCell0,t.ix0,t.iy0),e.uniform1i(r.uCols,Math.max(1,t.cols)),e.uniform1i(r.uLevel,L),c.trail&&(e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,c.trail)),e.uniform1i(r.uTrail,0),e.uniform3f(r.uTR,c.trailRect.x,c.trailRect.y,c.trailRect.size),e.uniform1f(r.uHasTrail,c.trail?1:0),e.uniform1i(r.uNP,z),z>0&&e.uniform4fv(r.uPtr,K.subarray(0,z*4)),e.uniform1i(r.uNI,d),d>0&&e.uniform4fv(r.uItems,c.items.subarray(0,d*4)),e.uniform4fv(r.uLight,$),e.uniform1i(r.uNL,g),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),t.cols*t.rows>0&&e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,t.cols*t.rows)}_>0&&(e.useProgram(f),e.uniform3f(a.uView,h,u.tx,u.ty),e.uniform2f(a.uRes,p,w),e.bindVertexArray(m),e.bindBuffer(e.ARRAY_BUFFER,v),e.bufferData(e.ARRAY_BUFFER,X.subarray(0,_*4),e.DYNAMIC_DRAW),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,_)),e.bindVertexArray(null),e.disable(e.BLEND)},dispose(e){ue(),i&&e.deleteProgram(i),n&&e.deleteProgram(n),f&&e.deleteProgram(f),b&&e.deleteVertexArray(b),m&&e.deleteVertexArray(m),v&&e.deleteBuffer(v),i=n=f=null,b=m=null,v=null,R=[]}}}export{Ae as HORIZON,se as LANTERN,He as createNight};
