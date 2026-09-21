import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ⚠️ REPLACE THESE WITH YOUR REAL VALUES
const SUPABASE_URL = "https://kgzwpdldgswyijggshzn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mmBI6THtxEKkyCDK06nTpw_undl695u";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== DOM refs =====================
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout");

// ===================== AUTO LOGOUT (15 min idle) =====================
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
const WARNING_BEFORE_MS = 60 * 1000;    // show warning 60s before logout
const LAST_ACTIVITY_KEY = "admin_last_activity";

let idleTimer = null;
let warningTimer = null;
let countdownTick = null;
let warningEl = null;

function buildWarningEl() {
  if (warningEl) return warningEl;

  warningEl = document.createElement("div");
  warningEl.className = "idle-warning hidden";
  warningEl.innerHTML = `
    <p>You'll be logged out in <strong id="idle-countdown">60</strong> seconds due to inactivity.</p>
    <button id="idle-stay">Stay signed in</button>
  `;
  document.body.appendChild(warningEl);

  document.getElementById("idle-stay").addEventListener("click", () => {
    warningEl.classList.add("hidden");
    clearInterval(countdownTick);
    resetIdleTimer();
  });

  return warningEl;
}

function showWarning() {
  const el = buildWarningEl();
  el.classList.remove("hidden");

  let secondsLeft = Math.floor(WARNING_BEFORE_MS / 1000);
  const countEl = document.getElementById("idle-countdown");
  if (countEl) countEl.textContent = secondsLeft;

  clearInterval(countdownTick);
  countdownTick = setInterval(() => {
    secondsLeft -= 1;
    if (countEl) countEl.textContent = Math.max(0, secondsLeft);
    if (secondsLeft <= 0) clearInterval(countdownTick);
  }, 1000);
}

async function logoutDueToIdle() {
  console.warn("[admin] Logging out due to inactivity");
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  if (warningEl) warningEl.classList.add("hidden");
  clearInterval(countdownTick);
  await supabase.auth.signOut();
  window.location.reload();
}

function resetIdleTimer() {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

  clearTimeout(idleTimer);
  clearTimeout(warningTimer);

  warningTimer = setTimeout(showWarning, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
  idleTimer = setTimeout(logoutDueToIdle, IDLE_TIMEOUT_MS);
}

function startIdleWatcher() {
  const last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || "0", 10);
  const elapsed = Date.now() - last;

  if (last && elapsed >= IDLE_TIMEOUT_MS) {
    logoutDueToIdle();
    return;
  }

  const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
  events.forEach((ev) =>
    document.addEventListener(ev, resetIdleTimer, { passive: true })
  );

  if (last) {
    const remaining = IDLE_TIMEOUT_MS - elapsed;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(logoutDueToIdle, remaining);

    clearTimeout(warningTimer);
    warningTimer = setTimeout(
      showWarning,
      Math.max(0, remaining - WARNING_BEFORE_MS)
    );
  } else {
    resetIdleTimer();
  }
}

function stopIdleWatcher() {
  const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
  events.forEach((ev) => document.removeEventListener(ev, resetIdleTimer));

  clearTimeout(idleTimer);
  clearTimeout(warningTimer);
  clearInterval(countdownTick);
  if (warningEl) warningEl.classList.add("hidden");
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

// ===================== AUTH =====================
async function checkAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    loadAll();
    startIdleWatcher();
  } else {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
    stopIdleWatcher();
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "Logging in...";
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    loginError.textContent = error.message;
  } else {
    loginError.textContent = "";
    checkAuth();
  }
});

logoutBtn.addEventListener("click", async () => {
  stopIdleWatcher();
  await supabase.auth.signOut();
  checkAuth();
});

// ===================== TABS =====================
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.add("hidden"));
    tab.classList.add("active");
    document
      .getElementById(`tab-${tab.dataset.tab}`)
      .classList.remove("hidden");
  });
});

// ===================== PORTFOLIO =====================
const addPortfolioForm = document.getElementById("add-portfolio");
const portfolioStatus = document.getElementById("add-portfolio-status");

