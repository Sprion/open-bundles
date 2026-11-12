// Settings block, order: texts, Product, Variants, Pricing, Saving pill, Bars, Button, Delivery, Cart.
import { esc, fullStyle, field, input, num, select, check, vfield, I, card } from "./shared.js";

const PICKERS = [["", "Design default"], ["swatches", "Colour photos + size menu"], ["inline", "Mini swatches + size menu, per item"],
  ["rows", "Drop-down rows"], ["tiles", "Item tiles + sheet"]];
const ONOFF = [["", "Design default"], ["on", "Show"], ["off", "Hide"]];
const on3 = (v) => (v === true ? "on" : v === false ? "off" : "");
const tri = (v) => (v === "on" ? true : v === "off" ? false : undefined);

const productOptions = (products, cur) => `<option value=""${cur ? "" : " selected"}>No product yet (sample preview)</option>` + products.map((p) => `<option value="${esc(p.handle)}"${p.handle === cur ? " selected" : ""}>${esc(p.title)}${p.unlisted ? " (unlisted)" : ""}</option>`).join("");
export { productOptions };

export const html = (id, b, products = [], current = "") => {
  const st = fullStyle(b), mult = b.compare_multiplier > 1;
  return card({ key: "settings", icon: I.gear, title: "Settings", open: !id, body: `
    <div class="be__grid2">
      ${field("Name (only for you)", input("title", b.title, "Spring sale"))}
      ${id ? `<input type="hidden" name="id" value="${esc(id)}">` : field("Id", input("id", "", "summer-trio", 'required pattern="[a-z0-9][a-z0-9-]{1,40}"'))}
      ${field("Block title", input("block_title", b.block_title, "Choose your offer"))}
      ${field("Size guide link", input("size_guide_text", b.size_guide_text, "Size guide"))}
      ${field("Size guide page (handle of a store page)", input("size_guide_page", b.size_guide_page, "size-guide"))}
      ${field("Banner", input("banner", b.banner, "Spring sale: free gift"))}
      ${field("Line above the product title", input("page_line", b.page_line, "Buy 2, get 1 FREE"))}
      ${field("Item word, one", input("unit_noun", b.unit_noun || "item"))}
      ${field("Item word, many", input("cta_noun", b.cta_noun || "items"))}
      ${field("Ticket banner title", input("banner_title", b.banner_title, "Weekly draw"))}
      ${field("Ticket word (banner, {{value}})", input("banner_unit", b.banner_unit, "Tickets"))}
    </div>
    <div class="be__checks">${check("hide_title", "Hide the block title and size guide link", b.hide_title)}</div>
    <div class="be__group"><h4>Product</h4>
      <label class="be__field"><span>Product</span><span class="be__select"><select name="product">${productOptions(products, current)}</select>${I.updown}</span></label>
      <p class="be__hint">Prices, variants and swatches below come from this product.</p>
    </div>
    <div class="be__group"><h4>Variants</h4>
      <div class="be__grid2">
        <label class="be__field"><span>Picker</span>${select("picker", PICKERS, b.picker || "")}</label>
        ${field("Hint above the rows", input("rows_hint", b.rows_hint, "Choose your size, then adjust each item"))}
        ${field("Free item word (rows)", input("rows_free_text", b.rows_free_text, "FREE"))}
      </div>
      <div class="be__grid2" data-tilesonly>
        ${field("Items title (tiles)", input("items_title", b.items_title, "Your bundle"))}
        ${field("Items hint (tiles)", input("items_hint", b.items_hint, "tap to customize"))}
      </div>
      <div class="be__checks">
        ${check("per_item", "Let customers choose the variant of each item", !b.one_variant)}
        ${check("size_first", "Pick one size first, for every item (size bar above the offers)", b.size_first)}
        ${check("rows_labels", "Rows show the item number, Color and Size labels, FREE under free items", b.rows_labels)}
        ${check("require_selection", "Require a variant selection (nothing preselected)", b.require_selection)}
        ${check("hide_unavailable", "Hide sold-out variant options", b.hide_unavailable)}
      </div>
      <div class="be__grid2">
        <button type="button" class="bar__act" data-swbtn>${I.swatch}<span>Add swatches</span></button>
        <button type="button" class="bar__act" data-dvbtn>${I.sliders}<span>Set default variants</span></button>
      </div>
      <input type="hidden" name="default_color" value="${esc(b.default_color || "")}"><input type="hidden" name="default_size" value="${esc(b.default_size || "")}">
      <input type="hidden" name="sw_type" value="${esc(b.swatches?.type || "")}"><input type="hidden" name="sw_colors" value="${esc(JSON.stringify(b.swatches?.colors || {}))}">
      <input type="hidden" name="st_swatch_shape" value="${esc(st.swatch_shape || "")}"><input type="hidden" name="st_swatch_size" value="${esc(st.swatch_size)}">
    </div>
    <div class="be__group"><h4>Pricing</h4>
      ${vfield("unit_text", "Price per item text", b.unit_text, "{{unit_price}} per item")}
      <div class="be__checks">
        ${check("show_unit", "Show price per item", b.show_unit !== false)}
        ${check("use_compare", "Use the product's compare-at price", !mult)}
      </div>
      <label class="be__field be__half" data-multwrap${mult ? "" : " hidden"}><span>Struck price = price ×</span>${num("compare_multiplier", mult ? b.compare_multiplier : 2, "×", 1.05, 5, 0.05)}</label>
      <div class="be__checks">
        ${check("hide_compare", "Hide the struck price", b.hide_compare)}
        ${check("total_in_button", "Show the total price in the add to cart button", b.total_in_button)}
      </div>
    </div>
    <div class="be__group"><h4>Saving pill</h4>
      <div class="be__grid2">
        <span data-savetext>${vfield("save_text", "Text", b.save_text, "You save {{saved_total}}")}</span>
        <label class="be__field"><span>Position</span>${select("save_position", [["below", "Below the title"], ["inline", "Next to the title"], ["price", "Under the price"]], b.save_position || "below")}</label>
      </div>
      <p class="be__hint" data-savehint>Rows and Cards layouts show the pill only when a text is set. Each bar can override it.</p>
      <div class="be__checks">${check("hide_save", "Hide the saving pill", b.hide_save)}</div>
    </div>
    <div class="be__group"><h4>Bars</h4>
      <div class="be__grid2">
        <label class="be__field"><span>Pictures</span>${select("bar_thumbs", [["", "Each bar's own image (Add image in the bar)"], ["photo", "One product photo per bar"], ["stack", "Product photos of the items, + free items"], ["number", "Number: #1, #2"], ["dot", "Small dot"], ["none", "No picture"]], b.bar_thumbs || "")}</label>
        <label class="be__field"><span>Label position</span>${select("tag_position", [["", "Next to the title"], ["top", "On the top border"]], b.tag_position || "")}</label>
        <label class="be__field"><span>"Apply to all" in the item sheet</span>${select("apply_all", [["", "Copies the size"], ["both", "Copies the size and the colour"]], b.apply_all || "")}</label>
      </div>
      <div class="be__checks">
        ${check("hl_always", "Show every bar's highlights, not only the selected one", b.highlights_mode === "always")}
      </div>
      <div class="be__grid2">
        ${field("Note under the bars", input("bars_note", b.bars_note, "Take your usual size."))}
      </div>
    </div>
    <div class="be__group"><h4>Add to cart button</h4>
      <div class="be__grid2">
        ${field("Text", input("cta_text", b.cta_text, "Add To Cart"))}
        ${field("Text before a size is chosen", input("cta_wait_text", b.cta_wait_text, "Select A Size"))}
      </div>
      <div class="be__grid2">
        ${field("Reassurance line 1 (under the button)", input("assure_1", b.assure_1, "30-day returns"))}
        ${field("Reassurance line 2", input("assure_2", b.assure_2, "Secure checkout"))}
      </div>
      <div class="be__checks">${check("cta_arrow", "Arrow at the end", b.cta_arrow)}${check("cta_no_mark", "Flat button without the icon", b.cta_no_mark)}</div>
    </div>
    <div class="be__group"><h4>Delivery line</h4>
      <div class="be__grid2">
        <label class="be__field"><span>Show</span>${select("ship_line", ONOFF, on3(b.ship_line))}</label>
        <label class="be__field"><span>Delivery days</span>${num("ship_days", b.ship_days || 5, "days", 1, 60, 1)}</label>
      </div>
      <div class="be__grid2">
        ${field("Text ({{date}} = delivery date)", input("ship_text", b.ship_text, "Order today for delivery by {{date}}"))}
        ${field("End of the line", input("ship_note", b.ship_note, "Free shipping."))}
        <label class="be__field"><span>Date language</span>${select("ship_locale", [["", "English"], ["fr", "French"], ["de", "German"], ["es", "Spanish"], ["it", "Italian"], ["nl", "Dutch"]], b.ship_locale || "")}</label>
        <label class="be__field"><span>Date length</span>${select("ship_date", [["", "Short (Mon, Nov 16)"], ["long", "Long (Monday 16 November)"]], b.ship_date || "")}</label>
      </div>
      <p class="be__hint">Words between ** are bold, for example **In stock**.</p>
    </div>
    <div class="be__group"><h4>Cart</h4>
      <div class="be__checks">${check("skip_cart", "Skip the cart and go straight to checkout", b.skip_cart)}</div>
    </div>` });
};

