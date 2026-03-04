// ================================
// 🔒 CRYPTOTRADE PRO - JAVASCRIPT
// ================================

// 🌀 LOADING SCREEN CONTROLLER
const LoadingScreen = {
    initialized: false,
    _msgInterval: null,
    _tipInterval: null,
    _fallbackTimeout: null,
    messages: [
        "Menghubungkan ke pasar...",
        "Memuat data harga real-time...",
        "Menyiapkan chart interaktif...",
        "Memverifikasi keamanan...",
        "Hampir siap! 🚀"
    ],

    init() {
        if (this.initialized) return;
        this.initialized = true;

        const loader = document.getElementById('app-loader');
        if (!loader) {
            console.warn('⚠️ Loader not found, creating fallback...');
            this.createFallbackLoader();
        }

        this.show();
        this.animateProgress();
        this.rotateMessages();

        // Fallback timeout 8 detik
        this._fallbackTimeout = setTimeout(() => {
            console.warn('⏰ Loading timeout, forcing hide...');
            this.hide(true);
        }, 800);
    },

    createFallbackLoader() {
        const loader = document.createElement('div');
        loader.id = 'app-loader';
        loader.className = 'loader-overlay';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="loader-logo">
                    <span class="loader-icon">₿</span>
                    <div class="loader-ring"></div>
                </div>
                <h2 class="loader-title">CryptoTrade Pro</h2>
                <p class="loader-text" id="loader-message">Loading...</p>
                <div class="loader-progress">
                    <div class="loader-progress-bar" id="loader-progress-fill"></div>
                </div>
                <div class="loader-dots">
                    <span></span><span></span><span></span>
                </div>
                <p class="loader-tip" id="loader-tip">💡 Loading...</p>
            </div>
        `;
        document.body.appendChild(loader);
    },

    show() {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.classList.remove('hidden');
            loader.style.display = 'flex';
            loader.style.opacity = '1';
            loader.style.visibility = 'visible';
        }
    },

    hide(force = false) {
        if (this._fallbackTimeout) {
            clearTimeout(this._fallbackTimeout);
            this._fallbackTimeout = null;
        }

        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.classList.add('hidden');
            loader.style.opacity = '0';
            loader.style.visibility = 'hidden';
            loader.style.pointerEvents = 'none';

            setTimeout(() => {
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                    console.log('🧹 Loader removed from DOM');
                }
            }, 400);
        }
    },

    animateProgress() {
        const progressBar = document.getElementById('loader-progress-fill');
        if (!progressBar) return;

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 12 + 3;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
            }
            progressBar.style.width = progress + '%';
        }, 180);
    },

    rotateMessages() {
        const msgEl = document.getElementById('loader-message');
        const tipEl = document.getElementById('loader-tip');
        if (!msgEl || !tipEl) return;

        let msgIndex = 0, tipIndex = 0;

        this._msgInterval = setInterval(() => {
            msgIndex = (msgIndex + 1) % this.messages.length;
            msgEl.style.opacity = '0';
            setTimeout(() => {
                msgEl.innerText = this.messages[msgIndex];
                msgEl.style.opacity = '1';
            }, 150);
        }, 1200);

        setTimeout(() => {
            const tips = [
                "💡 Scroll mouse untuk zoom chart",
                "💡 Drag untuk navigasi waktu",
                "💡 Tekan + / - untuk zoom cepat",
                "💡 Data tersimpan otomatis",
                "💡 Switch produk untuk multi-trading"
            ];
            this._tipInterval = setInterval(() => {
                tipIndex = (tipIndex + 1) % tips.length;
                tipEl.style.opacity = '0';
                setTimeout(() => {
                    tipEl.innerText = tips[tipIndex];
                    tipEl.style.opacity = '1';
                }, 200);
            }, 3500);
        }, 1500);
    },

    cleanup() {
        if (this._msgInterval) clearInterval(this._msgInterval);
        if (this._tipInterval) clearInterval(this._tipInterval);
        if (this._fallbackTimeout) clearTimeout(this._fallbackTimeout);
        this._msgInterval = this._tipInterval = this._fallbackTimeout = null;
        this.initialized = false;
    }
};

// === GLOBAL VARIABLES ===
let chartInterval, catchUpInterval, productUpdateInterval;
let currentPrice = 45230.50, position = null, candles = [];
let selectedProduct = 'BTC', productPrices = {}, isChartRunning = false;

const PRODUCTS = {
    BTC: { symbol: 'BTC', name: 'Bitcoin', icon: '₿', basePrice: 45230.50, volatility: 150, color: '#f7931a' },
    ETH: { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', basePrice: 2456.80, volatility: 40, color: '#627eea' },
    SOL: { symbol: 'SOL', name: 'Solana', icon: '◎', basePrice: 98.45, volatility: 3, color: '#14f195' },
    XRP: { symbol: 'XRP', name: 'Ripple', icon: '✕', basePrice: 0.52, volatility: 0.015, color: '#23292f' },
    DOGE: { symbol: 'DOGE', name: 'Dogecoin', icon: 'Ð', basePrice: 0.08, volatility: 0.003, color: '#c2a633' }
};

const CONFIG = {
    UPDATE_INTERVAL: 1000,
    CATCHUP_SPEED: 1000,
    MAX_CATCHUP_CANDLES: 10,
    MAX_PRICE_CHANGE_PERCENT: 0.5
};

let zoomLevel = 1, panOffsetX = 0, isDragging = false, lastMouseX = 0;
let minZoom = 0.5, maxZoom = 4;
const CANDLE_WIDTH_MULTIPLIER = 0.8;

// === INIT FUNCTION ===
window.addEventListener("load", () => {
    console.log('🔥 App loading started...');

    // Init loading screen
    LoadingScreen.init();

    // Check required elements
    const requiredIds = [
        'auth-section', 'product-section', 'dashboard-section',
        'product-list', 'live-price', 'tradingChart'
    ];

    requiredIds.forEach(id => {
        const el = document.getElementById(id);
        console.log(`${el ? '✅' : '❌'} #${id}:`, el);
    });

    // Smart ready check
    let retryCount = 0;
    const maxRetries = 100;

    const checkReady = () => {
        retryCount++;

        const critical = ['auth-section', 'product-section', 'dashboard-section'];
        const allCriticalReady = critical.every(id => document.getElementById(id) !== null);

        if (allCriticalReady || retryCount >= maxRetries) {
            if (retryCount >= maxRetries) {
                console.warn('⚠️ Max retries reached, proceeding anyway...');
            }

            console.log('✅ DOM ready, initializing app...');

            try {
                initializeProductPrices();
                hideAllSections();

                setTimeout(() => {
                    console.log('🎬 Hiding loading screen...');
                    LoadingScreen.hide();
                    LoadingScreen.cleanup();

                    const currentUser = localStorage.getItem("currentUser");
                    if (currentUser) {
                        console.log('👤 User logged in, showing products...');
                        showProductSelection();
                    } else {
                        console.log('🔐 No user, showing auth...');
                        showAuthSection();
                    }
                }, 300);

            } catch (error) {
                console.error('💥 Error during init:', error);
                LoadingScreen.hide(true);
                showAuthSection();
            }
        } else {
            setTimeout(checkReady, 50);
        }
    };

    checkReady();
});

