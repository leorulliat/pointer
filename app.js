require("dotenv").config();
const { render } = require("ejs");
const express = require("express");
const mongoose = require('mongoose')
const moment = require("moment")
const auth = require('./auth')
const path = require("path")
require('moment-timezone');
const app = express();


const Point = require('./models/pointSchema')
const Week = require('./models/weekSchema')
const minutesWeek = 2340;		//minutes dans une semaine
const minutesDayStandard = 468; //minutes dans un jour
const minutesDay8 = 480;		//minutes dans un jour de 8h

const PORT = process.env.PORT;

app.set('view engine', 'ejs');
app.set('views', path.resolve( __dirname, 'views') );
app.use(express.json())
moment.tz.setDefault('Europe/Paris');

/** CONNECTION MONGOOSE */

mongoose.connect(
	process.env.DATABASE_URL,
	{ 
		user: process.env.LOGIN_BDD,
		pass: process.env.PWD_BDD, 
		useNewUrlParser: true, 
		useUnifiedTopology: true
	}
)
const db = mongoose.connection
db.on('error', (error) => console.error(error))
db.once('open', () => console.log("Connected to Database"))


const durationDay8 = moment.duration("08:00:00")
const durationDayStd = moment.duration("07:48:00")
const fakeLunch = moment.duration("1:20:00");

app.get('/', (req,res) => {
	
	res.render("index");
})

app.get('/today', auth, async (req,res) => {
	var date = getCurrentDate();
	var endOfDay = false;
	try{
		const points = await Point.find({date});
		var sMsg = "";
		var durationMorning = moment.duration("00:00:00")
		var durationLunch = moment.duration("00:00:00")
		var durationAfternoon = moment.duration("00:00:00")
		var currentTime = moment();
		var tabPoints = []
		points.forEach(item => {
			tabPoints.push(item.time)
		})
		var bfakeLunch = false;
		switch(points.length){
			case 0:
				sMsg = "Pointer le début de journée"
				bfakeLunch = true
				break;
			case 1:
				sMsg = "Pointer la pause de midi"
				durationMorning = moment.duration(currentTime.diff(toMomentTime(tabPoints[0])))
				bfakeLunch = true
				break;
			case 2:
				sMsg = "Pointer le retour de pause"
				durationMorning = moment.duration(toMomentTime(tabPoints[1]).diff(toMomentTime(tabPoints[0])))
				durationLunch = moment.duration(currentTime.diff(toMomentTime(tabPoints[1])))
				break;
			case 3:
				sMsg = "Pointer la fin de journée"
				durationMorning = moment.duration(toMomentTime(tabPoints[1]).diff(toMomentTime(tabPoints[0])))
				durationLunch = moment.duration(toMomentTime(tabPoints[2]).diff(toMomentTime(tabPoints[1])))
				durationAfternoon = moment.duration(currentTime.diff(toMomentTime(tabPoints[2])))
				break;
			case 4:
				sMsg = "Journée terminée"
				durationMorning = moment.duration(toMomentTime(tabPoints[1]).diff(toMomentTime(tabPoints[0])))
				durationLunch = moment.duration(toMomentTime(tabPoints[2]).diff(toMomentTime(tabPoints[1])))
				durationAfternoon = moment.duration(toMomentTime(tabPoints[3]).diff(toMomentTime(tabPoints[2])))
				endOfDay = true;
				break;
		}
		if(bfakeLunch){
			var info = "prévois "+moment.utc(fakeLunch.as('milliseconds')).format("HH:mm")+" h pour la pause de midi";
		}
		res.json({
			success : true,
			workTime : getFormatTimes(durationMorning, durationLunch, durationAfternoon, endOfDay, bfakeLunch),
			msg : sMsg,
			points : tabPoints,
			info
		})
	}catch(err){
		res.status(500).json({
			success : false,
			msg : err
		})
	}
})

app.post("/pointer", auth, async (req,res) => {
	const pointTime = req.body.time
	var sDate = getCurrentDate()
	var sTime;
	if(pointTime != undefined){
		sTime = moment(pointTime,"HH:mm").format("HH:mm:ss")
	}else{
		sTime = moment().format("HH:mm:ss")
	}
	var point = new Point({
		date: sDate,
		time: sTime
	})
	
    try {
		const points = await Point.find({date:sDate})
		var nbPoints = points.length;
		if(nbPoints < 4){
			await point.save()
		}else{
			res.json({success : false, msg: "Journée déjà terminée"})
			return
		}
    } catch (err) {
        res.status(500).json({success : false, msg: err.message})
    }
	
	var wayIn = Boolean((nbPoints + 1) % 2)
	res.status(201).json({success : false, wayIn})
})

