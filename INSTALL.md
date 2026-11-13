# Install

This file is written for an AI coding assistant (Claude Code or similar) that can run commands on the user's computer.
A person can follow it too: every step is a command or one click.

The user is asked for two things only: **their store domain** and **signing in to Shopify in the browser** once (the
Shopify CLI asks). A live store also needs **one Install click**; a dev store none. Everything else is your job.

## Rules

- **Never ask for, read, print or store keys.** No app secret, no access token. `scripts/connect.py` gets the app
  secret from the Shopify CLI and saves it outside the repository without printing it. Do not run
  `shopify app env show` yourself and do not open `~/.open-bundles/`.
- **Nothing reaches the live store before the user has seen it and said yes.** The first install always goes on a
  copy of the theme; you send preview links; only an explicit yes from the user (in their own words, after the
  previews) lets you push to the live theme. Ask again for every later live change. Some stores make thousands a day:
  a broken product page costs real money.
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
shopify organization list --json
```

The first Shopify CLI command opens the browser once for the user to sign in (tell them before you run it). Pick the
organization that owns `STORE` (`shopify store list --organization-id ORG_ID --json` lists its stores). Then create the
app in a temporary folder outside the repository, only to get its client ID, without any prompt:

```bash
shopify app init --name "Open Bundles" --organization-id ORG_ID --template none --path TEMP_DIR --no-input
```

Copy the `client_id` line of `TEMP_DIR/open-bundles/shopify.app.toml` into `app/shopify.app.toml` (replace
`client_id = ""`), then delete `TEMP_DIR`. Keep the rest of `app/shopify.app.toml` as it is: it holds the scopes.

## 4. Deploy the discount function

```bash
shopify app deploy --path app --allow-updates --no-input
```

This builds the function, uploads it and releases the app version.

## 5. Install the app on the store

**Dev store** (`shopify store list` shows `"type": "dev"`): install it without the user.

```bash
shopify app dev --path app --store STORE --no-input
```

Wait for "Access scopes auto-granted", then stop the command (it keeps running to watch for changes).

**Live store**: one click from the user. *"Open dev.shopify.com, go to Apps > Open Bundles, click Install app,
choose your store and confirm."* The store must belong to the organization picked in step 3.

## 6. Connect the editor

```bash
python scripts/connect.py --store STORE
```

It prints the shop name, then "Bundle discount created" (or "already exists"). If it lists missing scopes, check step 3,
redeploy, and ask the user to accept the app update in the store admin.

## 7. Add the block to a copy of the theme

Always a copy first, whatever the user says: the live theme is changed only in step 9, after they have seen the result.

```bash
shopify theme list --store STORE --role live --json
shopify theme duplicate --store STORE --theme LIVE_ID --name "Bundles test" --json --force --no-input
```

The copy's ID is `TARGET_ID`.

```bash
mkdir .theme-work
shopify theme pull --store STORE --theme TARGET_ID --path .theme-work --force --no-input
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
   shopify theme push --store STORE --theme TARGET_ID --path .theme-work --nodelete --only snippets/ob-* --only assets/ob-bundle.js --only sections/MAIN_SECTION.liquid --no-input
   ```

   Then `python scripts/connect.py --store STORE --preview-theme TARGET_ID` makes the editor's previews use the copy.

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

## 9. Preview, then go live

Send the user these links (all on the copy, visitors see nothing) and say what each should show:

- `https://STORE/products/HANDLE?preview_theme_id=TARGET_ID`: a product with a bundle. The bundle block shows in place
  of the usual buy buttons; choosing an offer and Add to cart puts the right items in the cart, at the bundle price.
- The same link for a product without a bundle: exactly as before.
- `https://STORE/?preview_theme_id=TARGET_ID` and a collection: exactly as before (the block only touches product pages
  that have a bundle).

Dev stores are password protected: the password is in the admin (Online Store > Preferences). The editor preview
(`POST /api/bundles/render/<key>` with the product handle) draws the block with the real product without the storefront.

Fix whatever the user reports, push to the copy again, send the links again. Only when the user says yes (for example
"go live"), put the same change on the live theme:

```bash
mkdir .theme-live
shopify theme pull --store STORE --theme LIVE_ID --path .theme-live --only sections/MAIN_SECTION.liquid --force --no-input
```

Make the same edit in `.theme-live/sections/MAIN_SECTION.liquid` (the live file may have changed since the copy was
made), copy the snippets and asset in, and push with `--theme LIVE_ID --allow-live` and the same `--only` list. Then
open the live product page and check it once more. Prefer this to publishing the copy: publishing would also undo
anything changed on the live theme in between.

Afterwards bundles and A/B tests need no theme work: the editor saves them to the store directly. It asks before each
change visitors would see (a bundle put on a product page, a live bundle edited, a test started), with a store preview.

## Undo

- One product: in the editor, set its bundle's "Shown on" to "No product page". The page is back to normal at once.
- Every bundle: Shopify admin > Discounts, turn off "Open Bundles", and set every bundle to "No product page".
- The theme: remove the `ob-offer` render and the `ob_has_bundle` lines from the product section (or restore the
  section from the theme's version history). Products without a bundle never showed anything, so nothing else changes.

## Without an AI

Same steps by hand. Instead of step 6 you can also click **Connect to store** in the editor and type the app's client
ID and secret (Dev Dashboard > Open Bundles > Settings).
