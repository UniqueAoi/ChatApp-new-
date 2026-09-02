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

    try {
        const res = await fetch(`/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

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
    socket = io({ auth: { token: authToken } })

    socket.on('connect', () => {
        handleUserSearch()
        switchChatContext('all', 'Everyone (Group)')
    })

    socket.on('clients-total', (count) => {
        clientsTotal.innerText = `Total Clients: ${count}`
    })

    socket.on('chat-message', (data) => {
        if (currentChatTarget === 'all' && data.senderId !== currentUser.id) {
            messageTone.play()
            addMessageToUI(false, data)
        }
    })

    socket.on('private-message', (data) => {
        if (currentChatTarget === data.senderId) {
            messageTone.play()
            addMessageToUI(false, data)
        }
    })
}

async function switchChatContext(targetId, targetName) {
    currentChatTarget = targetId
    document.getElementById('current-chat-title').innerText = targetName

    document.querySelectorAll('.channel-item, .user-item').forEach(el => el.classList.remove('active'))
    if (targetId === 'all') {
        document.getElementById('channel-group').classList.add('active')
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
        const messages = await res.json()
        messageContainer.innerHTML = ''
        messages.forEach(msg => {
            const isOwn = msg.senderId === currentUser.id
            addMessageToUI(isOwn, {
                sender: msg.sender,
                message: msg.message,
                createdAt: msg.createdAt,
                isPrivate: msg.isPrivate
            })
        })
    } catch (err) {
        console.error('Failed to load history:', err)
    }
}

// Updated Handle Real-time Search
async function handleUserSearch() {
    const searchInput = document.getElementById('user-search-input')
    if (!searchInput) return

    const query = searchInput.value.trim()

    // Ensure token exists before making request
    if (!authToken) {
        authToken = localStorage.getItem('token')
        if (!authToken) return
    }

    try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        })

        if (!res.ok) {
            console.error('Search request failed with status:', res.status)
            return
        }

        const users = await res.json()
        renderUserList(users)
    } catch (err) {
        console.error('Search error:', err)
    }
}

function renderUserList(users) {
    const listContainer = document.getElementById('user-list-container')
    listContainer.innerHTML = ''

    users.forEach(u => {
        const avatarSrc = u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`
        const li = document.createElement('li')
        li.className = `user-item ${currentChatTarget === u._id ? 'active' : ''}`
        li.id = `user-${u._id}`
        li.innerHTML = `
            <img src="${avatarSrc}" alt="${u.username}">
            <span>${u.username}</span>
        `
        li.onclick = () => switchChatContext(u._id, u.username)
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
    }

    messageInput.value = ''
})

function addMessageToUI(isOwnMessage, data) {
    const element = `
        <li class="${isOwnMessage ? 'message-right' : 'message-left'}">
            <p class="message">
                ${data.message}
                <span>${data.sender} • ${moment(data.createdAt).fromNow()}</span>
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