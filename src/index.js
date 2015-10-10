
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

function processPDF(pdf) {
	var width = pdf.Width;

	console.log("[Test] Page width:", width);
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