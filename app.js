/* ==========================================================================
   Elven Scroll — логика приложения
   ========================================================================== */

/* ---------------------------------------------------------------------
   Переключение подписей элементов с data-office / data-elven
   --------------------------------------------------------------------- */
function applyThemeLabels(theme) {
    document.querySelectorAll('[data-office][data-elven]').forEach((el) => {
        el.textContent = theme === 'elven' ? el.getAttribute('data-elven') : el.getAttribute('data-office');
    });
}

/* ---------------------------------------------------------------------
   Тосты (замена window.alert)
   --------------------------------------------------------------------- */
function showToast(message, type = 'info') {
    const stack = document.getElementById('toast-stack');
    const toast = document.createElement('div');
    toast.className = 'toast' + (type === 'error' ? ' toast--error' : '');
    toast.textContent = message;
    stack.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast--leaving');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3200);
}

/* ---------------------------------------------------------------------
   Модальное окно ввода ключа (замена window.prompt)
   --------------------------------------------------------------------- */
function askForKey(subtitle) {
    const overlay = document.getElementById('modal-overlay');
    const input = document.getElementById('modal-input');
    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn = document.getElementById('modal-cancel');
    const subtitleEl = document.getElementById('modal-subtitle');

    subtitleEl.textContent = subtitle;
    input.value = '';
    overlay.hidden = false;
    requestAnimationFrame(() => input.focus());

    return new Promise((resolve) => {
        function cleanup(value) {
            overlay.hidden = true;
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKeydown);
            resolve(value);
        }
        function onConfirm() { cleanup(input.value || null); }
        function onCancel() { cleanup(null); }
        function onKeydown(e) {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
        }
        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKeydown);
    });
}

/* ---------------------------------------------------------------------
   Переключение тем: "печать ломается" — круговой переход от кнопки
   печати, с дрейфующими искрами при входе в эльфийский мир.
   --------------------------------------------------------------------- */
const toggleBtn = document.getElementById('toggle-theme');
const sealWipe = document.getElementById('seal-wipe');
const emberField = document.getElementById('ember-field');

function themeBgColor(theme) {
    return theme === 'elven' ? '#120d07' : '#eef0f4';
}

