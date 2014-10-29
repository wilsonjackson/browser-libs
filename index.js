'use strict';

var path = require('path');
var toposort = require('toposort');
var bresolve = require('browser-resolve');

function blibs(options) {
	options = options || {};

	var env = options.env;
	var cache = {};

	var pkgFile = findPackageJson(path.dirname(module.parent.filename));
	var pkg = require(pkgFile);
	var override = pkg['browser-overrides'] || {};
	var excluded = {};

	// Find all excluded modules
	Object.keys(override).forEach(function (id) {
		var o = override[id];
		excluded[id] = env && o.env && o.env[env] === false ||                    // Environment-specific exclusion
			(!env || !o.env || !o.env[env]) && (o === false || o.main === false); // Non-overridden global exclusion
	});

	var graph = Object.keys(pkg.dependencies)
		.map(function (id) {
			return readModule(id, {pkgFile: pkgFile});
		})
		.filter(Boolean)
		.map(addOverrideDeps)
		.reduce(addNodeDeps, [])
		.map(addBowerDeps)
		.map(findMain)
		.reduce(buildDependencyGraph, {nodes: [], edges: []});
	return toposort.array(graph.nodes, graph.edges).reverse();

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

	function readModule(id, parentMod) {
		if (excluded[id]) {
			return null;
		}
		if (cache[id]) {
			return cache[id];
		}
		var main = bresolve.sync(id, {filename: parentMod.pkgFile});
		var pkgFile = findPackageJson(path.dirname(main));
		var pkg = require(pkgFile);
		return (cache[id] = {
			id: id,
			pkgFile: pkgFile,
			pkg: pkg,
			parent: parentMod,
			deps: []
		});
	}

	function addOverrideDeps(mod) {
		((override[mod.id] || {}).deps || []).forEach(function (id) {
			if (!cache[id]) {
				throw new Error('Dependency ' + id + ' of ' + mod.id + ' not found');
			}
			mod.deps.push(cache[id]);
		});
		return mod;
	}

	function addNodeDeps(deps, mod) {
		deps.push(mod);
		if (mod.deps.length > 0) {
			return deps;
		}
		Object.keys(mod.pkg.dependencies || {}).forEach(function (id) {
			// Skip already-cached deps
			if (cache[id]) {
				return;
			}
			var dep = readModule(id, mod);
			// Allow recursive deps to be excluded
			if (dep) {
				// Recursively process & flatten deps
				addNodeDeps(deps, dep);
			}
		});
		return deps;
	}

	function addBowerDeps(mod) {
		if (mod.deps.length > 0) {
			return mod;
		}
		try {
			var modRootDir = path.dirname(mod.pkgFile);
			var bower = require(path.join(modRootDir, 'bower.json'));
			Object.keys(bower.dependencies || {}).forEach(function (id) {
				if (cache[id]) {
					mod.deps.push(cache[id]);
				}
			});
		}
		catch (e) {
			// No bower.json
		}
		return mod;
	}

	function findMain(mod) {
		var o = override[mod.id];
		var main = 'object' === typeof o ? o.main : o;

		// Apply environment-specific override
		if (o && o.env && 'undefined' !== typeof o.env[env]) {
			main = o.env[env];
		}

		// If an override is set, resolve it from the root module. Otherwise, resolve from the parent of the dependency.
		if (main) {
			mod.main = bresolve.sync(main, {filename: pkgFile});
		}
		else {
			mod.main = bresolve.sync(mod.id, {filename: mod.parent.pkgFile});
		}
		return mod;
	}

	// Turn array of dependencies into nodes and edges for a dependency sort
	function buildDependencyGraph(graph, mod) {
		graph.nodes.push(mod.main);
		mod.deps.forEach(function (dep) {
			graph.edges.push([mod.main, dep.main]);
		});
		return graph;
	}
}

module.exports = blibs;
