// ──────────────────────────────────────────────────────────
// PlayerTracker — manual click-to-mark with template-matching
// tracking. Local video files only (needs pixel access).
// Loads OpenCV.js on demand (~10MB WASM, cached after first use).
// ──────────────────────────────────────────────────────────

let cvReady = false;
let cvLoadPromise = null;

const CV_CDNS = [
    '/opencv.js', // self-hosted (works behind firewalls / regional CDN blocks)
    'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js',
    'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.8.0-release.9/dist/opencv.js',
    'https://docs.opencv.org/4.8.0/opencv.js',
    'https://docs.opencv.org/4.x/opencv.js'
];

function _waitForCv(resolve, reject) {
    // Already fully initialized?
    if (window.cv && window.cv.Mat && window.cv.matchTemplate) {
        cvReady = true;
        return resolve();
    }

    let settled = false;
    const finish = () => {
        if (settled) return;
        if (window.cv && window.cv.Mat && window.cv.matchTemplate) {
            settled = true; cvReady = true; resolve();
        }
    };

    // Hard timeout — 30s should be plenty even on slow devices
    const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('OpenCV.js loaded but did not initialize within 30s'));
    }, 30000);

    const wrapResolve = () => { clearTimeout(timeout); finish(); };

    // Pattern 1: @techstark / Emscripten — assign the callback. The Module
    // calls it back once WASM has compiled.
    if (window.cv && typeof window.cv === 'object') {
        try {
            window.cv.onRuntimeInitialized = wrapResolve;
        } catch (e) { /* some builds make it a getter; ignore */ }

        // Pattern 2: cv is a Promise that resolves to the module
        if (typeof window.cv.then === 'function') {
            window.cv.then((mod) => {
                if (mod && mod.Mat) window.cv = mod;
                wrapResolve();
            }).catch((e) => { clearTimeout(timeout); reject(e); });
        }
    }

    // Belt-and-suspenders: poll, in case the callback never fires
    const poll = setInterval(() => {
        if (settled) { clearInterval(poll); return; }
        if (window.cv && window.cv.Mat && window.cv.matchTemplate) {
            clearInterval(poll);
            wrapResolve();
        }
    }, 100);
}

function _tryLoad(url) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        // No crossOrigin attribute — docs.opencv.org doesn't send CORS, and
        // setting crossorigin would block it entirely.
        s.onload = () => _waitForCv(resolve, reject);
        s.onerror = () => reject(new Error('Script failed: ' + url));
        document.head.appendChild(s);
    });
}

export function loadOpenCV() {
    if (cvReady) return Promise.resolve();
    if (cvLoadPromise) return cvLoadPromise;
    cvLoadPromise = (async () => {
        if (window.cv && window.cv.Mat) { cvReady = true; return; }
        let lastErr = null;
        for (const url of CV_CDNS) {
            try {
                await _tryLoad(url);
                return;
            } catch (e) {
                lastErr = e;
                console.warn('[PlayerTracker]', e.message);
            }
        }
        throw lastErr || new Error('All OpenCV.js CDNs failed');
    })();
    return cvLoadPromise;
}

const COLORS = ['#ffeb3b', '#4caf50', '#f44336', '#2196f3', '#ff9800', '#9c27b0', '#00bcd4', '#ff4081'];

