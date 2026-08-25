# Source art

Vector sources for the raster files in `public/`. Nothing here is served: the
build only ships `public/`.

The social cards are typographic, so they are baked to PNG rather than served as
SVG — a crawler will not render an SVG `og:image`, and the brand font is not
installed on the machine that opens the link. Re-render after editing:

```sh
rsvg-convert -w 1200 -h 630 assets/og-en.svg -o public/og-en.png
rsvg-convert -w 1200 -h 630 assets/og-fr.svg -o public/og-fr.png
```

They are set in Adwaita Sans, an Inter derivative, because that is what the
renderer had; Inter Tight — the display face of the site — is the intended one
if it is available.

`public/favicon.svg` is served as-is and is the source of the icons beside it:

```sh
rsvg-convert -w 512 -h 512 public/favicon.svg -o public/icon-512.png
rsvg-convert -w 192 -h 192 public/favicon.svg -o public/icon-192.png
rsvg-convert -w 180 -h 180 public/favicon.svg -o public/apple-touch-icon.png
magick public/favicon.svg -background none \
	-define icon:auto-resize=16,32,48 public/favicon.ico
```
