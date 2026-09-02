require('dotenv').config()

const express = require('express')
const path = require('path')
const http = require('http')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const User = require('./models/User')
const Message = require('./models/Message')

const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'secretkey'
const server = http.createServer(app)

const io = require('socket.io')(server)

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ichat_db'

mongoose.connect(MONGO_URI)
    .then(() => console.log('🍃 MongoDB Connected Successfully'))
    .catch(err => console.error('MongoDB Connection Error:', err))

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post('/api/register', async (req, res) => {
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
        const user = await User.create({ username, password: hashedPassword })

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' })

        res.status(201).json({ token, user: { id: user._id, username: user.username } })
    } catch (err) {
        res.status(500).json({ error: 'Server error during registration.' })
    }
})

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body
        const user = await User.findOne({ username })

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid username or password.' })
        }

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' })

        res.json({ token, user: { id: user._id, username: user.username } })
    } catch (err) {
        res.status(500).json({ error: 'Server error during login.' })
    }
})

app.get('/api/messages', async (req, res) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

        const token = authHeader.split(' ')[1]
        const decoded = jwt.verify(token, JWT_SECRET)

        const messages = await Message.find({
            $or: [
                { isPrivate: false },
                { senderId: decoded.id },
                { recipientId: decoded.id }
            ]
        }).sort({ createdAt: 1 }).limit(100)

        res.json(messages)
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' })
    }
})

// ==========================================
// SOCKET.IO AUTHENTICATION & EVENTS
// ==========================================

io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) {
        return next(new Error('Authentication error: Token missing'))
    }
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error: Invalid token'))
        socket.user = decoded
        next()
    })
})

let connectedUsers = {}

io.on('connection', (socket) => {
    const userId = socket.user.id
    const username = socket.user.username

    if (!connectedUsers[userId]) {
        connectedUsers[userId] = { username, sockets: [socket.id] }
    } else {
        connectedUsers[userId].sockets.push(socket.id)
    }

    const broadcastUserList = () => {
        const userList = Object.entries(connectedUsers).map(([id, u]) => ({
            userId: id,
            username: u.username
        }))
        io.emit('user-list', userList)
    }

    broadcastUserList()
    io.emit('clients-total', io.engine.clientsCount)

    //Handle Group Messages
    socket.on('message', async (data) => {
        try {
            const newMsg = await Message.create({
                sender: username,
                senderId: userId,
                message: data.message,
                isPrivate: false
            })

            // Broadcast message to everyone EXCEPT sender
            socket.broadcast.emit('chat-message', {
                _id: newMsg._id,
                sender: username,
                senderId: userId,
                message: newMsg.message,
                createdAt: newMsg.createdAt,
                isPrivate: false
            })
        } catch (err) {
            console.error('Error saving group message:', err)
        }
    })

    // Handle Private Direct Messages
    socket.on('private-message', async ({ targetUserId, message }) => {
        try {
            const newMsg = await Message.create({
                sender: username,
                senderId: userId,
                recipientId: targetUserId,
                message: message,
                isPrivate: true
            })

            const targetSockets = connectedUsers[targetUserId]?.sockets || []

            const msgData = {
                _id: newMsg._id,
                sender: username,
                senderId: userId,
                recipientId: targetUserId,
                message: newMsg.message,
                createdAt: newMsg.createdAt,
                isPrivate: true
            }

            targetSockets.forEach(socketId => {
                io.to(socketId).emit('private-message', msgData)
            })
        } catch (err) {
            console.error('Error saving private message:', err)
        }
    })

    //Handle Typing Feedback
    socket.on('feedback', (data) => {
        socket.broadcast.emit('feedback', { ...data, sender: username })
    })

    // Handle Disconnect
    socket.on('disconnect', () => {
        if (connectedUsers[userId]) {
            connectedUsers[userId].sockets = connectedUsers[userId].sockets.filter(id => id !== socket.id)

            if (connectedUsers[userId].sockets.length === 0) {
                delete connectedUsers[userId]
            }
        }

        broadcastUserList()
        io.emit('clients-total', io.engine.clientsCount)
    })
})

server.listen(PORT, () => console.log(`💬 Server running on port ${PORT}`))