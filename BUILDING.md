# Building IngressIdentity

Building is easy, simply run `make all` or `make all-release` to build. Before building,
you'll need to install the dependencies though! Run

```
npm install
```

to install most of them and look below for more information.

Don't forget to install the dependencies first though!

## Three build types

### `chroe`

This build type compiles all code but doesn't minify it. Code maps are generated,
making debugging in the browser easy as pie (provided the browser supports `.map` files).

### `chrome-release`

This build type compiles and minifies (TODO) all code. No code maps are generated. The resulted
code is the exact code that will be released, allowing you to test this code before
actually releasing it.

### `chrome-dist`

This build type will fail if it has already been built for the current extension version.
This command is normally not used directly, but is executed as part of `bin/release`. It builds
`browser-release` and creates the extension in the format that will be released.

## Dependencies

### make

Make is required to run the `Makefile`.

### git

Git is required, though you should already have this as you succeeded in downloading the source.

### clang

The Clang compiler is required to compile the small program used to create the logo
for the export button.

### Imagemagick

The `convert` tool is used to create all the logo png files from `src/img/log.svg`.

### Rollup, TypeScript

Rollup and TypeScript are used to compile the TypeScript code into JavaScript.
This dependency is installed when you run `npm install`.

### lessc

The less compiler is required to compile all LESS files to CSS. This dependency
is installed when you run `npm install`.

### cson2json

The cson2json program is needed to compile the CSON files into JSON. This
dependency is installed when you run `npm install`.

### bower

We use bower to update the vendor libraries (except jquery-ui and sugar). Install
it using `npm install -g bower` and run it using `make vendor-update`. Please ensure
that the `bower` program is in the `$PATH`.

### uglifyjs

We use uglifyjs to minify the source before distribution. This dependency is installed
when you run `npm install`.

### jade

Instead of writing HTML, we use the Jade templating engine. This dependency is installed
when you run `npm install`.