document.getElementById("open-add-portfolio").addEventListener("click", () => {
  addPortfolioForm.classList.remove("hidden");
});
document
  .getElementById("cancel-add-portfolio")
  .addEventListener("click", () => {
    addPortfolioForm.classList.add("hidden");
    addPortfolioForm.reset();
    portfolioStatus.textContent = "";
  });

async function loadPortfolio() {
  const { data, error } = await supabase
    .from("portfolio_items")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const list = document.getElementById("portfolio-list");
  list.innerHTML = "";

  if (!data || data.length === 0) {
    list.innerHTML =
      '<p class="status">No portfolio items yet. Click "+ Add Item" to get started.</p>';
    return;
  }

  data.forEach((item) => {
    const card = document.createElement("div");
    card.className = "item-card";

    const thumb = item.thumbnail_url
      ? `<img src="${item.thumbnail_url}" alt="">`
      : `<div class="no-thumb">No<br>thumb</div>`;

    card.innerHTML = `
      ${thumb}
      <div class="item-info">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.platform)} · order ${item.display_order}</small>
        <a href="${item.video_url}" target="_blank" rel="noopener">Open video ↗</a>
      </div>
      <div class="item-actions">
        <button data-action="upload-thumb" data-id="${item.id}">📷 Thumb</button>
        <button data-action="refresh-thumb" data-id="${item.id}" data-url="${item.video_url}">↻ Auto</button>
        <button data-action="delete" data-id="${item.id}" class="danger">✕</button>
      </div>
    `;
    list.appendChild(card);
  });
}

addPortfolioForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById("add-portfolio-submit");
  submitBtn.disabled = true;

  const title = form.title.value.trim();
  const videoUrl = form.url.value.trim();
  const platform = form.platform.value;
  const fileInput = form.thumbnail;

  portfolioStatus.className = "status";
  portfolioStatus.textContent = "Adding item...";

  try {
    const { data: inserted, error: insertError } = await supabase
      .from("portfolio_items")
      .insert({
        title,
        video_url: videoUrl,
        platform,
        display_order: 999,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    let thumbnailUrl = null;

    if (fileInput.files && fileInput.files[0]) {
      portfolioStatus.textContent = "Uploading thumbnail...";
      thumbnailUrl = await uploadThumbnailFile(inserted.id, fileInput.files[0]);
    } else {
      portfolioStatus.textContent = "Trying to fetch thumbnail...";
      thumbnailUrl = await tryAutoThumbnail(inserted.id, videoUrl);
    }

    if (thumbnailUrl) {
      await supabase
        .from("portfolio_items")
        .update({ thumbnail_url: thumbnailUrl })
        .eq("id", inserted.id);

      portfolioStatus.className = "status success";
      portfolioStatus.textContent = "✓ Item added with thumbnail.";
    } else {
      portfolioStatus.className = "status";
      portfolioStatus.textContent =
        "✓ Item added. No thumbnail — use the 📷 Thumb button to upload one.";
    }

    form.reset();
    addPortfolioForm.classList.add("hidden");
    loadPortfolio();
  } catch (err) {
    console.error(err);
    portfolioStatus.className = "status error";
    portfolioStatus.textContent = "Error: " + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

document
  .getElementById("portfolio-list")
  .addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "delete") {
      if (!confirm("Delete this item? This cannot be undone.")) return;
      await supabase.from("portfolio_items").delete().eq("id", id);
      loadPortfolio();
    }

    if (action === "refresh-thumb") {
      const url = btn.dataset.url;
      btn.textContent = "...";
      btn.disabled = true;

      const thumbUrl = await tryAutoThumbnail(id, url);

      if (thumbUrl) {
        await supabase
          .from("portfolio_items")
          .update({ thumbnail_url: thumbUrl })
          .eq("id", id);
        loadPortfolio();
      } else {
        alert(
          "Auto-fetch failed. Use the 📷 Thumb button to upload an image manually.",
        );
        btn.textContent = "↻ Auto";
        btn.disabled = false;
      }
    }

    if (action === "upload-thumb") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.onchange = async () => {
        if (!input.files || !input.files[0]) return;
        btn.textContent = "...";
        btn.disabled = true;

        try {
          const publicUrl = await uploadThumbnailFile(id, input.files[0]);
          await supabase
            .from("portfolio_items")
            .update({ thumbnail_url: publicUrl })
            .eq("id", id);
          loadPortfolio();
        } catch (err) {
          alert("Upload failed: " + err.message);
          btn.textContent = "📷 Thumb";
          btn.disabled = false;
        }
      };

      input.click();
    }
  });

