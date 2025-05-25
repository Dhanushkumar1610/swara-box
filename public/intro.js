function toggleForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
    registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
}

async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Login failed: ${response.status}`);
        }
        if (data.token && data.userId) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data.userId);
            console.log('Login successful, token:', data.token, 'userId:', data.userId);
            window.location.href = 'contentfile.html';
        } else {
            throw new Error('No token or userId received');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert(`Error logging in: ${error.message}`);
    }
}

async function register() {
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    if (!username || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await response.json();
        if (response.status === 201) {
            alert('Registration successful! Please log in.');
            toggleForm();
        } else {
            throw new Error(data.error || `Registration failed: ${response.status}`);
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert(`Error registering: ${error.message}`);
    }
}