/* The main script for the export page
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { ExportData, ExportDataEntry } from 'ingress-identity';

import './auto-translate';

import { log } from './log';
import * as comm from './communication';

const nameRegexes = [
    /\(([^)]+)\)/,              // FirstName LastName (Nickname)
    /"([^"]+)"/,                // FirstName "Nickname" LastName
    /\u201C([^\u201D]+)\u201D/, // FirstName “Nickname” LastName
    /\u2018([^\u2019]+)\u2019/, // FirstName ‘Nickname’ LastName
    /\s+a\.?k\.?a\.?\s+(.*)$/   // FirstName LastName a.k.a. Nickname
];

function createExportTableRow(oid: string, name: string, nickname: string, header: boolean = false) {
    const celltype = header ? 'th' : 'td';

    return $(`
        <tr>
            <${ celltype }>${ oid }</${ celltype }>
            <${ celltype }>${ name }</${ celltype }>
            <${ celltype }>${ nickname || '' }</${ celltype }>
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

function handleData(data: ExportDataEntry) {
    const $shownResult = $('.table.result');

    $shownResult
        .empty()
        .append(createExportTableRow('oid', 'name', 'nickname', true));
    
    parseName(data, () => {
        $shownResult.append(createExportTableRow(data.oid, data.name, data.nickname));

        let line = `${data.oid}\t${data.name}`;

        if (data.nickname) {
            line += `\t${data.nickname}`;
        }

        $('.export.result').text(line);
    });
}

$($ => {
    $('#copy').on('click', () => {
        $('.export.result').focus().select();

        if (document.execCommand('copy', false, null)) {
            // cancel event
            return false;
        }

        // Automatic copy failed
        // Fallback to hiding the table & showing a textarea
        $('.table.result')
            .empty()
            .append(
                $('<textarea rows="30" columns="30">').text($('.export.result').text())
            );
        
        // cancel event
        return false;
    });

    comm.getExportData(data => {
        log('Got export data', data);

        handleData(data.entries[0]);
    });
});