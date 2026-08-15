import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup?version=3.0';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const NO_MODEL_TEXT = 'No model loaded';
const DOWN_TEXT = 'llama.cpp down';
const ICON_NAME = 'network-server-symbolic';

const LlamaStatusIndicator = GObject.registerClass(
class LlamaStatusIndicator extends PanelMenu.Button {
    _init(settings) {
        super._init(Clutter.ActorAlign.FILL, 'Llama Status');

        this._settings = settings;
        this._session = new Soup.Session({timeout: 10});
        this._cancellable = null;
        this._refreshing = false;
        this._timer = null;

        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        box.add_child(new St.Icon({
            icon_name: ICON_NAME,
            style_class: 'system-status-icon',
        }));
        this._label = new St.Label({
            text: 'Checking...',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'llama-status-label',
        });
        box.add_child(this._label);
        this.add_child(box);

        this.menu.connect('open-state-changed', (_menu, isOpen) => {
            if (isOpen)
                this.refresh();
        });

        this._rearmTimer();
        this.refresh();
    }

    _rearmTimer() {
        if (this._timer)
            GLib.Source.remove(this._timer);

        const interval = this._settings.get_int('refresh-interval');
        this._timer = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this.refresh();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    refresh() {
        if (this._refreshing)
            return;

        this._refreshing = true;
        const url = this._settings.get_string('url');
        let message;
        try {
            message = Soup.Message.new('GET', url);
            if (!message)
                throw new Error('Invalid server URL');
        } catch (error) {
            this._showDown(error.message);
            this._refreshing = false;
            return;
        }

        const cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        this._session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            cancellable,
            (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    const status = message.get_status();
                    if (status !== Soup.Status.OK)
                        throw new Error(`Server returned HTTP ${status}`);

                    const body = new TextDecoder().decode(bytes.get_data());
                    const response = JSON.parse(body);
                    if (!Array.isArray(response.data))
                        throw new Error('Server returned an invalid model list');

                    const models = response.data.map(model => ({
                        id: model.id,
                        status: model.status?.value,
                    }));
                    this._showState({up: true, models});
                } catch (error) {
                    if (!cancellable.is_cancelled())
                        this._showDown(error.message);
                } finally {
                    if (this._cancellable === cancellable)
                        this._cancellable = null;
                    this._refreshing = false;
                }
            }
        );
    }

    _showState(data) {
        if (!data || data.up !== true) {
            this._showDown(data?.error);
            return;
        }

        const models = Array.isArray(data.models) ? data.models : [];
        const loaded = models.filter(model => model.status === 'loaded');

        if (loaded.length > 0) {
            let text = loaded[0].id;
            if (loaded.length > 1)
                text += ` (+${loaded.length - 1} more)`;
            this._setLabel(text, 'llama-status-loaded');
        } else {
            this._setLabel(NO_MODEL_TEXT, 'llama-status-none');
        }

        this._rebuildMenu(models);
    }

    _showDown(detail) {
        this._setLabel(DOWN_TEXT, 'llama-status-down');

        this.menu.removeAll();
        this._addHeading('llama.cpp is not responding');
        if (detail)
            this._addMuted(detail);

        const retry = new PopupMenu.PopupMenuItem('Try again');
        retry.connect('activate', () => this.refresh());
        this.menu.addMenuItem(retry);
    }

    _rebuildMenu(models) {
        this.menu.removeAll();
        this._addHeading('Models');
        if (models.length === 0)
            this._addMuted('Server returned no models');
        for (const model of models) {
            const item = new PopupMenu.PopupMenuItem(
                `${model.id} - ${model.status}`,
                {reactive: false}
            );
            item.label.add_style_class_name(
                model.status === 'loaded' ? 'llama-status-loaded-item' : 'llama-status-muted'
            );
            this.menu.addMenuItem(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const refresh = new PopupMenu.PopupMenuItem('Refresh');
        refresh.connect('activate', () => this.refresh());
        this.menu.addMenuItem(refresh);
    }

    _setLabel(text, styleClass) {
        this._label.set_text(text);
        this._label.remove_style_class_name('llama-status-loaded');
        this._label.remove_style_class_name('llama-status-none');
        this._label.remove_style_class_name('llama-status-down');
        this._label.add_style_class_name(styleClass);
    }

    _addHeading(text) {
        const item = new PopupMenu.PopupMenuItem(text, {reactive: false});
        item.label.add_style_class_name('llama-status-heading');
        this.menu.addMenuItem(item);
    }

    _addMuted(text) {
        const item = new PopupMenu.PopupMenuItem(text, {reactive: false});
        item.label.add_style_class_name('llama-status-muted');
        this.menu.addMenuItem(item);
    }

    destroy() {
        if (this._timer) {
            GLib.Source.remove(this._timer);
            this._timer = null;
        }
        this._cancellable?.cancel();
        this._cancellable = null;
        this._session.abort();
        this._session = null;
        this._settings = null;
        super.destroy();
    }
});

export default class LlamaStatusExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new LlamaStatusIndicator(this._settings);

        Main.panel.addToStatusArea(
            this.uuid,
            this._indicator,
            this._settings.get_int('panel-position'),
            this._settings.get_string('panel-side')
        );

        this._settingsId = this._settings.connect('changed', (_settings, key) => {
            if (key === 'refresh-interval')
                this._indicator._rearmTimer();
            else if (key === 'panel-side' || key === 'panel-position')
                this._moveIndicator();
            else if (key === 'url')
                this._indicator.refresh();
        });
    }

    _moveIndicator() {
        const container = this._indicator.container;
        container.get_parent()?.remove_child(container);

        const boxes = {
            left: Main.panel._leftBox,
            center: Main.panel._centerBox,
            right: Main.panel._rightBox,
        };
        const box = boxes[this._settings.get_string('panel-side')] ?? Main.panel._rightBox;
        const position = Math.max(0, this._settings.get_int('panel-position'));
        box.insert_child_at_index(container, Math.min(position, box.get_n_children()));
    }

    disable() {
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = 0;
        }
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
