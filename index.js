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

	function isGlobalExcluded(id) {
		var o = override[id];
		return o === false || o && o.env && o.env[env] === false;
	}

	function isFileExcluded(id) {
		var o = override[id] || {};
		var prop = options.style ? 'style' : 'main';
		if (o.env && o.env[env] && 'undefined' !== typeof o.env[env][prop]) {
			return o.env[env][prop] === false;
		}
		return o[prop] === false;
	}

	var graph = Object.keys(pkg.dependencies)
		.map(function (id) {
			return readModule(id);
		})
		.filter(Boolean)
		.map(addOverrideDeps)
		.reduce(addNodeDeps, [])
		.map(addBowerDeps)
		.map(options.style ? findStyle : findMain)
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
		if (isGlobalExcluded(id) || isFileExcluded(id)) {
			return null;
		}
		if (cache[id]) {
			return cache[id];
		}
		if (!parentMod) {
			parentMod = {pkgFile: pkgFile};
		}
		var mod = {id: id, parent: parentMod, deps: []};
		mod.pkgFile = bresolve.sync(id + '/package.json', {filename: parentMod.pkgFile});
		mod.pkg = require(mod.pkgFile);
		return (cache[id] = mod);
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

	// resolve main file for module as mod.file, taking into account the module's browser field
	function findMain(mod) {
		var o = override[mod.id];
		var main = 'object' === typeof o ? o.main : o;

		// Apply environment-specific override
		if (o && o.env && o.env[env]) {
			if ('string' === typeof o.env[env]) {
				main = o.env[env];
			}
			else if ('string' === typeof o.env[env].main) {
				main = o.env[env].main;
			}
		}

		// If an override is set, resolve it from the root module. Otherwise, resolve from the parent of the dependency.
		if (main) {
			mod.file = bresolve.sync(main, {filename: pkgFile});
		}
		else {
			mod.file = bresolve.sync(mod.id, {filename: mod.parent.pkgFile});
		}
		return mod;
	}

	// resolve stylesheet for module as mod.file
	function findStyle(mod) {
		var o = override[mod.id];
		var style = o && o.style;

		// Apply environment-specific override
		if (o && o.env && o.env[env] && o.env[env].style) {
			style = o.env[env].style;
		}

		if (style) {
			mod.file = bresolve.sync(style, {filename: pkgFile});
		}
		else if (mod.pkg.style) {
			mod.file = bresolve.sync('./' + mod.pkg.style, {filename: mod.pkgFile});
		}
		return mod;
	}

	// Turn array of dependencies into nodes and edges for a dependency sort
	function buildDependencyGraph(graph, mod) {
		if (mod.file) {
			graph.nodes.push(mod.file);
			mod.deps.forEach(function (dep) {
				if (dep.file) {
					graph.edges.push([mod.file, dep.file]);
				}
			});
		}
		return graph;
	}
}

module.exports = blibs;
module.exports.style = function (options) {
	options = options || {};
	options.style = true;
	return blibs(options);
};
