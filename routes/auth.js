const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey'

// Helper function to generate avatar
const getAvatarUrl = (username) => `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`

// Register Route
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' })
        }

        const existingUser = await User.findOne({ username })
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists.' })
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        const avatarUrl = getAvatarUrl(username)

        const user = await User.create({
            username,
            password: hashedPassword,
            avatar: avatarUrl
        })

        const userPayload = { id: user._id, username: user.username, avatar: user.avatar }
        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' })

        res.status(201).json({ token, user: userPayload })
    } catch (err) {
        res.status(500).json({ error: 'Server error during registration.' })
    }
})

// Login Route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body
        const user = await User.findOne({ username })

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid username or password.' })
        }

        // Fallback for older existing users without avatar
        const avatarUrl = user.avatar || getAvatarUrl(user.username)
        const userPayload = { id: user._id, username: user.username, avatar: avatarUrl }

        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' })

        res.json({ token, user: userPayload })
    } catch (err) {
        res.status(500).json({ error: 'Server error during login.' })
    }
})

module.exports = router