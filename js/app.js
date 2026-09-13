import { getTasks, saveTask, deleteTask } from './storage.js';
import { makeTask, isToday, isUpcoming, matchesSearch, formatDateTime, taskDateTime } from './tasks.js';

const $ = (selector) => document.querySelector(selector);
const state = { tasks: [], filter: 'today', query: '', notified: new Set() };
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const elements = {
  list: $('#taskList'), modal: $('#taskModal'), form: $('#taskForm'), title: $('#taskTitle'), message: $('#taskMessage'),
  date: $('#taskDate'), time: $('#taskTime'), category: $('#taskCategory'), priority: $('#taskPriority'), repeat: $('#taskRepeat'),
  id: $('#taskId'), weekdayPicker: $('#weekdayPicker'), search: $('#searchInput')
};

function todayIso() { return new Date().toISOString().slice(0, 10); }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); }

function render() {
  const filtered = state.tasks
    .filter((task) => {
      if (state.filter === 'today') return isToday(task);
      if (state.filter === 'upcoming') return isUpcoming(task);
      if (state.filter === 'completed') return task.completed;
      return true;
    })
    .filter((task) => matchesSearch(task, state.query))
    .sort((a, b) => taskDateTime(a) - taskDateTime(b));

  elements.list.innerHTML = filtered.length ? filtered.map(taskCard).join('') : '<div class="empty-state"><strong>No tasks here yet.</strong><p>Add a task or change the filter to see more.</p></div>';
  updateStats();
}

function taskCard(task) {
  const priority = `priority-${task.priority}`;
  const repeat = task.repeat === 'none' ? '' : `<span class="badge">↻ ${task.repeat}</span>`;
  return `<article class="task-card ${task.completed ? 'completed' : ''}">
    <button class="check-button" data-action="toggle" data-id="${task.id}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}"></button>
    <div class="task-main"><div class="task-title">${escapeHtml(task.title)}</div><div class="task-meta"><span>${escapeHtml(formatDateTime(task))}</span><span class="badge">${escapeHtml(task.category)}</span><span class="badge ${priority}">${escapeHtml(task.priority)}</span>${repeat}</div></div>
    <div class="task-actions"><button class="small-button" data-action="edit" data-id="${task.id}" aria-label="Edit task">✎</button><button class="small-button" data-action="delete" data-id="${task.id}" aria-label="Delete task">×</button></div>
  </article>`;
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char])); }

function updateStats() {
  const today = state.tasks.filter(isToday);
  const completed = state.tasks.filter((task) => task.completed);
  const upcoming = state.tasks.filter(isUpcoming);
  $('#todayCount').textContent = today.length;
  $('#upcomingCount').textContent = upcoming.length;
  $('#completedCount').textContent = completed.length;
  $('#totalCount').textContent = state.tasks.length;
  const doneToday = today.filter((task) => task.completed).length;
  const percent = today.length ? Math.round((doneToday / today.length) * 100) : 0;
  $('#progressText').textContent = `${percent}%`;
  $('#progressBar').style.width = `${percent}%`;
}

function openModal(task = null) {
  elements.form.reset();
  elements.id.value = task?.id || '';
  elements.title.value = task?.title || '';
  elements.message.value = task?.message || '';
  elements.date.value = task?.date || todayIso();
  elements.time.value = task?.time || '08:00';
  elements.category.value = task?.category || 'Personal';
  elements.priority.value = task?.priority || 'medium';
  elements.repeat.value = task?.repeat || 'none';
  $('#modalTitle').textContent = task ? 'Edit task' : 'Create task';
  renderWeekdays(task?.repeatDays || []);
  elements.modal.classList.remove('hidden');
  elements.title.focus();
}

function closeModal() { elements.modal.classList.add('hidden'); }

