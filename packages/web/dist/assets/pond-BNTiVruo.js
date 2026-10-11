import{s as W}from"./rake-jihJIAXg.js";import{p as O,u as V,F as H}from"./LivingGround-bb8g52rp.js";/* empty css             */import"./index-Dmoce6by.js";import"./groundmotion-BgiqVNMT.js";import"./CanvasThemeLayer-CgP33JmD.js";/* empty css               */const j=6,Z=22,J=150,Q=150,Y=400,g=2.4,$=.02;function ee(u){let o=Math.floor(u*2147483646)%2147483646+1;return()=>(o=o*48271%2147483647,(o-1)/2147483646)}function te(u,o,r=.37){const a=ee(r),y=[];for(let v=0;v<u;v++)y.push({x:o.x+o.w*(.12+.76*a()),y:o.y+o.h*(.12+.76*a()),heading:a()*Math.PI*2,flee:0,size:30+22*a(),tail:a()*Math.PI*2,seed:(v+a())/u});return y}function q(u,o){let r=(o-u)%(Math.PI*2);return r>Math.PI&&(r-=Math.PI*2),r<=-Math.PI&&(r+=Math.PI*2),r}function ie(u,o,r,a,y,v,s,S){if(o<=0)return;const c=Q/Math.max(S,1e-6),b=s.x+s.w/2,F=s.y+s.h/2,U=Math.hypot(s.w,s.h);for(const t of u){if(Math.hypot(t.x-b,t.y-F)>U){const h=Math.atan2(t.y-F,t.x-b);t.x=b+Math.cos(h)*s.w*.55,t.y=F+Math.sin(h)*s.h*.55,t.heading=h+Math.PI,t.flee=0}let E=0;E+=Math.sin(a*(.35+.3*t.seed)+t.seed*17)*.55*r;for(const h of y){if(!h.fresh)continue;const A=Math.hypot(t.x-h.x,t.y-h.y);if(A>=c)continue;const P=1-A/c;t.flee=Math.max(t.flee,P),E+=q(t.heading,Math.atan2(t.y-h.y,t.x-h.x))*6*P}const d=Math.max(r,t.flee);for(let h=0;h+3<v.length;h+=4){const A=v[h],P=v[h+1],e=v[h+2],i=v[h+3],f=t.size*.8;t.x<A-f||t.x>A+e+f||t.y<P-f||t.y>P+i+f||(E+=q(t.heading,Math.atan2(t.y-(P+i/2),t.x-(A+e/2)))*2.5*d)}(t.x<s.x||t.x>s.x+s.w||t.y<s.y||t.y>s.y+s.h)&&(E+=q(t.heading,Math.atan2(F-t.y,b-t.x))*1.2*d);const _=3+7*t.flee;t.heading+=Math.max(-_,Math.min(_,E))*o;const p=Z*r+J*t.flee;t.x+=Math.cos(t.heading)*p*o,t.y+=Math.sin(t.heading)*p*o,t.tail+=o*(1.5*r+p*.12),t.flee*=Math.exp(-o*g),t.flee<$*.5&&(t.flee=0)}}function oe(u){return u.some(o=>o.flee>=$)}const re=1024,M=768,ne=120,ae=.982,G=2.6,se=10,D=16,B=8,ce=`
uniform float uTile;
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
`,fe=`#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
uniform sampler2D uPrev;
uniform vec3 uRect;
uniform vec3 uPrevRect;
uniform float uN;
uniform float uDamp;
uniform int uNS;
uniform vec4 uSeg[16];
uniform vec2 uPress[16];
uniform int uNI;
uniform vec4 uItems[${D}];
out vec4 o;
vec2 at(vec2 w) {
  vec2 uv = (w - uPrevRect.xy) / uPrevRect.z;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec2(0.0);
  return texture(uPrev, uv).rg;
}
void main() {
  vec2 w = uRect.xy + vUv * uRect.z;
  float t = uRect.z / uN;
  for (int i = 0; i < ${D}; i++) {
    if (i >= uNI) break;
    vec4 r = uItems[i];
    if (all(greaterThan(w, r.xy)) && all(lessThan(w, r.xy + r.zw))) { o = vec4(0.0); return; }
  }
  vec2 c = at(w);
  float n = at(w + vec2(t, 0.0)).r + at(w - vec2(t, 0.0)).r + at(w + vec2(0.0, t)).r + at(w - vec2(0.0, t)).r;
  float h = (n * 0.5 - c.g) * uDamp;
  for (int i = 0; i < 16; i++) {
    if (i >= uNS) break;
    vec2 a = uSeg[i].xy, b = uSeg[i].zw;
    vec2 pa = w - a, ba = b - a;
    float k = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    float d = length(pa - ba * k);
    float r = max(uPress[i].x, t * 1.5);
    h -= uPress[i].y * (1.0 - smoothstep(0.0, r, d));
  }
  o = vec4(clamp(h, -2.0, 2.0), c.r, 0.0, 1.0);
}`,ue=`#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
${ce}
in vec2 vUv;
uniform vec3 uView;
uniform vec2 uRes;
uniform float uClock;
uniform sampler2D uSim;
uniform vec3 uSimRect;
uniform float uSimN;
uniform float uHasSim;
uniform int uNI;
uniform vec4 uItems[${D}];
uniform int uNK;
uniform vec4 uKoi[${B}];   // x, y, heading, size
uniform vec2 uKoiB[${B}];  // tail phase, seed
out vec4 o;

float height(vec2 w) {
  vec2 uv = (w - uSimRect.xy) / uSimRect.z;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return texture(uSim, uv).r;
}

// A koi's body in its own frame (x forward, units of its length): the signed
// distance to the body, and how much of a fin is here.
vec2 koi(vec2 q, float tail) {
  float bend = sin(tail) * 0.13 * smoothstep(0.15, -0.55, q.x);
  q.y -= bend * (0.35 - q.x);
  float taper = mix(1.0, 0.35, smoothstep(0.05, -0.5, q.x));
  float body = length(vec2(q.x / 0.5, q.y / (0.13 * taper))) - 1.0;
  float fx = -q.x - 0.44;
  float fin = step(0.0, fx) * step(fx, 0.26) * step(abs(q.y), 0.02 + fx * 0.85);
  fin = max(fin, step(length(vec2(q.x - 0.16, abs(q.y) - 0.15) / vec2(0.09, 0.05)), 1.0));
  return vec2(body, fin);
}

void main() {
  vec2 screen = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 w = (screen - uView.yz) / uView.x;
  float px = 1.0 / uView.x;

  // The surface: height and slope.
  vec2 g = vec2(0.0);
  float h = 0.0;
  if (uHasSim > 0.5) {
    float e = uSimRect.z / uSimN;
    h = height(w);
    g = vec2(height(w + vec2(e, 0.0)) - height(w - vec2(e, 0.0)), height(w + vec2(0.0, e)) - height(w - vec2(0.0, e)));
  }

  // The bottom, seen through it.
  vec2 b = w + g * 14.0;
  float deep = vnoise(b, 512.0, 3u) * 0.5 + vnoise(b, 256.0, 4u) * 0.3 + vnoise(b, 128.0, 11u) * 0.2;
  vec3 c = mix(vec3(0.04, 0.11, 0.11), vec3(0.07, 0.16, 0.145), smoothstep(0.2, 0.8, deep));
  float peb = vnoise(b, 16.0, 5u) * 0.5 + vnoise(b, 8.0, 6u) * 0.3 + vnoise(b, 4.0, 12u) * 0.2;
  c *= 0.95 + 0.1 * smoothstep(0.3, 0.8, peb) * smoothstep(2.0, 6.0, 8.0 * uView.x);
  // Caustics: thin wavering threads of light on the bottom, drifting on the ambient clock.
  float c1 = 1.0 - abs(vnoise(b + vec2(uClock * 9.0, uClock * 5.0), 64.0, 7u) * 2.0 - 1.0);
  float c2 = 1.0 - abs(vnoise(b - vec2(uClock * 6.0, -uClock * 7.0), 32.0, 8u) * 2.0 - 1.0);
  c += vec3(0.05, 0.08, 0.065) * pow(c1 * c2, 5.0) * smoothstep(1.0, 4.0, 32.0 * uView.x);

  // The koi, under the surface, with their shadows on the bottom below.
  for (int i = 0; i < ${B}; i++) {
    if (i >= uNK) break;
    vec4 k = uKoi[i];
    vec2 d = b - k.xy;
    if (dot(d, d) > k.w * k.w * 1.2) continue;
    float cs = cos(k.z), sn = sin(k.z);
    vec2 q = vec2(d.x * cs + d.y * sn, -d.x * sn + d.y * cs) / k.w;
    vec2 ds = d - vec2(5.0, 7.0);
    vec2 qs = vec2(ds.x * cs + ds.y * sn, -ds.x * sn + ds.y * cs) / k.w;
    float aa = 1.5 * px / k.w;
    vec2 sh = koi(qs, uKoiB[i].x);
    c *= 1.0 - 0.3 * max(smoothstep(0.25, -0.4, sh.x), sh.y * 0.5);
    vec2 f = koi(q, uKoiB[i].x);
    float s = uKoiB[i].y;
    float spot = vnoise(q * vec2(3.0, 5.0) * 64.0 + s * 4096.0, 64.0, 9u);
    vec3 white = vec3(0.92, 0.9, 0.84);
    vec3 orange = mix(vec3(0.93, 0.36, 0.08), vec3(0.98, 0.58, 0.16), fract(s * 7.31));
    vec3 col = s < 0.3 ? orange : mix(white, orange, smoothstep(0.42 + 0.2 * fract(s * 3.7), 0.5 + 0.2 * fract(s * 3.7), spot));
    if (fract(s * 5.3) > 0.7) col = mix(col, vec3(0.08, 0.07, 0.07), smoothstep(0.68, 0.72, vnoise(q * 160.0 + s * 999.0, 32.0, 10u)));
    float body = smoothstep(aa, -aa, f.x);
    c = mix(c, col * 0.82 + c * 0.1, body * 0.85);
    c = mix(c, mix(col, white, 0.4) * 0.8, f.y * (1.0 - body) * 0.45);
  }

  // Light on the water: every ripple's slope catches it.
  vec2 L = normalize(vec2(-0.6, -0.8));
  float lit = dot(g, L);
  c += vec3(0.42, 0.52, 0.5) * clamp(lit * 2.2, -0.12, 0.45);
  c += vec3(0.75, 0.85, 0.8) * smoothstep(0.08, 0.2, lit) * 0.18;
  // A faint sky on the surface, darker where the water is deep.
  c += vec3(0.02, 0.035, 0.04) * (1.0 - deep);

  // Stones: the water darkens where it laps at an item.
  for (int i = 0; i < ${D}; i++) {
    if (i >= uNI) break;
    float sd = rectSd(w, uItems[i]) * uView.x;
    c *= 1.0 - 0.4 * exp(-max(sd, 0.0) / 14.0);
    c += vec3(0.1, 0.13, 0.12) * exp(-abs(sd - 3.0) / 2.5) * 0.5;
  }
  o = vec4(c, 1.0);
}`;function we(){let u=null,o=null,r={},a={},y=null,v=[],s=[],S=0,c=null,b=0,F=0,U=-1/0,t=0,E=0,d=[];const N=new Map;let _=null,p=null;const h=e=>{for(let i=0;i<2;i++){const f=e.createTexture();e.bindTexture(e.TEXTURE_2D,f),e.texImage2D(e.TEXTURE_2D,0,e.RGBA16F,M,M,0,e.RGBA,e.HALF_FLOAT,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);const x=e.createFramebuffer();if(e.bindFramebuffer(e.FRAMEBUFFER,x),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,f,0),e.checkFramebufferStatus(e.FRAMEBUFFER)!==e.FRAMEBUFFER_COMPLETE&&!e.isContextLost())throw new Error("no float render target for the ripples");v.push(f),s.push(x)}e.bindFramebuffer(e.FRAMEBUFFER,null)},A=e=>{for(const i of s)e.bindFramebuffer(e.FRAMEBUFFER,i),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT);e.bindFramebuffer(e.FRAMEBUFFER,null)},P=e=>{const i=Math.min(D,e.length/4);return{n:i,data:e.subarray(0,i*4)}};return{name:"pond",cursor:"fish",setup(e){if(!e.getExtension("EXT_color_buffer_float"))throw new Error("no float render targets for the ripples");u=O(e,H,fe),o=O(e,H,ue),r=V(e,u),a=V(e,o),y=e.createVertexArray(),v=[],s=[],c=null,h(e)},step(e,i){const f=performance.now(),{scale:x}=i.view;b+=e*i.ambient,F+=e;const m=new Float32Array(64),I=new Float32Array(32);let w=0;const R=new Set,k=[];for(const n of i.pointers){R.add(n.id);const T=N.get(n.id);T&&n.at>t&&w<16&&(m.set([T.x,T.y,n.x,n.y],w*4),I.set([se/x,Math.min(1,.35+n.speed/1800)*.5*n.weight],w*2),w++),N.set(n.id,{x:n.x,y:n.y}),k.push({x:n.x,y:n.y,fresh:f-n.at<Y})}for(const n of[...N.keys()])R.has(n)||N.delete(n);t=f,w>0&&(U=F);const l={x:-i.view.tx/x,y:-i.view.ty/x,w:i.width/x,h:i.height/x};return d.length===0&&i.width>0&&(d=te(j,l)),ie(d,e,i.ambient,b,k,i.items,l,x),_={dt:e,segs:m,press:I,n:w},i.ease>.002||F-U<G||oe(d)},draw(e,i){if(!u||!o)return;p=i.view,e.bindVertexArray(y),e.disable(e.DEPTH_TEST),e.disable(e.BLEND);const f=P(i.items);if(_){const{dt:m,segs:I,press:w,n:R}=_;if(_=null,!(F-U<G))c=null;else{const l=W(i.view,i.width,i.height,M);c||(A(e),c=l,E=0),E+=m*ne;let n=Math.min(4,Math.floor(E));E-=n,R>0&&n===0&&(n=1),e.useProgram(u),e.viewport(0,0,M,M),e.uniform1f(r.uN,M),e.uniform1f(r.uDamp,ae),e.uniform1i(r.uNI,f.n),f.n>0&&e.uniform4fv(r.uItems,f.data),e.uniform4fv(r.uSeg,I),e.uniform2fv(r.uPress,w),e.activeTexture(e.TEXTURE0),e.uniform1i(r.uPrev,0);for(let T=0;T<n;T++){const L=1-S;e.bindFramebuffer(e.FRAMEBUFFER,s[L]),e.bindTexture(e.TEXTURE_2D,v[S]),e.uniform3f(r.uRect,l.x,l.y,l.size),e.uniform3f(r.uPrevRect,c.x,c.y,c.size),e.uniform1i(r.uNS,T===0?R:0),e.drawArrays(e.TRIANGLES,0,3),S=L,c=l}e.bindFramebuffer(e.FRAMEBUFFER,null)}}e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight),e.useProgram(o),e.uniform1f(a.uTile,re),e.uniform3f(a.uView,i.view.scale,i.view.tx,i.view.ty),e.uniform2f(a.uRes,i.width,i.height),e.uniform1f(a.uClock,b),e.uniform1f(a.uSimN,M),e.uniform1f(a.uHasSim,c?1:0),c&&(e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,v[S]),e.uniform1i(a.uSim,0),e.uniform3f(a.uSimRect,c.x,c.y,c.size)),e.uniform1i(a.uNI,f.n),f.n>0&&e.uniform4fv(a.uItems,f.data);const x=Math.min(B,d.length);e.uniform1i(a.uNK,x),x>0&&(e.uniform4fv(a.uKoi,new Float32Array(d.slice(0,x).flatMap(m=>[m.x,m.y,m.heading,m.size]))),e.uniform2fv(a.uKoiB,new Float32Array(d.slice(0,x).flatMap(m=>[m.tail,m.seed])))),e.drawArrays(e.TRIANGLES,0,3),e.bindVertexArray(null)},readback(e,i,f,x){if(!c||!p||!s.length)return{count:0,radial:0};const m=c.size/M,I=(i-p.tx)/p.scale,w=(f-p.ty)/p.scale,R=x/p.scale,k=Math.max(0,Math.floor((I-R-c.x)/m)),l=Math.max(0,Math.floor((w-R-c.y)/m)),n=Math.min(M,Math.ceil((I+R-c.x)/m)),T=Math.min(M,Math.ceil((w+R-c.y)/m));if(n<=k||T<=l)return{count:0,radial:0};const L=n-k,K=T-l,z=new Float32Array(L*K*4);e.bindFramebuffer(e.FRAMEBUFFER,s[S]),e.readPixels(k,l,L,K,e.RGBA,e.FLOAT,z),e.bindFramebuffer(e.FRAMEBUFFER,null);let C=0;for(let X=0;X<z.length;X+=4)C=Math.max(C,Math.abs(z[X]));return{count:C,radial:0}},dispose(e){for(const i of v)e.deleteTexture(i);for(const i of s)e.deleteFramebuffer(i);u&&e.deleteProgram(u),o&&e.deleteProgram(o),y&&e.deleteVertexArray(y),v=[],s=[],u=o=null,y=null,c=null,d=[]}}}export{G as RIPPLE_LIFE,re as TILE,we as createPond};
