MDs = README.md LICENSE.md NOTICE.md
JSs = js/content.js js/options.js js/help.js js/background.js
CSSs = css/content.css css/options.css css/help.css
HTMLs = options.html background.html help.html

JS_CONTENT_DEPS = src/coffee/communication.coffee src/coffee/log.coffee src/coffee/content/doOnce.coffee src/coffee/content/main.coffee src/coffee/content/mentions.coffee src/coffee/content/profile.coffee src/coffee/content/source.coffee
JS_OPTIONS_DEPS = src/coffee/communication.coffee src/coffee/log.coffee src/coffee/options.coffee
JS_BACKGROUND_DEPS = src/coffee/log.coffee src/coffee/data/spreadsheets.coffee src/coffee/data/interpreter.coffee src/coffee/data/merger.coffee src/coffee/data/data.coffee src/coffee/background.coffee
JS_HELP_DEPS = src/coffee/help.coffee

FILES= $(MDs) $(JSs) $(CSSs) $(HTMLs) vendor

define copy
@echo "Copying $<"
@rm -fr $@
@cp -R $< $@
endef

define less
lessc $< $@
endef

define less_release
lessc -x $< $@
endef

define coffee
@bin/coffee $@ $^
endef

define coffee_release
@bin/coffee --minify $@ src/coffee/release-header.coffee $^
endef

define mkdir
mkdir -p $@
endef

.PHONY: all all-release release init dist default clean common common-release chrome chrome-release chrome-all chrome-dist safari safari-release safari-all safari-dist firefox firefox-release firefox-all firefox-dist

# Main entrypoints
#

default: all

all: chrome safari firefox

release: all-release
all-release: chrome-release safari-release firefox-release

dist: chrome-dist safari-dist firefox-dist

clean:
	rm -rf build

# Tools
#

tools: ; $(mkdir)

tools/gray2transparent:
	@if [ ! -d tools ]; then make tools fi
	@if [ -d $@ ]; then cd $@ && git pull; else git clone https://gist.github.com/635bca8e2a3d47bf6a5f.git $@; fi

tools/gray2transparent/gray2transparent: tools/gray2transparent $(addprefix tools/gray2transparent/, gray2transparent.cpp exr_io.h exr_io.cpp)
	@$(MAKE) -C $< gray2transparent

# Common targets
#

# helpers

build/common: build/common/css

build/common-release: build/common-release/css

build/%/vendor: src/vendor
	rm -rf $@
	$(copy)
	rm -rf $@/{css/bootstrap{-theme*,.css*},js/bootstrap.js,js/class.js}

build/%/README.md: README.md
	$(copy)

build/%/LICENSE.md: LICENSE.md
	$(copy)

build/%/NOTICE.md: NOTICE.md
	$(copy)

build/%/background.html: src/background.html
	$(copy)

build/%/help.html: src/help.html
	$(copy)

build/%/options.html: src/options.html
	$(copy)

build/common-release/css/content.css: src/less/content.less src/less/variables.less src/less/general.less
	$(less_release)

build/common-release/css/%.css: src/less/%.less src/less/variables.less src/less/general.less src/less/general_background.less
	$(less_release)

build/common/css/content.css: src/less/content.less src/less/variables.less src/less/general.less
	$(less)

build/common/css/%.css: src/less/%.less src/less/variables.less src/less/general.less src/less/general_background.less
	$(less)

build/%/js: ; $(mkdir)
build/%/css: ; $(mkdir)

build/%/img:
	$(mkdir)

build/%/img/logo:
	$(mkdir)

build/%/img/logo/ingress.png: src/img/logo.svg build/%/img/logo
	convert -background none $< $@

build/%/img/logo/16.png: src/img/logo.svg build/%/img/logo
	convert -background none $< -resize 16 $@

build/%/img/logo/48.png: src/img/logo.svg build/%/img/logo
	convert -background none $< -resize 48 $@

build/%/img/logo/128.png: src/img/logo.svg build/%/img/logo
	convert -background none $< -resize 128 $@

build/%/img/anomalies: src/img/anomalies build/%/img
	$(copy)
	@rm $@/README.md

# main

common: build/common $(addprefix build/common/,$(CSSs))
common-release: build/common-release $(addprefix build/common-release/,$(CSSs))

# Chrome targets
#

# helpers