// ===================== HELPERS =====================
async function tryAutoThumbnail(itemId, videoUrl) {
  try {
    const res = await fetch(
      `/api/thumbnail?url=${encodeURIComponent(videoUrl)}`,
    );
    const result = await res.json();

    if (!result.success || !result.thumbnail) {
      return null;
    }

    const imgRes = await fetch(result.thumbnail);
    const blob = await imgRes.blob();
    return await uploadThumbnailBlob(itemId, blob);
  } catch (err) {
    console.warn("Auto thumbnail failed:", err);
    return null;
  }
}

async function uploadThumbnailFile(itemId, file) {
  return await uploadThumbnailBlob(itemId, file);
}

async function uploadThumbnailBlob(itemId, blob) {
  const fileName = `${itemId}.jpg`;

  const { error: upErr } = await supabase.storage
    .from("thumbnails")
    .upload(fileName, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from("thumbnails").getPublicUrl(fileName);

  return `${data.publicUrl}?t=${Date.now()}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ===================== CONTACT =====================
const addContactForm = document.getElementById("add-contact");

document.getElementById("open-add-contact").addEventListener("click", () => {
  addContactForm.classList.remove("hidden");
});
document.getElementById("cancel-add-contact").addEventListener("click", () => {
  addContactForm.classList.add("hidden");
  addContactForm.reset();
});

async function loadContact() {
  const { data } = await supabase
    .from("contact_info")
    .select("*")
    .order("display_order");

  const list = document.getElementById("contact-list");
  list.innerHTML = "";

  (data || []).forEach((item) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-info">
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(item.value)}</small>
        ${item.url ? `<a href="${item.url}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a>` : ""}
      </div>
      <div class="item-actions">
        <button data-action="delete-contact" data-id="${item.id}" class="danger">✕</button>
      </div>
    `;
    list.appendChild(card);
  });
}

addContactForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  await supabase.from("contact_info").insert({
    platform: f.platform.value,
    label: f.label.value,
    value: f.value.value,
    url: f.url.value || null,
    display_order: 999,
  });
  f.reset();
  addContactForm.classList.add("hidden");
  loadContact();
});

document.getElementById("contact-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (btn && btn.dataset.action === "delete-contact") {
    if (!confirm("Delete this contact?")) return;
    await supabase.from("contact_info").delete().eq("id", btn.dataset.id);
    loadContact();
  }
});

// ===================== CONTENT CARDS =====================
const addContentForm = document.getElementById("add-content");

document.getElementById("open-add-content").addEventListener("click", () => {
  addContentForm.classList.remove("hidden");
});
document.getElementById("cancel-add-content").addEventListener("click", () => {
  addContentForm.classList.add("hidden");
  addContentForm.reset();
});

async function loadContent() {
  const { data } = await supabase
    .from("content_cards")
    .select("*")
    .order("display_order");

  const list = document.getElementById("content-list");
  list.innerHTML = "";

  (data || []).forEach((item) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="item-info">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.body.slice(0, 100))}${item.body.length > 100 ? "…" : ""}</small>
      </div>
      <div class="item-actions">
        <button data-action="edit-content" data-id="${item.id}">✎ Edit</button>
        <button data-action="delete-content" data-id="${item.id}" class="danger">✕</button>
      </div>
    `;
    list.appendChild(card);
  });
}

