
var fs = require("fs");
var util = require("./lib/util"),
	VP = require("./lib/vertretungs-plan");

var filename = "database";

function prettyEntry(entry) {
	return util.prettyDate(entry._date) + "  |  " +
		entry._lessons + "  |  " +
		entry._classes + "  |  " +
		entry._teacher + "  |  " +
		entry._subject + "  |  " +
		(entry._dropped ? "entfällt" : "findet statt") + "  |  " +
		entry._room + "  |  " +
		entry._notice;
}

function prettyPeriod(period) {
	return util.prettyDate(period._start) + " - " + util.prettyDate(period._end);
}

function printPlan(plan) {
	console.log("Schuljahr:", plan._schoolYear);
	console.log("Untis Version:", plan._untisVersion);
	console.log("Datum:", util.prettyDateTime(plan._date));
	console.log("Zeitraum:", prettyPeriod(plan._period));

	console.log("Einträge:");

	for(var i = 0; i < plan._entries.length; i++) {
		console.log(prettyEntry(plan._entries[i]));
	}
}

fs.readFile(filename, function (err, data) {
	if(err) {
		console.error("Read error:", err);
	} else {
		var plan = VP.deserialize(data);

		printPlan(plan);
	}
});