// === CORE FUNCTIONS ===
function initializeProductPrices() {
    Object.values(PRODUCTS).forEach(p => {
        if (!productPrices[p.symbol]) {
            const savedPrice = localStorage.getItem(`chartCurrentPrice_${p.symbol}`);
            if (savedPrice) {
                const parsedPrice = parseFloat(savedPrice);
                const expectedRange = p.basePrice * 0.5;
                if (Math.abs(parsedPrice - p.basePrice) < expectedRange) {
                    productPrices[p.symbol] = parsedPrice;
                } else {
                    productPrices[p.symbol] = p.basePrice;
                    console.warn(`⚠️ Price ${parsedPrice} invalid for ${p.symbol}, using basePrice`);
                }
            } else {
                productPrices[p.symbol] = p.basePrice;
            }
        }
    });
    console.log('📊 productPrices initialized:', productPrices);
}

function hideAllSections() {
    ['auth-section', 'product-section', 'dashboard-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });
}

function showAuthSection() {
    const authSection = document.getElementById('auth-section');
    if (authSection) {
        authSection.classList.remove('hidden');
        authSection.style.display = 'block';
    }
}

// === USER MANAGEMENT ===
function getUsers() {
    return JSON.parse(localStorage.getItem("users")) || [];
}

function saveUsers(users) {
    localStorage.setItem("users", JSON.stringify(users));
}

function getCurrentUser() {
    const email = localStorage.getItem("currentUser");
    if (!email) return null;
    const users = getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

function updateBalance(newBalance) {
    const email = localStorage.getItem("currentUser");
    let users = getUsers();
    const index = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (index === -1) return false;
    users[index].balance = newBalance;
    saveUsers(users);
    return true;
}

function addNewUser(userData) {
    userData.createdAt = Date.now();
    let users = getUsers();
    users.push(userData);
    saveUsers(users);
    return true;
}

// === AUTHENTICATION ===
function toggleAuth(type) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (type === 'register') {
        loginForm?.classList.add('hidden');
        registerForm?.classList.remove('hidden');
    } else {
        registerForm?.classList.add('hidden');
        loginForm?.classList.remove('hidden');
    }
}

function handleRegister(event) {
    event.preventDefault();
    const nameInput = document.querySelector("#register-form input[type='text']");
    const emailInput = document.querySelector("#register-form input[type='email']");
    const passwordInput = document.querySelector("#register-form input[type='password']");

    const name = nameInput?.value.trim();
    const email = emailInput?.value.trim().toLowerCase();
    const password = passwordInput?.value;

    if (!name || name.length < 2) {
        showNotification("Nama minimal 2 karakter!", "error");
        nameInput?.focus();
        return;
    }
    if (!isValidEmail(email)) {
        showNotification("Format email tidak valid!", "error");
        emailInput?.focus();
        return;
    }
    if (password.length < 6) {
        showNotification("Password minimal 6 karakter!", "error");
        passwordInput?.focus();
        return;
    }

    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email)) {
        showNotification("Email sudah terdaftar!", "error");
        return;
    }

    addNewUser({
        name,
        email,
        password: btoa(password),
        balance: 10000,
        createdAt: Date.now()
    });

    showNotification("Registrasi berhasil! Silakan login.", "success");
    toggleAuth("login");
    event.target.reset();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function handleLogin(event) {
    event.preventDefault();
    const emailInput = document.querySelector("#login-form input[type='email']");
    const passwordInput = document.querySelector("#login-form input[type='password']");
    const email = emailInput?.value.trim().toLowerCase();
    const password = passwordInput?.value;

    if (!email || !password) {
        showNotification("Isi semua field!", "error");
        return;
    }

    const users = getUsers();
    const hashedPassword = btoa(password);
    const user = users.find(u => u.email.toLowerCase() === email && u.password === hashedPassword);

    if (!user) {
        const fallbackUser = users.find(u => u.email.toLowerCase() === email && u.password === password);
        if (fallbackUser) {
            fallbackUser.password = hashedPassword;
            saveUsers(users);
            localStorage.setItem("currentUser", email);
            showNotification(`Selamat datang, ${fallbackUser.name}!`, "success");
            showProductSelection();
            return;
        }
        showNotification("Email atau password salah!", "error");
        return;
    }

    localStorage.setItem("currentUser", email);
    showNotification(`Selamat datang, ${user.name}!`, "success");
    showProductSelection();
    event.target.reset();
}

