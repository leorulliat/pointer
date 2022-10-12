const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')

const suppCalendar = new mongoose.Schema({
    week:{
        type: Number,
        required: true
    },
    minutes:{
        type: Number,
        required: true,
        default: 0
    },
    majDate:{
        type: String,
        required: true
    }
})

suppCalendar.plugin(uniqueValidator);

module.exports = mongoose.model('Supp', suppCalendar)