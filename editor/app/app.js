// Editor page: the bundles list (bundle-list/) with its editor (bundle-editor/) and A/B test rows (test-rows/).
import * as bundleList from "./bundle-list/bundle-list.js";
import { wireMenus } from "./menu-place.js";
import * as connect from "./connect.js";

const root = document.querySelector("[data-root]");
root.innerHTML = bundleList.html();
wireMenus();
bundleList.mount(root);
document.querySelector("[data-new]").addEventListener("click", () => dispatchEvent(new CustomEvent("ob:newbundle")));
connect.mount(document.querySelector("[data-connect]"), document.querySelector("[data-mode]"));
