import{T as l,a as F,p as _,u as y,F as M}from"./LivingGround-bb8g52rp.js";/* empty css             */import"./index-Dmoce6by.js";import"./groundmotion-BgiqVNMT.js";import"./CanvasThemeLayer-CgP33JmD.js";/* empty css               */const X=.05,U=1/255;function B(f,n,u=X){const a=f+Math.max(0,n)*u,c=Math.floor(a/U+1e-9);return{fill:c*U,carry:a-c*U}}const S=250,H=1400,V=2.5;function C(f,n){return n?Math.min(1,Math.max(0,(f-S)/(H-S))):0}function O(f,n,u){const a=f+(n-f)*(1-Math.exp(-u*V));return a<.01&&n===0?0:a}const q=1024,I=16,$=9,W=`
uniform float uTile;
uint hash3(ivec2 c, uint salt, ivec2 period) {
  ivec2 w = ((c % period) + period) % period;
  uint h = uint(w.x) * 374761393u + uint(w.y) * 668265263u + salt * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
float rnd(ivec2 c, uint salt, ivec2 period) { return float(hash3(c, salt, period) & 0xffffu) / 65535.0; }
float vnoise(vec2 w, vec2 s, uint salt) {
  ivec2 P = ivec2(uTile / s + 0.5);
  vec2 g = w / s;
  ivec2 i = ivec2(floor(g));
  vec2 f = fract(g);
  f = f * f * (3.0 - 2.0 * f);
  float a = rnd(i, salt, P), b = rnd(i + ivec2(1, 0), salt, P);
  float c = rnd(i + ivec2(0, 1), salt, P), d = rnd(i + ivec2(1, 1), salt, P);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`,K=`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrev;
uniform sampler2D uTrail;
uniform vec3 uRect;
uniform vec3 uPrevRect;
uniform float uFill;
uniform float uHasPrev;
uniform float uHasTrail;
out vec4 o;
void main() {
  vec2 w = uRect.xy + vUv * uRect.z;
  vec2 puv = (w - uPrevRect.xy) / uPrevRect.z;
  float v = 0.0;
  if (uHasPrev > 0.5 && all(greaterThanEqual(puv, vec2(0.0))) && all(lessThanEqual(puv, vec2(1.0)))) v = texture(uPrev, puv).r;
  v = max(v - uFill, 0.0);
  if (uHasTrail > 0.5) v = max(v, smoothstep(0.3, 0.75, texture(uTrail, vUv).r));
  o = vec4(v, 0.0, 0.0, 1.0);
}`,Q=`#version 300 es
precision highp float;
precision highp int;
${W}
in vec2 vUv;
uniform vec3 uView;
uniform vec2 uRes;
uniform sampler2D uPack;
uniform vec3 uPR;
uniform float uHasPack;
uniform vec4 uItems[${I}];
uniform int uNI;
out vec4 o;

float packAt(vec2 w) {
  vec2 uv = (w - uPR.xy) / uPR.z;
  if (uHasPack < 0.5 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return texture(uPack, uv).r;
}
float rectSd(vec2 p, vec4 r) { vec2 c = r.xy + r.zw * 0.5; vec2 d = abs(p - c) - r.zw * 0.5; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
vec2 rectN(vec2 p, vec4 r) { vec2 q = p - (r.xy + r.zw * 0.5); vec2 d = abs(q) - r.zw * 0.5; return d.x > d.y ? vec2(sign(q.x), 0.0) : vec2(0.0, sign(q.y)); }
// The swells: long wind-drawn ridges and softer hummocks, in world units of height.
float swell(vec2 w) {
  return vnoise(w, vec2(256.0), 1u) * 34.0 + vnoise(w, vec2(128.0, 64.0), 2u) * 6.0 + vnoise(w, vec2(64.0), 3u) * 6.0 + vnoise(w, vec2(16.0), 4u) * 0.8;
}

void main() {
  vec2 scr = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 w = (scr - uView.yz) / uView.x;
  float e = max(1.5 / uView.x, 2.0);
  vec2 g = vec2(swell(w + vec2(e, 0.0)) - swell(w - vec2(e, 0.0)), swell(w + vec2(0.0, e)) - swell(w - vec2(0.0, e))) / (2.0 * e);

  // The trodden trail: a groove pressed into the swells.
  float p = packAt(w);
  float te = uPR.z / ${l.toFixed(1)};
  vec2 gp = vec2(packAt(w + vec2(te, 0.0)) - packAt(w - vec2(te, 0.0)), packAt(w + vec2(0.0, te)) - packAt(w - vec2(0.0, te))) / (2.0 * te);
  g -= gp * ${$.toFixed(1)};

  // Drifts banked against every item, higher on the lee (lower right) side.
  float contact = 0.0;
  float bank = 0.0;
  for (int i = 0; i < ${I}; i++) {
    if (i >= uNI) break;
    float sd = rectSd(w, uItems[i]);
    if (sd > 0.0 && sd < 120.0) {
      vec2 n = rectN(w, uItems[i]);
      float lee = 0.75 + 0.6 * max(dot(n, vec2(0.6, 0.8)), 0.0);
      float R = 28.0 * lee;
      float h = 14.0 * lee * exp(-sd / R);
      g -= n * h / R;
      bank = max(bank, h / 14.0);
      contact = max(contact, exp(-sd / 5.0));
    }
  }

  vec3 N = normalize(vec3(-g, 1.0));
  vec3 L = normalize(vec3(-0.55, -0.65, 0.75));
  float dif = clamp(dot(N, L), 0.0, 1.0);
  vec3 shade = vec3(0.64, 0.71, 0.84);
  vec3 lit = vec3(0.93, 0.95, 0.99);
  vec3 c = mix(shade, lit, smoothstep(0.35, 0.92, dif));
  // The bottom of a fresh print is a little bluer; a drift's crest a little brighter.
  c = mix(c, c * vec3(0.84, 0.89, 0.98), smoothstep(0.05, 0.7, p) * 0.7);
  c += vec3(0.03, 0.03, 0.035) * bank;
  c *= 1.0 - 0.2 * contact;

  // Crystals catching the light on the sunny slopes; gone when too small to see.
  float cell = 8.0;
  ivec2 P = ivec2(uTile / cell + 0.5);
  ivec2 ci = ivec2(floor(w / cell));
  if (rnd(ci, 7u, P) > 0.97) {
    vec2 at = (vec2(ci) + 0.2 + 0.6 * vec2(rnd(ci, 8u, P), rnd(ci, 9u, P))) * cell;
    float d = length(w - at) * uView.x;
    float s = (1.0 - smoothstep(0.0, 1.4, d)) * smoothstep(0.62, 0.8, dif) * smoothstep(2.0, 6.0, cell * uView.x);
    c += vec3(0.5, 0.58, 0.7) * s * (1.0 - p);
  }
  o = vec4(c, 1.0);
}`,Y=`#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform float uT;
uniform float uAmb;
uniform vec4 uGust[${F}];   // screen x, y, signed strength, radius
uniform int uNG;
out vec2 vQ;
out float vA;
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float h(uint i, uint salt) { return float(pcg(i * 1973u + pcg(salt))) * (1.0 / 4294967296.0); }
void main() {
  uint id = uint(gl_InstanceID);
  float a = h(id, 1u), b = h(id, 2u), z = h(id, 3u), ph = h(id, 4u);
  float near = z * z;
  float W = uRes.x + 60.0, H = uRes.y + 60.0;
  float fall = mix(14.0, 46.0, near);
  vec2 p = vec2(mod(a * W + uT * (5.0 + 9.0 * near) + sin(uT * (0.5 + ph) + ph * 6.283) * (6.0 + 14.0 * near), W) - 30.0,
                mod(b * H + uT * fall, H) - 30.0);
  for (int i = 0; i < ${F}; i++) {
    if (i >= uNG) break;
    vec2 d = p - uGust[i].xy;
    float Ld = length(d), R = uGust[i].w;
    if (Ld < R && Ld > 1e-3) {
      float f = 1.0 - Ld / R;
      f = f * f * uGust[i].z;
      float an = f * 2.6;
      float cs = cos(an), sn = sin(an);
      p = uGust[i].xy + mat2(cs, sn, -sn, cs) * d * (1.0 + abs(f) * 0.35);
    }
  }
  vec2 q = vec2((gl_VertexID & 1) == 1 ? 1.0 : -1.0, (gl_VertexID & 2) == 2 ? 1.0 : -1.0);
  vQ = q;
  vA = uAmb * mix(0.4, 0.95, near);
  vec2 s = p + q * mix(1.1, 3.4, near) * 1.6;
  gl_Position = vec4(s.x / uRes.x * 2.0 - 1.0, 1.0 - s.y / uRes.y * 2.0, 0.0, 1.0);
}`,Z=`#version 300 es
precision mediump float;
in vec2 vQ;
in float vA;
out vec4 o;
void main() {
  float a = vA * (1.0 - smoothstep(0.35, 1.0, length(vQ)));
  o = vec4(vec3(1.0) * a, a);
}`;function re(){let f=null,n=null,u=null,a=null,c={},v={},h={},P=null,x=[],R=[],b=0,s={x:0,y:0,size:1},d=!1,L=0,D=0,k=0;const p=new Map,N=new Float32Array(F*4);let w=0;const G=e=>{for(const t of x)e.deleteTexture(t);for(const t of R)e.deleteFramebuffer(t);x=[],R=[],d=!1};return{name:"snow",cursor:"sparkle",setup(e){f=e,n=_(e,M,K),u=_(e,M,Q),a=_(e,Y,Z),c=y(e,n),v=y(e,u),h=y(e,a),P=e.createVertexArray(),x=[],R=[],d=!1;for(let t=0;t<2;t++){const i=e.createTexture();e.bindTexture(e.TEXTURE_2D,i),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,l,l,0,e.RGBA,e.UNSIGNED_BYTE,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);const o=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,o),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,i,0),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT),x.push(i),R.push(o)}e.bindFramebuffer(e.FRAMEBUFFER,null)},step(e,t){k=e,L+=e*t.ambient;const i=performance.now(),{scale:o,tx:m,ty:T}=t.view;w=0;const E=new Set;for(const r of t.pointers){E.add(r.id);const A=O(p.get(r.id)??0,C(r.speed,i-r.at<250)*r.weight,e);if(A===0){p.delete(r.id);continue}p.set(r.id,A);const z=r.x>=r.px?1:-1;w<F&&N.set([r.x*o+m,r.y*o+T,A*z,150],4*w++)}for(const r of[...p.keys()])E.has(r)||p.delete(r);return t.ambient>.002||p.size>0},draw(e,t){if(!n||!u||!a)return;const{view:i,width:o,height:m}=t;if(e.bindVertexArray(P),e.disable(e.DEPTH_TEST),e.disable(e.BLEND),t.trail||d){const E=B(D,k);D=E.carry;const r=t.trailRect,A=1-b;e.bindFramebuffer(e.FRAMEBUFFER,R[A]),e.viewport(0,0,l,l),e.useProgram(n),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,x[b]),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,t.trail),e.uniform1i(c.uPrev,0),e.uniform1i(c.uTrail,1),e.uniform3f(c.uRect,r.x,r.y,r.size),e.uniform3f(c.uPrevRect,s.x,s.y,s.size),e.uniform1f(c.uFill,E.fill),e.uniform1f(c.uHasPrev,d?1:0),e.uniform1f(c.uHasTrail,t.trail?1:0),e.drawArrays(e.TRIANGLES,0,3),e.bindFramebuffer(e.FRAMEBUFFER,null),e.activeTexture(e.TEXTURE0),b=A,s={...r},d=!0}e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight),e.useProgram(u),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,d?x[b]:null),e.uniform1f(v.uTile,q),e.uniform3f(v.uView,i.scale,i.tx,i.ty),e.uniform2f(v.uRes,o,m),e.uniform1i(v.uPack,0),e.uniform3f(v.uPR,s.x,s.y,s.size),e.uniform1f(v.uHasPack,d?1:0);const T=Math.min(t.items.length/4,I);if(e.uniform1i(v.uNI,T),T>0&&e.uniform4fv(v.uItems,t.items.subarray(0,T*4)),e.drawArrays(e.TRIANGLES,0,3),t.ambient>.002){const E=Math.round(Math.min(900,Math.max(150,o*m/2400)));e.useProgram(a),e.uniform2f(h.uRes,o,m),e.uniform1f(h.uT,L),e.uniform1f(h.uAmb,t.ambient),e.uniform1i(h.uNG,w),w>0&&e.uniform4fv(h.uGust,N.subarray(0,w*4)),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,E),e.disable(e.BLEND)}e.bindVertexArray(null)},trodden(e,t){const i=f;if(!i||!d||i.isContextLost())return 0;const o=Math.floor((e-s.x)/s.size*l),m=Math.floor((t-s.y)/s.size*l);if(o<0||m<0||o>=l||m>=l)return 0;const T=new Uint8Array(4);return i.bindFramebuffer(i.FRAMEBUFFER,R[b]),i.readPixels(o,m,1,1,i.RGBA,i.UNSIGNED_BYTE,T),i.bindFramebuffer(i.FRAMEBUFFER,null),T[0]/255},dispose(e){n&&e.deleteProgram(n),u&&e.deleteProgram(u),a&&e.deleteProgram(a),P&&e.deleteVertexArray(P),G(e),n=u=a=null,P=null,f=null,p.clear()}}}export{q as TILE,re as createSnow};
