MDs = README.md LICENSE.md NOTICE.md SOURCE.md

JSs = js/content.js js/options.js js/help.js js/background.js js/export.js js/search.js
CSSs = css/content.css css/options.css css/help.css css/export.css css/search.css
HTMLs = options.html background.html export.html search.html
DOCs = $(addprefix docs/,$(addsuffix .html,index options tools files sources manifests export compatibility))
LIBs = $(addprefix vendor/,css/bootstrap.min.css $(addprefix fonts/glyphicons-halflings-regular.,eot svg ttf woff) js/jquery.min.js js/jquery-ui.min.js js/sugar.min.js js/bootstrap.min.js)

JS_CONTENT_DEPS = $(addprefix src/coffee/,$(addsuffix .coffee,communication log $(addprefix content/,doOnce main mentions profile source popup export i18n)))
JS_CONTENT_TALK_DEPS = $(addprefix src/coffee/,$(addsuffix .coffee,communication log $(addprefix content/,doOnce mentions main-talk)))
JS_OPTIONS_DEPS = $(addprefix src/coffee/,$(addsuffix .coffee,communication log auto-translate $(addprefix options/,alerts communication main manifests settings)))
JS_BACKGROUND_DEPS = $(addprefix src/coffee/,$(addsuffix .coffee,log $(addprefix data/,spreadsheets interpreter merger finder data) background/i18n background))
JS_HELP_DEPS = src/coffee/help.coffee
JS_EXPORT_DEPS = $(addprefix src/coffee/,$(addsuffix .coffee,communication log export auto-translate))
JS_SEARCH_DEPS = $(addprefix src/coffee/,$(addsuffix .coffee,communication log search auto-translate))

LANGUAGES=en nl

FILES= $(MDs) $(JSs) $(CSSs) $(HTMLs) $(DOCs) $(LIBs)

define ensure_exists
@mkdir -p $(dir $@)
endef

define copy
@mkdir -p $(dir $@)
@echo "Copying $<"
@rm -fr $@
@cp -R $< $@
endef

define less
@mkdir -p $(dir $@)
lessc $< $@
endef

define less_release
@mkdir -p $(dir $@)
lessc -x $< $@
endef

define coffee
@mkdir -p $(dir $@)
@bin/coffee $@ $^
endef

define coffee_release
@mkdir -p $(dir $@)
@bin/coffee --minify $@ src/coffee/release-header.coffee $^
endef

define jade
@mkdir -p $(dir $@)
jade -P -o $(dir $@) -O $< $(word 2,$^)
endef

define jade_release
@mkdir -p $(dir $@)
jade -o $(dir $@) -O $< $(word 2,$^)
endef

define mkdir
mkdir -p $@
@touch $@
endef

define cson
@mkdir -p $(dir $@)
cson2json $< > $@
endef

.PHONY: all all-release release vendor-update init dist default clean touch common common-release chrome chrome-release chrome-all chrome-dist safari safari-release safari-all safari-dist firefox firefox-release firefox-all firefox-dist

# Main entrypoints
#

default: all

all: chrome safari firefox

release: all-release
all-release: chrome-release safari-release firefox-release

dist: chrome-dist safari-dist firefox-dist

clean:
	rm -rf build

touch:
	find src template -type f -print0 | xargs -0 touch

# Tools
#

tools: ; $(mkdir)

tools/gray2transparent:
	@if [ ! -d tools ]; then make tools fi
	@if [ -d $@ ]; then cd $@ && git pull; else git clone https://gist.github.com/635bca8e2a3d47bf6a5f.git $@; fi

tools/gray2transparent/gray2transparent: tools/gray2transparent $(addprefix tools/gray2transparent/, gray2transparent.cpp exr_io.h exr_io.cpp)
	@$(MAKE) -C $< gray2transparent

# vendor libraries

tools/bower:
	$(mkdir)

tools/bower/bower.json: bin/vendor
	@bin/vendor init

tools/Sugar:
	@cd tools && git clone git@github.com:andrewplummer/Sugar.git

vendor-update: tools/bower/bower.json tools/Sugar
	@bin/vendor update

# Common targets
#

# helpers

build/%/README.md: README.md
	$(copy)

build/%/LICENSE.md: LICENSE.md
	$(copy)

build/%/NOTICE.md: NOTICE.md
	$(copy)

build/%/SOURCE.md: SOURCE.md
	$(copy)

build/common-release/css/content.css: src/less/content.less src/less/variables.less src/less/general.less
	$(less_release)

build/common-release/css/%.css: src/less/%.less src/less/variables.less src/less/general.less src/less/general_background.less
	$(less_release)

