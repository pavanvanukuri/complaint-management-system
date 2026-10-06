const user = requireLogin();
let trackedComplaintId = null;

async function loadLookupOptions() {
  try {
    const [categories, priorities, departments, statuses] = await Promise.all([
      apiFetch('/api/categories').then((res) => res.json()),
      apiFetch('/api/priorities').then((res) => res.json()),
      apiFetch('/api/departments').then((res) => res.json()),
      apiFetch('/api/statuses').then((res) => res.json()),
    ]);

    const categorySelect = document.getElementById('category');
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">Select category</option>' + categories.map((item) => `<option value="${escapeHtml(item.category_name)}">${escapeHtml(item.category_name)}</option>`).join('');
    }

    const prioritySelect = document.getElementById('priority');
    if (prioritySelect) {
      prioritySelect.innerHTML = '<option value="">Select priority</option>' + priorities.map((item) => `<option value="${escapeHtml(item.priority_name)}">${escapeHtml(item.priority_name)}</option>`).join('');
    }

    const departmentSelect = document.getElementById('department');
    if (departmentSelect) {
      departmentSelect.innerHTML = '<option value="">Select department</option>' + departments.map((item) => `<option value="${escapeHtml(item.department_name)}">${escapeHtml(item.department_name)}</option>`).join('');
    }

    const statusSelect = document.getElementById('myStatusFilter');
    if (statusSelect) {
      statusSelect.innerHTML = '<option value="">All Status</option>' + statuses.map((item) => `<option value="${item.status_id}">${escapeHtml(item.status_name)}</option>`).join('');
    }

    const priorityFilter = document.getElementById('myPriorityFilter');
    if (priorityFilter) {
      priorityFilter.innerHTML = '<option value="">All Priority</option>' + priorities.map((item) => `<option value="${item.priority_id}">${escapeHtml(item.priority_name)}</option>`).join('');
    }

    const trackComplaintId = document.getElementById('trackComplaintId');
    if (trackComplaintId && !trackComplaintId.value) {
      trackComplaintId.placeholder = 'Enter complaint ID';
    }
  } catch (error) {
    console.error('Failed to load lookups:', error);
  }
}

