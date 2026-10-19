import { MORPH_MAX_PIECES } from "@isocan/core";

/**
 * **The morph's hands inside a slide** (`@isocan/core`'s `morph.ts` is its
 * head).
 *
 * A screen is a sandboxed frame the app cannot look into — on purpose: the
 * page is somebody else's code. So for a morph, the surface loads a TWIN of
 * each slide under the same lone `allow-scripts` sandbox every item frame
 * gets (an opaque origin: no cookie, no API, no storage, nothing of ours to
 * reach — the draft preview's posture, `ArtifactStage`), with this script
 * added. It does two things and nothing else:
 *
 * 1. once the page has loaded and its fonts are in, it lists the slide's
 *    pieces — runs of words, pictures, decorated boxes — with where each one
 *    sits, and posts the list (`isocan:morph:scene`);
 * 2. when ARMED with keyframes (`isocan:morph:arm`), it sets them on those
 *    same elements paused at their first frame, paints that frame, and says
 *    so (`isocan:morph:armed`); on `isocan:morph:play` it lets them run, and
 *    on `isocan:morph:reset` it stops them, which leaves the page as it was.
 *
 * Armed before shown, because a frame that has been all but invisible has
 * nothing painted to show: the first morph opened on a blank stage for a
 * fifth of a second while the browser caught up (measured 19 Oct). An armed
 * twin has painted its first frame — which is exactly the live slide, or
 * nothing at all — before anybody can see it.
 *
 * It decides nothing. Which piece becomes which, and where everything is at
 * every moment, is core's `morphPlan`, so the motion can be tested without a
 * browser and the in-page code stays small enough to read.
 *
 * Inside the twin, unlike from outside, the script CAN wait for
 * `document.fonts.ready` — so the pieces are measured in the face the slide
 * will actually be shown in, and match the live frame the morph hands over
 * to at the end.
 */
