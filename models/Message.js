const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = group message
    message: { type: String, required: true },
    isPrivate: { type: Boolean, default: false }
}, { timestamps: true })

module.exports = mongoose.model('Message', messageSchema)