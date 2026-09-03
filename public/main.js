let authToken = localStorage.getItem('token')
let currentUser = JSON.parse(localStorage.getItem('user')) || null
let socket = null
let currentChatTarget = 'all'
let isLoginMode = true

const authContainer = document.getElementById('auth-container')
const chatContainer = document.getElementById('chat-main')
const messageContainer = document.getElementById('message-container')
const messageForm = document.getElementById('message-form')
const messageInput = document.getElementById('message-input')
const clientsTotal = document.getElementById('client-total')
const messageTone = new Audio('/message-tone.mp3')

// App Startup Initialization
if (authToken && currentUser) {
    showChatUI()
    initSocket()
} else {
    showAuthUI()
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode
    document.getElementById('auth-title').innerText = isLoginMode ? 'Login' : 'Register'
    document.getElementById('auth-toggle').innerText = isLoginMode ? 'Need an account? Register' : 'Have an account? Login'
}

async function submitAuth() {
    const username = document.getElementById('auth-username').value.trim()
    const password = document.getElementById('auth-password').value.trim()
    const endpoint = isLoginMode ? 'login' : 'register'

    if (!username || !password) return alert("Please fill in all fields")

    try {
        const res = await fetch(`/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Authentication failed')

        authToken = data.token
        currentUser = data.user
        localStorage.setItem('token', authToken)
        localStorage.setItem('user', JSON.stringify(currentUser))

        showChatUI()
        initSocket()
    } catch (err) {
        alert(err.message)
    }
}

function initSocket() {
    if (socket) socket.disconnect()
    
    socket = io({ auth: { token: authToken } })

    socket.on('connect', () => {
        fetchRecentConversations()
        
        // Refresh မလုပ်ခင် နောက်ဆုံးဖွင့်ထားခဲ့တဲ့ Chat (သို့) 'all' ကို ပြန်ယူမည်
        const savedTargetId = localStorage.getItem('activeChatTargetId') || 'all'
        const savedTargetName = localStorage.getItem('activeChatTargetName') || 'Everyone (Group)'
        
        switchChatContext(savedTargetId, savedTargetName)
    })

    socket.on('clients-total', (count) => {
        if (clientsTotal) clientsTotal.innerText = `Total Clients: ${count}`
    })

    socket.on('chat-message', (data) => {
        const myId = currentUser ? (currentUser.id || currentUser._id) : null
        if (currentChatTarget === 'all' && data.senderId !== myId) {
            try { messageTone.play() } catch (e) {}
            addMessageToUI(false, data)
        }
        fetchRecentConversations()
    })

    socket.on('private-message', (data) => {
        if (currentChatTarget === data.senderId) {
            try { messageTone.play() } catch (e) {}
            addMessageToUI(false, data)
        }
        fetchRecentConversations()
    })
}


async function switchChatContext(targetId, targetName) {
    currentChatTarget = targetId
    
    // Refresh လုပ်ရင် ပြန်မှတ်မိနေစေရန် localStorage ထဲ သိမ်းထားမည်
    localStorage.setItem('activeChatTargetId', targetId)
    localStorage.setItem('activeChatTargetName', targetName)

    const chatTitleEl = document.getElementById('current-chat-title')
    if (chatTitleEl) chatTitleEl.innerText = targetName

    document.querySelectorAll('.channel-item, .user-item').forEach(el => el.classList.remove('active'))
    if (targetId === 'all') {
        const groupChannel = document.getElementById('channel-group')
        if (groupChannel) groupChannel.classList.add('active')
    } else {
        const activeEl = document.getElementById(`user-${targetId}`)
        if (activeEl) activeEl.classList.add('active')
    }

    await loadFilteredHistory(targetId)
}
async function loadFilteredHistory(targetUserId) {
    try {
        const res = await fetch(`/api/messages/filtered?targetUserId=${targetUserId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
        if (!res.ok) return
        const messages = await res.json()
        messageContainer.innerHTML = ''
        
        if (Array.isArray(messages)) {
            messages.forEach(msg => {
                const myId = currentUser ? (currentUser.id || currentUser._id).toString() : ''
                const senderId = msg.senderId ? msg.senderId.toString() : ''
                const isOwn = senderId === myId || msg.sender === currentUser.username
                
                addMessageToUI(isOwn, {
                    sender: msg.sender,
                    message: msg.message,
                    createdAt: msg.createdAt,
                    isPrivate: msg.isPrivate
                })
            })
        }
    } catch (err) {
        console.error('Failed to load history:', err)
    }
}

async function fetchRecentConversations() {
    if (!authToken) return
    try {
        const res = await fetch('/api/conversations/recent', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
        if (!res.ok) return
        const chattedUsers = await res.json()
        renderUserList(chattedUsers)
    } catch (err) {
        console.error('Error fetching chat history users:', err)
    }
}

async function handleUserSearch() {
    const searchInput = document.getElementById('user-search-input')
    if (!searchInput) return

    const query = searchInput.value.trim()

    if (!query) {
        fetchRecentConversations()
        return
    }

    try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        })

        if (!res.ok) return
        const users = await res.json()
        renderUserList(users)
    } catch (err) {
        console.error('Search error:', err)
    }
}

