const statusEl = document.getElementById('status');
const urlEl = document.getElementById('url');
const msgEl = document.getElementById('msg');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const recordsEl = document.getElementById('records');

/** @type {Array<{id:string,name?:string,startUrl?:string|null,steps?:any[],stepsCount?:number,savedPath?:string}>} */
let records = [];

function setMsg(text, isErr = false) {
  msgEl.textContent = text || '';
  msgEl.className = isErr ? 'err' : '';
}

function shortUrl(u) {
  if (!u) return '';
  const s = String(u);
  if (s.length <= 36) return s;
  return `${s.slice(0, 18)}…${s.slice(-10)}`;
}

function renderRecords() {
  if (!recordsEl) return;
  if (!records.length) {
    recordsEl.textContent = '(trống)'; // local only
    return;
  }
  recordsEl.innerHTML = '';

  for (const r of records) {
    const row = document.createElement('div');
    row.className = 'recordRow';

    const meta = document.createElement('div');
    meta.className = 'recordMeta';

    const name = document.createElement('div');
    name.className = 'recordName';
    name.textContent = r.name || r.id;

    const sub = document.createElement('div');
    sub.className = 'recordSub';
    const stepsCount = typeof r.stepsCount === 'number' ? r.stepsCount : (Array.isArray(r.steps) ? r.steps.length : 0);
    sub.textContent = `${stepsCount} bước${r.startUrl ? ` • ${shortUrl(r.startUrl)}` : ''}`;

    meta.appendChild(name);
    meta.appendChild(sub);

    const buttons = document.createElement('div');
    buttons.className = 'recordButtons';

    const btnRun = document.createElement('button');
    btnRun.type = 'button';
    btnRun.className = 'smallBtn btnRun';
    btnRun.textContent = 'Chạy lại';
    btnRun.addEventListener('click', () => {
      void runRecord(r);
    });

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'smallBtn btnDelete';
    btnDelete.textContent = 'Xóa';
    btnDelete.addEventListener('click', () => {
      void deleteRecord(r);
    });

    buttons.appendChild(btnRun);
    buttons.appendChild(btnDelete);

    row.appendChild(meta);
    row.appendChild(buttons);
    recordsEl.appendChild(row);
  }
}

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) urlEl.textContent = tab.url;
  const res = await chrome.runtime.sendMessage({ type: 'datn-popup', action: 'recordStatus' });
  const recording = !!res?.data?.recording;
  const count = res?.data?.stepCount ?? 0;
  if (recording) {
    statusEl.innerHTML = `<span class="recording">Đang ghi</span> — ${count} bước`;
    btnStart.style.display = 'none';
    btnStop.style.display = 'block';
  } else {
    statusEl.textContent = count > 0 ? `Đã dừng — ${count} bước (chưa lưu)` : 'Chưa ghi';
    btnStart.style.display = 'block';
    btnStop.style.display = 'none';
  }

  const listRes = await chrome.runtime.sendMessage({ type: 'datn-popup', action: 'listRecords' });
  if (listRes?.ok && listRes?.data?.scripts) {
    records = listRes.data.scripts;
    renderRecords();
  }
}

btnStart.addEventListener('click', async () => {
  setMsg('');
  const res = await chrome.runtime.sendMessage({ type: 'datn-popup', action: 'recordStart' });
  if (!res?.ok) {
    setMsg(res?.error || 'Không bắt đầu được', true);
    return;
  }
  await refresh();
});

btnStop.addEventListener('click', async () => {
  setMsg('Đang lưu…');
  btnStop.disabled = true;
  const res = await chrome.runtime.sendMessage({ type: 'datn-popup', action: 'recordStop' });
  btnStop.disabled = false;
  if (!res?.ok) {
    setMsg(res?.error || 'Lỗi khi dừng ghi', true);
    return;
  }
  const path = res?.data?.savedPath;
  setMsg(path ? `Đã lưu: ${path}` : `Đã lưu (${res?.data?.id || ''})`);
  await refresh();
});

async function runRecord(record) {
  try {
    setMsg('Chạy lại…');
    const res = await chrome.runtime.sendMessage({
      type: 'datn-popup',
      action: 'runRecord',
      record,
    });
    if (!res?.ok) throw new Error(res?.error || 'Chạy lại thất bại');
    setMsg('Chạy xong');
  } catch (e) {
    setMsg(e instanceof Error ? e.message : String(e), true);
  }
}

async function deleteRecord(record) {
  const name = record?.name || record?.id || 'record';
  if (!confirm(`Xóa script "${name}" trên máy này?`)) return;
  try {
    setMsg('Đang xóa…');
    const res = await chrome.runtime.sendMessage({
      type: 'datn-popup',
      action: 'deleteRecord',
      record,
    });
    if (!res?.ok) throw new Error(res?.error || 'Xóa thất bại');
    setMsg('Đã xóa');
    await refresh();
  } catch (e) {
    setMsg(e instanceof Error ? e.message : String(e), true);
  }
}

refresh().catch((e) => setMsg(String(e), true));
