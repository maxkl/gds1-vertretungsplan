/**
 * Copyright: (c) 2015 Max Klein
 * License: MIT
 */

var url = require("url"),
	path = require("path"),
	fs = require("fs");
var PDFParser = require("pdf2json"),
	cheerio = require("cheerio"),
	request = require("request"),
	mkdirp = require("mkdirp"),
	mongodb = require("mongodb"),
	MongoClient = mongodb.MongoClient;

var ARROW_CHAR = "\u2192";

var config = {
	url: "http://tgsindelfingen.de/vertretungs-und-ausfallplaene/",
	cacheDir: path.join(__dirname, "cache"),
	dbUrl: "mongodb://localhost:27017/maxkl_de"
};

/**
 * Regular expressions for parsing
 * @type {RegExp}
 */
var
	// General data
	rSchoolYear = /^Stundenplan (\d{4})\/(\d{4})$/,
	rUntisVersion = /^Untis (.*)$/,
	rPlanDate = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{1,2})$/,
	rPlanFromTo = /^TG-Vertretungsplan\s+(\d{1,2})\.(\d{1,2})\. - (\d{1,2})\.(\d{1,2})\.$/,

	// In table
	rVertretungsDay = /^(\d{1,2})\.(\d{1,2})\.$/,
	rLessons = /^(\d{1,2})(?: - (\d{1,2}))?$/,

	// After table
	rTableEnd = /^.*G r u b e r  &  P e t t e r s   S o f t w a r e.*$/;

function storeResult(plan, callback) {
	var insertData = [];

	//plan:
	//{
	//	schoolYear: null, // planDate
	//	untisVersion: null, // don't care
	//	date: null,
	//	fromDate: null, // don't care
	//	toDate: null, // don't care
	//	entries: []
	//};
	//
	//entry:
	//{
	//	date: null,
	//	startLesson: null, TODO
	//	endLesson: null, TODO
	//	classes: null,
	//	teacher: null,
	//	substituteTeacher: null,
	//	subject: null,
	//	substituteSubject: null,
	//	dropped: null,
	//	room: null,
	//	text: null
	//};

	var entries = plan.entries, entry;
	for(var i = 0; i < entries.length; i++) {
		entry = entries[i];

		insertData.push({
			planDate: plan.date,

			date: entry.date,
			startLesson: entry.startLesson,
			endLesson: entry.endLesson,
			classes: entry.classes,
			teacher: entry.teacher,
			substituteTeacher: entry.substituteTeacher,
			subject: entry.subject,
			substituteSubject: entry.substituteSubject,
			dropped: entry.dropped,
			room: entry.room,
			text: entry.text
		});
	}

	var db = null, vertretungen = null;

	/**
	 * Remove all entries with dates that we have new data for
	 */
	function removeOldEntries() {
		// Remove entries whose date is covered by the new data
		vertretungen.deleteMany({
			date: {
				$gte: plan.fromDate,
				$lte: plan.toDate
			}
		}, function (err, result) {
			if(err) {
				//console.error("DB delete error:", err);
				callback(new Error("DB delete error: " + err.message));
				return;
			}

			console.log("DB delete successful!", result.deletedCount);

			insertNewEntries();
		});
	}

	function insertNewEntries() {
		vertretungen.insertMany(insertData, function (err, result) {
			if(err) {
				//console.error("DB insert error:", err);
				callback(new Error("DB insert error: " + err.message));
				return;
			}

			console.log("DB insert successful!", result.insertedCount);

			db.close();

			callback(null, "blub");
		});
	}

	MongoClient.connect(config.dbUrl, function (err, database) {
		if(err) {
			//console.error("DB connect error:", err);
			callback(new Error("DB connect error: " + err.message));
			return;
		}

		db = database;

		vertretungen = db.collection("vertretungen");

		removeOldEntries();
	});
}

function shortDate(year, month, day, hour, minute, second, milliscond) {
	return new Date(+year || 0, +month || 0, +day || 0, +hour || 0, +minute || 0, +second || 0, +milliscond || 0);
}

