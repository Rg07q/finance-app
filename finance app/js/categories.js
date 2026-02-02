// categories.js — Release 1.7 FULL
// Expense categories editor (presets) for Settings page
// Works with existing UI elements:
//   #newCatName, #addCatBtn, #catsBox
// Updates localStorage key: "expensePresets"
// Emits: window.dispatchEvent(new Event("expensePresetsChanged"))

(function () {
  const DEFAULT_PRESETS = {
    "Їжа": ["Продукти","Кафе/Ресторани","Доставка","Інше"],
    "Авто": ["Пальне","Ремонт","Страхування","Інше"],
    "Дім": ["Комуналка","Оренда","Ремонт","Інше"],
    "Здоровʼя": ["Аптека","Лікарі","Інше"],
    "Розваги": ["Кіно","Підписки","Інше"],
    "Одяг": ["Одяг","Взуття","Інше"],
    "Цілі": ["Внесок у ціль"],
    "Інше": ["Інше"]
  };

  const LOCKED_CATEGORIES = new Set(["Цілі"]); // не даємо видалити/перейменувати

  function safeParse(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function savePresets(presets) {
    localStorage.setItem("expensePresets", JSON.stringify(presets));
    window.dispatchEvent(new Event("expensePresetsChanged"));
  }

  function loadPresets() {
    const p = safeParse("expensePresets", null);
    if (!p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).length === 0) {
      savePresets(DEFAULT_PRESETS);
      return structuredClone(DEFAULT_PRESETS);
    }

    // patch required keys
    if (!p["Інше"]) p["Інше"] = ["Інше"];
    if (!p["Цілі"]) p["Цілі"] = ["Внесок у ціль"];

    // ensure each category is an array
    Object.keys(p).forEach(k => {
      if (!Array.isArray(p[k])) p[k] = ["Інше"];
      if (!p[k].length) p[k] = ["Інше"];
    });

    savePresets(p);
    return p;
  }

  function normName(s) {
    return String(s || "").trim().replace(/\s+/g, " ");
  }

  function esc(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createEl(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function render() {
    const box = document.getElementById("catsBox");
    if (!box) return;

    const presets = loadPresets();

    // sort: keep "Цілі" near end, "Інше" last
    const keys = Object.keys(presets).sort((a, b) => {
      const order = (x) => (x === "Інше" ? 999 : x === "Цілі" ? 900 : 0);
      if (order(a) !== order(b)) return order(a) - order(b);
      return a.localeCompare(b, "uk");
    });

    box.innerHTML = "";

    keys.forEach(cat => {
      const subs = Array.isArray(presets[cat]) ? presets[cat] : [];
      const locked = LOCKED_CATEGORIES.has(cat);

      const card = createEl(`
        <div class="cat-card" data-cat="${esc(cat)}">
          <div class="cat-head">
            <div class="cat-title">${esc(cat)}</div>
            <div class="cat-actions">
              <button class="tag-btn tag-add" data-act="add-sub" title="Додати підкатегорію">+ Підкатегорія</button>
              <button class="tag-btn tag-del" data-act="del-cat" title="Видалити категорію" ${locked ? "disabled" : ""}>🗑</button>
            </div>
          </div>

          <div class="subs">
            ${subs.map(s => `
              <div class="sub-pill" data-sub="${esc(s)}" title="Клік — видалити підкатегорію">
                ${esc(s)} <span class="x">×</span>
              </div>
            `).join("")}
          </div>

          <div class="grid-2" style="margin-top:10px;">
            <input class="sub-input" type="text" placeholder="Нова підкатегорія">
            <button class="btn-primary" data-act="save-sub" type="button">Додати</button>
          </div>

          <p class="hint" style="margin:8px 0 0;">
            ${locked ? "Категорія “Цілі” системна — її не можна видаляти." : "Підказка: додай “Інше” як підкатегорію, якщо треба."}
          </p>
        </div>
      `);

      // If locked, also disable deleting subs? (allow delete subs except keep at least 1)
      if (locked) {
        const delBtn = card.querySelector('[data-act="del-cat"]');
        if (delBtn) delBtn.style.opacity = "0.4";
      }

      box.appendChild(card);
    });

    // events (delegation)
    box.onclick = (e) => {
      const card = e.target.closest(".cat-card");
      if (!card) return;
      const cat = card.getAttribute("data-cat") || "";
      if (!cat) return;

      const presets = loadPresets();

      // delete category
      const delCat = e.target.closest('[data-act="del-cat"]');
      if (delCat) {
        if (LOCKED_CATEGORIES.has(cat)) return;
        if (!confirm(`Видалити категорію "${cat}"?`)) return;

        delete presets[cat];
        // ensure required keys
        if (!presets["Інше"]) presets["Інше"] = ["Інше"];
        if (!presets["Цілі"]) presets["Цілі"] = ["Внесок у ціль"];

        savePresets(presets);
        render();
        return;
      }

      // click sub-pill -> delete sub
      const subPill = e.target.closest(".sub-pill");
      if (subPill) {
        const sub = subPill.getAttribute("data-sub") || "";
        if (!sub) return;

        const list = Array.isArray(presets[cat]) ? presets[cat] : [];
        const next = list.filter(x => x !== sub);

        // keep at least one
        if (next.length === 0) next.push("Інше");

        presets[cat] = next;
        savePresets(presets);
        render();
        return;
      }

      // add subcategory (open focus input)
      const addSub = e.target.closest('[data-act="add-sub"]');
      if (addSub) {
        const inp = card.querySelector(".sub-input");
        inp?.focus?.();
        return;
      }

      // save subcategory
      const saveSub = e.target.closest('[data-act="save-sub"]');
      if (saveSub) {
        const inp = card.querySelector(".sub-input");
        const val = normName(inp?.value || "");
        if (!val) return;

        const list = Array.isArray(presets[cat]) ? presets[cat] : [];
        if (!list.includes(val)) list.push(val);

        presets[cat] = list;
        savePresets(presets);
        render();
        return;
      }
    };
  }

  function addCategory() {
    const inp = document.getElementById("newCatName");
    const name = normName(inp?.value || "");
    if (!name) return;

    const presets = loadPresets();

    if (presets[name]) {
      alert("Така категорія вже існує.");
      return;
    }

    presets[name] = ["Інше"];
    savePresets(presets);

    if (inp) inp.value = "";
    render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Ensure presets exist
    loadPresets();

    const addBtn = document.getElementById("addCatBtn");
    const inp = document.getElementById("newCatName");

    addBtn?.addEventListener("click", addCategory);
    inp?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addCategory();
    });

    render();
  });
})();
  