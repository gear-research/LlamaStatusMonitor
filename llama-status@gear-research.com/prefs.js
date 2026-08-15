import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk?version=4.0';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SIDES = ['left', 'center', 'right'];

export default class LlamaStatusPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({title: 'Llama Status'});

        const serverGroup = new Adw.PreferencesGroup({
            title: 'Server',
            description: 'The llama.cpp server to monitor.',
        });
        const urlRow = new Adw.EntryRow({title: 'Models endpoint'});
        urlRow.set_text(settings.get_string('url'));
        urlRow.connect('changed', () => {
            settings.set_string('url', urlRow.get_text());
        });
        serverGroup.add(urlRow);
        page.add(serverGroup);

        const refreshGroup = new Adw.PreferencesGroup({title: 'Refresh'});
        const intervalAdjustment = new Gtk.Adjustment({
            lower: 1,
            upper: 86400,
            step_increment: 1,
            page_increment: 30,
        });
        intervalAdjustment.set_value(settings.get_int('refresh-interval'));
        const intervalRow = new Adw.SpinRow({
            title: 'Refresh interval (seconds)',
            adjustment: intervalAdjustment,
        });
        intervalAdjustment.connect('value-changed', () => {
            settings.set_int('refresh-interval', Math.round(intervalAdjustment.get_value()));
        });
        refreshGroup.add(intervalRow);
        page.add(refreshGroup);

        const positionGroup = new Adw.PreferencesGroup({
            title: 'Panel position',
            description: 'Where the widget sits on the top panel.',
        });
        const sideRow = new Adw.ComboRow({
            title: 'Panel side',
            selectable: true,
        });
        sideRow.set_model(Gtk.StringList.new(['Left', 'Center', 'Right']));
        sideRow.set_selected(Math.max(0, SIDES.indexOf(settings.get_string('panel-side'))));
        sideRow.connect('notify::selected', () => {
            settings.set_string('panel-side', SIDES[sideRow.get_selected()]);
        });
        positionGroup.add(sideRow);

        const positionAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 64,
            step_increment: 1,
            page_increment: 1,
        });
        positionAdjustment.set_value(settings.get_int('panel-position'));
        const positionRow = new Adw.SpinRow({
            title: 'Position (index within the panel side)',
            adjustment: positionAdjustment,
        });
        positionAdjustment.connect('value-changed', () => {
            settings.set_int('panel-position', Math.round(positionAdjustment.get_value()));
        });
        positionGroup.add(positionRow);
        page.add(positionGroup);

        window.add(page);
    }
}
