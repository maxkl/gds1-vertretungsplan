/**
 * Copyright: (c) 2015 Max Klein
 * License: MIT
 */

var mongodb = require("mongodb"),
	MongoClient = mongodb.MongoClient;
//var dbConfig = require("../dbConfig.json");

var url = "mongodb://localhost:27017/maxkl_de";
var options = {};

/**
 * Connection pooling is handled internally by mongodb
 * @type {mongodb.Db}
 */
module.exports.db = null;

/**
 *
 * @param callback
 */
module.exports.connect = function (callback) {
	if(module.exports.db) {
		if(callback) {
			callback(null, module.exports.db);
		}
	} else {
		MongoClient.connect(url, options, function (err, database) {
			if(err) {
				if(callback) {
					callback(err);
				}
			} else {
				module.exports.db = database;

				if(callback) {
					callback(null, database);
				}
			}
		});
	}
};
