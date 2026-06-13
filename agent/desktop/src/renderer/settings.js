/* global stationhubSettings */

const TAB_META = {
  'Kết nối': { label: 'Kết nối', icon: '⬡', special: 'connection' },
  'Task / Shell': { label: 'Task/Shell', icon: '⌘', desc: 'Timeout, output và shell mặc định.' },
  'Desktop automation': {
    label: 'Desktop',
    icon: '◎',
    desc: 'Chuột, phím, chụp màn hình — cần user đăng nhập.',
    warn: 'Desktop automation điều khiển chuột/phím. Chỉ bật trên máy tin cậy.',
  },
  'Mở ứng dụng': { label: 'Mở app', icon: '▣', desc: 'Thời gian chờ cửa sổ OPEN_APP.' },
  'Trình duyệt': { label: 'Trình duyệt', icon: '◈', desc: 'Cloak runner và profile.' },
  'Chrome extension': { label: 'Chrome', icon: '⬢', desc: 'Bridge extension DOM.' },
  'Remote (RustDesk)': {
    label: 'Remote',
    icon: '◉',
    desc: 'RustDesk — ID/mật khẩu và đường dẫn trên máy agent.',
  },
};

const SECRET_KEYS = new Set(['AGENT_KEY', 'RUSTDESK_PASSWORD']);
const STATUS_BADGE = {
  connected: 'ĐÃ KẾT NỐI',
  connecting: 'ĐANG KẾT NỐI',
  starting: 'ĐANG KHỞI ĐỘNG',
  failed: 'LỖI KẾT NỐI',
  stopped: 'ĐÃ DỪNG',
};

const STATUS_HEADLINE = {
  connected: 'Agent online',
  connecting: 'Đang thiết lập…',
  starting: 'Khởi động core…',
  failed: 'Không kết nối được',
  stopped: 'Agent offline',
};

let state = {
  fields: [],
  groups: [],
  values: {},
  configPath: '',
  activeTab: 'Kết nối',
  dirty: false,
  statusPoll: null,
};

const $ = (s) => document.querySelector(s);

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showErrors(list) {
  const el = $('#errorBanner');
  if (!list?.length) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = list.map((e) => `<div>${esc(e)}</div>`).join('');
}

function setFooter(msg, kind = '') {
  const el = $('#footerStatus');
  el.textContent = msg;
  el.className = 'dock-status' + (kind ? ` ${kind}` : '');
}

function markDirty() {
  state.dirty = true;
  setFooter('Có thay đổi chưa lưu', 'warn');
}

function renderField(f) {
  const field = document.createElement('div');
  field.className = 'field';
  field.dataset.key = f.key;

  if (f.type === 'boolean') {
    const on = ['1', 'true', 'yes', 'on'].includes(
      String(state.values[f.key] ?? f.default ?? '').toLowerCase(),
    );
    field.innerHTML = `
      <div class="toggle-row">
        <div>
          <div class="field-key">${esc(f.key)}</div>
          <div class="field-label">${esc(f.label)}</div>
          ${f.hint ? `<div class="field-hint">${esc(f.hint)}</div>` : ''}
        </div>
        <label class="toggle">
          <input type="checkbox" name="${esc(f.key)}" ${on ? 'checked' : ''} />
          <span class="toggle-track"></span>
        </label>
      </div>`;
  } else {
    const val = state.values[f.key] ?? f.default ?? '';
    const secret = SECRET_KEYS.has(f.key);
    let input;
    if (f.type === 'select') {
      input = `<select id="f_${esc(f.key)}" name="${esc(f.key)}">${(f.options || [])
        .map((o) => `<option value="${esc(o)}"${o === val ? ' selected' : ''}>${esc(o)}</option>`)
        .join('')}</select>`;
    } else {
      const t = f.type === 'number' ? 'number' : secret ? 'password' : 'text';
      const mono =
        /URL|KEY|DIR/i.test(f.key) ? ' mono' : '';
      input = `<input type="${t}" class="${mono.trim()}" id="f_${esc(f.key)}" name="${esc(f.key)}" value="${esc(val)}" />`;
    }
    field.innerHTML = `
      <div class="field-key">${esc(f.key)}</div>
      <label class="field-label" for="f_${esc(f.key)}">${esc(f.label)}${f.required ? '<span class="req"> *</span>' : ''}</label>
      <div class="input-wrap${secret ? ' has-secret' : ''}">
        ${input}
        ${secret ? `<button type="button" class="secret-toggle" data-for="f_${esc(f.key)}">Hiện</button>` : ''}
      </div>
      ${f.hint ? `<div class="field-hint">${esc(f.hint)}</div>` : ''}`;
  }

  field.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('change', markDirty);
    el.addEventListener('input', markDirty);
  });

  const toggle = field.querySelector('.secret-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const inp = document.getElementById(toggle.dataset.for);
      if (!inp) return;
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Ẩn' : 'Hiện';
    });
  }

  return field;
}

