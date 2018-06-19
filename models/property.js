const mongoose = require('mongoose');

let propertySchema = new mongoose.Schema({
    reference: String,
    source: String,
    zone: String,
    description: String,
    url: String,
    phone: Number,
    price: Number,
    dateCrawled: Date
});

let Property = mongoose.model('Property', propertySchema);

module.exports = Property;
