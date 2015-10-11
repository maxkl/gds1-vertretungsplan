
var url = require("url"),
	path = require("path"),
	fs = require("fs");
var PDFParser = require("pdf2json"),
	cheerio = require("cheerio"),
	request = require("request"),
	mkdirp = require("mkdirp");
var VP = require("./lib/vertretungs-plan"),
	VPEntry = VP.Entry,
	VPPeriod = VP.Period;

var ARROW_CHAR = "\u2192";

var config = {
	url: "http://tgsindelfingen.de/vertretungs-und-ausfallplaene/",
	cacheDir: path.join(__dirname, "cache")
};

function l() {
	console.log.apply(console, arguments);
}

function le() {
	console.error().apply(console, arguments);
}

var
	// General data
	rSchoolYear = /^Stundenplan (\d{4})\/(\d{4})$/,
	rUntisVersion = /^Untis (.*)$/,
	rPlanDate = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{1,2})$/,
	rPlanFromTo = /^TG-Vertretungsplan\s+(\d{1,2})\.(\d{1,2})\. - (\d{1,2})\.(\d{1,2})\.$/,

	// In table
	rVertretungsDay = /^(\d{1,2})\.(\d{1,2})\.$/,
	rLessons = /^(\d{1,2}) - (\d{1,2})$/,

	// After table
	rTableEnd = /^.*G r u b e r  &  P e t t e r s   S o f t w a r e.*$/;

function shortDate(year, month, day, hour, minute, second, milliscond) {
	return new Date(+year || 0, +month || 0, +day || 0, +hour || 0, +minute || 0, +second || 0, +milliscond || 0);
}

function processPDFPage(pageNum, page) {
	// TODO: multi-page

	//var data = {};
	var plan = new VP();

	var texts = page.Texts;

	var now = new Date();
	var planYear = now.getFullYear();

	//var finished = false, inTable = false, colIndex = 0, currentRow = null;
	var finished = false, inTable = false, colIndex = 0, currentEntry = null, teacher = null, subject = null;
	for(var i = 0; i < texts.length; i++) {
		//var x = texts[i].x;
		//var y = texts[i].y;
		//var color = texts[i].clr;
		//var origColor = texts[i].oc;
		//var align = texts[i].A;
		//var textRuns = texts[i].R;
		//var str = textRuns[0].T;
		//str = decodeURIComponent(str);

		var str = decodeURIComponent(texts[i].R[0].T);

		var m;
		if(!finished) {
			if(rVertretungsDay.test(str)) { // Test this first because it starts the table
				if(!inTable) {
					// Table started

					inTable = true;

					//data.table = [];
				} else if(currentEntry) {
					// Push last row
					//data.table.push(currentRow);
					plan.addEntry(currentEntry);
				}

				//currentRow = {};
				currentEntry = new VPEntry();
				colIndex = 0;
				teacher = null;
				subject = null;

				m = str.match(rVertretungsDay);

				var date = shortDate(planYear, m[2] - 1, m[1]);

				//currentRow.date = date;
				currentEntry.setDate(date);

				colIndex++;
			} else if(inTable) { // We are currently in the table
				if(rTableEnd.test(str)) {
					// Table end

					// Push last row
					//data.table.push(currentRow);
					plan.addEntry(currentEntry);

					inTable = false;
					finished = true;
				} else {
					if(colIndex == 1) { // TODO: switch instead of if/else
						m = str.match(rLessons);

						//currentRow.lessons = m[1] + "-" + m[2];
						currentEntry.setLessons(m[1] + "-" + m[2]);

						colIndex++;
					} else if(colIndex == 2) {
						// Skip day name (e.g. Mo/Di/Mi/...)

						colIndex++;
					} else if(colIndex == 3) {
						// Classes

						//currentRow.classes = str;
						currentEntry.setClasses(str);

						colIndex++;
					} else if(colIndex == 4) {
						// Teacher

						//if(currentRow.teacher) {
						//	currentRow.teacher += " -> " + str; // TODO better format (as object ??)
						//} else {
						//	currentRow.teacher = str;
						//}
						if(teacher) {
							teacher += " -> " + str; // TODO better format (as object ??)
						} else {
							teacher = str;
						}
						currentEntry.setTeacher(teacher);

						colIndex++;
					} else if(colIndex == 5) {
						if(str === ARROW_CHAR) {
							// Teacher continues

							colIndex--;
						} else {
							// Subject

							//if(currentRow.subject) {
							//	currentRow.subject += " -> " + str;
							//} else {
							//	currentRow.subject = str;
							//}

							if(subject) {
								subject += " -> " + str;
							} else {
								subject = str;
							}
							currentEntry.setSubject(subject);

							colIndex++;
						}
					} else if(colIndex == 6) {
						if(str === ARROW_CHAR) {
							colIndex--;
						} else {
							// Dropped and/or room

							if(str.charAt(0) === "x") {
								// x means dropped

								//currentRow.dropped = true;
								currentEntry.setDropped(true);

								if(str.length > 1) {
									// Dropped and room can be in the same column

									//currentRow.room = str.slice(1);
									currentEntry.setRoom(str.slice(1));

									colIndex++;
								}
							} else {
								// No x means not dropped -> skip to room

								//currentRow.dropped = false;
								//currentRow.room = str;
								currentEntry.setDropped(false);
								currentEntry.setRoom(str);

								colIndex++;
							}

							colIndex++;
						}
					} else if(colIndex == 7) {
						// Room

						//currentRow.room = str;
						currentEntry.setRoom(str);

						colIndex++;
					} else if(colIndex == 8) {
						// Notice

						//currentRow.notice = str;
						currentEntry.setNotice(str);

						colIndex++;
					}/* else {
						// Any other (debugging only)

						currentRow["#" + colIndex] = str;

						colIndex++;
					}*/
				}
			} else { // We are still before the table
				if(rSchoolYear.test(str)) {
					// School year

					m = str.match(rSchoolYear);

					//data.schoolYear = m[1] + "/" + m[2];
					plan.setSchoolYear(m[1] + "/" + m[2]);
				} else if(rUntisVersion.test(str)) {
					// Untis version

					m = str.match(rUntisVersion);

					//data.untisVersion = m[1];
					plan.setUntisVersion(m[1]);
				} else if(rPlanDate.test(str)) {
					// Plan date

					m = str.match(rPlanDate);

					var planDate = shortDate(m[3], m[2] - 1, m[1], m[4], m[5]);

					planYear = planDate.getFullYear();

					//data.date = planDate;
					plan.setDate(planDate);
				} else if(rPlanFromTo.test(str)) {
					// Plan start & end dates

					m = str.match(rPlanFromTo);

					var fromDate = shortDate(planYear, m[2] - 1, m[1]),
						toDate = shortDate(planYear, m[4] - 1, m[3]);

					//data.from = fromDate;
					//data.to = toDate;

					plan.setPeriod(new VPPeriod(fromDate, toDate));
				}
			}
		}
	}

	// Processing finished !!

	//console.log(prettyJSON(data));

	//console.log(plan.serialize());

	var filename = "database";

	// TODO: multi-page
	fs.writeFile(filename, plan.serialize(), function (err) {
		if(err) {
			console.error("Write error:", err);
		} else {
			console.log("Write successful!");

			console.timeEnd("All");
		}
	});
}

