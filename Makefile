MDs = README.md LICENSE.md NOTICE.md SOURCE.md

JSs = js/content.js js/options.js js/help.js js/background.js js/export.js js/export-single.js js/search.js
CSSs = css/content.css css/options.css css/help.css css/export.css css/search.css
HTMLs = options.html background.html export.html export-single.html search.html
DOCs = $(addprefix docs/,$(addsuffix .html,index options tools files sources manifests export compatibility))
LIBs = $(addprefix vendor/,css/bootstrap.min.css $(addprefix fonts/glyphicons-halflings-regular.,eot svg ttf woff) js/jquery.min.js js/jquery-ui.min.js js/sugar.min.js js/bootstrap.min.js)

JS_CONTENT_DEPS = $(addprefix src/js/,$(addsuffix .ts,content/main communication log $(addprefix content/,doOnce mentions profile source popup export i18n)))
JS_CONTENT_TALK_DEPS = $(addprefix src/js/,$(addsuffix .ts,content/main-talk communication log $(addprefix content/,doOnce mentions)))
JS_OPTIONS_DEPS = $(addprefix src/js/,$(addsuffix .ts,options/main communication log auto-translate $(addprefix options/,alerts authorization communication manifests settings)))
JS_BACKGROUND_DEPS = $(addprefix src/js/,$(addsuffix .ts,background log $(addprefix data/,token util spreadsheets interpreter merger finder data) $(addprefix background/,i18n cache)))
JS_HELP_DEPS = src/js/help.ts
JS_EXPORT_DEPS = $(addprefix src/js/,$(addsuffix .ts,export communication log auto-translate))
JS_EXPORT_SINGLE_DEPS = $(addprefix src/js/, $(addsuffix .ts,export-single communication log auto-translate))
JS_SEARCH_DEPS = $(addprefix src/js/,$(addsuffix .ts,search communication log auto-translate))

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
node_modules/.bin/lessc $< $@
endef

define less_release
@mkdir -p $(dir $@)
node_modules/.bin/lessc -x $< $@
endef

define rollup
@echo "Making $@"
@mkdir -p $(dir $@)
@node_modules/.bin/rollup -c rollup.dev.config.js -i $< > $@
endef

define rollup_release
@echo "Making $@"
@mkdir -p $(dir $@)
@node_modules/.bin/rollup -c rollup.release.config.js -i $< > $@
endef

define jade
@mkdir -p $(dir $@)
node_modules/.bin/jade -P -o $(dir $@) -O $< $(word 2,$^)
endef

define jade_release
@mkdir -p $(dir $@)
node_modules/.bin/jade -o $(dir $@) -O $< $(word 2,$^)
endef

define mkdir
mkdir -p $@
@touch $@
endef

define cson
@mkdir -p $(dir $@)
node_modules/.bin/cson2json $< > $@
endef

.PHONY: all all-release release vendor-update init dist default clean touch common common-release chrome chrome-release chrome-all chrome-dist

# Main entrypoints
#

default: all

all: chrome

release: all-release
all-release: chrome-release

dist: chrome-dist

clean:
	rm -rf build

touch:
	find src template -type f -print0 | xargs -0 touch

# Tools
#

tools: ; $(mkdir)

tools/gray2transparent:
	@if [ ! -d tools ]; then make tools; fi
	@if [ -d $@ ]; then cd $@ && git pull; else git clone https://gist.github.com/635bca8e2a3d47bf6a5f.git $@; fi

tools/gray2transparent/gray2transparent: tools/gray2transparent $(addprefix tools/gray2transparent/, gray2transparent.cpp exr_io.h exr_io.cpp)
	@$(MAKE) -C $< gray2transparent

tools/gray2white:
	@if [ ! -d tools ]; then make tools; fi
	@if [ -d $@ ]; then cd $@ && git pull; else git clone https://gist.github.com/b5add351a2baa6fb90f8.git $@; fi

tools/gray2white/gray2white: tools/gray2white $(addprefix tools/gray2white/, gray2white.cpp exr_io.h exr_io.cpp)
	@$(MAKE) -C $< gray2white

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

build/%/img/logo/profile-badge.png: src/img/logo.svg tools/gray2white/gray2white
	$(ensure_exists)
	convert -background none $< -resize 72 tmp.exr
	tools/gray2white/gray2white tmp.exr tmp2.exr
	convert tmp2.exr $@
	rm tmp.exr tmp2.exr

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

build/chrome/js/content.js: $(JS_CONTENT_DEPS)
	$(rollup)

build/chrome-release/js/content.js: $(JS_CONTENT_DEPS)
	$(rollup_release)

build/chrome/js/content-talk.js: $(JS_CONTENT_TALK_DEPS)
	$(rollup)

build/chrome-release/js/content-talk.js: $(JS_CONTENT_TALK_DEPS)
	$(rollup_release)

build/chrome/js/background.js: $(JS_BACKGROUND_DEPS)
	$(rollup)

build/chrome-release/js/background.js: $(JS_BACKGROUND_DEPS)
	$(rollup_release)

build/chrome/js/options.js: $(JS_OPTIONS_DEPS)
	$(rollup)

build/chrome-release/js/options.js: $(JS_OPTIONS_DEPS)
	$(rollup_release)

build/chrome/js/export.js: $(JS_EXPORT_DEPS)
	$(rollup)

build/chrome-release/js/export.js: $(JS_EXPORT_DEPS)
	$(rollup_release)

build/chrome/js/export-single.js: $(JS_EXPORT_SINGLE_DEPS)
	$(rollup)

build/chrome-release/js/export-single.js: $(JS_EXPORT_SINGLE_DEPS)
	$(rollup_release)

build/chrome/js/search.js: $(JS_SEARCH_DEPS)
	$(rollup)

build/chrome-release/js/search.js: $(JS_SEARCH_DEPS)
	$(rollup_release)

build/chrome/js/help.js: $(JS_HELP_DEPS)
	$(rollup)

build/chrome-release/js/help.js: $(JS_HELP_DEPS)
	$(rollup_release)

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

chrome: $(addprefix build/chrome/, $(FILES) js/content-talk.js manifest.json $(addprefix _locales/,$(addsuffix /messages.json,$(LANGUAGES))) img/anomalies img/g+.png $(addprefix img/logo/, ingress.png 16.png 19.png 38.png 48.png 128.png profile-badge.png))

chrome-release: $(addprefix build/chrome-release/, $(FILES) js/content-talk.js manifest.json $(addprefix _locales/,$(addsuffix /messages.json,$(LANGUAGES))) img/anomalies img/g+.png $(addprefix img/logo/, ingress.png 16.png 19.png 38.png 48.png 128.png profile-badge.png))

chrome-all: chrome chrome-release

chrome-dist: chrome-release
	@bin/dist/chrome