document.getElementById("content-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === "delete-content") {
    if (!confirm("Delete this card?")) return;
    await supabase.from("content_cards").delete().eq("id", id);
    loadContent();
    return;
  }

  if (action === "edit-content") {
    const { data: row, error } = await supabase
      .from("content_cards")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !row) {
      alert("Could not load card: " + (error?.message || "Not found"));
      return;
    }

    const card = btn.closest(".item-card");
    card.innerHTML = `
      <form class="inline-edit-form" data-id="${id}">
        <label>
          Title
          <input name="title" value="${escapeAttr(row.title)}" required>
        </label>
        <label>
          Body
          <textarea name="body" rows="3" required>${escapeHtml(row.body)}</textarea>
        </label>
        <div class="form-actions">
          <button type="button" class="btn-ghost" data-action="cancel-edit">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    `;

    const form = card.querySelector("form");

    form
      .querySelector('[data-action="cancel-edit"]')
      .addEventListener("click", () => {
        loadContent();
      });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const { error: updateError } = await supabase
        .from("content_cards")
        .update({
          title: fd.get("title").trim(),
          body: fd.get("body").trim(),
        })
        .eq("id", id);

      if (updateError) {
        alert("Save failed: " + updateError.message);
        return;
      }
      loadContent();
    });
  }
});

addContentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  await supabase.from("content_cards").insert({
    title: f.title.value,
    body: f.body.value,
    display_order: 999,
  });
  f.reset();
  addContentForm.classList.add("hidden");
  loadContent();
});

// ===================== SETTINGS =====================
async function loadSettings() {
  const { data } = await supabase
    .from("site_settings")
    .select("*")
    .order("key");

  const container = document.getElementById("settings-list");
  container.innerHTML = "";

  (data || []).forEach((s) => {
    const row = document.createElement("div");
    row.className = "setting-row";
    row.dataset.key = s.key;
    row.dataset.originalValue = s.value || "";

    const label = s.key.replace(/_/g, " ");

    row.innerHTML = `
      <label>${escapeHtml(label)}</label>
      <div class="setting-display">${escapeHtml(s.value || "")}</div>
      <div class="setting-actions">
        <button class="btn-ghost" data-action="edit-setting" data-key="${s.key}">✎ Edit</button>
      </div>
    `;

    container.appendChild(row);
  });
}

document
  .getElementById("settings-list")
  .addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const key = btn.dataset.key;
    const row = btn.closest(".setting-row");

    if (action === "edit-setting") {
      const originalValue = row.dataset.originalValue || "";
      row.innerHTML = `
      <label>${escapeHtml(key.replace(/_/g, " "))}</label>
      <textarea data-key="${key}">${escapeHtml(originalValue)}</textarea>
      <div class="setting-actions">
        <button class="btn-ghost" data-action="cancel-setting" data-key="${key}">Cancel</button>
        <button class="btn-primary" data-action="save-setting" data-key="${key}">Save</button>
      </div>
    `;
      row.classList.add("is-editing");
      return;
    }

    if (action === "cancel-setting") {
      const originalValue = row.dataset.originalValue || "";
      const label = key.replace(/_/g, " ");
      row.innerHTML = `
      <label>${escapeHtml(label)}</label>
      <div class="setting-display">${escapeHtml(originalValue)}</div>
      <div class="setting-actions">
        <button class="btn-ghost" data-action="edit-setting" data-key="${key}">✎ Edit</button>
      </div>
    `;
      row.classList.remove("is-editing");
      return;
    }

    if (action === "save-setting") {
      const textarea = row.querySelector(`textarea[data-key="${key}"]`);
      const value = textarea.value;

      btn.textContent = "Saving...";
      btn.disabled = true;

      const { error } = await supabase
        .from("site_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() });

      if (error) {
        btn.textContent = "Error";
        btn.disabled = false;
        alert(error.message);
        return;
      }

      row.dataset.originalValue = value;
      const label = key.replace(/_/g, " ");
      row.innerHTML = `
      <label>${escapeHtml(label)}</label>
      <div class="setting-display">${escapeHtml(value)}</div>
      <div class="setting-actions">
        <button class="btn-ghost" data-action="edit-setting" data-key="${key}">✎ Edit</button>
      </div>
    `;
      row.classList.remove("is-editing");
    }
  });

// ===================== LOAD ALL =====================
function loadAll() {
  loadPortfolio();
  loadContact();
  loadContent();
  loadSettings();
}

// ===================== BOOT =====================
checkAuth();