async function renderUserDashboard() {
  if (!user) return;

  const response = await apiFetch(`/api/users/${user.user_id}/complaints`);
  const complaints = await response.json();
  if (!response.ok) throw new Error(complaints.message || 'Unable to load complaints');

  const stats = {
    total: complaints.length,
    pending: complaints.filter((c) => String(c.status_name).toLowerCase() === 'pending').length,
    assigned: complaints.filter((c) => c.staff_name && c.staff_name !== 'Unassigned').length,
    inProgress: complaints.filter((c) => String(c.status_name).toLowerCase() === 'in progress').length,
    resolved: complaints.filter((c) => String(c.status_name).toLowerCase() === 'resolved').length,
    closed: complaints.filter((c) => String(c.status_name).toLowerCase() === 'closed').length,
  };

  const mapping = {
    totalComplaints: stats.total,
    pendingComplaints: stats.pending,
    assignedComplaints: stats.assigned,
    inProgressComplaints: stats.inProgress,
    resolvedComplaints: stats.resolved,
    closedComplaints: stats.closed,
  };

  Object.entries(mapping).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  const tbody = document.getElementById('userComplaintTable');
  if (tbody) {
    tbody.innerHTML = complaints.slice(0, 8).map((complaint) => `
      <tr>
        <td>${escapeHtml(complaint.complaint_id)}</td>
        <td>${escapeHtml(complaint.subject)}</td>
        <td>${escapeHtml(complaint.category_name)}</td>
        <td>${escapeHtml(complaint.priority_name)}</td>
        <td><span class="badge ${complaint.status_name === 'Closed' ? 'dark' : complaint.status_name === 'Resolved' ? 'success' : complaint.status_name === 'Pending' ? 'warning' : ''}">${escapeHtml(complaint.status_name)}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="5">No complaints found</td></tr>';
  }
}

async function renderMyComplaints() {
  if (!user) return;

  const response = await apiFetch(`/api/users/${user.user_id}/complaints`);
  const complaints = await response.json();
  if (!response.ok) throw new Error(complaints.message || 'Unable to load complaints');
  const tbody = document.getElementById('myComplaintTable');
  const searchInput = document.getElementById('myComplaintSearch');
  const statusSelect = document.getElementById('myStatusFilter');
  const prioritySelect = document.getElementById('myPriorityFilter');

  const applyFilters = () => {
    const search = (searchInput?.value || '').toLowerCase();
    const statusFilter = statusSelect?.value || '';
    const priorityFilter = prioritySelect?.value || '';

    const filtered = complaints.filter((complaint) => {
      const matchesText = (complaint.subject || '').toLowerCase().includes(search);
      const matchesStatus = !statusFilter || String(complaint.status_id) === String(statusFilter);
      const matchesPriority = !priorityFilter || String(complaint.priority_id) === String(priorityFilter);
      return matchesText && matchesStatus && matchesPriority;
    });

    tbody.innerHTML = filtered.map((complaint) => `
      <tr>
        <td>${escapeHtml(complaint.complaint_id)}</td>
        <td>${escapeHtml(complaint.subject)}</td>
        <td>${escapeHtml(complaint.category_name)}</td>
        <td>${escapeHtml(complaint.department_name)}</td>
        <td>${escapeHtml(complaint.staff_name || 'Unassigned')}</td>
        <td>${escapeHtml(complaint.priority_name)}</td>
        <td><span class="badge ${complaint.status_name === 'Closed' ? 'dark' : complaint.status_name === 'Resolved' ? 'success' : complaint.status_name === 'Pending' ? 'warning' : ''}">${escapeHtml(complaint.status_name)}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="7">No matching complaints</td></tr>';
  };

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (statusSelect) statusSelect.addEventListener('change', applyFilters);
  if (prioritySelect) prioritySelect.addEventListener('change', applyFilters);

  applyFilters();
}

async function submitComplaint(event) {
  event.preventDefault();

  const form = event.target;
  const payload = {
    user_id: user.user_id,
    subject: document.getElementById('subject').value.trim(),
    description: document.getElementById('description').value.trim(),
    category: document.getElementById('category').value,
    priority: document.getElementById('priority').value,
    department: document.getElementById('department').value,
  };

  try {
    const response = await apiFetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Complaint submission failed');
    }

    showMessage('complaintMessage', `Complaint submitted successfully. Complaint ID: ${data.complaint_id}`, 'success');
    form.reset();

    setTimeout(async () => {
      if (window.location.pathname.endsWith('/submit-complaint.html')) {
        window.location.href = '/dashboard.html';
      } else {
        const dashboardTable = document.getElementById('userComplaintTable');
        if (dashboardTable) {
          await renderUserDashboard();
        }
      }
    }, 400);
  } catch (error) {
    showMessage('complaintMessage', error.message, 'error');
  }
}

async function renderNotifications() {
  if (!user) return;

  const response = await apiFetch(`/api/users/${user.user_id}/notifications`);
  const notifications = await response.json();
  if (!response.ok) throw new Error(notifications.message || 'Unable to load notifications');
  const tbody = document.getElementById('notificationTable');

  if (!tbody) return;

  tbody.innerHTML = notifications.map((item) => {
    const isRead = ['read', 'y'].includes(String(item.read_status || '').toLowerCase());
    return `
      <tr>
        <td>${escapeHtml(item.notification_id)}</td>
        <td>${escapeHtml(item.complaint_id)}</td>
        <td>${escapeHtml(item.message)}</td>
        <td>${isRead ? 'Read' : 'Unread'}</td>
        <td>
          ${isRead ? '<span class="badge success">Read</span>' : `<button class="primary-btn" data-mark-read="${escapeHtml(item.notification_id)}">Mark as Read</button>`}
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="5">No notifications</td></tr>';

  document.querySelectorAll('[data-mark-read]').forEach((button) => {
    button.addEventListener('click', async () => {
      const notificationId = button.getAttribute('data-mark-read');
      const response = await apiFetch(`/api/notifications/${notificationId}/read`, { method: 'PUT' });
      if (response.ok) await renderNotifications();
    });
  });
}

async function renderComments(complaintId) {
  const comments = await apiJson(`/api/complaints/${complaintId}/comments`);
  const commentList = document.getElementById('commentList');
  if (!commentList) return;

  commentList.innerHTML = comments.map((comment) => `
    <article class="track-details">
      <strong>${escapeHtml(comment.user_name)}</strong>
      <time>${escapeHtml(comment.comment_date)}</time>
      <p>${escapeHtml(comment.comment_text)}</p>
    </article>
  `).join('') || '<p>No comments yet.</p>';
}

async function submitComment(event) {
  event.preventDefault();
  const commentText = document.getElementById('commentText').value.trim();
  if (!trackedComplaintId || !commentText) {
    showMessage('commentMessage', 'Enter a comment for a tracked complaint.', 'error');
    return;
  }

  try {
    await apiJson(`/api/complaints/${trackedComplaintId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_text: commentText }),
    });
    document.getElementById('commentForm').reset();
    showMessage('commentMessage', 'Comment added successfully.', 'success');
    await renderComments(trackedComplaintId);
  } catch (error) {
    showMessage('commentMessage', error.message, 'error');
  }
}

