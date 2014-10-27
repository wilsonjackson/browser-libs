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
	var cache = {};

	pkgFile = findPackageJson(path.dirname(module.parent.filename));
	pkg = require(pkgFile);
	var override = pkg['browser-overrides'] || {};
	var env = options.env;

	if (async) {
		es.readArray(Object.keys(pkg.dependencies))
			.pipe(es.map(resolveModuleAsync))
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
			.map(resolveModuleSync)
			.filter(Boolean)
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

	// Transform module id into module object containing fully resolved main path and unresolved deps
	function resolveModuleAsync(id, cb) {
		if (cache[id]) {
			return cb(null, cache[id]);
		}
		var mod = readParentOverride(id);
		if (!mod) {
			return cb();
		}
		findEntryPointAsync(mod, function (err, mod) {
			if (!err) {
				cache[id] = mod;
			}
			cb(err, mod);
		});
	}

	// Transform module id into module object containing fully resolved main path and unresolved deps
	function resolveModuleSync(id) {
		if (cache[id]) {
			return cache[id];
		}
		var mod = readParentOverride(id);
		if (mod) {
			mod = findEntryPointSync(mod);
			cache[id] = mod;
		}
		return mod;
	}

	// Read package.json of parent module to find shim overrides
	function readParentOverride(id) {
		var mod = {id: id, deps: []};
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
			if (deps.length === 0) {
				return cb(null, mod);
			}
			resolveModuleAsync(deps.shift(), function (err, dep) {
				if (dep && dep.main) {
					mod.deps.push(dep.main);
				}
				next();
			});
		})();
	}

	// Resolve dependency references gathered from bower and manual overrides against invoking module
	function resolveDepsSync(mod) {
		var deps = mod.deps.splice(0);
		var depId;
		while ((depId = deps.shift())) {
			var dep = resolveModuleSync(depId);
			if (dep && dep.main) {
				mod.deps.push(dep.main);
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
