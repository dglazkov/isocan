import{a as F,p as W,u as Z,F as se}from"./LivingGround-bb8g52rp.js";import{w as ue,p as ne,d as ae,f as ce,F as ee,G as O,i as fe,g as le}from"./fireflies-C_qQxRPj.js";/* empty css              */import"./index-Dmoce6by.js";import"./groundmotion-BgiqVNMT.js";import"./CanvasThemeLayer-CgP33JmD.js";/* empty css               */const me=.4,te={x:12.7,y:13.7},ve=7.5/Math.SQRT1_2,j=30,he=24e3,C=24,y=16,ie=`#version 300 es
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
`,de=ie+`
in vec2 vUv;
out vec4 o;
uniform vec3 uView; uniform vec2 uRes; uniform float uBufH, uDpr, uTime, uAmb, uHorizon;
uniform vec4 uItems[${y}]; uniform int uNI; uniform float uGlow[${y}];
uniform vec4 uLight[${C}]; uniform int uNL;
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
  for (int i = 0; i < ${y}; i++) { if (i >= uNI) break;
    vec4 r = vec4(uItems[i].xy * uView.x + uView.yz, uItems[i].zw * uView.x);
    float sd = rectSd(scr, r);
    c += vec3(1., .7, .35) * uGlow[i] * .55 * exp(-max(sd, 0.) / 18.) * step(0., sd);
    c *= 1. - .35 * exp(-max(sd, 0.) / 10.) * (1. - uGlow[i]); }
  o = vec4(c, 1.);
}`,xe=ie+`
uniform vec3 uView; uniform vec2 uRes; uniform float uTime, uAmb, uLodA, uFade, uS, uH, uHorizon;
uniform ivec2 uCell0; uniform int uCols, uLevel;
uniform sampler2D uTrail; uniform vec3 uTR; uniform float uHasTrail;
uniform vec4 uPtr[${F}]; uniform int uNP;
uniform vec4 uItems[${y}]; uniform int uNI;
uniform vec4 uLight[${C}]; uniform int uNL;
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
  for (int i = 0; i < ${y}; i++) { if (i >= uNI) break;
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
  for (int i = 0; i < ${C}; i++) { if (i >= uNL) break; vec2 d = s - uLight[i].xy; L += uLight[i].z / (1. + dot(d, d) / (uLight[i].w * uLight[i].w)); }
  c += vec3(1., .74, .34) * L * (.18 + .82 * t) * .85;
  vCol = vec4(c, alpha);
}`,ye=`#version 300 es
precision mediump float; in vec4 vCol; out vec4 o; void main(){ o = vCol; }`,pe=`#version 300 es
precision highp float;
layout(location = 0) in vec4 aF;   // ground x, y, intensity, radius (css px)
uniform vec3 uView; uniform vec2 uRes; out vec2 vQ; out float vI;
void main(){
  vec2 q = vec2((gl_VertexID & 1) == 1 ? 1. : -1., (gl_VertexID & 2) == 2 ? 1. : -1.);
  vec2 s = aF.xy * uView.x + uView.yz + q * aF.w; vQ = q; vI = aF.z;
  gl_Position = vec4(s.x / uRes.x * 2. - 1., 1. - s.y / uRes.y * 2., 0., 1.);
}`,we=`#version 300 es
precision mediump float; in vec2 vQ; in float vI; out vec4 o;
void main(){ float r2 = dot(vQ, vQ); float edge = 1. - smoothstep(.7, 1., sqrt(r2));
  vec3 c = vec3(1., .95, .7) * exp(-r2 * 70.) * 1.5 + vec3(1., .72, .3) * exp(-r2 * 6.) * .5 + vec3(.75, 1., .35) * exp(-r2 * 22.) * .25;
  o = vec4(c * vI * edge, 1.); }`,be=(p,n)=>{const f=document.querySelector(`.item[data-item-id="${CSS.escape(p)}"]`);f&&(n>0?f.style.setProperty("--ground-glow",n.toFixed(2)):f.style.removeProperty("--ground-glow"))},Ae=p=>{const n=Math.min(1,Math.max(0,p));return n*n*(3-2*n)};function ze(p=be){let n=null,f=null,w=null,a={},o={},$={},M=null,N=null,_=null,b=[],J=0,q=0;const k=new Map,U=new Map,A=new Map,X=new Float32Array(4*(ee+F));let L=0;const G=new Float32Array(C*4);let Y=0;const K=new Float32Array(F*4);let z=0;const Q=new Float32Array(y),re=()=>{for(const e of A.keys())p(e,0);A.clear()};return{name:"night",cursor:"firefly",flies:()=>b.length,setup(e){n=W(e,se,de),f=W(e,xe,ye),w=W(e,pe,we),a=Z(e,n),o=Z(e,f),$=Z(e,w),M=e.createVertexArray(),N=e.createVertexArray(),_=e.createBuffer(),e.bindVertexArray(N),e.bindBuffer(e.ARRAY_BUFFER,_),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,4,e.FLOAT,!1,16,0),e.vertexAttribDivisor(0,1),e.bindVertexArray(null)},step(e,r){const{scale:i,tx:v,ty:h}=r.view,u=r.ease,P=performance.now();q+=e*r.ambient;const l=[],E=new Set;z=0,L=0;for(const t of r.pointers){E.add(t.id);const s=k.get(t.id);s&&u>.002&&(J=ue(b,J,s,t,Math.hypot(t.x-s.x,t.y-s.y)*i,i)),k.set(t.id,{x:t.x,y:t.y});const c=ne(P-t.at<250?t.speed:0),d=U.get(t.id)??.32,I=d+(c-d)*(1-Math.exp(-e*4));U.set(t.id,I);const B=I*t.weight*u,V=t.x*i+v+te.x,m=t.y*i+h+te.y;l.push({x:V,y:m,i:B,r:46}),z<F&&K.set([t.x,t.y,t.weight,26/i],4*z++),X.set([(V-v)/i,(m-h)/i,B,50],4*L++)}for(const t of[...k.keys()])E.has(t)||(k.delete(t),U.delete(t));b=u>.002?ae(b,e*u,i):[];for(const t of b){const s=ce(t,u);l.push({x:t.x*i+v,y:t.y*i+h,i:s,r:30}),L<ee+F&&X.set([t.x,t.y,s,26],4*L++)}const R=l.filter(t=>t.i>.003).sort((t,s)=>s.i-t.i).slice(0,C);Y=R.length,G.fill(0),R.forEach((t,s)=>G.set([t.x,t.y,t.i,t.r],s*4));const H=r.items.length/4,x=r.itemIds??[];Q.fill(0);const D=new Set;for(let t=0;t<H;t++){const s=r.items[t*4]*i+v,c=r.items[t*4+1]*i+h,d=r.items[t*4+2]*i,I=r.items[t*4+3]*i,V=R.some(S=>S.x>s-O&&S.x<s+d+O&&S.y>c-O&&S.y<c+I+O)?fe(s,c,d,I,R):0;t<y&&(Q[t]=V);const m=x[t];if(!m)continue;D.add(m);const T=le(A.get(m)??0,V);T!==null&&(p(m,T),T===0?A.delete(m):A.set(m,T))}for(const t of[...A.keys()])D.has(t)||(p(t,0),A.delete(t));return u>.002||b.length>0},draw(e,r){if(!n||!f||!w)return;const{view:i,width:v,height:h}=r,u=i.scale,P=Math.round(h*me);e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight),e.disable(e.DEPTH_TEST),e.disable(e.BLEND);const l=Math.min(r.items.length/4,y);e.bindVertexArray(M),e.useProgram(n),e.uniform3f(a.uView,u,i.tx,i.ty),e.uniform2f(a.uRes,v,h),e.uniform1f(a.uBufH,e.drawingBufferHeight),e.uniform1f(a.uDpr,e.drawingBufferWidth/Math.max(1,v)),e.uniform1f(a.uTime,q),e.uniform1f(a.uAmb,r.ambient),e.uniform1f(a.uHorizon,P),e.uniform1i(a.uNI,l),l>0&&(e.uniform4fv(a.uItems,r.items.subarray(0,l*4)),e.uniform1fv(a.uGlow,Q.subarray(0,l))),e.uniform4fv(a.uLight,G),e.uniform1i(a.uNL,Y),e.drawArrays(e.TRIANGLES,0,3);const E=Ae((j*u-4)/7);if(E>=.01){const R=s=>{const c=ve*2**s,d=j*1.2,I=-i.tx/u,B=(v-i.tx)/u,V=(Math.max(0,P)-i.ty)/u,m=(h-i.ty)/u,T=Math.floor((I-d)/c),S=Math.ceil((B+d)/c),g=Math.floor((V-c)/c),oe=Math.ceil((m+d)/c);return{S:c,ix0:T,iy0:g,cols:Math.max(0,S-T),rows:Math.max(0,oe-g)}},H=Math.log2(1/u);let x=Math.max(0,Math.floor(H)),D=H<=0?1:1-(H-x),t=R(x);for(;t.cols*t.rows>he&&x<12;)x++,D=1,t=R(x);e.useProgram(f),e.uniform3f(o.uView,u,i.tx,i.ty),e.uniform2f(o.uRes,v,h),e.uniform1f(o.uTime,q),e.uniform1f(o.uAmb,r.ambient),e.uniform1f(o.uLodA,E),e.uniform1f(o.uFade,D),e.uniform1f(o.uS,t.S),e.uniform1f(o.uH,j),e.uniform1f(o.uHorizon,P),e.uniform2i(o.uCell0,t.ix0,t.iy0),e.uniform1i(o.uCols,Math.max(1,t.cols)),e.uniform1i(o.uLevel,x),r.trail&&(e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,r.trail)),e.uniform1i(o.uTrail,0),e.uniform3f(o.uTR,r.trailRect.x,r.trailRect.y,r.trailRect.size),e.uniform1f(o.uHasTrail,r.trail?1:0),e.uniform1i(o.uNP,z),z>0&&e.uniform4fv(o.uPtr,K.subarray(0,z*4)),e.uniform1i(o.uNI,l),l>0&&e.uniform4fv(o.uItems,r.items.subarray(0,l*4)),e.uniform4fv(o.uLight,G),e.uniform1i(o.uNL,Y),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),t.cols*t.rows>0&&e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,t.cols*t.rows)}L>0&&(e.useProgram(w),e.uniform3f($.uView,u,i.tx,i.ty),e.uniform2f($.uRes,v,h),e.bindVertexArray(N),e.bindBuffer(e.ARRAY_BUFFER,_),e.bufferData(e.ARRAY_BUFFER,X.subarray(0,L*4),e.DYNAMIC_DRAW),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,L)),e.bindVertexArray(null),e.disable(e.BLEND)},dispose(e){re(),n&&e.deleteProgram(n),f&&e.deleteProgram(f),w&&e.deleteProgram(w),M&&e.deleteVertexArray(M),N&&e.deleteVertexArray(N),_&&e.deleteBuffer(_),n=f=w=null,M=N=null,_=null,b=[]}}}export{me as HORIZON,te as LANTERN,ze as createNight};
