import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from './lib/supabase';
import { clearSettings, loadSettings, saveSettings } from './lib/settings';

function today() {
  return toInputDate(new Date());
}

function currentYear() {
  return new Date().getFullYear();
}

function currentMonth() {
  return new Date().getMonth() + 1;
}

function shiftDate(dateText, days) {
  const d = fromInputDate(dateText);
  d.setDate(d.getDate() + days);
  return toInputDate(d);
}

function formatDate(dateText) {
  const d = fromInputDate(dateText);
  return d.toLocaleDateString();
}

function fromInputDate(dateText) {
  const [year, month, day] = dateText.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

function formatDuration(minutes) {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rem = rounded % 60;
  if (rem === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours} hour${hours === 1 ? '' : 's'} ${rem} minute${rem === 1 ? '' : 's'}`;
}

function Message({ text, tone = 'normal' }) {
  if (!text) return null;
  return <div className={`message ${tone}`}>{text}</div>;
}

function TaskInput({
  tasks,
  value,
  onChange,
  onSelect,
  onCreate,
  disabled = false,
  placeholder = 'Task',
  allowCreate = true,
  inputRef,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const filtered = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    if (!q) return sorted.slice(0, 12);
    return sorted.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 12);
  }, [tasks, q]);

  const exactMatch = useMemo(
    () => tasks.find((t) => t.name.toLowerCase() === q),
    [tasks, q]
  );
  const canCreate = allowCreate && q && !exactMatch;
  const showDropdown = isOpen && !disabled && (filtered.length > 0 || canCreate);

  return (
    <div className="task-input-wrap">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setTimeout(() => setIsOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsOpen(false);
        }}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
      />
      {showDropdown ? (
        <div className="task-dropdown">
          {filtered.map((task) => (
            <button
              key={task.id}
              type="button"
              className="task-option"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(task);
                setIsOpen(false);
              }}
            >
              {task.name}
            </button>
          ))}
          {canCreate ? (
            <button
              type="button"
              className="task-option create"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onCreate(value);
                setIsOpen(false);
              }}
            >
              Create "{normalizeName(value)}"
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SettingsScreen({ settings, onSave, onClear, onTest }) {
  const [url, setUrl] = useState(settings.url);
  const [anonKey, setAnonKey] = useState(settings.anonKey);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('normal');

  useEffect(() => {
    setUrl(settings.url);
    setAnonKey(settings.anonKey);
  }, [settings.url, settings.anonKey]);

  return (
    <section className="panel">
      <h2>Settings</h2>
      <label>
        Supabase URL
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://...supabase.co" />
      </label>
      <label>
        Supabase Anon Key
        <textarea
          value={anonKey}
          onChange={(e) => setAnonKey(e.target.value)}
          rows={4}
          placeholder="paste anon key"
        />
      </label>
      <div className="row">
        <button
          type="button"
          onClick={() => {
            const cleanUrl = url.trim();
            const cleanKey = anonKey.trim();
            if (!cleanUrl || !cleanKey) {
              setTone('error');
              setMessage('Both URL and anon key are required.');
              return;
            }
            onSave(cleanUrl, cleanKey);
            setTone('success');
            setMessage('Saved.');
          }}
        >
          Save
        </button>
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            const cleanUrl = url.trim();
            const cleanKey = anonKey.trim();
            if (!cleanUrl || !cleanKey) {
              setTone('error');
              setMessage('Both URL and anon key are required.');
              return;
            }
            const result = await onTest(cleanUrl, cleanKey);
            setTone(result.ok ? 'success' : 'error');
            setMessage(result.message);
          }}
        >
          Test connection
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            onClear();
            setUrl('');
            setAnonKey('');
            setMessage('Settings cleared.');
            setTone('normal');
          }}
        >
          Clear
        </button>
      </div>
      <Message text={message} tone={tone} />
      <p className="hint">Credentials are stored only in this browser.</p>
    </section>
  );
}

function LogScreen({ supabase, tasks, refreshTasks }) {
  const [date, setDate] = useState(today());
  const [taskQuery, setTaskQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [minutes, setMinutes] = useState('');

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('normal');

  const [editingId, setEditingId] = useState('');
  const [editingTaskQuery, setEditingTaskQuery] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editingDate, setEditingDate] = useState('');
  const [editingMinutes, setEditingMinutes] = useState('');

  const minutesRef = useRef(null);
  const taskInputRef = useRef(null);

  async function loadLogs(targetDate) {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('time_logs')
      .select('id, task_id, log_date, minutes, tasks (id, name)')
      .eq('log_date', targetDate)
      .order('created_at', { ascending: true });

    setLoading(false);
    if (error) {
      setTone('error');
      setMessage(error.message);
      return;
    }
    setLogs(data || []);
  }

  useEffect(() => {
    loadLogs(date);
  }, [date, supabase]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of logs) {
      const key = row.tasks?.name || 'Unknown task';
      map.set(key, (map.get(key) || 0) + row.minutes);
    }
    return [...map.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], undefined, { sensitivity: 'base' });
    });
  }, [logs]);

  const total = useMemo(() => grouped.reduce((sum, [, mins]) => sum + mins, 0), [grouped]);

  function validateMinutes(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 10000) {
      return null;
    }
    return parsed;
  }

  async function createTaskIfNeeded(name) {
    const clean = normalizeName(name);
    if (!clean) return null;
    const existing = tasks.find((t) => t.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ name: clean }])
      .select('id, name')
      .single();

    if (error) {
      if (error.code === '23505') {
        await refreshTasks();
        return tasks.find((t) => t.name.toLowerCase() === clean.toLowerCase()) || null;
      }
      throw error;
    }

    await refreshTasks();
    return data;
  }

  async function addLog({ keepTask = true } = {}) {
    if (!supabase || saving) return;
    setMessage('');

    const validMinutes = validateMinutes(minutes);
    if (!date) {
      setTone('error');
      setMessage('Date is required.');
      return;
    }
    if (!taskQuery.trim() && !selectedTask) {
      setTone('error');
      setMessage('Task is required.');
      return;
    }
    if (!validMinutes) {
      setTone('error');
      setMessage('Minutes must be a positive whole number (1-10000).');
      return;
    }

    setSaving(true);
    try {
      const task = selectedTask || (await createTaskIfNeeded(taskQuery));
      if (!task) {
        setTone('error');
        setMessage('Task is required.');
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('time_logs').insert([
        {
          task_id: task.id,
          log_date: date,
          minutes: validMinutes,
        },
      ]);

      if (error) throw error;

      setMinutes('');
      if (keepTask) {
        setSelectedTask(task);
        setTaskQuery(task.name);
      } else {
        setTaskQuery('');
        setSelectedTask(null);
      }
      setTone('success');
      setMessage('Saved.');
      await loadLogs(date);
      if (keepTask) {
        minutesRef.current?.focus();
      } else {
        taskInputRef.current?.focus();
      }
    } catch (err) {
      setTone('error');
      setMessage(err.message || 'Failed to save.');
    }
    setSaving(false);
  }

  async function deleteLog(id) {
    if (!window.confirm('Delete this entry?')) return;
    const { error } = await supabase.from('time_logs').delete().eq('id', id);
    if (error) {
      setTone('error');
      setMessage(error.message);
      return;
    }
    await loadLogs(date);
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditingTask(row.tasks || null);
    setEditingTaskQuery(row.tasks?.name || '');
    setEditingDate(row.log_date);
    setEditingMinutes(String(row.minutes));
  }

  async function saveEdit() {
    const validMinutes = validateMinutes(editingMinutes);
    if (!validMinutes) {
      setTone('error');
      setMessage('Minutes must be a positive whole number (1-10000).');
      return;
    }
    if (!editingDate) {
      setTone('error');
      setMessage('Date is required.');
      return;
    }

    try {
      const task = editingTask || (await createTaskIfNeeded(editingTaskQuery));
      if (!task) {
        setTone('error');
        setMessage('Task is required.');
        return;
      }

      const { error } = await supabase
        .from('time_logs')
        .update({
          task_id: task.id,
          log_date: editingDate,
          minutes: validMinutes,
        })
        .eq('id', editingId);

      if (error) throw error;

      setEditingId('');
      setTone('success');
      setMessage('Updated.');
      await loadLogs(date);
    } catch (err) {
      setTone('error');
      setMessage(err.message || 'Failed to update.');
    }
  }

  return (
    <section className="panel">
      <div className="date-row">
        <button type="button" className="ghost" onClick={() => setDate(shiftDate(date, -1))}>
          Prev
        </button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="ghost" onClick={() => setDate(shiftDate(date, 1))}>
          Next
        </button>
      </div>

      <div className="log-layout">
        <aside className="task-panel">
          <strong>Tasks</strong>
          <div className="task-scroll-list">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className={`task-list-item ${selectedTask?.id === task.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedTask(task);
                  setTaskQuery(task.name);
                  minutesRef.current?.focus();
                }}
              >
                {task.name}
              </button>
            ))}
          </div>
        </aside>

        <div className="log-main">
          <div className="form-row">
            <TaskInput
              tasks={tasks}
              inputRef={taskInputRef}
              value={taskQuery}
              onChange={(next) => {
                setTaskQuery(next);
                setSelectedTask(null);
              }}
              onSelect={(task) => {
                setTaskQuery(task.name);
                setSelectedTask(task);
                minutesRef.current?.focus();
              }}
              onCreate={async (name) => {
                try {
                  const task = await createTaskIfNeeded(name);
                  if (task) {
                    setTaskQuery(task.name);
                    setSelectedTask(task);
                    minutesRef.current?.focus();
                  }
                } catch (err) {
                  setTone('error');
                  setMessage(err.message || 'Failed to create task.');
                }
              }}
            />
            <input
              ref={minutesRef}
              type="number"
              min="1"
              max="10000"
              step="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLog({ keepTask: false });
                }
              }}
              placeholder="Minutes"
            />
            <button type="button" onClick={() => addLog({ keepTask: false })} disabled={saving}>
              {saving ? 'Saving...' : 'Add'}
            </button>
          </div>

          <Message text={message} tone={tone} />

          {loading ? <p>Loading...</p> : null}

          <div className="daily-summary">
            <div className="subhead">
              <h3>{formatDate(date)}</h3>
              <strong>{formatDuration(total)}</strong>
            </div>
            {!loading && grouped.length === 0 ? <p className="hint">No entries.</p> : null}
            {grouped.length > 0 ? (
              <div className="daily-table-wrap">
                <table className="daily-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map(([name, mins]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>{formatDuration(mins)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Daily total</td>
                      <td>{formatDuration(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function DailyViewScreen({ supabase, tasks, refreshTasks }) {
  const [date, setDate] = useState(today());
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('normal');
  const [editingId, setEditingId] = useState('');
  const [editingTaskQuery, setEditingTaskQuery] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editingDate, setEditingDate] = useState('');
  const [editingMinutes, setEditingMinutes] = useState('');

  async function loadLogs(targetDate) {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('time_logs')
      .select('id, task_id, log_date, minutes, tasks (id, name)')
      .eq('log_date', targetDate)
      .order('created_at', { ascending: false });

    setLoading(false);
    if (error) {
      setTone('error');
      setMessage(error.message);
      return;
    }
    setMessage('');
    setLogs(data || []);
  }

  useEffect(() => {
    loadLogs(date);
  }, [date, supabase]);

  function validateMinutes(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 10000) {
      return null;
    }
    return parsed;
  }

  async function createTaskIfNeeded(name) {
    const clean = normalizeName(name);
    if (!clean) return null;
    const existing = tasks.find((t) => t.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ name: clean }])
      .select('id, name')
      .single();

    if (error) {
      if (error.code === '23505') {
        await refreshTasks();
        return tasks.find((t) => t.name.toLowerCase() === clean.toLowerCase()) || null;
      }
      throw error;
    }

    await refreshTasks();
    return data;
  }

  async function deleteLog(id) {
    if (!window.confirm('Delete this entry?')) return;
    const { error } = await supabase.from('time_logs').delete().eq('id', id);
    if (error) {
      setTone('error');
      setMessage(error.message);
      return;
    }
    await loadLogs(date);
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditingTask(row.tasks || null);
    setEditingTaskQuery(row.tasks?.name || '');
    setEditingDate(row.log_date);
    setEditingMinutes(String(row.minutes));
  }

  async function saveEdit() {
    const validMinutes = validateMinutes(editingMinutes);
    if (!validMinutes) {
      setTone('error');
      setMessage('Minutes must be a positive whole number (1-10000).');
      return;
    }
    if (!editingDate) {
      setTone('error');
      setMessage('Date is required.');
      return;
    }

    try {
      const task = editingTask || (await createTaskIfNeeded(editingTaskQuery));
      if (!task) {
        setTone('error');
        setMessage('Task is required.');
        return;
      }

      const { error } = await supabase
        .from('time_logs')
        .update({
          task_id: task.id,
          log_date: editingDate,
          minutes: validMinutes,
        })
        .eq('id', editingId);

      if (error) throw error;

      setEditingId('');
      setTone('success');
      setMessage('Updated.');
      await loadLogs(date);
    } catch (err) {
      setTone('error');
      setMessage(err.message || 'Failed to update.');
    }
  }

  return (
    <section className="panel">
      <div className="date-row">
        <button type="button" className="ghost" onClick={() => setDate(shiftDate(date, -1))}>
          Prev
        </button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="ghost" onClick={() => setDate(shiftDate(date, 1))}>
          Next
        </button>
      </div>

      <Message text={message} tone={tone} />
      {loading ? <p>Loading...</p> : null}
      {!loading && logs.length === 0 ? <p className="hint">No entries.</p> : null}
      {logs.length > 0 ? (
        <div className="daily-table-wrap">
          <table className="daily-table log-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => {
                if (editingId === row.id) {
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="log-edit-main">
                          <input type="date" value={editingDate} onChange={(e) => setEditingDate(e.target.value)} />
                          <TaskInput
                            tasks={tasks}
                            value={editingTaskQuery}
                            onChange={(next) => {
                              setEditingTaskQuery(next);
                              setEditingTask(null);
                            }}
                            onSelect={(task) => {
                              setEditingTask(task);
                              setEditingTaskQuery(task.name);
                            }}
                            onCreate={async (name) => {
                              try {
                                const task = await createTaskIfNeeded(name);
                                if (task) {
                                  setEditingTask(task);
                                  setEditingTaskQuery(task.name);
                                }
                              } catch (err) {
                                setTone('error');
                                setMessage(err.message || 'Failed to create task.');
                              }
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="log-edit-side">
                          <input
                            type="number"
                            min="1"
                            max="10000"
                            step="1"
                            value={editingMinutes}
                            onChange={(e) => setEditingMinutes(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                saveEdit();
                              }
                            }}
                          />
                          <button type="button" onClick={saveEdit}>
                            Save
                          </button>
                          <button type="button" className="ghost" onClick={() => setEditingId('')}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={row.id}>
                    <td>{row.tasks?.name || 'Unknown task'}</td>
                    <td>
                      <div className="log-time-actions">
                        <span>{row.minutes} min</span>
                        <div className="row-actions">
                          <button type="button" className="ghost" onClick={() => startEdit(row)}>
                            Edit
                          </button>
                          <button type="button" className="ghost danger" onClick={() => deleteLog(row.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function monthLabel(month) {
  return new Date(2000, month - 1, 1).toLocaleString(undefined, { month: 'short' });
}

function TaskHistoryScreen({ supabase, tasks, refreshTasks }) {
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('normal');

  const [view, setView] = useState('daily');
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(currentMonth());
  const [collapsedDaily, setCollapsedDaily] = useState(false);
  const [taskFilter, setTaskFilter] = useState('');
  const [selectedYears, setSelectedYears] = useState([String(currentYear())]);

  const [manageQuery, setManageQuery] = useState('');
  const [manageTask, setManageTask] = useState(null);
  const [newName, setNewName] = useState('');

  async function loadAllLogs() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('time_logs')
      .select('task_id, log_date, minutes, tasks (id, name)')
      .order('log_date', { ascending: true });

    setLoading(false);
    if (error) {
      setTone('error');
      setMessage(error.message);
      return;
    }

    setAllLogs(data || []);
    setMessage('');
  }

  useEffect(() => {
    loadAllLogs();
  }, [supabase]);

  useEffect(() => {
    setNewName(manageTask?.name || '');
  }, [manageTask?.id]);

  const yearOptions = useMemo(() => {
    const years = new Set([String(currentYear())]);
    for (const row of allLogs) {
      years.add(String(new Date(`${row.log_date}T00:00:00`).getFullYear()));
    }
    return [...years].sort();
  }, [allLogs]);

  useEffect(() => {
    if (!yearOptions.includes(String(year))) {
      setYear(Number(yearOptions[yearOptions.length - 1] || currentYear()));
    }
    if (selectedYears.length === 0) {
      setSelectedYears([String(yearOptions[yearOptions.length - 1] || currentYear())]);
      return;
    }
    const nextYears = selectedYears.filter((y) => yearOptions.includes(y));
    if (!nextYears.length) {
      setSelectedYears([String(yearOptions[yearOptions.length - 1] || currentYear())]);
    } else if (nextYears.length !== selectedYears.length) {
      setSelectedYears(nextYears);
    }
  }, [yearOptions]);

  const monthDays = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  const allTaskRows = useMemo(() => {
    const byId = new Map();
    for (const task of tasks) {
      byId.set(task.id, { id: task.id, name: task.name });
    }
    for (const row of allLogs) {
      if (!byId.has(row.task_id)) {
        byId.set(row.task_id, {
          id: row.task_id,
          name: row.tasks?.name || 'Unknown task',
        });
      }
    }

    const rows = [...byId.values()];
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const q = taskFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(q));
  }, [tasks, allLogs, taskFilter]);

  const monthLogs = useMemo(() => {
    return allLogs.filter((row) => {
      const d = new Date(`${row.log_date}T00:00:00`);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [allLogs, year, month]);

  const yearLogs = useMemo(() => {
    return allLogs.filter((row) => new Date(`${row.log_date}T00:00:00`).getFullYear() === year);
  }, [allLogs, year]);

  const yearlyLogs = useMemo(() => {
    const set = new Set(selectedYears.map(Number));
    return allLogs.filter((row) => set.has(new Date(`${row.log_date}T00:00:00`).getFullYear()));
  }, [allLogs, selectedYears]);

  const dailyMap = useMemo(() => {
    const map = new Map();
    for (const row of monthLogs) {
      const day = new Date(`${row.log_date}T00:00:00`).getDate();
      if (!map.has(row.task_id)) map.set(row.task_id, new Map());
      const taskDays = map.get(row.task_id);
      taskDays.set(day, (taskDays.get(day) || 0) + row.minutes);
    }
    return map;
  }, [monthLogs]);

  const weeklyMap = useMemo(() => {
    const map = new Map();
    for (const row of monthLogs) {
      const day = new Date(`${row.log_date}T00:00:00`).getDate();
      const week = Math.ceil(day / 7);
      if (!map.has(row.task_id)) map.set(row.task_id, [0, 0, 0, 0, 0]);
      map.get(row.task_id)[week - 1] += row.minutes;
    }
    return map;
  }, [monthLogs]);

  const monthlyMap = useMemo(() => {
    const map = new Map();
    for (const row of yearLogs) {
      const m = new Date(`${row.log_date}T00:00:00`).getMonth();
      if (!map.has(row.task_id)) map.set(row.task_id, Array.from({ length: 12 }, () => 0));
      map.get(row.task_id)[m] += row.minutes;
    }
    return map;
  }, [yearLogs]);

  const yearlyMap = useMemo(() => {
    const map = new Map();
    const yearNums = selectedYears.map(Number);
    for (const row of yearlyLogs) {
      const y = new Date(`${row.log_date}T00:00:00`).getFullYear();
      if (!map.has(row.task_id)) {
        map.set(
          row.task_id,
          new Map(yearNums.map((yr) => [yr, 0]))
        );
      }
      const rowMap = map.get(row.task_id);
      rowMap.set(y, (rowMap.get(y) || 0) + row.minutes);
    }
    return map;
  }, [yearlyLogs, selectedYears]);

  async function renameTask() {
    if (!manageTask) return;
    const clean = normalizeName(newName);
    if (!clean) {
      setTone('error');
      setMessage('Task name cannot be empty.');
      return;
    }

    const duplicate = tasks.find(
      (task) => task.id !== manageTask.id && task.name.toLowerCase() === clean.toLowerCase()
    );
    if (duplicate) {
      setTone('error');
      setMessage('Task name already exists.');
      return;
    }

    const { error } = await supabase.from('tasks').update({ name: clean }).eq('id', manageTask.id);
    if (error) {
      setTone('error');
      setMessage(error.message);
      return;
    }

    setTone('success');
    setMessage('Task renamed.');
    await refreshTasks();
    await loadAllLogs();
    setManageTask((prev) => (prev ? { ...prev, name: clean } : null));
    setManageQuery(clean);
  }

  async function archiveTask() {
    if (!manageTask) return;
    if (!window.confirm('Archive this task?')) return;

    const { error } = await supabase.from('tasks').update({ is_archived: true }).eq('id', manageTask.id);
    if (error) {
      setTone('error');
      setMessage(error.message);
      return;
    }

    setTone('success');
    setMessage('Task archived.');
    await refreshTasks();
    await loadAllLogs();
    setManageTask(null);
    setManageQuery('');
    setNewName('');
  }

  return (
    <section className="panel">
      <div className="history-controls">
        <select value={view} onChange={(e) => setView(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>

        {(view === 'daily' || view === 'weekly' || view === 'monthly') ? (
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        ) : null}

        {(view === 'daily' || view === 'weekly') ? (
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        ) : null}

        {view === 'yearly' ? (
          <select
            multiple
            value={selectedYears}
            onChange={(e) => {
              const values = [...e.target.selectedOptions].map((opt) => opt.value);
              setSelectedYears(values.length ? values : selectedYears);
            }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        ) : null}

        <input
          placeholder="Filter task"
          value={taskFilter}
          onChange={(e) => setTaskFilter(e.target.value)}
        />

        {view === 'daily' ? (
          <button type="button" className="secondary" onClick={() => setCollapsedDaily((v) => !v)}>
            {collapsedDaily ? 'Expand Daily View' : 'Collapse Daily View'}
          </button>
        ) : null}
      </div>

      <div className="history-manage">
        <TaskInput
          tasks={tasks}
          value={manageQuery}
          onChange={(next) => {
            setManageQuery(next);
            setManageTask(null);
          }}
          onSelect={(task) => {
            setManageTask(task);
            setManageQuery(task.name);
          }}
          onCreate={() => {}}
          allowCreate={false}
          placeholder="Select task to rename/archive"
        />
        {manageTask ? (
          <>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button type="button" onClick={renameTask}>Rename</button>
            <button type="button" className="ghost danger" onClick={archiveTask}>Archive</button>
          </>
        ) : null}
      </div>

      <Message text={message} tone={tone} />
      {loading ? <p>Loading...</p> : null}

      {view === 'daily' && !collapsedDaily ? (
        <div className="grid-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Task</th>
                {Array.from({ length: monthDays }, (_, i) => i + 1).map((d) => (
                  <th key={d}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allTaskRows.map((task) => (
                <tr key={task.id}>
                  <td className="task-col">{task.name}</td>
                  {Array.from({ length: monthDays }, (_, i) => i + 1).map((d) => {
                    const value = dailyMap.get(task.id)?.get(d) || 0;
                    return (
                      <td key={d} title={formatDuration(value)}>
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {view === 'weekly' ? (
        <div className="grid-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Task</th>
                <th>W1</th>
                <th>W2</th>
                <th>W3</th>
                <th>W4</th>
                <th>W5</th>
                <th>Avg/week</th>
              </tr>
            </thead>
            <tbody>
              {allTaskRows.map((task) => {
                const values = weeklyMap.get(task.id) || [0, 0, 0, 0, 0];
                const total = values.reduce((a, b) => a + b, 0);
                const avg = Math.round((total / 5) * 100) / 100;
                return (
                  <tr key={task.id}>
                    <td className="task-col">{task.name}</td>
                    {values.map((v, idx) => (
                      <td key={idx} title={formatDuration(v)}>{v}</td>
                    ))}
                    <td title={formatDuration(avg)}>{formatDuration(avg)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {view === 'monthly' ? (
        <div className="grid-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Task</th>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <th key={m}>{monthLabel(m)}</th>
                ))}
                <th>Avg/month</th>
              </tr>
            </thead>
            <tbody>
              {allTaskRows.map((task) => {
                const values = monthlyMap.get(task.id) || Array.from({ length: 12 }, () => 0);
                const total = values.reduce((a, b) => a + b, 0);
                const avg = Math.round((total / 12) * 100) / 100;
                return (
                  <tr key={task.id}>
                    <td className="task-col">{task.name}</td>
                    {values.map((v, idx) => (
                      <td key={idx} title={formatDuration(v)}>{v}</td>
                    ))}
                    <td title={formatDuration(avg)}>{formatDuration(avg)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {view === 'yearly' ? (
        <div className="grid-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Task</th>
                {selectedYears.map((y) => (
                  <th key={y}>{y}</th>
                ))}
                <th>Avg/year</th>
              </tr>
            </thead>
            <tbody>
              {allTaskRows.map((task) => {
                const valuesMap = yearlyMap.get(task.id) || new Map();
                const values = selectedYears.map((y) => valuesMap.get(Number(y)) || 0);
                const total = values.reduce((a, b) => a + b, 0);
                const divisor = selectedYears.length || 1;
                const avg = Math.round((total / divisor) * 100) / 100;
                return (
                  <tr key={task.id}>
                    <td className="task-col">{task.name}</td>
                    {values.map((v, idx) => (
                      <td key={idx} title={formatDuration(v)}>{v}</td>
                    ))}
                    <td title={formatDuration(avg)}>{formatDuration(avg)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('log');
  const [settings, setSettings] = useState(loadSettings());
  const [tasks, setTasks] = useState([]);
  const [bootMessage, setBootMessage] = useState('');

  const supabase = useMemo(
    () => getSupabaseClient(settings.url, settings.anonKey),
    [settings.url, settings.anonKey]
  );

  async function refreshTasks() {
    if (!supabase) {
      setTasks([]);
      return;
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('id, name, is_archived')
      .eq('is_archived', false);

    if (error) {
      setBootMessage(error.message);
      return;
    }

    const sorted = (data || []).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );

    setTasks(sorted);
    setBootMessage('');
  }

  useEffect(() => {
    refreshTasks();
  }, [supabase]);

  async function testConnection(url, anonKey) {
    const client = getSupabaseClient(url, anonKey);
    if (!client) {
      return { ok: false, message: 'URL and key are required.' };
    }

    const { error } = await client.from('tasks').select('id', { count: 'exact', head: true });
    if (error) {
      if (error.code === '42P01') {
        return { ok: false, message: 'Connected, but tasks table is missing.' };
      }
      return { ok: false, message: error.message || 'Connection failed.' };
    }

    return { ok: true, message: 'Connection successful.' };
  }

  const needsSettings = !settings.url || !settings.anonKey;

  return (
    <div className="app">
      <header>
        <h1>Simple Work Log</h1>
        <nav>
          <button
            type="button"
            className={activeTab === 'log' ? 'active' : ''}
            onClick={() => setActiveTab('log')}
          >
            Log
          </button>
          <button
            type="button"
            className={activeTab === 'daily' ? 'active' : ''}
            onClick={() => setActiveTab('daily')}
          >
            Editor
          </button>
          <button
            type="button"
            className={activeTab === 'history' ? 'active' : ''}
            onClick={() => setActiveTab('history')}
          >
            Task History
          </button>
          <button
            type="button"
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      {activeTab === 'settings' ? (
        <SettingsScreen
          settings={settings}
          onSave={(url, anonKey) => {
            saveSettings(url, anonKey);
            setSettings(loadSettings());
          }}
          onClear={() => {
            clearSettings();
            setSettings(loadSettings());
            setTasks([]);
          }}
          onTest={testConnection}
        />
      ) : null}

      {activeTab !== 'settings' && needsSettings ? (
        <section className="panel">
          <p>Add Supabase URL and anon key in Settings first.</p>
        </section>
      ) : null}

      {activeTab === 'log' && !needsSettings ? (
        <LogScreen supabase={supabase} tasks={tasks} refreshTasks={refreshTasks} />
      ) : null}

      {activeTab === 'daily' && !needsSettings ? (
        <DailyViewScreen supabase={supabase} tasks={tasks} refreshTasks={refreshTasks} />
      ) : null}

      {activeTab === 'history' && !needsSettings ? (
        <TaskHistoryScreen supabase={supabase} tasks={tasks} refreshTasks={refreshTasks} />
      ) : null}

      {bootMessage ? <Message text={bootMessage} tone="error" /> : null}
    </div>
  );
}
