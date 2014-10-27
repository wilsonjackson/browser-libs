'use strict';

var bdeps = require('../../');

module.exports.async = function () {
	return bdeps.apply(null, arguments);
};

module.exports.sync = function () {
	return bdeps.sync.apply(null, arguments);
};