function renderWeekdays(selected = []) {
  elements.weekdayPicker.classList.toggle('hidden', elements.repeat.value !== 'weekly');
  elements.weekdayPicker.innerHTML = weekdays.map((name, index) => `<button type="button" class="day-choice ${selected.includes(index) ? 'active' : ''}" data-day="${index}">${name}</button>`).join('');
}

async function submitTask(event) {
  event.preventDefault();
  const existing = state.tasks.find((task) => task.id === elements.id.value);
  const repeatDays = [...elements.weekdayPicker.querySelectorAll('.day-choice.active')].map((button) => Number(button.dataset.day));
  const task = makeTask({ id: elements.id.value || undefined, title: elements.title.value, message: elements.message.value, date: elements.date.value, time: elements.time.value, category: elements.category.value, priority: elements.priority.value, repeat: elements.repeat.value, repeatDays, completed: existing?.completed, createdAt: existing?.createdAt });
  await saveTask(task);
  const index = state.tasks.findIndex((item) => item.id === task.id);
  if (index >= 0) state.tasks[index] = task; else state.tasks.push(task);
  closeModal(); render(); showToast(existing ? 'Task updated' : 'Task created');
}

async function toggleTask(id) {
  const task = state.tasks.find((item) => item.id === id); if (!task) return;
  task.completed = !task.completed; task.updatedAt = new Date().toISOString(); await saveTask(task); render();
}

async function removeTask(id) {
  const task = state.tasks.find((item) => item.id === id); if (!task) return;
  if (!confirm(`Delete “${task.title}”?`)) return;
  await deleteTask(id); state.tasks = state.tasks.filter((item) => item.id !== id); render(); showToast('Task deleted');
}

function checkReminders() {
  const now = new Date();
  state.tasks.forEach((task) => {
    if (task.completed || task.repeat !== 'none') return;
    const due = taskDateTime(task);
    const key = `${task.id}:${task.date}:${task.time}`;
    if (due <= now && now - due < 60000 && !state.notified.has(key)) { state.notified.add(key); notify(task); }
  });
}

async function notify(task) {
  const message = task.message || `Reminder: ${task.title}`;
  if ('Notification' in window && Notification.permission === 'granted') new Notification(task.title, { body: message, icon: 'icons/icon-192.png' });
  else showToast(`⏰ ${task.title}`);
  try { const audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'); await audio.play(); } catch { /* browser autoplay may block sound */ }
}

async function requestNotifications() {
  if (!('Notification' in window)) return showToast('Notifications are not supported by this browser');
  const permission = await Notification.requestPermission();
  showToast(permission === 'granted' ? 'Notifications enabled' : 'Notification permission was not granted');
}

document.addEventListener('click', async (event) => {
  const close = event.target.closest('[data-close-modal]'); if (close) return closeModal();
  const filter = event.target.closest('[data-filter]'); if (filter) { state.filter = filter.dataset.filter; document.querySelectorAll('.filter-tab').forEach((button) => button.classList.toggle('active', button === filter)); return render(); }
  const day = event.target.closest('[data-day]'); if (day) return day.classList.toggle('active');
  const action = event.target.closest('[data-action]'); if (!action) return;
  const task = state.tasks.find((item) => item.id === action.dataset.id);
  if (action.dataset.action === 'toggle') return toggleTask(action.dataset.id);
  if (action.dataset.action === 'delete') return removeTask(action.dataset.id);
  if (action.dataset.action === 'edit') return openModal(task);
});

$('#openTaskButton').addEventListener('click', () => openModal());
$('#notificationButton').addEventListener('click', requestNotifications);
elements.form.addEventListener('submit', submitTask);
elements.repeat.addEventListener('change', () => renderWeekdays());
elements.search.addEventListener('input', (event) => { state.query = event.target.value; render(); });

async function init() {
  state.tasks = await getTasks();
  $('#todayLabel').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const hour = new Date().getHours();
  $('#greeting').textContent = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  render();
  checkReminders();
  setInterval(checkReminders, 15000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);
}

init().catch((error) => { console.error(error); showToast('Could not load saved tasks'); });