app.get('/week', auth, async (req,res) => {
	const date = getCurrentDate()
	const week = getCurrentWeek()
    try {
		var oWeek = await Week.findOne({week})
		if(!oWeek){
			var oWeek = {
				week,
				minutesWork: 0,
				nbDaysClosed: 0,
				majDate: date
			}
		}
		var conisgne8 = ((minutesDay8)*oWeek.nbDaysClosed);
		if(oWeek.nbDaysClosed > 4){
			conisgne8 -+ 60;	// on enleve une heure pour arriver a 39H
		}
		var conisgneStd = ((minutesDayStandard)*oWeek.nbDaysClosed);
		
		var dayStd = {
			consigne : conisgneStd,
			delta : Math.abs(oWeek.minutesWork-conisgneStd).toFixed(2),
			heureSup : (oWeek.minutesWork >= conisgneStd)
		}
		var day8 = {
			consigne : conisgne8,
			delta : Math.abs(oWeek.minutesWork-conisgne8).toFixed(2),
			heureSup : (oWeek.minutesWork >= conisgne8)
		}
		if(oWeek.nbDaysClosed > 4){
			dayStd = day8 = undefined
		}
		res.json({success: true, res:{
			week: oWeek.week,
			timeWorked: oWeek.minutesWork,	// changer en temps
			timeLeft: minutesWeek - oWeek.minutesWork,
			nbDaysClosed: oWeek.nbDaysClosed,
			dayStd,
			day8,
			currentDayClosed : (oWeek.majDate == date)
		}})
    } catch (err) {
        res.status(500).json({success : false, msg: err.message})
    }
})

app.post("/close", auth, async (req,res) => {
	const forceUpdate = req.body.force
	const date = getCurrentDate()
	const week = getCurrentWeek()
    try {
		const points = await Point.find({date})
		var tabPoints = []
		points.forEach(item => {
			tabPoints.push(item.time)
		})
		if(tabPoints.length < 4){
			throw new Error("Journée non terminée")
		}
		var durationMorning = moment.duration(toMomentTime(tabPoints[1]).diff(toMomentTime(tabPoints[0])))
		var durationAfternoon = moment.duration(toMomentTime(tabPoints[3]).diff(toMomentTime(tabPoints[2])))

		var timeWorkedToday = moment.duration(durationMorning+durationAfternoon).asMinutes().toFixed(2)
		var oWeek = await Week.findOne({week})
		var timeWorkedWeek;
		if(oWeek){
			if(!forceUpdate && oWeek.majDate == date){
				throw new Error("Journée déjà cloturée");
			}
			timeWorkedWeek = (oWeek.minutesWork + parseFloat(timeWorkedToday)).toFixed(2)
			await Week.findOneAndUpdate({week}, {minutesWork: timeWorkedWeek, nbDaysClosed: (oWeek.nbDaysClosed + 1), majDate: date});
		}else{
			var oWeek = new Week({
				week,
				minutesWork: timeWorkedToday,
				nbDaysClosed: 1,
				majDate: date
			})
			await oWeek.save()
			timeWorkedWeek = timeWorkedToday;
		}
		// nbHSupp A CALCULER
		res.json({success : true, timeWorkedToday, timeWorkedWeek})
    } catch (err) {
        res.status(500).json({message: err.message})
    }
})

app.listen(PORT, () => console.log(`Server started on port : ${PORT}`));


/******  FUNCTION ******/

function getCurrentDate(){
	return moment().format("YYYY-MM-DD");
}

function getCurrentWeek(){
    currentDate = new Date();
    startDate = new Date(currentDate.getFullYear(), 0, 1);
    var days = Math.floor((currentDate - startDate) /
        (24 * 60 * 60 * 1000));
         
    return Math.ceil(days / 7);
}

function toMomentTime(item){
	return moment(item,"HH:mm:ss")
}

function getFormatTimes(durationMorning,durationLunch,durationAfternoon, endOfDay, bfakeLunch){
	var day8 = {}
	var dayStd = {};
	if(!endOfDay){
		var dLunch = bfakeLunch ? fakeLunch : moment.duration("00:00:00")
		day8.consigne = moment(moment.duration(moment())+(durationDay8-(durationMorning+durationAfternoon-dLunch))).format("HH:mm:ss")
		dayStd.consigne = moment(moment.duration(moment())+(durationDayStd-(durationMorning+durationAfternoon-dLunch))).format("HH:mm:ss")
	}else{
		const oDuration8 = _getDurations(durationMorning,durationAfternoon,durationDay8)
		const oDurationStd = _getDurations(durationMorning,durationAfternoon,durationDayStd)
		day8.delta = moment.utc(oDuration8.duration1-oDuration8.duration2).format("HH:mm:ss")
		day8.heureSup = oDuration8.heureSup;
		dayStd.delta = moment.utc(oDurationStd.duration1-oDurationStd.duration2).format("HH:mm:ss")
		dayStd.heureSup = oDurationStd.heureSup;
	}
	return {
		morning : moment.utc(durationMorning.as('milliseconds')).format("HH:mm:ss"),
		lunch : moment.utc(durationLunch.as('milliseconds')).format("HH:mm:ss"),
		afternoon : moment.utc(durationAfternoon.as('milliseconds')).format("HH:mm:ss"),
		totalWork : moment.utc(durationMorning+durationAfternoon).format("HH:mm:ss"),
		day8,
		dayStd
	}
}

function _getDurations(durationMorning,durationAfternoon,durationDay){
	if(durationDay > (durationMorning+durationAfternoon)){
		return {
			duration1 : durationDay,
			duration2 : moment.duration(durationMorning+durationAfternoon),
			heureSup : false
		}
	}else{
		return {
			duration1 : moment.duration(durationMorning+durationAfternoon),
			duration2 : durationDay,
			heureSup : true
		}
	}
}

function showDuration(d){
	console.log(moment.utc(d.as('milliseconds')).format("HH:mm:ss"))
}