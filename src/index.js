
var url = require("url"),
	path = require("path"),
	fs = require("fs");
var PDFParser = require("pdf2json"),
	cheerio = require("cheerio"),
	request = require("request"),
	mkdirp = require("mkdirp");

var config = {
	url: "http://tgsindelfingen.de/vertretungs-und-ausfallplaene/",
	cacheDir: path.join(__dirname, "cache")
};

function prettyDate(date) {
	return "hhu";
	//return date.getDate() + "." + (date.getMonth() + 1) + "." + date.getFullYear();
}

function prettyJSON(obj) {
	return JSON.stringify(obj, function (key, value) {
		switch(typeof value) {
			case "undefined":
				return "[undefined]";
			case "function":
				return "[function]";
			case "object":
				if(value instanceof Date) {
					return prettyDate(value);
				} else {
					return value;
				}
			default:
				return value;
		}
	}, 4);
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
	return new Date(year || 0, month || 0, day || 0, hour || 0, minute || 0, second || 0, milliscond || 0);
}

function processPDFPage(pageNum, page) {
	console.log("Page " + pageNum);

	var data = {};

	var texts = page.Texts;

	var now = new Date();
	var planYear = now.getFullYear();

	var finished = false, inTable = false, colIndex = 0, currentCol;
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
			if(rVertretungsDay.test(str)) { // Test this first because it introduces the table
				if(!inTable) {
					inTable = true;

					data.table = [];
				} else if(currentCol) {
					data.table.push(currentCol);
				}

				currentCol = {};

				colIndex = 0;

				m = str.match(rVertretungsDay);

				//var day = m[1],
				//	month = m[2];
				//var date = new Date(); // T ODO: zero all others (full constructor; see plan date)
				//
				//date.setMonth(month - 1, day);

				var date = shortDate(planYear, m[2] - 1, m[1]);

				currentCol.date = date;
			} else if(inTable) { // We are currently in the table
				if(rTableEnd.test(str)) {
					inTable = false;
					finished = true;
				} else {
					colIndex++;

					if(colIndex == 1) {
						m = str.match(rLessons);

						currentCol.lessons =m[1] + "-" + m[2];
					} else if(colIndex == 2) {
						// Skip day name (e.g. Mo/Di/Mi/...)
					} else if(colIndex == 3) {
						// Classes
						currentCol.classes = str;
					//} else if(colIndex == 4) {
						// Teacher
						// TODO: Web -> Nu (maybe colIndexShift; see line below)
					//} else if(colIndex == 5 + colIndexShift) { // TODO
					} else {
						currentCol["column#" + colIndex] = str;
					}
				}
			} else { // We are still before the table
				if(rSchoolYear.test(str)) {
					m = str.match(rSchoolYear);

					data.schoolYear = m[1] + "/" + m[2];
				} else if(rUntisVersion.test(str)) {
					m = str.match(rUntisVersion);

					data.untisVersion = m[1];
				} else if(rPlanDate.test(str)) {
					m = str.match(rPlanDate);

					//var day = m[1],
					//	month = m[2],
					//	year = m[3],
					//	hour = m[4],
					//	minute = m[5];

					var planDate = shortDate(m[3], m[2] - 1, m[1], m[4], m[5]);

					planYear = planDate.getFullYear();

					data.date = planDate;
				} else if(rPlanFromTo.test(str)) {
					m = str.match(rPlanFromTo);

					//var day1 = m[1],
					//	month1 = [2],
					//	day2 = m[3],
					//	month2 = m[4];

					var fromDate = shortDate(planYear, m[2] - 1, m[1]),
						toDate = shortDate(planYear, m[4] - 1, m[3]);

					data.from = fromDate;
					data.to = toDate;
				}
			}
		}
	}

	data.table.push(currentCol);

	console.log(prettyJSON(data));
}

function processPDF(pdf) {
	console.log("Extracting information");

	var data = pdf.data;
	var pages = data.Pages;
	var numPages = pages.length;

	for(var i = 0; i < numPages; i++) {
		processPDFPage(i, pages[i]);
	}
}

function parsePDF(filename) {
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

getVertretungsplan(config.url);