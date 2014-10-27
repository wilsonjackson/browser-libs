'use strict';

var fs = require('fs');
var path = require('path');
var expect = require('chai').expect;

describe('browser-deps', function () {
	beforeEach(cleanFixture);
	beforeEach(clearCache);
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

	describe('async api', function () {
		// activate a package.json in fixture, run the fixture module, and call the test with the returned `err` and
		// `libraries` values. `done` must be the mocha async callback. The `options` param is optional and specifies
		// options for the module under test.
		function runFixture(name, options, test, done) {
			var args = [];
			if ('object' === typeof options) {
				args.push(options);
			}
			else {
				done = test;
				test = options;
			}
			activateFixture(name);
			require('./fixture').async.apply(null, args.concat(function (err, libraries) {
				test(err, libraries);
				done();
			}));
		}

		// wrap a fixture test function that only cares about validating success.
		function expectSuccess(test) {
			return function (err, libraries) {
				expect(err).to.equal(null);
				test(libraries);
			};
		}

		// Need a fs mock for this
//		it('should throw if package.json can\'t be loaded', function () {
//			expect(require('./fixture').async).to.throw();
//		});

		it('should resolve implicit module entry points', function (done) {
			runFixture('simple', expectSuccess(function (libraries) {
				expect(libraries).to.have.members([
					path.join(__dirname, 'fixture/node_modules/simple/index.js')
				]);
			}), done);
		});

		it('should work when invoked from a sub-directory of the calling module', function (done) {
			activateFixture('simple');
			require('./fixture/subdir/subdir').async(function (err, libraries) {
				expect(libraries).to.have.members([
					path.join(__dirname, 'fixture/node_modules/simple/index.js')
				]);
				done();
			});
		});

		it('should resolve explicit module entry points', function (done) {
			runFixture('explicit-main', expectSuccess(function (libraries) {
				expect(libraries).to.have.members([
					path.join(__dirname, 'fixture/node_modules/explicit-main/not-index.js')
				]);
			}), done);
		});

		it('should resolve browser-specific module entry points', function (done) {
			runFixture('browser', expectSuccess(function (libraries) {
				expect(libraries).to.have.members([
					path.join(__dirname, 'fixture/node_modules/browser/browser.js')
				]);
			}), done);
		});

		it('should resolve overridden module entry points (short notation)', function (done) {
			runFixture('overrides-short', expectSuccess(function (libraries) {
				expect(libraries).to.have.members([
					path.join(__dirname, 'fixture/node_modules/simple/simple-overridden.js')
				]);
			}), done);
		});

		it('should resolve overridden module entry points (verbose notation)', function (done) {
			runFixture('overrides-verbose', expectSuccess(function (libraries) {
				expect(libraries).to.have.members([
					path.join(__dirname, 'fixture/node_modules/simple/simple-overridden.js')
				]);
			}), done);
		});

		it('should resolve overridden module entry points by environment', function (done) {
			runFixture('overrides-env', {env: 'prod'}, expectSuccess(function (libraries) {
				expect(libraries).to.have.members([
					path.join(__dirname, 'fixture/node_modules/simple/simple-overridden.js')
				]);
			}), done);
		});

		it('should ignore an override for different a environment', function (done) {
			runFixture('overrides-env', {env: 'dev'}, expectSuccess(function (libraries) {
				expect(libraries).to.have.members([
					path.join(__dirname, 'fixture/node_modules/simple/index.js')
				]);
			}), done);
		});

		it('should ignore an explicitly excluded module (short notation)', function (done) {
			runFixture('exclude-short', expectSuccess(function (libraries) {
				expect(libraries).to.be.empty; // jshint ignore:line
			}), done);
		});

		it('should ignore an explicitly excluded module (verbose notation)', function (done) {
			runFixture('exclude-verbose', expectSuccess(function (libraries) {
				expect(libraries).to.be.empty; // jshint ignore:line
			}), done);
		});

		it('should ignore a module explicitly excluded from an environment', function (done) {
			runFixture('exclude-env', {env: 'prod'}, expectSuccess(function (libraries) {
				expect(libraries).to.be.empty; // jshint ignore:line
			}), done);
		});

		it('should ignore an exclusion for a different environment', function (done) {
			runFixture('exclude-env', {env: 'dev'}, expectSuccess(function (libraries) {
				expect(libraries).to.have.members([
					path.join(__dirname, 'fixture/node_modules/simple/index.js')
				]);
			}), done);
		});

		it('should resolve multiple libraries in one go', function (done) {
			runFixture('combo', expectSuccess(function (libraries) {
				expect(libraries).to.have.members([
					path.join(__dirname, 'fixture/node_modules/simple/index.js'),
					path.join(__dirname, 'fixture/node_modules/explicit-main/not-index.js'),
					path.join(__dirname, 'fixture/node_modules/browser/browser.js')
				]);
			}), done);
		});

		it('should return an error if a module has no entry point', function (done) {
			runFixture('nothing', function (err, libraries) {
				expect(err.message).to.match(/Cannot find module/);
				expect(libraries).to.equal(undefined);
			}, done);
		});

		it('should sort modules by their bower deps', function (done) {
			// Not sure how to provide a guaranteed failing case, since in the absence of explicit sorting ordering is
			// indeterminate... maybe this is close enough.
			runFixture('bower-deps', expectSuccess(function (libraries) {
				expect(libraries[0]).to.equal(path.join(__dirname, 'fixture/node_modules/simple/index.js'));
				expect(libraries[1]).to.equal(path.join(__dirname, 'fixture/node_modules/bower-deps/dist/index.js'));
			}), done);
		});

		it('should ignore a bower package with no deps', function (done) {
			runFixture('bower-no-deps', expectSuccess(function (libraries) {
				// Order doesn't matter because no deps are defined; just make sure it doesn't blow up
				expect(libraries).to.have.members([
					path.join(__dirname, 'fixture/node_modules/simple/index.js'),
					path.join(__dirname, 'fixture/node_modules/bower-no-deps/index.js')
				]);
			}), done);
		});

		it('should sort modules by explicitly defined deps', function (done) {
			runFixture('explicit-deps', expectSuccess(function (libraries) {
				expect(libraries[0]).to.equal(path.join(__dirname, 'fixture/node_modules/explicit-main/not-index.js'));
				expect(libraries[1]).to.equal(path.join(__dirname, 'fixture/node_modules/browser/browser.js'));
				expect(libraries[2]).to.equal(path.join(__dirname, 'fixture/node_modules/simple/index.js'));
			}), done);
		});

		it('should override bower deps with explicitly defined deps', function (done) {
			runFixture('overrides-deps', expectSuccess(function (libraries) {
				expect(libraries[0]).to.equal(path.join(__dirname, 'fixture/node_modules/explicit-main/not-index.js'));
				expect(libraries[1]).to.equal(path.join(__dirname, 'fixture/node_modules/bower-deps/dist/index.js'));
				expect(libraries[2]).to.equal(path.join(__dirname, 'fixture/node_modules/simple/index.js'));
			}), done);
		});
	});

	describe('sync api', function () {
		var fixture;

		beforeEach(function () {
			fixture = require('./fixture').sync;
		});

		function runFixture(name, options) {
			activateFixture(name);
			return fixture(options);
		}

		// Need a fs mock for this
//		it('should throw if package.json can\'t be loaded', function () {
//			expect(fixture).to.throw();
//		});

		it('should resolve implicit module entry points', function () {
			var libraries = runFixture('simple');
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/index.js')
			]);
		});

		it('should work when invoked from a sub-directory of the calling module', function () {
			activateFixture('simple');
			var libraries = require('./fixture/subdir/subdir').sync();
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

		it('should resolve overridden module entry points by environment', function () {
			var libraries = runFixture('overrides-env', {env: 'prod'});
			expect(libraries).to.have.members([
				path.join(__dirname, 'fixture/node_modules/simple/simple-overridden.js')
			]);
		});

		it('should ignore an override for different a environment', function () {
			var libraries = runFixture('overrides-env', {env: 'dev'});
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

		it('should ignore a module explicitly excluded from an environment', function () {
			var libraries = runFixture('exclude-env', {env: 'prod'});
			expect(libraries).to.be.empty; // jshint ignore:line
		});

		it('should ignore an exclusion for a different environment', function () {
			var libraries = runFixture('exclude-env', {env: 'dev'});
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
	});
});
