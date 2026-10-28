# Asterisk Queue Monitor Card

A configurable Lovelace card for the [Asterisk Queue Monitor integration](https://github.com/anazario93/ha-queue-mon-integration).

## Status

Initial development version. The card is intended to be used with the companion integration and should be tested against real queue events before operational use.

## Installation

### HACS (after adding this repository as a custom dashboard repository)

1. Add this repository to HACS as a **Dashboard** repository.
2. Install the card.
3. If HACS does not register the resource automatically, add the installed JavaScript file as a JavaScript module resource.
4. Add **Asterisk Queue Monitor Card** from the Lovelace card picker, or use YAML mode.

### Manual

Copy `queue-monitor-card.js` to `www/queue-monitor-card.js`, then add a dashboard resource at `/local/queue-monitor-card.js` with resource type **JavaScript module**.

## Example YAML

```yaml
type: custom:queue-monitor-card
title: Queue Wallboard

waiting_calls_entity: sensor.asterisk_queue_monitor_waiting_calls
available_agents_entity: sensor.asterisk_queue_monitor_available_agents
waiting_callers_entity: sensor.asterisk_queue_monitor_waiting_callers
abandoned_calls_entity: sensor.asterisk_queue_monitor_abandoned_calls

show_waiting_calls: true
show_available_agents: true
show_caller_id: true
show_caller_name: false
show_queue_name: true
show_position: true
show_wait_time: true
show_paused_agents: false
show_abandoned_calls: false
show_per_queue_summary: true

# Optional: blank or [] means show all queues.
queues:
  - sales
  - support

warning_wait_seconds: 120
critical_wait_seconds: 300
empty_message: No calls waiting
```

## Options

| Option | Default | Purpose |
|---|---:|---|
| `show_waiting_calls` | `true` | Show total waiting calls |
| `show_available_agents` | `true` | Show available-agent total |
| `show_caller_id` | `true` | Show caller ID for each waiting call |
| `show_caller_name` | `false` | Show caller name when supplied by Asterisk |
| `show_queue_name` | `true` | Show queue name |
| `show_position` | `true` | Show queue position |
| `show_wait_time` | `true` | Show wait duration |
| `show_paused_agents` | `false` | Show paused-agent count |
| `show_abandoned_calls` | `false` | Show abandoned-call counter |
| `show_per_queue_summary` | `true` | Show counts for queues represented in the visible caller list |
| `queues` | `[]` | Optional list of queue names to display |
| `warning_wait_seconds` | `120` | Wait duration at which a caller is highlighted |
| `critical_wait_seconds` | `300` | Wait duration at which a caller receives critical highlighting |

The card reads state and attributes from the integration's sensors. Visibility options only affect presentation; they do not disable integration monitoring. Queue filtering affects the caller list and displayed total when one or more queues are explicitly selected.

## Troubleshooting

- Confirm the integration sensors exist and have recent data.
- Confirm the selected entity IDs match your Home Assistant entities (entity IDs may be changed in Home Assistant).
- Caller details are supplied in the `callers` attribute of the waiting-callers or waiting-calls sensor.
- Caller IDs are sensitive information. Restrict access to wallboard dashboards as appropriate.
