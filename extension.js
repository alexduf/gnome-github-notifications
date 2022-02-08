const { St, Gio, Gtk, Soup, Clutter } = imports.gi;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Util = imports.misc.util;
const MessageTray = imports.ui.messageTray;

let githubNotifications;

function info(message) {
    global.log('[GITHUB NOTIFICATIONS EXTENSION][INFO] ' + message);
}

function error(message) {
    global.log('[GITHUB NOTIFICATIONS EXTENSION][ERROR] ' + message);
}

class GithubNotifications {
    constructor() {
        this.token = '';
        this.handle = '';
        this.hideWidget = false;
        this.hideCount = false;
        this.refreshInterval = 60;
        this.githubInterval = 60;
        this.timeout = null;
        this.httpSession = null;
        this.notifications = [];
        this.lastModified = null;
        this.retryAttempts = 0;
        this.retryIntervals = [60, 120, 240, 480, 960, 1920, 3600];
        this.hasLazilyInit = false;
        this.showAlertNotification = false;
        this.showParticipatingOnly = false;
        this._source = null;
        this.settings = null;
    }

    interval() {
        let i = this.refreshInterval
        if (this.retryAttempts > 0) {
            i = this.retryIntervals[this.retryAttempts] || 3600;
        }
        return Math.max(i, this.githubInterval);
    }

    lazyInit() {
        this.hasLazilyInit = true;
        this.reloadSettings();
        this.initHttp();
        this.settings.connect('changed', () => {
            this.reloadSettings();
            this.initHttp();
            this.stopLoop();
            this.planFetch(5, false);
        });
        this.initUI();
    }

    start() {
        this.settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.github.notifications');
        if (!this.hasLazilyInit) {
            this.lazyInit();
        }
        this.fetchNotifications();
        Main.panel._rightBox.insert_child_at_index(this.box, 0);
    }

    stop() {
        this.stopLoop();
        Main.panel._rightBox.remove_child(this.box);
    }

    reloadSettings() {
        this.domain = this.settings.get_string('domain');
        this.token = this.settings.get_string('token');
        this.handle = this.settings.get_string('handle');
        this.hideWidget = this.settings.get_boolean('hide-widget');
        this.hideCount = this.settings.get_boolean('hide-notification-count');
        this.refreshInterval = this.settings.get_int('refresh-interval');
        this.showAlertNotification = this.settings.get_boolean('show-alert');
        this.showParticipatingOnly = this.settings.get_boolean('show-participating-only');
        this.checkVisibility();
    }

    checkVisibility() {
        if (this.box) {
            this.box.visible = !this.hideWidget || this.notifications.length != 0;
        }
        if (this.label) {
            this.label.visible = !this.hideCount;
        }
    }

    stopLoop() {
        if (this.timeout) {
            Mainloop.source_remove(this.timeout);
            this.timeout = null;
        }
    }

    initUI() {
        this.box = new St.BoxLayout({
            style_class: 'panel-button',
            reactive: true,
            can_focus: true,
            track_hover: true
        });
        this.label = new St.Label({
            text: '' + this.notifications.length,
            style_class: 'system-status-icon notifications-length',
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: true,
        });

        this.checkVisibility();

        let icon = new St.Icon({
            style_class: 'system-status-icon'
        });
        icon.gicon = Gio.icon_new_for_string(`${Me.path}/github.svg`);

        this.box.add_actor(icon);
        this.box.add_actor(this.label);

        this.box.connect('button-press-event', (_, event) => {
            let button = event.get_button();

            if (button == 1) {
                this.showBrowserUri();
            } else if (button == 3) {
                ExtensionUtils.openPrefs();
            }
        });
    }


    showBrowserUri() {
        try {
            let url = 'https://' + this.domain + '/notifications';
            if (this.showParticipatingOnly) {
                url = 'https://' + this.domain + '/notifications/participating';
            }

            Gtk.show_uri(null, url, Gtk.get_current_event_time());
        } catch (e) {
            error("Cannot open uri " + e)
        }
    }

