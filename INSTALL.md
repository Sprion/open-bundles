# Install

This file is written for an AI coding assistant (Claude Code or similar) that can run commands on the user's computer.
A person can follow it too: every step is a command or one click.

The user is asked for three things only: **their store domain**, **signing in to Shopify in the browser** (twice at
most), and **one Install click**. Everything else is your job.

## Rules

- **Never ask for, read, print or store keys.** No app secret, no access token. `scripts/connect.py` gets the app
  secret from the Shopify CLI and saves it outside the repository without printing it. Do not run
  `shopify app env show` yourself and do not open `~/.open-bundles/`.
- **Never change the live theme.** All theme work happens on a copy. Publishing the copy is the user's decision.
- Run interactive commands (the ones that open a browser) where the user can see and answer them.
- Stop and tell the user when a step fails; do not work around it on the live store.

## 1. Ask the store domain

Ask: *"What is your store's myshopify.com domain? (Shopify admin > Settings > Domains)"*. Below it is `STORE`.

## 2. Tools and code

Needed: git, Python 3.10+, Node 20+, Shopify CLI. Check each (`python --version`, `node --version`, `shopify version`).
Install what is missing (`npm install -g @shopify/cli` for the CLI), telling the user what you install.

```bash
git clone https://github.com/Sprion/open-bundles.git
cd open-bundles
pip install -r editor/requirements.txt
cd app && npm install && cd ..
```

## 3. Create the Shopify app

```bash
shopify app config link --path app
```

Interactive. Tell the user before running it: *"A browser window opens: sign in with the Shopify account that owns
your store, pick its organization, and answer Yes to create a new app (name: Open Bundles)."*

Then check `app/shopify.app.toml`: `client_id` is filled in, and it still has

```toml
[access_scopes]
scopes = "read_products,read_orders,read_files,write_discounts"
```

If the link rewrote the file without that block, add it back.

## 4. Deploy the discount function

```bash
shopify app deploy --path app --force
```

This uploads the function and releases the app version.

## 5. Install the app on the store

Ask the user: *"Open dev.shopify.com, go to Apps > Open Bundles, click **Install app**, choose your store and confirm.
Tell me when it is done."* The store must belong to the organization picked in step 3.

## 6. Connect the editor

```bash
python scripts/connect.py --store STORE
```

It prints the shop name, then "Bundle discount created" (or "already exists"). If it lists missing scopes, check step 3,
redeploy, and ask the user to accept the app update in the store admin.

## 7. Add the block to a copy of the theme

```bash
shopify theme list --store STORE --role live --json
shopify theme duplicate --store STORE --theme LIVE_ID --name "Bundles test" --json
shopify theme pull --store STORE --theme COPY_ID --path .theme-work
```

`.theme-work/` is ignored by git. Then:

1. Copy `theme/snippets/*` into `.theme-work/snippets/` and `theme/assets/ob-bundle.js` into `.theme-work/assets/`.
2. Find the product form: `templates/product.json` names the main section; open `sections/<that type>.liquid`.
3. Render the block where the theme renders its buy buttons:

   ```liquid
   {% render 'ob-offer', product: product, section: section %}
   ```

4. On products that have a bundle the block brings its own variant pickers and Add to cart button, so hide the theme's
   (variant picker, quantity, buy buttons). Compute once near the top of the section:

   ```liquid
   {%- liquid
     assign ob_key = 'gid://shopify/Product/' | append: product.id
     assign ob_has_bundle = false
     if shop.metafields.open_bundles.config.value.products[ob_key] != blank
       assign ob_has_bundle = true
     endif
   -%}
   ```

   and wrap each of those parts in `{% unless ob_has_bundle %}...{% endunless %}`. In block-based themes they are
   `{%- when 'variant_picker' -%}`, `{%- when 'quantity_selector' -%}`, `{%- when 'buy_buttons' -%}` branches: wrap the
   content of each branch, and put the render in the `buy_buttons` branch outside the `unless`.
5. Push only what changed, to the copy:

   ```bash
   shopify theme push --store STORE --theme COPY_ID --path .theme-work --nodelete --only snippets/ob-* --only assets/ob-bundle.js --only sections/MAIN_SECTION.liquid
   python scripts/connect.py --store STORE --preview-theme COPY_ID
   ```

   The second command makes the editor's "Open" links use the copy.

## 8. First bundle

Start the editor and keep it running:

```bash
python editor/server.py
```

Tell the user: *"Open http://127.0.0.1:8787, click + Create bundle, pick a style, choose your product, adjust the
texts and Save. Then choose the product page under Shown on."*

If the user asks you to do it: `GET http://127.0.0.1:8787/api/bundles` lists the store's products (`productList`) and
the starting styles (`templates`). Save with `POST /api/bundles/<id>` (body: the bundle; header `X-editor: 1`), then
`POST /api/bundles/assign` with `{"handle": "<product handle>", "bundle": "<id>"}`. A style with sample gifts or
sample pictures must have them replaced or removed before it saves.

## 9. Check, then go live

Open `https://STORE/products/HANDLE?preview_theme_id=COPY_ID`: the bundle shows, Add to cart adds the right items,
and the cart total has the bundle discount. Show the user, and fix what is off.

Going live is the user's call: they publish the copy in Online Store > Themes, or ask you to run
`shopify theme publish --store STORE --theme COPY_ID`.

## Without an AI

Same steps by hand. Instead of step 6 you can also click **Connect to store** in the editor and type the app's client
ID and secret (Dev Dashboard > Open Bundles > Settings).