// === NOTIFICATIONS ===
function showNotification(message, type = "info") {
    const existing = document.getElementById('notification-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'notification-toast';
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span style="margin-right: 0.5rem; font-size: 1.2rem;">
            ${getTypeIcon(type)}
        </span>
        <span>${message}</span>
    `;

    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: '#1e293b',
        borderLeft: `4px solid ${getTypeColor(type)}`,
        padding: '1rem 1.5rem',
        borderRadius: '8px',
        color: '#fff',
        fontWeight: '500',
        transform: 'translateX(120%)',
        transition: 'transform 0.3s ease',
        zIndex: 9999,
        minWidth: '280px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
    });

    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getTypeIcon(type) {
    return { success: '✅', error: '❌', info: 'ℹ️' }[type] || '📢';
}

function getTypeColor(type) {
    return { success: '#10b981', error: '#ef4444', info: '#3b82f6' }[type] || '#3b82f6';
}

// === DASHBOARD NAVIGATION ===
function showProductSelection() {
    const user = getCurrentUser();
    if (!user) {
        showAuthSection();
        return;
    }

    hideAllSections();

    const productSection = document.getElementById('product-section');
    if (productSection) {
        productSection.classList.remove('hidden');
        productSection.style.display = 'block';
        renderProductList();
        startProductPriceUpdates();
    }

    const balanceEl = document.getElementById("balance");
    if (balanceEl) balanceEl.innerText = user.balance.toFixed(2);

    const greetingEl = document.getElementById("user-greeting");
    if (greetingEl && user.name) greetingEl.innerText = `Halo, ${user.name}!`;
}

function renderProductList() {
    const productList = document.getElementById('product-list');
    if (!productList) return;

    productList.innerHTML = '';

    Object.values(PRODUCTS).forEach(product => {
        const currentPrice = productPrices[product.symbol] ?? product.basePrice;
        const change = ((currentPrice - product.basePrice) / product.basePrice * 100).toFixed(2);
        const isPositive = change >= 0;

        const card = document.createElement('div');
        card.className = `product-card ${selectedProduct === product.symbol ? 'active' : ''}`;
        card.dataset.symbol = product.symbol;

        card.innerHTML = `
            <div style="font-size: 2rem; margin-bottom: 0.5rem; color: ${product.color}">
                ${product.icon}
            </div>
            <div style="font-weight: 600; margin-bottom: 0.25rem;">${product.name}</div>
            <div style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 0.5rem;">
                ${product.symbol}/USDT
            </div>
            <div style="color: #fff; font-weight: 700; font-size: 1.1rem; margin-bottom: 0.25rem;">
                $${formatPrice(currentPrice)}
            </div>
            <div style="color: ${isPositive ? '#10b981' : '#ef4444'}; font-size: 0.9rem; font-weight: 600;">
                ${isPositive ? '▲' : '▼'} ${Math.abs(change)}%
            </div>
        `;

        card.addEventListener('click', () => selectProduct(product.symbol));
        productList.appendChild(card);
    });
}

function formatPrice(price) {
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(3);
    return price.toFixed(5);
}

function selectProduct(symbol) {
    if (!PRODUCTS[symbol]) {
        console.error(`❌ Product ${symbol} not found!`);
        return;
    }

    console.log(`🔄 SELECTING PRODUCT: ${symbol}`);

    stopChart();
    isChartRunning = false;

    selectedProduct = symbol;
    position = null;
    candles = [];

    const product = PRODUCTS[symbol];

    if (productPrices[symbol]) {
        currentPrice = productPrices[symbol];
    } else {
        currentPrice = product.basePrice;
        productPrices[symbol] = currentPrice;
    }

    document.querySelectorAll('.product-card').forEach(card => {
        card.classList.toggle('active', card.dataset.symbol === symbol);
    });

    generateInitialCandlesForProduct(symbol);
    showTradingDashboard();

    const priceEl = document.getElementById('live-price');
    const symbolEl = document.getElementById('product-symbol');
    const orderSymbolEl = document.getElementById('order-symbol');

    if (priceEl) {
        priceEl.innerText = '$' + formatPrice(currentPrice);
        priceEl.style.color = '#10b981';
    }
    if (symbolEl) symbolEl.innerText = `${symbol}/USDT`;
    if (orderSymbolEl) orderSymbolEl.innerText = symbol;

    setTimeout(() => {
        startChart();
        console.log(`✅ CHART STARTED for ${symbol} @ $${currentPrice}`);
    }, 100);

    showNotification(`Trading ${product.name} (${symbol})`, 'info');
}

function showTradingDashboard() {
    const productSection = document.getElementById('product-section');
    const dashboardSection = document.getElementById('dashboard-section');

    if (productSection) {
        productSection.classList.add('hidden');
        productSection.style.display = 'none';
    }

    if (dashboardSection) {
        dashboardSection.classList.remove('hidden');
        dashboardSection.style.display = 'flex';
    }

    document.querySelectorAll('[id^="back-to-products"]').forEach(btn => {
        if (btn && btn.id !== 'back-to-products') btn.classList.remove('hidden');
    });
}

function handleBackToProducts() {
    const productSection = document.getElementById('product-section');
    const dashboardSection = document.getElementById('dashboard-section');

    if (dashboardSection) {
        dashboardSection.classList.add('hidden');
        dashboardSection.style.display = 'none';
    }

    if (productSection) {
        productSection.classList.remove('hidden');
        productSection.style.display = 'block';
        renderProductList();
    }

    document.querySelectorAll('[id^="back-to-products"]').forEach(btn => {
        if (btn && btn.id !== 'back-to-products') btn.classList.add('hidden');
    });

    stopChart();
    showNotification('Kembali ke daftar produk', 'info');
}

function logout() {
    if (!confirm("Yakin ingin keluar?")) return;
    localStorage.removeItem("currentUser");
    stopChart();
    stopProductPriceUpdates();
    showAuthSection();
    showNotification("Keluar berhasil!", "success");
}

// === PRODUCT PRICE UPDATES ===
function startProductPriceUpdates() {
    Object.values(PRODUCTS).forEach(p => {
        if (!productPrices[p.symbol]) {
            productPrices[p.symbol] = p.basePrice;
        }
    });

    if (productUpdateInterval) clearInterval(productUpdateInterval);

    productUpdateInterval = setInterval(() => {
        Object.values(PRODUCTS).forEach(product => {
            const maxChange = product.basePrice * (CONFIG.MAX_PRICE_CHANGE_PERCENT / 100);
            const change = (Math.random() - 0.5) * Math.min(product.volatility, maxChange);
            productPrices[product.symbol] = Math.max(0.0001, productPrices[product.symbol] + change);
        });

        const productSection = document.getElementById('product-section');
        if (productSection && !productSection.classList.contains('hidden')) {
            renderProductList();
        }
    }, 2000);
}

function stopProductPriceUpdates() {
    if (productUpdateInterval) {
        clearInterval(productUpdateInterval);
        productUpdateInterval = null;
    }
}

// === TRADING FUNCTIONS ===
function calculateTotal() {
    const amountInput = document.getElementById('amount');
    const totalInput = document.getElementById('total');
    if (!amountInput || !totalInput) return;

    const amount = parseFloat(amountInput.value);
    totalInput.value = amount > 0 ? (amount * currentPrice).toFixed(2) : '';
}

function depositBalance() {
    const depositInput = document.getElementById('deposit-amount');
    const balanceDisplay = document.getElementById('balance');
    if (!depositInput || !balanceDisplay) return;

    const amount = parseFloat(depositInput.value);
    if (isNaN(amount) || amount <= 0) {
        showNotification("Masukkan jumlah deposit yang valid!", "error");
        return;
    }

    let user = getCurrentUser();
    if (!user) return;

    let newBalance = user.balance + amount;
    updateBalance(newBalance);
    balanceDisplay.innerText = newBalance.toFixed(2);
    depositInput.value = "";
    showNotification("Deposit berhasil!", "success");
}

function executeTrade(type) {
    const amountInput = document.getElementById('amount');
    const balanceDisplay = document.getElementById('balance');
    if (!amountInput || !balanceDisplay) return;

    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
        showNotification("Masukkan jumlah yang valid!", "error");
        return;
    }

    let balance = parseFloat(balanceDisplay.innerText);
    const totalCost = amount * currentPrice;
    const product = PRODUCTS[selectedProduct];
    const symbol = product?.symbol || 'BTC';

    if (type === 'Buy') {
        if (position) {
            showNotification("Sudah ada posisi terbuka!", "error");
            return;
        }
        if (balance < totalCost) {
            showNotification("Saldo tidak cukup!", "error");
            return;
        }
        balance -= totalCost;
        position = { amount, entryPrice: currentPrice, openedAt: Date.now() };
        balanceDisplay.innerText = balance.toFixed(2);
        updateBalance(balance);
        showNotification(`BUY ${amount} ${symbol} di $${formatPrice(currentPrice)}`, "success");
    } else if (type === 'Sell') {
        if (!position) {
            showNotification("Tidak ada posisi untuk dijual!", "error");
            return;
        }
        const profitLoss = (currentPrice - position.entryPrice) * position.amount;
        balance += position.amount * currentPrice;
        balanceDisplay.innerText = balance.toFixed(2);
        updateBalance(balance);
        position = null;
        const status = profitLoss >= 0 ? "Profit" : "Loss";
        showNotification(`SELL ${status}: $${profitLoss.toFixed(2)}`, profitLoss >= 0 ? "success" : "error");
    }
}

// === ZOOM CONTROLS ===
function zoomIn() {
    if (zoomLevel < maxZoom) {
        zoomLevel = Math.min(zoomLevel * 1.25, maxZoom);
        resetPan();
        drawChart();
        updateZoomIndicator();
    }
}

function zoomOut() {
    if (zoomLevel > minZoom) {
        zoomLevel = Math.max(zoomLevel / 1.25, minZoom);
        resetPan();
        drawChart();
        updateZoomIndicator();
    }
}

function resetZoom() {
    zoomLevel = 1;
    resetPan();
    drawChart();
    updateZoomIndicator();
}

function resetPan() {
    panOffsetX = 0;
}

function updateZoomIndicator() {
    const indicator = document.getElementById('zoom-indicator');
    if (indicator) {
        const percentage = (zoomLevel - minZoom) / (maxZoom - minZoom) * 100;
        indicator.innerHTML = `
            <div class="zoom-bar">
                <div class="zoom-fill" style="width: ${percentage}%"></div>
            </div>
            <span>${Math.round(zoomLevel * 100)}%</span>
        `;
    }
}

// === CHART LOGIC ===
const canvas = document.getElementById('tradingChart');
const ctx = canvas?.getContext('2d');

function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
    }
    drawChart();
}

window.addEventListener('resize', resizeCanvas);

function drawChart() {
    if (!ctx || !canvas) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(panOffsetX, 0);
    ctx.scale(zoomLevel, 1);

    // Grid
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < canvas.width / zoomLevel; i += 50 / zoomLevel) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
    }
    for (let i = 0; i < canvas.height; i += 50) {
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width / zoomLevel, i);
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(panOffsetX, 0);
    ctx.scale(zoomLevel, 1);

    if (candles.length === 0) {
        ctx.restore();
        return;
    }

    const visibleCandles = getVisibleCandles();
    const allPrices = visibleCandles.flatMap(c => [c.high, c.low]);
    const maxPrice = Math.max(...allPrices);
    const minPrice = Math.min(...allPrices);
    const range = maxPrice - minPrice || 1;

    const step = (canvas.width / zoomLevel) / visibleCandles.length;
    const candleWidth = step * CANDLE_WIDTH_MULTIPLIER;

    visibleCandles.forEach((candle, index) => {
        const x = index * step + step / 2;
        const openY = canvas.height - ((candle.open - minPrice) / range) * (canvas.height - 40) - 20;
        const closeY = canvas.height - ((candle.close - minPrice) / range) * (canvas.height - 40) - 20;
        const highY = canvas.height - ((candle.high - minPrice) / range) * (canvas.height - 40) - 20;
        const lowY = canvas.height - ((candle.low - minPrice) / range) * (canvas.height - 40) - 20;
        const isUp = candle.close >= candle.open;

        if (index === visibleCandles.length - 1) {
            ctx.shadowColor = isUp ? '#10b981' : '#ef4444';
            ctx.shadowBlur = 15;
        }

        ctx.strokeStyle = isUp ? '#10b981' : '#ef4444';
        ctx.fillStyle = isUp ? '#10b981' : '#ef4444';

        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.abs(openY - closeY);
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight < 2 ? 2 : bodyHeight);

        ctx.shadowBlur = 0;
    });

    drawPriceLines(minPrice, maxPrice, range);
    ctx.restore();
}

function getVisibleCandles() {
    if (zoomLevel === 1) return candles;
    const visibleRange = 25;
    return candles.slice(Math.max(0, candles.length - visibleRange));
}

function drawPriceLines(minPrice, maxPrice, range) {
    if (candles.length === 0 || !ctx) return;

    const currentY = canvas.height - ((currentPrice - minPrice) / range) * (canvas.height - 40) - 20;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5 / zoomLevel;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, currentY);
    ctx.lineTo(canvas.width / zoomLevel, currentY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (position) {
        const entryY = canvas.height - ((position.entryPrice - minPrice) / range) * (canvas.height - 40) - 20;
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5 / zoomLevel;
        ctx.setLineDash([5, 2]);
        ctx.beginPath();
        ctx.moveTo(0, entryY);
        ctx.lineTo(canvas.width / zoomLevel, entryY);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function saveChartState(symbol) {
    localStorage.setItem(`chartCandles_${symbol}`, JSON.stringify(candles));
    localStorage.setItem(`chartCurrentPrice_${symbol}`, currentPrice);
    localStorage.setItem(`chartZoomLevel_${symbol}`, zoomLevel);
    localStorage.setItem(`chartPanOffset_${symbol}`, panOffsetX);
    localStorage.setItem(`lastUpdateTime_${symbol}`, Date.now());
}

function loadChartState(symbol) {
    const product = PRODUCTS[symbol];
    if (!product) {
        console.error(`❌ Product ${symbol} not found in loadChartState`);
        generateInitialCandlesForProduct('BTC');
        return;
    }

    const savedCandles = localStorage.getItem(`chartCandles_${symbol}`);
    const savedPrice = localStorage.getItem(`chartCurrentPrice_${symbol}`);
    const savedZoom = localStorage.getItem(`chartZoomLevel_${symbol}`);
    const savedPan = localStorage.getItem(`chartPanOffset_${symbol}`);

    if (savedCandles && savedPrice) {
        const parsedPrice = parseFloat(savedPrice);
        const expectedRange = product.basePrice * 0.5;

        if (Math.abs(parsedPrice - product.basePrice) < expectedRange) {
            console.log(`📂 Loading saved data for ${symbol} @ $${parsedPrice}`);
            candles = JSON.parse(savedCandles);
            currentPrice = parsedPrice;
            productPrices[symbol] = currentPrice;
        } else {
            console.warn(`⚠️ Saved price $${parsedPrice} invalid for ${symbol}, regenerating`);
            generateInitialCandlesForProduct(symbol);
        }
    } else {
        console.log(`🆕 No saved data for ${symbol}, generating fresh`);
        generateInitialCandlesForProduct(symbol);
    }

    if (savedZoom) zoomLevel = parseFloat(savedZoom);
    if (savedPan) panOffsetX = parseFloat(savedPan);
}

function generateInitialCandlesForProduct(symbol) {
    candles = [];
    const product = PRODUCTS[symbol];
    if (!product) {
        console.error(`❌ Product ${symbol} not found in generateInitialCandlesForProduct`);
        return;
    }

    let basePrice = productPrices[symbol] ?? product.basePrice;

    console.log(`🕯️ Generating 50 candles for ${symbol} starting at $${basePrice}`);

    for (let i = 0; i < 50; i++) {
        const open = basePrice;
        const maxChange = product.basePrice * (CONFIG.MAX_PRICE_CHANGE_PERCENT / 100);
        const change = (Math.random() - 0.5) * Math.min(product.volatility, maxChange);
        const close = Math.max(0.0001, open + change);
        const high = Math.max(open, close) + Math.random() * product.volatility * 0.25;
        const low = Math.min(open, close) - Math.random() * product.volatility * 0.25;

        candles.push({ open, high, low, close });
        basePrice = close;
    }

    currentPrice = basePrice;
    productPrices[symbol] = currentPrice;

    console.log(`✅ Generated candles, final price: $${currentPrice}`);
}

function updatePrice() {
    if (!isChartRunning || !PRODUCTS[selectedProduct]) {
        console.warn('⚠️ updatePrice skipped - chart not running or invalid product');
        return;
    }

    const product = PRODUCTS[selectedProduct];
    const open = currentPrice;

    const maxChange = product.basePrice * (CONFIG.MAX_PRICE_CHANGE_PERCENT / 100);
    const change = (Math.random() - 0.5) * Math.min(product.volatility, maxChange);
    let close = Math.max(0.0001, open + change);

    const high = Math.max(open, close) + Math.random() * product.volatility * 0.25;
    const low = Math.min(open, close) - Math.random() * product.volatility * 0.25;

    currentPrice = close;
    productPrices[selectedProduct] = currentPrice;

    const priceEl = document.getElementById('live-price');
    if (priceEl) {
        priceEl.innerText = '$' + formatPrice(currentPrice);
        priceEl.style.color = close >= open ? '#10b981' : '#ef4444';
    }

    const candleNumEl = document.getElementById('candle-number');
    if (candleNumEl) candleNumEl.innerText = candles.length;

    candles.push({ open, high, low, close });
    if (candles.length > 100) candles.shift();

    drawChart();
    saveChartState(selectedProduct);
}

function catchUpCandles() {
    const lastTime = parseInt(localStorage.getItem(`lastUpdateTime_${selectedProduct}`));
    if (!lastTime) return;

    const product = PRODUCTS[selectedProduct];
    if (!product) return;

    const now = Date.now();
    const diffSeconds = Math.floor((now - lastTime) / 1000);
    const maxCatchUp = Math.min(diffSeconds, CONFIG.MAX_CATCHUP_CANDLES);
    if (maxCatchUp <= 0) return;

    let count = 0;
    catchUpInterval = setInterval(() => {
        if (!isChartRunning) {
            clearInterval(catchUpInterval);
            return;
        }

        const open = currentPrice;
        const maxChange = product.basePrice * (CONFIG.MAX_PRICE_CHANGE_PERCENT / 100);
        const change = (Math.random() - 0.5) * Math.min(product.volatility, maxChange);
        const close = Math.max(0.0001, open + change);
        const high = Math.max(open, close) + Math.random() * product.volatility * 0.25;
        const low = Math.min(open, close) - Math.random() * product.volatility * 0.25;

        currentPrice = close;
        candles.push({ open, high, low, close });
        if (candles.length > 100) candles.shift();
        drawChart();

        count++;
        if (count >= maxCatchUp) {
            clearInterval(catchUpInterval);
            catchUpInterval = null;
        }
    }, CONFIG.CATCHUP_SPEED);
}

function startChart() {
    console.log(`🚀 startChart() called for selectedProduct: ${selectedProduct}`);

    if (!selectedProduct || !PRODUCTS[selectedProduct]) {
        console.error(`❌ Invalid selectedProduct: ${selectedProduct}, defaulting to BTC`);
        selectedProduct = 'BTC';
    }

    resizeCanvas();
    loadChartState(selectedProduct);

    isChartRunning = true;
    catchUpCandles();
    drawChart();
    updateZoomIndicator();

    if (chartInterval) clearInterval(chartInterval);
    chartInterval = setInterval(updatePrice, CONFIG.UPDATE_INTERVAL);

    console.log(`✅ Chart running: ${selectedProduct} @ $${currentPrice}`);
}

function stopChart() {
    isChartRunning = false;
    if (chartInterval) {
        clearInterval(chartInterval);
        chartInterval = null;
    }
    if (catchUpInterval) {
        clearInterval(catchUpInterval);
        catchUpInterval = null;
    }
    console.log('🛑 Chart stopped');
}

// === MOUSE & TOUCH EVENTS ===
if (canvas) {
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else zoomOut();
    }, { passive: false });

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isDragging = true;
            lastMouseX = e.clientX;
            canvas.style.cursor = 'grabbing';
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            panOffsetX -= (e.clientX - lastMouseX);
            lastMouseX = e.clientX;
            drawChart();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'default';
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
        canvas.style.cursor = 'default';
    });

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            lastMouseX = e.touches[0].clientX;
        }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            panOffsetX -= (e.touches[0].clientX - lastMouseX);
            lastMouseX = e.touches[0].clientX;
            drawChart();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        isDragging = false;
    });
}

// === DOMContentLoaded ===
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);

    document.querySelectorAll('[data-toggle]').forEach(btn => {
        btn.addEventListener('click', () => toggleAuth(btn.dataset.toggle));
    });

    const depositBtn = document.getElementById('deposit-btn');
    if (depositBtn) depositBtn.addEventListener('click', depositBalance);

    const buyBtn = document.getElementById('buy-btn');
    const sellBtn = document.getElementById('sell-btn');
    if (buyBtn) buyBtn.addEventListener('click', () => executeTrade('Buy'));
    if (sellBtn) sellBtn.addEventListener('click', () => executeTrade('Sell'));

    const amountInput = document.getElementById('amount');
    if (amountInput) amountInput.addEventListener('input', calculateTotal);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    const backButtons = [
        document.getElementById('back-to-products'),
        document.getElementById('back-to-products-nav'),
        document.getElementById('back-to-products-float')
    ].filter(btn => btn !== null);

    backButtons.forEach(btn => btn.addEventListener('click', handleBackToProducts));

    document.addEventListener('keydown', (e) => {
        if (e.key === '+' || e.key === '=') zoomIn();
        else if (e.key === '-') zoomOut();
        else if (e.key === '0') resetZoom();
        else if (e.key === 'Escape') {
            const dashboard = document.getElementById('dashboard-section');
            if (dashboard && !dashboard.classList.contains('hidden')) handleBackToProducts();
        }
    });
});

// ✅ RESET FUNCTION
function clearCorruptChartData() {
    console.log('🗑️ Clearing all chart data from localStorage...');
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('chart')) {
            localStorage.removeItem(key);
        }
    });
    console.log('✅ Done! Refresh page to regenerate fresh data.');
}