async function loadTrackComplaint() {
  const searchBtn = document.getElementById('trackComplaintButton');
  const input = document.getElementById('trackComplaintId');
  const details = document.getElementById('trackComplaintDetails');

  if (!searchBtn || !details) return;

  searchBtn.addEventListener('click', async () => {
    const complaintId = input.value.trim();
    trackedComplaintId = null;
    document.getElementById('complaintComments')?.classList.add('hidden');
    if (!complaintId) {
      details.textContent = 'Please enter a complaint ID';
      details.classList.remove('hidden');
      return;
    }

    try {
      const response = await apiFetch(`/api/complaints/${complaintId}`);
      const complaint = await response.json();
      if (!response.ok) throw new Error(complaint.message || 'Complaint not found');
      if (!complaint.complaint_id) {
        throw new Error('Complaint not found');
      }

      const statusNames = ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
      const currentStatus = complaint.status_name || 'Pending';
      const activeIndex = statusNames.indexOf(currentStatus);
      details.innerHTML = `
        <h4>Complaint #${escapeHtml(complaint.complaint_id)}</h4>
        <p><strong>Subject:</strong> ${escapeHtml(complaint.subject)}</p>
        <p><strong>Description:</strong> ${escapeHtml(complaint.description)}</p>
        <p><strong>User:</strong> ${escapeHtml(complaint.user_name)}</p>
        <p><strong>Category:</strong> ${escapeHtml(complaint.category_name)}</p>
        <p><strong>Department:</strong> ${escapeHtml(complaint.department_name)}</p>
        <p><strong>Assigned Staff:</strong> ${escapeHtml(complaint.staff_name || 'Unassigned')}</p>
        <p><strong>Priority:</strong> ${escapeHtml(complaint.priority_name)}</p>
        <p><strong>Status:</strong> ${escapeHtml(complaint.status_name)}</p>
      `;
      details.classList.remove('hidden');
      trackedComplaintId = complaint.complaint_id;
      document.getElementById('complaintComments')?.classList.remove('hidden');
      await renderComments(trackedComplaintId);

      const steps = document.querySelectorAll('.timeline-step');
      steps.forEach((step, index) => {
        step.classList.toggle('active', index <= activeIndex);
      });
    } catch (error) {
      details.textContent = error.message;
      details.classList.remove('hidden');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!user) return;

  await loadLookupOptions();

  if (document.getElementById('complaintForm')) {
    document.getElementById('complaintForm').addEventListener('submit', submitComplaint);
  }

  if (document.getElementById('userComplaintTable')) {
    renderUserDashboard();
  }

  if (document.getElementById('myComplaintTable')) {
    renderMyComplaints();
  }

  if (document.getElementById('notificationTable')) {
    renderNotifications();
  }

  if (document.getElementById('trackComplaintButton')) {
    loadTrackComplaint();
  }

  if (document.getElementById('commentForm')) {
    document.getElementById('commentForm').addEventListener('submit', submitComment);
  }
});
