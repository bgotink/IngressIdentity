/*
 * Function to create a Google+ popup
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

import $ from 'jquery';

const colorMap = Object.freeze({
  yellow: 'irc',
  cyan: 'QMd',
  red: 'OMd',
  green: 'EMd',
  orange: 'FMd',
  gray: 'HMd',
  brown: 'KMd',
  blue: 'NMd',
} as { gray: string;  [s: string]: string; });

function closePopup() {
  $('.iidentity-backdrop, .iidentity-popup').remove();
}

export default function showPopup(title: string, color: string, url: string) {
  // remove existing pop-up, if any
  closePopup();

  const $document = $(document);

  const totWidth = $document.width();
  const totHeight = $document.height();

  const backDrop = `<div class="G-q-Ya iidentity-backdrop" style="opacity: 0.75; width: ${totWidth}px; height: ${totHeight}px;" aria-hidden="true"></div>`;

  const contentLeft = (totWidth - 625) / 2;
  const contentTop = window.scrollY;
  const contentHeight = window.innerHeight - (18 + 2*32);

  const klass = colorMap[color] || colorMap.gray;

  $(document.body)
    .append(backDrop)
    .append($(`
      <div class="G-q BYb fib iidentity-popup" tabindex="0" role="dialog" style="left: ${contentLeft}px; top: ${contentTop}px;">
          <div class="G-q-O G-q-O-Ip">
              <span class="G-q-O-ab" role="button" tabindex="0" aria-label="Close" style="display: none;"></span>
          </div>
          <div class="G-q-B">
              <div>
                  <div class="BAd jSd"></div>
                  <div class="Vqe CAd">
                      <div>
                          <div>
                              <div class="Yvc ${klass}">
                                  <div class="ySd">${title}</div>
                              </div>
                              <iframe frameBorder="0" src="${url}" style="height: ${contentHeight}px;"></iframe>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
          <div class="G-q-ea" style="display: none;"></div>
      </div>
    `));

  $('.iidentity-popup .G-q-O.G-q-O-Ip, .iidentity-popup .BAd.jSd').on('click', closePopup);
}
