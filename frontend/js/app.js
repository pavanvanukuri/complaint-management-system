function getCurrentUser() {
  const raw = sessionStorage.getItem('cmsUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    sessionStorage.removeItem('cmsUser');
    return null;
  }
}

function saveCurrentUser(user) {
  sessionStorage.setItem('cmsUser', JSON.stringify(user));
}

function clearCurrentUser() {
  sessionStorage.removeItem('cmsUser');
}

function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const user = getCurrentUser();
  if (user && user.access_token) headers.set('Authorization', `Bearer ${user.access_token}`);
  return fetch(url, { ...options, headers });
}

async function apiJson(url, options = {}) {
  const response = await apiFetch(url, options);
  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    if (response.ok) throw new Error('The server returned an invalid response');
  }
  if (!response.ok) throw new Error(data.message || 'The request failed');
  return data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function showMessage(elementId, text, type = 'success') {
  const box = document.getElementById(elementId);
  if (!box) return;
  box.textContent = text;
  box.className = `message-box ${type}`;
  box.classList.remove('hidden');
}

function normalizeRole(role) {
  return String(role || '').trim();
}

function isStaffRole(role) {
  const normalized = normalizeRole(role).toLowerCase();
  return ['faculty', 'staff', 'admin'].includes(normalized);
}

function roleText(role) {
  const normalized = normalizeRole(role);
  if (!normalized) return 'User';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function setUserLabel() {
  const user = getCurrentUser();
  const label = document.getElementById('userLabel');
  if (!label || !user) return;
  const role = normalizeRole(user.role || user.user_type);
  label.textContent = `${user.name} (${roleText(role)})`;
}

function requireLogin() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = '/';
    return null;
  }

  const role = normalizeRole(user.role || user.user_type).toLowerCase();
  const currentPage = window.location.pathname.toLowerCase();
  const staffOnlyPage = currentPage.endsWith('/staff-dashboard.html');
  const studentOnlyPage = ['/submit-complaint.html', '/my-complaints.html']
    .some((page) => currentPage.endsWith(page));
  if (staffOnlyPage && !isStaffRole(role)) {
    window.location.href = '/dashboard.html';
  } else if (studentOnlyPage && isStaffRole(role)) {
    window.location.href = '/staff-dashboard.html';
  } else if (currentPage.endsWith('/dashboard.html') && isStaffRole(role)) {
    window.location.href = '/staff-dashboard.html';
  }

  return user;
}

function logoutUser() {
  clearCurrentUser();
  window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const user = getCurrentUser();

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const registrationNo = document.getElementById('registration_no').value.trim();
      const messageBox = document.getElementById('loginMessage');

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registration_no: registrationNo }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Login failed');
        }

        const loggedInUser = {
          ...data,
          role: normalizeRole(data.role || data.user_type),
        };

        if (!loggedInUser.access_token || (!isStaffRole(loggedInUser.role) && loggedInUser.role.toLowerCase() !== 'student')) {
          throw new Error('This account has an unsupported role');
        }

        saveCurrentUser(loggedInUser);
        messageBox.className = 'message-box success';
        messageBox.textContent = 'Login successful';
        messageBox.classList.remove('hidden');

        const destination = isStaffRole(loggedInUser.role)
          ? '/staff-dashboard.html'
          : '/dashboard.html';

        setTimeout(() => {
          window.location.href = destination;
        }, 400);
      } catch (error) {
        messageBox.className = 'message-box error';
        messageBox.textContent = error.message || 'Unable to login';
        messageBox.classList.remove('hidden');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutUser);
  }

  if (user) {
    setUserLabel();
  }

  if (!loginForm && !user) {
    requireLogin();
  }
});
