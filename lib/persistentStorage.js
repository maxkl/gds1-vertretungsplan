/**
 * Copyright: (c) 2015 Max Klein
 * License: MIT
 */

var fs = require("fs");

function PersistentStorage(filename) {
	this._filename = filename;

	this._cached = false;
	this._changed = false;
	this._data = null;
}

PersistentStorage.prototype._read = function () {
	try {
		var contents = fs.readFileSync(this._filename);

		this._data = JSON.parse(contents);
	} catch(e) {
		this._data = {};
	}

	this._cached = true;
};

PersistentStorage.prototype._write = function () {
	try {
		fs.writeFileSync(this._filename, JSON.stringify(this._data));

		this._changed = false;

		return true;
	} catch(e) {
		return false;
	}
};

PersistentStorage.prototype._clear = function () {
	this._data = {};

	return this._write();
};

PersistentStorage.prototype.read = function (force) {
	if(force || !this._cached) {
		this._read();
	}
};

PersistentStorage.prototype.write = function (force) {
	if(force || !this._changed) {
		this._write();
	}
};

PersistentStorage.prototype.has = function (key) {
	if(!this._cached) {
		this._read();
	}

	return this._data.hasOwnProperty("" + key);
};

PersistentStorage.prototype.get = function (key, def) {
	if(!this._cached) {
		this._read();
	}

	key = "" + key;
	if(this._data.hasOwnProperty(key)) {
		return this._data[key];
	}

	return typeof def !== "undefined" ? def : null;
};

PersistentStorage.prototype.set = function (key, val) {
	if(!this._cached) {
		this._read();
	}

	//if(Object.prototype.toString.call(key) === "[object Object]") {
	//	// Bulk write
	//
	//	for(var prop in key) {
	//		if(key.hasOwnProperty(prop)) {
	//			this._data[prop] = key[prop];
	//		}
	//	}
	//} else {
	//	this._data["" + key] = val;
	//}

	this._data["" + key] = val;

	this._changed = true;

	this._write();
};

PersistentStorage.prototype.delete = function (key) {
	if(!this._cached) {
		this._read();
	}

	key = "" + key;

	if(this._data.hasOwnProperty(key)) {
		delete this._data[key];

		this._write();

		return true;
	} else {
		return false;
	}
};

PersistentStorage.prototype.clear = function () {
	this._clear();
};

module.exports = PersistentStorage;
