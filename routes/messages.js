const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const Message = require('../models/Message')

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey'

// Fetch filtered conversation history
router.get('/filtered', async (req, res) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

        const token = authHeader.split(' ')[1]
        const decoded = jwt.verify(token, JWT_SECRET)
        const targetUserId = req.query.targetUserId

        let filter = {}
        if (targetUserId === 'all' || !targetUserId) {
            filter = { isPrivate: false }
        } else {
            filter = {
                isPrivate: true,
                $or: [
                    { senderId: decoded.id, recipientId: targetUserId },
                    { senderId: targetUserId, recipientId: decoded.id }
                ]
            }
        }

        const messages = await Message.find(filter).sort({ createdAt: 1 }).limit(100)
        res.json(messages)
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' })
    }
})

module.exports = router