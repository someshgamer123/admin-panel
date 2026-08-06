document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (data.success) {
            window.location.href = '/admin';
        } else {
            document.getElementById('loginMessage').innerHTML = '<p style="color: red;">❌ Invalid credentials</p>';
        }
    } catch (error) {
        document.getElementById('loginMessage').innerHTML = '<p style="color: red;">❌ Server error</p>';
    }
});