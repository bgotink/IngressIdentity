MDs = build/README.md build/LICENSE.md build/NOTICE.md
JSs = build/js/content.js build/js/options.js build/js/background.js build/js/help.js
CSSs = build/css/content.css build/css/options.css build/css/help.css
HTMLs = build/options.html build/background.html build/help.html

default: all

all: init $(HTMLs) $(JSs) $(CSSs) $(MDs) build/img build/vendor build/manifest.json
	@find build -iname '.*' -print0 | xargs -0 rm

dist: all
	@bin/dist

clean:
	rm -rf build

init:
	@mkdir -p build build/js build/css

build/vendor: vendor
	rm -rf $@
	cp -a $< $@
	rm -rf $@/{css/bootstrap{-theme*,.css*},js/bootstrap.js,js/class.js}

build/img: img
	rm -rf $@
	cp -a $< $@
	rm $@/*/README.md $@/logo/ingress.svg

build/manifest.json: manifest.json.dist
	cp $< $@

build/%.md: %.md
	cp $< $@

build/%.html: %.html
	grep -Ev '<script type="text\/javascript" src="js\/(log|communication|data\/(data|interpreter|merger|spreadsheets))\.js">' $< > $@

build/css/content.css: less/content.less less/variables.less less/general.less
	lessc -x $< $@

build/css/%.css: less/%.less less/variables.less less/general.less less/general_background.less
	lessc -x $< $@

build/js/help.js: coffee/help.coffee
	@bin/minify help help

build/js/content.js: coffee/content.coffee coffee/communication.coffee coffee/log.coffee
	@bin/minify content communication log content

build/js/options.js: coffee/options.coffee coffee/communication.coffee coffee/log.coffee
	@bin/minify options communication log options

build/js/background.js: coffee/log.coffee coffee/data/spreadsheets.coffee coffee/data/interpreter.coffee coffee/data/merger.coffee coffee/data/data.coffee coffee/background.coffee
	@bin/minify background log data/spreadsheets data/interpreter data/merger data/data background