function renderConnectionPanel() {
  const panel = document.createElement('section');
  panel.className = 'panel active';
  panel.dataset.group = 'Kết nối';
  panel.innerHTML = `
    <div class="conn-layout">
      <div class="glass-card status-card">
        <div class="card-header">
          <div>
            <p class="eyebrow">Trạng thái hệ thống</p>
            <h2 class="status-headline" id="statusHeadline">—</h2>
          </div>
          <div class="status-badge stopped" id="statusBadge">
            <span class="status-dot"></span>
            <span id="statusBadgeText">—</span>
          </div>
        </div>
        <div class="metrics metrics-compact">
          <div class="metric">
            <div class="metric-label">Process</div>
            <div class="metric-value" id="metricProcess">—</div>
          </div>
          <div class="metric">
            <div class="metric-label">Cập nhật</div>
            <div class="metric-value" id="metricTime">—</div>
          </div>
        </div>
      </div>

      <div class="glass-card key-card">
        <p class="eyebrow">Xác thực</p>
        <h3 class="card-title">Agent Key</h3>
        <div class="key-input-wrap">
          <input type="password" id="agentKeyInput" name="AGENT_KEY" placeholder="••••••••••••••••" autocomplete="off" />
          <button type="button" class="key-input-toggle" id="keyEyeBtn">Hiện</button>
        </div>
        <div class="key-btns">
          <button type="button" class="key-btn" id="copyKeyBtn">Sao chép</button>
          <button type="button" class="key-btn" id="toggleKeyBtn">Hiện</button>
        </div>
      </div>

      <div class="glass-card log-card conn-log-span">
        <h3 class="card-title">Log kết nối</h3>
        <div class="log-stream" id="logStream" aria-live="polite">
          <div class="log-empty">Chưa có log — agent sẽ ghi tại đây khi chạy.</div>
        </div>
      </div>
    </div>`;

  const keyInput = panel.querySelector('#agentKeyInput');
  keyInput.value = state.values.AGENT_KEY ?? '';
  keyInput.addEventListener('input', markDirty);
  keyInput.addEventListener('change', markDirty);

  const syncKeyVisibility = () => {
    const show = keyInput.type === 'password';
    const label = show ? 'Hiện' : 'Ẩn';
    panel.querySelector('#toggleKeyBtn').textContent = label;
    panel.querySelector('#keyEyeBtn').textContent = label;
  };

  const toggleVisible = () => {
    keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    syncKeyVisibility();
  };

  panel.querySelector('#toggleKeyBtn').addEventListener('click', toggleVisible);
  panel.querySelector('#keyEyeBtn').addEventListener('click', toggleVisible);

  panel.querySelector('#copyKeyBtn').addEventListener('click', async () => {
    const v = keyInput.value.trim();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      setFooter('Đã sao chép Agent Key', 'ok');
    } catch {
      setFooter('Không sao chép được', 'warn');
    }
  });

  return panel;
}

function renderFieldsPanel(group) {
  const meta = TAB_META[group] || { label: group, desc: '' };
  const fields = state.fields.filter((f) => f.group === group);
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.dataset.group = group;

  let warn = '';
  if (meta.warn) {
    warn = `<div class="callout callout-warn">${esc(meta.warn)}</div>`;
  }

  panel.innerHTML = `
    <div class="panel-intro">
      <h2>${esc(meta.label || group)}</h2>
      ${meta.desc ? `<p>${esc(meta.desc)}</p>` : ''}
    </div>
    ${warn}
    <div class="field-grid"></div>`;

  const grid = panel.querySelector('.field-grid');
  fields.forEach((f) => grid.append(renderField(f)));
  return panel;
}

function switchTab(group) {
  state.activeTab = group;
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.group === group);
  });
  document.querySelectorAll('.panel').forEach((p) => {
    p.classList.toggle('active', p.dataset.group === group);
  });
}

function collect() {
  const values = { ...state.values };
  const keyEl = document.getElementById('agentKeyInput');
  if (keyEl) values.AGENT_KEY = keyEl.value;

  document.querySelectorAll('.panel input, .panel select').forEach((el) => {
    if (!el.name || el.id === 'agentKeyInput') return;
    if (el.type === 'checkbox') values[el.name] = el.checked ? 'true' : 'false';
    else values[el.name] = el.value;
  });
  return values;
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('vi-VN');
  } catch {
    return '—';
  }
}

