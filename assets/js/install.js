$(function () {
    function show(elem) {
        $(elem).removeClass('hide');
    }

    function hide(elem) {
        $(elem).addClass('hide');
    }

    if (typeof chrome !== 'undefined' && chrome !== null) {
        if (chrome.app.isInstalled) {
            show('.chrome.not-installed');
            hide('.chrome.installed');
        } else {
            $('.chrome.install').on('click', function () {
                chrome.webstore.install();
            });
        }
    } else {
        console.log('Not Google Chrome');
        show('.not-chrome');
        hide('.chrome');
    }

    if (typeof safari === 'undefined' || safari === null) {
        console.log('Not Safari');
        show('.not-safari');
        hide('.safari');
    }

    if (typeof navigator.mozId === 'undefined') {
        console.log('Not Firefox');
        show('.not-firefox');
        hide('.firefox');
    }
});
