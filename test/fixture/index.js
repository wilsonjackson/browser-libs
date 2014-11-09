'use strict';

var bdeps = require('../../');

module.exports = function () {
	return bdeps.apply(null, arguments);
};

module.exports.style = function () {
	return bdeps.style.apply(null, arguments);
};
