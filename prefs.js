const { Gtk, Gio } = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const _settings = Convenience.getSettings(GITHUB_SETTINGS_SCHEMA);

const GITHUB_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.github.notifications';

const TOKEN_EXPLAINER = 'To get your token, please visit <a href="https://github.com/settings/tokens/new?scopes=notifications&amp;description=Gnome%20desktop%20notifications">https://github.com/settings/tokens</a>\n' +
    ' - Click on "Generate Token"\n' +
    ' - Copy and paste the token in the above field\n\n' +
    'Only Github Enterprise users need to change the "Github Hostname"\n' +
    'It should not include "http[s]://" or path params\n\n' +
    '* This refresh interval will be ignored if smaller than github\'s policy.\n' +
    'See <a href="https://developer.github.com/v3/activity/notifications/">https://developer.github.com/v3/activity/notifications</a>';

function makeLabeledOptionBox(label) {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 5,
    });
    const label = new Gtk.Label({ label });

    box.append(label);
    return box;
}

function makeLabeledSwitchOptionBox(label, boundSettingName) {
    const box = makeLabeledOptionBox(label);

    const switch_ = new Gtk.Switch();
    _settings.bind(boundSettingName, switch_, 'state', Gio.SettingsBindFlags.DEFAULT);

    box.append(switch_);
    return box;
}

function buildPrefsWidget() {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 5 });

    const hideWidgetBox = makeLabeledSwitchOptionBox(
        'Hide widget when there are no notifications',
        'hide-widget',
    );
    box.prepend(hideWidgetBox);

    const hideCountBox = makeLabeledSwitchOptionBox(
        'Hide notification count',
        'hide-notification-count',
    );
    box.prepend(hideCountBox);

    const showParticipating = makeLabeledOptionBox(
        'Only count notifications if you\'re participating (mention, review asked...)',
        'show-participating-only',
    );
    box.prepend(showParticipating);

    const refreshInterval = makeLabeledOptionBox('Refresh interval (in seconds)*');
    const refreshIntervalSpinButton = Gtk.SpinButton.new_with_range(60, 86400, 1);
    settings.bind('refresh-interval', refreshIntervalSpinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
    refreshInterval.append(refreshIntervalSpinButton);
    box.prepend(refreshInterval);

    // Show Alert
    const showAlert = makeLabeledOptionBox(
        'Show notifications alert',
        'show-alert',
    );
    box.prepend(showAlert);

    const handleBox = makeLabeledOptionBox('Github handle');
    const handleEntry = new Gtk.Entry();
    settings.bind('handle', handleEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
    handleBox.append(handleEntry);
    box.prepend(handleBox);

    const tokenBox = makeLabeledOptionBox('Github Token');
    const tokenEntry = new Gtk.Entry();
    settings.bind('token', tokenEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
    tokenBox.append(tokenEntry);
    box.prepend(tokenBox);

    const domainBox = makeLabeledOptionBox('Github Hostname');
    const domainEntry = new Gtk.Entry();
    settings.bind('domain', domainEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
    domainBox.append(domainEntry);
    box.prepend(domainBox);

    const explainerLabel = new Gtk.Label({ label: TOKEN_EXPLAINER, selectable: true, 'use-markup': true });
    box.append(explainerLabel);

    if (box.show_all) {
        box.show_all();
    }
    return box;
}

function init() {
}
