document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const messageDiv = document.getElementById('loginMessage');
    
    messageDiv.innerHTML = '';
    messageDiv.className = 'login-message';
    
    if (!email) {
        messageDiv.textContent = '❌ Please enter your email';
        messageDiv.className = 'login-message error';
        return;
    }
    
    if (!password) {
        messageDiv.textContent = '❌ Please enter your password';
        messageDiv.className = 'login-message error';
        return;
    }
    
    const submitBtn = document.querySelector('.login-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Signing in...';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    
    try {
        const response = await fetch('/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageDiv.textContent = '✅ Login successful! Redirecting...';
            messageDiv.className = 'login-message success';
            submitBtn.textContent = '✅ Success';
            
            setTimeout(() => {
                window.location.href = '/admin';
            }, 1000);
        } else {
            messageDiv.textContent = '❌ Invalid email or password. Please try again.';
            messageDiv.className = 'login-message error';
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    } catch (error) {
        console.error('Login error:', error);
        messageDiv.textContent = '❌ Server error. Please try again later.';
        messageDiv.className = 'login-message error';
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
    }
});

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

window.addEventListener('load', function() {
    setTimeout(() => {
        document.getElementById('email').focus();
    }, 500);
});