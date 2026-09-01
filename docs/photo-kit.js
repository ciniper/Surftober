/**
 * Shared profile-photo toolkit — used by BOTH the Account tab (app.js) and
 * register.html, so the two never drift apart. Plain global script, not a
 * module, for the same reason awards.js is: register.html has no bundler and
 * loads scripts directly.
 *
 * Owns three things:
 *   render(file)        one decode -> a 512px display copy + a 2048px archive
 *   openCrop({src})     pan + pinch/scroll zoom, bakes a square 512px avatar
 *   openCamera()        getUserMedia capture (a real webcam shot, incl. Mac)
 *
 * Both modals build their own DOM on first use, so neither page needs markup.
 */
(function () {
  'use strict';

  var DISPLAY_MAX = 512;   // covers the 120px preview at 3x; lives base64 in the row
  var ARCHIVE_MAX = 2048;  // enough to crop/zoom into later, still a few hundred KB
  var CROP_OUT = 512;

  // ---------- shared decode ----------

  function loadImage(src, crossOrigin) {
    return new Promise(function (resolve, reject) {
      var i = new Image();
      i.onload = function () { resolve(i); };
      i.onerror = function () { reject(new Error('could not read that image')); };
      // Storage URLs are cross-origin; without this the canvas is tainted and
      // toDataURL throws SecurityError when baking a crop.
      if (crossOrigin) i.crossOrigin = 'anonymous';
      i.src = src;
    });
  }

  function scaleTo(img, maxDim) {
    var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /**
   * Decode ONCE, emit both copies, so the archive and the avatar are always
   * the same picture. Re-encoding to JPEG also strips EXIF — phone photos
   * routinely carry GPS coordinates, which must not reach a public bucket —
   * and converts HEIC/HEIF, which most browsers cannot display.
   */
  async function render(file) {
    var url = URL.createObjectURL(file);
    try {
      var img = await loadImage(url, false);
      var display = scaleTo(img, DISPLAY_MAX).toDataURL('image/jpeg', 0.82);
      var archiveBlob = await new Promise(function (resolve) {
        scaleTo(img, ARCHIVE_MAX).toBlob(resolve, 'image/jpeg', 0.85);
      });
      return { display: display, archiveBlob: archiveBlob };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---------- crop editor ----------

  var cropEl = null;
  var crop = { img: null, scale: 1, min: 1, tx: 0, ty: 0, vw: 280, onApply: null };

  function buildCropModal() {
    if (cropEl) return cropEl;
    cropEl = document.createElement('div');
    cropEl.className = 'crop-modal';
    cropEl.setAttribute('aria-hidden', 'true');
    cropEl.innerHTML =
      '<div class="crop-box" role="dialog" aria-label="Adjust photo crop">' +
        '<div class="crop-viewport" data-crop-viewport><img alt="" draggable="false" /></div>' +
        '<label class="crop-zoom-label">Zoom' +
          '<input type="range" min="1" max="4" step="0.01" value="1" data-crop-zoom />' +
        '</label>' +
        '<p class="hint crop-hint">Drag to move · pinch or scroll to zoom</p>' +
        '<div class="crop-actions">' +
          '<button type="button" class="btn-secondary" data-crop-cancel>Cancel</button>' +
          '<button type="button" data-crop-apply>Use this crop</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(cropEl);
    wireCrop();
    return cropEl;
  }

  function cropParts() {
    var root = buildCropModal();
    return {
      root: root,
      viewport: root.querySelector('[data-crop-viewport]'),
      img: root.querySelector('img'),
      zoom: root.querySelector('[data-crop-zoom]')
    };
  }

  // Keep the image covering the viewport — never let an empty corner appear.
  function cropClamp() {
    if (!crop.img) return;
    var w = crop.img.naturalWidth * crop.scale;
    var h = crop.img.naturalHeight * crop.scale;
    crop.tx = Math.min(0, Math.max(crop.vw - w, crop.tx));
    crop.ty = Math.min(0, Math.max(crop.vw - h, crop.ty));
  }

  function cropPaint() {
    var p = cropParts();
    if (!isFinite(crop.tx) || !isFinite(crop.ty) || !isFinite(crop.scale)) return;
    p.img.style.transform =
      'translate(' + crop.tx + 'px, ' + crop.ty + 'px) scale(' + crop.scale + ')';
  }

  // Zoom about a point, so whatever is under the cursor/fingers stays put.
  function cropZoomTo(next, ox, oy) {
    var clamped = Math.max(crop.min, Math.min(crop.min * 4, next));
    var ratio = clamped / crop.scale;
    crop.tx = ox - (ox - crop.tx) * ratio;
    crop.ty = oy - (oy - crop.ty) * ratio;
    crop.scale = clamped;
    cropClamp();
    cropPaint();
    cropParts().zoom.value = String(crop.scale / crop.min);
  }

  function closeCrop() {
    if (!cropEl) return;
    cropEl.classList.remove('open');
    cropEl.setAttribute('aria-hidden', 'true');
    cropParts().img.removeAttribute('src');
    crop.img = null;
    crop.onApply = null;
  }

  function applyCrop() {
    var p = cropParts();
    if (!crop.img) return;
    var sx = -crop.tx / crop.scale;
    var sy = -crop.ty / crop.scale;
    var side = crop.vw / crop.scale;
    var canvas = document.createElement('canvas');
    canvas.width = CROP_OUT;
    canvas.height = CROP_OUT;
    canvas.getContext('2d').drawImage(p.img, sx, sy, side, side, 0, 0, CROP_OUT, CROP_OUT);
    var baked;
    try {
      baked = canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      // Tainted canvas: the source didn't serve CORS headers.
      if (crop.onError) crop.onError(new Error('image blocked by the browser'));
      return;
    }
    var cb = crop.onApply;
    closeCrop();
    if (cb) cb(baked);
  }

  function wireCrop() {
    var p = cropParts();
    var dragging = false, lastX = 0, lastY = 0, pinch = 0;

    function point(e) {
      var r = p.viewport.getBoundingClientRect();
      var t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function dist(e) {
      var a = e.touches[0], b = e.touches[1];
      return Math.sqrt(Math.pow(a.clientX - b.clientX, 2) + Math.pow(a.clientY - b.clientY, 2));
    }
    function down(e) {
      if (!crop.img) return;
      if (e.touches && e.touches.length === 2) { pinch = dist(e); return; }
      dragging = true;
      var q = point(e); lastX = q.x; lastY = q.y;
      p.viewport.classList.add('dragging');
      e.preventDefault();
    }
    function move(e) {
      if (!crop.img) return;
      if (e.touches && e.touches.length === 2) {
        var d = dist(e);
        if (pinch) {
          var r = p.viewport.getBoundingClientRect();
          var mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
          var my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
          cropZoomTo(crop.scale * (d / pinch), mx, my);
        }
        pinch = d;
        e.preventDefault();
        return;
      }
      if (!dragging) return;
      var q = point(e);
      crop.tx += q.x - lastX;
      crop.ty += q.y - lastY;
      lastX = q.x; lastY = q.y;
      cropClamp();
      cropPaint();
      e.preventDefault();
    }
    function up() { dragging = false; pinch = 0; p.viewport.classList.remove('dragging'); }

    p.viewport.addEventListener('mousedown', down);
    p.viewport.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('mousemove', move);
    p.viewport.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    p.viewport.addEventListener('wheel', function (e) {
      if (!crop.img) return;
      var q = point(e);
      cropZoomTo(crop.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12), q.x, q.y);
      e.preventDefault();
    }, { passive: false });
    p.zoom.addEventListener('input', function () {
      var c = crop.vw / 2;
      cropZoomTo(crop.min * parseFloat(p.zoom.value || '1'), c, c);
    });
    p.root.addEventListener('click', function (e) { if (e.target === p.root) closeCrop(); });
    p.root.querySelector('[data-crop-cancel]').addEventListener('click', closeCrop);
    p.root.querySelector('[data-crop-apply]').addEventListener('click', applyCrop);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && cropEl && cropEl.classList.contains('open')) closeCrop();
    });
  }

  /**
   * Open the crop editor over `src` (prefer the 2048px archive — cropping it
   * at 2x still samples 768 source pixels down to 512, so zoom gains real
   * detail; panning a 512px copy could only shift the same pixels).
   * Calls onApply(dataUrl) with a square 512px JPEG.
   */
  async function openCrop(opts) {
    var p = cropParts();
    crop.onApply = opts.onApply || null;
    crop.onError = opts.onError || null;
    // Await the ELEMENT's own decode, not a detached Image: the geometry below
    // reads p.img.naturalWidth, and on an undecoded element that's 0, which
    // makes min = vw/0 = Infinity and every transform silently invalid.
    try {
      p.img.removeAttribute('src'); // force onload even if the src is unchanged
      await new Promise(function (resolve, reject) {
        p.img.onload = resolve;
        p.img.onerror = function () { reject(new Error('could not read that image')); };
        p.img.crossOrigin = 'anonymous';
        p.img.src = opts.src;
      });
    } catch (e) {
      if (opts.onError) opts.onError(e);
      return;
    }
    p.root.classList.add('open');
    p.root.setAttribute('aria-hidden', 'false');
    crop.img = p.img;
    crop.vw = p.viewport.clientWidth || 280;
    crop.min = crop.vw / Math.min(p.img.naturalWidth, p.img.naturalHeight);
    crop.scale = crop.min;
    crop.tx = (crop.vw - p.img.naturalWidth * crop.scale) / 2;
    crop.ty = (crop.vw - p.img.naturalHeight * crop.scale) / 2;
    cropClamp();
    cropPaint();
    p.zoom.value = '1';
  }

  // ---------- camera ----------

  function supportsCamera() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  var camEl = null, camStream = null, camOnShot = null;

  function buildCamModal() {
    if (camEl) return camEl;
    camEl = document.createElement('div');
    camEl.className = 'crop-modal';
    camEl.setAttribute('aria-hidden', 'true');
    camEl.innerHTML =
      '<div class="crop-box" role="dialog" aria-label="Take a photo">' +
        '<div class="cam-viewport"><video playsinline muted autoplay></video></div>' +
        '<p class="hint crop-hint" data-cam-status></p>' +
        '<div class="crop-actions">' +
          '<button type="button" class="btn-secondary" data-cam-cancel>Cancel</button>' +
          '<button type="button" data-cam-shot>Take photo</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(camEl);
    camEl.addEventListener('click', function (e) { if (e.target === camEl) closeCamera(); });
    camEl.querySelector('[data-cam-cancel]').addEventListener('click', closeCamera);
    camEl.querySelector('[data-cam-shot]').addEventListener('click', shoot);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && camEl && camEl.classList.contains('open')) closeCamera();
    });
    return camEl;
  }

  function closeCamera() {
    if (camStream) {
      // Release the device or the camera light stays on.
      camStream.getTracks().forEach(function (t) { t.stop(); });
      camStream = null;
    }
    if (camEl) {
      camEl.classList.remove('open');
      camEl.setAttribute('aria-hidden', 'true');
      camEl.querySelector('video').srcObject = null;
    }
    camOnShot = null;
  }

  function shoot() {
    if (!camEl || !camStream) return;
    var video = camEl.querySelector('video');
    var w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return;
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    // The preview is mirrored (selfie convention) but the capture is not —
    // a mirrored photo looks wrong to everyone except the person in it.
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    var cb = camOnShot;
    canvas.toBlob(function (blob) {
      closeCamera();
      if (blob && cb) cb(new File([blob], 'camera.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  }

  /** Open the webcam and call onCapture(File) with the shot. */
  async function openCamera(opts) {
    var root = buildCamModal();
    var status = root.querySelector('[data-cam-status]');
    camOnShot = opts.onCapture || null;
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    status.textContent = 'Starting camera…';
    var stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false
      });
    } catch (e) {
      closeCamera();
      if (opts.onError) {
        opts.onError(new Error(
          e && e.name === 'NotAllowedError'
            ? 'camera permission denied'
            : 'no camera available'));
      }
      return;
    }
    // Cancel/Escape can close the modal while the permission prompt is still
    // up — closeCamera() already ran with no stream to stop, so if we kept
    // this one the camera light would stay on behind a closed modal.
    if (!root.classList.contains('open')) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      return;
    }
    camStream = stream;
    var video = root.querySelector('video');
    video.srcObject = camStream;
    status.textContent = '';
    try { await video.play(); } catch (e) { /* autoplay attr covers it */ }
  }

  window.SurftoberPhoto = {
    render: render,
    openCrop: openCrop,
    closeCrop: closeCrop,
    supportsCamera: supportsCamera,
    openCamera: openCamera,
    DISPLAY_MAX: DISPLAY_MAX,
    ARCHIVE_MAX: ARCHIVE_MAX
  };
})();
