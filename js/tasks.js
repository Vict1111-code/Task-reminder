export const DEFAULT_REMINDERS = [0];

export function makeTask(data) {
  const now = new Date().toISOString();
  const reminders = [...new Set((data.reminders || DEFAULT_REMINDERS).map(Number).filter((value) => Number.isFinite(value) && value >= 0 && value <= 10080))].sort((a, b) => b - a);
  return {
    id: data.id || crypto.randomUUID(),
    title: data.title.trim(),
    message: data.message?.trim() || `Reminder: ${data.title.trim()}`,
    date: data.date,
    time: data.time,
    category: data.category || 'Personal',
    priority: data.priority || 'medium',
    repeat: data.repeat || 'none',
    repeatDays: data.repeatDays || [],
    reminders: reminders.length ? reminders : [0],
    completed: Boolean(data.completed),
    createdAt: data.createdAt || now,
    updatedAt: now,
    lastTriggered: data.lastTriggered || null,
    snoozeUntil: data.snoozeUntil || null
  };
}

export function taskDateTime(task) {
  return new Date(`${task.date}T${task.time || '00:00'}:00`);
}

export function isToday(task) {
  const date = taskDateTime(task);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

export function isUpcoming(task) {
  return !task.completed && nextOccurrence(task) > new Date();
}

export function matchesSearch(task, query) {
  if (!query) return true;
  const haystack = `${task.title} ${task.message} ${task.category}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function formatDateTime(task) {
  const date = nextOccurrence(task);
  return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function nextOccurrence(task, from = new Date()) {
  const base = taskDateTime(task);
  if (task.repeat === 'none') return base;

  const candidate = new Date(base);
  if (task.repeat === 'daily') {
    while (candidate <= from) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }

  const days = task.repeatDays?.length ? task.repeatDays : [candidate.getDay()];
  for (let i = 0; i < 14; i += 1) {
    if (candidate > from && days.includes(candidate.getDay())) return candidate;
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

export function occurrenceKey(task, occurrence = nextOccurrence(task, new Date(Date.now() - 60000))) {
  return `${task.id}:${occurrence.toISOString()}`;
}

export function reminderDateTime(task, occurrence, minutesBefore) {
  return new Date(occurrence.getTime() - minutesBefore * 60000);
}

export function activeReminder(task, now = new Date()) {
  if (task.completed) return null;
  if (task.snoozeUntil && new Date(task.snoozeUntil) <= now) return { type: 'snooze', occurrence: nextOccurrence(task, new Date(now.getTime() - 60000)), minutesBefore: 0 };
  const occurrence = task.repeat === 'none' ? taskDateTime(task) : nextOccurrence(task, new Date(now.getTime() - 60000));
  for (const minutesBefore of task.reminders || [0]) {
    const due = reminderDateTime(task, occurrence, minutesBefore);
    const age = now.getTime() - due.getTime();
    if (age >= 0 && age < 60000) return { type: 'scheduled', occurrence, minutesBefore, due };
  }
  return null;
}
