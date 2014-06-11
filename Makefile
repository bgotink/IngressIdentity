MDs = README.md LICENSE.md NOTICE.md
JSs = js/content.js js/options.js js/help.js js/background.js
CSSs = css/content.css css/options.css css/help.css
HTMLs = options.html background.html help.html

JS_CONTENT_DEPS = src/coffee/communication.coffee src/coffee/log.coffee src/coffee/content/doOnce.coffee src/coffee/content/main.coffee src/coffee/content/mentions.coffee src/coffee/content/profile.coffee src/coffee/content/source.coffee
JS_OPTIONS_DEPS = src/coffee/communication.coffee src/coffee/log.coffee src/coffee/options.coffee
JS_BACKGROUND_DEPS = src/coffee/log.coffee src/coffee/data/spreadsheets.coffee src/coffee/data/interpreter.coffee src/coffee/data/merger.coffee src/coffee/data/data.coffee src/coffee/background.coffee
JS_HELP_DEPS = src/coffee/help.coffee

FILES= $(MDs) $(JSs) $(CSSs) $(HTMLs) img vendor

define copy
@echo "Copying $<"
@cp -aR $< $@
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

.PHONY: all all-release init dist default clean common common-release chrome chrome-release chrome-all safari safari-release safari-all

# Main entrypoints
#

default: all

all: chrome safari

release: all-release
all-release: chrome-release safari-release

dist: all-release
	@bin/dist

clean:
	rm -rf build

# Tools
#

tools: ; $(mkdir)

tools/gray2transparent: tools
	@git clone https://gist.github.com/635bca8e2a3d47bf6a5f.git $@

tools/gray2transparent/gray2transparent: tools/gray2transparent
	@$(MAKE) -C $<

# Common targets
#

# helpers

build/common: build/common/css

build/common-release: build/common-release/css

build/%/vendor: src/vendor
	rm -rf $@
	$(copy)
	rm -rf $@/{css/bootstrap{-theme*,.css*},js/bootstrap.js,js/class.js}

build/%/img: src/img
	rm -rf $@
	$(copy)
	rm $@/*/README.md $@/logo/ingress.svg

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

chrome: common build/chrome $(addprefix build/chrome/, $(FILES)) build/chrome/manifest.json;

chrome-release: common-release build/chrome-release $(addprefix build/chrome-release/, $(FILES)) build/chrome-release/manifest.json;

chrome-all: chrome chrome-release

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

build/%.safariextension/img/toolbar-logo.png: src/img/logo/48.png tools/gray2transparent/gray2transparent
	convert $< tmp.exr
	tools/gray2transparent/gray2transparent tmp.exr tmp2.exr
	convert tmp2.exr $@
	rm tmp.exr tmp2.exr

# main

safari: common build/IngressIdentity.safariextension $(addprefix build/IngressIdentity.safariextension/, $(FILES)) build/IngressIdentity.safariextension/Info.plist build/IngressIdentity.safariextension/img/toolbar-logo.png;

safari-release: common-release build/IngressIdentity-release.safariextension $(addprefix build/IngressIdentity-release.safariextension/, $(FILES)) build/IngressIdentity-release.safariextension/Info.plist build/IngressIdentity-release.safariextension/img/toolbar-logo.png;

safari-all: safari safari-release
