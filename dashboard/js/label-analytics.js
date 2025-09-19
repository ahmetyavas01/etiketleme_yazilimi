class LabelAnalytics {
    constructor() {
        this.baseURL = 'http://' + window.location.hostname + ':3000/api';
        this.auth = auth;
        this.charts = {};
        this.currentData = null;
        this.projects = [];
        
        this.init();
    }

    async init() {
        await this.loadProjects();
        this.setupEventListeners();
        await this.loadLabelAnalytics();
    }

    async loadProjects() {
        try {
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/projects`);
            if (response.ok) {
                this.projects = await response.json();
                this.populateProjectSelector();
            }
        } catch (error) {
            console.error('Projeler yüklenirken hata:', error);
        }
    }

    populateProjectSelector() {
        const selector = document.getElementById('projectSelector');
        if (!selector) return;

        // Mevcut seçenekleri temizle (ilk seçenek hariç)
        while (selector.children.length > 1) {
            selector.removeChild(selector.lastChild);
        }

        // Projeleri ekle
        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            selector.appendChild(option);
        });
    }

    setupEventListeners() {
        // Yenile butonu
        const refreshBtn = document.getElementById('refreshLabelAnalytics');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadLabelAnalytics();
            });
        }

        // Proje seçici
        const projectSelector = document.getElementById('projectSelector');
        if (projectSelector) {
            projectSelector.addEventListener('change', (e) => {
                const projectId = e.target.value;
                if (projectId) {
                    this.loadProjectAnalytics(projectId);
                } else {
                    this.loadLabelAnalytics();
                }
            });
        }
    }

    async loadLabelAnalytics() {
        try {
            this.showLoading();
            
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/analytics/labels`);
            if (!response.ok) {
                throw new Error('Etiket analizi yüklenemedi');
            }

            const result = await response.json();
            this.currentData = result.data;
            
            this.updateSummaryStats();
            this.createCharts();
            this.populateLabelDetails();
            
            this.hideLoading();
        } catch (error) {
            console.error('Etiket analizi yüklenirken hata:', error);
            this.showError('Etiket analizi yüklenirken hata oluştu: ' + error.message);
        }
    }

    async loadProjectAnalytics(projectId) {
        try {
            this.showLoading();
            
            const response = await this.auth.authenticatedRequest(`${this.baseURL}/analytics/projects/${projectId}/labels`);
            if (!response.ok) {
                throw new Error('Proje etiket analizi yüklenemedi');
            }

            const result = await response.json();
            this.currentData = result.data;
            
            this.updateSummaryStats();
            this.createCharts();
            this.populateLabelDetails();
            
            this.hideLoading();
        } catch (error) {
            console.error('Proje etiket analizi yüklenirken hata:', error);
            this.showError('Proje etiket analizi yüklenirken hata oluştu: ' + error.message);
        }
    }

    updateSummaryStats() {
        if (!this.currentData) return;

        const { totalAnnotations, labelStats, summary } = this.currentData;

        // Özet istatistikleri güncelle
        document.getElementById('totalLabels').textContent = totalAnnotations || 0;
        document.getElementById('uniqueLabels').textContent = summary.uniqueLabels || 0;
        document.getElementById('mostUsedLabel').textContent = summary.mostUsedLabel?.label || '-';
        document.getElementById('leastUsedLabel').textContent = summary.leastUsedLabel?.label || '-';
    }

    createCharts() {
        if (!this.currentData || !this.currentData.labelStats) return;

        this.createPieChart();
        this.createBarChart();
    }

    createPieChart() {
        const ctx = document.getElementById('labelPieChart');
        if (!ctx) return;

        // Mevcut grafiği güvenli şekilde temizle
        if (this.charts.pieChart && typeof this.charts.pieChart.destroy === 'function') {
            try {
                this.charts.pieChart.destroy();
                this.charts.pieChart = null;
            } catch (error) {
                console.warn('Pie chart destroy error:', error);
            }
        }

        const { labelStats } = this.currentData;
        const topLabels = labelStats.slice(0, 10); // En çok kullanılan 10 etiket

        const colors = this.generateColors(topLabels.length);

        this.charts.pieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: topLabels.map(item => item.label),
                datasets: [{
                    data: topLabels.map(item => item.count),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    createBarChart() {
        const ctx = document.getElementById('labelBarChart');
        if (!ctx) return;

        // Mevcut grafiği güvenli şekilde temizle
        if (this.charts.barChart && typeof this.charts.barChart.destroy === 'function') {
            try {
                this.charts.barChart.destroy();
                this.charts.barChart = null;
            } catch (error) {
                console.warn('Bar chart destroy error:', error);
            }
        }

        const { labelStats } = this.currentData;
        const topLabels = labelStats.slice(0, 15); // En çok kullanılan 15 etiket

        this.charts.barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topLabels.map(item => item.label),
                datasets: [{
                    label: 'Kullanım Sayısı',
                    data: topLabels.map(item => item.count),
                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                const percentage = context.parsed.y / context.dataset.data.reduce((a, b) => a + b, 0) * 100;
                                return `Yüzde: ${percentage.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        });
    }

    populateLabelDetails() {
        const tbody = document.getElementById('labelDetailsBody');
        if (!tbody || !this.currentData) return;

        tbody.innerHTML = '';

        const { labelStats, projectLabelStats } = this.currentData;

        labelStats.forEach(labelStat => {
            const row = document.createElement('tr');
            
            // Proje dağılımını bul
            const projectDistribution = this.getProjectDistribution(labelStat.label, projectLabelStats);
            
            row.innerHTML = `
                <td class="label-name">${labelStat.label}</td>
                <td class="label-count">${labelStat.count}</td>
                <td class="label-percentage">${labelStat.percentage}%</td>
                <td class="project-distribution">${projectDistribution}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    getProjectDistribution(labelName, projectLabelStats) {
        const distributions = [];
        
        projectLabelStats.forEach(project => {
            const labelInProject = project.labels.find(l => l.label === labelName);
            if (labelInProject) {
                distributions.push(`${project.projectName}: ${labelInProject.count}`);
            }
        });
        
        return distributions.length > 0 ? distributions.join(', ') : '-';
    }

    generateColors(count) {
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
            '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
        ];
        
        const result = [];
        for (let i = 0; i < count; i++) {
            result.push(colors[i % colors.length]);
        }
        return result;
    }

    showLoading() {
        const containers = document.querySelectorAll('.chart-container, .project-chart-container');
        containers.forEach(container => {
            container.innerHTML = '<div class="loading">Yükleniyor...</div>';
        });
    }

    hideLoading() {
        // Loading mesajları grafik oluşturulduğunda otomatik olarak kaldırılır
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const tabContent = document.getElementById('labelAnalyticsTab');
        if (tabContent) {
            const existingError = tabContent.querySelector('.error-message');
            if (existingError) {
                existingError.remove();
            }
            tabContent.insertBefore(errorDiv, tabContent.firstChild);
        }
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        
        const tabContent = document.getElementById('labelAnalyticsTab');
        if (tabContent) {
            const existingSuccess = tabContent.querySelector('.success-message');
            if (existingSuccess) {
                existingSuccess.remove();
            }
            tabContent.insertBefore(successDiv, tabContent.firstChild);
        }
    }
}

// Dashboard yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', () => {
    // Sadece label analytics sekmesi aktif olduğunda başlat
    const labelAnalyticsTab = document.getElementById('labelAnalyticsTab');
    if (labelAnalyticsTab) {
        window.labelAnalytics = new LabelAnalytics();
    }
});
