'use strict';

var es = require('event-stream');
var reduce = require('stream-reduce');
var toposort = require('toposort');
var bresolve = require('browser-resolve');

module.exports = function (options, done) {
	if ('function' === typeof options) {
		done = options;
		options = {};
	}

	var pkg = module.parent.require('./package.json');
	var override = pkg['browser-overrides'] || {};
	var env = options.env;

	es.readArray(Object.keys(pkg.dependencies))
		.pipe(es.map(wrapModuleId))
		.pipe(es.map(readParentOverride))
		.pipe(es.map(findEntryPoint))
		.on('error', function (err) {
			done(err);
		})
		.pipe(es.map(readBowerDeps))
		.pipe(es.map(resolveDeps))
		.pipe(reduce(buildDependencyGraph, {nodes: [], edges: []}))
		.pipe(es.through(function (graph) {
			done(null, toposort.array(graph.nodes, graph.edges).reverse());
		}));

	// Translate bare module id into container object
	function wrapModuleId(id, cb) {
		cb(null, {id: id, deps: []});
	}

	// Read package.json of parent module to find shim overrides
	function readParentOverride(mod, cb) {
		mod.override = override[mod.id];
		mod.main = 'object' === typeof mod.override ? mod.override.main : mod.override;
		mod.deps = mod.deps.concat(mod.override && mod.override.deps || []);

		// Apply environment-specific override
		if (mod.override && mod.override.env && 'undefined' !== typeof mod.override.env[env]) {
			mod.main = mod.override.env[env];
		}

		// explicit false value excludes a module
		if (mod.main === false) {
			return cb();
		}

		cb(null, mod);
	}

	// Defer to browser-resolve to find shim/default entry points
	function findEntryPoint(mod, cb) {
		// If an override is set, resolve it from the parent module. Otherwise, resolve the
		bresolve(mod.main || mod.id, {filename: module.parent.filename}, function (err, path) {
			if (err) {
				cb(err);
			}
			mod.main = path;
			cb(null, mod);
		});
	}

	// Funnel dependencies out of bower config, if available
	function readBowerDeps(mod, cb) {
		// Skip module with overridden deps
		if (mod.deps.length > 0) {
			return cb(null, mod);
		}
		bresolve('./bower.json', {filename: mod.main}, function (err, path) {
			if (path) {
				var bower = require(path);
				Object.keys(bower.dependencies || {}).forEach(function (dep) {
					mod.deps.push(dep);
				});
			}
			cb(null, mod);
		});
	}

	// Resolve dependency references gathered from bower and manual overrides against invoking module
	function resolveDeps(mod, cb) {
		var deps = mod.deps.splice(0);
		(function next() {
			var depId = deps.shift();
			bresolve(depId, {filename: module.parent.filename}, function (err, path) {
				if (path) {
					mod.deps.push(path);
				}
				return deps.length > 0 ? next() : cb(null, mod);
			});
		})();
	}

	// Turn array of dependencies into nodes and edges for a dependency sort
	function buildDependencyGraph(graph, mod) {
		graph.nodes.push(mod.main);
		mod.deps.forEach(function (depDep) {
			graph.edges.push([mod.main, depDep]);
		});
		return graph;
	}
};
