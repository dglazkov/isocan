# The content origin

Item content is served from the same origin as the app and the API. This
proposes moving it to an origin that owns nothing, and argues that it is a
security fix which happens to unlock a feature rather than the other way
round.

## How it stands today

`blobUrl` returns a same-origin path:

```ts
`/api/projects/${canvasId}/blobs/${blobHash}`
```

An HTML item is rendered into an iframe pointed at that path:

```tsx
<iframe className="html-view" src={url} sandbox="allow-scripts" title={filename} />
```

The badge this browser carries is a **cookie**, handed out by the door.

Those three facts together mean the only thing standing between a file
somebody dropped on a canvas and the whole home is the absence of one token in
one attribute. `sandbox="allow-scripts"` gives an opaque origin, so the frame
is cross-origin to everything, sends no cookie, and can reach nothing. Add
`allow-same-origin` and all three reverse at once: the document becomes truly
same-origin, its `fetch` carries the badge cookie, and it can call `/api/…` as
the person sitting there — read every canvas, create, delete — as well as
reach the parent document and remove its own `sandbox` attribute.

The mini-browser is the instructive contrast. `.browser-view` *does* carry
`allow-scripts allow-same-origin allow-forms`, and that is correct: its `src`
is somebody else's site on another origin, so "same origin" means the site's
own, not ours. The rule is already understood in this codebase; it is the item
path that is the exception.

## Why it is worth changing anyway

Left alone, the current setting is safe. Two things make it worth moving.

**The isolation is a flag, not a structure.** An item is a file somebody put on
a canvas — increasingly a file an *agent* wrote, or one that arrived with a
skill installed from a stranger's repo. The blast radius of loosening one JSX
attribute is every canvas in the home, and the pressure to loosen it is real
and already here: an interactive item that wants to remember anything needs
storage, and storage needs `allow-same-origin`. A control that must never be
relaxed, sitting next to a good reason to relax it, is a control that will
eventually be relaxed by somebody who does not know all three facts above.

**The hosted build needs it regardless.** Once a home serves pages to people
who did not create the content on them, user HTML on the product's own origin
is not a preference, it is a defect. This is what `githubusercontent.com`,
`googleusercontent.com` and CodePen's `cdpn.io` are, and why they exist as
separate registrable domains rather than paths.

## The proposal

Serve item content from an origin that holds nothing: no cookie, no badge, no
API, no app.

- **Locally**, a second listener. The port is part of the origin, so
  `127.0.0.1:4442` is a different origin from `127.0.0.1:4441` for every
  purpose that matters here. It serves blobs and nothing else, and it needs no
  badge because it is reached by URLs that already carry a content hash.
- **Hosted**, a separate registrable domain. A subdomain is not enough on its
  own — cookies can be scoped to a parent domain — so this is a decision for
  the same conversation that picks `isocan.io`.

With that in place, `allow-scripts allow-same-origin` on an item becomes safe,
because the origin it is "same" as is the content origin: a place with nothing
in it to steal.

## What it buys

*(A third reason arrived after this was written: it is what makes a hosted
extension panel possible at all. See [extensions.md](extensions.md) — a panel
on the app's origin can read the badge cookie and act as the user, so without
a content origin that tier does not exist. This proposal is load-bearing for
three separate things now, which is the strongest argument for doing it.)*


- **The isolation stops depending on an attribute.** Even a misconfigured
  sandbox on the content origin reaches nothing.
- **Interactive items get storage.** An explorable page — the
  [atlas](../atlas-journey.md) is the case in hand — can remember what you
  pinned. Nothing has to know about isocan for this to work, which is the test
  of whether it is the right fix.
- **The hosted split is decided before it is urgent**, rather than during the
  phase that needs it.

## Costs, honestly

- **A second listener** to start, supervise and shut down, and one more thing
  that can be misconfigured.
- **Two origins in every URL decision** — the app builds content URLs against a
  different base, and something has to tell it what that base is.
- **Blob addressing has to stand alone.** Content URLs already carry a hash; a
  content origin must not be able to answer questions about *canvases*, or it
  has become a second API with no door on it.
- **It is not free in the hosted design either**: another domain, another
  certificate, another thing to provision.

## Open

- **Does the content origin authenticate at all?** A content hash is
  unguessable, which is the CDN answer, and it is not the same as private. For
  a local daemon on 127.0.0.1 it is fine. For a hosted home it is a real
  question and it belongs with the door's design, not here.
- **Which phase does the hosted half belong to?** It is a front-door concern
  and reads like phase 14's, but the local split can land any time and is
  useful on its own.
- **Does anything else render user content on our origin?** Markdown is parsed
  and rendered by the app rather than framed, which is a different exposure and
  not covered here. Worth a pass before assuming this closes the class.
