const mongoose = require('mongoose');

let propertySchema = new mongoose.Schema({
    reference: String,
    contact: String,
    source: String, 
    zone: String,
    description: String,
    url: String,
    phone: Number,
    price: Number,
    dateCrawled: Date
});

let Vibbo = mongoose.model('Vibbo', propertySchema, 'Vibbo');

module.exports = Vibbo;