/**
 *
 * @param {int} pageNum
 * @param {*} page
 * @return {{schoolYear: int, untisVersion: string, date: Date, fromDate: Date, toDate: Date, entries: Array}}
 */
function processPDFPage(pageNum, page) {
	var data = {
		schoolYear: null,
		untisVersion: null,
		date: null,
		fromDate: null,
		toDate: null,
		entries: []
	};

	var texts = page.Texts;

	var now = new Date();
	var planYear = now.getFullYear();

	var finished = false, inTable = false, colIndex = 0, currentEntry = null, seenTeacher = false, seenSubject = false;
	for(var i = 0; i < texts.length; i++) {
		var str = decodeURIComponent(texts[i].R[0].T);

		var m;
		if(!finished) {
			if(rVertretungsDay.test(str)) { // Test this first because it starts the table and each row
				if(!inTable) {
					// Table started

					inTable = true;
				} else if(currentEntry) {
					// Only if we were in the table before

					// Push last row
					data.entries.push(currentEntry);
				}

				currentEntry = {
					date: null,
					startLesson: null,
					endLesson: null,
					classes: null,
					teacher: null,
					substituteTeacher: null,
					subject: null,
					substituteSubject: null,
					dropped: null,
					room: null,
					text: null
				};

				colIndex = 0;
				seenTeacher = false;
				seenSubject = false;

				m = str.match(rVertretungsDay);

				currentEntry.date = shortDate(planYear, m[2] - 1, m[1]);

				colIndex++;
			} else if(inTable) { // We are currently in the table
				if(rTableEnd.test(str)) {
					// Table end

					// Push last entry
					data.entries.push(currentEntry);

					inTable = false;
					finished = true;
				} else {
					if(colIndex == 1) { // TODO: switch instead of if/else
						m = str.match(rLessons);

						//if(m) {
						if(m[2]) {
							currentEntry.startLesson = +m[1];
							currentEntry.endLesson = +m[2];
						} else {
							currentEntry.startLesson = currentEntry.endLesson = +m[1];
						}
						//}

						colIndex++;
					} else if(colIndex == 2) {
						// Skip day name (e.g. Mo/Di/Mi/...)

						colIndex++;
					} else if(colIndex == 3) {
						// Classes

						// TODO: split into classes
						currentEntry.classes = str
							.split(",")
							.filter(function (e) {
								return e;
							})
							.map(function (e) {
								return e.trim();
							});

						colIndex++;
					} else if(colIndex == 4) {
						// Teacher

						if(seenTeacher) {
							currentEntry.substituteTeacher = str;
						} else {
							seenTeacher = true;
							currentEntry.teacher = str;
						}

						colIndex++;
					} else if(colIndex == 5) {
						if(str === ARROW_CHAR) {
							// We have a substitute teacher -> continue at teacher

							colIndex--;
						} else {
							// Subject

							if(seenSubject) {
								currentEntry.substituteSubject = str;
							} else {
								seenSubject = true;
								currentEntry.subject = str;
							}

							colIndex++;
						}
					} else if(colIndex == 6) {
						if(str === ARROW_CHAR) {
							// We have a substitute subject -> continue at subject

							colIndex--;
						} else {
							// Dropped and/or room

							if(str.charAt(0) === "x") {
								// x means dropped

								currentEntry.dropped = true;

								if(str.length > 1) {
									// Dropped and room can be in the same column

									var room = str.substring(1);

									currentEntry.room = room === "---" ? null : room;

									colIndex++;
								}
							} else {
								// No x means not dropped -> skip to room

								currentEntry.dropped = false;
								currentEntry.room = str === "---" ? null : str;

								colIndex++;
							}

							colIndex++;
						}
					} else if(colIndex == 7) {
						// Room

						currentEntry.room = str === "---" ? null : str;

						colIndex++;
					} else if(colIndex == 8) {
						// Notice

						// Skip if arrow
						if(str !== ARROW_CHAR) {
							currentEntry.text = str;
							colIndex++;
						}
					}
				}
			} else { // We are still before the table
				if(rSchoolYear.test(str)) {
					// School year

					m = str.match(rSchoolYear);

					data.schoolYear = +m[1];
				} else if(rUntisVersion.test(str)) {
					// Untis version

					m = str.match(rUntisVersion);

					data.untisVersion = m[1];
				} else if(rPlanDate.test(str)) {
					// Plan date

					m = str.match(rPlanDate);

					var planDate = shortDate(m[3], m[2] - 1, m[1], m[4], m[5]);

					planYear = planDate.getFullYear();

					data.date = planDate;
				} else if(rPlanFromTo.test(str)) {
					// Plan start & end dates

					m = str.match(rPlanFromTo);

					data.fromDate = shortDate(planYear, m[2] - 1, m[1]);
					data.toDate = shortDate(planYear, m[4] - 1, m[3]);
				}
			}
		}
	}

	return data;
}