const RUNTIME = `(function(){
var MAX=${MORPH_MAX_PIECES};
var els=[],ground=null,anims=[];
function vis(cs){return cs.display!=="none"&&cs.visibility!=="hidden"&&parseFloat(cs.opacity)>0}
var MEDIA=/^(img|svg|video|canvas|picture|iframe|input|button|select|textarea|hr)$/;
function inl(cs,tag){return (cs.display==="inline"||cs.display==="contents")&&!MEDIA.test(tag)}
function decorated(cs){
  var bg=cs.backgroundColor;
  if(bg&&bg!=="transparent"&&!/rgba\\([^)]*,\\s*0\\)$/.test(bg))return true;
  if(cs.backgroundImage&&cs.backgroundImage!=="none")return true;
  if(cs.boxShadow&&cs.boxShadow!=="none")return true;
  return ["Top","Right","Bottom","Left"].some(function(s){return parseFloat(cs["border"+s+"Width"])>0&&cs["border"+s+"Style"]!=="none"});
}
function textBlock(el){
  if(!(el.textContent||"").trim())return false;
  for(var c=el.firstElementChild;c;c=c.nextElementSibling){
    var cs=getComputedStyle(c);
    if(cs.display!=="none"&&cs.display.indexOf("inline")!==0)return false;
  }
  return true;
}
function sig(el){var c=(el.getAttribute("class")||"").trim().split(/\\s+/).filter(Boolean).slice(0,4);return c.length?c.join(" "):undefined}
function scene(){
  els=[];var out=[],W=innerWidth,H=innerHeight;
  function walk(el,up){
    var tag=el.tagName.toLowerCase();
    if(/^(script|style|template|noscript|head|meta|link|title)$/.test(tag))return;
    var cs=getComputedStyle(el);if(!vis(cs))return;
    var r=el.getBoundingClientRect();
    var media=MEDIA.test(tag),text=!media&&!inl(cs,tag)&&textBlock(el);
    var box=!media&&!text&&!inl(cs,tag)&&decorated(cs)&&r.width*r.height<W*H*0.9;
    var on=r.width>=2&&r.height>=2&&r.bottom>0&&r.right>0&&r.top<H&&r.left<W;
    var at=up;
    if((media||text||box)&&on&&(cs.transform==="none"||cs.transform==="matrix(1, 0, 0, 1, 0, 0)")&&out.length<MAX){
      at=out.length;els.push(el);
      out.push({i:at,parent:up,kind:media?"media":text?"text":"box",tag:tag,
        key:el.getAttribute("data-morph")||el.id||undefined,
        text:text?(el.textContent||"").replace(/\\s+/g," ").trim().slice(0,160):undefined,
        src:media?(el.currentSrc||el.getAttribute("src")||undefined):undefined,
        cls:sig(el),x:r.left,y:r.top,w:r.width,h:r.height});
    }
    if(media||text)return;
    for(var c=el.firstElementChild;c;c=c.nextElementSibling)walk(c,at);
  }
  /* Measured as shown: a twin resting invisible (its pose) has a body at
     opacity 0, and every piece in it would read as hidden. */
  var b=document.body,was=b?b.style.opacity:"";
  if(b){b.style.opacity="";walk(b,-1);b.style.opacity=was}
  prep();
  parent.postMessage({type:"isocan:morph:scene",w:W,h:H,pieces:out},"*");
}
/* **Every layer the morph will move exists, and has been painted, long
   before the morph.** Promoting a piece to its own layer at the moment it
   starts to move means painting it for the first time in front of the room:
   the first morphs opened on a blank stage, then a ground with no pieces on
   it, for three or four frames (measured 19 Oct). So the twin is laid out
   for the motion as soon as its pieces are known — the background lifted
   into its own layer, each piece promoted — and looks exactly the same. */
function prep(){
  if(!ground)lay();
  els.forEach(function(el){el.style.transformOrigin="0 0";el.style.willChange="transform, opacity"});
}
function lay(){
  /* The slide's own background becomes a layer of its own, so it can fade
     while the pieces stand in front of it. */
  var de=document.documentElement,b=document.body,src=getComputedStyle(de);
  var bs=b?getComputedStyle(b):src;
  var pick=(src.backgroundColor!=="rgba(0, 0, 0, 0)"||src.backgroundImage!=="none")?src:bs;
  ground=document.createElement("div");
  var g=ground.style;g.position="fixed";g.inset="0";g.zIndex="-2147483647";g.pointerEvents="none";g.transformOrigin="0 0";g.willChange="transform, opacity";
  g.backgroundColor=pick.backgroundColor;g.backgroundImage=pick.backgroundImage;g.backgroundSize=pick.backgroundSize;
  g.backgroundPosition=pick.backgroundPosition;g.backgroundRepeat=pick.backgroundRepeat;
  /* Nothing painted: the browser's own page colour, which is what the live frame shows. */
  if(pick.backgroundColor==="rgba(0, 0, 0, 0)"&&pick.backgroundImage==="none")g.backgroundColor="Canvas";
  de.style.background="transparent";if(b)b.style.background="transparent";
  (b||de).appendChild(ground);
}
function reset(){
  anims.forEach(function(a){a.cancel()});anims=[];
}
/* **A pose: shown, or not at all.** A twin can take a frame or two to put
   a new picture on screen. So each twin rests in the pose its morph will
   START from — the slide on screen shown, its neighbours invisible — and
   arming changes nothing anybody could see in the meantime. */
function pose(shown){if(document.body)document.body.style.opacity=shown?"":"0"}
addEventListener("message",function(e){
  if(e.source!==parent||!e.data)return;var d=e.data;
  if(d.type==="isocan:morph:reset"){reset();return}
  if(d.type==="isocan:morph:pose"){if(!anims.length)pose(!!d.shown);return}
  if(d.type==="isocan:morph:play"){anims.forEach(function(a){a.play()});return}
  if(d.type!=="isocan:morph:arm"||!d.side)return;
  reset();prep();pose(true);var ms=+d.ms||1400;
  anims.push(ground.animate(d.side.ground,{duration:ms,fill:"both",easing:"linear"}));
  d.side.tracks.forEach(function(t){
    var el=els[t.i];if(!el)return;
    anims.push(el.animate(t.frames,{duration:ms,fill:"both",easing:"linear"}));
  });
  anims.forEach(function(a){a.pause();a.currentTime=0});
  requestAnimationFrame(function(){requestAnimationFrame(function(){parent.postMessage({type:"isocan:morph:armed"},"*")})});
});
function ready(){
  var fonts=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();
  fonts.then(function(){requestAnimationFrame(function(){requestAnimationFrame(scene)})});
}
if(document.readyState==="complete")ready();else addEventListener("load",ready);
/* The twin follows the live frame's size; pieces measured at the old size
   would land somewhere else. */
var again;addEventListener("resize",function(){if(anims.length)return;clearTimeout(again);again=setTimeout(scene,150)});
})();`;

/**
 * A slide's HTML with the runtime added — the twin the morph stage loads.
 * At the end of the body, so it runs after the slide's own markup and never
 * ahead of a script the slide expects to run first.
 */
export function morphTwin(html: string): string {
  const tag = `<script>${RUNTIME}</script>`;
  const at = html.search(/<\/body\s*>/i);
  return at === -1 ? html + tag : html.slice(0, at) + tag + html.slice(at);
}
