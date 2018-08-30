
const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Soup = imports.gi.Soup;
const Clutter = imports.gi.Clutter;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Util = imports.misc.util;

const GITHUB_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.github.notifications';
const Settings = Convenience.getSettings(GITHUB_SETTINGS_SCHEMA);

let githubNotifications;

function info(message) {
  global.log('[GITHUB NOTIFICATIONS EXTENSION][INFO] ' + message);
}
function error(message) {
  global.log('[GITHUB NOTIFICATIONS EXTENSION][ERROR] ' + message);
}

const GithubNotifications = new Lang.Class({
  Name: 'GithubNotifications',

  token: '',
  handle: '',
  hideWidget: false,
  hideCount: false,
  refreshInterval: 60,
  githubInterval: 60,
  timeout: null,
  httpSession: null,
  notifications: [],
  lastModified: null,
  retryAttempts: 0,
  retryIntervals: [60, 120, 240, 480, 960, 1920, 3600],
  hasLazilyInit: false,
  showAlertNotification: false,

  interval: function() {
    let i = this.refreshInterval
    if (this.retryAttempts > 0) {
      i = this.retryIntervals[this.retryAttempts] || 3600;
    }
    return Math.max(i, this.githubInterval);
  },

  _init : function() {
    this.parent();
  },

  lazyInit: function() {
    this.hasLazilyInit = true;
    this.reloadSettings();
    this.initHttp();
    Settings.connect('changed', Lang.bind(this, function() {
      this.reloadSettings();
      this.initHttp();
      this.stopLoop();
      this.planFetch(5, false);
    }));
    this.initUI();
  },

  start: function() {
    if (!this.hasLazilyInit) {
      this.lazyInit();
    }
    this.fetchNotifications();
    Main.panel._rightBox.insert_child_at_index(this.box, 0);
  },

  stop: function() {
    this.stopLoop();
    Main.panel._rightBox.remove_child(this.box);
  },

  reloadSettings: function() {
    this.token = Settings.get_string('token');
    this.handle = Settings.get_string('handle');
    this.hideWidget = Settings.get_boolean('hide-widget');
    this.hideCount = Settings.get_boolean('hide-notification-count');
    this.refreshInterval = Settings.get_int('refresh-interval');
    this.showAlertNotification = Settings.get_boolean('show-alert');
    this.checkVisibility();
  },

  checkVisibility: function() {
    if (this.box) {
      this.box.visible = !this.hideWidget || this.notifications.length != 0;
    }
    if (this.label) {
      this.label.visible = !this.hideCount;
    }
  },

  stopLoop: function() {
    if (this.timeout) {
      Mainloop.source_remove(this.timeout);
      this.timeout = null;
    }
  },

  initUI: function() {
    this.box = new St.BoxLayout({
      style_class: 'panel-button',
      reactive: true,
      can_focus: true,
      track_hover: true
    });
    this.label = new St.Label({
      text: '' + this.notifications.length,
      style_class: 'system-status-icon',
      y_align: Clutter.ActorAlign.CENTER
    });

    this.checkVisibility();

    let icon = new St.Icon({ style_class: 'system-status-icon github-background-symbolic' });

    this.box.add_actor(icon);
    this.box.add_actor(this.label);
    this.box.connect('button-press-event', function(actor, event) {
      let button = event.get_button();

      if (button == 1) {
        Gtk.show_uri(null, 'https://github.com/notifications', Gtk.get_current_event_time());
      } else if (button == 3) {
        Util.spawn(["gnome-shell-extension-prefs", "github.notifications@alexandre.dufournet.gmail.com"]);
      }
    });
  },

  initHttp: function() {
    this.authUri = new Soup.URI('https://api.github.com/notifications');
    this.authUri.set_user(this.handle);
    this.authUri.set_password(this.token);

    if (this.httpSession) {
      this.httpSession.abort();
    } else {
      this.httpSession = new Soup.Session();
      this.httpSession.user_agent = 'gnome-shell-extension github notification via libsoup';

      this.authManager = new Soup.AuthManager();
      this.auth = new Soup.AuthBasic({host: 'api.github.com', realm: 'Github Api'});

      this.authManager.use_auth(this.authUri, this.auth);
      Soup.Session.prototype.add_feature.call(this.httpSession, this.authManager);
    }
  },

  planFetch: function(delay, retry) {
    if (retry) {
      this.retryAttempts++;
    } else {
      this.retryAttempts = 0;
    }
    this.stopLoop();
    this.timeout = Mainloop.timeout_add_seconds(delay, Lang.bind(this, function() {
      this.fetchNotifications();
      return false;
    }));
  },

  fetchNotifications: function() {
    let message = new Soup.Message({method: 'GET', uri: this.authUri});
    if (this.lastModified) {
      // github's API is currently broken: marking a notification as read won't modify the "last-modified" header
      // so this is useless for now
      //message.request_headers.append('If-Modified-Since', this.lastModified);
    }

    this.httpSession.queue_message(message, Lang.bind(this, function(session, response) {
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
    }));
  },

  updateNotifications: function(data) {
    let lastNotificationsCount = this.notifications.length;

    this.notifications = data;
    this.label && this.label.set_text('' + data.length);
    this.checkVisibility();
    this.alertWithNotifications(lastNotificationsCount);
  },

  alertWithNotifications: function(lastCount) {
    let newCount = this.notifications.length;

    if (newCount && newCount != lastCount && this.showAlertNotification) {
      try {
        let message = 'You have ' + newCount + ' new notifications';

        Main.notify('Github Notifications', message);
      } catch (e) {
        error("Cannot notify " + e)
      }
    }
  }
});

function init() {
  githubNotifications = new GithubNotifications();
  //global.githubNotifications = githubNotifications; // for debug purposes only
}

function enable() {
  githubNotifications.start();
}

function disable() {
  githubNotifications.stop();
}