function logLineClass(line) {
  const wrapper = line.match(/^\[[^\]]+\]\s*\[(INFO|WARN|ERROR)\]/i);
  if (wrapper) {
    const lv = wrapper[1].toUpperCase();
    if (lv === 'ERROR') return 'line-err';
    if (lv === 'WARN') return 'line-warn';
    return '';
  }
  if (/thành công|THÀNH CÔNG|authenticated|đã kết nối/i.test(line)) return 'line-ok';
  return '';
}

function renderLogStream(lines) {
  const stream = $('#logStream');

  if (!stream) return;
  if (!lines?.length) {
    stream.innerHTML = '<div class="log-empty">Chưa có log — agent sẽ ghi tại đây khi chạy.</div>';
    return;
  }

  stream.innerHTML = lines
    .map((line) => {
      const cls = logLineClass(line);
      return `<div class="log-line${cls ? ` ${cls}` : ''}">${esc(line)}</div>`;
    })
    .join('');
  stream.scrollTop = stream.scrollHeight;
}

async function refreshStatus() {
  const api = window.stationhubSettings;
  if (!api?.getStatus) return;

  const s = await api.getStatus();
  const phase = s.connection || 'stopped';

  const badge = $('#statusBadge');
  const badgeText = $('#statusBadgeText');
  const headline = $('#statusHeadline');

  if (badge) {
    badge.className = `status-badge ${phase}`;
    badgeText.textContent = STATUS_BADGE[phase] || phase;
  }
  if (headline) {
    headline.textContent = STATUS_HEADLINE[phase] || phase;
    headline.classList.toggle('is-live', phase === 'connected' || phase === 'connecting');
  }

  const proc = $('#metricProcess');
  const time = $('#metricTime');

  if (proc) proc.textContent = s.processRunning ? 'Agent đang chạy' : 'Đã dừng';
  if (time) time.textContent = formatTime(s.lastEventAt);

  renderLogStream(s.recentLines);

  if ($('#versionChip')) $('#versionChip').textContent = `v${s.agentVersion}`;
}

function buildUi() {
  const tabs = $('#tabs');
  const panels = $('#panels');
  tabs.innerHTML = '';
  panels.innerHTML = '';

  state.groups.forEach((g) => {
    const fields = state.fields.filter((f) => f.group === g);
    if (!fields.length && g !== 'Kết nối') return;

    const meta = TAB_META[g] || { label: g };
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab-btn' + (g === state.activeTab ? ' active' : '');
    btn.dataset.group = g;
    btn.innerHTML = `<span class="tab-icon">${meta.icon || '•'}</span><span>${esc(meta.label || g)}</span>`;
    btn.addEventListener('click', () => switchTab(g));
    tabs.append(btn);

    if (meta.special === 'connection') {
      panels.append(renderConnectionPanel());
    } else {
      panels.append(renderFieldsPanel(g));
    }
  });
}

async function init() {
  const api = window.stationhubSettings;
  if (!api) {
    showErrors(['Không tải được bridge cài đặt.']);
    $('#loading').classList.add('hidden');
    return;
  }

  try {
    const [{ fields, groups }, loaded] = await Promise.all([
      api.getSchema(),
      api.load(),
    ]);
    state.fields = fields;
    state.groups = groups;
    state.values = loaded.values;
    state.configPath = loaded.path;

    buildUi();
    await refreshStatus();

    state.statusPoll = setInterval(() => {
      void refreshStatus();
    }, 2000);

    $('#loading').classList.add('hidden');
    $('#app').classList.remove('hidden');
    setFooter('Sẵn sàng', 'ok');
  } catch (e) {
    $('#loading').classList.add('hidden');
    showErrors([String(e)]);
  }
}

$('#saveBtn').addEventListener('click', async () => {
  const api = window.stationhubSettings;
  const btn = $('#saveBtn');
  btn.disabled = true;
  setFooter('Đang lưu…');
  showErrors([]);

  const res = await api.save(collect());
  btn.disabled = false;

  if (!res.ok) {
    showErrors(res.errors);
    setFooter('Lưu thất bại', 'warn');
    return;
  }

  state.dirty = false;
  state.values = collect();
  setFooter('Đã lưu — agent đang khởi động lại', 'ok');
  api.notifySaved();
  setTimeout(() => void refreshStatus(), 800);
});

$('#folderBtn').addEventListener('click', () => {
  window.stationhubSettings?.openConfigFolder();
});

$('#restartBtn').addEventListener('click', () => {
  window.stationhubSettings?.notifySaved();
  setFooter('Đang khởi động lại agent…');
  setTimeout(() => void refreshStatus(), 600);
});

window.addEventListener('beforeunload', () => {
  if (state.statusPoll) clearInterval(state.statusPoll);
});

init();
