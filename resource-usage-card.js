/*!
 * Resource Usage Card
 * A single-row Lovelace card for CPU or RAM utilization based on the Room Comfort Card design.
 */

const CARD_TAG = "resource-usage-card";
const EDITOR_TAG = "resource-usage-card-editor";
const CARD_NAME = "Resource Usage Card";
const CARD_VERSION = "0.1.1-beta";

// Fallback/Default colors used when no explicit color or zone is provided.
const COLOR_MAP = {
  gray: "#8E8E93",
  cyan: "#64D2FF",
  blue: "#0A84FF",
  green: "#30D158",
  lime: "#A2E04B",
  yellow: "#FFD60A",
  orange: "#FF9F0A",
  red: "#FF453A",
  purple: "#BF5AF2",
};

// Defaults for CPU and RAM presets. Thresholds can be overridden per card.
const PRESETS = {
  cpu: {
    icon: "mdi:cpu",
    unit: "%",
    decimals: 1,
    scale_min: 0,
    scale_max: 100,
    minIcon: "mdi:gauge-empty",
    maxIcon: "mdi:gauge-full",
    labels: ["Idle", "Normal", "Moderate", "High", "Critical"],
    zones: ["green", "lime", "yellow", "orange", "red"],
    thresholds: {
      low: 15,
      comfort_low: 40,
      comfort_high: 75,
      high: 90,
    },
  },
  ram: {
    icon: "mdi:memory",
    unit: "%",
    decimals: 1,
    scale_min: 0,
    scale_max: 100,
    minIcon: "mdi:chip",
    maxIcon: "mdi:alert",
    labels: ["Low", "Normal", "Moderate", "High", "Critical"],
    zones: ["green", "lime", "yellow", "orange", "red"],
    thresholds: {
      low: 30,
      comfort_low: 60,
      comfort_high: 85,
      high: 95,
    },
  },
};

const UNAVAILABLE = ["unknown", "unavailable", "", undefined, null];
const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (n, a, b) => Math.min(Math.max(n, a), b);

class ResourceUsageCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .card {
          position: relative;
          box-sizing: border-box;
          height: 56px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .pill {
          position: relative;
          box-sizing: border-box;
          height: 100%;
          display: flex;
          align-items: center;
          border-radius: 32px;
          background: color-mix(in srgb, var(--ruc-color) 10%, transparent);
          box-shadow: inset 0 0 10px color-mix(in srgb, var(--ruc-color) 45%, transparent);
        }
        .card:focus-visible { outline: none; }
        .card:focus-visible .pill { outline: 2px solid var(--ruc-color); outline-offset: 2px; }
        .icon {
          flex: none;
          width: 42px;
          height: 42px;
          margin: 8px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ruc-color);
          background: color-mix(in srgb, var(--ruc-color) 20%, transparent);
          --mdc-icon-size: 24px;
        }
        .text {
          flex: 1;
          min-width: 0;
          align-self: flex-start;
          margin-top: 8px;
          line-height: 1.2;
          margin-left: 2px;
        }
        .name {
          font-size: 14px;
          font-weight: 600;
          color: var(--primary-text-color);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .status {
          font-size: 12px;
          color: var(--primary-text-color);
          opacity: 0.7;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .end {
          flex: none;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 16px 0 8px;
        }
        .extreme {
          display: flex;
          color: var(--ruc-color);
          --mdc-icon-size: 20px;
          margin-bottom: 0px;
        }
        .value {
          font-size: 1rem;
          font-weight: 600;
          white-space: nowrap;
          color: var(--ruc-color);
          font-variant-numeric: tabular-nums;
        }
        .bar {
          position: absolute;
          left: 60px;
          right: 30px;
          bottom: 6px;
          height: 4px;
          border-radius: 2px;
          background: var(--ruc-bar, rgba(255, 255, 255, 0.12));
        }
        .dot {
          position: absolute;
          top: 50%;
          width: 10px;
          height: 10px;
          box-sizing: border-box;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          background: var(--ruc-color);
          border: 1px solid rgba(255, 255, 255, 0.8);
          box-shadow: 0 0 8px var(--ruc-color);
        }
        @media (prefers-reduced-motion: no-preference) {
          .dot { transition: left 0.6s ease; }
        }
      </style>
      <div class="card" tabindex="0" role="button">
        <div class="pill">
          <div class="icon"></div>
          <div class="text"></div>
          <div class="end"></div>
          <div class="bar"></div>
        </div>
      </div>`;
    const $ = (s) => this.shadowRoot.querySelector(s);
    this._card = $(".card");
    this._icon = $(".icon");
    this._text = $(".text");
    this._end = $(".end");
    this._bar = $(".bar");
    this._card.addEventListener("click", () => this._onTap());
    this._card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this._onTap();
      }
    });
  }

  // ---------- Lovelace API ----------
  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass, entities, entityIds) {
    const chosenEntity = entityIds && entityIds.length > 0 ? entityIds[0] : "";
    const isRam = chosenEntity.includes("memory") || chosenEntity.includes("ram");
    return {
      type: "custom:resource-usage-card",
      entity: chosenEntity,
      mode: isRam ? "ram" : "cpu",
      name: isRam ? "RAM Usage" : "CPU Usage"
    };
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("Set `entity` to a CPU or RAM sensor.");
    const mode = config.mode || "cpu";
    if (!PRESETS[mode]) throw new Error("`mode` must be `cpu` or `ram`.");
    this._config = { tap_action: { action: "more-info" }, ...config, mode };
    this._key = null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 12, rows: 1, min_columns: 6, min_rows: 1 };
  }

  // ---------- Resolvers ----------
  _color(spec) {
    if (!spec) return null;
    if (COLOR_MAP[spec]) {
      return COLOR_MAP[spec];
    }
    if (ENTITY_ID.test(spec) && this._hass?.states[spec]) {
      const s = this._hass.states[spec].state;
      return UNAVAILABLE.includes(s) ? null : s;
    }
    return spec;
  }

  _num(spec) {
    if (spec === undefined || spec === null || spec === "") return null;
    if (typeof spec === "number") return spec;
    const n = Number(spec);
    if (!Number.isNaN(n)) return n;
    const st = this._hass?.states[spec];
    if (st) {
      const f = parseFloat(st.state);
      if (Number.isFinite(f)) return f;
    }
    return null;
  }

  _threshold(key) {
    const def = PRESETS[this._config.mode].thresholds[key];
    return this._num(this._config.thresholds?.[key]) ?? def;
  }

  _colorMap(preset) {
    const map = {};
    preset.labels.forEach((label, i) => (map[label] = this._color(preset.zones[i])));
    let gray = this._color("gray");

    const entId = this._config.color_map_entity;
    if (entId && this._hass?.states[entId]) {
      const ent = this._hass.states[entId];
      Object.assign(map, ent.attributes?.colors || {});
      if (ent.attributes?.default_gray) gray = this._color(ent.attributes.default_gray);
    }

    if (this._config.color_map) {
      for (const [k, v] of Object.entries(this._config.color_map)) {
        map[k] = this._color(v) || v;
      }
    }
    if (this._config.default_color) {
      gray = this._color(this._config.default_color) || gray;
    }
    return { map, gray };
  }

  _compareIds() {
    const list = this._config.compare_entities;
    if (!Array.isArray(list) || list.length === 0) return [];
    return list.includes(this._config.entity) ? list : [...list, this._config.entity];
  }

  // ---------- Model ----------
  _compute() {
    const cfg = this._config;
    const hass = this._hass;
    const preset = PRESETS[cfg.mode];
    const stateObj = hass?.states[cfg.entity];
    const labels = Array.isArray(cfg.labels) && cfg.labels.length === 5 ? cfg.labels : preset.labels;
    const zoneSpecs = Array.isArray(cfg.zone_colors) && cfg.zone_colors.length === 5 ? cfg.zone_colors : preset.zones;
    const zones = zoneSpecs.map((z) => this._color(z) || COLOR_MAP.gray);
    const { map, gray } = this._colorMap(preset);

    const raw = stateObj ? parseFloat(stateObj.state) : NaN;
    const valid = Number.isFinite(raw);

    const low = this._threshold("low");
    const cl = this._threshold("comfort_low");
    const ch = this._threshold("comfort_high");
    const high = this._threshold("high");
    
    const lo = this._num(cfg.scale_min) ?? preset.scale_min;
    const hi = this._num(cfg.scale_max) ?? preset.scale_max;
    
    const pos = (x) => clamp(((x - lo) / (hi - lo)) * 100, 0, 100);
    const stops = [0, pos(low), pos(cl), pos(ch), pos(high), 100];

    let idx = -1;
    if (valid) idx = raw < low ? 0 : raw < cl ? 1 : raw <= ch ? 2 : raw <= high ? 3 : 4;
    const status = idx >= 0 ? labels[idx] : "";
    const color = valid ? map[status] || zones[idx] || gray : gray;

    let isMin = false;
    let isMax = false;
    if (valid && hass) {
      const vals = this._compareIds()
        .map((id) => parseFloat(hass.states[id]?.state))
        .filter((n) => Number.isFinite(n));
      if (vals.length > 1) {
        const mn = Math.min(...vals);
        const mx = Math.max(...vals);
        if (mn !== mx) {
          isMin = raw === mn;
          isMax = raw === mx;
        }
      }
    }

    const unit = cfg.unit ?? stateObj?.attributes?.unit_of_measurement ?? preset.unit;
    const decimals = cfg.decimals ?? preset.decimals;

    const bar =
      "linear-gradient(to right," +
      zones
        .map((z, i) => {
          const c = `color-mix(in srgb, ${z} 40%, transparent)`;
          return `${c} ${stops[i].toFixed(2)}%, ${c} ${stops[i + 1].toFixed(2)}%`;
        })
        .join(",") +
      ")";

    return {
      name: cfg.name ?? stateObj?.attributes?.friendly_name ?? cfg.entity,
      icon: cfg.icon ?? stateObj?.attributes?.icon ?? preset.icon,
      status,
      value: valid ? `${raw.toFixed(decimals)} ${unit}` : "--",
      color,
      bar,
      dot: valid ? pos(raw) : null,
      extreme: isMin ? cfg.min_icon ?? preset.minIcon : isMax ? cfg.max_icon ?? preset.maxIcon : null,
    };
  }

  // ---------- Rendering ----------
  _render() {
    if (!this._config || !this._hass) return;
    const m = this._compute();
    const key = JSON.stringify(m);
    if (key === this._key) return;
    this._key = key;

    this._card.style.setProperty("--ruc-color", m.color);
    this._card.style.setProperty("--ruc-bar", m.bar);
    this._icon.innerHTML = `<ha-icon icon="${esc(m.icon)}"></ha-icon>`;
    this._text.innerHTML = `<div class="name">${esc(m.name)}</div><div class="status">${esc(m.status)}</div>`;
    this._end.innerHTML =
      (m.extreme ? `<div class="extreme"><ha-icon icon="${esc(m.extreme)}"></ha-icon></div>` : "") +
      `<div class="value">${esc(m.value)}</div>`;
    this._bar.innerHTML = m.dot === null ? "" : `<div class="dot" style="left:${m.dot.toFixed(2)}%"></div>`;
    this._card.setAttribute("aria-label", `${m.name}, ${m.value}, ${m.status}`);
  }

  // ---------- Actions ----------
  _fire(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  _onTap() {
    const a = this._config.tap_action || { action: "more-info" };
    const hass = this._hass;
    const entityId = a.entity || this._config.entity;
    switch (a.action) {
      case "navigate":
        if (!a.navigation_path) return;
        if (a.navigation_replace) history.replaceState(null, "", a.navigation_path);
        else history.pushState(null, "", a.navigation_path);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: !!a.navigation_replace } }));
        break;
      case "more-info":
        this._fire("hass-more-info", { entityId });
        break;
      case "toggle":
        hass.callService("homeassistant", "toggle", { entity_id: entityId });
        break;
      case "perform-action":
      case "call-service": {
        const svc = a.perform_action || a.service;
        if (!svc) return;
        const [domain, service] = svc.split(".");
        hass.callService(domain, service, a.data || a.service_data || {}, a.target);
        break;
      }
      case "url":
        if (a.url_path) window.open(a.url_path, "_blank");
        break;
      default:
        break;
    }
  }
}

// ---------- Visual editor ----------
const EDITOR_LABELS = {
  entity: "Sensor",
  mode: "Mode",
  name: "Name",
  icon: "Icon",
  compare_entities: "Sensors to compare for min / max badges",
  tap_action: "Tap action",
  thresholds: "Thresholds",
  low: "Low",
  comfort_low: "Normal / Comfort low",
  comfort_high: "Comfort high",
  high: "High",
  color_map: "Color map (YAML, label: color)",
  color_map_entity: "Color map sensor",
  decimals: "Decimals",
  scale_min: "Scale minimum",
  scale_max: "Scale maximum",
};

const getEditorSchema = (mode) => [
  { 
    name: "entity", 
    required: true, 
    selector: { 
      entity: { 
        domain: "sensor"
      } 
    } 
  },
  {
    name: "mode",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "cpu", label: "CPU" },
          { value: "ram", label: "RAM" },
        ],
      },
    },
  },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { 
    name: "compare_entities", 
    selector: { 
      entity: { 
        multiple: true, 
        domain: "sensor"
      } 
    } 
  },
  { name: "tap_action", selector: { ui_action: {} } },
  {
    type: "expandable",
    name: "thresholds",
    title: "Thresholds (number or entity ID; empty uses defaults)",
    schema: [
      { name: "low", selector: { text: {} } },
      { name: "comfort_low", selector: { text: {} } },
      { name: "comfort_high", selector: { text: {} } },
      { name: "high", selector: { text: {} } },
    ],
  },
  {
    type: "expandable",
    name: "advanced",
    title: "Colors and display",
    flatten: true,
    schema: [
      { name: "color_map", selector: { object: {} } },
      { name: "color_map_entity", selector: { entity: { domain: "sensor" } } },
      { name: "decimals", selector: { number: { min: 0, max: 3, mode: "box" } } },
      { name: "scale_min", selector: { number: { mode: "box" } } },
      { name: "scale_max", selector: { number: { mode: "box" } } },
    ],
  },
];

const prune = (obj) => {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const p = prune(v);
      const empty =
        p === undefined ||
        p === null ||
        p === "" ||
        (Array.isArray(p) && p.length === 0) ||
        (typeof p === "object" && !Array.isArray(p) && Object.keys(p).length === 0);
      if (!empty) out[k] = p;
    }
    return out;
  }
  return obj;
};

class ResourceUsageCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    this._update();
  }

  _update() {
    if (!this._config || !this._hass) return;
    const mode = this._config.mode || "cpu";
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => EDITOR_LABELS[s.name] || s.name;
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = prune({ ...this._config, ...ev.detail.value });
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = getEditorSchema(mode);
    this._form.data = { mode: "cpu", ...this._config };
  }
}

customElements.define(CARD_TAG, ResourceUsageCard);
customElements.define(EDITOR_TAG, ResourceUsageCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: CARD_NAME,
  description: "CPU or RAM utilization row with performance status, threshold bar and indicators.",
  preview: true,
});

console.info(`%c RESOURCE-USAGE-CARD %c v${CARD_VERSION} `, "color:white;background:#0A84FF;font-weight:700", "color:#0A84FF;background:white");
