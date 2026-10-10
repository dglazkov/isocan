import"./index-D_y8oGe9.js";import{z as ie}from"./zoomfade-IveK8RfX.js";import{p as z,u as G,F as Y}from"./LivingGround-DigOROyV.js";import"./CanvasThemeLayer-Co9LQ3he.js";/* empty css               */const O=2048,J=16,ne=36,l=5,H=256,ae=15e3,ue=[5,6,12],se=[{rgb:[86,64,170],alpha:.24},{rgb:[24,86,140],alpha:.2},{rgb:[150,52,110],alpha:.14}],ce=[42,36,74],j=[[255,255,255],[198,216,255],[255,224,186]],I=i=>`vec3(${i.map(n=>(n/255).toFixed(4)).join(", ")})`,Z=`
precision highp float;
precision highp int;
uniform int uN;
uniform ivec2 uOrigin[${l}];
uniform int uLevel[${l}];
uniform float uCell[${l}];
uniform float uK[${l}];
uniform int uPeriod[${l}];
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
uniform ivec2 uPrevOrigin[${l}];
uniform int uPrevLevel[${l}];
uniform float uDt;
uniform float uEase;
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
  vec2 drift = vec2(cos(ang), sin(ang)) * 9.0 * d * uEase;
  v += acc * uDt * uEase;
  v += (drift - v) * (1.0 - exp(-uDt * 1.7));
  float vl = length(v); if (vl > 700.0) v *= 700.0 / vl;
  off += v * uDt * uEase;
  float ol = length(off); if (ol > 600.0) off *= 600.0 / ol;
  o = vec4(off, v);
}`,fe=`#version 300 es
${Z}
uniform sampler2D uState;
uniform float uAlpha[${l}];
uniform float uRel[${l}];
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
  vec3 c = tp < 0.55 ? ${I(j[0])} : tp < 0.83 ? ${I(j[1])} : ${I(j[2])};
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
  int P = int(${O.toFixed(1)} / s + 0.5);
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
  vec3 c = ${I(ue)};
  ${se.map((i,n)=>`c = mix(c, ${I(i.rgb)}, ${i.alpha.toFixed(3)} * uNeb * smoothstep(${(.34+n*.04).toFixed(2)}, ${(.64+n*.05).toFixed(2)}, fbm(w + vec2(${n*311}.0, ${n*173}.0), ${n*31+3}u)));`).join(`
  `)}
  c = min(c, ${I(ce)});
  // Dark gaps round the items: they stand in a little shadow of their own.
  for (int i = 0; i < 16; i++) { if (i >= uNI) break; c *= 1.0 - 0.45 * exp(-max(rectSd(screen, uItems[i]), 0.0) / 26.0); }
  o = vec4(c, 1.0);
}`,de=(i,n,v)=>{const a=Math.min(1,Math.max(0,(v-i)/(n-i)));return a*a*(3-2*a)},S=(i,n)=>i-n*Math.floor(i/n);function he(i,n,v){const a=Math.max(n,v,1);let f=ne,x=Math.ceil(3.2*a/f)+2;x>H&&(f=3.2*a/(H-2),x=H);const m=i.scale,y=Math.log2(f/(J*m)),d=Math.ceil(y),F=d-y,u=new Array(l);for(let E=d-1;E<=d+3;E++){const w=J*2**E,R=E-y,b=.86+.14*de(-1,3,R),D=b*(n/2-i.tx)/m,L=b*(v/2-i.ty)/m,U=w>=1&&w<=O&&O%w===0?O/w:65536,_=E===d-1?F:E===d+3?1-F:1;u[S(E,l)]={level:E,cell:w,k:b,alpha:_,rel:R,period:U,ox:Math.floor(D/w)-(x>>1),oy:Math.floor(L/w)-(x>>1)}}return{key:`${m}|${i.tx}|${i.ty}|${n}|${v}`,n:x,regions:u}}function Q(i,n,v,a){const f=S(i,a),x=S(n,a);let m=Math.imul(f,374761393)+Math.imul(x,668265263)+Math.imul(v,-2048144777)>>>0;return m=Math.imul((m^m>>>13)>>>0,1274126177)>>>0,((m^m>>>16)&65535)/65535}function be(){let i=null,n=null,v=null,a={},f={},x={},m=null,y=[],d=[],F=0,u=0,E=0,w=null,R=null,b=null;const D=(e,t)=>{for(const r of y)e.deleteTexture(r);for(const r of d)e.deleteFramebuffer(r);y=[],d=[];for(let r=0;r<2;r++){const o=e.createTexture();e.bindTexture(e.TEXTURE_2D,o),e.texImage2D(e.TEXTURE_2D,0,e.RGBA32F,t,t*l,0,e.RGBA,e.FLOAT,new Float32Array(t*t*l*4)),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST);const c=e.createFramebuffer();if(e.bindFramebuffer(e.FRAMEBUFFER,c),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,o,0),e.checkFramebufferStatus(e.FRAMEBUFFER)!==e.FRAMEBUFFER_COMPLETE&&!e.isContextLost())throw new Error("no float render target for the stars");y.push(o),d.push(c)}e.bindFramebuffer(e.FRAMEBUFFER,null),u=t,F=0,w=null},L=(e,t)=>{const r=`${t.view.scale}|${t.view.tx}|${t.view.ty}|${t.width}|${t.height}`,o=b&&b.lay.key===r?b.lay:he(t.view,t.width,t.height);return o.n!==u&&D(e,o.n),b={lay:o,view:t.view,w:t.width,h:t.height},o},U=e=>{const t=Math.min(16,e.items.length/4),r=new Float32Array(64),{scale:o,tx:c,ty:s}=e.view;for(let h=0;h<t;h++)r[h*4]=e.items[h*4]*o+c,r[h*4+1]=e.items[h*4+1]*o+s,r[h*4+2]=e.items[h*4+2]*o,r[h*4+3]=e.items[h*4+3]*o;return{out:r,k:t}},_=(e,t,r,o)=>{const c=r.regions;e.uniform1i(t.uN,r.n),e.uniform2iv(t.uOrigin,new Int32Array(c.flatMap(s=>[s.ox,s.oy]))),e.uniform1iv(t.uLevel,new Int32Array(c.map(s=>s.level))),e.uniform1fv(t.uCell,new Float32Array(c.map(s=>s.cell))),e.uniform1fv(t.uK,new Float32Array(c.map(s=>s.k))),e.uniform1iv(t.uPeriod,new Int32Array(c.map(s=>s.period))),e.uniform3f(t.uView,o.view.scale,o.view.tx,o.view.ty),e.uniform2f(t.uRes,o.width,o.height)};return{name:"galaxy",cursor:"sparkle",restWindow:ae,setup(e){if(!e.getExtension("EXT_color_buffer_float"))throw new Error("no float render targets for the stars");i=z(e,Y,le),n=z(e,fe,me),v=z(e,Y,ve),a=G(e,i),f=G(e,n),x=G(e,v),m=e.createVertexArray(),y=[],d=[],u=0,b=null},step(e,t){return E+=e*t.ambient,R={dt:e,ambient:t.ambient},t.ambient>.002},draw(e,t){if(!i||!n||!v)return;const r=L(e,t),o=U(t);if(e.bindVertexArray(m),e.disable(e.DEPTH_TEST),e.disable(e.BLEND),R){const{dt:c,ambient:s}=R;R=null;const h=1-F;e.bindFramebuffer(e.FRAMEBUFFER,d[h]),e.viewport(0,0,u,u*l),e.useProgram(i),_(e,a,r,t);const N=w&&w.n===r.n?w.regions:null;e.uniform2iv(a.uPrevOrigin,new Int32Array(r.regions.flatMap((P,T)=>N?[N[T].ox,N[T].oy]:[0,0]))),e.uniform1iv(a.uPrevLevel,new Int32Array(r.regions.map((P,T)=>N?N[T].level:-9999))),e.uniform1f(a.uDt,c),e.uniform1f(a.uEase,s),e.uniform1f(a.uClock,E);const A=new Float32Array(64);let k=0;for(const P of t.pointers){if(k>=16)break;A.set([P.x*t.view.scale+t.view.tx,P.y*t.view.scale+t.view.ty,P.held?1:0,P.weight],k*4),k++}e.uniform4fv(a.uP,A),e.uniform1i(a.uNP,k),e.uniform4fv(a.uItems,o.out),e.uniform1i(a.uNI,o.k),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,y[F]),e.uniform1i(a.uState,0),e.drawArrays(e.TRIANGLES,0,3),F=h,w=r}e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight),e.useProgram(v),e.uniform3f(x.uView,t.view.scale,t.view.tx,t.view.ty),e.uniform2f(x.uRes,t.width,t.height),e.uniform1f(x.uNeb,ie(t.view.scale,.1,.5)),e.uniform4fv(x.uItems,o.out),e.uniform1i(x.uNI,o.k),e.drawArrays(e.TRIANGLES,0,3),e.useProgram(n),_(e,f,r,t),e.uniform1fv(f.uAlpha,new Float32Array(r.regions.map(c=>c.alpha))),e.uniform1fv(f.uRel,new Float32Array(r.regions.map(c=>c.rel))),e.uniform1f(f.uDpr,t.dpr),e.uniform1f(f.uClock,E),e.uniform1f(f.uAmb,t.ambient),e.uniform4fv(f.uItems,o.out),e.uniform1i(f.uNI,o.k),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,y[F]),e.uniform1i(f.uState,0),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE),e.drawArrays(e.POINTS,0,u*u*l),e.disable(e.BLEND)},readback(e,t,r,o){if(!b||!d.length)return null;const{lay:c,view:s,w:h,h:N}=b,A=new Float32Array(u*u*l*4);e.bindFramebuffer(e.FRAMEBUFFER,d[F]),e.readPixels(0,0,u,u*l,e.RGBA,e.FLOAT,A),e.bindFramebuffer(e.FRAMEBUFFER,null);let k=0,P=0,T=0;return c.regions.forEach((p,g)=>{if(p.alpha<.05)return;const K=(p.level+64)*7919;for(let $=0;$<u;$++)for(let M=0;M<u;M++){const B=p.ox+S(M-p.ox,u),V=p.oy+S($-p.oy,u),ee=(B+Q(B,V,K+1,p.period))*p.cell*s.scale+s.tx*p.k+(1-p.k)*h*.5,te=(V+Q(B,V,K+2,p.period))*p.cell*s.scale+s.ty*p.k+(1-p.k)*N*.5,C=((g*u+$)*u+M)*4,re=ee+A[C],oe=te+A[C+1],q=re-t,W=oe-r,X=Math.hypot(q,W);X>o||(k+=p.alpha,X>1&&(P+=(A[C+2]*q+A[C+3]*W)/X,T++))}}),{count:k,radial:T?P/T:0}},dispose(e){for(const t of y)e.deleteTexture(t);for(const t of d)e.deleteFramebuffer(t);i&&e.deleteProgram(i),n&&e.deleteProgram(n),v&&e.deleteProgram(v),m&&e.deleteVertexArray(m),y=[],d=[],i=n=v=null,m=null}}}export{ae as EDDY_MS,se as NEBULA,ce as SKY_CAP,ue as SPACE,j as STAR_TINTS,O as TILE,be as createOrbit,he as layout};
