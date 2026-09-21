// ============================================================
// cms.js — Public site content loader
// Pulls live content from Supabase and renders it into the page.
// ============================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ⚠️ Replace with your real values
const SUPABASE_URL = "https://kgzwpdldgswyijggshzn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mmBI6THtxEKkyCDK06nTpw_undl695u";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// Helpers
// ============================================================
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clearSkeletons() {
  document.querySelectorAll("[data-loading]").forEach((el) => {
    el.removeAttribute("data-loading");
    el.classList.remove("cms-loading");
  });
}

// ============================================================
// 1. PORTFOLIO
// ============================================================
async function loadPortfolio() {
  const grid = document.querySelector(".portfolio-grid");
  if (!grid) return;

  const { data, error } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("is_published", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[cms] Portfolio load failed:", error);
    grid.innerHTML =
      '<p style="text-align:center;opacity:.6">Portfolio coming soon.</p>';
    return;
  }

  if (!data || data.length === 0) {
    grid.innerHTML =
      '<p style="text-align:center;opacity:.6">Portfolio coming soon.</p>';
    return;
  }

  grid.innerHTML = data
    .map(
      (item) => `
    <figure class="portfolio-item">
      <figcaption class="portfolio-title">${escapeHtml(item.title)}</figcaption>
      <a href="${escapeHtml(item.video_url)}" target="_blank" rel="noopener">
        <img src="${escapeHtml(item.thumbnail_url || "assets/placeholder.jpg")}"
             alt="${escapeHtml(item.title)}"
             loading="lazy">
      </a>
    </figure>
  `,
    )
    .join("");
}

// ============================================================
// 2. CONTACT
// ============================================================
async function loadContact() {
  const list = document.querySelector(".contact-list");
  if (!list) return;

  const { data, error } = await supabase
    .from("contact_info")
    .select("*")
    .eq("is_published", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[cms] Contact load failed:", error);
    return;
  }

  if (!data || data.length === 0) return;

  list.innerHTML = data
    .map((item) => {
      const iconClass = `contact-icon--${escapeHtml(item.platform)}`;
      const iconSrc = item.icon_url || `assets/${item.platform}.png`;
      const href = item.url || "#";

      return `
      <a class="contact-link" href="${escapeHtml(href)}" target="_blank" rel="noopener">
        <span class="contact-icon ${iconClass}">
          <img src="${escapeHtml(iconSrc)}" alt="${escapeHtml(item.label)}">
        </span>
        <span class="contact-value">${escapeHtml(item.value)}</span>
      </a>
    `;
    })
    .join("");

  // Also populate the footer contact list
  const footerList = document.querySelector(".site-footer__contact-list");
  if (footerList) {
    footerList.innerHTML = data
      .map(
        (item) => `
    <li>
      <a href="${escapeHtml(item.url || "#")}" target="_blank" rel="noopener">
        ${escapeHtml(item.label)}
      </a>
    </li>
  `,
      )
      .join("");
  }
}

// ============================================================
// 3. CONTENT CARDS ("What I create")
// ============================================================
async function loadContentCards() {
  const grid = document.querySelector(".content-grid");
  if (!grid) return;

  const { data, error } = await supabase
    .from("content_cards")
    .select("*")
    .eq("is_published", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[cms] Content cards load failed:", error);
    return;
  }

  if (!data || data.length === 0) return;

  grid.innerHTML = data
    .map(
      (card) => `
    <div class="content-card">
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.body)}</p>
    </div>
  `,
    )
    .join("");
}

// ============================================================
// 4. SETTINGS (plain text)
// ============================================================
async function loadSettings() {
  const { data, error } = await supabase.from("site_settings").select("*");

  if (error) {
    console.error("[cms] Settings load failed:", error);
    return;
  }

  const settings = Object.fromEntries(
    (data || []).map((s) => [s.key, s.value]),
  );

  const setText = (selector, value) => {
    if (!value) return;
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };

  setText(".eyebrow", settings.hero_eyebrow);
  setText(".hero-heading", settings.hero_heading);
  setText(".hero-text", settings.hero_text);
  setText(".section-text-about", settings.about_text);

  // Work section: keep the .brand-name span, replace only the trailing text
  const workText = document.querySelector(".work-section .section-text");
  if (workText && settings.work_intro) {
    workText.innerHTML = `<span class="brand-name">Nora_of_the_good_life</span> ${escapeHtml(settings.work_intro)}`;
  }
}

// ============================================================
// Boot
// ============================================================
async function init() {
  try {
    await Promise.all([
      loadPortfolio(),
      loadContact(),
      loadContentCards(),
      loadSettings(),
    ]);
  } catch (err) {
    console.error("[cms] Init failed:", err);
  } finally {
    clearSkeletons();
  }
}

init();

// ============================================================
// Active nav highlighting — debounced for smooth scroll
// ============================================================
function initActiveNav() {
  const navButtons = document.querySelectorAll('.nav-btn[href^="#"]');
  if (!navButtons.length) return;

  // Build a map of section id -> nav button
  const buttonFor = {};
  navButtons.forEach((btn) => {
    const id = btn.getAttribute("href").slice(1);
    if (id) buttonFor[id] = btn;
  });

  const sections = Object.keys(buttonFor)
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!sections.length) return;

  // Track the highest-visible section ratio
  const ratios = new Map();

  // Debounce state — only apply after the scroll settles
  let debounceTimer = null;
  let pendingId = null;

  const applyActive = () => {
    if (!pendingId) return;
    navButtons.forEach((btn) => btn.classList.remove("is-active"));
    const active = buttonFor[pendingId];
    if (active) active.classList.add("is-active");
    pendingId = null;
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        ratios.set(
          entry.target.id,
          entry.isIntersecting ? entry.intersectionRatio : 0,
        );
      }

      // Find the section with the highest ratio
      let bestId = null;
      let bestRatio = 0;
      for (const [id, ratio] of ratios) {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      }

      if (!bestId) return;
      if (bestId === pendingId) return;

      pendingId = bestId;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyActive, 150);
    },
    {
      // Fewer thresholds = fewer callback fires during scroll
      threshold: [0, 0.5, 1],
      // Shrink observation area from the top by navbar height
      // and reserve the bottom 30% so sections stay "active" longer
      rootMargin: "-84px 0px -30% 0px",
    },
  );

  sections.forEach((section) => observer.observe(section));

  // Set initial state based on URL hash (or fall back to first section)
  const hash = window.location.hash.slice(1);
  if (hash && buttonFor[hash]) {
    navButtons.forEach((btn) => btn.classList.remove("is-active"));
    buttonFor[hash].classList.add("is-active");
  } else {
    navButtons.forEach((btn) => btn.classList.remove("is-active"));
    if (buttonFor[sections[0].id]) {
      buttonFor[sections[0].id].classList.add("is-active");
    }
  }
}

initActiveNav();
