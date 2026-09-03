const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
// Ensure MessageModel and verifyToken are properly imported
const MessageModel = require('../models/Message'); // Adjust path as needed
const verifyToken = require('../middleware/auth'); // Adjust path as needed
// 2. GET /api/conversations/recent -> MUST be defined BEFORE /:userId
// Express Backend: GET /api/conversations/recent
router.get('/recent', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;

        // ၁။ Current User နဲ့ ပတ်သက်ဖူးသမျှ (Private + Group) Message အားလုံးကို ရှာမည်
        const messages = await MessageModel.find({
            $or: [
                { sender: userId },
                { recipient: userId },
                { isPrivate: false },
                { recipient: { $exists: false } }
            ]
        })
        .sort({ createdAt: -1 })
        .populate('sender recipient', '_id username avatar');

        const chattedUsersMap = new Map();

        messages.forEach(msg => {
            if (!msg.sender) return;

            const senderId = msg.sender._id ? msg.sender._id.toString() : msg.sender.toString();
            const currentIdStr = userId.toString();

            let targetUser = null;

            // သူများက ပို့ထားသော စာဖြစ်ပါက Sender ကို ယူမည် (Group / Private နှစ်မျိုးလုံးအတွက်)
            if (senderId !== currentIdStr) {
                targetUser = msg.sender;
            } 
            // မိမိကိုယ်တိုင် ပို့ထားသော Private Message ဖြစ်ပါက Recipient ကို ယူမည်
            else if (msg.recipient && msg.recipient._id && msg.recipient._id.toString() !== currentIdStr) {
                targetUser = msg.recipient;
            }

            // Target User ရှိပြီး မိမိမဟုတ်ပါက List ထဲသို့ ထည့်မည်
            if (targetUser && targetUser._id) {
                const targetIdStr = targetUser._id.toString();
                if (targetIdStr !== currentIdStr && !chattedUsersMap.has(targetIdStr)) {
                    chattedUsersMap.set(targetIdStr, {
                        _id: targetUser._id,
                        username: targetUser.username,
                        avatar: targetUser.avatar,
                        lastMessage: msg.message || msg.text || '',
                        lastMessageTime: msg.createdAt
                    });
                }
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