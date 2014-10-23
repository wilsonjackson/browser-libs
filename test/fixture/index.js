'use strict';

var bdeps = require('../../');

var invokeModule = function () {
	return bdeps.apply(null, arguments);
};

invokeModule.fromSubdir = function () {
	return require('./subdir/subdir').apply(null, arguments);
};

module.exports = invokeModule;
