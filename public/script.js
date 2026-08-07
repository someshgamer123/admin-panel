document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const messageDiv = document.getElementById('loginMessage');
    
    // Clear previous messages
    messageDiv.innerHTML = '';
    
    // Validation
    if (!email) {
        messageDiv.innerHTML = '<p style="color: #fc8181;">❌ Please enter your email</p>';
        return;
    }
    
    if (!password) {
        messageDiv.innerHTML = '<p style="color: #fc8181;">❌ Please enter your password</p>';
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('.login-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Signing in...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/admin-login', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageDiv.innerHTML = '<p style="color: #68d391;">✅ Login successful! Redirecting...</p>';
            setTimeout(() => {
                window.location.href = '/admin';
            }, 1000);
        } else {
            messageDiv.innerHTML = '<p style="color: #fc8181;">❌ Invalid email or password. Please try again.</p>';
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            
            // Clear password field
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    } catch (error) {
        console.error('Login error:', error);
        messageDiv.innerHTML = '<p style="color: #fc8181;">❌ Server error. Please try again later.</p>';
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Enter key support
document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('loginForm').dispatchEvent(new Event('submit'));
    }
});

document.getElementById('email').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('password').focus();
    }
});