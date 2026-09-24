import{ar as f}from"./index-BVPF-bQo.js";import{n as h}from"./slidewrites-DG6_owGJ.js";function m(t,n){return f(t,n).flatMap(i=>{const o=r(i);if(!o)return[];const e=h(t,i.id),s=e?r(e):null;return[{id:i.id,title:i.title,mimeType:o.mimeType,blobHash:o.blobHash,...e&&s?{note:{id:e.id,blobHash:s.blobHash}}:{}}]})}function r(t){return t.versions.find(n=>n.id===t.currentVersionId)??t.versions[0]??null}function a(t){return t.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}function l(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;")}function y(t,n,i={}){const o=n.map((e,s)=>{const d=e.html!==void 0?`<iframe sandbox="allow-scripts" srcdoc="${a(e.html)}" title="${a(e.title)}"></iframe>`:e.imageDataUrl!==void 0?`<img src="${e.imageDataUrl}" alt="${a(e.title)}">`:`<div class="empty">${l(e.title)}<small>${l(e.mimeType)} — not something a deck can show</small></div>`,c=e.notes!==void 0&&e.notes.trim()!==""?`<aside class="notes">${l(e.notes)}</aside>`:"";return`<section class="slide" data-n="${s+1}" aria-label="${a(e.title)}"><div class="picture">${d}</div>${c}</section>`}).join(`
`);return`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${l(t)}</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; color: #fff; font: 14px system-ui, sans-serif; }
  .slide { position: absolute; inset: 0; display: none; flex-direction: column; }
  .slide.current { display: flex; }
  .picture { flex: 1; min-height: 0; }
  .slide iframe, .slide img { width: 100%; height: 100%; border: 0; object-fit: contain; background: #fff; }
  .notes { display: none; flex: none; max-height: 38%; overflow: auto; padding: 14px 20px; white-space: pre-wrap;
           background: #111; color: #ddd; border-top: 1px solid #333; font-size: 16px; line-height: 1.5; }
  body.notes .notes { display: block; }
  .empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #aaa; }
  .counter { position: fixed; right: 14px; bottom: 10px; opacity: 0.6; font-variant-numeric: tabular-nums; }
  @media print {
    @page { size: 13.333in 7.5in; margin: 0; }
    body { background: #fff; }
    .slide { position: static; display: flex; width: 100vw; height: 100vh; break-after: page; }
    body.notes .notes { display: block; max-height: 38%; background: #fff; color: #000; border-top: 1px solid #ccc; }
    .counter { display: none; }
  }
</style>
</head>
<body${i.withNotes?' class="notes"':""}>
${o}
<div class="counter"><span id="n">1</span> / ${n.length}</div>
<script>
  (function () {
    var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    var at = Math.max(0, Math.min(slides.length - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));
    function show(i) {
      at = Math.max(0, Math.min(slides.length - 1, i));
      slides.forEach(function (s, k) { s.classList.toggle("current", k === at); });
      document.getElementById("n").textContent = String(at + 1);
      history.replaceState(null, "", "#" + (at + 1));
    }
    var next = ["ArrowRight", "ArrowDown", "PageDown", " "], prev = ["ArrowLeft", "ArrowUp", "PageUp"];
    window.addEventListener("keydown", function (e) {
      if (next.indexOf(e.key) >= 0) { e.preventDefault(); show(at + 1); }
      else if (prev.indexOf(e.key) >= 0) { e.preventDefault(); show(at - 1); }
      else if (e.key === "Home") show(0);
      else if (e.key === "End") show(slides.length - 1);
      else if (e.key === "n" || e.key === "N") document.body.classList.toggle("notes");
    });
    window.addEventListener("click", function (e) { if (e.target === document.body) show(at + 1); });
    show(at);
  })();
<\/script>
</body>
</html>
`}function g(t,n){return`${t.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"deck"}.${n}`}export{y as a,g as b,m as d};
