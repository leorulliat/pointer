require("dotenv").config();
const express = require("express");
const mongoose = require('mongoose')
const moment = require("moment")
const auth = require('./auth')
require('moment-timezone');
const app = express();


const Point = require('./models/pointSchema')
const Supp = require('./models/suppSchema')

const PORT = process.env.PORT;

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


const durationDay = moment.duration("08:00:00")


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
		switch(points.length){
			case 0:
				sMsg = "Pointer le début de journée"
				break;
			case 1:
				sMsg = "Pointer la pause de midi"
				durationMorning = moment.duration(currentTime.diff(toMomentTime(tabPoints[0])))
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
		res.json({
			success : true,
			nb : points.length,
			workTime : getFormatTimes(durationMorning, durationLunch, durationAfternoon, durationDay, endOfDay),
			msg : sMsg,
			points : tabPoints
		})
	}catch(err){
		res.status(500).json({
			success : false,
			msg : err
		})
	}
})

app.post("/pointer", auth, async (req,res) => {
	var sDate = getCurrentDate()
	var sTime = moment().format("HH:mm:ss")
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
		var oSupp = await Supp.findOne({week})
		res.json({success: true, res:{
			week: oSupp.week,
			time: oSupp.minutes,	// changer en temps
			dayClosed : (oSupp.majDate == date)
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
		var durationMorning = moment.duration(toMomentTime(tabPoints[1]).diff(toMomentTime(tabPoints[0])))
		var durationAfternoon = moment.duration(toMomentTime(tabPoints[3]).diff(toMomentTime(tabPoints[2])))
		var duration1, duration2, isHSupp;
		if(durationDay > (durationMorning+durationAfternoon)){
			duration1 = durationDay;
			duration2 = (durationMorning+durationAfternoon);
			isHSupp = false;
		}else{
			duration1 = (durationMorning+durationAfternoon);
			duration2 = durationDay;
			isHSupp = true;
		}
		var delta = moment.duration(duration1-duration2).asMinutes()
		var nbHSupp = isHSupp ? delta.toFixed(2) : -delta.toFixed(2);
		if(points.length >= 4){
			var oSupp = await Supp.findOne({week})
			if(oSupp){
				if(!forceUpdate && oSupp.majDate == date){
					throw new Error("Journée déjà cloturée");
				}
				nbHSupp = (oSupp.minutes + nbHSupp).toFixed(2)
				await Supp.findOneAndUpdate({week}, {minutes: nbHSupp, majDate: date});
			}else{
				const defaultHSupp = 60;
				nbHSupp = nbHSupp+defaultHSupp;
				var oHSupp = new Supp({
					week,
					minutes: nbHSupp,
					majDate: date
				})
				await oHSupp.save()
			}
			res.json({success : true, value: nbHSupp})
		}else{
			res.json({success : false, msg: "Journée non terminée"})
			return
		}
    } catch (err) {
        res.status(500).json({message: err.message})
    }
})

app.listen(PORT, () => console.log(`Server started on port : ${PORT}`));


/******  FUNCTION ******/

function checkAuth(){
	if(req.headers.token != TOKEN){
		res.status(401).send("Unauthorized")
	}
}

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

function getTimeDiff(time1, time2){
	var mins = moment.utc(moment(time2, "HH:mm:ss").diff(moment(time1, "HH:mm:ss")))
	return mins.format("HH:mm:ss")
}

function toMomentTime(item){
	return moment(item,"HH:mm:ss")
}

function getFormatTimes(durationMorning,durationLunch,durationAfternoon, durationDay, endOfDay){
	if(!endOfDay){
		var consigne = moment(moment.duration(moment())+(durationDay-(durationMorning+durationAfternoon))).format("HH:mm:ss")
	}else{
		var duration1, duration2, heureSup;
		if(durationDay > (durationMorning+durationAfternoon)){
			duration1 = durationDay;
			duration2 = (durationMorning+durationAfternoon);
			heureSup = false;
		}else{
			duration1 = (durationMorning+durationAfternoon);
			duration2 = durationDay;
			heureSup = true;
		}
		var delta = moment.utc(duration1-duration2).format("HH:mm:ss")
	}
	return {
		morning : moment.utc(durationMorning.as('milliseconds')).format("HH:mm:ss"),
		lunch : moment.utc(durationLunch.as('milliseconds')).format("HH:mm:ss"),
		afternoon : moment.utc(durationAfternoon.as('milliseconds')).format("HH:mm:ss"),
		totalWork : moment.utc(durationMorning+durationAfternoon).format("HH:mm:ss"),
		consigne,
		delta,
		heureSup
	}
}