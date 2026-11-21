# Thilda Style Collection

A from-scratch storefront + admin panel, plain HTML/CSS/JS, no build step.

## Files
- `index.html`, `style.css`, `script.js` — the storefront. Reads `window.THILDA_DATA`, which `data.js` sets.
- `admin.html`, `admin.css`, `admin.js` — the admin panel. Edits `data.js` directly on disk.
- `data.js` — all editable content: site name, logo, WhatsApp number, categories, products.
  It's a plain JS file (`window.THILDA_DATA = { ... };`) rather than a `.json` file, loaded
  with a normal `<script>` tag instead of `fetch()` — that's what lets everything run straight
  from a double-clicked `file://` link, with **no local server required**.

## Running it
Just open `index.html` (storefront) and `admin.html` (admin panel) directly in your browser —
double-click them, or drag them into a browser window. Use **Chrome or Edge**; the admin
panel's live-save needs the File System Access API, which is Chromium-only for now.

(If you'd rather serve the folder over `http://` for some other reason — e.g. testing on
another device — any static server works fine too, nothing here depends on it.)

## Using the admin panel
1. Open `admin.html` and click **Open data.js**, then pick the `data.js`
   file that sits next to `index.html`.
2. Edit site name, tagline, logo (upload or paste a URL), WhatsApp number,
   currency, and the banner. Nothing is written to disk until you click
   **Save** in the top bar — the status pill shows *Unsaved changes* in the
   meantime, and *Saved* once it's written.
3. **Categories** — add or delete them; deleting one moves its products to
   "Uncategorized" rather than deleting them.
4. **Products** — click **Edit** on a row to expand it, use the ▲ / ▼ buttons
   to reorder (this order is what the storefront displays), and the **✕**
   button on the row to delete it directly (no need to open Edit first).
   Each product supports up to **3 images**, each one either a pasted URL or
   an uploaded file — these are exactly what powers the swipeable image
   gallery on the storefront (product cards swipe/arrow/dot through them,
   and the quick-view popup shows the same gallery larger).
5. The status pill in the top bar shows *Unsaved changes* / *Saving…* /
   *Saved* / *Couldn't save*, and the **Save** button is only enabled once
   there's something to save. If you reload the admin page, it remembers the
   last file and offers a one-click **Reconnect** (the browser still requires
   that click before it will grant file-write permission again).
6. **Refresh the storefront tab** to see changes — admin and storefront are
   separate pages/windows, so nothing pushes live between them; `index.html`
   re-reads `data.js` fresh (with cache-busting) on every reload, so a normal
   refresh after clicking Save is all that's needed.

On the storefront itself, clicking anywhere on a product card (other than
the **+** add-to-cart button or the image arrows/dots) opens a quick-view
popup with the full description, larger swipeable gallery, and a quantity
selector.

If you're on a non-Chromium browser, the panel still works: it swaps to
**Upload JSON** / **Download backup** so you can load a file, edit it, and
save the result manually.

## Data shape (`data.js`)
```json
{
  "siteName": "Thilda Style Collection",
  "tagline": "…",
  "logo": "",
  "whatsappNumber": "2348012345678",
  "currency": "₦",
  "banner": "…",
  "categories": [{ "id": "cat-apparel", "name": "Apparel" }],
  "products": [
    {
      "id": "p-01",
      "name": "…",
      "price": 84500,
      "compareAtPrice": null,
      "category": "cat-apparel",
      "images": ["", "", ""],
      "description": "…",
      "rating": 4.8,
      "featured": true,
      "inStock": true
    }
  ]
}
```
Product order in the array is display order on the storefront. `images` holds
0–3 URLs or `data:` URIs (from an upload); the storefront's gallery adapts to
however many are actually filled in. Files saved by an earlier version of
this admin panel with a single `image` string are still read fine — they get
migrated into `images` automatically the next time you open them.
