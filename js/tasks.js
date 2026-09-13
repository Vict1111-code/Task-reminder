export function makeTask(data) {
  const now = new Date().toISOString();
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
    completed: Boolean(data.completed),
    createdAt: data.createdAt || now,
    updatedAt: now
  };
}

export function taskDateTime(task) {
  return new Date(`${task.date}T${task.time || '00:00'}:00`);
}

export function isToday(task) {
  return task.date === new Date().toISOString().slice(0, 10);
}

export function isUpcoming(task) {
  return !task.completed && taskDateTime(task) > new Date();
}

export function matchesSearch(task, query) {
  if (!query) return true;
  const haystack = `${task.title} ${task.message} ${task.category}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function formatDateTime(task) {
  const date = taskDateTime(task);
  return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function nextOccurrence(task) {
  const base = taskDateTime(task);
  if (task.repeat === 'none') return base;
  const candidate = new Date(base);
  const now = new Date();
  if (task.repeat === 'daily') {
    while (candidate <= now) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }
  const days = task.repeatDays.length ? task.repeatDays : [candidate.getDay()];
  for (let i = 0; i < 8; i += 1) {
    if (candidate > now && days.includes(candidate.getDay())) return candidate;
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}