build/common/css/content.css: src/less/content.less src/less/variables.less src/less/general.less
	$(less)

build/common/css/%.css: src/less/%.less src/less/variables.less src/less/general.less src/less/general_background.less
	$(less)

build/%/img/logo/ingress.png: src/img/logo.svg
	$(ensure_exists)
	convert -background none $< $@

build/%/img/logo/16.png: src/img/logo.svg
	$(ensure_exists)
	convert -background none $< -resize 16 $@

build/%/img/logo/48.png: src/img/logo.svg
	$(ensure_exists)
	convert -background none $< -resize 48 $@

build/%/img/logo/128.png: src/img/logo.svg
	$(ensure_exists)
	convert -background none $< -resize 128 $@

build/%/img/anomalies: src/img/anomalies
	$(copy)
	@rm $@/README.md

build/common/i18n/%.json: src/i18n/%.cson
	$(ensure_exists)
	$(cson)

build/common-release/i18n/%.json: src/i18n/%.cson
	$(ensure_exists)
	$(cson)

build/%/img/g+.png: src/img/g+.png
	$(copy)

# main

common: $(addprefix build/common/,$(CSSs) $(addprefix i18n/,$(addsuffix .json,$(LANGUAGES))))
common-release: $(addprefix build/common-release/,$(CSSs) $(addprefix i18n/,$(addsuffix .json,$(LANGUAGES))))

# Chrome targets
#

# helpers

build/%/manifest.json: template/%/manifest.json
	$(copy)

build/%/img/logo/19.png: src/img/logo.svg
	$(ensure_exists)
	convert -background none $< -resize 19 $@

build/%/img/logo/38.png: src/img/logo.svg
	$(ensure_exists)
	convert -background none $< -resize 38 $@

build/chrome/js/content.js: src/coffee/beal/chrome/content.coffee $(JS_CONTENT_DEPS)
	$(coffee)

build/chrome-release/js/content.js: src/coffee/beal/chrome/content.coffee $(JS_CONTENT_DEPS)
	$(coffee_release)

build/chrome/js/content-talk.js: src/coffee/beal/chrome/content.coffee $(JS_CONTENT_TALK_DEPS)
	$(coffee)

build/chrome-release/js/content-talk.js: src/coffee/beal/chrome/content.coffee $(JS_CONTENT_TALK_DEPS)
	$(coffee_release)

build/chrome/js/background.js: src/coffee/beal/chrome/background.coffee $(JS_BACKGROUND_DEPS)
	$(coffee)

build/chrome-release/js/background.js: src/coffee/beal/chrome/background.coffee $(JS_BACKGROUND_DEPS)
	$(coffee_release)

build/chrome/js/options.js: src/coffee/beal/chrome/content.coffee $(JS_OPTIONS_DEPS)
	$(coffee)

build/chrome-release/js/options.js: src/coffee/beal/chrome/content.coffee $(JS_OPTIONS_DEPS)
	$(coffee_release)

build/chrome/js/export.js: src/coffee/beal/chrome/content.coffee $(JS_EXPORT_DEPS)
	$(coffee)

build/chrome-release/js/export.js: src/coffee/beal/chrome/content.coffee $(JS_EXPORT_DEPS)
	$(coffee_release)

build/chrome/js/search.js: src/coffee/beal/chrome/content.coffee $(JS_SEARCH_DEPS)
	$(coffee)

build/chrome-release/js/search.js: src/coffee/beal/chrome/content.coffee $(JS_SEARCH_DEPS)
	$(coffee_release)

build/chrome/js/help.js: $(JS_HELP_DEPS)
	$(coffee)

build/chrome-release/js/help.js: $(JS_HELP_DEPS)
	$(coffee_release)

build/chrome/css/%: build/common/css/%
	$(copy)

build/chrome-release/css/%: build/common-release/css/%
	$(copy)

build/chrome/_locales/%/messages.json: build/common/i18n/%.json
	$(copy)

build/chrome-release/_locales/%/messages.json: build/common-release/i18n/%.json
	$(copy)

build/chrome/vendor/%: src/vendor/%
	$(copy)

build/chrome-release/vendor/%: src/vendor/%
	$(copy)

build/chrome/%.html: src/jade/_config/chrome.json src/jade/%.jade src/jade/_mixins.jade
	$(jade)

build/chrome-release/%.html: src/jade/_config/chrome.json src/jade/%.jade src/jade/_mixins.jade
	$(jade_release)

build/chrome/docs/%.html: src/jade/_config/chrome.json src/jade/docs/export.jade src/jade/docs/_mixins.jade src/jade/docs/_layout.jade
	$(jade)

