import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Soup from 'gi://Soup';
import St from 'gi://St';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as ExtensionUtils from 'resource:///org/gnome/shell/misc/extensionUtils.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
let { PACKAGE_VERSION } = Config;
PACKAGE_VERSION = Number(PACKAGE_VERSION);

function info(...messages) {
  for (const m of messages) {
    console.log('[GITHUB NOTIFICATIONS EXTENSION][INFO] ' + m);
  }
}

function error(...messages) {
  for (const m of messages) {
    console.log('[GITHUB NOTIFICATIONS EXTENSION][ERROR] ' + m);
  }
}

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, _('Github Notifications'));

      this.add_child(
        new St.Icon({
          icon_name: 'selection-mode-symbolic',
          style_class: 'system-status-icon',
        })
      );

      let item = new PopupMenu.PopupMenuItem(_('Show Notification'));
      item.connect('activate', () => {
        Main.notify(_('Whatʼs up, folks?'));
      });
      this.menu.addMenuItem(item);
    }
  }
);

export default class GithubNotifications extends Extension {
  _init() {
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

  _sendHttpRequest(url, callback) {
    const request = Soup.Message.new('GET', url);

    this._session.send_async(request, null, (session, result) => {
      try {
        session.send_finish(result);
        if (request.get_status() === Soup.Status.OK) {
          const response = request.get_response_body().data;
          callback(true, response);
        } else {
          callback(false, `HTTP Error: ${request.get_status()}`);
        }
      } catch (error) {
        callback(false, `Error: ${error.message}`);
      }
    });
  }

  interval() {
    let i = this.refreshInterval;
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

  enable() {
    this._indicator = new Indicator();
    Main.panel.addToStatusArea(this.uuid, this._indicator);

    this.settings = this.getSettings(
      'org.gnome.shell.extensions.github.notifications'
    );
    // this.settings = new Gio.Settings({
    //   schema_id: 'org.gnome.shell.extensions.github.notifications',
    // });
    if (!this.hasLazilyInit) {
      this.lazyInit();
    }
    this.fetchNotifications();
    Main.panel._rightBox.insert_child_at_index(this.box, 0);
  }

  disable() {
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
    this.showParticipatingOnly = this.settings.get_boolean(
      'show-participating-only'
    );
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
      track_hover: true,
    });
    this.label = new St.Label({
      text: '' + this.notifications.length || '-',
      style_class: 'system-status-icon notifications-length',
      y_align: Clutter.ActorAlign.CENTER,
      y_expand: true,
    });

    this.checkVisibility();

    let icon = new St.Icon({
      style_class: 'system-status-icon',
    });
    icon.gicon = Gio.icon_new_for_string(`${this.uuid}/github.svg`);

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

      if (PACKAGE_VERSION >= 43) {
        Gtk.show_uri(null, url, Gtk.EventController.get_current_event_time());
      } else {
        Gtk.show_uri(null, url, Gtk.get_current_event_time());
      }
    } catch (e) {
      error('Cannot open uri ' + e);
    }
  }

  initHttp() {
    let path = '/notifications';
    if (this.showParticipatingOnly) {
      path = '/notifications?participating=1';
    }

    if (PACKAGE_VERSION >= 43) {
      this.authUri = GLib.Uri.build(
        GLib.UriFlags.None,
        'https',
        null,
        'api.' + this.domain,
        -1,
        path,
        null,
        null
      );
    } else {
      let url = 'https://api.' + this.domain + path;
      this.authUri = new Soup.URI(url);
      this.authUri.set_user(this.handle);
      this.authUri.set_password(this.token);
    }

    if (this.httpSession) {
      this.httpSession.abort();
    } else {
      this.httpSession = new Soup.Session();
      this.httpSession.user_agent =
        'gnome-shell-extension github notification via libsoup';

      if (PACKAGE_VERSION >= 43) {
        this.auth = new Soup.AuthBasic();
        this.auth.authenticate(this.handle, this.token);
      } else {
        this.auth = new Soup.AuthBasic({
          host: 'api.' + this.domain,
          realm: 'Github Api',
        });
        this.authManager = new Soup.AuthManager();
        this.authManager.use_auth(this.authUri, this.auth);
        Soup.Session.prototype.add_feature.call(
          this.httpSession,
          this.authManager
        );
      }
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
  _readAllBytes(stream) {
    const bytes = [];
    const buffer = new Uint8Array(4096); // 4 KB buffer
    let readBytes = 0;

    while ((readBytes = stream.read(buffer, null)) > 0) {
      bytes.push(...buffer.subarray(0, readBytes));
    }

    return bytes;
  }

  fetchNotifications() {
    let message = new Soup.Message({ method: 'GET', uri: this.authUri });
    if (this.lastModified) {
      // github's API is currently broken: marking a notification as read won't modify the "last-modified" header
      // so this is useless for now
      //message.request_headers.append('If-Modified-Since', this.lastModified);
    }

    if (PACKAGE_VERSION >= 43) {
      message.request_headers.append(
        'Authorization',
        this.auth.get_authorization(message)
      );
      this.httpSession.send_and_read_async(
        message,
        GLib.PRIORITY_DEFAULT,
        null,
        (_, result) => {
          try {
            let body = this.httpSession.send_and_read_finish(result);
            const textDecoder = new TextDecoder('utf-8');
            const text = textDecoder.decode(body);
            if (message.get_status() == 200 || message.get_status() == 304) {
              if (message.get_response_headers().get_one('Last-Modified')) {
                this.lastModified = message
                  .get_response_headers()
                  .get_one('Last-Modified');
              }
              if (message.get_response_headers().get_one('X-Poll-Interval')) {
                this.githubInterval = message
                  .get_response_headers()
                  .get_one('X-Poll-Interval');
              }
              this.planFetch(this.interval(), false);
              if (message.get_status() == 200) {
                const data = JSON.parse(text);
                this.updateNotifications(data);
              }
              return;
            }
            if (message.get_status() == 401) {
              error(
                'Unauthorized. Check your github handle and token in the settings'
              );
              this.planFetch(this.interval(), true);
              this.label.set_text('!');
              return;
            }
            if (!message.message_body.data && message.get_status() > 400) {
              error('HTTP error:' + message.get_status());
              this.planFetch(this.interval(), true);
              return;
            }
            // if we reach this point, none of the cases above have been triggered
            // which likely means there was an error locally or on the network
            // therefore we should try again in a while
            error('HTTP error:' + message.get_status());
            error('message error: ' + JSON.stringify(message));
            this.planFetch(this.interval(), true);
            this.label.set_text('!');
            return;
          } catch (e) {
            error('HTTP exception:' + e);
            return;
          }
        }
      );
    } else {
      this.httpSession.queue_message(message, (_, response) => {
        try {
          if (response.status_code == 200 || response.status_code == 304) {
            if (response.response_headers.get('Last-Modified')) {
              this.lastModified =
                response.response_headers.get('Last-Modified');
            }
            if (response.response_headers.get('X-Poll-Interval')) {
              this.githubInterval =
                response.response_headers.get('X-Poll-Interval');
            }
            this.planFetch(this.interval(), false);
            if (response.status_code == 200) {
              let data = JSON.parse(response.response_body.data);
              this.updateNotifications(data);
            }
            return;
          }
          if (response.status_code == 401) {
            error(
              'Unauthorized. Check your github handle and token in the settings'
            );
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
        error('Cannot notify ' + e);
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

    if (PACKAGE_VERSION >= 43) {
      this._source.showNotification(notification);
    } else {
      this._source.notify(notification);
    }
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
