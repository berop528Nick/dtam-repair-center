/* ============================================================
       AppJS.html — JS ใช้ร่วมทุกหน้า
       - กล่องแจ้งเตือน (dialog)
       - นาฬิกาไทย + เมนูข้าง (ย่อ/ขยาย, กางเมนูย่อย, เมนูที่ยังไม่มีหน้า)
       - ตาราง: ค้นหา / เรียง / จำนวนแถว / แบ่งหน้า / ส่งออก CSV
       ============================================================ */

    window.App = (function () {
        'use strict';

        var THAI_MONTHS = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];

        var STATUS_CLASS = {
            'เสร็จสิ้น': 'done',
            'กำลังดำเนินการ': 'progress',
            'รอดำเนินการ': 'pending',
            'ยกเลิก': 'cancel',
            'ใช้งาน': 'done',
            'ส่งซ่อม': 'progress',
            'ชำรุด': 'pending',
            'จำหน่าย': 'cancel'
        };

        var PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

        /* ---------- ตัวช่วย ---------- */

        function pad(n) {
            return n < 10 ? '0' + n : String(n);
        }

        function esc(text) {
            return String(text === null || text === undefined ? '' : text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function toDate(value) {
            if (!value) {
                return null;
            }
            var d = value instanceof Date ? value : new Date(value);
            return isNaN(d.getTime()) ? null : d;
        }

        function thaiDate(value) {
            var d = toDate(value);
            if (!d) {
                return '—';
            }
            return d.getDate() + ' ' + THAI_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543);
        }

        function thaiTime(value) {
            var d = toDate(value);
            return d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) : '';
        }

        function dateCell(value) {
            var time = thaiTime(value);
            return thaiDate(value) + (time ? '<span class="time">' + time + '</span>' : '');
        }

        function statusBadge(text) {
            var cls = STATUS_CLASS[text] || 'cancel';
            return '<span class="status status--' + cls + '">' + esc(text || '—') + '</span>';
        }

        /* ลิงก์ Drive แบบ /file/d/…/view เอามาใส่ <img> ตรง ๆ ไม่ขึ้น
           (มันเป็นหน้าเว็บ viewer ไม่ใช่ไฟล์รูป — กดลิงก์ดูได้อย่างเดียว)
           เลยแปลงเป็น thumbnail URL สำหรับโชว์ ส่วนลิงก์กดดูใช้ของเดิม */
        function driveThumb(url) {
            var match = String(url || '').match(/drive\.google\.com\/file\/d\/([^\/\?#]+)/);
            return match
                ? 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w200'
                : url;
        }

        /* รูปขนาดดูจริงใน lightbox : Drive ใช้ thumbnail ใหญ่ (viewer /view
           ใส่ <img> ไม่ขึ้น) รูปอื่นใช้ URL เดิม */
        function driveFull(url) {
            var match = String(url || '').match(/drive\.google\.com\/file\/d\/([^\/\?#]+)/);
            return match
                ? 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w1600'
                : url;
        }

        /* รูปแนบในตาราง : โชว์รูปย่อครบทุกใบ (สูงสุด 3) ใบละลิงก์ของตัวเอง
           กดใบไหนเปิดรูปใหญ่ใบนั้นใน lightbox กลางหน้านี้เลย ไม่เปิดแท็บใหม่
           (ลิงก์มี data-lightbox — ตัวดักคลิกกลางอยู่ท้ายไฟล์) */
        function photoCell(photos) {
            var list = (photos || []).filter(function (url) {
                return !!url;
            });
            if (!list.length) {
                return '<span class="no-photo">—</span>';
            }
            var shown = list.slice(0, 3);
            var html = '<span class="photo-thumbs">' + shown.map(function (url, i) {
                var full = esc(driveFull(url));
                var thumb = esc(driveThumb(url));
                return '<a class="photo-thumb" href="' + full + '" data-lightbox' +
                    ' title="กดเพื่อดูรูปใหญ่ (รูปที่ ' + (i + 1) + ' จาก ' + list.length + ')">' +
                    '<img src="' + thumb + '" alt="รูปแนบที่ ' + (i + 1) + '" loading="lazy"></a>';
            }).join('') + '</span>';
            if (list.length > shown.length) {
                html += '<span class="photo-count">+' + (list.length - shown.length) + '</span>';
            }
            return html;
        }

        /* ---------- กล่องดูรูปใหญ่ (lightbox) ----------
           กดรูปย่อ (ลิงก์ที่มี data-lightbox) → เปิดรูปใหญ่ทับในหน้านี้เลย
           เก็บทั้งกลุ่มรูปในแถวเดียวกันไว้ กด ‹ › หรือลูกศรดูใบอื่นได้
           Esc / กดพื้นหลัง / กด ✕ = ปิด (มีลิงก์เปิดต้นฉบับสำรองไว้ให้
           กรณี Drive ไม่ยอมแสดงรูปในหน้าเว็บ) */
        var lbItems = [];
        var lbIndex = 0;
        var lbFailed = false;
        var lbOverlay = null;
        var lbView = null;
        var lbImg = null;
        var lbCap = null;
        var lbOrig = null;
        var lbPrev = null;
        var lbNext = null;
        var lbZoomLabel = null;
        /* สถานะซูม/เลื่อน : ซูม 1 = พอดีจอ, สูงสุด 5 เท่า */
        var lbZoom = 1;
        var lbTx = 0;
        var lbTy = 0;
        var lbPointers = {};
        var lbPinchD0 = 0;
        var lbDragId = null;
        var lbDragX = 0;
        var lbDragY = 0;

        function lbEl(tag, cls, parent) {
            var el = document.createElement(tag);
            if (cls) {
                el.className = cls;
            }
            if (parent) {
                parent.appendChild(el);
            }
            return el;
        }

        function lbEnsure() {
            if (lbOverlay) {
                return;
            }
            var ov = lbEl('div', 'lightbox');
            ov.id = 'dtamLightbox';
            ov.hidden = true;
            var back = lbEl('div', 'lightbox-backdrop', ov);
            back.setAttribute('data-lb-close', '1');
            var box = lbEl('figure', 'lightbox-box', ov);
            var x = lbEl('button', 'lightbox-x', box);
            x.setAttribute('data-lb-close', '1');
            x.setAttribute('aria-label', 'ปิดรูป');
            x.textContent = '✕';
            lbView = lbEl('div', 'lightbox-view', box);
            lbImg = lbEl('img', 'lightbox-img', lbView);
            lbImg.setAttribute('alt', 'รูปแนบขนาดใหญ่');
            lbImg.setAttribute('referrerpolicy', 'no-referrer');
            lbImg.draggable = false;
            lbCap = lbEl('figcaption', 'lightbox-cap', box);
            lbPrev = lbEl('button', 'lightbox-prev', box);
            lbPrev.setAttribute('data-lb-nav', '-1');
            lbPrev.setAttribute('aria-label', 'รูปก่อนหน้า');
            lbPrev.textContent = '‹';
            lbNext = lbEl('button', 'lightbox-next', box);
            lbNext.setAttribute('data-lb-nav', '1');
            lbNext.setAttribute('aria-label', 'รูปถัดไป');
            lbNext.textContent = '›';
            lbOrig = lbEl('a', 'lightbox-orig', box);
            lbOrig.setAttribute('target', '_blank');
            lbOrig.setAttribute('rel', 'noopener');
            lbOrig.textContent = 'เปิดต้นฉบับ';
            /* แถบซูม : − / ตัวเลข% (กด = กลับขนาดพอดีจอ) / + */
            var zoombar = lbEl('div', 'lightbox-zoombar', ov);
            var zbOut = lbEl('button', 'lightbox-zbtn', zoombar);
            zbOut.setAttribute('data-z', 'out');
            zbOut.setAttribute('aria-label', 'ย่อรูป');
            zbOut.textContent = '−';
            lbZoomLabel = lbEl('button', 'lightbox-zbtn lightbox-zpct', zoombar);
            lbZoomLabel.setAttribute('data-z', 'reset');
            lbZoomLabel.setAttribute('aria-label', 'กลับขนาดพอดีจอ');
            lbZoomLabel.textContent = '100%';
            var zbIn = lbEl('button', 'lightbox-zbtn', zoombar);
            zbIn.setAttribute('data-z', 'in');
            zbIn.setAttribute('aria-label', 'ขยายรูป');
            zbIn.textContent = '+';
            zoombar.addEventListener('click', function (ev) {
                var t = ev.target;
                var btn = t && t.closest ? t.closest('[data-z]') : null;
                if (!btn) {
                    return;
                }
                var act = btn.getAttribute('data-z');
                if (act === 'in') {
                    lbZoomAt(1.25);
                } else if (act === 'out') {
                    lbZoomAt(1 / 1.25);
                } else {
                    lbZoomReset();
                }
            });
            /* ล้อเมาส์ = ซูม (รวม pinch ของ trackpad ที่มาเป็น ctrl+wheel) */
            lbView.addEventListener('wheel', function (ev) {
                if (ev.preventDefault) {
                    ev.preventDefault();
                }
                lbZoomAt((ev.deltaY || 0) < 0 ? 1.15 : 1 / 1.15);
            }, { passive: false });
            /* ดับเบิลคลิก = สลับขยาย 2.5 เท่า / กลับพอดีจอ */
            lbImg.addEventListener('dblclick', function () {
                if (lbZoom > 1) {
                    lbZoomReset();
                } else {
                    lbZoom = 2.5;
                    lbApplyZoom();
                }
            });
            /* ลากเลื่อนรูปตอนซูม + หนีบนิ้วซูมบนจอสัมผัส (pointer events รวมเมาส์) */
            lbImg.addEventListener('pointerdown', function (ev) {
                if (ev.button !== undefined && ev.button !== 0) {
                    return;
                }
                if (ev.preventDefault) {
                    ev.preventDefault();
                }
                if (lbImg.setPointerCapture && ev.pointerId !== undefined) {
                    try {
                        lbImg.setPointerCapture(ev.pointerId);
                    } catch (e) { }
                }
                var p = { x: ev.clientX || 0, y: ev.clientY || 0 };
                lbPointers[ev.pointerId || 'm'] = p;
                if (lbPointerCount() === 2) {
                    lbPinchD0 = lbPointerDist();
                    lbDragId = null;
                } else if (lbZoom > 1) {
                    lbDragId = ev.pointerId || 'm';
                    lbDragX = p.x;
                    lbDragY = p.y;
                    lbImg.style.cursor = 'grabbing';
                }
            });
            lbImg.addEventListener('pointermove', function (ev) {
                var id = ev.pointerId || 'm';
                if (!Object.prototype.hasOwnProperty.call(lbPointers, id)) {
                    return;
                }
                lbPointers[id] = { x: ev.clientX || 0, y: ev.clientY || 0 };
                if (lbPointerCount() === 2) {
                    var d = lbPointerDist();
                    if (lbPinchD0 > 0 && d > 0) {
                        lbZoomAt(d / lbPinchD0);
                    }
                    lbPinchD0 = d;
                } else if (id === lbDragId) {
                    var p = lbPointers[id];
                    lbTx += p.x - lbDragX;
                    lbTy += p.y - lbDragY;
                    lbDragX = p.x;
                    lbDragY = p.y;
                    lbApplyZoom();
                }
            });
            function lbPtrEnd(ev) {
                var id = ev.pointerId || 'm';
                delete lbPointers[id];
                if (lbPointerCount() < 2) {
                    lbPinchD0 = 0;
                }
                if (id === lbDragId) {
                    lbDragId = null;
                    lbImg.style.cursor = '';
                    lbApplyZoom();
                }
            }
            lbImg.addEventListener('pointerup', lbPtrEnd);
            lbImg.addEventListener('pointercancel', lbPtrEnd);
            ov.addEventListener('click', function (ev) {
                var t = ev.target;
                var closer = t && t.closest ? t.closest('[data-lb-close]') : null;
                if (closer) {
                    lbClose();
                    return;
                }
                var navBtn = t && t.closest ? t.closest('[data-lb-nav]') : null;
                if (navBtn) {
                    lbStep(Number(navBtn.getAttribute('data-lb-nav')) || 0);
                }
            });
            lbImg.addEventListener('error', function () {
                lbFailed = true;
                if (lbCap) {
                    lbCap.textContent = 'โหลดรูปไม่สำเร็จ (ไฟล์อาจถูกลบหรือไม่ได้แชร์)';
                }
            });
            lbImg.addEventListener('load', function () {
                lbFailed = false;
                lbCaption();
            });
            document.body.appendChild(ov);
            lbOverlay = ov;
        }

        function lbCaption() {
            if (lbFailed || !lbCap || !lbItems.length) {
                return;
            }
            var it = lbItems[lbIndex] || {};
            lbCap.textContent = (it.label || 'รูปแนบ') + ' · ' +
                (lbIndex + 1) + ' / ' + lbItems.length;
        }

        function lbShow(i) {
            if (!lbItems.length || !lbOverlay) {
                return;
            }
            /* เปลี่ยนใบ = เริ่มที่ขนาดพอดีจอทุกครั้ง */
            lbZoom = 1;
            lbTx = 0;
            lbTy = 0;
            lbPointers = {};
            lbPinchD0 = 0;
            lbDragId = null;
            lbIndex = (i + lbItems.length) % lbItems.length;
            var it = lbItems[lbIndex];
            lbFailed = false;
            if (lbCap) {
                lbCap.textContent = (it.label || 'รูปแนบ') + ' · ' +
                    (lbIndex + 1) + ' / ' + lbItems.length;
            }
            if (lbOrig) {
                lbOrig.href = it.src;
            }
            if (lbImg) {
                lbImg.alt = it.label || 'รูปแนบ';
                lbImg.src = it.src;
                lbApplyZoom();
            }
            var multi = lbItems.length > 1;
            if (lbPrev) {
                lbPrev.hidden = !multi;
            }
            if (lbNext) {
                lbNext.hidden = !multi;
            }
        }

        function lbOpen(items, index) {
            if (!items || !items.length) {
                return;
            }
            lbEnsure();
            lbItems = items;
            document.body.style.overflow = 'hidden';
            lbOverlay.hidden = false;
            lbShow(index || 0);
        }

        function lbClose() {
            if (!lbOverlay || lbOverlay.hidden) {
                return;
            }
            lbZoomReset();
            lbOverlay.hidden = true;
            document.body.style.overflow = '';
            if (lbImg) {
                lbImg.removeAttribute('src');
            }
            lbItems = [];
        }

        function lbStep(d) {
            if (lbItems.length) {
                lbShow(lbIndex + d);
            }
        }

        /* ---------- ซูม + เลื่อนรูป ---------- */
        function lbPointerCount() {
            var n = 0;
            for (var k in lbPointers) {
                if (Object.prototype.hasOwnProperty.call(lbPointers, k)) {
                    n += 1;
                }
            }
            return n;
        }

        function lbPointerDist() {
            var pts = [];
            for (var k in lbPointers) {
                if (Object.prototype.hasOwnProperty.call(lbPointers, k)) {
                    pts.push(lbPointers[k]);
                }
            }
            if (pts.length < 2) {
                return 0;
            }
            var dx = pts[0].x - pts[1].x;
            var dy = pts[0].y - pts[1].y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        /* ดันรูปไม่ให้หลุดกรอบ : อ่านขนาดจริงหลังขยายแล้วเทียบกับกรอบ */
        function lbClampPan() {
            if (lbZoom <= 1) {
                lbTx = 0;
                lbTy = 0;
                return;
            }
            if (!lbImg || !lbView || !lbImg.getBoundingClientRect ||
                !lbView.getBoundingClientRect) {
                return;
            }
            var v = lbView.getBoundingClientRect();
            var r = lbImg.getBoundingClientRect();
            if (!v || !v.width || !v.height) {
                return;
            }
            var dx = Math.max(0, (r.width - v.width) / 2);
            var dy = Math.max(0, (r.height - v.height) / 2);
            lbTx = Math.min(dx, Math.max(-dx, lbTx));
            lbTy = Math.min(dy, Math.max(-dy, lbTy));
        }

        function lbApplyZoom() {
            if (!lbImg) {
                return;
            }
            lbClampPan();
            lbImg.style.transform =
                'translate(' + lbTx + 'px, ' + lbTy + 'px) scale(' + lbZoom + ')';
            lbImg.style.cursor = lbZoom > 1 ? 'grab' : '';
            if (lbZoomLabel) {
                lbZoomLabel.textContent = Math.round(lbZoom * 100) + '%';
            }
        }

        function lbZoomAt(factor) {
            lbZoom = Math.min(5, Math.max(1, lbZoom * factor));
            if (lbZoom <= 1) {
                lbTx = 0;
                lbTy = 0;
            }
            lbApplyZoom();
        }

        function lbZoomReset() {
            lbZoom = 1;
            lbTx = 0;
            lbTy = 0;
            lbPointers = {};
            lbPinchD0 = 0;
            lbDragId = null;
            lbApplyZoom();
        }

        function lbIsOpen() {
            return !!(lbOverlay && !lbOverlay.hidden);
        }

        /* เปิดจากลิงก์รูปที่กด : เก็บรูปลิงก์พี่น้องในแถวเดียวกันเป็นกลุ่ม */
        function lbOpenFrom(anchor) {
            var box = (anchor && anchor.parentNode) || document;
            var nodes = box.querySelectorAll
                ? box.querySelectorAll('[data-lightbox]')
                : [];
            var items = [];
            var at = 0;
            Array.prototype.forEach.call(nodes, function (node, i) {
                if (node === anchor) {
                    at = i;
                }
                var img = node.querySelector ? node.querySelector('img') : null;
                items.push({
                    src: node.getAttribute('href') || '',
                    label: (img && img.getAttribute('alt')) || 'รูปแนบ'
                });
            });
            lbOpen(items, at);
        }

        /* สล็อตกลางให้ตัวดักคลิก/ปุ่มคีย์บอร์ดเรียก (ลงทะเบียนครั้งเดียวพอ
           สคริปต์หน้านี้รันใหม่ทุกครั้งที่สลับหน้าเข้ามา) */
        window.__dtamLightboxApi = {
            openFrom: lbOpenFrom,
            close: lbClose,
            step: lbStep,
            isOpen: lbIsOpen,
            zoomIn: function () {
                lbZoomAt(1.25);
            },
            zoomOut: function () {
                lbZoomAt(1 / 1.25);
            },
            zoomReset: lbZoomReset
        };

        if (!window.__dtamLightboxBound) {
            window.__dtamLightboxBound = true;
            document.addEventListener('click', function (ev) {
                var t = ev.target && ev.target.closest
                    ? ev.target.closest('a[data-lightbox]')
                    : null;
                var api = window.__dtamLightboxApi;
                if (!t || !api) {
                    return;
                }
                if (ev.preventDefault) {
                    ev.preventDefault();
                }
                api.openFrom(t);
            });
            document.addEventListener('keydown', function (ev) {
                var api = window.__dtamLightboxApi;
                if (!api || !api.isOpen()) {
                    return;
                }
                if (ev.key === 'Escape') {
                    api.close();
                } else if (ev.key === 'ArrowRight') {
                    api.step(1);
                } else if (ev.key === 'ArrowLeft') {
                    api.step(-1);
                } else if (ev.key === '+' || ev.key === '=') {
                    api.zoomIn();
                } else if (ev.key === '-') {
                    api.zoomOut();
                } else if (ev.key === '0') {
                    api.zoomReset();
                }
            });
        }

        /* ---------- ปฏิทินไทย (แสดง พ.ศ.) ---------- */

        var THAI_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
        var openCalendar = null;

        function parseIso(iso) {
            var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
            if (!match) {
                return null;
            }
            return {
                year: parseInt(match[1], 10),
                month: parseInt(match[2], 10) - 1,
                day: parseInt(match[3], 10)
            };
        }

        function isoFromParts(year, month, day) {
            var d = new Date(year, month, day);
            return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        }

        function thaiDateText(iso) {
            var parts = parseIso(iso);
            if (!parts) {
                return '';
            }
            return pad(parts.day) + '/' + pad(parts.month + 1) + '/' + (parts.year + 543);
        }

        /* ค่าจริงที่ใช้กรองเก็บเป็น ISO ใน data-iso ส่วนช่องกรอกแสดงเป็น พ.ศ. */
        function dateValue(input) {
            return input ? String(input.dataset.iso || '') : '';
        }

        function setDateValue(input, iso) {
            if (!input) {
                return;
            }
            closeCalendar();
            input.dataset.iso = iso || '';
            input.value = iso ? thaiDateText(iso) : '';
            input.dispatchEvent(new CustomEvent('datechange', { bubbles: true }));
        }

        function closeCalendar() {
            if (!openCalendar) {
                return;
            }
            var close = openCalendar;
            openCalendar = null;
            close();
        }

        function initDatePickers() {
            Array.prototype.forEach.call(
                document.querySelectorAll('input[type="date"]'),
                function (input) {
                    var initial = input.value;

                    input.type = 'text';
                    input.readOnly = true;
                    input.autocomplete = 'off';
                    input.classList.add('dp-input');
                    input.setAttribute('placeholder', 'วว/ดด/พ.ศ.');
                    input.setAttribute('title', 'เลือกวันที่จากปฏิทิน (พ.ศ.)');
                    input.dataset.iso = initial || '';
                    input.value = initial ? thaiDateText(initial) : '';

                    input.addEventListener('click', function () {
                        if (openCalendar) {
                            closeCalendar();
                            return;
                        }
                        showCalendar(input);
                    });

                    input.addEventListener('keydown', function (event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            input.click();
                        }
                    });
                }
            );
        }

        function showCalendar(input) {
            var panel = document.createElement('div');
            panel.className = 'dp-panel';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-label', 'เลือกวันที่');

            var selected = parseIso(dateValue(input));
            var todayIso = isoFromParts(new Date().getFullYear(), new Date().getMonth(),
                new Date().getDate());
            var view = selected
                ? new Date(selected.year, selected.month, 1)
                : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

            function choose(iso) {
                setDateValue(input, iso);
                input.focus();
            }

            function renderPanel() {
                var year = view.getFullYear();
                var month = view.getMonth();
                var firstWeekday = new Date(year, month, 1).getDay();
                var daysInMonth = new Date(year, month + 1, 0).getDate();
                var prevDays = new Date(year, month, 0).getDate();
                var cells = [];
                var i;
                var next = 1;

                for (i = firstWeekday; i > 0; i -= 1) {
                    cells.push({ day: prevDays - i + 1, month: month - 1, year: year, out: true });
                }
                for (i = 1; i <= daysInMonth; i += 1) {
                    cells.push({ day: i, month: month, year: year, out: false });
                }
                while (cells.length % 7 !== 0) {
                    cells.push({ day: next, month: month + 1, year: year, out: true });
                    next += 1;
                }

                var selectedIso = dateValue(input);

                panel.innerHTML =
                    '<div class="dp-head">' +
                        '<button type="button" class="dp-nav" data-step="-1" aria-label="เดือนก่อน">‹</button>' +
                        '<span class="dp-title">' + THAI_MONTHS[month] + ' ' + (year + 543) + '</span>' +
                        '<button type="button" class="dp-nav" data-step="1" aria-label="เดือนถัดไป">›</button>' +
                    '</div>' +
                    '<div class="dp-grid dp-weekdays">' +
                        THAI_WEEKDAYS.map(function (day) { return '<span>' + day + '</span>'; }).join('') +
                    '</div>' +
                    '<div class="dp-grid">' +
                        cells.map(function (cell) {
                            var iso = isoFromParts(cell.year, cell.month, cell.day);
                            var cls = 'dp-day' + (cell.out ? ' is-out' : '') +
                                (iso === selectedIso ? ' is-selected' : '') +
                                (iso === todayIso ? ' is-today' : '');
                            return '<button type="button" class="' + cls + '" data-iso="' + iso +
                                '" aria-pressed="' + (iso === selectedIso ? 'true' : 'false') + '">' +
                                cell.day + '</button>';
                        }).join('') +
                    '</div>' +
                    '<div class="dp-foot">' +
                        '<button type="button" class="dp-link" data-today="1">วันนี้</button>' +
                        '<button type="button" class="dp-link" data-clear="1">ล้างวันที่</button>' +
                    '</div>';
            }

            panel.addEventListener('click', function (event) {
                var nav = event.target.closest('.dp-nav');
                if (nav) {
                    view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.step), 1);
                    renderPanel();
                    return;
                }

                var dayButton = event.target.closest('.dp-day');
                if (dayButton) {
                    choose(dayButton.dataset.iso);
                    return;
                }

                if (event.target.closest('[data-today]')) {
                    choose(todayIso);
                    return;
                }

                if (event.target.closest('[data-clear]')) {
                    choose('');
                }
            });

            renderPanel();
            document.body.appendChild(panel);

            var rect = input.getBoundingClientRect();
            var left = Math.min(rect.left, window.innerWidth - panel.offsetWidth - 8);
            var top = rect.bottom + 6;
            if (top + panel.offsetHeight > window.innerHeight - 8) {
                top = Math.max(8, rect.top - panel.offsetHeight - 6);
            }
            panel.style.left = Math.max(8, left) + 'px';
            panel.style.top = Math.max(8, top) + 'px';

            function onOutside(event) {
                if (!panel.contains(event.target) && event.target !== input) {
                    closeCalendar();
                }
            }

            function onKey(event) {
                if (event.key === 'Escape') {
                    closeCalendar();
                    input.focus();
                }
            }

            document.addEventListener('pointerdown', onOutside, true);
            document.addEventListener('keydown', onKey);
            window.addEventListener('resize', closeCalendar);

            openCalendar = function () {
                document.removeEventListener('pointerdown', onOutside, true);
                document.removeEventListener('keydown', onKey);
                window.removeEventListener('resize', closeCalendar);
                panel.remove();
            };
        }

        /* ---------- กล่องแจ้งเตือน ---------- */

        var dialogCloseTimer = null;

        function dialog(title, text) {
            var box = document.getElementById('alertBox');
            if (!box) {
                window.alert(title + '\n' + text);
                return;
            }
            if (dialogCloseTimer) {
                clearTimeout(dialogCloseTimer);
                dialogCloseTimer = null;
            }

            box.querySelector('.swal-title').textContent = title;
            box.querySelector('.swal-text').textContent = text;

            /* เริ่มจากสถานะโปร่งใสก่อน แล้วค่อยเติม is-open เพื่อให้ fade in */
            box.classList.remove('is-open');
            box.hidden = false;
            void box.offsetWidth;
            box.classList.add('is-open');

            box.querySelector('.swal-btn').focus();
        }

        function closeDialog() {
            var box = document.getElementById('alertBox');
            if (!box || box.hidden) {
                return;
            }
            if (dialogCloseTimer) {
                clearTimeout(dialogCloseTimer);
            }

            box.classList.remove('is-open');
            dialogCloseTimer = setTimeout(function () {
                box.hidden = true;
                dialogCloseTimer = null;
            }, 240);
        }

        /* ---------- การเปลี่ยนหน้า ----------
           ไม่ดักคลิกเพื่อจางหน้าที่กำลังจะออกแล้ว เพราะช่วงที่จางจนขาว
           กว่าจะโหลดหน้าใหม่เสร็จ = จอขาวค้างทุกครั้งที่กดเมนู (อาการกระพริบ)
           ปล่อยให้เบราว์เซอร์เปลี่ยนหน้าทันที แล้วค่อยนุ่มนวลตอน "เข้าหน้า"
           ด้วยอนิเมชัน .page-heading / .page-body / .form-wrap ใน Styles.html */

        /* NavJS ยิง event นี้ก่อนสลับเนื้อหา : เคลียร์ timer ของหน้าเดิม กันนาฬิกาซ้อน */
        window.addEventListener('dtam:before-navigate', function () {
            if (window.__dtamClock) {
                window.clearInterval(window.__dtamClock);
                window.__dtamClock = null;
            }

            if (window.__dtamSessionTimer) {
                window.clearInterval(window.__dtamSessionTimer);
                window.__dtamSessionTimer = null;
            }
        });

        /* ---------- เมนูข้าง + นาฬิกา ---------- */

        function initShell() {
            initDatePickers();
            initAuthUi();
            initSessionTimer();

            var toggle = document.getElementById('sidebarToggle');
            if (toggle) {
                /* ใช้ matchMedia ตัวเดียวกับ CSS (max-width: 900px) เพื่อไม่ให้เพี้ยนกันที่ 900px พอดี */
                var sidebarMobile = window.matchMedia('(max-width: 900px)');

                function setSidebar(open) {
                    document.body.classList.toggle('sidebar-collapsed', !open);
                    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                }

                /* element อาจถูกเก็บข้ามหน้า (NavJS) : ผูก event ครั้งเดียวพอ
                   ไม่งั้นกดครั้งเดียวจะเปิดแล้วปิดทันที */
                if (!toggle.__dtamSidebarBound) {
                    toggle.__dtamSidebarBound = true;

                    toggle.addEventListener('click', function () {
                        setSidebar(document.body.classList.contains('sidebar-collapsed'));
                    });
                }

                /* จอเล็ก : เริ่มด้วยเมนูปิดไว้ก่อน
                   แต่ถ้าเพิ่งสลับหน้าด้วย NavJS ให้คงสถานะเดิมไว้ ไม่เปิด/ปิดซ้ำ (เมนูไม่กระพริบ) */
                var keptSidebar = window.__dtamSidebarState;

                window.__dtamSidebarState = undefined;

                setSidebar(typeof keptSidebar === 'boolean' ? keptSidebar : !sidebarMobile.matches);

                /* ฉากมืดรองหลังเมนู : กดแล้วปิด (สร้างครั้งเดียวต่อหน้า) */
                if (!document.querySelector('.sidebar-backdrop')) {
                    var backdrop = document.createElement('div');

                    backdrop.className = 'sidebar-backdrop';
                    backdrop.setAttribute('aria-hidden', 'true');
                    backdrop.addEventListener('click', function () {
                        setSidebar(false);
                    });
                    document.body.appendChild(backdrop);
                }

                /* ข้ามเบรกพอยต์ : จอใหญ่กลับมาแสดงเมนู, จอเล็กเก็บเมนูไว้ */
                function onSidebarBreak() {
                    setSidebar(!sidebarMobile.matches);
                }

                if (!window.__dtamSidebarBreakBound) {
                    window.__dtamSidebarBreakBound = true;

                    if (sidebarMobile.addEventListener) {
                        sidebarMobile.addEventListener('change', onSidebarBreak);
                    } else if (sidebarMobile.addListener) {
                        sidebarMobile.addListener(onSidebarBreak);
                    }
                }

                /* Escape ปิดเมนู (จอเล็ก) — ลงทะเบียนครั้งเดียวต่อหน้าต่าง */
                if (!window.__dtamSidebarKeys) {
                    window.__dtamSidebarKeys = true;

                    document.addEventListener('keydown', function (event) {
                        if (event.key !== 'Escape' || !sidebarMobile.matches) {
                            return;
                        }

                        var body = document.body;
                        if (!body || body.classList.contains('sidebar-collapsed')) {
                            return;
                        }

                        body.classList.add('sidebar-collapsed');

                        var btn = document.getElementById('sidebarToggle');
                        if (btn) {
                            btn.setAttribute('aria-expanded', 'false');
                        }
                    });
                }
            }

            /* ไฮไลต์เมนูตามหน้า + เปิดเมนูย่อยที่บรรจุหน้าปัจจุบัน */
            var page = window.PAGE_ID || '';
            Array.prototype.forEach.call(document.querySelectorAll('.nav-link[data-page]'), function (link) {
                if (link.dataset.page === page) {
                    if (!link.closest('.submenu')) {
                        link.classList.add('active');
                        /* หน้านี้กดซ้ำไม่ได้ : บอกโปรแกรมอ่านจอด้วย */
                        link.setAttribute('aria-current', 'page');
                    }
                    var parent = link.closest('.submenu');
                    if (parent) {
                        parent.classList.remove('is-collapsed');
                        parent.inert = false;
                        parent.removeAttribute('aria-hidden');
                        var parentButton = document.querySelector('[data-target="' + parent.id + '"]');
                        if (parentButton) {
                            parentButton.setAttribute('aria-expanded', 'true');
                        }
                    }
                }
            });

            Array.prototype.forEach.call(document.querySelectorAll('.nav-parent'), function (button) {
                if (button.__dtamParentBound) {
                    return;
                }

                button.__dtamParentBound = true;

                button.addEventListener('click', function () {
                    var panel = document.getElementById(button.dataset.target);
                    if (!panel) {
                        return;
                    }
                    /* ใช้ aria-expanded เป็นสถานะหลัก เพื่อไม่ให้ชนกับ animation */
                    var open = button.getAttribute('aria-expanded') === 'true';
                    panel.classList.toggle('is-collapsed', open);
                    panel.inert = open;
                    panel.setAttribute('aria-hidden', open ? 'true' : 'false');
                    button.setAttribute('aria-expanded', open ? 'false' : 'true');
                });
            });

            Array.prototype.forEach.call(document.querySelectorAll('[data-soon]'), function (button) {
                if (button.__dtamSoonBound) {
                    return;
                }

                button.__dtamSoonBound = true;

                button.addEventListener('click', function () {
                    dialog('หน้านี้ยังไม่ถูกสร้าง',
                        'เมนู "' + button.dataset.soon + '" จะสร้างในขั้นถัดไป');
                });
            });

            var clockDate = document.getElementById('clockDate');
            var clockTime = document.getElementById('clockTime');
            if (clockDate && clockTime) {
                var tick = function () {
                    var now = new Date();
                    clockDate.textContent = now.getDate() + ' ' + THAI_MONTHS[now.getMonth()] +
                        ' ' + (now.getFullYear() + 543);
                    clockTime.textContent =
                        pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
                };
                tick();
                window.__dtamClock = window.setInterval(tick, 1000);
            }

            var box = document.getElementById('alertBox');
            if (box) {
                box.addEventListener('click', function (event) {
                    if (event.target.hasAttribute('data-close') || event.target === box) {
                        closeDialog();
                    }
                });

                /* ปุ่ม Escape ปิดกล่อง : closeDialog หากล่องสดเองทุกครั้ง
                   จึงลงทะเบียนครั้งเดียวพอ (initShell รันใหม่ทุกครั้งที่สลับหน้า
                   ถ้าผูกตรง ๆ จะสะสม listener ทีละตัวทุกครั้งที่เปลี่ยนหน้า) */
                if (!window.__dtamDialogKeys) {
                    window.__dtamDialogKeys = true;
                    document.addEventListener('keydown', function (event) {
                        if (event.key === 'Escape') {
                            closeDialog();
                        }
                    });
                }
            }
        }

        /* ---------- ตาราง ---------- */

        function downloadCsv(filename, header, lines) {
            var csv = [header].concat(lines).join('\r\n');
            var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        function table(config) {
            var el = {
                thead: document.getElementById(config.theadId),
                tbody: document.getElementById(config.tbodyId),
                info: document.getElementById(config.infoId),
                pager: document.getElementById(config.pagerId),
                search: document.getElementById(config.searchId),
                pageSize: document.getElementById(config.pageSizeId),
                filterForm: config.filterFormId ? document.getElementById(config.filterFormId) : null,
                dateFrom: config.dateFromId ? document.getElementById(config.dateFromId) : null,
                dateTo: config.dateToId ? document.getElementById(config.dateToId) : null
            };

            var state = {
                page: 1,
                pageSize: config.pageSize || 7,
                search: '',
                from: '',
                to: '',
                sortKey: config.defaultSort || '',
                sortDir: 'asc'
            };

            var rows = config.rows || [];
            var extraFilter = null;

            function plain(col, row) {
                return col.text ? col.text(row) : String(row[col.key] === null ||
                    row[col.key] === undefined ? '' : row[col.key]);
            }

            function filtered() {
                return rows.filter(function (row) {
                    if (extraFilter && !extraFilter(row)) {
                        return false;
                    }

                    if (state.search) {
                        var haystack = config.columns.map(function (col) {
                            return plain(col, row);
                        }).join(' ').toLowerCase();
                        if (haystack.indexOf(state.search) === -1) {
                            return false;
                        }
                    }

                    if (config.dateKey && (state.from || state.to)) {
                        var day = String(row[config.dateKey] || '').slice(0, 10);
                        if (state.from && day < state.from) {
                            return false;
                        }
                        if (state.to && day > state.to) {
                            return false;
                        }
                    }

                    return true;
                });
            }

            function sorted(list) {
                if (!state.sortKey) {
                    return list;
                }
                var dir = state.sortDir === 'desc' ? -1 : 1;
                return list.slice().sort(function (a, b) {
                    var av = a[state.sortKey];
                    var bv = b[state.sortKey];
                    var aTime = toDate(av);
                    var bTime = toDate(bv);
                    if (aTime || bTime) {
                        return ((aTime ? aTime.getTime() : 0) - (bTime ? bTime.getTime() : 0)) * dir;
                    }
                    return String(av === null || av === undefined ? '' : av)
                        .localeCompare(String(bv === null || bv === undefined ? '' : bv), 'th') * dir;
                });
            }

            /* เลขหน้าที่จะแสดง: 1 … 4 5 6 … 20 (ย่อเมื่อมีหลายหน้า) */
            function pagerTokens(pages) {
                var tokens = [];
                var i;

                if (pages <= 7) {
                    for (i = 1; i <= pages; i += 1) {
                        tokens.push(i);
                    }
                    return tokens;
                }

                var start;
                var end;
                if (state.page <= 4) {
                    start = 2;
                    end = 5;
                } else if (state.page >= pages - 3) {
                    start = pages - 4;
                    end = pages - 1;
                } else {
                    start = state.page - 1;
                    end = state.page + 1;
                }

                tokens.push(1);
                if (start > 2) {
                    tokens.push('gap');
                }
                for (i = start; i <= end; i += 1) {
                    tokens.push(i);
                }
                if (end < pages - 1) {
                    tokens.push('gap');
                }
                tokens.push(pages);

                return tokens;
            }

            function renderPager(pages) {
                if (!el.pager) {
                    return;
                }

                /* หาปุ่มเดิมมาใช้ต่อ เพื่อให้สี/สถานะเปลี่ยนแบบนุ่มนวล */
                var existing = {};
                var prev = null;
                var next = null;

                Array.prototype.forEach.call(el.pager.children, function (child) {
                    var target = child.dataset ? child.dataset.page : null;
                    if (target === 'prev') {
                        prev = child;
                    } else if (target === 'next') {
                        next = child;
                    } else if (target) {
                        existing[target] = child;
                    }
                });

                if (!prev) {
                    prev = document.createElement('button');
                    prev.type = 'button';
                    prev.dataset.page = 'prev';
                    prev.textContent = 'Previous';
                }
                if (!next) {
                    next = document.createElement('button');
                    next.type = 'button';
                    next.dataset.page = 'next';
                    next.textContent = 'Next';
                }

                var desired = [prev];
                pagerTokens(pages).forEach(function (token) {
                    if (token === 'gap') {
                        var gap = document.createElement('span');
                        gap.className = 'pager-gap';
                        gap.setAttribute('aria-hidden', 'true');
                        gap.textContent = '…';
                        desired.push(gap);
                        return;
                    }

                    var key = String(token);
                    var button = existing[key];
                    if (!button) {
                        button = document.createElement('button');
                        button.type = 'button';
                        button.dataset.page = key;
                        button.textContent = key;
                    }
                    desired.push(button);
                });
                desired.push(next);

                desired.forEach(function (node) {
                    el.pager.appendChild(node);
                });
                Array.prototype.slice.call(el.pager.children).forEach(function (child) {
                    if (desired.indexOf(child) === -1) {
                        el.pager.removeChild(child);
                    }
                });

                /* อัปเดตสถานะบนปุ่มเดิม เพื่อให้ CSS transition ทำงาน */
                Array.prototype.forEach.call(el.pager.children, function (button) {
                    var target = button.dataset ? button.dataset.page : null;
                    if (!target) {
                        return;
                    }
                    var active = target === String(state.page);
                    button.disabled = (target === 'prev' && state.page === 1) ||
                        (target === 'next' && state.page === pages);
                    button.classList.toggle('active', active);
                    if (active) {
                        button.setAttribute('aria-current', 'page');
                    } else {
                        button.removeAttribute('aria-current');
                    }
                });
            }

            function renderIndicators() {
                if (!el.thead) {
                    return;
                }
                Array.prototype.forEach.call(el.thead.querySelectorAll('th[data-sort]'), function (th) {
                    var active = th.dataset.sort === state.sortKey;
                    th.classList.toggle('sorted', active);
                    var ind = th.querySelector('.sort-ind');
                    if (!ind) {
                        ind = document.createElement('span');
                        ind.className = 'sort-ind';
                        th.appendChild(ind);
                    }
                    ind.textContent = active ? (state.sortDir === 'asc' ? '▲' : '▼') : '⇅';
                });
            }

            /* อนิเมชันเบา ๆ ตอนตารางเปลี่ยนข้อมูล */
            function animateRows(motion) {
                if (!el.tbody || !el.tbody.animate) {
                    return;
                }
                if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    return;
                }

                var running = el.tbody._rowAnim && el.tbody._rowAnim.playState === 'running';
                if (running && motion === 'search') {
                    /* พิมพ์ค้นหาต่อเนื่อง ไม่ต้องเริ่ม fade ใหม่ทุกตัวอักษร */
                    return;
                }
                if (el.tbody._rowAnim) {
                    el.tbody._rowAnim.cancel();
                }

                /* ใช้แค่ opacity — ไม่ขยับตำแหน่ง เพื่อไม่ให้เกิด overflow/scrollbar ชั่วคราว */
                el.tbody._rowAnim = el.tbody.animate(
                    [{ opacity: 0.35 }, { opacity: 1 }],
                    { duration: 180, easing: 'ease-out' }
                );
            }

            function render(motion) {
                var list = sorted(filtered());
                var total = list.length;
                var pages = Math.max(1, Math.ceil(total / state.pageSize));
                if (state.page > pages) {
                    state.page = pages;
                }

                var start = (state.page - 1) * state.pageSize;
                var slice = list.slice(start, start + state.pageSize);
                var span = config.columns.length + 1 + (config.onAction ? 1 : 0);

                if (!slice.length) {
                    el.tbody.innerHTML = '<tr><td class="empty" colspan="' + span + '">' +
                        esc(config.emptyText || 'ไม่พบข้อมูล') + '</td></tr>';
                } else {
                    el.tbody.innerHTML = slice.map(function (row, index) {
                        var cells = config.columns.map(function (col) {
                            return '<td' + (col.cls ? ' class="' + col.cls + '"' : '') + '>' +
                                (col.render ? col.render(row) : esc(plain(col, row))) + '</td>';
                        }).join('');

                        var action = config.onAction
                            ? '<td class="col-action"><button type="button" class="btn-edit" data-key="' +
                                esc(row[config.keyField || 'no']) + '" title="' +
                                esc(config.actionTitle || 'ดูรายละเอียด') + '">' + PENCIL + '</button></td>'
                            : '';

                        return '<tr><td class="col-no">' + (start + index + 1) + '</td>' +
                            cells + action + '</tr>';
                    }).join('');
                }

                if (el.info) {
                    el.info.textContent = total
                        ? 'Showing ' + (start + 1) + ' to ' +
                          Math.min(start + state.pageSize, total) + ' of ' + total + ' entries'
                        : 'Showing 0 to 0 of 0 entries';
                }

                renderPager(pages);
                renderIndicators();

                if (motion) {
                    animateRows(motion);
                }
            }

            /* เหตุการณ์ */

            if (el.filterForm) {
                el.filterForm.addEventListener('submit', function (event) {
                    event.preventDefault();
                    state.from = dateValue(el.dateFrom);
                    state.to = dateValue(el.dateTo);
                    state.page = 1;
                    render('filter');
                });
            }

            if (el.pageSize) {
                el.pageSize.value = String(state.pageSize);
                el.pageSize.addEventListener('change', function () {
                    state.pageSize = parseInt(el.pageSize.value, 10) || 7;
                    state.page = 1;
                    render('filter');
                });
            }

            if (el.search) {
                el.search.addEventListener('input', function () {
                    state.search = el.search.value.trim().toLowerCase();
                    state.page = 1;
                    render('search');
                });
            }

            if (el.thead) {
                el.thead.addEventListener('click', function (event) {
                    var th = event.target.closest('th[data-sort]');
                    if (!th) {
                        return;
                    }
                    var key = th.dataset.sort;
                    if (state.sortKey === key) {
                        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        state.sortKey = key;
                        state.sortDir = 'asc';
                    }
                    render('sort');
                });
            }

            if (el.pager) {
                el.pager.addEventListener('click', function (event) {
                    var button = event.target.closest('button[data-page]');
                    if (!button || button.disabled) {
                        return;
                    }
                    var before = state.page;
                    var target = button.dataset.page;
                    if (target === 'prev') {
                        state.page -= 1;
                    } else if (target === 'next') {
                        state.page += 1;
                    } else {
                        state.page = parseInt(target, 10);
                    }
                    render(state.page < before ? 'prev' : 'next');
                });
            }

            if (el.tbody && config.onAction) {
                el.tbody.addEventListener('click', function (event) {
                    var button = event.target.closest('.btn-edit');
                    if (button) {
                        config.onAction(button.dataset.key);
                    }
                });
            }

            /* ส่งออก CSV จากข้อมูลที่กรอง/เรียงแล้ว */
            Array.prototype.forEach.call(document.querySelectorAll('[data-export="excel"]'), function (button) {
                button.addEventListener('click', function () {
                    var list = sorted(filtered());
                    if (!list.length) {
                        dialog('ไม่มีข้อมูลให้ส่งออก', 'ลองปรับช่วงวันที่หรือคำค้นหาแล้วลองใหม่');
                        return;
                    }
                    var header = config.columns.map(function (col) {
                        return '"' + String(col.label).replace(/"/g, '""') + '"';
                    }).join(',');
                    var lines = list.map(function (row) {
                        return config.columns.map(function (col) {
                            return '"' + plain(col, row).replace(/"/g, '""') + '"';
                        }).join(',');
                    });
                    downloadCsv(config.exportName || 'export.csv', header, lines);
                });
            });

            Array.prototype.forEach.call(document.querySelectorAll('[data-export="pdf"]'), function (button) {
                button.addEventListener('click', function () {
                    window.print();
                });
            });

            render();

            return {
                reload: function (nextRows) {
                    rows = nextRows || [];
                    state.page = 1;
                    render('filter');
                },

                /* ตัวกรองเพิ่มเติมจากภายนอก (เช่น การ์ดสรุป) */
                setFilter: function (fn) {
                    extraFilter = typeof fn === 'function' ? fn : null;
                    state.page = 1;
                    render('filter');
                },

                /* ตั้งช่วงวันที่แทนการพิมพ์ในช่องกรอง */
                setDateRange: function (from, to) {
                    state.from = from || '';
                    state.to = to || '';
                    state.page = 1;
                    if (el.dateFrom) {
                        setDateValue(el.dateFrom, state.from);
                    }
                    if (el.dateTo) {
                        setDateValue(el.dateTo, state.to);
                    }
                    render('filter');
                }
            };
        }

        /* ---------- ลิงก์และการเปลี่ยนหน้า ---------- */

        /* ต่อ token ไปกับลิงก์ในแอป เพื่อให้รีเฟรชแล้วยังอยู่ในระบบ
           (ไม่ต่อกับหน้า login และไม่ต่อซ้ำถ้ามี t= อยู่แล้ว) */
        function withToken(url) {
            var token = authToken();

            if (!token || url.indexOf('t=') >= 0) {
                return url;
            }

            if (!/[?&]page=/.test(url) || /[?&]page=login(&|$)/.test(url)) {
                return url;
            }

            return url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + encodeURIComponent(token);
        }

        /* หน้าเว็บใน Apps Script รันอยู่ใน iframe ของโดเมน sandbox
           (…googleusercontent.com) ลิงก์แบบ ?page=… จึงชี้ไปโดเมนนั้น
           เปิดแล้วเจอหน้าจอขาว — ต้องต่อกับ URL เว็บแอปจริงที่ Code.gs ส่งมา
           (window.__DTAM_BASE) ถ้าไม่มี (เช่น preview) ใช้ค่าเดิม */
        function href(target) {
            var base = String(window.__DTAM_BASE || '');
            var url = String(target || '');

            if (!base) {
                return withToken(url);
            }

            var cut = url.replace(/^[^?#]*/, '');

            return withToken(cut ? base.replace(/[?#].*$/, '') + cut : url);
        }

        /* เปลี่ยนหน้า
           1) ถ้ามี NavJS (ทุกหน้าในแอป) ให้สลับหน้าในที่เดียวกัน — ไม่โหลดใหม่
              จึงไม่มีจังหวะจอขาวใน iframe ของ Apps Script เลย
           2) ไม่มี NavJS : ใช้ URL เต็มที่ต่อกับ base แล้วพา "หน้าต่างนอกสุด" ไป
              (โหลดซ้อนในการ์ด sandbox = จอขาว) */
        function goTo(target) {
            var nav = window.__dtamNav;
            var want = String(target || '');

            if (nav && typeof nav.go === 'function') {
                nav.go(want, true);
                return;
            }

            var url = href(want);

            try {
                if (window.top && window.top !== window.self) {
                    window.top.location.href = url;
                    return;
                }
            } catch (e) { }

            window.location.href = url;
        }

        /* ---------- การเข้าสู่ระบบ ----------
           เว็บแอปเปิดให้ทุกคนเข้าได้ จึงใช้ token ของเราเอง (ไม่พึ่งบัญชี Google)
           ตัวตรวจสิทธิ์จริงอยู่ที่ Code.gs (login / sessionInfo / logout)

           รีเฟรชแล้วไม่ต้องล็อกอินซ้ำ (อายุ session 8 ชั่วโมง ตรวจที่ Code.gs):
             1) Code.gs ส่ง token ที่ตรวจแล้วมากับ HTML → window.__DTAM_TOKEN
                (ตัวหลัก — ไม่ขึ้นกับ storage/URL ที่ iframe มองเห็น)
             2) localStorage + sessionStorage (สำรอง)
             3) ซิงก์ page + token กลับไปที่ URL จริง (…/exec) และแจ้งหน้ากาก
                ที่ฝัง iframe — ดู syncSession() ด้านล่าง */

        var AUTH_KEY = 'dtam:auth';
        var authCache = null;
        var authCleared = false;

        function storageGetItem() {
            var stores = [window.localStorage, window.sessionStorage];

            for (var i = 0; i < stores.length; i++) {
                try {
                    var value = stores[i].getItem(AUTH_KEY);

                    if (value) {
                        return value;
                    }
                } catch (e) { }
            }

            return null;
        }

        function storageSetItem(raw) {
            var stores = [window.localStorage, window.sessionStorage];

            for (var i = 0; i < stores.length; i++) {
                try {
                    if (raw === null) {
                        stores[i].removeItem(AUTH_KEY);
                    } else {
                        stores[i].setItem(AUTH_KEY, raw);
                    }
                } catch (e) { }
            }
        }

        /* token ที่เซิร์ฟเวอร์ตรวจแล้วและส่งมากับหน้านี้ (window.__DTAM_TOKEN)
           เชื่อถือได้ที่สุด — ไม่ขึ้นกับ storage หรือ query ของ iframe */
        function injectedToken() {
            return String(window.__DTAM_TOKEN || '');
        }

        function authGet() {
            if (authCache) {
                return authCache;
            }

            /* ใช้ token ที่เซิร์ฟเวอร์ตรวจแล้วเสมอ — ไม่หยิบจาก query ของ iframe
               ซึ่งอาจเป็นค่าเก่าที่ค้างอยู่ (เช่น หลังออกจากระบบแล้ว URL ยังไม่ทันเปลี่ยน) */
            var seed = authCleared ? '' : injectedToken();
            var raw = storageGetItem();

            if (raw) {
                try {
                    authCache = JSON.parse(raw);
                } catch (e) {
                    authCache = null;
                }
            }

            /* token ของหน้านี้เป็นตัวล่าสุด : ถ้า storage ยังเก็บตัวเก่าอยู่ ให้ทับ */
            if (seed && (!authCache || authCache.token !== seed)) {
                authCache = {
                    token: seed,
                    name: String(window.__DTAM_NAME || ''),
                    role: String(window.__DTAM_ROLE || ''),
                    exp: Number(window.__DTAM_EXP || 0)
                };
                storageSetItem(JSON.stringify(authCache));
            }

            return authCache;
        }

        function authSet(data) {
            authCache = data || null;
            authCleared = !data;

            /* ค่า seed ของหน้านี้ต้องตรงกับสถานะล่าสุด — ออกจากระบบแล้ว
               ต้องไม่ถูกหยิบจาก window.__DTAM_TOKEN / URL กลับมาใช้ซ้ำ */
            window.__DTAM_TOKEN = data && data.token ? String(data.token) : '';
            window.__DTAM_NAME = data && data.token ? String(data.name || '') : '';
            window.__DTAM_ROLE = data && data.token ? String(data.role || '') : '';
            window.__DTAM_EXP = data && data.token ? Number(data.exp || 0) : 0;

            storageSetItem(data ? JSON.stringify(data) : null);
        }

        function authToken() {
            var auth = authGet();
            return auth && auth.token ? String(auth.token) : '';
        }

        function authName() {
            var auth = authGet();
            return auth && auth.name ? String(auth.name) : '';
        }

        /* ---------- เวลาที่เหลือของ session ----------
           แสดงบนแถบหัว (ดู data-session-left ใน Shell.html) ว่าอีกนานแค่ไหน
           ต้องเข้าสู่ระบบใหม่ — ค่ามาจาก exp ของ token ที่เซิร์ฟเวอร์ส่งมา */
        function sessionLeftText(exp) {
            var left = Number(exp || 0) - Date.now();

            if (left <= 0) {
                return 'session หมดอายุ';
            }

            var mins = Math.max(1, Math.floor(left / 60000));
            var hours = Math.floor(mins / 60);
            var rest = mins % 60;

            if (hours && rest) {
                return 'เหลือ ' + hours + ' ชม. ' + rest + ' น.';
            }

            return hours ? 'เหลือ ' + hours + ' ชม.' : 'เหลือ ' + rest + ' น.';
        }

        function initSessionTimer() {
            var labels = document.querySelectorAll('[data-session-left]');

            if (!labels.length) {
                return;
            }

            function render() {
                var auth = authGet();
                var exp = auth && auth.exp ? Number(auth.exp) : 0;
                var text = exp ? sessionLeftText(exp) : '';
                var expired = !!(exp && exp <= Date.now());

                Array.prototype.forEach.call(labels, function (el) {
                    el.textContent = text;
                    el.hidden = !text;
                    el.classList.toggle('is-expired', expired);
                });
            }

            render();

            if (window.__dtamSessionTimer) {
                window.clearInterval(window.__dtamSessionTimer);
            }

            window.__dtamSessionTimer = window.setInterval(render, 30000);
        }

        /* รีเฟรชแล้วไม่หลุด : จำ token ไว้ 2 ที่
           1) URL จริงของเว็บแอป (…/exec?page=…&t=…) ผ่าน google.script.history
              — ใน iframe ของ Apps Script window.location ไม่ใช่ URL ที่ผู้ใช้เห็น
              รีเฟรชแล้วเบราว์เซอร์จึงเรียก …/exec โดยไม่มี ?t= กลับมา
           2) หน้ากากที่ฝัง iframe อยู่ (เช่น GitHub Pages) ผ่าน postMessage
              — หน้ากากจะเก็บ token ไว้และใส่มาให้ใหม่ตอนรีเฟรช
           หมดอายุเมื่อไรก็ตรวจที่ sessionInfo() ฝั่งเซิร์ฟเวอร์เหมือนเดิม */
        function notifyHost(message) {
            try {
                if (window.top && window.top !== window.self) {
                    message.dtam = 'auth';
                    window.top.postMessage(message, '*');
                }
            } catch (e) { }
        }

        /* อ่าน query เป็น object (คงค่าเดิมอย่าง scope= / no= ไว้)
           ตัด t / page / nav ออกก่อน แล้วใส่ค่าใหม่ด้านล่าง */
        function queryParams(search) {
            var out = {};
            var query = String(search || '').replace(/^\?/, '');
            var parts = query ? query.split('&') : [];

            for (var i = 0; i < parts.length; i++) {
                if (!parts[i]) {
                    continue;
                }

                var at = parts[i].indexOf('=');
                var key = at < 0 ? parts[i] : parts[i].slice(0, at);
                var value = at < 0 ? '' : parts[i].slice(at + 1);

                try {
                    key = decodeURIComponent(key);
                    value = decodeURIComponent(value);
                } catch (e) { }

                if (key && key !== 't' && key !== 'page' && key !== 'nav') {
                    out[key] = value;
                }
            }

            return out;
        }

        function syncSession(page, search) {
            var auth = authGet() || {};
            var token = auth.token ? String(auth.token) : '';
            var next = String(page || window.__DTAM_PAGE || 'form');
            var params = queryParams(search);

            params.page = next;

            if (token) {
                params.t = token;
            }

            var gs = window.google && window.google.script;

            if (gs && gs.history && typeof gs.history.replace === 'function') {
                try {
                    gs.history.replace({}, params);
                } catch (e) { }
            }

            window.__DTAM_PAGE = next;

            notifyHost({
                type: token ? 'session' : 'logout',
                token: token,
                page: next,
                name: auth.name || '',
                exp: Number(auth.exp || 0)
            });
        }

        function authRunner() {
            return (window.google && window.google.script && window.google.script.run) || null;
        }

        function fillUserName(profile) {
            var name = (profile && profile.name) || authName();

            if (!name) {
                return;
            }

            Array.prototype.forEach.call(document.querySelectorAll('[data-user-name]'), function (el) {
                el.textContent = name;
            });
        }

        /* ตรวจ token กับเซิร์ฟเวอร์ : done(profile | null)
           โหมดตัวอย่าง (preview) ไม่มีเซิร์ฟเวอร์ → ใช้ค่าที่เก็บไว้ */
        function authVerify(done) {
            var token = authToken();
            var run = authRunner();

            if (!token) {
                done(null);
                return;
            }

            if (!run) {
                done(authGet());
                return;
            }

            try {
                run.withSuccessHandler(function (res) {
                    if (res && res.ok) {
                        authSet({ token: token, name: res.name, role: res.role, exp: res.exp });
                        done(authGet());
                    } else {
                        authSet(null);
                        syncSession('login');
                        done(null);
                    }
                }).withFailureHandler(function () {
                    done(null);
                }).sessionInfo(token);
            } catch (e) {
                done(null);
            }
        }

        /* ใช้บนหน้าที่ต้องล็อกอิน : คืน false = กำลังพาไปหน้า login */
        function requireAuth() {
            var run = authRunner();

            if (run && !authToken()) {
                goTo('?page=login');
                return false;
            }

            authVerify(function (profile) {
                if (profile) {
                    fillUserName(profile);
                } else if (run) {
                    goTo('?page=login');
                }
            });

            return true;
        }

        function signOut() {
            var token = authToken();
            var run = authRunner();

            function leave() {
                authSet(null);

                /* ตัด t= ออกจาก URL ของเอกสารนี้ (ถ้ามีค้างจากรอบก่อน)
                   ไม่งั้นสคริปต์ที่ถูกสลับเข้ามาใหม่จะหยิบ token เก่ากลับมาใช้ */
                try {
                    var here = new URL(window.location.href);

                    here.searchParams.delete('t');
                    window.history.replaceState(null, '', here.pathname + here.search + here.hash);
                } catch (e) { }

                syncSession('login');
                goTo('?page=login');
            }

            if (!run || !token) {
                leave();
                return;
            }

            try {
                run.withSuccessHandler(leave).withFailureHandler(leave).logout(token);
            } catch (e) {
                leave();
            }
        }

        /* เติมชื่อผู้ใช้ + ผูกปม "ออกจากระบบ" ในเมนูข้าง */
        function initAuthUi() {
            fillUserName(authGet());

            Array.prototype.forEach.call(document.querySelectorAll('.nav-link--logout'), function (link) {
                if (link.__dtamLogoutBound) {
                    return;
                }

                link.__dtamLogoutBound = true;

                link.addEventListener('click', function (event) {
                    event.preventDefault();
                    signOut();
                });
            });
        }

        return {
            href: href,
            goTo: goTo,
            sync: syncSession,
            auth: {
                get: authGet,
                set: authSet,
                token: authToken,
                name: authName,
                verify: authVerify,
                require: requireAuth,
                signOut: signOut
            },
            esc: esc,
            thaiDate: thaiDate,
            thaiTime: thaiTime,
            dateCell: dateCell,
            statusBadge: statusBadge,
            photoCell: photoCell,
            driveFull: driveFull,
            dialog: dialog,
            initShell: initShell,
            dateValue: dateValue,
            setDateValue: setDateValue,
            initDatePickers: initDatePickers,
            table: table
        };
    })();
