# gnome-github-notifications
Integrate github's notifications within the gnome desktop environment

## Installation

### The automatic way
Go there and activate the extension: https://extensions.gnome.org/extension/1125/github-notifications/
Don't forget to click on the configuration icon and follow the instructions there.

### The manual way

```
mkdir -p ~/.local/share/gnome-shell/extensions/
cd ~/.local/share/gnome-shell/extensions/
git clone git@github.com:alexduf/gnome-github-notifications.git github.notifications@alexandre.dufournet.gmail.com
```

Then in gnome-tweaks, configure the extension to give it a token and your github handle (instructions are provided in the configuration dialog).
If the extension isn't detected, restart gnome shell `Alt` + `F2`, type `r` then press `enter`.


