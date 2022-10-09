const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')

const suppCalendar = new mongoose.Schema({
    week:{
        type: String,
        required: true
    },
    minutes:{
        type: Number,
        required: true,
        default: 0
    }
})

suppCalendar.plugin(uniqueValidator);

module.exports = mongoose.model('Supp', suppCalendar)