function renderUserList(users) {
    const listContainer = document.getElementById('user-list-container')
    if (!listContainer) return
    listContainer.innerHTML = ''

    if (!Array.isArray(users) || users.length === 0) {
        return
    }

    const currentId = currentUser ? (currentUser.id || currentUser._id || '').toString() : ''

    users.forEach(u => {
        if (!u) return
        const rawId = u._id || u.id
        if (!rawId) return

        const targetUserId = rawId.toString()
        if (targetUserId === currentId) return

        const avatarSrc = u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`
        const lastMsgText = u.lastMessage || ''
        
        // Moment.js Safe Formatting
        let timeFormatted = ''
        if (u.lastMessageTime) {
            timeFormatted = typeof moment === 'function' ? moment(u.lastMessageTime).format('HH:mm') : ''
        }

        const li = document.createElement('li')
        li.className = `user-item ${currentChatTarget === targetUserId ? 'active' : ''}`
        li.id = `user-${targetUserId}`
        li.innerHTML = `
            <img src="${avatarSrc}" alt="${u.username}" class="user-avatar">
            <div class="user-details">
                <div class="user-row-top">
                    <span class="user-name">${u.username}</span>
                    <span class="msg-time">${timeFormatted}</span>
                </div>
                <div class="user-row-bottom">
                    <span class="last-msg-preview">${lastMsgText}</span>
                </div>
            </div>
        `
        li.onclick = () => switchChatContext(targetUserId, u.username)
        listContainer.appendChild(li)
    })
}

messageForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const text = messageInput.value.trim()
    if (!text) return

    if (currentChatTarget === 'all') {
        socket.emit('message', { message: text })
        addMessageToUI(true, {
            sender: currentUser.username,
            message: text,
            createdAt: new Date(),
            isPrivate: false
        })
    } else {
        socket.emit('private-message', {
            targetUserId: currentChatTarget,
            message: text
        })
        addMessageToUI(true, {
            sender: currentUser.username,
            message: text,
            createdAt: new Date(),
            isPrivate: true
        })
        fetchRecentConversations()
    }

    messageInput.value = ''
})

function addMessageToUI(isOwnMessage, data) {
    const timeAgo = typeof moment === 'function' ? moment(data.createdAt).fromNow() : ''
    const element = `
        <li class="${isOwnMessage ? 'message-right' : 'message-left'}">
            <p class="message">
                ${data.message}
                <span>${data.sender} • ${timeAgo}</span>
            </p>
        </li>`

    messageContainer.innerHTML += element
    messageContainer.scrollTo(0, messageContainer.scrollHeight)
}

function showAuthUI() {
    authContainer.style.display = 'block'
    chatContainer.style.display = 'none'
}

function showChatUI() {
    authContainer.style.display = 'none'
    chatContainer.style.display = 'flex'
    document.getElementById('logged-username').innerText = currentUser.username
    document.getElementById('logged-avatar').src = currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`
}

function logout() {
    localStorage.clear()
    window.location.reload()
}