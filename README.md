# Resource Usage Card for Home Assistant

A sleek, single-row Lovelace custom card designed for monitoring **CPU** or **RAM** utilization. Inspired by modern minimalist room comfort cards, it features dynamic color-coded status tracking, a 5-zone segmented progress bar with an animated position indicator dot, and multi-sensor comparison support.

---

## Features

* **Dual Modes:** Pre-configured optimization presets for both `cpu` and `ram` metrics.
* **Segmented Gradient Bar:** Visualizes utilization across 5 custom threshold zones (e.g., Idle/Low, Normal, Moderate, High, Critical).
* **Animated Position Dot:** Smoothly transitions along the scale bar based on current numeric value.
* **Full Visual Editor:** Built-in UI editor support with expandable threshold and color sections.
* **Comparison Mode:** Automatically highlights minimum or maximum system utilization when grouped with other resource sensors.

---

## Installation

### Manual Installation
1. Download the `resource-usage-card.js` file and place it in your Home Assistant `www/` directory (e.g., `/config/www/custom-cards/resource-usage-card.js`).
2. Add the resource reference in your Home Assistant dashboard (or via **Settings > Dashboards > Resources**):
   * **URL:** `/local/custom-cards/resource-usage-card.js`
   * **Resource type:** JavaScript Module

---

## Configuration

### Lovelace YAML Example

```yaml
type: custom:resource-usage-card
entity: sensor.processor_use
mode: cpu
name: System CPU
```

| Name | Type | Description |
| :--- | :--- | :--- |
| `type` | string | Must be `custom:resource-usage-card` |
| `entity` | string | Sensor entity ID representing utilization (e.g., percentage) |
| `mode` | string | `cpu` or `ram` (loads default icons, thresholds, and labels) |
| `name` | string | Custom display name (defaults to entity friendly name) |
| `icon` | string | Custom MDI icon |
| `compare_entities` | list | List of other sensors to compare against for min/max indicators |
| `thresholds` | object | Custom threshold levels (`low`, `comfort_low`, `comfort_high`, `high`) |
| `tap_action` | object | Lovelace action config when clicking the card (defaults to `more-info`) |
