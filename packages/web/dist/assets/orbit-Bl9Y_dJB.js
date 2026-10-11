import"./index-Dmoce6by.js";import{z as ie}from"./zoomfade-IveK8RfX.js";import{p as z,u as G,F as Y}from"./LivingGround-bb8g52rp.js";import"./groundmotion-BgiqVNMT.js";import"./CanvasThemeLayer-CgP33JmD.js";/* empty css               */const D=2048,J=16,ne=36,f=5,H=256,ae=15e3,ue=[5,6,12],se=[{rgb:[86,64,170],alpha:.24},{rgb:[24,86,140],alpha:.2},{rgb:[150,52,110],alpha:.14}],ce=[42,36,74],j=[[255,255,255],[198,216,255],[255,224,186]],N=i=>`vec3(${i.map(n=>(n/255).toFixed(4)).join(", ")})`,Z=`
precision highp float;
precision highp int;
uniform int uN;
uniform ivec2 uOrigin[${f}];
uniform int uLevel[${f}];
uniform float uCell[${f}];
uniform float uK[${f}];
uniform int uPeriod[${f}];
uniform vec3 uView;
uniform vec2 uRes;
int pmod(int a, int m) { return a - m * int(floor(float(a) / float(m))); }
ivec2 pmod2(ivec2 a, int m) { return ivec2(pmod(a.x, m), pmod(a.y, m)); }
uint hash3(ivec2 c, uint salt, int P) {
  ivec2 w = pmod2(c, P);
  uint h = uint(w.x) * 374761393u + uint(w.y) * 668265263u + salt * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
float rnd(ivec2 c, uint salt, int P) { return float(hash3(c, salt, P) & 0xffffu) / 65535.0; }
ivec2 cellOf(ivec2 slot, ivec2 origin) { return origin + pmod2(slot - origin, uN); }
uint saltOf(int r) { return uint(uLevel[r] + 64) * 7919u; }
// Where a star rests on screen: its world home, through the view, with its
// level's parallax.
vec2 homeOf(int r, ivec2 cell) {
  uint s = saltOf(r);
  int P = uPeriod[r];
  vec2 home = (vec2(cell) + vec2(rnd(cell, s + 1u, P), rnd(cell, s + 2u, P))) * uCell[r];
  return home * uView.x + uView.yz * uK[r] + (1.0 - uK[r]) * uRes * 0.5;
}
float rectSd(vec2 p, vec4 b) {
  vec2 c = b.xy + b.zw * 0.5; vec2 d = abs(p - c) - b.zw * 0.5;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
vec2 rectN(vec2 p, vec4 b) {
  vec2 c = b.xy + b.zw * 0.5; vec2 d = abs(p - c) - b.zw * 0.5; vec2 s = sign(p - c + 1e-4);
  return d.x > d.y ? vec2(s.x, 0.0) : vec2(0.0, s.y);
}
`,le=`#version 300 es
${Z}
uniform sampler2D uState;
uniform ivec2 uPrevOrigin[${f}];
uniform int uPrevLevel[${f}];
uniform float uDt;
uniform float uEase;
uniform float uDrift;
uniform float uClock;
uniform vec4 uP[16];
uniform int uNP;
uniform vec4 uItems[16];
uniform int uNI;
out vec4 o;
void main() {
  ivec2 ij = ivec2(gl_FragCoord.xy);
  int r = ij.y / uN;
  ivec2 slot = ivec2(ij.x, ij.y - r * uN);
  ivec2 cell = cellOf(slot, uOrigin[r]);
  vec4 st = texelFetch(uState, ij, 0);
  // A new star in this slot (the window moved, or the level changed): it
  // starts at home and at rest.
  if (uPrevLevel[r] != uLevel[r] || cellOf(slot, uPrevOrigin[r]) != cell) st = vec4(0.0);
  vec2 hs = homeOf(r, cell);
  vec2 off = st.xy, v = st.zw;
  vec2 p = hs + off;
  bool idle = st == vec4(0.0);
  if (uEase <= 0.0 || (idle && (any(lessThan(p, vec2(-420.0))) || any(greaterThan(p, uRes + 420.0))))) { o = st; return; }
  uint s = saltOf(r);
  int P = uPeriod[r];
  float d = 0.35 + 0.65 * rnd(cell, s + 3u, P);
  vec2 acc = vec2(0.0);
  float near = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= uNP) break;
    vec2 q = uP[i].xy - p; float rr = length(q);
    float nr = 1.0 - smoothstep(170.0, 360.0, rr);
    if (nr <= 0.0) continue;
    near = max(near, nr);
    vec2 dir = q / max(rr, 1.0);
    float G = 2.6e6 * uP[i].w * d;
    bool held = uP[i].z > 0.5;
    vec2 a = dir * (held ? -1.7 : 1.0) * G / (rr * rr + 2000.0);
    // Not held: a swirl, and a soft core so nothing piles onto the pointer.
    if (!held) { a += vec2(-dir.y, dir.x) * G * 0.45 / (rr * rr + 2000.0); a -= dir * 1300.0 * max(0.0, 1.0 - rr / 38.0); }
    float al = length(a); if (al > 2600.0) a *= 2600.0 / al;
    acc += a * nr;
  }
  for (int i = 0; i < 16; i++) {
    if (i >= uNI) break;
    float sd = rectSd(p, uItems[i]);
    if (sd < 10.0) acc += rectN(p, uItems[i]) * 1700.0 * (1.0 - smoothstep(-24.0, 10.0, sd));
  }
  // Home, gently — and hardly at all inside a cursor's reach, so the eddy holds.
  acc -= off * 2.2 * (1.0 - 0.85 * near);
  // Ambient drift: each star wanders a small slow circle about its home.
  float ang = uClock * (0.15 + 0.25 * rnd(cell, s + 4u, P)) + 6.2832 * rnd(cell, s + 5u, P);
  // The drift is ambient (none under Calm); the pull above is the cursor's.
  vec2 drift = vec2(cos(ang), sin(ang)) * 9.0 * d * uDrift;
  v += acc * uDt * uEase;
  v += (drift - v) * (1.0 - exp(-uDt * 1.7));
  float vl = length(v); if (vl > 700.0) v *= 700.0 / vl;
  off += v * uDt * uEase;
  float ol = length(off); if (ol > 600.0) off *= 600.0 / ol;
  o = vec4(off, v);
}`,fe=`#version 300 es
${Z}
uniform sampler2D uState;
uniform float uAlpha[${f}];
uniform float uRel[${f}];
uniform float uDpr;
uniform float uClock;
uniform float uAmb;
uniform vec4 uItems[16];
uniform int uNI;
out vec3 vC;
out float vCore;
out float vHalo;
void main() {
  int per = uN * uN;
  int r = gl_VertexID / per;
  int k = gl_VertexID - r * per;
  ivec2 slot = ivec2(k - (k / uN) * uN, k / uN);
  vC = vec3(0.0); vCore = 1.0; vHalo = 0.0;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = 0.0;
  if (uAlpha[r] <= 0.002) return;
  ivec2 cell = cellOf(slot, uOrigin[r]);
  vec4 st = texelFetch(uState, ivec2(slot.x, slot.y + r * uN), 0);
  vec2 p = homeOf(r, cell) + st.xy;
  if (any(lessThan(p, vec2(-16.0))) || any(greaterThan(p, uRes + 16.0))) return;
  uint s = saltOf(r);
  int P = uPeriod[r];
  // A star's magnitude: its level's rank in this view, and a little luck.
  float mag = uRel[r] + (rnd(cell, s + 6u, P) - 0.5) * 0.9;
  float tp = rnd(cell, s + 7u, P);
  vec3 c = tp < 0.55 ? ${N(j[0])} : tp < 0.83 ? ${N(j[1])} : ${N(j[2])};
  float bright = clamp(0.2 + 0.28 * mag, 0.08, 1.0);
  float tw = 1.0 + uAmb * 0.35 * sin(uClock * (1.0 + 3.0 * rnd(cell, s + 8u, P)) + 6.2832 * rnd(cell, s + 9u, P));
  float a = bright * tw * (1.0 + min(length(st.zw) / 260.0, 0.9)) * uAlpha[r];
  for (int i = 0; i < 16; i++) { if (i >= uNI) break; a *= mix(0.08, 1.0, smoothstep(-6.0, 6.0, rectSd(p, uItems[i]))); }
  float size = 1.4 + 1.25 * clamp(mag - 0.5, 0.0, 3.0);
  float halo = smoothstep(2.3, 3.2, mag);
  gl_PointSize = size * (1.0 + 3.0 * halo) * uDpr;
  vCore = 1.0 / (1.0 + 3.0 * halo);
  vHalo = halo;
  vC = c * a;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`,me=`#version 300 es
precision mediump float;
in vec3 vC;
in float vCore;
in float vHalo;
out vec4 o;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float core = smoothstep(vCore, vCore * 0.15, r);
  float h = 1.0 - smoothstep(0.0, 1.0, r);
  o = vec4(vC * (core + vHalo * 0.16 * h * h), 1.0);
}`,ve=`#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform vec3 uView;
uniform vec2 uRes;
uniform float uNeb;
uniform vec4 uItems[16];
uniform int uNI;
out vec4 o;
int pmod(int a, int m) { return a - m * int(floor(float(a) / float(m))); }
float rnd(ivec2 c, uint salt, int P) {
  ivec2 w = ivec2(pmod(c.x, P), pmod(c.y, P));
  uint h = uint(w.x) * 374761393u + uint(w.y) * 668265263u + salt * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return float((h ^ (h >> 16u)) & 0xffffu) / 65535.0;
}
float vnoise(vec2 w, float s, uint salt) {
  int P = int(${D.toFixed(1)} / s + 0.5);
  vec2 g = w / s; ivec2 i = ivec2(floor(g)); vec2 f = fract(g); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rnd(i, salt, P), rnd(i + ivec2(1, 0), salt, P), f.x), mix(rnd(i + ivec2(0, 1), salt, P), rnd(i + ivec2(1, 1), salt, P), f.x), f.y);
}
float fbm(vec2 w, uint salt) { return 0.5 * vnoise(w, 1024.0, salt) + 0.3 * vnoise(w, 512.0, salt + 7u) + 0.2 * vnoise(w, 256.0, salt + 13u); }
float rectSd(vec2 p, vec4 b) {
  vec2 c = b.xy + b.zw * 0.5; vec2 d = abs(p - c) - b.zw * 0.5;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
void main() {
  vec2 screen = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 w = (screen - uView.yz) / uView.x;
  vec3 c = ${N(ue)};
  ${se.map((i,n)=>`c = mix(c, ${N(i.rgb)}, ${i.alpha.toFixed(3)} * uNeb * smoothstep(${(.34+n*.04).toFixed(2)}, ${(.64+n*.05).toFixed(2)}, fbm(w + vec2(${n*311}.0, ${n*173}.0), ${n*31+3}u)));`).join(`
  `)}
  c = min(c, ${N(ce)});
  // Dark gaps round the items: they stand in a little shadow of their own.
  for (int i = 0; i < 16; i++) { if (i >= uNI) break; c *= 1.0 - 0.45 * exp(-max(rectSd(screen, uItems[i]), 0.0) / 26.0); }
  o = vec4(c, 1.0);
}`,de=(i,n,d)=>{const a=Math.min(1,Math.max(0,(d-i)/(n-i)));return a*a*(3-2*a)},I=(i,n)=>i-n*Math.floor(i/n);function he(i,n,d){const a=Math.max(n,d,1);let m=ne,p=Math.ceil(3.2*a/m)+2;p>H&&(m=3.2*a/(H-2),p=H);const v=i.scale,y=Math.log2(m/(J*v)),h=Math.ceil(y),T=h-y,u=new Array(f);for(let E=h-1;E<=h+3;E++){const w=J*2**E,A=E-y,b=.86+.14*de(-1,3,A),O=b*(n/2-i.tx)/v,L=b*(d/2-i.ty)/v,U=w>=1&&w<=D&&D%w===0?D/w:65536,S=E===h-1?T:E===h+3?1-T:1;u[I(E,f)]={level:E,cell:w,k:b,alpha:S,rel:A,period:U,ox:Math.floor(O/w)-(p>>1),oy:Math.floor(L/w)-(p>>1)}}return{key:`${v}|${i.tx}|${i.ty}|${n}|${d}`,n:p,regions:u}}function Q(i,n,d,a){const m=I(i,a),p=I(n,a);let v=Math.imul(m,374761393)+Math.imul(p,668265263)+Math.imul(d,-2048144777)>>>0;return v=Math.imul((v^v>>>13)>>>0,1274126177)>>>0,((v^v>>>16)&65535)/65535}function Fe(){let i=null,n=null,d=null,a={},m={},p={},v=null,y=[],h=[],T=0,u=0,E=0,w=null,A=null,b=null;const O=(e,t)=>{for(const r of y)e.deleteTexture(r);for(const r of h)e.deleteFramebuffer(r);y=[],h=[];for(let r=0;r<2;r++){const o=e.createTexture();e.bindTexture(e.TEXTURE_2D,o),e.texImage2D(e.TEXTURE_2D,0,e.RGBA32F,t,t*f,0,e.RGBA,e.FLOAT,new Float32Array(t*t*f*4)),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST);const l=e.createFramebuffer();if(e.bindFramebuffer(e.FRAMEBUFFER,l),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,o,0),e.checkFramebufferStatus(e.FRAMEBUFFER)!==e.FRAMEBUFFER_COMPLETE&&!e.isContextLost())throw new Error("no float render target for the stars");y.push(o),h.push(l)}e.bindFramebuffer(e.FRAMEBUFFER,null),u=t,T=0,w=null},L=(e,t)=>{const r=`${t.view.scale}|${t.view.tx}|${t.view.ty}|${t.width}|${t.height}`,o=b&&b.lay.key===r?b.lay:he(t.view,t.width,t.height);return o.n!==u&&O(e,o.n),b={lay:o,view:t.view,w:t.width,h:t.height},o},U=e=>{const t=Math.min(16,e.items.length/4),r=new Float32Array(64),{scale:o,tx:l,ty:c}=e.view;for(let x=0;x<t;x++)r[x*4]=e.items[x*4]*o+l,r[x*4+1]=e.items[x*4+1]*o+c,r[x*4+2]=e.items[x*4+2]*o,r[x*4+3]=e.items[x*4+3]*o;return{out:r,k:t}},S=(e,t,r,o)=>{const l=r.regions;e.uniform1i(t.uN,r.n),e.uniform2iv(t.uOrigin,new Int32Array(l.flatMap(c=>[c.ox,c.oy]))),e.uniform1iv(t.uLevel,new Int32Array(l.map(c=>c.level))),e.uniform1fv(t.uCell,new Float32Array(l.map(c=>c.cell))),e.uniform1fv(t.uK,new Float32Array(l.map(c=>c.k))),e.uniform1iv(t.uPeriod,new Int32Array(l.map(c=>c.period))),e.uniform3f(t.uView,o.view.scale,o.view.tx,o.view.ty),e.uniform2f(t.uRes,o.width,o.height)};return{name:"galaxy",cursor:"sparkle",restWindow:ae,setup(e){if(!e.getExtension("EXT_color_buffer_float"))throw new Error("no float render targets for the stars");i=z(e,Y,le),n=z(e,fe,me),d=z(e,Y,ve),a=G(e,i),m=G(e,n),p=G(e,d),v=e.createVertexArray(),y=[],h=[],u=0,b=null},step(e,t){return E+=e*t.ambient,A={dt:e,ease:t.ease,drift:t.ambient},t.ease>.002},draw(e,t){if(!i||!n||!d)return;const r=L(e,t),o=U(t);if(e.bindVertexArray(v),e.disable(e.DEPTH_TEST),e.disable(e.BLEND),A){const{dt:l,ease:c,drift:x}=A;A=null;const _=1-T;e.bindFramebuffer(e.FRAMEBUFFER,h[_]),e.viewport(0,0,u,u*f),e.useProgram(i),S(e,a,r,t);const F=w&&w.n===r.n?w.regions:null;e.uniform2iv(a.uPrevOrigin,new Int32Array(r.regions.flatMap((P,s)=>F?[F[s].ox,F[s].oy]:[0,0]))),e.uniform1iv(a.uPrevLevel,new Int32Array(r.regions.map((P,s)=>F?F[s].level:-9999))),e.uniform1f(a.uDt,l),e.uniform1f(a.uEase,c),e.uniform1f(a.uDrift,x),e.uniform1f(a.uClock,E);const k=new Float32Array(64);let R=0;for(const P of t.pointers){if(R>=16)break;k.set([P.x*t.view.scale+t.view.tx,P.y*t.view.scale+t.view.ty,P.held?1:0,P.weight],R*4),R++}e.uniform4fv(a.uP,k),e.uniform1i(a.uNP,R),e.uniform4fv(a.uItems,o.out),e.uniform1i(a.uNI,o.k),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,y[T]),e.uniform1i(a.uState,0),e.drawArrays(e.TRIANGLES,0,3),T=_,w=r}e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight),e.useProgram(d),e.uniform3f(p.uView,t.view.scale,t.view.tx,t.view.ty),e.uniform2f(p.uRes,t.width,t.height),e.uniform1f(p.uNeb,ie(t.view.scale,.1,.5)),e.uniform4fv(p.uItems,o.out),e.uniform1i(p.uNI,o.k),e.drawArrays(e.TRIANGLES,0,3),e.useProgram(n),S(e,m,r,t),e.uniform1fv(m.uAlpha,new Float32Array(r.regions.map(l=>l.alpha))),e.uniform1fv(m.uRel,new Float32Array(r.regions.map(l=>l.rel))),e.uniform1f(m.uDpr,t.dpr),e.uniform1f(m.uClock,E),e.uniform1f(m.uAmb,t.ambient),e.uniform4fv(m.uItems,o.out),e.uniform1i(m.uNI,o.k),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,y[T]),e.uniform1i(m.uState,0),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE),e.drawArrays(e.POINTS,0,u*u*f),e.disable(e.BLEND)},readback(e,t,r,o){if(!b||!h.length)return null;const{lay:l,view:c,w:x,h:_}=b,F=new Float32Array(u*u*f*4);e.bindFramebuffer(e.FRAMEBUFFER,h[T]),e.readPixels(0,0,u,u*f,e.RGBA,e.FLOAT,F),e.bindFramebuffer(e.FRAMEBUFFER,null);let k=0,R=0,P=0;return l.regions.forEach((s,g)=>{if(s.alpha<.05)return;const K=(s.level+64)*7919;for(let $=0;$<u;$++)for(let M=0;M<u;M++){const B=s.ox+I(M-s.ox,u),V=s.oy+I($-s.oy,u),ee=(B+Q(B,V,K+1,s.period))*s.cell*c.scale+c.tx*s.k+(1-s.k)*x*.5,te=(V+Q(B,V,K+2,s.period))*s.cell*c.scale+c.ty*s.k+(1-s.k)*_*.5,C=((g*u+$)*u+M)*4,re=ee+F[C],oe=te+F[C+1],q=re-t,W=oe-r,X=Math.hypot(q,W);X>o||(k+=s.alpha,X>1&&(R+=(F[C+2]*q+F[C+3]*W)/X,P++))}}),{count:k,radial:P?R/P:0}},dispose(e){for(const t of y)e.deleteTexture(t);for(const t of h)e.deleteFramebuffer(t);i&&e.deleteProgram(i),n&&e.deleteProgram(n),d&&e.deleteProgram(d),v&&e.deleteVertexArray(v),y=[],h=[],i=n=d=null,v=null}}}export{ae as EDDY_MS,se as NEBULA,ce as SKY_CAP,ue as SPACE,j as STAR_TINTS,D as TILE,Fe as createOrbit,he as layout};
