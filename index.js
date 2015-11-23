/**
 * Copyright: (c) 2015 Max Klein
 * License: MIT
 */

var express = require("express"),
	moment = require("moment");
	//CronJob = require("cron").CronJob;
//var database = require("./lib/database");
//	fetchPlan = require("./lib/fetch");

var vpTemplate = require("./views/vp.marko");

//new CronJob("0 */15 * * * *", function () {
//	// TODO: fetch plan (lib/fetch.js), db connection from main server, collection 'vertretungen'
//
//	console.log("Fetching... (Not really)");
//}, null, true, "Europe/Berlin");

//database.connect();

module.exports = function () {
	var router = new express.Router();

	router.get("/", function (req, res, next) {
		//db = database.db; // FIXME
		var db = req.app.get("db");

		var vertretungen = [];

		var cursor = db.collection("vertretungen").find().sort([["date", 1], ["_id", 1]]);

		cursor.forEach(function (doc) {
			vertretungen.push({
				day: moment(doc.date).format("DD.MM."),
				lessons: (doc.startLesson === doc.endLesson) ? doc.startLesson + "." : doc.startLesson + ". - " + doc.endLesson + ".",
				classes: doc.classes.join(", "),
				teacherSubject: doc.teacher + " / " + doc.subject,
				substituteTeacher: doc.dropped ? "entfällt" : doc.substituteTeacher || "-",
				substituteSubject: doc.substituteSubject || "-",
				room: doc.room || "-",
				comment: doc.text || "-"
			});
		}, function (err) {
			if(err) {
				next(err);
			} else {
				console.log("DB query successful");
			}

			vpTemplate.render({
				vertretungen: vertretungen
			}, res);

			//res.render("vp", {
			//	vertretungen: vertretungen
			//});
		});
	});

	return router;
};