    initHttp() {
        let url = 'https://api.' + this.domain + '/notifications';
        if (this.showParticipatingOnly) {
            url = 'https://api.' + this.domain + '/notifications?participating=1';
        }
        this.authUri = new Soup.URI(url);
        this.authUri.set_user(this.handle);
        this.authUri.set_password(this.token);

        if (this.httpSession) {
            this.httpSession.abort();
        } else {
            this.httpSession = new Soup.Session();
            this.httpSession.user_agent = 'gnome-shell-extension github notification via libsoup';

            this.authManager = new Soup.AuthManager();
            this.auth = new Soup.AuthBasic({ host: 'api.' + this.domain, realm: 'Github Api' });

            this.authManager.use_auth(this.authUri, this.auth);
            Soup.Session.prototype.add_feature.call(this.httpSession, this.authManager);
        }
    }

    planFetch(delay, retry) {
        if (retry) {
            this.retryAttempts++;
        } else {
            this.retryAttempts = 0;
        }
        this.stopLoop();
        this.timeout = Mainloop.timeout_add_seconds(delay, () => {
            this.fetchNotifications();
            return false;
        });
    }

    fetchNotifications() {
        let message = new Soup.Message({ method: 'GET', uri: this.authUri });
        if (this.lastModified) {
            // github's API is currently broken: marking a notification as read won't modify the "last-modified" header
            // so this is useless for now
            //message.request_headers.append('If-Modified-Since', this.lastModified);
        }

        this.httpSession.queue_message(message, (_, response) => {
            try {
                if (response.status_code == 200 || response.status_code == 304) {
                    if (response.response_headers.get('Last-Modified')) {
                        this.lastModified = response.response_headers.get('Last-Modified');
                    }
                    if (response.response_headers.get('X-Poll-Interval')) {
                        this.githubInterval = response.response_headers.get('X-Poll-Interval');
                    }
                    this.planFetch(this.interval(), false);
                    if (response.status_code == 200) {
                        let data = JSON.parse(response.response_body.data);
                        this.updateNotifications(data);
                    }
                    return;
                }
                if (response.status_code == 401) {
                    error('Unauthorized. Check your github handle and token in the settings');
                    this.planFetch(this.interval(), true);
                    this.label.set_text('!');
                    return;
                }
                if (!response.response_body.data && response.status_code > 400) {
                    error('HTTP error:' + response.status_code);
                    this.planFetch(this.interval(), true);
                    return;
                }
                // if we reach this point, none of the cases above have been triggered
                // which likely means there was an error locally or on the network
                // therefore we should try again in a while
                error('HTTP error:' + response.status_code);
                error('response error: ' + JSON.stringify(response));
                this.planFetch(this.interval(), true);
                this.label.set_text('!');
                return;
            } catch (e) {
                error('HTTP exception:' + e);
                return;
            }
        });
    }

    updateNotifications(data) {
        let lastNotificationsCount = this.notifications.length;

        this.notifications = data;
        this.label && this.label.set_text('' + data.length);
        this.checkVisibility();
        this.alertWithNotifications(lastNotificationsCount);
    }

    alertWithNotifications(lastCount) {
        let newCount = this.notifications.length;

        if (newCount && newCount > lastCount && this.showAlertNotification) {
            try {
                let message = 'You have ' + newCount + ' new notifications';

                this.notify('Github Notifications', message);
            } catch (e) {
                error("Cannot notify " + e)
            }
        }
    }

    notify(title, message) {
        let notification;

        this.addNotificationSource();

        if (this._source && this._source.notifications.length == 0) {
            notification = new MessageTray.Notification(this._source, title, message);

            notification.setTransient(true);
            notification.setResident(false);
            notification.connect('activated', this.showBrowserUri.bind(this)); // Open on click
        } else {
            notification = this._source.notifications[0];
            notification.update(title, message, { clear: true });
        }

        this._source.notify(notification);
    }

    addNotificationSource() {
        if (this._source) {
            return;
        }

        this._source = new MessageTray.SystemNotificationSource();
        this._source.connect('destroy', () => {
            this._source = null;
        });
        Main.messageTray.add(this._source);
    }
}

function init() {
}

function enable() {
    githubNotifications = new GithubNotifications();
    githubNotifications.start();
}

function disable() {
    githubNotifications.stop();
    githubNotifications = null;
}
