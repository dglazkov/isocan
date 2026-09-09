## Stickers

Five emoji stickers you can drop onto the canvas: ⭐, ❤️, 🔥, 👍, 🎉.

Stickers are ordinary items whose blob is a UTF-8 `.sticker` file with mime
`text/vnd.isocan.sticker`. If the stickers module is unloaded, the item renders
as a document containing the emoji.

### Quick reference

- `isocan sticker drop <emoji>` — drop one of 5 emoji onto the canvas (`--at <x,y>`, `--anchor <item>`)
- `isocan sticker ls` — list available stickers and stickers on the canvas

You can specify a sticker by its emoji (`🔥`, `❤️`, etc.) or by its name:
`star`, `heart`, `fire`, `thumbs-up`, `party`.

