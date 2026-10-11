import{s as H,R as L,S as z,T as O,r as $,a as j}from"./rake-jihJIAXg.js";import{p as D,u as V,F as X}from"./LivingGround-bb8g52rp.js";/* empty css            */import"./index-Dmoce6by.js";import"./groundmotion-BgiqVNMT.js";import"./CanvasThemeLayer-CgP33JmD.js";/* empty css               */const K=1024,f=512,C=O*6,A=16,Z=`#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uPrev;
uniform vec3 uRect;
uniform vec3 uPrevRect;
uniform float uN;
uniform float uR;
uniform float uNow;
uniform int uNS;
uniform vec4 uSeg[16];
out vec4 o;
void main() {
  vec2 w = uRect.xy + gl_FragCoord.xy / uN * uRect.z;
  ivec2 pi = ivec2(floor((w - uPrevRect.xy) / uPrevRect.z * uN));
  vec4 v = vec4(0.0);
  if (all(greaterThanEqual(pi, ivec2(0))) && all(lessThan(pi, ivec2(int(uN))))) v = texelFetch(uPrev, pi, 0);
  for (int i = 0; i < 16; i++) {
    if (i >= uNS) break;
    vec2 a = uSeg[i].xy, ba = uSeg[i].zw - a;
    float l2 = dot(ba, ba);
    if (l2 < 1e-6) continue;
    vec2 q = w - a;
    float along = dot(q, ba);
    if (along < 0.0) continue;
    vec2 e = q - ba * min(1.0, along / l2);
    float dist = length(e);
    if (dist >= uR) continue;
    v = vec4((ba.x * q.y - ba.y * q.x >= 0.0 ? 1.0 : -1.0) * dist, uNow + 1.0, 0.0, 1.0);
  }
  o = v;
}`,W=`#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform vec3 uView;
uniform vec2 uRes;
uniform float uTile;
uniform float uClock;
uniform float uSoften;
uniform float uR;
uniform highp sampler2D uRake;
uniform vec3 uRakeRect;
uniform float uRakeN;
uniform float uHasRake;
uniform int uNI;
uniform vec4 uItems[${A}];
out vec4 o;
const float TAU = 6.2831853;
const float TINE = ${O.toFixed(1)};
uint hash3(ivec2 c, uint salt, ivec2 period) {
  ivec2 w = ((c % period) + period) % period;
  uint h = uint(w.x) * 374761393u + uint(w.y) * 668265263u + salt * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
float rnd(ivec2 c, uint salt, ivec2 period) { return float(hash3(c, salt, period) & 0xffffu) / 65535.0; }
float vnoise(vec2 w, float s, uint salt) {
  ivec2 P = ivec2(int(uTile / s + 0.5));
  vec2 g = w / s; ivec2 i = ivec2(floor(g)); vec2 f = fract(g); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rnd(i, salt, P), rnd(i + ivec2(1, 0), salt, P), f.x), mix(rnd(i + ivec2(0, 1), salt, P), rnd(i + ivec2(1, 1), salt, P), f.x), f.y);
}
float rectSd(vec2 p, vec4 r) { vec2 c = r.xy + r.zw * 0.5; vec2 d = abs(p - c) - r.zw * 0.5; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

// How raked a point is (x) and its offset across the stroke (y), blended
// from the four nearest texels by how raked each one still is.
vec2 rake(vec2 w) {
  if (uHasRake < 0.5) return vec2(0.0);
  vec2 pc = (w - uRakeRect.xy) / uRakeRect.z * uRakeN - 0.5;
  ivec2 i0 = ivec2(floor(pc));
  vec2 f = fract(pc);
  float sw = 0.0, sd = 0.0;
  for (int k = 0; k < 4; k++) {
    ivec2 c = i0 + ivec2(k & 1, k >> 1);
    if (any(lessThan(c, ivec2(0))) || any(greaterThanEqual(c, ivec2(int(uRakeN))))) continue;
    vec4 t = texelFetch(uRake, c, 0);
    if (t.g < 0.5) continue;
    float s = clamp(1.0 - (uClock - (t.g - 1.0)) / uSoften, 0.0, 1.0);
    s *= 1.0 - smoothstep(0.75 * uR, uR, abs(t.r));
    float wt = ((k & 1) == 1 ? f.x : 1.0 - f.x) * ((k >> 1) == 1 ? f.y : 1.0 - f.y);
    sw += wt * s;
    sd += wt * s * t.r;
  }
  return vec2(sw, sw > 1e-4 ? sd / sw : 0.0);
}

// The sand's height: the base lines, the rings round each stone, the rake on top.
float sand(vec2 w, out float raked) {
  float off = 2.5 * sin(w.x * TAU / 512.0) + 1.5 * sin(w.y * TAU / 1024.0 + 1.3);
  float h = cos(TAU * (w.y + off) / TINE);
  float sdm = 1e9;
  for (int i = 0; i < ${A}; i++) { if (i >= uNI) break; sdm = min(sdm, rectSd(w, uItems[i])); }
  h = mix(h, cos(TAU * max(sdm, 0.0) / TINE), 1.0 - smoothstep(${(C*.8).toFixed(1)}, ${C.toFixed(1)}, sdm));
  vec2 r = rake(w);
  raked = r.x;
  return mix(h, cos(TAU * r.y / TINE), r.x);
}

void main() {
  vec2 screen = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 w = (screen - uView.yz) / uView.x;
  float px = 1.0 / uView.x;
  float raked;
  float h0 = sand(w, raked);
  float e = max(px, 0.6);
  float tmp;
  vec2 g = vec2(sand(w + vec2(e, 0.0), tmp) - h0, sand(w + vec2(0.0, e), tmp) - h0) / e * (TINE / TAU);
  // Lines this fine alias when you stand back; the sand goes smooth instead.
  float amp = smoothstep(2.5, 6.0, TINE * uView.x);

  float big = vnoise(w, 256.0, 3u) * 0.6 + vnoise(w, 64.0, 4u) * 0.4;
  vec3 c = mix(vec3(0.68, 0.645, 0.575), vec3(0.75, 0.715, 0.645), big);
  float grain = rnd(ivec2(floor(w / 2.0)), 5u, ivec2(int(uTile / 2.0)));
  c *= 1.0 + (grain - 0.5) * 0.08 * smoothstep(1.5, 3.0, 2.0 * uView.x);
  vec2 L = normalize(vec2(-0.6, -0.8));
  c *= 1.0 + amp * (0.2 * clamp(dot(g, L), -1.0, 1.0) + 0.05 * h0);
  // Zoomed out, a fresh raking still shows: a faint darkening where it went.
  c *= 1.0 - 0.07 * raked * (1.0 - amp);

  // Stones: each item stands in a little shadow of its own.
  for (int i = 0; i < ${A}; i++) {
    if (i >= uNI) break;
    float sd = rectSd(w, uItems[i]) * uView.x;
    c *= 1.0 - 0.3 * exp(-max(sd, 0.0) / 8.0);
  }
  o = vec4(c, 1.0);
}`;function re(){let d=null,v=null,c={},n={},w=null,R=[],m=[],E=0,r=null,x=0,M=-1/0,_=0;const F=new Map;let k=null,h=null;const q=e=>{for(let t=0;t<2;t++){const a=e.createTexture();e.bindTexture(e.TEXTURE_2D,a),e.texImage2D(e.TEXTURE_2D,0,e.RGBA32F,f,f,0,e.RGBA,e.FLOAT,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST);const o=e.createFramebuffer();if(e.bindFramebuffer(e.FRAMEBUFFER,o),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,a,0),e.checkFramebufferStatus(e.FRAMEBUFFER)!==e.FRAMEBUFFER_COMPLETE&&!e.isContextLost())throw new Error("no float render target for the rake");R.push(a),m.push(o)}e.bindFramebuffer(e.FRAMEBUFFER,null)},G=e=>{for(const t of m)e.bindFramebuffer(e.FRAMEBUFFER,t),e.clearBufferfv(e.COLOR,0,[0,0,0,0]);e.bindFramebuffer(e.FRAMEBUFFER,null)};return{name:"zen",cursor:"crescent",setup(e){if(!e.getExtension("EXT_color_buffer_float"))throw new Error("no float render targets for the rake");d=D(e,X,Z),v=D(e,X,W),c=V(e,d),n=V(e,v),w=e.createVertexArray(),R=[],m=[],r=null,q(e)},step(e,t){x+=e*t.ease;const a=new Float32Array(64);let o=0;const s=new Set;for(const i of t.pointers){s.add(i.id);const u=F.get(i.id);u&&i.at>_&&o<16&&(u.x!==i.x||u.y!==i.y)&&(a.set([u.x,u.y,i.x,i.y],o*4),o++),F.set(i.id,{x:i.x,y:i.y})}for(const i of[...F.keys()])s.has(i)||F.delete(i);return _=performance.now(),o>0&&(M=x),k={segs:a,n:o},t.ease>.002},draw(e,t){if(!d||!v)return;h=t.view,e.bindVertexArray(w),e.disable(e.DEPTH_TEST),e.disable(e.BLEND);const a=Math.min(A,t.items.length/4),o=k?.n??0,s=k?.segs;k=null,x-M>=z&&o===0&&(r=null);const i=H(t.view,t.width,t.height,f),u=!!r&&(r.x!==i.x||r.y!==i.y||r.size!==i.size);if(o>0||u){r||(G(e),r=i);const l=1-E;e.bindFramebuffer(e.FRAMEBUFFER,m[l]),e.viewport(0,0,f,f),e.useProgram(d),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,R[E]),e.uniform1i(c.uPrev,0),e.uniform3f(c.uRect,i.x,i.y,i.size),e.uniform3f(c.uPrevRect,r.x,r.y,r.size),e.uniform1f(c.uN,f),e.uniform1f(c.uR,L),e.uniform1f(c.uNow,x),e.uniform1i(c.uNS,o),s&&e.uniform4fv(c.uSeg,s),e.drawArrays(e.TRIANGLES,0,3),e.bindFramebuffer(e.FRAMEBUFFER,null),E=l,r=i}e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight),e.useProgram(v),e.uniform3f(n.uView,t.view.scale,t.view.tx,t.view.ty),e.uniform2f(n.uRes,t.width,t.height),e.uniform1f(n.uTile,K),e.uniform1f(n.uClock,x),e.uniform1f(n.uSoften,z),e.uniform1f(n.uR,L),e.uniform1f(n.uRakeN,f),e.uniform1f(n.uHasRake,r?1:0),r&&(e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,R[E]),e.uniform1i(n.uRake,0),e.uniform3f(n.uRakeRect,r.x,r.y,r.size)),e.uniform1i(n.uNI,a),a>0&&e.uniform4fv(n.uItems,t.items.subarray(0,a*4)),e.drawArrays(e.TRIANGLES,0,3),e.bindVertexArray(null)},readback(e,t,a,o){if(!r||!h||!m.length)return{count:0,radial:0};const s=r.size/f,i=(t-h.tx)/h.scale,u=(a-h.ty)/h.scale,l=o/h.scale,y=Math.max(0,Math.floor((i-l-r.x)/s)),b=Math.max(0,Math.floor((u-l-r.y)/s)),N=Math.min(f,Math.ceil((i+l-r.x)/s)),S=Math.min(f,Math.ceil((u+l-r.y)/s));if(N<=y||S<=b)return{count:0,radial:0};const T=new Float32Array((N-y)*(S-b)*4);e.bindFramebuffer(e.FRAMEBUFFER,m[E]),e.readPixels(y,b,N-y,S-b,e.RGBA,e.FLOAT,T),e.bindFramebuffer(e.FRAMEBUFFER,null);let U=0,I=0;for(let p=0;p<T.length;p+=4){if(T[p+1]<.5)continue;const P=x-(T[p+1]-1),B=$(P)*j(T[p]);B>U&&([U,I]=[B,P])}return{count:U,radial:I}},dispose(e){for(const t of R)e.deleteTexture(t);for(const t of m)e.deleteFramebuffer(t);d&&e.deleteProgram(d),v&&e.deleteProgram(v),w&&e.deleteVertexArray(w),R=[],m=[],d=v=null,w=null,r=null}}}export{K as TILE,re as createZen};
