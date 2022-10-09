require("dotenv").config();
const express = require("express");
const mongoose = require('mongoose')
const moment = require("moment")
const auth = require('./auth')
require('moment-timezone');
const app = express();


const Point = require('./models/pointSchema')

const PORT = process.env.PORT;

app.use(express.urlencoded({extended: true}))
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

app.get('/today', auth, async (req,res) => {
	var date = getCurrentDate();
	const points = await Point.find({date});
	var sMsg = "";
	switch(points.length){
		case 0:
			sMsg = "Pointer le début de journée"
			break;
		case 1:
			sMsg = "Pointer la pause de midi"
			break;
		case 2:
			sMsg = "Pointer le retour de pause"
			break;
		case 3:
			sMsg = "Pointer la fin de journée"
			break;
		case 4:
			sMsg = "Journée terminée"
			break;
	}
    res.send(sMsg)
})

app.post("/pointer", auth, async (req,res) => {
	var sDate = getCurrentDate()
	var sTime = moment().format("HH:mm:ss")
	var point = new Point({
		date: sDate,
		time: sTime
	})
	
	const points = await Point.find()
	var nbPoints = points.length;
    try {
		if(nbPoints <= 4){
			await point.save()
		}else{
			res.json({message: "Journée déjà terminée"})
		}
    } catch (err) {
        res.status(400).json({message: err.message})
    }
	
	var wayIn = Boolean((nbPoints + 1) % 2)
	res.status(201).json({wayIn})
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
