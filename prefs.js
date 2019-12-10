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
  const hideWidgetLabel = new Gtk.Label ({label : "Hide widget when there are no notifications"});
  hideWidgetBox.pack_start(hideWidgetLabel, false, false, 5);
  const hideWidgetSwitch = new Gtk.Switch();
  settings.bind('hide-widget', hideWidgetSwitch, 'state', Gio.SettingsBindFlags.DEFAULT);
  hideWidgetBox.pack_end(hideWidgetSwitch, false, false, 5);
  box.pack_start(hideWidgetBox, false, false, 5);

  const hideCount = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const hideCountLabel = new Gtk.Label ({label : "Hide notification count"});
  hideCount.pack_start(hideCountLabel, false, false, 5);
  const hideCountSwitch = new Gtk.Switch();
  settings.bind('hide-notification-count', hideCountSwitch, 'state', Gio.SettingsBindFlags.DEFAULT);
  hideCount.pack_end(hideCountSwitch, false, false, 5);
  box.pack_start(hideCount, false, false, 5);

  const showParticipating = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const showParticipatingLabel = new Gtk.Label ({label : "Only count notifications if you're participating (mention, review asked...)"});
  showParticipating.pack_start(showParticipatingLabel, false, false, 5);
  const showParticipatingSwitch = new Gtk.Switch();
  settings.bind('show-participating-only', showParticipatingSwitch, 'state', Gio.SettingsBindFlags.DEFAULT);
  showParticipating.pack_end(showParticipatingSwitch, false, false, 5);
  box.pack_start(showParticipating, false, false, 5);

  const refreshInterval = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const refreshIntervalLabel = new Gtk.Label ({label : "Refresh interval (in seconds)*"});
  refreshInterval.pack_start(refreshIntervalLabel, false, false, 5);
  const refreshIntervalSpinButton = Gtk.SpinButton.new_with_range (60, 86400, 1);
  settings.bind('refresh-interval', refreshIntervalSpinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
  refreshInterval.pack_end(refreshIntervalSpinButton, false, false, 5);
  box.pack_start(refreshInterval, false, false, 5);

  // Show Alert
  const showAlert = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const showAlertLabel = new Gtk.Label ({label : "Show notifications alert"});
  showAlert.pack_start(showAlertLabel, false, false, 5);
  const showAlertSwitch = new Gtk.Switch();
  settings.bind('show-alert', showAlertSwitch, 'state', Gio.SettingsBindFlags.DEFAULT);
  showAlert.pack_end(showAlertSwitch, false, false, 5);
  box.pack_start(showAlert, false, false, 5);

  const handleBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const handleLabel = new Gtk.Label ({label : "Github handle"});
  handleBox.pack_start(handleLabel, false, false, 5);
  const handleEntry = new Gtk.Entry();
  settings.bind('handle', handleEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
  handleBox.pack_end(handleEntry, true, true, 5);
  box.pack_start(handleBox, false, false, 5);

  const tokenBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const tokenLabel = new Gtk.Label ({label : "Github Token"});
  tokenBox.pack_start(tokenLabel, false, false, 5);
  const tokenEntry = new Gtk.Entry();
  settings.bind('token', tokenEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
  tokenBox.pack_end(tokenEntry, true, true, 5);
  box.pack_start(tokenBox, false, false, 5);

  const domainBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
  const domainLabel = new Gtk.Label ({label : "Github Hostname"});
  domainBox.pack_start(domainLabel, false, false, 5);
  const domainEntry = new Gtk.Entry();
  settings.bind('domain', domainEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
  domainBox.pack_end(domainEntry, true, true, 5);
  box.pack_start(domainBox, false, false, 5);

  const explainerLabel = new Gtk.Label({label : TOKEN_EXPLAINER, selectable: true, 'use-markup': true});
  box.pack_end(explainerLabel, false, false, 5);

  box.show_all();
  return box;
}

function init() {
}
