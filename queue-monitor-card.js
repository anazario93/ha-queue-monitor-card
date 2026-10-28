/* Asterisk Queue Monitor Lovelace card.
 * No runtime dependencies; designed for Home Assistant's custom-card loader.
 */
const DEFAULTS = {
  type: "custom:queue-monitor-card",
  title: "Queue Wallboard",
  waiting_calls_entity: "sensor.asterisk_queue_monitor_waiting_calls",
  available_agents_entity: "sensor.asterisk_queue_monitor_available_agents",
  waiting_callers_entity: "sensor.asterisk_queue_monitor_waiting_callers",
  abandoned_calls_entity: "sensor.asterisk_queue_monitor_abandoned_calls",
  show_waiting_calls: true,
  show_available_agents: true,
  show_caller_id: true,
  show_caller_name: false,
  show_queue_name: true,
  show_position: true,
  show_wait_time: true,
  show_paused_agents: false,
  show_abandoned_calls: false,
  show_per_queue_summary: true,
  queues: [],
  empty_message: "No calls waiting",
  warning_wait_seconds: 120,
  critical_wait_seconds: 300,
  columns: 1
};

class QueueMonitorCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { ...DEFAULTS };
    this._hass = null;
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("A valid card configuration is required");
    this._config = { ...DEFAULTS, ...config };
    if (!Array.isArray(this._config.queues)) this._config.queues = [];
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  get hass() { return this._hass; }

  getCardSize() {
    const count = this._visibleCallers().length;
    return Math.max(3, Math.min(12, 2 + count));
  }

  static getConfigElement() {
    return document.createElement("queue-monitor-card-editor");
  }

  static getStubConfig() { return { ...DEFAULTS }; }

  _state(entityId) {
    return this._hass?.states?.[entityId] || null;
  }

  _number(entityId) {
    const value = Number(this._state(entityId)?.state);
    return Number.isFinite(value) ? value : 0;
  }

  _allCallers() {
    const fromList = this._state(this._config.waiting_callers_entity)?.attributes?.callers;
    const fromTotal = this._state(this._config.waiting_calls_entity)?.attributes?.callers;
    const callers = Array.isArray(fromList) ? fromList : (Array.isArray(fromTotal) ? fromTotal : []);
    return callers.map((caller, index) => ({
      queue: String(caller.queue ?? "Unknown"),
      position: Number(caller.position ?? index + 1),
      caller_id: String(caller.caller_id ?? caller.CallerIDNum ?? "Unknown"),
      caller_name: String(caller.caller_name ?? caller.CallerIDName ?? ""),
      wait_seconds: Number(caller.wait_seconds ?? caller.wait ?? caller.Wait ?? 0),
      channel: String(caller.channel ?? "")
    })).filter(caller => !this._config.queues.length || this._config.queues.includes(caller.queue));
  }

  _visibleCallers() { return this._allCallers(); }

  _escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  _duration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    const hours = Math.floor(minutes / 60);
    if (hours) return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const c = this._config;
    const callers = this._visibleCallers();
    const totalWaiting = c.queues.length
      ? callers.length
      : this._number(c.waiting_calls_entity);
    const availableAgents = this._number(c.available_agents_entity);
    const paused = Number(this._state(c.available_agents_entity)?.attributes?.paused_agents ?? 0);
    const abandoned = this._number(c.abandoned_calls_entity);
    const queueCounts = {};
    callers.forEach(caller => { queueCounts[caller.queue] = (queueCounts[caller.queue] || 0) + 1; });

    const metrics = [];
    if (c.show_waiting_calls) metrics.push(this._metric("Waiting Calls", totalWaiting, "phone-incoming", totalWaiting > 0 ? "warning" : "normal"));
    if (c.show_available_agents) metrics.push(this._metric("Available Agents", availableAgents, "headset", availableAgents > 0 ? "good" : "warning"));
    if (c.show_paused_agents) metrics.push(this._metric("Paused Agents", paused, "pause-circle", "normal"));
    if (c.show_abandoned_calls) metrics.push(this._metric("Abandoned Calls", abandoned, "phone-missed", "normal"));

    const rows = callers.map(caller => {
      const level = caller.wait_seconds >= Number(c.critical_wait_seconds) ? "critical"
        : caller.wait_seconds >= Number(c.warning_wait_seconds) ? "warning" : "normal";
      const details = [];
      if (c.show_queue_name) details.push(`<span class="detail">Queue: ${this._escape(caller.queue)}</span>`);
      if (c.show_position) details.push(`<span class="detail">Position: ${this._escape(caller.position)}</span>`);
      if (c.show_caller_name && caller.caller_name) details.push(`<span class="detail">${this._escape(caller.caller_name)}</span>`);
      return `
        <div class="caller ${level}">
          <div class="phone-icon" aria-hidden="true">☎</div>
          <div class="caller-main">
            <div class="caller-id">${c.show_caller_id ? this._escape(caller.caller_id) : "Waiting caller"}</div>
            <div class="details">${details.join("")}</div>
          </div>
          ${c.show_wait_time ? `<div class="wait">${this._duration(caller.wait_seconds)}</div>` : ""}
        </div>`;
    }).join("");

    const queueSummary = c.show_per_queue_summary && Object.keys(queueCounts).length
      ? `<div class="queue-summary">${Object.entries(queueCounts).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) =>
          `<span class="queue-chip">${this._escape(name)} <b>${count}</b></span>`).join("")}</div>`
      : "";
    const waitingUnavailable = !this._state(c.waiting_calls_entity) || !this._state(c.available_agents_entity);
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; color:var(--primary-text-color); }
        ha-card { padding:16px; overflow:hidden; }
        .heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
        .title { font-size:1.2rem; font-weight:600; }
        .metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
        .metric { border-radius:12px; padding:14px; background:var(--secondary-background-color); min-width:0; }
        .metric-label { color:var(--secondary-text-color); font-size:.9rem; display:flex; align-items:center; gap:8px; }
        .metric-value { font-size:2rem; font-weight:700; line-height:1.3; margin-top:5px; }
        .good .metric-value { color:var(--success-color,var(--primary-text-color)); }
        .warning .metric-value { color:var(--warning-color,#d99a00); }
        .section-title { font-weight:600; margin:18px 0 8px; }
        .caller { display:flex; align-items:center; gap:12px; padding:12px 2px; border-bottom:1px solid var(--divider-color); }
        .caller:last-child { border-bottom:0; }
        .phone-icon { display:grid; place-items:center; width:38px; height:38px; flex:0 0 38px; border-radius:10px; background:var(--secondary-background-color); font-size:20px; }
        .caller-main { flex:1; min-width:0; }
        .caller-id { font-weight:600; overflow-wrap:anywhere; }
        .details { display:flex; flex-wrap:wrap; gap:4px 10px; margin-top:4px; color:var(--secondary-text-color); font-size:.8rem; }
        .wait { font-variant-numeric:tabular-nums; white-space:nowrap; color:var(--secondary-text-color); font-size:.9rem; }
        .caller.warning { border-left:3px solid var(--warning-color,#d99a00); padding-left:9px; }
        .caller.critical { border-left:3px solid var(--error-color,#db4437); padding-left:9px; }
        .queue-summary { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
        .queue-chip { border-radius:20px; padding:5px 9px; background:var(--secondary-background-color); font-size:.8rem; }
        .empty { color:var(--secondary-text-color); padding:18px 0 6px; text-align:center; }
        .subtle { color:var(--secondary-text-color); font-size:.8rem; }
        @media (max-width:420px) { ha-card { padding:12px; } .metric { padding:10px; } .metric-value { font-size:1.6rem; } }
      </style>
      <ha-card>
        <div class="heading">
          <div class="title">${this._escape(c.title || "Queue Wallboard")}</div>
          <div class="subtle">${callers.length} listed</div>
        </div>
        ${metrics.length ? `<div class="metrics">${metrics.join("")}</div>` : ""}
        ${queueSummary}
        <div class="section-title">Waiting Callers</div>
        ${rows || `<div class="empty">${this._escape(c.empty_message || "No calls waiting")}</div>`}
        ${waitingUnavailable ? '<div class="subtle" style="margin-top:10px">Waiting for queue sensor data…</div>' : ""}
      </ha-card>`;
  }

  _metric(label, value, icon, status) {
    return `<div class="metric ${status}"><div class="metric-label"><span aria-hidden="true">${({ "phone-incoming":"↙", headset:"◉", "pause-circle":"Ⅱ", "phone-missed":"↗" })[icon] || "•"}</span>${this._escape(label)}</div><div class="metric-value">${this._escape(value)}</div></div>`;
  }
}

class QueueMonitorCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { ...DEFAULTS };
  }

  setConfig(config) { this._config = { ...DEFAULTS, ...config }; this._render(); }
  set hass(hass) { this._hass = hass; }

  _render() {
    const c = this._config;
    const toggles = [
      ["show_waiting_calls", "Show waiting-call total"],
      ["show_available_agents", "Show available-agent total"],
      ["show_caller_id", "Show caller ID"],
      ["show_caller_name", "Show caller name"],
      ["show_queue_name", "Show queue name"],
      ["show_position", "Show queue position"],
      ["show_wait_time", "Show wait duration"],
      ["show_paused_agents", "Show paused-agent count"],
      ["show_abandoned_calls", "Show abandoned-call counter"],
      ["show_per_queue_summary", "Show per-queue summary"]
    ];
    this.shadowRoot.innerHTML = `
      <style>
        .field { display:block; margin:12px 0; } label { display:block; margin-bottom:5px; }
        input[type=text], input[type=number] { box-sizing:border-box; width:100%; padding:9px; color:var(--primary-text-color); background:var(--card-background-color); border:1px solid var(--divider-color); border-radius:6px; }
        .toggle { display:flex; gap:8px; align-items:center; margin:10px 0; }
        h3 { margin-bottom:6px; }
      </style>
      <div class="field"><label>Card title</label><input type="text" data-key="title" value="${this._esc(c.title)}"></div>
      <h3>Entities</h3>
      <div class="field"><label>Waiting calls entity</label><input type="text" data-key="waiting_calls_entity" value="${this._esc(c.waiting_calls_entity)}"></div>
      <div class="field"><label>Available agents entity</label><input type="text" data-key="available_agents_entity" value="${this._esc(c.available_agents_entity)}"></div>
      <div class="field"><label>Waiting callers entity</label><input type="text" data-key="waiting_callers_entity" value="${this._esc(c.waiting_callers_entity)}"></div>
      <div class="field"><label>Abandoned calls entity</label><input type="text" data-key="abandoned_calls_entity" value="${this._esc(c.abandoned_calls_entity)}"></div>
      <h3>Visibility</h3>
      ${toggles.map(([key, label]) => `<label class="toggle"><input type="checkbox" data-key="${key}" ${c[key] ? "checked" : ""}> ${label}</label>`).join("")}
      <h3>Wait-time alerts</h3>
      <div class="field"><label>Warning threshold (seconds)</label><input type="number" min="0" data-key="warning_wait_seconds" value="${Number(c.warning_wait_seconds)}"></div>
      <div class="field"><label>Critical threshold (seconds)</label><input type="number" min="0" data-key="critical_wait_seconds" value="${Number(c.critical_wait_seconds)}"></div>
      <div class="field"><label>Empty queue message</label><input type="text" data-key="empty_message" value="${this._esc(c.empty_message)}"></div>
      <div class="field"><label>Queues to display (comma-separated; blank means all)</label><input type="text" data-key="queues" value="${this._esc((c.queues || []).join(", "))}"></div>`;
    this.shadowRoot.querySelectorAll("[data-key]").forEach(input => {
      input.addEventListener("change", () => {
        const key = input.dataset.key;
        let value;
        if (input.type === "checkbox") value = input.checked;
        else if (input.type === "number") value = Number(input.value);
        else if (key === "queues") value = input.value.split(",").map(s => s.trim()).filter(Boolean);
        else value = input.value;
        this._config = { ...this._config, [key]: value };
        this.dispatchEvent(new CustomEvent("config-changed", {
          detail: { config: this._config }, bubbles: true, composed: true
        }));
      });
    });
  }

  _esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    })[char]);
  }
}

if (!customElements.get("queue-monitor-card")) {
  customElements.define("queue-monitor-card", QueueMonitorCard);
}
if (!customElements.get("queue-monitor-card-editor")) {
  customElements.define("queue-monitor-card-editor", QueueMonitorCardEditor);
}
window.customCards = window.customCards || [];
window.customCards.push({
  type: "queue-monitor-card",
  name: "Asterisk Queue Monitor Card",
  description: "Queue waiting-call and agent wallboard for Asterisk Queue Monitor."
});
