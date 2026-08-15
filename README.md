[![No Maintenance Intended](http://unmaintained.tech/badge.svg)](http://unmaintained.tech/)

# Llama Status

A [GNOME Shell](https://www.gnome.org/) extension that polls a
[llama.cpp](https://github.com/ggml-org/llama.cpp) server's `/llama/models`
endpoint and shows which model is loaded in the top panel.

> **Personal, thrown-together utility. It works on my machine, but I do not
> intend to maintain or support it.**

## What it does

- Shows the loaded model's id next to a server icon in the top panel
  (`model-8b-q4_k_m`, `model-8b-q4_k_m (+1 more)`, `No model loaded`, or
  `llama.cpp down`).
- Clicking the indicator opens a popup listing all models and their status,
  plus a **Refresh** action.
- Polls the server on a configurable interval; the popup also refreshes when
  opened, and a **Try again** action appears when the server is unreachable.

## Requirements

- GNOME Shell 46 (tested only on this version)
- A running llama.cpp server exposing `/llama/models`

## Installation

There is no build system. From a checkout of this repository:

```sh
gnome-extensions disable llama-status@gear-research.com 2>/dev/null
cp -r llama-status@gear-research.com/. \
  ~/.local/share/gnome-shell/extensions/llama-status@gear-research.com/
gnome-extensions enable llama-status@gear-research.com
```

Then enable **Llama Status** in *Extensions* (or `gnome-extensions
enable llama-status@gear-research.com`). Panel layout changes may require a
shell restart (`Alt+F2` -> `r` on X11) or a logout/login.

## Settings

Available in the extension's preferences page:

| Setting | Default | Description |
| --- | --- | --- |
| Models endpoint | `http://localhost:8080/llama/models` | URL of the llama.cpp `/llama/models` endpoint to poll |
| Refresh interval (seconds) | `30` | How often the server is polled (1–86400) |
| Panel side | `right` | Which side of the top panel the widget sits on |
| Position | `0` | Zero-based index of the widget within that side |

## Development notes

- Code is ES modules using GNOME 46 APIs; `metadata.json` pins
  `shell-version` to `["46"]`.
- `extension.js` uses private shell internals (`Main.panel._leftBox` /
  `_centerBox` / `_rightBox`) for panel placement, so expect breakage on shell
  upgrades.
- HTTP requests use libsoup 3 directly; the response parsing is aligned with
  llama.cpp's `/llama/models` format (`data[].status.value`).
- After editing `schemas/*.gschema.xml`, regenerate the compiled schema:
  `glib-compile-schemas llama-status@gear-research.com/schemas/`

## License

[MIT](LICENSE)
