import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const LOGIND_BUS_NAME = 'org.freedesktop.login1';
const BACKLIGHT_DIR = '/sys/class/backlight';
const STEP_PERCENT = 5; // percent per scroll click

function findBacklightDevice() {
    const dir = Gio.File.new_for_path(BACKLIGHT_DIR);
    const enumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let info;
    while ((info = enumerator.next_file(null)))
        return info.get_name(); // first device is good enough for a single internal panel
    return null;
}

export default class ScrollBrightnessExtension extends Extension {
    enable() {
        this._device = findBacklightDevice();
        if (!this._device) {
            logError(new Error('scroll-brightness: no backlight device found under ' + BACKLIGHT_DIR));
            return;
        }

        this._devicePath = `${BACKLIGHT_DIR}/${this._device}`;
        this._maxBrightness = this._readInt(`${this._devicePath}/max_brightness`);

        this._indicator = new PanelMenu.Button(0.0, 'Scroll Brightness', true);
        this._indicator.reactive = true;
        this._indicator.track_hover = true;

        const icon = new St.Icon({
            icon_name: 'display-brightness-symbolic',
            style_class: 'system-status-icon',
        });
        this._indicator.add_child(icon);

        this._indicator.connect('scroll-event', (actor, event) => this._onScroll(event));

        Main.panel.addToStatusArea('scroll-brightness-indicator', this._indicator, 1, 'right');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }

    _getSessionPath() {
        // GetSessionByPID(0) is unreliable here (fails with NoSessionForPID
        // depending on how gnome-shell's cgroup is tracked), so instead look
        // through all sessions for the seated (graphical) one.
        const result = Gio.DBus.system.call_sync(
            LOGIND_BUS_NAME, '/org/freedesktop/login1', 'org.freedesktop.login1.Manager',
            'ListSessions', null, null, Gio.DBusCallFlags.NONE, -1, null
        );
        const sessions = result.deep_unpack()[0]; // array of (id, uid, user, seat, path)
        for (const [, , , seat, path] of sessions) {
            if (seat !== '')
                return path;
        }
        if (sessions.length > 0)
            return sessions[0][4];
        throw new Error('no logind session found');
    }

    _readInt(path) {
        const [ok, contents] = GLib.file_get_contents(path);
        if (!ok)
            throw new Error(`failed to read ${path}`);
        return parseInt(new TextDecoder().decode(contents), 10);
    }

    _onScroll(event) {
        const direction = event.get_scroll_direction();
        let delta = 0;

        if (direction === Clutter.ScrollDirection.UP)
            delta = STEP_PERCENT;
        else if (direction === Clutter.ScrollDirection.DOWN)
            delta = -STEP_PERCENT;
        else if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [, dy] = event.get_scroll_delta();
            if (dy < 0)
                delta = STEP_PERCENT;
            else if (dy > 0)
                delta = -STEP_PERCENT;
        }

        if (delta === 0)
            return Clutter.EVENT_PROPAGATE;

        this._adjustBrightness(delta);
        return Clutter.EVENT_STOP;
    }

    _adjustBrightness(deltaPercent) {
        try {
            const current = this._readInt(`${this._devicePath}/brightness`);
            const currentPercent = (current / this._maxBrightness) * 100;
            const nextPercent = Math.max(0, Math.min(100, currentPercent + deltaPercent));
            const nextRaw = Math.round((nextPercent / 100) * this._maxBrightness);

            const sessionPath = this._getSessionPath();
            Gio.DBus.system.call_sync(
                LOGIND_BUS_NAME, sessionPath, 'org.freedesktop.login1.Session',
                'SetBrightness', new GLib.Variant('(ssu)', ['backlight', this._device, nextRaw]),
                null, Gio.DBusCallFlags.NONE, -1, null
            );
        } catch (e) {
            logError(e, 'scroll-brightness: failed to adjust brightness');
        }
    }
}
