/**
 * Copyright: (c) 2015 Max Klein
 * License: MIT
 */

var express = require("express");

/*
 * Endpoints:
 * /
 * /plan
 * /plan?from=11.12.2015&to=16.12.2015&class=TGJ1.4
 * /classes
 * /days
 */

/*
 * Successful response:
 *
 */

/*
 * Failed response:
 * error: Error message
 */

module.exports = function (app, storage) {
	var router = new express.Router();

	var db = app.get("db");

	router.get("/info", function (req, res) {
		res.json({
			latestPlanDate: storage.get("latestPlanDate")
		});
	});

	return router;
};
