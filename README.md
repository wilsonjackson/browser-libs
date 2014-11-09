# browser-libs [![Build Status](https://travis-ci.org/wilsonjackson/browser-libs.svg?branch=master)](https://travis-ci.org/wilsonjackson/browser-libs)

> Find and fine-tune your client-side library dependencies

This helper utility aims to provide some interoperability between a wholly
node-and-npm-based build and less-than-fully-nodified client-side libraries.

This is (hopefully) a stop-gap on the road to better native support for
client-side libraries in npm.

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

### var styles = blibs.style([ opts ])

Resolve all client-side libraries and return a sorted array of fully-qualified paths to `style` files.
This method requires that libraries utilize the `style` field in their `package.json`, or you will
have to manually specify the stylesheet in `browser-overrides`.

Options:

- `env`: Resolve overrides for a named environment. See details [below](#environment-support).

## Features

### Recursive dependency resolution

All dependencies for your libraries will be flattened in the returned array
and sorted in the correct load order.

_Note:_ If two libraries depend on different versions of the same library, the
version mismatch will be ignored and one will be arbitrarily selected.

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

## browser-overrides spec

#### browser-overrides: `object`

The `browser-overrides` key in `package.json` is an object with module names as
keys. Its presence is optional.

#### browser-overrides.<em>MODULE_NAME</em>: `object | string | false`

If a string, overrides the path to the module's `main` file. If false, excludes
the module (and its dependencies) from the returned array of libraries.

#### browser-overrides.<em>MODULE_NAME</em>.main: `string | false`

If a string, overrides the path to the module's `main` file. If false, excludes
just the module's `main` file (without affecting `style`).

#### browser-overrides.<em>MODULE_NAME</em>.style: `string | false`

If a string, overrides the path to the module's `style` file. If false, excludes
just the module's `style` file (without affecting `main`).

#### browser-overrides.<em>MODULE_NAME</em>.env: `object`

A map of environment names to environment-specific override configuration.

If an environment is activated, and a key for that environment is present in
this object, any configuration within it will be used.

#### browser-overrides.<em>MODULE_NAME</em>.env.<em>ENV_NAME</em>: `object | string | false`

If a string, overrides the path to the module's `main` file. If false, excludes
the module (and its dependencies) from the returned array of libraries.

#### browser-overrides.<em>MODULE_NAME</em>.env.<em>ENV_NAME</em>.main: `string | false`

If a string, overrides the path to the module's `main` file. If false, excludes
just the module's `main` file (without affecting `style`).

#### browser-overrides.<em>MODULE_NAME</em>.env.<em>ENV_NAME</em>.style: `string | false`

If a string, overrides the path to the module's `style` file. If false, excludes
just the module's `style` file (without affecting `main`).

## Limitations

This was built primarily to solve my own use case, so there are many things it
won't do. Please create an issue for any desired functionality. Pull requests
are welcome.