build/%/manifest.json: template/%/manifest.json
	$(copy)

build/chrome/js/content.js: src/coffee/beal/chrome/content.coffee $(JS_CONTENT_DEPS)
	$(coffee)

build/chrome-release/js/content.js: src/coffee/beal/chrome/content.coffee $(JS_CONTENT_DEPS)
	$(coffee_release)

build/chrome/js/background.js: src/coffee/beal/chrome/background.coffee $(JS_BACKGROUND_DEPS)
	$(coffee)

build/chrome-release/js/background.js: src/coffee/beal/chrome/background.coffee $(JS_BACKGROUND_DEPS)
	$(coffee_release)

build/chrome/js/options.js: src/coffee/beal/chrome/content.coffee $(JS_OPTIONS_DEPS)
	$(coffee)

build/chrome-release/js/options.js: src/coffee/beal/chrome/content.coffee $(JS_OPTIONS_DEPS)
	$(coffee_release)

build/chrome/js/help.js: $(JS_HELP_DEPS)
	$(coffee)

build/chrome-release/js/help.js: $(JS_HELP_DEPS)
	$(coffee_release)

build/chrome/css/%: build/common/css/%
	$(copy)

build/chrome-release/css/%: build/common-release/css/%
	$(copy)

build/chrome: build/chrome/js build/chrome/css
build/chrome-release: build/chrome-release/js build/chrome-release/css

# main

chrome: common build/chrome $(addprefix build/chrome/, $(FILES) manifest.json img/anomalies $(addprefix img/logo/, ingress.png 16.png 48.png 128.png))

chrome-release: common-release build/chrome-release $(addprefix build/chrome-release/, $(FILES) manifest.json img/anomalies $(addprefix img/logo/, ingress.png 16.png 48.png 128.png))

chrome-all: chrome chrome-release

chrome-dist: chrome-release
	@bin/dist/chrome

# Safari targets
#

# helpers

build/%.safariextension/Info.plist: template/%.safariextension/Info.plist
	$(copy)

build/IngressIdentity.safariextension/js/content.js: src/coffee/beal/safari/content.coffee $(JS_CONTENT_DEPS)
	$(coffee)

build/IngressIdentity-release.safariextension/js/content.js: src/coffee/beal/safari/content.coffee $(JS_CONTENT_DEPS)
	$(coffee_release)

build/IngressIdentity.safariextension/js/background.js: src/coffee/beal/safari/background.coffee $(JS_BACKGROUND_DEPS)
	$(coffee)

build/IngressIdentity-release.safariextension/js/background.js: src/coffee/beal/safari/background.coffee $(JS_BACKGROUND_DEPS)
	$(coffee_release)

build/IngressIdentity.safariextension/js/options.js: src/coffee/beal/safari/content.coffee $(JS_OPTIONS_DEPS)
	$(coffee)

build/IngressIdentity-release.safariextension/js/options.js: src/coffee/beal/safari/content.coffee $(JS_OPTIONS_DEPS)
	$(coffee_release)

build/IngressIdentity.safariextension/js/help.js: $(JS_HELP_DEPS)
	$(coffee)

build/IngressIdentity-release.safariextension/js/help.js: $(JS_HELP_DEPS)
	$(coffee_release)

build/IngressIdentity.safariextension/css/%: build/common/css/%
	$(copy)

build/IngressIdentity-release.safariextension/css/%: build/common-release/css/%
	$(copy)

build/%.safariextension: build/%.safariextension/js build/%.safariextension/css

build/%.safariextension/img/logo/toolbar.png: src/img/logo.svg build/%.safariextension/img/logo tools/gray2transparent/gray2transparent
	convert -background none $< -resize 48 tmp.exr
	tools/gray2transparent/gray2transparent tmp.exr tmp2.exr
	convert tmp2.exr $@
	rm tmp.exr tmp2.exr

# main

safari: common build/IngressIdentity.safariextension $(addprefix build/IngressIdentity.safariextension/, $(FILES) Info.plist img/anomalies img/logo/toolbar.png img/logo/ingress.png)

safari-release: common-release build/IngressIdentity-release.safariextension $(addprefix build/IngressIdentity-release.safariextension/, $(FILES) Info.plist img/anomalies img/logo/toolbar.png img/logo/ingress.png)

safari-all: safari safari-release

