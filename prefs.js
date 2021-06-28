const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const GITHUB_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.github.notifications';

const TOKEN_EXPLAINER = 'To get your token, please visit <a href="https://github.com/settings/tokens">https://github.com/settings/tokens</a>\n' +
            ' - Select "Generate new token"\n' +
            ' - Pick any name you fancy (Gnome desktop notifications)\n' +
            ' - Select the "Notifications" scope\n' +
            ' - Click on "Generate Token"\n' +
            ' - Copy and paste the token in the above field\n\n' +
            'Only Github Enterprise users need to change the "Github Hostname"\n' +
            'It should not include "http[s]://" or path params\n\n' +
            '* This refresh interval will be ignored if smaller than github\'s policy.\n' +
            'See <a href="https://developer.github.com/v3/activity/notifications/">https://developer.github.com/v3/activity/notifications</a>';

function buildPrefsWidget() {
  const settings = Convenience.getSettings(GITHUB_SETTINGS_SCHEMA);

  const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 5});

  const hideWidgetBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const hideWidgetLabel = new Gtk.Label({label : "Hide widget when there are no notifications"});
  hideWidgetBox.prepend(hideWidgetLabel);
  const hideWidgetSwitch = new Gtk.Switch();
  settings.bind('hide-widget', hideWidgetSwitch, 'state', Gio.SettingsBindFlags.DEFAULT);
  hideWidgetBox.append(hideWidgetSwitch);
  box.prepend(hideWidgetBox);

  const hideCount = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const hideCountLabel = new Gtk.Label({label : "Hide notification count"});
  hideCount.prepend(hideCountLabel);
  const hideCountSwitch = new Gtk.Switch();
  settings.bind('hide-notification-count', hideCountSwitch, 'state', Gio.SettingsBindFlags.DEFAULT);
  hideCount.append(hideCountSwitch);
  box.prepend(hideCount);

  const showParticipating = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const showParticipatingLabel = new Gtk.Label({label : "Only count notifications if you're participating (mention, review asked...)"});
  showParticipating.prepend(showParticipatingLabel);
  const showParticipatingSwitch = new Gtk.Switch();
  settings.bind('show-participating-only', showParticipatingSwitch, 'state', Gio.SettingsBindFlags.DEFAULT);
  showParticipating.append(showParticipatingSwitch);
  box.prepend(showParticipating);

  const refreshInterval = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const refreshIntervalLabel = new Gtk.Label({label : "Refresh interval (in seconds)*"});
  refreshInterval.prepend(refreshIntervalLabel);
  const refreshIntervalSpinButton = Gtk.SpinButton.new_with_range (60, 86400, 1);
  settings.bind('refresh-interval', refreshIntervalSpinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
  refreshInterval.append(refreshIntervalSpinButton);
  box.prepend(refreshInterval);

  // Show Alert
  const showAlert = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const showAlertLabel = new Gtk.Label({label : "Show notifications alert"});
  showAlert.prepend(showAlertLabel);
  const showAlertSwitch = new Gtk.Switch();
  settings.bind('show-alert', showAlertSwitch, 'state', Gio.SettingsBindFlags.DEFAULT);
  showAlert.append(showAlertSwitch);
  box.prepend(showAlert);

  const handleBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const handleLabel = new Gtk.Label({label : "Github handle"});
  handleBox.prepend(handleLabel);
  const handleEntry = new Gtk.Entry();
  settings.bind('handle', handleEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
  handleBox.append(handleEntry);
  box.prepend(handleBox);

  const tokenBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const tokenLabel = new Gtk.Label({label : "Github Token"});
  tokenBox.prepend(tokenLabel);
  const tokenEntry = new Gtk.Entry();
  settings.bind('token', tokenEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
  tokenBox.append(tokenEntry);
  box.prepend(tokenBox);

  const domainBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const domainLabel = new Gtk.Label({label : "Github Hostname"});
  domainBox.prepend(domainLabel);
  const domainEntry = new Gtk.Entry();
  settings.bind('domain', domainEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
  domainBox.append(domainEntry);
  box.prepend(domainBox);

  const explainerLabel = new Gtk.Label({label : TOKEN_EXPLAINER, selectable: true, 'use-markup': true});
  box.append(explainerLabel);

  if (box.show_all) {
    box.show_all();
  }
  return box;
}

function init() {
}
