const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET || 'fallback_secret';

function createToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        SECRET,
        { expiresIn: '24h' }
    );
}

// Middleware to verify if the user is authenticated
function verifyToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Access Denied. No token provided.' });

    try {
        const verified = jwt.verify(token, SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: 'Invalid Token' });
    }
}

// Middleware to specifically check if user has admin role
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access Denied. Admins only.' });
    }
    next();
}

module.exports = { createToken, verifyToken, requireAdmin };