function runEmbers(durationMs) {
    const canvas = emberField;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.classList.add('is-active');

    const particles = Array.from({ length: 42 }, () => ({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 100,
        r: 1 + Math.random() * 2.2,
        speed: 0.4 + Math.random() * 1.1,
        drift: (Math.random() - 0.5) * 0.6,
        life: Math.random() * 1,
    }));

    const start = performance.now();
    function frame(now) {
        const elapsed = now - start;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p) => {
            p.y -= p.speed;
            p.x += p.drift;
            const flicker = 0.5 + 0.5 * Math.sin((now / 220) + p.y);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(226, 166, 75, ${0.55 * flicker})`;
            ctx.fill();
        });
        if (elapsed < durationMs) {
            requestAnimationFrame(frame);
        } else {
            canvas.classList.remove('is-active');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    requestAnimationFrame(frame);
}

toggleBtn.addEventListener('click', (e) => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'office' ? 'elven' : 'office';

    const rect = toggleBtn.getBoundingClientRect();
    const x = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
    const y = ((rect.top + rect.height / 2) / window.innerHeight) * 100;

    sealWipe.style.setProperty('--wipe-x', x + '%');
    sealWipe.style.setProperty('--wipe-y', y + '%');
    sealWipe.style.setProperty('--wipe-color', themeBgColor(newTheme));

    sealWipe.classList.remove('is-active');
    // force reflow so the animation can restart
    void sealWipe.offsetWidth;
    sealWipe.classList.add('is-active');

    setTimeout(() => {
        document.documentElement.setAttribute('data-theme', newTheme);
        applyThemeLabels(newTheme);
        updateThemeStatus();
    }, 260);

    if (newTheme === 'elven') {
        runEmbers(2200);
    }

    setTimeout(() => sealWipe.classList.remove('is-active'), 720);
});

/* ---------------------------------------------------------------------
   Форматирование текста
   --------------------------------------------------------------------- */
function format(command) {
    document.execCommand(command, false, null);
    document.getElementById('editor').focus();
}

/* ---------------------------------------------------------------------
   Счётчик слов и статус документа
   --------------------------------------------------------------------- */
const editorEl = document.getElementById('editor');
const wordCountEl = document.getElementById('word-count');

function updateWordCount() {
    const text = editorEl.innerText.trim();
    const count = text ? text.split(/\s+/).length : 0;
    const theme = document.documentElement.getAttribute('data-theme');
    const label = count === 1 ? 'слово' : (count >= 2 && count <= 4 ? 'слова' : 'слов');
    wordCountEl.textContent = theme === 'elven' ? `${count} ${label} записано` : `${count} ${label}`;
}

function updateThemeStatus() {
    const el = document.getElementById('theme-status');
    const theme = document.documentElement.getAttribute('data-theme');
    el.textContent = theme === 'elven' ? el.getAttribute('data-elven') : el.getAttribute('data-office');
}

editorEl.addEventListener('input', updateWordCount);

/* ---------------------------------------------------------------------
   Криптография: генерация ключа из пароля (PBKDF2 -> AES-GCM)
   --------------------------------------------------------------------- */
async function getKey(password) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc.encode("elven-salt-12345"), // Статичная соль для простоты
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

/* ---------------------------------------------------------------------
   Сохранение (шифрование) документа
   --------------------------------------------------------------------- */
document.getElementById('btn-save').addEventListener('click', async () => {
    const htmlContent = editorEl.innerHTML;
    if (!htmlContent.trim()) return showToast("Документ пуст — нечего запечатывать.", "error");

    const password = await askForKey("Этот ключ понадобится, чтобы развернуть свиток снова.");
    if (!password) return;

    try {
        const enc = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Вектор инициализации
        const key = await getKey(password);

        // Шифруем HTML код разметки
        const encrypted = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            enc.encode(htmlContent)
        );

        // Объединяем IV и зашифрованные данные вместе
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        // Переводим в строку Base64
        const base64String = btoa(String.fromCharCode(...combined));

        const elvenFileContent = `---BEGIN ELVEN SCROLL---\n${base64String}\n---END ELVEN SCROLL---`;

        const blob = new Blob([elvenFileContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "scroll.elven";
        a.click();
        URL.revokeObjectURL(url);

        showToast("Свиток запечатан и сохранён.");
    } catch (e) {
        showToast("Ошибка при шифровании: " + e.message, "error");
    }
});

/* ---------------------------------------------------------------------
   Загрузка (расшифровка) документа
   --------------------------------------------------------------------- */
const fileInput = document.getElementById('file-input');
document.getElementById('btn-load-trigger').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const content = event.target.result;

        if (!content.includes('---BEGIN ELVEN SCROLL---')) {
            return showToast("Это не формат .elven.", "error");
        }

        const password = await askForKey("Введите ключ, которым был запечатан этот свиток.");
        if (!password) return;

        try {
            const base64String = content
                .replace('---BEGIN ELVEN SCROLL---', '')
                .replace('---END ELVEN SCROLL---', '')
                .trim();

            const binarySign = atob(base64String);
            const combined = new Uint8Array(binarySign.length);
            for (let i = 0; i < binarySign.length; i++) {
                combined[i] = binarySign.charCodeAt(i);
            }

            const iv = combined.slice(0, 12);
            const encryptedData = combined.slice(12);

            const key = await getKey(password);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                encryptedData
            );

            const dec = new TextDecoder();
            const resultHTML = dec.decode(decrypted);

            editorEl.innerHTML = resultHTML;
            updateWordCount();
            showToast("Свиток развёрнут.");

        } catch (error) {
            showToast("Файл повреждён или ключ неверен.", "error");
        }
    };
    reader.readAsText(file);
    fileInput.value = "";
});

/* ---------------------------------------------------------------------
   Экспорт в PDF со встроенным шрифтом Tengwar Annatar
   --------------------------------------------------------------------- */
document.getElementById('btn-pdf').addEventListener('click', async () => {
    const textContent = editorEl.innerText;

    if (!textContent.trim()) {
        return showToast("Редактор пуст — нечего переносить на свиток.", "error");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    // === Строка Base64 шрифта Tengwar Annatar ===
    const TENGWAR_BASE64 = "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";

    try {
        doc.addFileToVFS("TengwarAnnatar.ttf", TENGWAR_BASE64);
        doc.addFont("TengwarAnnatar.ttf", "Tengwar", "normal");
        doc.setFont("Tengwar");
    } catch (e) {
        console.error("Ошибка добавления шрифта:", e);
        return showToast("Не удалось загрузить эльфийский шрифт для PDF.", "error");
    }

    // === Оформление пергамента ===
    doc.setFillColor(236, 220, 180); // #ecdcb4
    doc.rect(0, 0, 210, 297, "F");

    doc.setDrawColor(74, 59, 34); // #4a3b22
    doc.setLineWidth(0.5);
    doc.rect(8, 8, 194, 281);
    doc.rect(10, 10, 190, 277);

    doc.setTextColor(30, 24, 12);
    doc.setFontSize(16);

    const splitText = doc.splitTextToSize(textContent, 170);
    doc.text(splitText, 20, 25);

    doc.save("elven_scroll.pdf");
    showToast("Свиток экспортирован в PDF.");
});

/* ---------------------------------------------------------------------
   Инициализация
   --------------------------------------------------------------------- */
applyThemeLabels(document.documentElement.getAttribute('data-theme'));
updateThemeStatus();
updateWordCount();
