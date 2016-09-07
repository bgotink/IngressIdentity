/*
 * shows an export button in communities
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import { ExportData } from 'ingress-identity';

import * as comm from '../communication';
import showPopup from './popup';

export default function addExport() {
  if (document.location.pathname.match(/(^|\/)communities\/([a-zA-Z0-9]+)\/members($|\/)/)) {
    addExportOld();
    return;
  }

  const match = document.location.pathname.match(/(^|\/)communities\/([a-zA-Z0-9]+)($|\/)/);
  if (!match) {
    $('.iidentity-export').remove();
    return;
  }

  const communityOid = match[2];

  const $root = $('c-wiz.tQpI8d');

  if (!$root.length) {
    $('.iidentity-export').remove();
    return;
  }

  comm.shouldShowExport(show => {
    if (!show) {
      $('.iidentity-export').remove();
      return;
    } else if ($('.iidentity-export').length) {
      // already added
      return;
    }

    $root.find('.L0uubb').prepend($(`
      <div role="button" tabindex="0" class="O0WRkf oG5Srb HQ8yf C0oVfc iidentity-export">
        <div class="RveJvd">
          Export to IngressIdentity
        </div>
      </div>
    `));

    $('.iidentity-export').on('click', () => {
      const $status = $root.find('.UC0Lbf');

      const data: ExportData = {
        oid: communityOid,
        showWarning: $status.attr('data-status') !== '3',
        entries: []
      };

      $('.czUUib').each(function () {
        const $this = $(this);

        data.entries.push({
          oid: $this.attr('data-memberid'),
          name: $this.find('.dw7uce').text(),
        });
      });

      comm.setExportData(data, () => {
        showPopup('Export Community', 'gray', chrome.extension.getURL('export.html'));
      });

      return false;
    });
  });
}

function addExportOld() {
  const match = document.location.pathname.match(/(^|\/)communities\/([a-zA-Z0-9]+)\/members($|\/)/);
  if (!match) {
    $('.iidentity-export').remove();
    return;
  }

  const communityOid = match[2];

  comm.shouldShowExport(show => {
    if (!show) {
      $('.iidentity-export').remove();
      return;
    } else if ($('.iidentity-export').length) {
      // already added
      return;
    }

    $('div.WZd.wTc').append($(`
      <a href="#export" class="d-s ob UCc eke iidentity-export" tabindex="0">
          <div class="TZd SZd">
              <span class="VZd NEd">Export to IngressIdentity</span>
          </div>
      </a>
    `));

    $('.iidentity-export').on('click', _ => {
      const $loadMore = $('span.L5');

      const data: ExportData = {
        oid: communityOid,
        showWarning: $loadMore.length > 0 && 'none' !== $loadMore.css('display'),
        entries: []
      };

      $('div.X8c.xTc').each(function () {
        const $this = $(this);

        let oid: string;
        if ($this.is('[oid]')) {
          oid = $this.attr('oid');
        } else {
          const $oidCarrier = $this.find('[oid]');

          if ($oidCarrier.length === 0) {
            return;
          }

          oid = $oidCarrier.first().attr('oid');
        }

        data.entries.push({ oid, name: $this.find('.l0d > .n0d .VCc').text() });
      });

      comm.setExportData(data, () => {
        showPopup('Export Community', 'gray', chrome.extension.getURL('export.html'));
      });

      return false;
    });
  });
}
