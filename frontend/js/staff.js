const user = requireLogin();
let dashboardLoadSequence = 0;

if (user) {
  const role = String(user.role || user.user_type || '').trim().toLowerCase();
  if (!['faculty', 'staff', 'admin'].includes(role)) {
    window.location.href = '/dashboard.html';
  }
}

async function loadControlData() {
  const [staffMembers, statuses, departments, categories] = await Promise.all([
    apiJson('/api/staff'),
    apiJson('/api/statuses'),
    apiJson('/api/departments'),
    apiJson('/api/categories'),
  ]);
  const isAdmin = String(user.role || user.user_type).toLowerCase() === 'admin';
  const visibleStaff = isAdmin ? staffMembers : staffMembers.filter((staff) => Number(staff.department_id) === Number(user.department_id));
  const visibleDepartments = isAdmin ? departments : departments.filter((department) => Number(department.department_id) === Number(user.department_id));

  const assignStaffSelect = document.getElementById('assignStaffId');
  if (assignStaffSelect) {
    assignStaffSelect.innerHTML = '<option value="">Select staff member</option>' + visibleStaff.map((staff) => `<option value="${staff.staff_id}">${escapeHtml(staff.staff_name)} (${escapeHtml(staff.department_name)})</option>`).join('');
  }

  const statusSelect = document.getElementById('statusSelect');
  if (statusSelect) {
    statusSelect.innerHTML = '<option value="">Select status</option>' + statuses.map((status) => `<option value="${status.status_id}">${escapeHtml(status.status_name)}</option>`).join('');
  }

  const filterOptions = [
    ['staffStatusFilter', statuses, 'status_id', 'status_name', 'All Statuses'],
    ['staffPriorityFilter', await apiJson('/api/priorities'), 'priority_id', 'priority_name', 'All Priorities'],
    ['staffDepartmentFilter', visibleDepartments, 'department_id', 'department_name', 'All Departments'],
    ['staffCategoryFilter', categories, 'category_id', 'category_name', 'All Categories'],
  ];
  for (const [elementId, items, valueKey, labelKey, emptyLabel] of filterOptions) {
    const select = document.getElementById(elementId);
    if (!select) continue;
    select.innerHTML = `<option value="">${emptyLabel}</option>` + items.map((item) => `<option value="${item[valueKey]}">${escapeHtml(item[labelKey])}</option>`).join('');
  }
}

function renderCounts(complaints) {
  const stats = {
    totalComplaints: complaints.length,
    pendingComplaints: complaints.filter((c) => String(c.status_name).toLowerCase() === 'pending').length,
    assignedComplaints: complaints.filter((c) => c.staff_name && c.staff_name !== 'Unassigned').length,
    inProgressComplaints: complaints.filter((c) => String(c.status_name).toLowerCase() === 'in progress').length,
    resolvedComplaints: complaints.filter((c) => String(c.status_name).toLowerCase() === 'resolved').length,
    closedComplaints: complaints.filter((c) => String(c.status_name).toLowerCase() === 'closed').length,
  };

  Object.entries(stats).forEach(([key, value]) => {
    const node = document.getElementById(key);
    if (node) node.textContent = value;
  });
}

function renderAllComplaints(complaints) {
  const allTable = document.getElementById('allComplaintsTable');
  if (!allTable) return;

  allTable.innerHTML = complaints.map((row) => `
    <tr>
      <td>${escapeHtml(row.complaint_id)}</td>
      <td>${escapeHtml(row.user_name)}</td>
      <td>${escapeHtml(row.category_name)}</td>
      <td>${escapeHtml(row.department_name)}</td>
      <td>${escapeHtml(row.staff_name || 'Unassigned')}</td>
      <td>${escapeHtml(row.priority_name)}</td>
      <td><span class="badge ${row.status_name === 'Closed' ? 'dark' : row.status_name === 'Resolved' ? 'success' : row.status_name === 'Pending' ? 'warning' : ''}">${escapeHtml(row.status_name)}</span></td>
      <td>${escapeHtml(row.subject)}</td>
    </tr>
  `).join('') || '<tr><td colspan="8">No complaints found</td></tr>';
}

