## Stickers

An emoji you can put on the canvas as an item. A sticker is an ordinary file —
the emoji itself, typed `text/vnd.isocan.sticker` — so a canvas full of them is
readable by a build that has never heard of this module.

`isocan sticker ls` prints the five this build can drop.
`isocan sticker drop <sticker>` puts one on the canvas — by id, by name, or
paste the emoji itself — and takes `--at x,y` like anything else that lands
somewhere.

```sh
isocan sticker ls
isocan sticker drop fire
isocan sticker drop 🎉 --at 200,400
```

The app has a tray on the left edge you drag them out of, which is the same
act. It is behind **Settings → Experiments → Stickers**, because the module
API it is built on — overlays, drops, and the host a component writes through
— is still changing.

Use `sticker drop fire --in <group> --cell 1,2` for a group grid cell.
Insertion and required frame growth are one act; `--json` reports the accepted
item ID and final box. Dropping from the browser tray uses the highlighted
group captured at drop time.