export class PlayerTracker {
    constructor(videoEl, overlayCanvas) {
        this.video = videoEl;
        this.overlay = overlayCanvas;
        this.ctx = overlayCanvas.getContext('2d');
        this.markers = [];
        this.workCanvas = document.createElement('canvas');
        this.workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true });
        this.frameMat = null;
        this.frameGray = null;
        this.rafId = null;
        this._loop = this._loop.bind(this);
        this._resizeOverlay = this._resizeOverlay.bind(this);
        this._resizeOverlay();
        window.addEventListener('resize', this._resizeOverlay);
    }

    _resizeOverlay() {
        const r = this.overlay.parentElement?.getBoundingClientRect();
        if (!r) return;
        const dpr = window.devicePixelRatio || 1;
        this.overlay.width = Math.round(r.width * dpr);
        this.overlay.height = Math.round(r.height * dpr);
        this.overlay.style.width = r.width + 'px';
        this.overlay.style.height = r.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    async init() {
        await loadOpenCV();
        this.start();
    }

    addMarker(videoX, videoY, label) {
        if (!cvReady) return null;
        const cv = window.cv;
        const w = this.video.videoWidth, h = this.video.videoHeight;
        if (!w || !h) return null;

        // Player bbox heuristic — ~3% of frame width, ~10% of height
        const boxW = Math.max(20, Math.round(w * 0.025));
        const boxH = Math.max(40, Math.round(h * 0.10));
        let fx = Math.max(0, Math.round(videoX - boxW / 2));
        let fy = Math.max(0, Math.round(videoY - boxH / 2));
        fx = Math.min(fx, w - boxW);
        fy = Math.min(fy, h - boxH);

        if (!this._captureFrame()) return null;

        const tplRect = new cv.Rect(fx, fy, boxW, boxH);
        const roi = this.frameGray.roi(tplRect);
        const template = roi.clone();
        roi.delete();

        const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7);
        const colorIdx = this.markers.length % COLORS.length;
        this.markers.push({
            id,
            label: String(label),
            color: COLORS[colorIdx],
            template,
            bbox: { x: fx, y: fy, width: boxW, height: boxH },
            framesSinceRefresh: 0,
            lostFor: 0
        });
        return id;
    }

    removeMarker(id) {
        const idx = this.markers.findIndex(m => m.id === id);
        if (idx === -1) return;
        try { this.markers[idx].template?.delete(); } catch (e) {}
        this.markers.splice(idx, 1);
    }

    list() {
        return this.markers.map(m => ({
            id: m.id, label: m.label, color: m.color,
            alive: m.lostFor < 30
        }));
    }

    clear() {
        this.markers.forEach(m => { try { m.template?.delete(); } catch (e) {} });
        this.markers = [];
    }

    _captureFrame() {
        const cv = window.cv;
        const w = this.video.videoWidth, h = this.video.videoHeight;
        if (!w || !h) return false;
        if (this.workCanvas.width !== w || this.workCanvas.height !== h) {
            this.workCanvas.width = w;
            this.workCanvas.height = h;
        }
        try { this.workCtx.drawImage(this.video, 0, 0, w, h); }
        catch (e) { return false; }

        if (!this.frameMat || this.frameMat.cols !== w || this.frameMat.rows !== h) {
            try { this.frameMat?.delete(); } catch (e) {}
            try { this.frameGray?.delete(); } catch (e) {}
            this.frameMat = new cv.Mat(h, w, cv.CV_8UC4);
            this.frameGray = new cv.Mat(h, w, cv.CV_8UC1);
        }
        const data = this.workCtx.getImageData(0, 0, w, h);
        this.frameMat.data.set(data.data);
        cv.cvtColor(this.frameMat, this.frameGray, cv.COLOR_RGBA2GRAY);
        return true;
    }

    _trackOne(m) {
        const cv = window.cv;
        const W = this.frameGray.cols, H = this.frameGray.rows;
        const SEARCH = Math.max(60, Math.round(W * 0.06));
        const sx = Math.max(0, m.bbox.x - SEARCH);
        const sy = Math.max(0, m.bbox.y - SEARCH);
        const ex = Math.min(W, m.bbox.x + m.bbox.width + SEARCH);
        const ey = Math.min(H, m.bbox.y + m.bbox.height + SEARCH);
        const sw = ex - sx, sh = ey - sy;
        if (sw <= m.bbox.width || sh <= m.bbox.height) { m.lostFor++; return; }

        let searchRoi = null, result = null;
        try {
            searchRoi = this.frameGray.roi(new cv.Rect(sx, sy, sw, sh));
            result = new cv.Mat();
            cv.matchTemplate(searchRoi, m.template, result, cv.TM_CCOEFF_NORMED);
            const mm = cv.minMaxLoc(result);
            const score = mm.maxVal;
            if (score < 0.45) {
                m.lostFor++;
            } else {
                m.bbox.x = sx + mm.maxLoc.x;
                m.bbox.y = sy + mm.maxLoc.y;
                m.lostFor = 0;
                m.framesSinceRefresh++;
                // Adaptive template refresh on confident match
                if (m.framesSinceRefresh > 25 && score > 0.7) {
                    try { m.template.delete(); } catch (e) {}
                    const r = this.frameGray.roi(new cv.Rect(m.bbox.x, m.bbox.y, m.bbox.width, m.bbox.height));
                    m.template = r.clone();
                    r.delete();
                    m.framesSinceRefresh = 0;
                }
            }
        } catch (e) {
            m.lostFor++;
        } finally {
            try { searchRoi?.delete(); } catch (e) {}
            try { result?.delete(); } catch (e) {}
        }
    }

    start() {
        if (this.rafId) return;
        this._loop();
    }

    stop() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    _loop() {
        this.rafId = requestAnimationFrame(this._loop);
        if (cvReady && this.markers.length > 0 && !this.video.paused && !this.video.ended && this.video.readyState >= 2) {
            if (this._captureFrame()) {
                this.markers.forEach(m => this._trackOne(m));
            }
        }
        this._render();
    }

    // Map a click on the overlay (CSS pixels) → video pixel coordinate.
    // Returns null if the click is outside the actual video display area.
    overlayToVideo(clientX, clientY) {
        const r = this.overlay.getBoundingClientRect();
        const cx = clientX - r.left;
        const cy = clientY - r.top;
        const cw = r.width, ch = r.height;
        const vw = this.video.videoWidth, vh = this.video.videoHeight;
        if (!vw || !vh) return null;
        const vidR = vw / vh, ovR = cw / ch;
        let dw, dh, dx, dy;
        if (vidR > ovR) { dw = cw; dh = cw / vidR; dx = 0; dy = (ch - dh) / 2; }
        else { dh = ch; dw = ch * vidR; dx = (cw - dw) / 2; dy = 0; }
        if (cx < dx || cx > dx + dw || cy < dy || cy > dy + dh) return null;
        return { x: ((cx - dx) / dw) * vw, y: ((cy - dy) / dh) * vh };
    }

    _render() {
        const ctx = this.ctx;
        const r = this.overlay.getBoundingClientRect();
        const cw = r.width, ch = r.height;
        ctx.clearRect(0, 0, cw, ch);
        const vw = this.video.videoWidth, vh = this.video.videoHeight;
        if (!vw || !vh) return;

        // object-fit: contain semantics — black bars if aspect mismatch
        const vidR = vw / vh, ovR = cw / ch;
        let dw, dh, dx, dy;
        if (vidR > ovR) { dw = cw; dh = cw / vidR; dx = 0; dy = (ch - dh) / 2; }
        else { dh = ch; dw = ch * vidR; dx = (cw - dw) / 2; dy = 0; }
        const scaleX = dw / vw, scaleY = dh / vh;

        this.markers.forEach(m => {
            if (m.lostFor > 30) return; // hidden when lost
            const cx = dx + (m.bbox.x + m.bbox.width / 2) * scaleX;
            const topY = dy + m.bbox.y * scaleY;
            const botY = dy + (m.bbox.y + m.bbox.height) * scaleY;

            // Ellipse below player feet
            ctx.fillStyle = m.color + (m.lostFor > 0 ? 'aa' : 'dd');
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(cx, botY, 18, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Label pill above player
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const text = m.label;
            const metrics = ctx.measureText(text);
            const padX = 7, padY = 4;
            const tw = metrics.width + padX * 2;
            const th = 20;
            const px = cx - tw / 2;
            const py = topY - th - 4;
            ctx.fillStyle = m.color;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineWidth = 1.5;
            this._roundRect(ctx, px, py, tw, th, 6);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#000';
            ctx.fillText(text, cx, py + th / 2);
        });
    }

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    destroy() {
        this.stop();
        this.clear();
        try { this.frameMat?.delete(); } catch (e) {}
        try { this.frameGray?.delete(); } catch (e) {}
        this.frameMat = null;
        this.frameGray = null;
        window.removeEventListener('resize', this._resizeOverlay);
    }
}
