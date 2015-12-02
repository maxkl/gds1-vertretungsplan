/**
 * Copyright: (c) 2015 Max Klein
 * License: MIT
 */

var PDFParser = require("pdf2json");

var ARROW_CHAR = "\u2192";

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

function shortDate(year, month, day, hour, minute, second, milliscond) {
	return new Date(+year || 0, +month || 0, +day || 0, +hour || 0, +minute || 0, +second || 0, +milliscond || 0);
}

/**
 *
 * @param {*} page
 * @param {int} pageNum
 * @return {{schoolYear: int|null, untisVersion: string|null, date: Date|null, fromDate: Date|null, toDate: Date|null, entries: Array}}
 */
function processPDFPage(page, pageNum) {
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
					switch(colIndex){
						case 1:
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

							break;

						case 2:
							// Skip day name (e.g. Mo/Di/Mi/...)

							colIndex++;

							break;

						case 3:
							// Classes

							currentEntry.classes = str
									.split(",")
									.map(function (e) {
										return e.trim();
									})
									.filter(function (e) {
										return e;
									});

							colIndex++;

							break;

						case 4:
							// Teacher

							if(seenTeacher) {
								currentEntry.substituteTeacher = str;
							} else {
								seenTeacher = true;
								currentEntry.teacher = str;
							}

							colIndex++;

							break;

						case 5:
							if(str === ARROW_CHAR) {
								// We have a substitute teacher -> continue at teacher

								colIndex--;
							} else if(str.charAt(0) === ARROW_CHAR) {
								// We have a substitute teacher -> continue at teacher

								currentEntry.substituteTeacher = str.substring(1);

								//colIndex--;
								//i--;
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

							break;

						case 6:
							if(str === ARROW_CHAR) {
								// We have a substitute subject -> continue at subject

								colIndex--;
							} else if(str.charAt(0) === ARROW_CHAR) {
								// We have a substitute subject -> continue at subject

								currentEntry.substituteSubject = str.substring(1);

								//colIndex--;
								//i--;
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

							break;

						case 7:
							// Room

							currentEntry.room = str === "---" ? null : str;

							colIndex++;

							break;

						case 8:
							// Notice

							// Skip if arrow
							if(str !== ARROW_CHAR) {
								currentEntry.text = str;
								colIndex++;
							}

							break;
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
 * @param callback
 */
function processPDF(pdf, callback) {
	var pdfData = pdf.data;
	var pdfPages = pdfData.Pages;
	var pageCount = pdfPages.length;

	var fullPlan = null, data;
	for(var i = 0; i < pageCount; i++) {
		data = processPDFPage(pdfPages[i], i);

		if(i == 0) {
			fullPlan = data;
		} else {
			fullPlan.entries.push.apply(fullPlan.entries, data.entries);
		}
	}

	callback(null, fullPlan);
}

/**
 *
 * @param filename
 * @param callback
 */
function parsePDF(filename, callback) {
	var parser = new PDFParser();

	parser.on("pdfParser_dataReady", function (data) {
		// Prevent weird error behaviour
		setImmediate(function () {
			processPDF(data, callback);
		});
	});

	parser.on("pdfParser_dataError", function (err) {
		callback(new Error("PDF parsing error: " + err.message));
	});

	parser.loadPDF(filename);
}

module.exports = parsePDF;
