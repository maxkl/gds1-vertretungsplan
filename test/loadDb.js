/**
 * Copyright: (c) 2015 Max Klein
 * License: MIT
 */

var database = require("./lib/database");

database.connect(function (err, db) {
	if(err) {
		console.error("DB connect error:", err);
		return;
	}

	var vertretungen = db.collection("vertretungen");

	var cursor = vertretungen.find().sort([["date", 1], ["_id", 1]]);

	cursor.forEach(function (doc) {
		console.log(doc);
	}, function (err) {
		if(err) {
			console.log("DB query error:", err);
		} else {
			console.log("DB query successful");
		}

		db.close();
	});
});