function processPDF(pdf) {
	console.log("Extracting information");

	var data = pdf.data;
	var pages = data.Pages;
	var numPages = pages.length;

	for(var i = 0; i < numPages; i++) {
		processPDFPage(i, pages[i]);
	}

	console.timeEnd("Parse PDF");
}

function parsePDF(filename) {
	console.time("Parse PDF");

	var parser = new PDFParser();

	parser.on("pdfParser_dataReady", function (data) {
		console.log("PDF parsing successful!");
		processPDF(data);
	});

	parser.on("pdfParser_dataError", function (err) {
		console.error("PDF parsing error:", err);
	});

	parser.loadPDF(filename);
}

function loadPDF(pdfURL) {
	console.time("Download PDF");

	var urlParts = url.parse(pdfURL);
	var urlPath = urlParts.pathname;
	var basename = path.basename(urlPath);
	var filename = path.join(config.cacheDir, basename);

	console.log("PDF file name:", filename);

	mkdirp(config.cacheDir, function (err) {
		if(err) {
			console.error("Could not create cache dir:", err);
		} else {
			console.log("Created cache dir");

			var stream = fs.createWriteStream(filename);

			stream.on("finish", function () {
				console.log("Downloaded PDF");

				console.timeEnd("Download PDF");
				console.timeEnd("Download");

				parsePDF(filename);
			});

			stream.on("error", function (err) {
				console.error("PDF file stream error:", err);
			});

			request(pdfURL)
				.on("error", function (err) {
					console.error("PDF download error:", err);
				})
				.pipe(stream);
		}
	});
}

function getVertretungsplan(url) {
	console.log("Loading ", url);

	request({
		url: url,
		followRedirect: false
	}, function (err, res, body) {
		if(err) {
			console.error("Page request error:", err);
		} else {
			if(res.statusCode === 200) {
				console.timeEnd("Download website");

				var $ = cheerio.load(body);

				var link = $(".entry-content a");
				var href = link.attr("href");

				if(href) {
					console.log("Found PDF:", href);

					loadPDF(href);
				} else {
					console.error("PDF url is:", href);
				}
			} else {
				console.error("Unexpected status: " + res.statusCode);
			}
		}
	});
}

console.time("All");
console.time("Download");
console.time("Download website");

getVertretungsplan(config.url);