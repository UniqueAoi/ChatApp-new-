let authToken = localStorage.getItem('token')
let currentUser = JSON.parse(localStorage.getItem('user')) || null
let socket = null

const authContainer = document.getElementById('auth-container')
const chatContainer = document.getElementById('chat-main')
const clientsTotal = document.getElementById('client-total')
const messageContainer = document.getElementById('message-container')
const recipientSelect = document.getElementById('recipient-select')
const messageForm = document.getElementById('message-form')
const messageInput = document.getElementById('message-input')
const messageTone = new Audio('/message-tone.mp3')

if (authToken && currentUser) {
    showChatUI()
    initSocket()
} else {
    showAuthUI()
}

async function handleAuth(endpoint, username, password) {
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
    socket = io({
        auth: { token: authToken }
    })

    socket.on('connect', () => {
        loadChatHistory()
    })

    socket.on('user-list', (users) => {
        const currentSelected = recipientSelect.value

        recipientSelect.innerHTML = '<option value="all">Everyone (Group)</option>'

        users.forEach(u => {
            if (u.userId !== currentUser.id) {
                const option = document.createElement('option')
                option.value = u.userId
                option.textContent = u.username
                recipientSelect.appendChild(option)
            }
        })

        recipientSelect.value = currentSelected || 'all'
    })

    socket.on('clients-total', (count) => {
        clientsTotal.innerText = `Total Clients: ${count}`
    })

    socket.on('chat-message', (data) => {
        messageTone.play()
        addMessageToUI(false, data)
    })

    socket.on('private-message', (data) => {
        messageTone.play()
        addMessageToUI(false, data)
    })

    socket.on('feedback', (data) => {
        clearFeedback()
        if (!data.feedback) return
        messageContainer.innerHTML += `
            <li class="message-feedback">
                <p class="feedback">${data.feedback}</p>
            </li>`
    })
}

async function loadChatHistory() {
    try {
        const res = await fetch('/api/messages', {
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

messageForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const text = messageInput.value.trim()
    if (!text) return

    const selectedRecipient = recipientSelect.value

    if (selectedRecipient === 'all') {
        socket.emit('message', { message: text })
        addMessageToUI(true, {
            sender: currentUser.username,
            message: text,
            createdAt: new Date(),
            isPrivate: false
        })
    } else {
        socket.emit('private-message', {
            targetUserId: selectedRecipient,
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
    clearFeedback()
    const isDM = data.isPrivate ? 'message-dm' : ''
    const badge = data.isPrivate ? '<span class="dm-badge">DIRECT</span>' : ''

    const element = `
        <li class="${isOwnMessage ? 'message-right' : 'message-left'} ${isDM}">
            <p class="message">
                ${badge}${data.message}
                <span>${data.sender} • ${moment(data.createdAt).fromNow()}</span>
            </p>
        </li>`

    messageContainer.innerHTML += element
    messageContainer.scrollTo(0, messageContainer.scrollHeight)
}

function clearFeedback() {
    document.querySelectorAll('li.message-feedback').forEach(el => el.remove())
}

function showAuthUI() {
    authContainer.style.display = 'block'
    chatContainer.style.display = 'none'
}

function showChatUI() {
    authContainer.style.display = 'none'
    chatContainer.style.display = 'block'
    document.getElementById('logged-username').innerText = currentUser.username
}

function logout() {
    localStorage.clear()
    window.location.reload()
}