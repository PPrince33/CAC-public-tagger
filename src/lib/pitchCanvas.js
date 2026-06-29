export class PitchCanvas {
    constructor(canvasId, isFutsal = true) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.isFutsal = isFutsal;
        this.updateConfig();

        this.startPoint = null;
        this.endPoint = null;
        this.gkPoint = null;       // goalkeeper position (Shoot events)
        this.allowEndPoint = true;
        this.allowGkPoint = false; // enabled when action === 'Shoot'
        this.onCoordsChange = null;
        this.onGkChange = null;    // fired when gkPoint changes

        this.canvas.addEventListener('click', (e) => this.handleClick(e));
    }

    updateConfig() {
        if (this.isFutsal) {
            this.config = { type: 'futsal', maxX: 40, maxY: 20, goalWidth: 3.0, goalHeight: 2.0 };
        } else {
            this.config = { type: 'standard', maxX: 120, maxY: 80, goalWidth: 7.32, goalHeight: 2.44 };
        }
        this.draw();
    }

    // Theme-aware colors
    getColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            bg: isDark ? '#0f172a' : '#e2e8f0',
            field: isDark ? '#1e293b' : '#ffffff',
            lines: isDark ? 'rgba(255,255,255,0.8)' : '#1e293b',
            start: isDark ? '#4ade80' : '#10b981',
            end: isDark ? '#f87171' : '#ef4444',
            gk: isDark ? '#c084fc' : '#7c3aed',       // purple for GK
            dashLine: isDark ? 'rgba(255,255,255,0.5)' : '#64748b',
            goalArea: isDark ? '#f87171' : '#ef4444',
            grid: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
        };
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const internalX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const internalY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

        const padX = this.config.maxX * 0.05;
        const padY = this.config.maxY * 0.05;

        let pitchX = Math.round(Math.max(0, Math.min(((internalX / this.canvas.width) * (this.config.maxX + 2 * padX)) - padX, this.config.maxX)) * 100) / 100;
        let pitchY = Math.round(Math.max(0, Math.min((((this.canvas.height - internalY) / this.canvas.height) * (this.config.maxY + 2 * padY)) - padY, this.config.maxY)) * 100) / 100;

        // ── Click state machine ──────────────────────────────────
        // 1st click:  set startPoint (always resets sequence when no start or no-end-point actions)
        // 2nd click:  set endPoint (if allowEndPoint)
        // 3rd click:  set gkPoint  (if allowGkPoint and start+end already set)
        // Extra click: reset to new startPoint

        if (!this.startPoint || (this.startPoint && !this.allowEndPoint)) {
            // Fresh start or action that needs no end point
            this.startPoint = { x: pitchX, y: pitchY };
            this.endPoint = null;
            this.gkPoint = null;
        } else if (!this.endPoint) {
            this.endPoint = { x: pitchX, y: pitchY };
        } else if (this.allowGkPoint && !this.gkPoint) {
            // 3rd click: GK position
            this.gkPoint = { x: pitchX, y: pitchY };
            this.draw();
            if (this.onGkChange) this.onGkChange(this.gkPoint);
            return; // early exit — don't fire onCoordsChange / player dial
        } else {
            // Reset for new sequence
            this.startPoint = { x: pitchX, y: pitchY };
            this.endPoint = null;
            this.gkPoint = null;
        }

        this.draw();
        if (this.onCoordsChange) this.onCoordsChange(this.startPoint, this.endPoint, e);
    }

    // ── Grid overlay (10×10 unit dotted cells) ──────────────────
    drawGrid(ctx, p, sx, sy, gridColor) {
        const CELL = 10; // units per grid cell
        ctx.save();
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);

        for (let x = 0; x <= p.maxX; x += CELL) {
            ctx.beginPath();
            ctx.moveTo(sx(x), sy(p.maxY));
            ctx.lineTo(sx(x), sy(0));
            ctx.stroke();
        }
        for (let y = 0; y <= p.maxY; y += CELL) {
            ctx.beginPath();
            ctx.moveTo(sx(0), sy(y));
            ctx.lineTo(sx(p.maxX), sy(y));
            ctx.stroke();
        }

        ctx.setLineDash([]);
        ctx.restore();
    }

    draw() {
        const ctx = this.ctx;
        const p = this.config;
        const padX = p.maxX * 0.05;
        const padY = p.maxY * 0.05;
        const c = this.getColors();

        const sx = (x) => (x + padX) * (this.canvas.width / (p.maxX + 2 * padX));
        const sy = (y) => this.canvas.height - ((y + padY) * (this.canvas.height / (p.maxY + 2 * padY)));

        // Base canvas background
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Field background
        ctx.fillStyle = c.field;
        ctx.fillRect(sx(0), sy(p.maxY), sx(p.maxX) - sx(0), sy(0) - sy(p.maxY));

        // Grid overlay (drawn on top of field, under pitch markings)
        this.drawGrid(ctx, p, sx, sy, c.grid);

        // Pitch outer boundary
        ctx.strokeStyle = c.lines;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx(0), sy(p.maxY), sx(p.maxX) - sx(0), sy(0) - sy(p.maxY));

        // Center line
        ctx.beginPath();
        ctx.moveTo(sx(p.maxX / 2), sy(0));
        ctx.lineTo(sx(p.maxX / 2), sy(p.maxY));
        ctx.stroke();

        // Shared scale (px per metre)
        const scale = this.canvas.width / (p.maxX + 2 * padX);

        // Center circle + center spot
        // Use proportionally-correct radius for each format
        const centerRadius = p.type === 'standard' ? 9.15 : 3;
        ctx.lineWidth = 2.5; // bolder for visibility
        ctx.beginPath();
        ctx.arc(sx(p.maxX / 2), sy(p.maxY / 2), centerRadius * scale, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.fillStyle = c.lines;
        ctx.beginPath();
        ctx.arc(sx(p.maxX / 2), sy(p.maxY / 2), 2.5, 0, 2 * Math.PI);
        ctx.fill();

        if (p.type === 'standard') {
            // ── 18-yard boxes ──
            ctx.strokeStyle = c.lines;
            ctx.strokeRect(sx(0),            sy(p.maxY / 2 + 20.16), sx(16.5) - sx(0),            sy(p.maxY / 2 - 20.16) - sy(p.maxY / 2 + 20.16));
            ctx.strokeRect(sx(p.maxX - 16.5), sy(p.maxY / 2 + 20.16), sx(p.maxX) - sx(p.maxX - 16.5), sy(p.maxY / 2 - 20.16) - sy(p.maxY / 2 + 20.16));

            // ── 6-yard boxes ──
            ctx.strokeRect(sx(0),           sy(p.maxY / 2 + 9.16), sx(5.5) - sx(0),           sy(p.maxY / 2 - 9.16) - sy(p.maxY / 2 + 9.16));
            ctx.strokeRect(sx(p.maxX - 5.5), sy(p.maxY / 2 + 9.16), sx(p.maxX) - sx(p.maxX - 5.5), sy(p.maxY / 2 - 9.16) - sy(p.maxY / 2 + 9.16));

            // ── Penalty spots ──
            const penSpotX = 11;
            ctx.fillStyle = c.lines;
            ctx.beginPath(); ctx.arc(sx(penSpotX),          sy(p.maxY / 2), 2.5, 0, 2 * Math.PI); ctx.fill();
            ctx.beginPath(); ctx.arc(sx(p.maxX - penSpotX), sy(p.maxY / 2), 2.5, 0, 2 * Math.PI); ctx.fill();

            // ── Penalty arcs (D-shape outside 18-yard box) ──
            const theta = Math.acos((16.5 - penSpotX) / 9.15);
            ctx.beginPath();
            ctx.arc(sx(penSpotX), sy(p.maxY / 2), 9.15 * scale, -theta, theta, false);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(sx(p.maxX - penSpotX), sy(p.maxY / 2), 9.15 * scale, Math.PI - theta, Math.PI + theta, false);
            ctx.stroke();

            // ── Corner arcs (1 m radius quarter-circles) ──
            const cr = 1 * scale;
            ctx.beginPath(); ctx.arc(sx(0),        sy(0),        cr, 3 * Math.PI / 2, 0,               false); ctx.stroke();
            ctx.beginPath(); ctx.arc(sx(0),        sy(p.maxY),   cr, 0,               Math.PI / 2,      false); ctx.stroke();
            ctx.beginPath(); ctx.arc(sx(p.maxX),   sy(0),        cr, Math.PI,         3 * Math.PI / 2,  false); ctx.stroke();
            ctx.beginPath(); ctx.arc(sx(p.maxX),   sy(p.maxY),   cr, Math.PI / 2,     Math.PI,          false); ctx.stroke();

        } else {
            // ── Futsal: rectangular penalty area ──
            ctx.strokeRect(sx(0),           sy(p.maxY / 2 + 6), sx(6) - sx(0),           sy(p.maxY / 2 - 6) - sy(p.maxY / 2 + 6));
            ctx.strokeRect(sx(p.maxX - 6),  sy(p.maxY / 2 + 6), sx(p.maxX) - sx(p.maxX - 6), sy(p.maxY / 2 - 6) - sy(p.maxY / 2 + 6));

            // Futsal penalty spots (6 m and 10 m)
            ctx.fillStyle = c.lines;
            [6, 10].forEach(d => {
                ctx.beginPath(); ctx.arc(sx(d),          sy(p.maxY / 2), 2, 0, 2 * Math.PI); ctx.fill();
                ctx.beginPath(); ctx.arc(sx(p.maxX - d), sy(p.maxY / 2), 2, 0, 2 * Math.PI); ctx.fill();
            });
        }

        // Goals (drawn just outside the pitch lines)
        const goalDepth = p.type === 'standard' ? 2 : 1;
        ctx.strokeStyle = c.goalArea;
        ctx.lineWidth = 2;
        // Left goal
        ctx.strokeRect(
            sx(-goalDepth),
            sy(p.maxY / 2 + p.goalWidth / 2),
            sx(0) - sx(-goalDepth),
            sy(p.maxY / 2 - p.goalWidth / 2) - sy(p.maxY / 2 + p.goalWidth / 2)
        );
        // Right goal
        ctx.strokeRect(
            sx(p.maxX),
            sy(p.maxY / 2 + p.goalWidth / 2),
            sx(p.maxX + goalDepth) - sx(p.maxX),
            sy(p.maxY / 2 - p.goalWidth / 2) - sy(p.maxY / 2 + p.goalWidth / 2)
        );

        // ── Draw points ─────────────────────────────────────────
        if (this.startPoint) {
            ctx.fillStyle = c.start;
            ctx.beginPath();
            ctx.arc(sx(this.startPoint.x), sy(this.startPoint.y), 6, 0, 2 * Math.PI);
            ctx.fill();
        }
        if (this.endPoint) {
            ctx.fillStyle = c.end;
            ctx.beginPath();
            ctx.arc(sx(this.endPoint.x), sy(this.endPoint.y), 6, 0, 2 * Math.PI);
            ctx.fill();

            // Arrow line from start to end
            if (this.startPoint) {
                ctx.strokeStyle = c.dashLine;
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(sx(this.startPoint.x), sy(this.startPoint.y));
                ctx.lineTo(sx(this.endPoint.x), sy(this.endPoint.y));
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        if (this.gkPoint) {
            // Draw GK position as a distinct purple marker with label
            ctx.fillStyle = c.gk;
            ctx.beginPath();
            ctx.arc(sx(this.gkPoint.x), sy(this.gkPoint.y), 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Label
            ctx.fillStyle = c.gk;
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText('GK', sx(this.gkPoint.x) + 8, sy(this.gkPoint.y) + 4);
        }

        // ── GK mode hint ─────────────────────────────────────────
        if (this.allowGkPoint && this.startPoint && this.endPoint && !this.gkPoint) {
            ctx.save();
            ctx.fillStyle = 'rgba(124,58,237,0.85)';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click to mark GK position', sx(p.maxX / 2), sy(p.maxY) + 14);
            ctx.textAlign = 'left';
            ctx.restore();
        }
    }

    clear() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.startPoint = null;
        this.endPoint = null;
        this.gkPoint = null;
    }

    reset() {
        this.clear();
        this.draw();
    }
}
