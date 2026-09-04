require('dotenv').config()
const express = require('express')
const path = require('path')
const http = require('http')
const mongoose = require('mongoose')

const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const messageRoutes = require('./routes/messages')
const conversationRoutes = require('./routes/conversation.route')
const setupSocket = require('./sockets/chatSocket')


const app = express()
const server = http.createServer(app)
const io = require('socket.io')(server)

const PORT = process.env.PORT || 4000
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ichat_db'

// Connect Database
mongoose.connect(MONGO_URI)
    .then(() => console.log('🍃 MongoDB Connected'))
    .catch(err => console.error('MongoDB Error:', err))

// Middleware
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Routes
app.use('/api', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/conversations', conversationRoutes)

// Setup Socket.io Event Handling
setupSocket(io)

server.listen(PORT, () => console.log(`💬 Server running on port ${PORT}`))