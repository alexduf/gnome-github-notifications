# gnome-github-notifications continued

Integrate github's notifications within the gnome desktop environment

## Installation

### The automatic way

*extensions.gnome.org is pending*

### The manual way

```sh
mkdir -p ~/.local/share/gnome-shell/extensions/
git clone git@github.com:Lyr-7D1h/gnome-github-notifications.git ~/.local/share/gnome-shell/github.notifications@lyr.7d1h.pm.me
```

After adding the extension, restart GNOME Shell for changes to take effect:

- Press Alt + F2, type r, and press Enter (on Xorg sessions).
- Log out and back in (on Wayland sessions).

```sh
gnome-extensions enable github.notifications@lyr.7d1h.pm.me
```

## Development

1. Install (see [Installation](#installation))
2. Make changes to the extension
3. Run `dbus-run-session -- gnome-shell --nested --wayland`
