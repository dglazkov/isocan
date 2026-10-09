import{p as S,u as A,M as b,F as C}from"./LivingGround-DwuPVmYq.js";import"./index-BbrXS7y1.js";import"./CanvasThemeLayer-CSF1YG69.js";/* empty css               */const u=7,V=128,R=u*V,p=24,D=4e4,x=4,_=5,F=12,I=`
uniform float uTile;
uint hash3(ivec2 c, uint salt, ivec2 period) {
  ivec2 w = ((c % period) + period) % period;
  uint h = uint(w.x) * 374761393u + uint(w.y) * 668265263u + salt * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
float rnd(ivec2 c, uint salt, ivec2 period) { return float(hash3(c, salt, period) & 0xffffu) / 65535.0; }
// Value noise on a lattice of cell size s (world units, x and y apart) —
// periodic over TILE, because each s divides TILE and the hash wraps there.
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
`,z=`#version 300 es
precision highp float;
precision highp int;
${I}
uniform vec3 uView;        // scale, tx, ty  (ground → CSS px)
uniform vec2 uRes;         // CSS px
uniform float uTime;
uniform float uAmbient;
uniform float uSpacing;
uniform float uBlade;
uniform ivec2 uOrigin;     // first lattice cell drawn
uniform int uCols;
uniform int uStride;
uniform sampler2D uTrail;
uniform vec3 uTrailRect;   // x, y, size
uniform float uHasTrail;
uniform vec4 uItems[${b}];
uniform int uItemCount;
uniform float uMinWidth;   // CSS px — a blade never thinner than a hair
out vec3 vColor;
out float vEdge;

float sdBox(vec2 p, vec4 r, out vec2 n) {
  vec2 c = r.xy + r.zw * 0.5;
  vec2 d = abs(p - c) - r.zw * 0.5;
  vec2 s = sign(p - c);
  if (d.x > d.y) n = vec2(s.x, 0.0); else n = vec2(0.0, s.y);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float trailAt(vec2 w) {
  vec2 uv = (w - uTrailRect.xy) / uTrailRect.z;
  if (uHasTrail < 0.5 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return texture(uTrail, uv).r;
}

void main() {
  int id = gl_InstanceID;
  ivec2 cell = uOrigin + ivec2(id % uCols, id / uCols) * uStride;
  ivec2 P = ivec2(int(uTile / uSpacing + 0.5));
  float h1 = rnd(cell, 1u, P), h2 = rnd(cell, 2u, P), h3 = rnd(cell, 3u, P), h4 = rnd(cell, 4u, P), h5 = rnd(cell, 5u, P);
  vec2 root = (vec2(cell) + vec2(h1, h2) * 0.95) * uSpacing;
  float H = uBlade * (0.55 + 0.8 * h3 * h3);

  // How pressed the grass is here, and which way is "away".
  float tex = uTrailRect.z / 256.0;
  float tv = trailAt(root);
  vec2 grad = vec2(trailAt(root + vec2(tex * 1.5, 0.0)) - trailAt(root - vec2(tex * 1.5, 0.0)),
                   trailAt(root + vec2(0.0, tex * 1.5)) - trailAt(root - vec2(0.0, tex * 1.5)));
  vec2 away = length(grad) > 1e-4 ? -normalize(grad) : normalize(vec2(h4 - 0.5, h5 - 0.5) + 1e-3);
  float press = smoothstep(0.0, 0.55, tv);

  // Items press the grass flat in their footprint, and lean it away near the edge.
  float shade = 1.0;
  float margin = H * 0.9;
  for (int i = 0; i < ${b}; i++) {
    if (i >= uItemCount) break;
    vec2 n;
    float d = sdBox(root, uItems[i], n);
    if (d < margin) {
      float f = d <= 0.0 ? 1.0 : 1.0 - d / margin;
      f = f * f;
      if (f > press) { press = f; away = n; }
      shade = min(shade, 0.55 + 0.45 * smoothstep(0.0, margin * 1.4, max(d, 0.0)));
    }
  }

  // At rest: a gentle natural lean. Awake: the wind on top of it.
  float lean = (h4 - 0.5) * 0.55 * H;
  float gust = sin(uTime * 0.7 + root.x * 0.004 - root.y * 0.002) * 0.5 + 0.5;
  float sway = uAmbient * (sin(uTime * 1.9 + root.x * 0.021 + root.y * 0.009 + h1 * 6.283) * 0.12
                           + gust * 0.16) * H;
  vec2 upright = vec2(lean + sway, -H);
  vec2 flat_ = away * H * 0.85 + vec2(0.0, -H * 0.12);
  vec2 tip = mix(upright, flat_, press * 0.94);
  vec2 ctrl = mix(vec2(lean * 0.2, -H * 0.6), flat_ * 0.45, press);

  int k = gl_VertexID;
  float t = float(k / 2) / ${x.toFixed(1)};
  float side = (k & 1) == 0 ? -1.0 : 1.0;
  if (k >= ${2*x}) { t = 1.0; side = 0.0; }
  vec2 p = (1.0 - t) * (1.0 - t) * vec2(0.0) + 2.0 * t * (1.0 - t) * ctrl + t * t * tip;
  vec2 tan_ = 2.0 * (1.0 - t) * ctrl + 2.0 * t * (tip - ctrl);
  vec2 nrm = normalize(vec2(-tan_.y, tan_.x) + 1e-5);
  float w = max(H * 0.085 * uView.x, uMinWidth) / uView.x * pow(1.0 - t, 0.8);
  vec2 world = root + p + nrm * side * w * 0.5;

  vec2 screen = world * uView.x + uView.yz;
  gl_Position = vec4(screen / uRes * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);

  // Lusher and drier patches across the field — the same noise the field
  // pass uses, so the blades and the ground under them agree.
  float patch_ = vnoise(root, vec2(uSpacing * 32.0), 11u) * 0.6 + vnoise(root, vec2(uSpacing * 8.0), 12u) * 0.4;
  vec3 base = mix(vec3(0.055, 0.12, 0.05), vec3(0.11, 0.2, 0.07), h5);
  vec3 top = mix(vec3(0.3, 0.48, 0.15), vec3(0.55, 0.66, 0.24), h4 * h4);
  top = mix(top * vec3(0.8, 0.95, 0.8), top * vec3(1.18, 1.08, 0.82), smoothstep(0.25, 0.8, patch_));
  vec3 col = mix(base, top, pow(t, 0.75));
  // A pressed blade shows its paler side to the sky.
  col = mix(col, col * 1.25 + vec3(0.04, 0.05, 0.02), press * t);
  vColor = col * shade;
  vEdge = side;
}`,N=`#version 300 es
precision mediump float;
in vec3 vColor;
in float vEdge;
uniform float uFade;
out vec4 o;
void main() {
  float a = uFade;
  o = vec4(vColor * (0.92 + 0.08 * (1.0 - abs(vEdge))) * a, a);
}`,g=`#version 300 es
precision highp float;
precision highp int;
${I}
in vec2 vUv;
uniform vec3 uView;
uniform vec2 uRes;
uniform float uSpacing;
uniform float uBladeFade;
uniform sampler2D uTrail;
uniform vec3 uTrailRect;
uniform float uHasTrail;
out vec4 o;

void main() {
  vec2 screen = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 w = (screen - uView.yz) / uView.x;
  // Large soft patches: drier and lusher ground, so the field is not flat.
  float big = vnoise(w, vec2(uSpacing * 32.0), 11u) * 0.6 + vnoise(w, vec2(uSpacing * 8.0), 12u) * 0.4;
  // Fine vertical streaks: grass seen from too far to resolve a blade.
  float streak = vnoise(w, uSpacing * vec2(1.0, 4.0), 13u) * 0.6 + vnoise(w, vec2(uSpacing * 2.0), 14u) * 0.4;
  vec3 soil = mix(vec3(0.07, 0.1, 0.05), vec3(0.1, 0.14, 0.06), big);
  vec3 far = mix(vec3(0.13, 0.22, 0.08), vec3(0.24, 0.36, 0.12), big) * (0.78 + 0.34 * streak);
  vec3 col = mix(far, soil, uBladeFade);
  if (uHasTrail > 0.5) {
    vec2 uv = (w - uTrailRect.xy) / uTrailRect.z;
    if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {
      float tv = texture(uTrail, uv).r;
      col = mix(col, col * 1.35 + vec3(0.05, 0.07, 0.02), tv * (1.0 - 0.6 * uBladeFade));
    }
  }
  o = vec4(col, 1.0);
}`,k=1.4;function G(){let n=null,c=null,i={},r={},s=null;return{name:"meadow",cursor:"ladybird",setup(e){n=S(e,z,N),c=S(e,C,g),i=A(e,n),r=A(e,c),s=e.createVertexArray()},step(e,t){return t.ambient>.002},draw(e,t){if(!n||!c)return;const{view:a,width:d,height:m}=t,P=p*a.scale,l=Math.min(1,Math.max(0,(P-_)/(F-_)));if(e.bindVertexArray(s),e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight),e.disable(e.DEPTH_TEST),e.disable(e.BLEND),t.trail&&(e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,t.trail)),e.useProgram(c),e.uniform1f(r.uTile,R),e.uniform3f(r.uView,a.scale,a.tx,a.ty),e.uniform2f(r.uRes,d,m),e.uniform1f(r.uSpacing,u),e.uniform1f(r.uBladeFade,l),e.uniform1i(r.uTrail,0),e.uniform3f(r.uTrailRect,t.trailRect.x,t.trailRect.y,t.trailRect.size),e.uniform1f(r.uHasTrail,t.trail?1:0),e.drawArrays(e.TRIANGLES,0,3),l<=0)return;const f=p*1.6,w=-a.tx/a.scale-f,H=(d-a.tx)/a.scale+f,T=-a.ty/a.scale-f*.3,B=(m-a.ty)/a.scale+f;let o=1,v=0,h=0;for(;;){const E=u*o;if(v=Math.ceil((H-w)/E)+1,h=Math.ceil((B-T)/E)+1,v*h<=D||o>=4096)break;o*=2}const L=Math.floor(w/(u*o))*o,M=Math.floor(T/(u*o))*o;e.useProgram(n),e.uniform1f(i.uTile,R),e.uniform3f(i.uView,a.scale,a.tx,a.ty),e.uniform2f(i.uRes,d,m),e.uniform1f(i.uTime,t.time),e.uniform1f(i.uAmbient,t.ambient),e.uniform1f(i.uSpacing,u),e.uniform1f(i.uBlade,p),e.uniform2i(i.uOrigin,L,M),e.uniform1i(i.uCols,v),e.uniform1i(i.uStride,o),e.uniform1i(i.uTrail,0),e.uniform3f(i.uTrailRect,t.trailRect.x,t.trailRect.y,t.trailRect.size),e.uniform1f(i.uHasTrail,t.trail?1:0),e.uniform1f(i.uMinWidth,.9),e.uniform1f(i.uFade,l);const y=t.items.length/4;e.uniform1i(i.uItemCount,y),y>0&&e.uniform4fv(i.uItems,t.items),l<1&&(e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA)),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,2*x+1,v*h),e.disable(e.BLEND)},dispose(e){n&&e.deleteProgram(n),c&&e.deleteProgram(c),s&&e.deleteVertexArray(s),n=c=null,s=null}}}const W=k;export{D as MAX_BLADES,W as MEADOW_AMBIENT_RATE,V as PERIOD,u as SPACING,R as TILE,G as createMeadow};
