
function VertretungsPlan() {
	this._schoolYear = null;
	this._untisVersion = null;
	this._date = null;
	this._period = null;

	this._entries = [];
}

VertretungsPlan.prototype.setSchoolYear = function (schoolYear) {
	this._schoolYear = schoolYear;
};

VertretungsPlan.prototype.setUntisVersion = function (untisVersion) {
	this._untisVersion = untisVersion;
};

VertretungsPlan.prototype.setDate = function (date) {
	this._date = date;
};

VertretungsPlan.prototype.setPeriod = function (period) {
	this._period = period;
};

VertretungsPlan.prototype.addEntry = function (entry) {
	this._entries.push(entry);
};

VertretungsPlan.prototype.serialize = function () {
	var data = {};

	data.schoolYear = this._schoolYear;
	data.untisVersion = this._untisVersion;
	data.date = this._date.getTime();
	data.period = this._period.serialize();

	data.entries = [];

	for(var i = 0; i < this._entries.length; i++) {
		data.entries.push(this._entries[i].serialize());
	}

	return JSON.stringify(data);
};

VertretungsPlan.deserialize = function (str) {
	try {
		var data = JSON.parse(str);

		var plan = new VertretungsPlan();

		plan._schoolYear = data.schoolYear;
		plan._untisVersion = data.untisVersion;
		plan._date = new Date(data.date);
		plan._period = Period.deserialize(data.period);

		for(var i = 0; i < data.entries.length; i++) {
			plan._entries.push(Entry.deserialize(data.entries[i]));
		}

		return plan;
	} catch(e) {
		throw new Error("Invalid format");
	}
};

function Period(start, end) {
	this._start = start || null;
	this._end = end || null;
}

Period.prototype.setStart = function (start) {
	this._start = start;
};

Period.prototype.setEnd = function (end) {
	this._end = end;
};

Period.prototype.serialize = function () {
	var data = {};

	data.start = this._start.getTime();
	data.end = this._end.getTime();

	return data;
};

Period.deserialize = function (data) {
	var period = new VertretungsPlan.Period();

	period._start = new Date(data.start);
	period._end = new Date(data.end);

	return period;
};

function Entry(date, lessons, classes, teacher, subject, dropped, room, notice) {
	this._date = date || null;
	this._lessons = lessons || null;
	this._classes = classes || null;
	this._teacher = teacher || null;
	this._subject = subject || null;
	this._dropped = !!dropped;
	this._room = room || null;
	this._notice = notice || "";
}

Entry.prototype.setDate = function (date) {
	this._date = date;
};

Entry.prototype.setLessons = function (lessons) {
	this._lessons = lessons;
};

Entry.prototype.setClasses = function (classes) {
	this._classes = classes;
};

Entry.prototype.setTeacher = function (teacher) {
	this._teacher = teacher;
};

Entry.prototype.setSubject = function (subject) {
	this._subject = subject;
};

Entry.prototype.setDropped = function (dropped) {
	this._dropped = dropped;
};

Entry.prototype.setRoom = function (room) {
	this._room = room;
};

Entry.prototype.setNotice = function (notice) {
	this._notice = notice;
};

Entry.prototype.serialize = function () {
	var data = {};

	data.date = this._date.getTime();
	data.lessons = this._lessons;
	data.classes = this._classes;
	data.teacher = this._teacher;
	data.subject = this._subject;
	data.dropped = this._dropped;
	data.room = this._room;
	data.notice = this._notice;

	return data;
};

Entry.deserialize = function (data) {
	var entry = new Entry();
	
	entry._date = new Date(data.date);
	entry._lessons = data.lessons;
	entry._classes = data.classes;
	entry._teacher = data.teacher;
	entry._subject = data.subject;
	entry._dropped = data.dropped;
	entry._room = data.room;
	entry._notice = data.notice;

	return entry;
};

module.exports = VertretungsPlan;
module.exports.Period = Period;
module.exports.Entry = Entry;
