# browser-libs [![Build Status](https://travis-ci.org/wilsonjackson/browser-libs.svg?branch=master)](https://travis-ci.org/wilsonjackson/browser-libs)

> Find and fine-tune your client-side library dependencies

More and more client-side libraries are making their distributions available on
npm, but npm hasn't quite got the client-side thing figured out yet. And many
projects don't wish to go the CommonJS route and still consider Bower their
primary distribution channel.

This helper utility aims to provide some interoperability between a wholly
node-and-npm-based build and these less-than-fully-nodified client-side
libraries.

**tl;dr** If you get your browser dependencies from npm and are frustrated by the
inability to do things like swap in minified files for production, maybe this
will help.

## Install

```
npm install --save-dev browser-libs
```

## Basic usage

```js
// package.json
{
  "dependencies": {
    "angular": "1.3.0"
  }
}
```

```js
var blibs = require('browser-libs');
var libs = blibs();
console.log(libs);
// [ '/example/project/node_modules/angular/angular.js' ]
```

## API

### var libs = blibs([ opts ])

Resolve all client-side libraries and return a sorted array of fully-qualified paths to `main` files.

Options:

- `env`: Resolve overrides for a named environment. See details [below](#environment-support).

## Features

### [Browser field](https://gist.github.com/defunctzombie/4339901) support

If a library's `package.json` makes use of the `browser` field (as used by
tools like Browserify), the resolved path will honor its configuration.

```js
// package.json
{
  "dependencies": {
    "some-lib": "1.0.0"
  }
}
```

```js
// node_modules/some-lib/package.json
{
  "browser": "dist/js/some-lib.js"
}
```

```js
var blibs = require('browser-libs');
var libs = blibs();
console.log(libs);
// [ '/example/project/node_modules/some-lib/dist/js/some-lib.js' ]
```

### Bower dependency support

If a library has a `bower.json` file, its dependencies will be read in order to
ensure files are returned in correct load order.

```js
// package.json
{
  "dependencies": {
    "depends-on-some-lib": "1.0.0",
    "some-lib": "1.0.0"
  }
}
```

```js
// node_modules/depends-on-some-lib/bower.json
{
  "dependencies": {
    "some-lib": "1.0.0"
  }
}
```

```js
var blibs = require('browser-libs');
var libs = blibs();
console.log(libs);
// [ '/example/project/node_modules/some-lib/index.js',
//   '/example/project/node_modules/depends-on-some-lib/index.js' ]
```

_Note:_
* Versions in `bower.json` are ignored. (This isn't a dependency management
  module.)
* The library's bower and npm package names must match, and all dependencies
  must be installed via npm.

### Overrides

The file to include for a library may be overridden by adding a`browser-override`
section to your `package.json`. This section is proprietary, but inspired by the
browser field and [main-bower-files' overrides](https://github.com/ck86/main-bower-files#overrides-options).

```js
// package.json
{
  "dependencies": {
    "some-lib": "1.0.0"
  },
  "browser-overrides": {
    "some-lib": "./node_modules/some-lib/overridden.js"
    // Or verbose notation:
    // "some-lib": {
    //   "main": "./node_modules/some-lib/overridden.js"
    // }
  }
}
```

```js
var blibs = require('browser-libs');
var libs = blibs();
console.log(libs);
// [ '/example/project/node_modules/some-lib/overridden.js' ]
```

### Excludes

Using the `browser-overrides` section, you may exclude a library entirely by
specifying a `false` value.

```js
// package.json
{
  "dependencies": {
    "some-lib": "1.0.0"
  },
  "browser-overrides": {
    "some-lib": false
    // Or verbose notation:
    // "some-lib": {
    //   "main": false
    // }
  }
}
```

```js
var blibs = require('browser-libs');
var libs = blibs();
console.log(libs);
// []
```

### Environment support

Environment-specific overrides may be declared in `browser-overrides` using the
`env` property. Use it to supply a map of environments to main file overrides.

Activate an environment by passing the `env` option to `bdeps`.

If no match for the passed environment is found in the `env` map, the `main`
property will be used if defined, or the library module's default otherwise. A
false value will exclude a library for only that environment.

```js
// package.json
{
  "dependencies": {
    "some-lib": "1.0.0"
  },
  "browser-overrides": {
    "some-lib": {
      "env": {
        "prod": "./node_modules/some-lib/some-lib.min.js"
      }
    }
  }
}
```

```js
var blibs = require('browser-libs');
var libs = blibs({env: 'prod'});
console.log(libs);
// [ '/example/project/node_modules/some-lib/some-lib.min.js' ]
```

### Manual dependency declarations

You may manually specify dependencies for libraries that don't declare their
own in `bower.json`.

```js
// package.json
{
  "dependencies": {
    "depends-on-some-lib": "1.0.0",
    "some-lib": "1.0.0"
  },
  "browser-overrides": {
    "depends-on-some-lib": {
      "deps": ["some-lib"]
    }
  }
}
```

```js
var blibs = require('browser-libs');
var libs = blibs();
console.log(libs);
// [ '/example/project/node_modules/some-lib/index.js',
//   '/example/project/node_modules/depends-on-some-lib/index.js' ]
```

_Note:_ Dependencies declared in this fashion will _override_ any dependencies in
the package's `bower.json`. They will not be merged together.

## Limitations

This was built primarily to solve my own use case, so there are many things it
won't do, like resolve dependencies of libraries recursively.

If you think this (or any other feature) would be useful, please create an
issue.