export function read(f) {
  const e = f.elements, v = (n) => e[n].value.trim();
  return {
    id: e.id.value.trim(), title: e.title.value, banner: e.banner.value, page_line: e.page_line.value.trim(), block_title: e.block_title.value.trim(),
    unit_noun: e.unit_noun.value, cta_noun: e.cta_noun.value, product: e.product.value,
    one_variant: !e.per_item.checked, hide_unavailable: e.hide_unavailable.checked,
    require_selection: e.require_selection.checked, default_color: e.default_color.value, default_size: e.default_size.value,
    swatches: e.sw_type.value === "color" ? { type: "color", colors: JSON.parse(e.sw_colors.value || "{}") } : undefined,
    show_unit: e.show_unit.checked, hide_compare: e.hide_compare.checked, total_in_button: e.total_in_button.checked, skip_cart: e.skip_cart.checked,
    save_text: e.save_text.value.trim(), hide_save: e.hide_save.checked, save_position: e.save_position.value,
    compare_multiplier: e.use_compare.checked ? 1 : Number(e.compare_multiplier.value) || 1,
    picker: e.picker.value, rows_hint: v("rows_hint"), size_first: e.size_first.checked, rows_labels: e.rows_labels.checked,
    items_title: v("items_title"), items_hint: v("items_hint"), unit_text: v("unit_text"),
    bar_thumbs: e.bar_thumbs.value, tag_position: e.tag_position.value, apply_all: e.apply_all.value,
    highlights_mode: e.hl_always.checked ? "always" : "",
    cta_text: v("cta_text"), cta_wait_text: v("cta_wait_text"), cta_arrow: e.cta_arrow.checked,
    ship_line: tri(e.ship_line.value), ship_text: v("ship_text"), ship_note: v("ship_note"), ship_locale: v("ship_locale"), ship_date: v("ship_date"),
    size_guide_text: v("size_guide_text"), size_guide_page: v("size_guide_page"), assure_1: v("assure_1"), assure_2: v("assure_2"), ship_days: Number(e.ship_days.value) || 5, banner_title: v("banner_title"), banner_unit: v("banner_unit"), hide_title: e.hide_title.checked, rows_free_text: v("rows_free_text"),
    bars_note: v("bars_note"),
    cta_no_mark: e.cta_no_mark.checked,
  };
}

export function wire(f) {
  f.addEventListener("change", (e) => {
    if (e.target.name === "use_compare") f.querySelector("[data-multwrap]").hidden = e.target.checked;
  });
}

export const sync = (f, design) => {
  const inp = f.elements.save_text; // Boxed shows a default text, the other layouts none
  inp.placeholder = design === "boxed" ? "You save {{saved_total}}" : "No pill";
  f.querySelector("[data-savehint]").hidden = design === "boxed";
  f.querySelector("[data-tilesonly]").hidden = f.elements.picker.value !== "tiles";
};