build/chrome-release/docs/%.html: src/jade/docs/export.jade src/jade/docs/_mixins.jade src/jade/docs/_layout.jade
	$(jade_release)

# main

chrome: $(addprefix build/chrome/, $(FILES) js/content-talk.js manifest.json $(addprefix _locales/,$(addsuffix /messages.json,$(LANGUAGES))) img/anomalies img/g+.png $(addprefix img/logo/, ingress.png 16.png 19.png 38.png 48.png 128.png))

chrome-release: $(addprefix build/chrome-release/, $(FILES) js/content-talk.js manifest.json $(addprefix _locales/,$(addsuffix /messages.json,$(LANGUAGES))) img/anomalies img/g+.png $(addprefix img/logo/, ingress.png 16.png 19.png 38.png 48.png 128.png))

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

build/IngressIdentity.safariextension/js/export.js: src/coffee/beal/safari/content.coffee $(JS_EXPORT_DEPS)
	$(coffee)

build/IngressIdentity-release.safariextension/js/export.js: src/coffee/beal/safari/content.coffee $(JS_EXPORT_DEPS)
	$(coffee_release)

build/IngressIdentity.safariextension/js/search.js: src/coffee/beal/safari/content.coffee $(JS_SEARCH_DEPS)
	$(coffee)

build/IngressIdentity-release.safariextension/js/search.js: src/coffee/beal/safari/content.coffee $(JS_SEARCH_DEPS)
	$(coffee_release)

build/IngressIdentity.safariextension/js/help.js: $(JS_HELP_DEPS)
	$(coffee)

build/IngressIdentity-release.safariextension/js/help.js: $(JS_HELP_DEPS)
	$(coffee_release)

build/IngressIdentity.safariextension/css/%: build/common/css/%
	$(copy)

build/IngressIdentity-release.safariextension/css/%: build/common-release/css/%
	$(copy)

build/IngressIdentity.safariextension/_locales/%/messages.json: build/common/i18n/%.json
	$(copy)

build/IngressIdentity-release.safariextension/_locales/%/messages.json: build/common-release/i18n/%.json
	$(copy)

build/IngressIdentity.safariextension/vendor/%: src/vendor/%
	$(copy)

build/IngressIdentity-release.safariextension/vendor/%: src/vendor/%
	$(copy)

build/%.safariextension/img/logo/toolbar.png: src/img/logo.svg tools/gray2transparent/gray2transparent
	$(ensure_exists)
	convert -background none $< -resize 48 tmp.exr
	tools/gray2transparent/gray2transparent tmp.exr tmp2.exr
	convert tmp2.exr $@
	rm tmp.exr tmp2.exr

build/IngressIdentity.safariextension/%.html: src/jade/_config/safari.json src/jade/%.jade src/jade/_mixins.jade
	$(jade)

build/IngressIdentity-release.safariextension/%.html: src/jade/_config/safari.json src/jade/%.jade src/jade/_mixins.jade
	$(jade_release)

build/IngressIdentity.safariextension/docs/%.html: src/jade/_config/safari.json src/jade/docs/export.jade src/jade/docs/_mixins.jade src/jade/docs/_layout.jade
	$(jade)

build/IngressIdentity-release.safariextension/docs/%.html: src/jade/_config/safari.json src/jade/docs/export.jade src/jade/docs/_mixins.jade src/jade/docs/_layout.jade
	$(jade_release)

# main

safari: $(addprefix build/IngressIdentity.safariextension/, $(FILES) Info.plist img/anomalies img/g+.png img/logo/toolbar.png img/logo/ingress.png $(addprefix _locales/,$(addsuffix /messages.json,$(LANGUAGES))))

safari-release: $(addprefix build/IngressIdentity-release.safariextension/, $(FILES) Info.plist img/anomalies img/g+.png img/logo/toolbar.png img/logo/ingress.png $(addprefix _locales/,$(addsuffix /messages.json,$(LANGUAGES))))

safari-all: safari safari-release

safari-dist: safari-release
	@bin/dist/safari

# Firefox targets
#

# helpers

build/%/data/img/anomalies: src/img/anomalies
	$(copy)

build/%/data/img/logo/ingress.png: src/img/logo.svg
	$(ensure_exists)
	convert -background none $< $@

build/%/data/img/logo/16.png: src/img/logo.svg
	$(ensure_exists)
	convert -background none $< -resize 16 $@

build/%/data/img/logo/32.png: src/img/logo.svg
	$(ensure_exists)
	convert -background none $< -resize 32 $@

