const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')

const weekCalendar = new mongoose.Schema({
    week:{
        type: Number,
        required: true
    },
    minutesWork:{
        type: Number,
        required: true,
        default: 0
    },
    nbDaysClosed:{
        type: Number,
        required: true,
        default: 0
    },
    majDate:{
        type: String,
        required: true
    }
})

weekCalendar.plugin(uniqueValidator);

module.exports = mongoose.model('Week', weekCalendar)