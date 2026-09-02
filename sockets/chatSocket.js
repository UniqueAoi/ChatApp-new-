const jwt = require('jsonwebtoken')
const Message = require('../models/Message')

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey'
let connectedUsers = {}

module.exports = (io) => {
    // Middleware for JWT authentication
    io.use((socket, next) => {
        const token = socket.handshake.auth.token
        if (!token) return next(new Error('Authentication error: Token missing'))
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) return next(new Error('Authentication error: Invalid token'))
            socket.user = decoded
            next()
        })
    })

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

        // Handle Group Message
        socket.on('message', async (data) => {
            try {
                const newMsg = await Message.create({
                    sender: username,
                    senderId: userId,
                    message: data.message,
                    isPrivate: false
                })

                socket.broadcast.emit('chat-message', {
                    _id: newMsg._id,
                    sender: username,
                    senderId: userId,
                    message: newMsg.message,
                    createdAt: newMsg.createdAt,
                    isPrivate: false
                })
            } catch (err) {
                console.error('Group message error:', err)
            }
        })

        // Handle Private Message (DM)
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
                console.error('Private message error:', err)
            }
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
}