build/%/data/img/logo/64.png: src/img/logo.svg
	$(ensure_exists)
	convert -background none $< -resize 64 $@

build/firefox/data/css/%: build/common/css/%
	$(copy)

build/firefox-release/data/css/%: build/common-release/css/%
	$(copy)

build/firefox/%.md: %.md
	$(copy)

build/firefox-release/data/%.md: %.md
	$(copy)

build/%/package.json: template/%/package.json
	$(copy)

build/firefox/lib/bootstrap.js: template/firefox/lib/bootstrap.coffee
	$(coffee)

build/firefox-release/lib/bootstrap.js: template/firefox-release/lib/bootstrap.coffee
	$(coffee_release)

build/firefox/lib/resources.js: template/firefox/lib/resources.js
	$(copy)

build/firefox-release/lib/resources.js: template/firefox-release/lib/resources.js
	$(copy)

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

build/firefox/data/js/export.js: src/coffee/beal/firefox/content.coffee $(JS_EXPORT_DEPS)
	$(coffee)

build/firefox-release/data/js/export.js: src/coffee/beal/firefox/content.coffee $(JS_EXPORT_DEPS)
	$(coffee_release)

build/firefox/data/js/search.js: src/coffee/beal/firefox/content.coffee $(JS_SEARCH_DEPS)
	$(coffee)

build/firefox-release/data/js/search.js: src/coffee/beal/firefox/content.coffee $(JS_SEARCH_DEPS)
	$(coffee_release)

build/firefox/data/js/help.js: $(JS_HELP_DEPS)
	$(coffee)

build/firefox-release/data/js/help.js: $(JS_HELP_DEPS)
	$(coffee_release)

build/%/data/vendor/js/jquery-ui.min.js: template/%/data/vendor/js/jquery-ui.min.js
	$(copy)

build/firefox/data/vendor/%: src/vendor/%
	$(copy)

build/firefox-release/data/vendor/%: src/vendor/%
	$(copy)

build/%/data/vendor/css: src/vendor/css
	$(copy)

build/firefox/data/vendor/js/%: src/vendor/js/%
	$(copy)

build/firefox-release/data/vendor/js/%: src/vendor/js/%
	$(copy)

build/%/icon.png: src/img/logo.svg
	$(ensure_exists)
	convert -background none $< -resize 48 $@

build/%/icon64.png: src/img/logo.svg
	$(ensure_exists)
	convert -background none $< -resize 64 $@

build/firefox/data/_locales/%/messages.json: build/common/i18n/%.json
	$(copy)

build/firefox-release/data/_locales/%/messages.json: build/common-release/i18n/%.json
	$(copy)

build/firefox/data/%.html: src/jade/_config/firefox.json src/jade/%.jade src/jade/_mixins.jade
	$(jade)

build/firefox-release/data/%.html: src/jade/_config/firefox.json src/jade/%.jade src/jade/_mixins.jade
	$(jade_release)

build/firefox/data/docs/%.html: src/jade/_config/firefox.json src/jade/docs/export.jade src/jade/docs/_mixins.jade src/jade/docs/_layout.jade
	$(jade)

build/firefox-release/data/docs/%.html: src/jade/_config/firefox.json src/jade/docs/export.jade src/jade/docs/_mixins.jade src/jade/docs/_layout.jade
	$(jade_release)

build/%/data/img/g+.png: src/img/g+.png
	$(copy)

# main

firefox: $(addprefix build/firefox/, icon.png icon64.png lib/bootstrap.js lib/resources.js package.json $(MDs) $(addprefix data/, $(JSs) $(HTMLs) $(CSSs) $(DOCs) $(LIBs) $(addprefix _locales/,$(addsuffix /messages.json,$(LANGUAGES))) $(addprefix img/,anomalies g+.png $(addprefix logo/, ingress.png 16.png 32.png 64.png))))

firefox-release: $(addprefix build/firefox-release/, icon.png icon64.png lib/bootstrap.js lib/resources.js package.json $(MDs) $(addprefix data/, $(JSs) $(HTMLs) $(CSSs) $(DOCs) $(LIBs) $(addprefix _locales/,$(addsuffix /messages.json,$(LANGUAGES))) $(addprefix img/, anomalies g+.png $(addprefix logo/, ingress.png 16.png 32.png 64.png))))

firefox-all: firefox firefox-release

firefox-dist: firefox-release
	@bin/dist/firefox

# testing and building XPI

tools/firefox-sdk: tools
	@if [ -d $@ ]; then cd $@ && git pull || true; else git clone -b release git://github.com/mozilla/addon-sdk.git $@; fi

tools/firefox-test-profile: tools
	@$(mkdir)
