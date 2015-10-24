
function prettyDate(date) {
	return date.getDate() + "." + (date.getMonth() + 1) + "." + date.getFullYear();
}

function prettyTime(date) {
	var hours = date.getHours(),
		mins = date.getMinutes();

	return (hours < 10 ? "0" + hours : hours) + ":" + (mins < 10 ? "0" + mins : mins);
}

function prettyDateTime(date) {
	return prettyDate(date) + " " + prettyTime(date);
}

function prettyJSON(obj) {
	var origToJSON = Date.prototype.toJSON;

	Date.prototype.toJSON = function () {
		return prettyDateTime(this);
	};

	var str = JSON.stringify(obj, function (key, value) {
		switch(typeof value) {
			case "undefined":
				return "[undefined]";
			case "function":
				return "[function]";
			default:
				return value;
		}
	}, 4);

	Date.prototype.toJSON = origToJSON;

	return str;
}

module.exports.prettyDate = prettyDate;
module.exports.prettyTime = prettyTime;
module.exports.prettyDateTime = prettyDateTime;
module.exports.prettyJSON = prettyJSON;