/**
 *
 * @param pdf
 */
function processPDF(pdf, callback) {
	console.log("Extracting information");

	var pdfData = pdf.data;
	var pdfPages = pdfData.Pages;
	var pageCount = pdfPages.length;

	var fullPlan = null, data;
	for(var i = 0; i < pageCount; i++) {
		data = processPDFPage(i, pdfPages[i]);

		if(i == 0) {
			fullPlan = data;
		} else {
			fullPlan.entries.push.apply(fullPlan.entries, data.entries);
		}
	}

	storeResult(fullPlan, callback);
}

/**
 *
 * @param filename
 * @param callback
 */
function parsePDF(filename, callback) {
	var parser = new PDFParser();

	parser.on("pdfParser_dataReady", function (data) {
		console.log("PDF parsing successful!");

		// Prevent weird error behaviour
		setImmediate(function () {
			processPDF(data, callback);
		});
	});

	parser.on("pdfParser_dataError", function (err) {
		//console.error("PDF parsing error:", err);
		callback(new Error("PDF parsing error: " + err.message));
	});

	parser.loadPDF(filename);
}

/**
 *
 * @param pdfURL
 * @param callback
 */
function loadPDF(pdfURL, callback) {
	var urlParts = url.parse(pdfURL);
	var urlPath = urlParts.pathname;
	var basename = path.basename(urlPath);
	var filename = path.join(config.cacheDir, basename);

	console.log("PDF file name:", filename);

	mkdirp(config.cacheDir, function (err) {
		if(err) {
			//console.error("Could not create cache dir:", err);
			callback(new Error("Could not create cache dir: " + err.message));
			return;
		}

		console.log("Created cache dir");

		var stream = fs.createWriteStream(filename);

		stream.on("finish", function () {
			console.log("Downloaded PDF");

			parsePDF(filename, callback);
		});

		stream.on("error", function (err) {
			//console.error("PDF file stream error:", err);
			callback(new Error("PDF file stream error: " + err.message));
		});

		// TODO: cache (etag, modified)
		request(pdfURL)
			.on("error", function (err) {
				//console.error("PDF download error:", err);
				callback(new Error("PDF download error: " + err.message));
			})
			.pipe(stream);
	});
}

/**
 *
 * @param url
 * @param callback
 */
function getVertretungsplan(url, callback) {
	console.log("Loading ", url);

	request({
		url: url,
		followRedirect: false
	}, function (err, res, body) {
		if(err) {
			//console.error("Page request error:", err);
			callback(new Error("Page request error: " + err.message));
		} else {
			if(res.statusCode === 200) {
				var $ = cheerio.load(body);

				var link = $(".entry-content a");
				var href = link.attr("href");

				if(href) {
					console.log("Found PDF:", href);

					loadPDF(href, callback);
				} else {
					//console.error("PDF url is:", href);
					callback(new Error("PDF url is: " + href));
				}
			} else {
				//console.error("Unexpected status: " + res.statusCode);
				callback(new Error("Unexpected status: " + res.statusCode));
			}
		}
	});
}

getVertretungsplan(config.url, function (err, data) {
	if(err) {
		console.error("ERROR", err);
		return;
	}

	console.log("SUCCESS", data);

	process.exit(err ? 1 : 0);
});
