import{a as g,p as P,u as T,F as V}from"./LivingGround-bb8g52rp.js";import{g as E}from"./fireflies-C_qQxRPj.js";/* empty css               */import"./index-Dmoce6by.js";import"./groundmotion-BgiqVNMT.js";import"./CanvasThemeLayer-CgP33JmD.js";/* empty css               */const b=160,N=4,_=2,G=.5;function F(r,o,i,s){const c=o?i:0,a=c>r?N:_,u=r+(c-r)*(1-Math.exp(-s*a));return u<.01&&c===0?0:u}function z(r,o){let i=0;for(const s of o){const c=r-s.x;i+=s.e*Math.exp(-(c*c)/(2*b*b))}return i}function H(r,o,i){let s=0;for(const c of i){const a=Math.min(Math.max(c.x,r),r+o);s=Math.max(s,z(a,i))}return Math.min(G,s*.45)}const $=.62,x=16,L=`#version 300 es
precision highp float; precision highp int;
in vec2 vUv;
out vec4 o;
uniform vec3 uView; uniform vec2 uRes; uniform float uTime, uHorizon;
uniform vec4 uPtr[${g}]; uniform int uNP;   // screen x, y, energy, -
uniform vec4 uItems[${x}]; uniform int uNI; uniform float uGlow[${x}];
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hash(ivec2 c, uint salt){ uint x = uint(c.x + 1073741824); uint y = uint(c.y + 1073741824);
  return float(pcg(x * 1973u + pcg(y * 9277u + salt))) * (1.0 / 4294967296.0); }
float vnoise(vec2 p, uint salt){ vec2 i = floor(p), f = fract(p); ivec2 c = ivec2(i);
  float a = hash(c, salt), b = hash(c + ivec2(1,0), salt), d = hash(c + ivec2(0,1), salt), e = hash(c + ivec2(1,1), salt);
  vec2 u = f * f * (3. - 2. * f); return mix(mix(a, b, u.x), mix(d, e, u.x), u.y); }
float fbm(vec2 p, uint salt){ float s = 0., a = .5; for (int i = 0; i < 3; i++){ s += a * vnoise(p, salt); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; } return s; }
float rectSd(vec2 p, vec4 r){ vec2 c = r.xy + r.zw * .5; vec2 d = abs(p - c) - r.zw * .5; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }

// One curtain: its glow at screen point s, and how lit its column is.
vec3 curtain(vec2 s, float k, float base, float tall, vec3 lo, vec3 hi) {
  float x = s.x, pull = 0., lean = 0.;
  for (int i = 0; i < ${g}; i++) { if (i >= uNP) break;
    float dx = uPtr[i].x - s.x;
    float g = uPtr[i].z * exp(-dx * dx / ${(2*b*b).toFixed(1)});
    lean += g;
    x += dx * g * .3;                                   // the folds draw in toward it
    pull += g * clamp(uPtr[i].y - base, -220., 220.) * .45;   // the edge reaches toward it
  }
  float t = uTime * (.035 + .012 * k);
  float edge = base + pull + (fbm(vec2(x * .0021 + k * 3.7 + t, k * 1.3 + t * .4), 3u + uint(k)) - .5) * 190.;
  float d = edge - s.y;                                 // > 0 above the lower edge
  float rays = pow(vnoise(vec2(x * .09 + k * 11., t * 3.), 9u + uint(k)), 1.6) * .85 + .15 * vnoise(vec2(x * .02 - t, k), 13u);
  float patch_ = smoothstep(.2, .75, fbm(vec2(x * .0013 + k * 5.1 - t * .5, k * 2.), 17u + uint(k)));
  float body = smoothstep(-14., 10., d) * exp(-max(d, 0.) / tall) * (1. + 1.4 * exp(-max(d, 0.) / 22.));
  float fringe = exp(-abs(d + 1.) / 5.);                // the bright hem
  vec3 c = mix(lo, hi, smoothstep(0., tall * 1.6, d));
  float bright = (body * (.2 + 1.1 * rays) + fringe * (.15 + .3 * rays)) * (.2 + .8 * patch_) * (1. + 1.3 * min(lean, 1.5));
  return c * bright;
}

void main(){
  vec2 scr = vec2(vUv.x, 1. - vUv.y) * uRes;
  float hz = uHorizon;
  // The night sky, a little lighter low down, with stars.
  vec3 c = mix(vec3(.006, .012, .03), vec3(.02, .04, .06), smoothstep(0., hz, scr.y));
  ivec2 sk = ivec2(floor(scr / 3.));
  c += vec3(.75, .8, .95) * step(.9978, hash(sk + ivec2(int(uView.y * .02), 0), 70u)) * .4 * (1. - smoothstep(0., hz, scr.y) * .7);
  // The ribbons.
  vec3 sky = vec3(0.);
  sky += curtain(scr, 0., uRes.y * .27, 160., vec3(.12, .95, .48), vec3(.42, .2, .78)) * .6;
  sky += curtain(scr, 1., uRes.y * .40, 110., vec3(.1, .85, .6), vec3(.2, .35, .85)) * .3;
  sky += curtain(scr, 2., uRes.y * .13, 130., vec3(.25, .9, .4), vec3(.6, .2, .6)) * .25;
  // The airglow low over the ridge, so the land stands dark against it.
  c += vec3(.02, .075, .06) * exp(-max(hz - scr.y, 0.) / (uRes.y * .12));
  float ridge = hz - 26. * fbm(vec2((scr.x - uView.y * .1) * .004, 0.), 21u) - 10. * vnoise(vec2((scr.x - uView.y * .2) * .03, 2.), 22u);
  if (scr.y < ridge) {
    c += sky;
  } else {
    // The land, in ground space: dark, with the sky's colour lying on it,
    // strongest just under the ridge and on the open ground.
    vec2 w = (scr - uView.yz) / uView.x;
    c = mix(vec3(.012, .02, .028), vec3(.03, .045, .055), fbm(w * .008, 31u));
    float fall = exp(-(scr.y - ridge) / (uRes.y * .25));
    vec3 glow = curtain(vec2(scr.x, hz - 60.), 0., uRes.y * .30, 120., vec3(.12, .95, .48), vec3(.42, .2, .78));
    c += glow * (.05 + .1 * fall);
  }
  // Items stand in the cool light: a faint rim round any the ribbons light.
  for (int i = 0; i < ${x}; i++) { if (i >= uNI) break;
    vec4 r = vec4(uItems[i].xy * uView.x + uView.yz, uItems[i].zw * uView.x);
    float sd = rectSd(scr, r);
    c += vec3(.35, .95, .75) * uGlow[i] * .4 * exp(-max(sd, 0.) / 16.) * step(0., sd);
    c *= 1. - .3 * exp(-max(sd, 0.) / 10.) * (1. - uGlow[i]); }
  o = vec4(c, 1.);
}`,B=(r,o)=>{const i=document.querySelector(`.item[data-item-id="${CSS.escape(r)}"]`);i&&(o>0?i.style.setProperty("--aurora-glow",o.toFixed(2)):i.style.removeProperty("--aurora-glow"))};function q(r=B){let o=null,i={},s=null,c=0;const a=new Map;let u=[];const k=new Float32Array(g*4);let p=0;const A=new Float32Array(x),m=new Map;return{name:"aurora",cursor:"crescent",lean:e=>z(e,u),setup(e){o=P(e,V,L),i=T(e,o),s=e.createVertexArray()},step(e,n){const{scale:f,tx:y,ty:w}=n.view,v=performance.now();c+=e*n.ambient;const I=new Set;u=[],p=0,k.fill(0);for(const t of n.pointers){I.add(t.id);const d=F(a.get(t.id)??0,v-t.at<250,t.weight,e);if(d===0){a.delete(t.id);continue}a.set(t.id,d);const l=t.x*f+y,h=t.y*f+w;u.push({x:l,e:d}),p<g&&k.set([l,h,d,0],4*p++)}for(const t of[...a.keys()])I.has(t)||a.delete(t);const S=n.items.length/4,M=n.itemIds??[];A.fill(0);const R=new Set;for(let t=0;t<S;t++){const d=u.length>0?H(n.items[t*4]*f+y,n.items[t*4+2]*f,u):0;t<x&&(A[t]=d);const l=M[t];if(!l)continue;R.add(l);const h=E(m.get(l)??0,d);h!==null&&(r(l,h),h===0?m.delete(l):m.set(l,h))}for(const t of[...m.keys()])R.has(t)||(r(t,0),m.delete(t));return n.ambient>.002||a.size>0},draw(e,n){if(!o)return;const{view:f,width:y,height:w}=n;e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight),e.disable(e.DEPTH_TEST),e.disable(e.BLEND),e.bindVertexArray(s),e.useProgram(o),e.uniform3f(i.uView,f.scale,f.tx,f.ty),e.uniform2f(i.uRes,y,w),e.uniform1f(i.uTime,c),e.uniform1f(i.uHorizon,Math.round(w*$)),e.uniform1i(i.uNP,p),e.uniform4fv(i.uPtr,k);const v=Math.min(n.items.length/4,x);e.uniform1i(i.uNI,v),v>0&&(e.uniform4fv(i.uItems,n.items.subarray(0,v*4)),e.uniform1fv(i.uGlow,A.subarray(0,v))),e.drawArrays(e.TRIANGLES,0,3),e.bindVertexArray(null)},dispose(e){for(const n of m.keys())r(n,0);m.clear(),o&&e.deleteProgram(o),s&&e.deleteVertexArray(s),o=null,s=null,a.clear(),u=[]}}}export{$ as HORIZON,q as createAurora};
