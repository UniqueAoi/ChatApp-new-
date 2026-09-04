const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey'

module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const token = authHeader.split(' ')[1]
        req.user = jwt.verify(token, JWT_SECRET)
        next()
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' })
    }
}
