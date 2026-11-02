/** Actual rendered evidence for the frozen design-lint pilot; no model calls. */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { browser, until } from './browser.mjs';

const digest = text => createHash('sha256').update(text).digest('hex');
const safe = text => String(text).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120) || 'render';
const restrictions = { pageScripts: 'disabled through CDP', network: 'http, https and file requests blocked through CDP', deviceScaleFactor: 1, mobileEmulation: false, humanIntent: 'unmeasured', visibilityBoundary: 'Computed paint and text rectangles plus a 4px DOM hit-test grid, including pointer-events:none covers; transparent overlays can conservatively fail. Not a pixel-level or human-intent certification.' };

/** Runs in Chrome. All expected values come from the previously frozen task. */
function inspectDocument(invariants) {
  const checks = [];
  const elements = [];
  const check = (code, selector, passed, actual, expected) => checks.push({ code, selector, passed: !!passed, actual, ...(expected === undefined ? {} : { expected }) });
  const rectOf = rect => ({ x: rect.x, y: rect.y, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height });
  const normalizeText = text => text.replace(/\s+/g, ' ').trim();
  const within = (rect, bounds) => rect.left >= bounds.left - 0.75 && rect.right <= bounds.right + 0.75 && rect.top >= bounds.top - 0.75 && rect.bottom <= bounds.bottom + 0.75;
  const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const chain = element => { const out = []; for (let at = element; at; at = at.parentElement) out.push(at); return out; };
  const shown = element => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true }) && chain(element).every(at => {
    const style = getComputedStyle(at);
    return style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0.01 && style.contentVisibility !== 'hidden' && style.filter === 'none' && style.clipPath === 'none' && style.maskImage === 'none' && style.clip === 'auto' && style.mixBlendMode === 'normal';
  });
  const clipping = (element, rect) => chain(element).filter(at => {
    const style = getComputedStyle(at);
    const box = at.getBoundingClientRect();
    const x = ['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowX);
    const y = ['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowY);
    return (x && (rect.left < box.left + at.clientLeft - 0.75 || rect.right > box.left + at.clientLeft + at.clientWidth + 0.75)) || (y && (rect.top < box.top + at.clientTop - 0.75 || rect.bottom > box.top + at.clientTop + at.clientHeight + 0.75));
  }).map(at => at.id ? `#${at.id}` : at.localName);
  const rgba = color => {
    const context = document.createElement('canvas').getContext('2d');
    context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  };
  const paintedText = element => {
    const style = getComputedStyle(element);
    const ink = rgba(style.webkitTextFillColor || style.color);
    if (ink[3] < 32) return false;
    let ground = [255, 255, 255, 255];
    for (const at of chain(element)) { const value = rgba(getComputedStyle(at).backgroundColor); if (value[3] === 255) { ground = value; break; } }
    return !ink.every((value, i) => value === ground[i]);
  };
  const hit = (element, rect) => {
    // Hit-testing normally skips pointer-events:none overlays even when they paint.
    // Include them for this observation, then restore exact inline attributes.
    const originals = [...document.querySelectorAll('*')].map(node => [node, node.getAttribute('style')]);
    try {
      for (const [node] of originals) node.style.setProperty('pointer-events', 'auto', 'important');
      const columns = Math.max(1, Math.ceil(rect.width / 4));
      const rows = Math.max(1, Math.ceil(rect.height / 4));
      for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
        const found = document.elementFromPoint(rect.left + rect.width * (column + 0.5) / columns, rect.top + rect.height * (row + 0.5) / rows);
        if (!found || (found !== element && !found.contains(element))) return false;
      }
      return true;
    } finally {
      for (const [node, original] of originals) {
        if (original === null) node.removeAttribute('style'); else node.setAttribute('style', original);
      }
    }
  };
  const authored = (element, property) => {
    if (element.style.getPropertyValue(property)) return true;
    const read = rules => [...rules].some(rule => {
      if (rule.selectorText && rule.style && element.matches(rule.selectorText) && rule.style.getPropertyValue(property)) return true;
      if (!rule.cssRules) return false;
      if (rule.type === CSSRule.MEDIA_RULE && !matchMedia(rule.conditionText).matches) return false;
      if (rule.type === CSSRule.SUPPORTS_RULE && !CSS.supports(rule.conditionText)) return false;
      return read(rule.cssRules);
    });
    return [...document.styleSheets].some(sheet => { try { return !sheet.disabled && read(sheet.cssRules); } catch { return false; } });
  };
  check('nonempty-page', 'body', !!document.body && normalizeText(document.body.innerText).length > 0, document.body?.innerText?.trim().length ?? 0, '> 0 visible characters');
  const styleCount = [...document.querySelectorAll('style')].filter(node => node.textContent.trim()).length;
  check('required-style-elements', 'style', styleCount >= invariants.minimumStyleElements, styleCount, invariants.minimumStyleElements);
  for (const required of invariants.required) {
    const found = document.querySelectorAll(required.selector);
    check('unique-required-element', required.selector, found.length === 1, found.length, 1);
    if (found.length !== 1) continue;
    const element = found[0];
    const style = getComputedStyle(element);
    const rect = rectOf(element.getBoundingClientRect());
    const data = { selector: required.selector, tag: element.localName, text: normalizeText(element.textContent), rect, computed: {}, textRects: [] };
    elements.push(data);
    check('semantic-element', required.selector, element.localName === required.tag, element.localName, required.tag);
    check('element-visible', required.selector, shown(element) && rect.width > 0 && rect.height > 0, { shown: shown(element), rect }, 'painted nonzero element');
    if (invariants.requireViewportFit) check('element-in-viewport', required.selector, within(rect, viewport), rect, viewport);
    if (required.recipe !== undefined) check('recipe-identity', required.selector, element.getAttribute('data-isocan-recipe') === required.recipe, element.getAttribute('data-isocan-recipe'), required.recipe);
    for (const [name, value] of Object.entries(required.attributes ?? {})) check('required-attribute', required.selector, element.getAttribute(name) === value, { name, value: element.getAttribute(name) }, value);
    for (const [property, value] of Object.entries(required.computed ?? {})) {
      data.computed[property] = style.getPropertyValue(property);
      check('required-computed-style', required.selector, data.computed[property] === value, { property, value: data.computed[property] }, value);
    }
    for (const property of required.styleProperties ?? []) check('authored-style-retained', required.selector, authored(element, property), { property, authored: authored(element, property) }, true);
    if (required.minFontSize !== undefined) check('minimum-font-size', required.selector, parseFloat(style.fontSize) >= required.minFontSize, style.fontSize, required.minFontSize);
    if (required.text !== undefined) {
      check('required-text', required.selector, data.text === normalizeText(required.text), data.text, required.text);
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let textNode;
      while ((textNode = walker.nextNode())) {
        if (!textNode.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(textNode);
        const boxes = [...range.getClientRects()].filter(one => one.width > 0 && one.height > 0);
        check('text-has-rectangles', required.selector, boxes.length > 0, boxes.length, '> 0');
        check('text-painted', required.selector, shown(textNode.parentElement) && paintedText(textNode.parentElement), { parent: textNode.parentElement.localName, color: getComputedStyle(textNode.parentElement).color }, 'visible nontransparent text distinct from its background');
        for (const box of boxes) {
          const textRect = rectOf(box); data.textRects.push(textRect);
          check('rendered-text-height', required.selector, box.height >= (required.minFontSize ?? 1), box.height, required.minFontSize ?? 1);
          if (invariants.requireViewportFit) check('text-in-viewport', required.selector, within(box, viewport), textRect, viewport);
          if (invariants.requireUnclippedText) check('text-unclipped', required.selector, clipping(textNode.parentElement, box).length === 0, clipping(textNode.parentElement, box), []);
          check('text-uncovered', required.selector, hit(textNode.parentElement, box), textRect, 'text hit-test belongs to its element');
        }
      }
    }
  }
  for (const distinct of invariants.distinctStyles ?? []) {
    const left = document.querySelector(distinct.left), right = document.querySelector(distinct.right);
    const values = left && right ? [getComputedStyle(left).getPropertyValue(distinct.property), getComputedStyle(right).getPropertyValue(distinct.property)] : [];
    check('distinct-meaningful-style', `${distinct.left}, ${distinct.right}`, values.length === 2 && values[0] !== values[1], values, distinct.property);
  }
  return { viewport: { width: innerWidth, height: innerHeight }, checks, violations: checks.filter(check => !check.passed), elements, styleElements: styleCount, pageScripts: document.scripts.length };
}

function inspectInteraction(invariant) {
  const trigger = document.querySelector(invariant.triggerSelector), target = document.querySelector(invariant.targetSelector);
  const visible = node => !!node && node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
  const rect = trigger?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : null, y = rect ? rect.top + rect.height / 2 : null;
  const hit = rect ? document.elementFromPoint(x, y) : null;
  const range = target && document.createRange(); if (range) range.selectNodeContents(target);
  const textRects = range ? [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0).map(rect => rect.toJSON()) : [];
  return { triggerPresent: !!trigger, targetPresent: !!target, focusable: !!trigger && !trigger.disabled && trigger.getAttribute('aria-disabled') !== 'true' && trigger.tabIndex >= 0, focused: !!trigger && document.activeElement === trigger, hitTarget: !!trigger && !!hit && trigger.contains(hit), point: { x, y }, targetVisible: visible(target), targetOpen: !!target && target.matches(':popover-open'), targetText: target?.textContent.replace(/\s+/g, ' ').trim() ?? null, targetTextRects: textRects, textFitsViewport: textRects.length > 0 && textRects.every(rect => rect.left >= -0.75 && rect.top >= -0.75 && rect.right <= innerWidth + 0.75 && rect.bottom <= innerHeight + 0.75) };
}

export async function createEvalBrowser() {
  const b = await browser();
  let version;
  try {
  await b.send('Network.enable');
  await b.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*', 'file://*'] });
  await b.send('Emulation.setScriptExecutionDisabled', { value: true });
  version = await b.send('Browser.getVersion');
  } catch (error) { await b.close(); throw error; }
  return {
    close: () => b.close(),
    async inspect({ task, html, outputDir, label = task.id }) {
      const started = performance.now();
      const result = { available: true, complete: false, passed: false, inputHash: digest(html), browserVersion: version.product, restrictions, viewports: [], screenshots: [], violations: [] };
      mkdirSync(outputDir, { recursive: true });
      const requested = [];
      const stop = b.on('Network.requestWillBeSent', event => { if (event.request.url.startsWith('http:') || event.request.url.startsWith('https:') || event.request.url.startsWith('file:')) requested.push(event.request.url); });
      try {
        if (!task.invariants?.required?.length || JSON.stringify(task.viewports) !== JSON.stringify([{ width: 390, height: 844 }, { width: 1280, height: 900 }])) throw new Error('Frozen task invariants and both viewports are required.');
        for (const viewport of task.viewports) {
          await b.send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: false });
          const url = `data:text/html;base64,${Buffer.from(html).toString('base64')}`;
          await b.send('Page.navigate', { url });
          await until(b, `document.URL === ${JSON.stringify(url)} && document.readyState === 'complete'`, 'the exact stored HTML to finish loading');
          await b.ev('document.fonts.ready.then(() => true)');
          const measured = await b.ev(`(${inspectDocument.toString()})(${JSON.stringify(task.invariants)})`);
          measured.checks.push({ code: 'actual-viewport', passed: measured.viewport.width === viewport.width && measured.viewport.height === viewport.height, actual: measured.viewport, expected: viewport });
          const screenshot = path.resolve(outputDir, `${safe(label)}-${viewport.width}x${viewport.height}.png`);
          const capture = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          writeFileSync(screenshot, Buffer.from(capture.data, 'base64'));
          measured.screenshot = screenshot;
          result.screenshots.push({ ...viewport, path: screenshot });
          const interactionExpression = `(${inspectInteraction.toString()})(${JSON.stringify(task.invariants.interaction)})`;
          const before = await b.ev(interactionExpression);
          const focusTrail = [];
          for (let step = 0; step < 8 && before.triggerPresent; step += 1) {
            for (const type of ['keyDown', 'keyUp']) await b.send('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
            const focus = await b.ev(interactionExpression); focusTrail.push(focus.focused);
            if (focus.focused) break;
          }
          const focused = await b.ev(interactionExpression);
          if (focused.triggerPresent && focused.point.x !== null) for (const type of ['mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, ...focused.point, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
          const after = await b.ev(interactionExpression);
          const responseEvidence = await b.ev(`(${inspectDocument.toString()})(${JSON.stringify({ required: [{ selector: task.invariants.interaction.targetSelector, tag: 'div', text: task.invariants.interaction.visibleText }], minimumStyleElements: task.invariants.minimumStyleElements, requireViewportFit: true, requireUnclippedText: true })})`);
          const responseScreenshot = path.resolve(outputDir, `${safe(label)}-${viewport.width}x${viewport.height}-response.png`);
          const responseCapture = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          writeFileSync(responseScreenshot, Buffer.from(responseCapture.data, 'base64'));
          const interaction = { responseEvidence, responseScreenshot, before, focused, after, focusTrail, passed: before.focusable && !before.targetVisible && focused.focused && focused.hitTarget && after.targetVisible && after.targetOpen && after.targetText === task.invariants.interaction.visibleText && after.textFitsViewport && responseEvidence.violations.length === 0 };
          measured.interaction = interaction;
          measured.checks.push({ code: 'real-focus-and-click-response', selector: task.invariants.interaction.triggerSelector, passed: interaction.passed, actual: interaction, expected: task.invariants.interaction });
          measured.violations = measured.checks.filter(check => !check.passed);
          result.viewports.push(measured);
          result.violations.push(...measured.violations.map(violation => ({ ...violation, viewport })));
        }
        result.networkRequests = requested;
        if (requested.length) result.violations.push({ code: 'blocked-network-dependency', passed: false, actual: requested });
        result.complete = result.passed = result.violations.length === 0 && result.viewports.length === 2;
      } catch (error) { result.available = false; result.reason = error.message; result.violations.push({ code: 'browser-evidence-unavailable', passed: false, actual: error.message }); }
      finally { stop(); }
      result.elapsedMs = Math.round((performance.now() - started) * 100) / 100;
      return result;
    },
  };
}

/** Convenience entry point; a runner may share createEvalBrowser sequentially. */
export async function assessStoredHtml(args) {
  let owner;
  try { owner = await createEvalBrowser(); return await owner.inspect(args); }
  catch (error) { return { available: false, complete: false, passed: false, inputHash: digest(args.html), reason: error.message, restrictions, viewports: [], screenshots: [], violations: [{ code: 'browser-evidence-unavailable', passed: false, actual: error.message }] }; }
  finally { await owner?.close(); }
}
