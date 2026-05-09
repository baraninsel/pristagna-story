/**
 * İzleyici Fotoğraf Yükleme JS
 */

let selectedFiles = [];

function handleFiles(files) {
  selectedFiles = Array.from(files);
  const area = document.getElementById('previewArea');
  const btn = document.getElementById('btnSubmit');

  if (selectedFiles.length === 0) { area.style.display = 'none'; btn.style.display = 'none'; return; }

  area.style.display = '';
  btn.style.display = '';
  area.innerHTML = selectedFiles.map(f => {
    const url = URL.createObjectURL(f);
    return `<div class="preview-item"><img src="${url}" alt="${f.name}"></div>`;
  }).join('');
}

function submitPhotos() {
  if (selectedFiles.length === 0) return;
  const fd = new FormData();
  selectedFiles.forEach(f => fd.append('photos', f));
  fd.append('uploadedBy', 'İzleyici');

  const btn = document.getElementById('btnSubmit');
  btn.disabled = true;
  btn.textContent = 'Yükleniyor...';

  fetch('/api/photos/upload', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        document.getElementById('successMsg').style.display = '';
        document.getElementById('previewArea').style.display = 'none';
        btn.style.display = 'none';
        selectedFiles = [];
        document.getElementById('fileInput').value = '';
      }
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = '📤 Fotoğrafları Gönder';
    });
}

// Drag & drop
const zone = document.getElementById('uploadZone');
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