function renderHighPriorityComplaints(complaints) {
  const table = document.getElementById('highPriorityTable');
  if (!table) return;

  const rows = complaints.filter((row) => ['High', 'Critical'].includes(row.priority_name));
  table.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.complaint_id)}</td>
      <td>${escapeHtml(row.user_name)}</td>
      <td>${escapeHtml(row.subject)}</td>
      <td>${escapeHtml(row.priority_name)}</td>
      <td><span class="badge ${row.status_name === 'Closed' ? 'dark' : row.status_name === 'Resolved' ? 'success' : row.status_name === 'Pending' ? 'warning' : ''}">${escapeHtml(row.status_name)}</span></td>
    </tr>
  `).join('') || '<tr><td colspan="5">No high priority complaints</td></tr>';
}

function renderAssignedComplaints(complaints) {
  const table = document.getElementById('assignedComplaintsTable');
  if (!table) return;

  const rows = complaints.filter((row) => row.staff_name && row.staff_name !== 'Unassigned');
  table.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.complaint_id)}</td>
      <td>${escapeHtml(row.user_name)}</td>
      <td>${escapeHtml(row.subject)}</td>
      <td><span class="badge ${row.status_name === 'Closed' ? 'dark' : row.status_name === 'Resolved' ? 'success' : row.status_name === 'Pending' ? 'warning' : ''}">${escapeHtml(row.status_name)}</span></td>
    </tr>
  `).join('') || '<tr><td colspan="4">No assigned complaints</td></tr>';
}

async function updateDashboard(filters = {}) {
  const requestId = ++dashboardLoadSequence;
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (String(value || '').trim()) parameters.set(key, String(value).trim());
  }
  const suffix = parameters.toString() ? `?${parameters.toString()}` : '';
  const complaints = await apiJson(`/api/complaints${suffix}`);
  if (requestId !== dashboardLoadSequence) return;
  renderCounts(complaints);
  renderAllComplaints(complaints);
  renderHighPriorityComplaints(complaints);
  renderAssignedComplaints(complaints);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!user) return;

  try {
    await loadControlData();
    await updateDashboard();
  } catch (error) {
    console.error('Staff dashboard failed to load:', error.message);
    const table = document.getElementById('allComplaintsTable');
    if (table) table.textContent = error.message;
    return;
  }

  const filters = {
    search: document.getElementById('staffComplaintSearch'),
    status: document.getElementById('staffStatusFilter'),
    priority: document.getElementById('staffPriorityFilter'),
    department: document.getElementById('staffDepartmentFilter'),
    category: document.getElementById('staffCategoryFilter'),
  };
  const applyFilters = () => updateDashboard(Object.fromEntries(
    Object.entries(filters).map(([key, element]) => [key, element?.value || ''])
  )).catch((error) => console.error('Complaint filtering failed:', error.message));
  Object.values(filters).forEach((element) => {
    if (element) element.addEventListener(element.tagName === 'INPUT' ? 'input' : 'change', applyFilters);
  });

  const assignForm = document.getElementById('assignForm');
  if (assignForm) {
    assignForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const complaintId = document.getElementById('assignComplaintId').value;
      const staffId = document.getElementById('assignStaffId').value;

      const response = await apiFetch(`/api/complaints/${complaintId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId }),
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.message || 'Unable to assign complaint');
        return;
      }

      alert(data.message || 'Complaint assigned successfully');
      await updateDashboard(Object.fromEntries(Object.entries(filters).map(([key, element]) => [key, element?.value || ''])));
      assignForm.reset();
    });
  }

  const statusForm = document.getElementById('statusForm');
  if (statusForm) {
    statusForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const complaintId = document.getElementById('statusComplaintId').value;
      const statusId = document.getElementById('statusSelect').value;

      const response = await apiFetch(`/api/complaints/${complaintId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_id: statusId }),
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.message || 'Unable to update complaint status');
        return;
      }

      alert(data.message || 'Complaint status updated successfully');
      await updateDashboard(Object.fromEntries(Object.entries(filters).map(([key, element]) => [key, element?.value || ''])));
      statusForm.reset();
    });
  }
});
