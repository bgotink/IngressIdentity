# Building IngressIdentity

Building is easy, simply run `make all` or `make all-release` to build for all browsers.
If you want to build for a specific browser, run `make <browser>` or `make <browser>-release`,
e.g. `make chrome` or `make safari-release`.

Don't forget to install the dependencies first though!

## Three build types

There are three build types: `browser`, `browser-release` and `browser-dist`,
where `browser` should be replaced with one of the supported browsers.

### `browser`

This build type compiles all code but doesn't minify it. Code maps are generated,
making debugging in the browser easy as pie (provided the browser supports `.map` files).

### `browser-release`

This build type compiles and minifies all code. No code maps are generated. The resulted
code is the exact code that will be released, allowing you to test this code before
actually releasing it.

### `browser-dist`

This build type will fail if it has already been built for the current extension version.
This command is normally not used directly, but is executed as part of `bin/release`. It builds
`browser-release` and creates the extension in the format that will be released.

Note that safari doesn't support building from the command line, so this command will simply
generate a message telling you to open the Extension Builder and build the extension there.

## Dependencies

### make

Make is required to run the `Makefile`.

### git

Git is required to build because the building process will clone the firefox
SDK as well as a small program to create the extension logo for safari.

### clang

The Clang compiler is required to compile the small program used to create the
extension logo for safari.

### Imagemagick

The `convert` tool is used to create all the logo png files from `src/img/log.svg`.

### coffee

The coffeescript compiler is needed to compile all coffeescript to javascript.
Simply run `npm install -g coffee-script` to install it.
Please ensure that the `coffee` program is in the `$PATH`.

### lessc

The less compiler is required to compile all LESS files to CSS. You can install
it using `npm install -g less`. Please ensure that the `lessc` program is in the `$PATH`.

### cson2json

The cson2json program is needed to compile the CSON files into JSON. Install it
by running `npm install -g cson`.

### bower

We use bower to update the vendor libraries (except jquery-ui and sugar). Install
it using `npm install -g bower` and run it using `make vendor-update`.
