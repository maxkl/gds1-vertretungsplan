/**
 * Copyright: (c) 2015 Max Klein
 * License: MIT
 */

var childProcess = require("child_process"),
	path = require("path");

var express = require("express"),
	moment = require("moment"),
	CronJob = require("cron").CronJob;

var vpTemplate = require("./views/vp.marko");

var fetchPath = path.join(__dirname, "lib/fetch.js");

function startBackgroundJob() {
	function runJob() {
		var fetch = childProcess.fork(fetchPath);

		fetch.on("close", function (code) {
			if(code !== 0) {
				console.error("Fetch error (" + code + ")");
				return;
			}

			console.log("Fetch successful");
		});
	}

	new CronJob("0 */15 * * * *", runJob, null, true, "Europe/Berlin");

	runJob();
}

var backgroundJobStarted = false;

module.exports = function (app) {
	var router = new express.Router();

	var db = app.get("db");

	if(!backgroundJobStarted) {
		startBackgroundJob();
		backgroundJobStarted = true;
	}

	router.get("/", function (req, res, next) {
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
				//console.log("DB query successful");
			}

			vpTemplate.render({
				vertretungen: vertretungen
			}, res);
		});
	});

	return router;
};