safari-dist: safari-release
	@bin/dist/safari

# Firefox targets
#

# helpers

build/firefox:
	$(mkdir)

build/firefox-release:
	$(mkdir)

build/%/data:
	$(mkdir)

build/%/data/js:
	$(mkdir)

build/%/data/css:
	$(mkdir)

build/%/data/img:
	$(mkdir)

build/%/data/img/logo:
	$(mkdir)

build/%/lib:
	$(mkdir)

build/%/data/img/anomalies: src/img/anomalies build/%/data/img
	$(copy)

build/%/data/img/logo/ingress.png: src/img/logo.svg
	convert -background none $< $@

build/%/data/img/logo/16.png: src/img/logo.svg
	convert -background none $< -resize 16 $@

build/%/data/img/logo/32.png: src/img/logo.svg
	convert -background none $< -resize 32 $@

build/%/data/img/logo/64.png: src/img/logo.svg
	convert -background none $< -resize 64 $@

build/firefox/data/css/%: build/common/css/% build/firefox/data/css
	$(copy)

build/firefox-release/data/css/%: build/common-release/css/% build/firefox-release/data/css
	$(copy)

build/firefox/data/options.html: src/options.html build/firefox/data
	grep -vE '<script type="text/javascript" src=' $< > $@

build/firefox/data/%.html: src/%.html build/firefox/data
	$(copy)

build/firefox-release/data/%.html: src/%.html build/firefox-release/data
	$(copy)

build/firefox/%.md: %.md build/firefox
	$(copy)

build/firefox-release/data/%.md: %.md build/firefox-release
	$(copy)

build/%/package.json: template/%/package.json
	$(copy)

build/firefox/lib/bootstrap.js: template/firefox/lib/bootstrap.coffee
	$(coffee)

build/firefox-release/lib/bootstrap.js: template/firefox-release/lib/bootstrap.coffee
	$(coffee_release)

build/firefox/data/js/content.js: src/coffee/beal/firefox/content.coffee $(JS_CONTENT_DEPS)
	$(coffee)

build/firefox-release/data/js/content.js: src/coffee/beal/firefox/content.coffee $(JS_CONTENT_DEPS)
	$(coffee_release)

build/firefox/data/js/background.js: src/coffee/beal/firefox/background.coffee $(JS_BACKGROUND_DEPS)
	$(coffee)

build/firefox-release/data/js/background.js: src/coffee/beal/firefox/background.coffee $(JS_BACKGROUND_DEPS)
	$(coffee_release)

build/firefox/data/js/options.js: src/coffee/beal/firefox/content.coffee $(JS_OPTIONS_DEPS)
	$(coffee)

build/firefox-release/data/js/options.js: src/coffee/beal/firefox/content.coffee $(JS_OPTIONS_DEPS)
	$(coffee_release)

build/firefox/data/js/help.js: $(JS_HELP_DEPS)
	$(coffee)

build/firefox-release/data/js/help.js: $(JS_HELP_DEPS)
	$(coffee_release)

build/%/data/vendor: src/vendor build/%/data
	$(copy)

build/%/icon.png: src/img/logo.svg
	convert -background none $< -resize 48 $@

build/%/icon64.png: src/img/logo.svg
	convert -background none $< -resize 64 $@

# main

firefox: common build/firefox $(addprefix build/firefox/, icon.png icon64.png lib lib/bootstrap.js package.json $(MDs) data $(addprefix data/, js css $(JSs) $(HTMLs) $(CSSs) vendor img $(addprefix img/, anomalies logo $(addprefix logo/, ingress.png 16.png 32.png 64.png))))

firefox-release: common build/firefox-release $(addprefix build/firefox-release/, icon.png icon64.png lib lib/bootstrap.js package.json $(MDs) data $(addprefix data/, js css $(JSs) $(HTMLs) $(CSSs) vendor img $(addprefix img/, anomalies logo $(addprefix logo/, ingress.png 16.png 32.png 64.png))))

firefox-all: firefox firefox-release

firefox-dist: firefox-release
	@bin/dist/firefox

# testing and building XPI

tools/firefox-sdk: tools
	@if [ -d $@ ]; then cd $@ && git pull; else git clone -b release git://github.com/mozilla/addon-sdk.git $@; fi

tools/firefox-test-profile: tools
	@$(mkdir)
