'use strict';

var fs = require('fs');
var path = require('path');
var expect = require('chai').expect;

describe('browser-libs', function () {
	var fixture;

	beforeEach(cleanFixture);
	beforeEach(clearCache);
	beforeEach(function () {
		fixture = require('./fixture');
	});
	afterEach(cleanFixture);

	function cleanFixture() {
		try {
			fs.unlinkSync(path.join(__dirname, 'fixture/package.json'));
		}
		catch (e) {}
	}

	function clearCache() {
		// Force clear the cached package.json of the fixture package
		delete require.cache[path.resolve(__dirname, 'fixture/package.json')];
	}

	// Having to manipulate the filesystem like this is not ideal, but I'm not aware of any other way to fake different
	// package.json files without fully duplicating the fixtures dir.
	function activateFixture(name) {
		fs.writeFileSync(
			path.join(__dirname, 'fixture/package.json'),
			fs.readFileSync(path.join(__dirname, 'fixture/package-' + name + '.json')));
	}

	// Need a fs mock for this
	//it('should throw if package.json can\'t be loaded', function () {
	//	expect(fixture).to.throw();
	//});

	describe('main file', function () {
		function runFixture(name, options) {
			activateFixture(name);
			return fixture(options);
		}

		it('should resolve implicit module entry points', function () {
			var libraries = runFixture('simple');
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/index.js')
			]);
		});

		it('should work when invoked from a sub-directory of the calling module', function () {
			activateFixture('simple');
			var libraries = require('./fixture/subdir/subdir')();
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/index.js')
			]);
		});

		it('should resolve explicit module entry points', function () {
			var libraries = runFixture('explicit-main');
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/explicit-main/not-index.js')
			]);
		});

		it('should resolve browser-specific module entry points', function () {
			var libraries = runFixture('browser');
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/browser/browser.js')
			]);
		});

		it('should resolve overridden module entry points (short notation)', function () {
			var libraries = runFixture('overrides-short');
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/simple-overridden.js')
			]);
		});

		it('should resolve overridden module entry points (verbose notation)', function () {
			var libraries = runFixture('overrides-verbose');
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/simple-overridden.js')
			]);
		});

		it('should resolve overridden module entry points by environment (short notation)', function () {
			var libraries = runFixture('overrides-env-short', {env: 'prod'});
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/simple-overridden.js')
			]);
		});

		it('should resolve overridden module entry points by environment (verbose notation)', function () {
			var libraries = runFixture('overrides-env-verbose', {env: 'prod'});
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/simple-overridden.js')
			]);
		});

		it('should ignore an override for different a environment', function () {
			var libraries = runFixture('overrides-env-short', {env: 'dev'});
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/index.js')
			]);
		});

		it('should ignore an explicitly excluded module (short notation)', function () {
			var libraries = runFixture('exclude-short');
			expect(libraries).to.be.empty; // jshint ignore:line
		});

		it('should ignore an explicitly excluded module (verbose notation)', function () {
			var libraries = runFixture('exclude-verbose');
			expect(libraries).to.be.empty; // jshint ignore:line
		});

		it('should ignore a module explicitly excluded from an environment (short notation)', function () {
			var libraries = runFixture('exclude-env-short', {env: 'prod'});
			expect(libraries).to.be.empty; // jshint ignore:line
		});

		it('should ignore a module explicitly excluded from an environment (verbose notation)', function () {
			var libraries = runFixture('exclude-env-verbose', {env: 'prod'});
			expect(libraries).to.be.empty; // jshint ignore:line
		});

		it('should ignore an exclusion for a different environment', function () {
			var libraries = runFixture('exclude-env-short', {env: 'dev'});
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/index.js')
			]);
		});

		it('should resolve multiple libraries in one go', function () {
			var libraries = runFixture('combo');
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/index.js'),
				path.join(__dirname, 'fixture/node_modules/explicit-main/not-index.js'),
				path.join(__dirname, 'fixture/node_modules/browser/browser.js')
			]);
		});

		it('should return an error if a module has no entry point', function () {
			function nothing() {
				runFixture('nothing');
			}

			expect(nothing).to.throw(/Cannot find module/);
		});

		it('should flatten and sort by recursive node deps', function () {
			var libraries = runFixture('node-deps-recursive');
			expect(libraries[0]).to.equal(path.join(__dirname, 'fixture/node_modules/simple/index.js'));
			expect(libraries[1]).to.equal(path.join(__dirname, 'fixture/node_modules/node-deps-recursive/node_modules/node-deps/index.js'));
			expect(libraries[2]).to.equal(path.join(__dirname, 'fixture/node_modules/node-deps-recursive/index.js'));
		});

		it('should sort modules by their bower deps', function () {
			// Not sure how to provide a guaranteed failing case, since in the absence of explicit sorting ordering is
			// indeterminate... maybe this is close enough.
			var libraries = runFixture('bower-deps');
			expect(libraries[0]).to.equal(path.join(__dirname, 'fixture/node_modules/simple/index.js'));
			expect(libraries[1]).to.equal(path.join(__dirname, 'fixture/node_modules/bower-deps/dist/index.js'));
		});

		it('should ignore a bower package with no deps', function () {
			var libraries = runFixture('bower-no-deps');
			// Order doesn't matter because no deps are defined; just make sure it doesn't blow up
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/index.js'),
				path.join(__dirname, 'fixture/node_modules/bower-no-deps/index.js')
			]);
		});

		it('should sort modules by explicitly defined deps', function () {
			var libraries = runFixture('explicit-deps');
			expect(libraries[0]).to.equal(path.join(__dirname, 'fixture/node_modules/explicit-main/not-index.js'));
			expect(libraries[1]).to.equal(path.join(__dirname, 'fixture/node_modules/browser/browser.js'));
			expect(libraries[2]).to.equal(path.join(__dirname, 'fixture/node_modules/simple/index.js'));
		});

		it('should override bower deps with explicitly defined deps', function () {
			var libraries = runFixture('overrides-deps');
			expect(libraries[0]).to.equal(path.join(__dirname, 'fixture/node_modules/explicit-main/not-index.js'));
			expect(libraries[1]).to.equal(path.join(__dirname, 'fixture/node_modules/bower-deps/dist/index.js'));
			expect(libraries[2]).to.equal(path.join(__dirname, 'fixture/node_modules/simple/index.js'));
		});

		// Addresses a bug wherein an overridden 'main' was not being properly used to resolve dependencies
		it('should honor overridden main for dependency mappings', function () {
			var libraries = runFixture('depends-on-override');
			expect(libraries[-1]).to.be.undefined; // jshint ignore:line
			expect(libraries[0]).to.equal(path.join(__dirname, 'fixture/node_modules/simple/simple-overridden.js'));
			expect(libraries[1]).to.equal(path.join(__dirname, 'fixture/node_modules/explicit-main/not-index.js'));
		});
	});

	describe('style file', function () {
		function runFixture(name, options) {
			activateFixture(name);
			return fixture.style(options);
		}

		it('should find modules with stylesheets', function () {
			var libraries = runFixture('simple');
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/style.css')
			]);
		});

		it('should work when invoked from a sub-directory of the calling module', function () {
			activateFixture('simple');
			var libraries = require('./fixture/subdir/subdir').style();
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/style.css')
			]);
		});

		it('should resolve overridden module stylesheets by environment', function () {
			var libraries = runFixture('overrides-env-style', {env: 'prod'});
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/style-overridden.css')
			]);
		});

		it('should ignore an override for different a environment', function () {
			var libraries = runFixture('overrides-env-style', {env: 'dev'});
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/style.css')
			]);
		});

		it('should ignore an explicitly excluded module', function () {
			var libraries = runFixture('exclude-style');
			expect(libraries).to.be.empty; // jshint ignore:line
		});

		it('should ignore a module explicitly excluded from an environment', function () {
			var libraries = runFixture('exclude-env-short', {env: 'prod'});
			expect(libraries).to.be.empty; // jshint ignore:line
		});

		it('should ignore an exclusion for a different environment', function () {
			var libraries = runFixture('exclude-env-short', {env: 'dev'});
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/style.css')
			]);
		});

		it('should skip a module with no stylesheet', function () {
			var libraries = runFixture('explicit-main');
			expect(libraries).to.be.empty; //jshint ignore:line
		});

		it('should flatten and sort by recursive node deps', function () {
			var libraries = runFixture('node-deps-recursive');
			expect(libraries[0]).to.equal(path.join(__dirname, 'fixture/node_modules/simple/style.css'));
			expect(libraries[1]).to.equal(path.join(__dirname, 'fixture/node_modules/node-deps-recursive/style.css'));
		});

		it('should sort modules by their bower deps', function () {
			// Not sure how to provide a guaranteed failing case, since in the absence of explicit sorting ordering is
			// indeterminate... maybe this is close enough.
			var libraries = runFixture('bower-deps');
			expect(libraries[0]).to.equal(path.join(__dirname, 'fixture/node_modules/simple/style.css'));
			expect(libraries[1]).to.equal(path.join(__dirname, 'fixture/node_modules/bower-deps/dist/style.css'));
		});
	});
});
