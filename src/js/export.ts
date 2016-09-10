/* The main script for the export page
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { ExportData, ExportDataEntry } from 'ingress-identity';

import translate from './auto-translate';
import * as comm from './communication';
import { log } from './log';

const options = Object.freeze({
    shouldExtractName() {
        return $('#btn_extract_name').is('.active');
    },
    shouldRemoveExisting() {
        return $('#btn_remove_existing').is('.active');
    },
    shouldShowHeader() {
        return $('#btn_show_header').is('.active');
    },
});

const nameRegexes = [
    /\(([^)]+)\)/,              // FirstName LastName (Nickname)
    /"([^"]+)"/,                // FirstName "Nickname" LastName
    /\u201C([^\u201D]+)\u201D/, // FirstName “Nickname” LastName
    /\u2018([^\u2019]+)\u2019/, // FirstName ‘Nickname’ LastName
    /\s+a\.?k\.?a\.?\s+(.*)$/   // FirstName LastName a.k.a. Nickname
];

class Modal {
    private $this: JQuery;

    constructor(name: string) {
        this.$this = $(name);
    }

    show() {
        this.$this.modal('show');
    }

    hide() {
        // delay hide to give progress bar time to fill
        window.setTimeout(() => this.$this.modal('hide'), 500);
    }
}

class Progress {
    private $this: JQuery;

    constructor(name: string) {
        this.$this = $(name);
    }

    set(value: number, total: number) {
        const percent = Math.round(100 * value / total);

        this.$this
            .attr('aria-valuenow', percent)
            .css('width', `${ percent }%`)
            .find('span.sr-only percent')
                .text(percent);
    }

    reset() {
        this.set(0, 1);
    }
}

function createExportTableRow(oid: string, name: string, nickname: string = '', level: string = '', header: boolean = false) {
    const celltype = header ? 'th' : 'td';

    return $(`
        <tr>
            <${ celltype }>${ oid }</${ celltype }>
            <${ celltype }>${ name }</${ celltype }>
            <${ celltype }>${ nickname || '' }</${ celltype }>
            <${ celltype }>${ level }</${celltype }>
        </tr>
    `);
}

function parseName(data: ExportDataEntry, callback: () => void): void {
    comm.getPlayer(data.oid, (status, player) => {
        if (player && player.nickname) {
            data.name = player.name;
            data.nickname = player.nickname;
        } else {
            for (let re of nameRegexes) {
                const matches = data.name.match(re);
                if (matches) {
                    data.nickname = matches[1].trim();
                    data.name = data.name.replace(re, '').replace(/\s+/, ' ');

                    break;
                }
            }
        }

        callback();
    }, { show_self: true });
}

let modals = {
    export: null as Modal,
    parse_export: null as Modal,
};
let progress = {
    parse: null as Progress,
    export: null as Progress,
};

let rawData: ExportData;
let parsedData: ExportDataEntry[];

function parseHelper(i: number, l: number, extractName: boolean, removeExisting: boolean, callback: () => void) {
    if (i >= l) {
        callback();
        return;
    }

    progress.parse.set(i + 1, l);
    const entry = rawData.entries[i];

    function nextStep() {
        parseHelper(i + 1, l, extractName, removeExisting, callback);
    }

    function addPlayer() {
        if (extractName) {
            parseName(entry, () => {
                parsedData.push(entry);
                nextStep();
            });
        } else {
            parsedData.push(entry);
            nextStep();
        }
    }

    if (!removeExisting) {
        addPlayer();
        return;
    }

    comm.getPlayer(entry.oid, (status, player) => {
        if (player && player.community.some(community => community.oid === rawData.oid)) {
            nextStep();
            return;
        }

        addPlayer();
    }, { show_self: true });
}

function parse(callback: () => void) {
    parsedData = [];
    parseHelper(0, rawData.entries.length, options.shouldExtractName(), options.shouldRemoveExisting(), callback);
}

function doExportHelper() {
    const lines = [] as string[];
    const $shownResult = $('.table.result');

    // remove previous result
    $shownResult.empty();

    // add header
    $shownResult.append(createExportTableRow('oid', 'name', 'nickname', 'level', true));

    if (options.shouldShowHeader()) {
        lines.push(
            "oid\tname\tnickname\tlevel",
            "999999999999999999999\tdummy\tdummy\t0"
        );

        $shownResult.append(createExportTableRow('999999999999999999999', 'dummy', 'dummy', '0', true));
    }

    const { length } = parsedData;

    parsedData.forEach((entry, i) => {
        progress.export.set(i, length);

        let line = `${entry.oid}\t${entry.name}`;

        if (entry.nickname) {
            line += `\t${entry.nickname}`;
        }

        lines.push(line);
        $shownResult.append(createExportTableRow(entry.oid, entry.name, entry.nickname))
    });

    $('.export.result')
        .text(lines.join("\n"));
    
    modals.export.hide();
    modals.parse_export.hide();
}

function doExport(shouldParse: boolean) {
    if (shouldParse) {
        progress.parse.reset();
        progress.export.reset();

        modals.parse_export.show();
        
        parse(doExportHelper);
        return;
    }

    progress.export.reset();
    modals.export.show();
    doExportHelper();
}

$($ => {
    modals.export = new Modal('#modal_export');
    modals.parse_export = new Modal('#modal_parse_export');

    progress.parse = new Progress('.progress-bar.parse');
    progress.export = new Progress('.progress-bar.export');

    $('button.setting').on('click', function () {
        const $this = $(this);

        if ($this.is('.active')) {
            $this.removeClass('active')
                .text(translate('disabled' /* Disabled */));
        } else {
            $this.addClass('active')
                .text(translate('enabled' /* Enabled */));
        }

        doExport($this.is('.requires-reparse'));
    });

    $('#copy').on('click', () => {
        $('.export.result').focus().select();

        if (document.execCommand('copy', false, null)) {
            // copy successfull
            return false;
        }

        // automatic copy failed
        // fallback to hiding the table and showing a textarea
        $('.table.result')
            .empty()
            .append(
                $('<textarea rows="30" columns="30">')
                    .text($('.export.result').text())
            );

        return false;
    });

    comm.getExportData(result => {
        log('Got export data', result);
        rawData = result;

        if (rawData.showWarning) {
            $('.warning').removeClass('hide');
        }

        doExport(true);
    });
});