# Install

This file is written for an AI coding assistant (Claude Code or similar) that can run commands on the user's computer.
A person can follow it too: every step is a command or one click.

The user is asked for two things only: **their store domain** and **signing in to Shopify in the browser** once (the
Shopify CLI asks, unless it is already signed in). A live store also needs **one Install click**; a dev store none.
Everything else is your job, and every theme edit is yours to adapt: themes differ, so read the files before you
change them.

## Rules

- **Never ask for, read, print or store keys.** No app secret, no access token. `scripts/connect.py` gets the app
  secret from the Shopify CLI and saves it outside the repository without printing it. Do not run
  `shopify app env show` yourself, do not open `~/.open-bundles/`, and do not relay command output that contains a
  `key=` or a token (step 5).
- **Nothing reaches the live store before the user has seen it and said yes.** The first install always goes on a
  copy of the theme; you check it, then send preview links; only an explicit yes from the user (in their own words,
  after the previews) lets you change the live theme. Ask again for every later live change, including bundles you
  save or assign through the editor API once the live theme shows bundles. Some stores make thousands a day: a broken
  product page costs real money.
- Run long or interactive commands where the user can see them.
- Stop and tell the user when a step fails; do not work around it on the live store.
- Keep each theme file's line endings as they are (many themes use CRLF): edit in place, do not rewrite whole files.

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

Steps 3 and 4 change two tracked files in this clone (`app/shopify.app.toml` gets the app's client ID,
`app/extensions/open-bundles/shopify.extension.toml` a `uid`). That is expected: they are this user's settings; do not
commit or reset them.

## 3. Create the Shopify app

```bash
shopify organization list --json
```

If the CLI is not signed in yet, this opens the browser for the user to sign in: tell them before you run it. Pick the
organization that owns `STORE` (`shopify store list --organization-id ORG_ID --json` lists its stores). Then create the
app in a new temporary folder **outside** the clone (for example next to it), only to get its client ID:

```bash
shopify app init --name "Open Bundles" --organization-id ORG_ID --template none --path TEMP_DIR --no-input
```

The CLI makes `TEMP_DIR/open-bundles/`. Copy the `client_id = "..."` line of `TEMP_DIR/open-bundles/shopify.app.toml`
over `client_id = ""` in `app/shopify.app.toml`, keep the rest of that file (it holds the scopes), then delete `TEMP_DIR`.

## 4. Deploy the discount function

```bash
shopify app deploy --path app --allow-updates --no-input
```

This builds the function, uploads it and releases the app version.

## 5. Install the app on the store

**Dev store** (`shopify store list` shows `"type": "dev"`): install it without the user. `shopify app dev` installs the
app, then keeps running; its output contains a GraphiQL link with a `key=`, so send it to a log file outside the clone
and never show that file:

```bash
shopify app dev --path app --store STORE --no-input > LOG_FILE 2>&1 &
```

Wait until the log contains "Access scopes auto-granted" (about 30 seconds), then stop the process and its children
(Windows: `taskkill /T /F /PID <pid>`; macOS and Linux: `kill` the process group), and delete the log. The released
version from step 4 stays installed.

**Live store**: one click from the user. *"Open dev.shopify.com, go to Apps > Open Bundles, click Install app,
choose your store and confirm."* The store must belong to the organization picked in step 3.

## 6. Connect the editor

```bash
python scripts/connect.py --store STORE
```

It prints the shop name, then "Bundle discount created" (or "already exists"). If it lists missing scopes, check step 3,
redeploy, and ask the user to accept the app update in the store admin.

## 7. First bundle

Start the editor and keep it running (in the background):

```bash
python editor/server.py
```

Ask the user which product gets the first bundle, then either:

- tell them: *"Open http://127.0.0.1:8787, click + Create bundle, pick a style, choose your product, adjust the texts
  and Save. Then choose the product page under Shown on."*, or
- if they ask you to do it, use the API (every write needs the header `X-editor: 1`):
  - `GET http://127.0.0.1:8787/api/bundles`: `productList` (the store's products), `templates` (starting styles, an
    object keyed by style id; each has `name` and `bundle`).
  - Start from `templates[STYLE].bundle`, set `title` (the name shown in the editor) and the product's `handle`, and
    `POST /api/bundles/BUNDLE_ID` with that object (id: lowercase letters, digits and dashes). Unknown fields are
    dropped silently; every accepted field is in `_clean_bundle` in `editor/bundles.py`.
  - `POST /api/bundles/assign` with `{"handle": "PRODUCT_HANDLE", "bundle": "BUNDLE_ID"}`.

The starting styles carry example texts and offers: a delivery promise ("Ships today, delivered in 3 to 6 days"),
"Free shipping", countdowns, gifts, up to "Buy 3 + Get 3 FREE". Go through them with the user and keep only what is
true for their store and what they can afford; `gift-cards` and `rows-free-items` hold sample gifts or pictures that
must be replaced or removed before they save.

Saving and assigning write the store's settings at once. Until the theme draws the block (step 8), visitors see
nothing of it.

