/**
 * Copyright: (c) 2015 Max Klein
 * License: MIT
 */

var childProcess = require("child_process"),
	path = require("path");
var express = require("express"),
	moment = require("moment"),
	CronJob = require("cron").CronJob;
var PersistentStorage = require("./lib/persistentStorage");

var vpTemplate = require("./views/vp.marko");

var fetchPath = path.join(__dirname, "lib/fetch"),
	persistentStoragePath = path.join(__dirname, "cache", "storage.json");

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

/**
 * Process a MongoDB document for a template
 * @param doc
 */
function beautifyDBData(doc) {
	return {
		day: moment(doc.date).format("DD.MM."),
		lessons: (doc.startLesson === doc.endLesson) ? doc.startLesson + "." : doc.startLesson + ". - " + doc.endLesson + ".",
		classes: doc.classes.join(", "),
		teacherSubject: doc.teacher + " / " + doc.subject,
		substituteTeacher: doc.dropped ? "entfällt" : doc.substituteTeacher || "-",
		substituteSubject: doc.substituteSubject || "-",
		room: doc.room || "-",
		comment: doc.text || "-"
	};
}

/**
 *
 * @param {string} str
 * @returns {moment}
 */
function parseDateParam(str) {
	if(str === "latest") {
		return null;
	} else if(str === "today") {
		return moment().startOf("day");
	} else {
		return moment(str, ["DD.MM.", "DD.MM.YYYY"], true);
	}
}

var backgroundJobStarted = false;

module.exports = function (app) {
	var router = new express.Router();

	var storage = new PersistentStorage(persistentStoragePath);

	var db = app.get("db");

	if(!backgroundJobStarted) {
		startBackgroundJob();
		backgroundJobStarted = true;
	}

	/*
	 * TODO:
	 * - For multiple classes
	 */

	router.get("/", function (req, res, next) {
		var vertretungen = [];

		/*
		 * GET params:
		 * from  - Start date, defaults to 'today'
		 * to    - End date, defaults to 'latest'
		 * class - Class, defaults to null
		 */

		var fromParam = req.query.from || "today",
			toParam = req.query.to || "latest",
			classParam = req.query.class || null;

		var from = parseDateParam(fromParam),
			to = parseDateParam(toParam);

		//console.log(fromParam, from ? from.format() : "null");
		//console.log(toParam, to ? to.format() : "null");

		var latestPlanDate = storage.has("latestPlanDate")
				? moment(storage.get("latestPlanDate")).format("DD.MM.YYYY HH:mm")
				: "-";

		if(from && from.isValid() && (!to || to.isValid())) {
			var dbQuery = {
				date: {
					$gte: from.toDate()
				}
			};

			if(to) {
				to.endOf("day");
				dbQuery.date.$lt = to.toDate();
			}

			if(classParam) {
				dbQuery.classes = classParam;
			}

			//console.log(dbQuery);

			var cursor = db.collection("vertretungen").find(dbQuery).sort([["date", 1], ["_id", 1]]);

			cursor.forEach(function (doc) {
				vertretungen.push(beautifyDBData(doc));
			}, function (err) {
				if(err) {
					next(err);
					return;
				}

				vpTemplate.render({
					latestPlanDate: latestPlanDate,
					vertretungen: vertretungen,
					message: vertretungen.length ? null : "Keine Einträge gefunden"
				}, res);
			});
		} else {
			vpTemplate.render({
				latestPlanDate: latestPlanDate,
				vertretungen: [],
				message: "Ungültiges Datum"
			}, res);
		}

		//vertretungen.push({
		//	day: req.query.from || "undefined",
		//	lessons: "-",
		//	classes: "-",
		//	teacherSubject: "-",
		//	substituteTeacher: "-",
		//	substituteSubject: "-",
		//	room: "-",
		//	comment: "-"
		//});
		//
		//vertretungen.push({
		//	day: req.query.to || "undefined",
		//	lessons: "-",
		//	classes: "-",
		//	teacherSubject: "-",
		//	substituteTeacher: "-",
		//	substituteSubject: "-",
		//	room: "-",
		//	comment: "-"
		//});
		//
		//vpTemplate.render({
		//	vertretungen: vertretungen
		//}, res);
	});

	router.use("/api", require("./api")(app, storage));

	return router;
};
