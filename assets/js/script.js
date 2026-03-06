const APP = {
    CONFIG: { TOKEN_KEY: 'budgetwise_token', MOCK_MODE: true },
    state: {
        user: { name: "Student", income: 5000 },
        expenses: [],
        budgets: [],
        categories: ['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Other'],
        groups: [],
        activeGroupId: null
    },

    init: function () {
        this.loadState();
        this.bindEvents();
        this.checkAuth();
        this.setDate();
    },

    setDate: function () {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        $('#current-date').text(new Date().toLocaleDateString('en-US', options));
    },

    loadState: function () { const s = localStorage.getItem('budget_data_v4'); if (s) this.state = JSON.parse(s); },
    saveState: function () { localStorage.setItem('budget_data_v4', JSON.stringify(this.state)); },
    bindEvents: function () { $('#loginForm').submit(e => { e.preventDefault(); this.handleLogin(); }); $('#registerForm').submit(e => { e.preventDefault(); this.handleRegister(); }); },

    checkAuth: function () {
        if (localStorage.getItem(this.CONFIG.TOKEN_KEY)) this.startApp();
        else { $('#auth-wrapper').show(); $('#app-wrapper').addClass('d-none'); this.navigate('landing'); }
    },

    handleLogin: function () { localStorage.setItem(this.CONFIG.TOKEN_KEY, 'mock_token'); this.notify("Welcome!", "success"); this.startApp(); },
    handleRegister: function () { this.state.user.name = $('#regName').val(); this.saveState(); this.notify("Account Created", "success"); this.navigate('login'); },
    logout: function () { localStorage.removeItem(this.CONFIG.TOKEN_KEY); this.checkAuth(); },

    navigate: function (p) { $('.auth-page').removeClass('active'); $('#page-' + p).addClass('active'); },
    startApp: function () { $('#auth-wrapper').hide(); $('#app-wrapper').removeClass('d-none'); this.showView('dashboard'); },

    showView: function (v) {
        $('.view-section').removeClass('active'); $('#view-' + v).addClass('active');
        $('.nav-link').removeClass('active'); $(`.nav-link[data-view="${v}"]`).addClass('active');
        if (v !== 'shared') this.state.activeGroupId = null;

        const actions = {
            'dashboard': this.renderDashboard,
            'expenses': this.renderExpenses,
            'budgets': this.renderBudgets,
            'category': this.renderCategories,
            'shared': this.renderGroups,
            'reports': this.renderReports
        };
        if (actions[v]) actions[v].call(this);

        // Close mobile menu if open
        $('.offcanvas').offcanvas('hide');
    },

    // --- Dashboard ---
    renderDashboard: function () {
        const data = this.calculateFinances();
        $('#d-balance').text(`$${data.balance.toFixed(2)}`);
        $('#d-income').text(`$${data.income.toFixed(2)}`);
        $('#d-expense').text(`$${data.totalExpense.toFixed(2)}`);
        $('#d-savings').text(`${data.savingsRate}%`);
        $('#greeting').text(`Hello, ${this.state.user.name}`);
        this.renderChart();
        this.checkBudgetAlerts();
        this.generateRecommendations(data);
    },

    calculateFinances: function () {
        const inc = this.state.user.income || 0;
        const exp = this.state.expenses.reduce((s, e) => s + e.amount, 0);
        const bal = inc - exp;
        const sav = inc > 0 ? Math.max(0, ((bal / inc) * 100)).toFixed(0) : 0;
        return { income: inc, totalExpense: exp, balance: bal, savingsRate: sav };
    },

    renderChart: function () {
        const ctx = document.getElementById('mainChart');
        if (!ctx) return;
        if (window.myChart) window.myChart.destroy();
        const cats = {};
        this.state.expenses.forEach(e => cats[e.category] = (cats[e.category] || 0) + e.amount);

        window.myChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(cats),
                datasets: [{ data: Object.values(cats), backgroundColor: ['#4A90E2', '#50E3C2', '#F5A623', '#B8E986', '#9B59B6'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
        });
    },

    checkBudgetAlerts: function () {
        let html = '';
        this.state.budgets.forEach(b => {
            const spent = this.state.expenses.filter(e => e.category === b.category).reduce((s, e) => s + e.amount, 0);
            const perc = (spent / b.limit) * 100;
            if (perc >= 90) html += `<div class="alert alert-danger alert-dismissible fade show small p-2">Budget Exceeded for ${b.category}!<button class="btn-close btn-sm" data-bs-dismiss="alert"></button></div>`;
            else if (perc >= 75) html += `<div class="alert alert-warning alert-dismissible fade show small p-2">Warning: ${b.category} near limit.<button class="btn-close btn-sm" data-bs-dismiss="alert"></button></div>`;
        });
        $('#alertContainer').html(html);
    },

    generateRecommendations: function (data) {
        const list = $('#recommendationsList');
        list.empty();
        if (data.savingsRate < 20) list.append(`<p class="small text-muted"><i class="bi bi-exclamation-circle text-danger me-2"></i>Try to save more this month.</p>`);
        else list.append(`<p class="small text-muted"><i class="bi bi-check-circle text-success me-2"></i>Great savings rate!</p>`);
    },

    // --- Expenses ---
    renderExpenses: function () {
        this.populateDropdown('expCategory');
        const tbody = $('#expenseTableBody');
        tbody.empty();
        if (this.state.expenses.length === 0) { tbody.html('<tr><td colspan="5" class="text-center p-4 text-muted">No expenses</td></tr>'); return; }

        [...this.state.expenses].reverse().forEach(e => {
            tbody.append(`<tr><td><strong>${e.note || '-'}</strong></td><td><span class="badge bg-light text-dark">${e.category}</span></td><td>${e.date}</td><td class="text-end text-danger fw-bold">$${e.amount.toFixed(2)}</td><td class="text-center"><button class="btn btn-sm btn-light text-danger" onclick="APP.deleteExpense(${e.id})"><i class="bi bi-trash"></i></button></td></tr>`);
        });
    },
    saveExpense: function () {
        const payload = { id: Date.now(), amount: parseFloat($('#expAmount').val()), category: $('#expCategory').val(), date: $('#expDate').val(), note: $('#expNote').val() };
        if (!payload.amount || !payload.date) { this.notify("Invalid", "warning"); return; }
        this.state.expenses.push(payload); this.saveState(); $('#expenseModal').modal('hide'); this.renderExpenses(); this.notify("Added", "success");
    },
    deleteExpense: function (id) { this.state.expenses = this.state.expenses.filter(e => e.id !== id); this.saveState(); this.renderExpenses(); },

    // --- Budgets ---
    renderBudgets: function () {
        this.populateDropdown('budCategory');
        const container = $('#budgetList');
        container.empty();
        if (this.state.budgets.length === 0) container.html('<div class="col-12 text-center text-muted p-4">No budgets</div>');

        this.state.budgets.forEach(b => {
            const spent = this.state.expenses.filter(e => e.category === b.category).reduce((s, e) => s + e.amount, 0);
            const perc = (spent / b.limit) * 100;
            container.append(`<div class="col-md-6"><div class="card p-3 shadow-sm"><h6>${b.category}</h6><div class="progress mt-2" style="height:5px;"><div class="progress-bar ${perc > 90 ? 'bg-danger' : 'bg-primary'}" style="width:${Math.min(perc, 100)}%"></div></div><small class="text-muted mt-2 d-block">$${spent} / $${b.limit}</small></div></div>`);
        });
    },
    saveBudget: function () {
        this.state.budgets.push({ id: Date.now(), category: $('#budCategory').val(), limit: parseFloat($('#budLimit').val()) });
        this.saveState(); $('#budgetModal').modal('hide'); this.renderBudgets(); this.notify("Budget Set", "success");
    },

    // --- Categories ---
    renderCategories: function () {
        const c = $('#categoryList');
        c.empty();
        this.state.categories.forEach(cat => {
            c.append(`<div class="d-flex justify-content-between align-items-center p-2 border-bottom"><span>${cat}</span><button class="btn btn-sm btn-outline-danger rounded-circle" onclick="APP.deleteCategory('${cat}')"><i class="bi bi-x"></i></button></div>`);
        });
    },
    saveCategory: function () {
        const n = $('#catName').val().trim();
        if (n && !this.state.categories.includes(n)) { this.state.categories.push(n); this.saveState(); $('#categoryModal').modal('hide'); this.renderCategories(); }
    },
    deleteCategory: function (n) { this.state.categories = this.state.categories.filter(c => c !== n); this.saveState(); this.renderCategories(); },
    populateDropdown: function (id) { const s = $('#' + id); s.empty(); this.state.categories.forEach(c => s.append(`<option value="${c}">${c}</option>`)); },

    // --- Group Split ---
    renderGroups: function () {
        const l = $('#groupList');
        l.empty();
        if (this.state.groups.length === 0) l.html('<p class="text-muted p-3">No groups</p>');

        this.state.groups.forEach(g => {
            l.append(`<div class="group-item ${g.id === this.state.activeGroupId ? 'active' : ''}" onclick="APP.selectGroup(${g.id})"><strong>${g.name}</strong><br><small class="text-muted">${g.members.length} Members</small></div>`);
        });
    },
    selectGroup: function (id) {
        this.state.activeGroupId = id;
        this.renderGroups();
        this.renderSettlements(id);
        $('#addExpBtn').removeClass('d-none');
    },
    saveGroup: function () {
        const mem = $('#groupMembers').val().split(',').map(m => m.trim());
        this.state.groups.push({ id: Date.now(), name: $('#groupName').val(), members: mem, expenses: [] });
        this.saveState(); $('#groupModal').modal('hide'); this.renderGroups();
    },
    openGroupExpenseModal: function () {
        const g = this.state.groups.find(g => g.id === this.state.activeGroupId);
        if (!g) return;
        const s = $('#gePayer'); s.empty(); g.members.forEach(m => s.append(`<option>${m}</option>`));
        $('#groupExpenseModal').modal('show');
    },
    saveGroupExpense: function () {
        const g = this.state.groups.find(g => g.id === this.state.activeGroupId);
        g.expenses.push({ id: Date.now(), desc: $('#geDesc').val(), amount: parseFloat($('#geAmount').val()), payer: $('#gePayer').val() });
        this.saveState(); $('#groupExpenseModal').modal('hide'); this.renderSettlements(g.id);
    },
    renderSettlements: function (id) {
        const g = this.state.groups.find(g => g.id === id);
        const a = $('#settlementArea');
        if (!g.expenses.length) { a.html('<p class="text-muted">No expenses</p>'); return; }

        const bal = {};
        g.members.forEach(m => bal[m] = 0);
        g.expenses.forEach(e => {
            const share = e.amount / g.members.length;
            bal[e.payer] += e.amount;
            g.members.forEach(m => bal[m] -= share);
        });

        let html = '<h6 class="small mb-3">Settlements</h6>';
        for (const p in bal) {
            const val = bal[p];
            const cls = val > 0 ? 'text-success' : 'text-danger';
            const icon = val > 0 ? 'bi-arrow-down-circle' : 'bi-arrow-up-circle';
            if (Math.abs(val) > 0.01) html += `<div class="settlement-row"><span><i class="bi ${icon} ${cls} me-2"></i>${p}</span><strong class="${cls}">$${Math.abs(val).toFixed(2)}</strong></div>`;
        }
        a.html(html);
    },

    // --- Reports ---
    renderReports: function () {
        const data = this.calculateFinances();
        const score = Math.min(100, 50 + (data.savingsRate * 0.5));
        $('#financialScore').text(Math.round(score));
        $('#reportDetails').html(`<p class="small">You saved <strong>${data.savingsRate}%</strong> of your income.</p>`);
    },

    toggleTheme: function () { $('body').toggleClass('dark-mode'); },
    notify: function (m, t) { const e = $(`<div class="alert alert-${t} shadow-sm">${m}</div>`); $('#global-alert-box').html(e); setTimeout(() => e.fadeOut(), 2000); }
};

$(document).ready(() => APP.init());