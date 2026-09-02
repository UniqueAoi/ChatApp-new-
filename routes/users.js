const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey'

// Search registered users
router.get('/search', async (req, res) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' })
        }

        const token = authHeader.split(' ')[1]
        const decoded = jwt.verify(token, JWT_SECRET)

        const query = req.query.q || ''

        // Find users whose username matches search query, excluding the logged-in user
        const users = await User.find({
            username: { $regex: query, $options: 'i' },
            _id: { $ne: decoded.id }
        }).select('username _id avatar')

        res.json(users)
    } catch (err) {
        console.error('User search error:', err.message)
        res.status(401).json({ error: 'Invalid or expired token' })
    }
})

module.exports = router