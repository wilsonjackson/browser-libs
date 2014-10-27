'use strict';

var path = require('path');
var es = require('event-stream');
var reduce = require('stream-reduce');
var toposort = require('toposort');
var bresolve = require('browser-resolve');

function blibs(options, done) {
	if ('function' === typeof options) {
		done = options;
		options = {};
	}
	options = options || {};

	var async = 'function' === typeof done;
	var pkgFile;
	var pkg;

	pkgFile = findPackageJson(path.dirname(module.parent.filename));
	pkg = require(pkgFile);
	var override = pkg['browser-overrides'] || {};
	var env = options.env;

	if (async) {
		es.readArray(Object.keys(pkg.dependencies))
			.pipe(es.mapSync(wrapModuleId))
			.pipe(es.mapSync(readParentOverride))
			.pipe(es.map(findEntryPointAsync))
			.on('error', function (err) {
				done(err);
			})
			.pipe(es.mapSync(readBowerDeps))
			.on('error', function (err) {
				done(err);
			})
			.pipe(es.map(resolveDepsAsync))
			.pipe(reduce(buildDependencyGraph, {nodes: [], edges: []}))
			.pipe(es.through(function (graph) {
				done(null, toposort.array(graph.nodes, graph.edges).reverse());
			}));
	}
	else {
		var graph = Object.keys(pkg.dependencies)
			.map(wrapModuleId)
			.map(readParentOverride)
			.filter(Boolean)
			.map(findEntryPointSync)
			.map(readBowerDeps)
			.map(resolveDepsSync)
			.reduce(buildDependencyGraph, {nodes: [], edges: []});
		return toposort.array(graph.nodes, graph.edges).reverse();
	}

	// Walk up the directory path to find the nearest package.json
	function findPackageJson(startDir) {
		var dirs = startDir.split(path.sep);
		while (dirs.length > 0) {
			try {
				return require.resolve(path.sep + path.join.apply(path, dirs.concat('package.json')));
			}
			catch (e) {
				dirs.pop();
			}
		}
		throw new Error('Couldn\'t find package.json in or above ' + startDir);
	}

	// Translate bare module id into container object
	function wrapModuleId(id) {
		return {id: id, deps: []};
	}

	// Read package.json of parent module to find shim overrides
	function readParentOverride(mod) {
		mod.override = override[mod.id];
		mod.main = 'object' === typeof mod.override ? mod.override.main : mod.override;
		mod.deps = mod.deps.concat(mod.override && mod.override.deps || []);

		// Apply environment-specific override
		if (mod.override && mod.override.env && 'undefined' !== typeof mod.override.env[env]) {
			mod.main = mod.override.env[env];
		}

		// explicit false value excludes a module
		if (mod.main === false) {
			return undefined;
		}

		return mod;
	}

	// Defer to browser-resolve to find shim/default entry points
	function findEntryPointAsync(mod, cb) {
		// If an override is set, resolve it from the parent module. Otherwise, resolve the
		bresolve(mod.main || mod.id, {filename: pkgFile}, function (err, path) {
			if (err) {
				cb(err);
			}
			mod.main = path;
			cb(null, mod);
		});
	}

	// Defer to browser-resolve to find shim/default entry points
	function findEntryPointSync(mod) {
		// If an override is set, resolve it from the parent module. Otherwise, resolve the
		mod.main = bresolve.sync(mod.main || mod.id, {filename: pkgFile});
		return mod;
	}

	// Funnel dependencies out of bower config, if available
	function readBowerDeps(mod) {
		// Skip module with overridden deps
		if (mod.deps.length > 0) {
			return mod;
		}
		try {
			var modRootDir = path.dirname(findPackageJson(path.dirname(mod.main)));
			var bower = require(path.join(modRootDir, 'bower.json'));
			Object.keys(bower.dependencies || {}).forEach(function (dep) {
				mod.deps.push(dep);
			});
		}
		catch (e) {
			// No bower.json
		}
		return mod;
	}

	// Resolve dependency references gathered from bower and manual overrides against invoking module
	function resolveDepsAsync(mod, cb) {
		var deps = mod.deps.splice(0);
		(function next() {
			var depId = deps.shift();
			bresolve(depId, {filename: pkgFile}, function (err, path) {
				if (path) {
					mod.deps.push(path);
				}
				return deps.length > 0 ? next() : cb(null, mod);
			});
		})();
	}

	// Resolve dependency references gathered from bower and manual overrides against invoking module
	function resolveDepsSync(mod) {
		var deps = mod.deps.splice(0);
		var depId;
		while ((depId = deps.shift())) {
			var path = bresolve.sync(depId, {filename: pkgFile});
			if (path) {
				mod.deps.push(path);
			}
		}
		return mod;
	}

	// Turn array of dependencies into nodes and edges for a dependency sort
	function buildDependencyGraph(graph, mod) {
		graph.nodes.push(mod.main);
		mod.deps.forEach(function (depDep) {
			graph.edges.push([mod.main, depDep]);
		});
		return graph;
	}
}

// async api
module.exports = function (options, done) {
	blibs(options, done);
};

// sync api
module.exports.sync = function (options) {
	return blibs(options);
};