## 8. Add the block to a copy of the theme

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
2. Find where the main product section draws the variant picker, the quantity and the buy buttons. Two common layouts
   (tested on Dawn and Horizon):
   - **Section with `case block.type`** (Dawn and themes built on it): `templates/product.json` names the main section;
     in `sections/<that type>.liquid` they are the `{%- when 'variant_picker' -%}`, `{%- when 'quantity_selector' -%}`
     and `{%- when 'buy_buttons' -%}` branches (a branch ends where the next `{%- when` starts).
   - **Theme blocks** (Horizon and newer themes, with a `blocks/` folder): `blocks/buy-buttons.liquid` (it holds the
     quantity and Add to cart) and `blocks/variant-picker.liquid`. There the product is `closest.product`.
   - Other themes, including customised ones: search the main product section and what it renders for the variant
     picker, the quantity input and the Add to cart form. If you cannot tell which code draws them, stop and tell the
     user instead of guessing.
   Leave other places that sell a product (quick add on collections, featured product sections) as they are: they keep
   selling one item at its normal price.
3. Before those parts (in each file that needs it; `product` is `closest.product` in theme blocks):

   ```liquid
   {%- liquid
     assign ob_key = 'gid://shopify/Product/' | append: product.id
     assign ob_active = shop.metafields.open_bundles.config.value.products[ob_key].active
   -%}
   ```

   `active` is true only on products that show an offer (a bundle or a running A/B test). If the app is removed or its
   settings deleted, it is empty and the theme's own buttons come back.
4. Edit:
   - buy buttons: render the block, then keep the theme's buttons for products without an offer:

     ```liquid
     {%- render 'ob-offer', product: product, section: section -%}
     {%- unless ob_active -%}
       ...the theme's buy buttons, unchanged...
     {%- endunless -%}
     ```

     The block draws nothing on products without an offer (on those it only holds bundle previews, hidden unless the
     page is opened with `?ob=`). In a theme block, wrap the whole markup before `{% schema %}`.
   - variant picker and quantity: wrap each in `{%- unless ob_active -%}...{%- endunless -%}`.
5. Push only the files you changed, to the copy (quote the pattern so the shell does not expand it):

   ```bash
   shopify theme push --store STORE --theme TARGET_ID --path .theme-work --nodelete --only 'snippets/ob-*' --only assets/ob-bundle.js --only CHANGED_FILE --no-input
   python scripts/connect.py --store STORE --preview-theme TARGET_ID
   ```

   One `--only` per changed theme file. The second command makes the editor's previews open the copy.
6. Check it yourself before sending anything to the user, in a browser you drive (Playwright works). Open every page
   with `?preview_theme_id=THEME_ID` in the URL; the storefront password, if any, comes from the user, and logging in
   many times in a row can trigger bot protection, so keep one browser session.
   - The product with the bundle (`TARGET_ID`): the block shows and the theme's variant picker, quantity and Add to cart
     do not; clicking each offer updates the button text and price (the first offer may show as a "Buy once" link
     under the others); Add to cart puts the offer's items in the cart (`/cart.js`: item count, `total_price` at the
     bundle price); no new JavaScript errors compared with the live theme. Empty the cart (`/cart/clear.js`) between
     tries.
   - Pages without an offer (home, a collection, two other products, the cart): the same text with
     `?preview_theme_id=LIVE_ID` and with `?preview_theme_id=TARGET_ID`.
   Fix and push again until all of it holds.

## 9. Preview, then go live

Send the user these links (all on the copy, visitors see nothing) and say what each should show:

- `https://STORE/products/HANDLE?preview_theme_id=TARGET_ID`: the product with the bundle. The bundle block shows in
  place of the usual buy buttons; choosing an offer and Add to cart puts the right items in the cart, at the bundle
  price.
- The same link for a product without a bundle, the home page and a collection: exactly as before.

Dev stores are password protected: the password is in the admin (Online Store > Preferences).

Fix whatever the user reports, push to the copy again, send the links again. Only when the user says yes (for example
"go live"), put the same change on the live theme:

```bash
mkdir .theme-live
shopify theme pull --store STORE --theme LIVE_ID --path .theme-live --only CHANGED_FILE --force --no-input
```

Make the same edit in the live files (they may have changed since the copy was made), copy the snippets and asset in,
and push with `--theme LIVE_ID --allow-live` and the same `--only` list. Then open the live product page and check it
once more. Prefer this to publishing the copy: publishing would also undo anything changed on the live theme in
between.

Afterwards bundles and A/B tests need no theme work: the editor saves them to the store directly. It asks before each
change visitors would see (a bundle put on a product page, a live bundle edited, a test started), with a store preview.

## Undo

- One product: in the editor, set its bundle's "Shown on" to "No product page". The page is back to normal at once.
- Every bundle: Shopify admin > Discounts, turn off "Open Bundles", and set every bundle to "No product page".
- The theme: remove the `ob-offer` render and the `ob_active` lines (or restore the files from the theme's version
  history). Products without an offer never showed anything, so nothing else changes.

## Without an AI

Same steps by hand. Instead of step 6 you can also click **Connect to store** in the editor and type the app's client
ID and secret (Dev Dashboard > Open Bundles > Settings).
