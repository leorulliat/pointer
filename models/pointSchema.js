const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')

const schemaPoint = new mongoose.Schema({
    date:{
        type: String,
        required: true
    },
    time:{
        type: String,
        required: true
    }
})

schemaPoint.plugin(uniqueValidator);

module.exports = mongoose.model('Point', schemaPoint)