const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const MessageModel = require('../models/Message');
const User = require('../models/User');
const verifyToken = require('../middleware/auth');
// 2. GET /api/conversations/recent -> MUST be defined BEFORE /:userId
// Express Backend: GET /api/conversations/recent
router.get('/recent', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;

        const currentIdStr = userId.toString();
        const messages = await MessageModel.find({
            isPrivate: true,
            $or: [
                { senderId: userId },
                { recipientId: userId }
            ]
        })
            .sort({ createdAt: -1 });

        const chattedUsersMap = new Map();
        const targetIds = messages
            .map(msg => msg.senderId.toString() === currentIdStr ? msg.recipientId : msg.senderId)
            .filter(targetId => targetId && targetId.toString() !== currentIdStr)
            .map(targetId => targetId.toString());
        const users = await User.find({ _id: { $in: targetIds } }).select('username _id avatar');
        const usersById = new Map(users.map(user => [user._id.toString(), user]));

        messages.forEach(msg => {
            const targetId = msg.senderId.toString() === currentIdStr ? msg.recipientId : msg.senderId;
            const targetUser = targetId && usersById.get(targetId.toString());
            const targetIdStr = targetId && targetId.toString();

            if (targetUser && targetIdStr !== currentIdStr && !chattedUsersMap.has(targetIdStr)) {
                chattedUsersMap.set(targetIdStr, {
                    _id: targetUser._id,
                    username: targetUser.username,
                    avatar: targetUser.avatar,
                    lastMessage: msg.message || '',
                    lastMessageTime: msg.createdAt,
                    isOwnLastMessage: msg.senderId.toString() === currentIdStr
                });
            }
        });

        res.json(Array.from(chattedUsersMap.values()));
    } catch (err) {
        console.error('Error fetching recent conversations:', err);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});
// 1. POST /api/conversations -> Create new conversation
router.post('/', async (req, res) => {
    try {
        const conversation = await Conversation.create(req.body);
        res.json(conversation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// 3. GET /api/conversations/:userId -> Placed AFTER specific routes
router.get('/:userId', async (req, res) => {
    try {
        const conversations = await Conversation.find({ 
            $or: [{ sender: req.params.userId }, { recipient: req.params.userId }] 
        });
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;