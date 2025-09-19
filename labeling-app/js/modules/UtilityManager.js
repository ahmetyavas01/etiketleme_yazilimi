/**
 * Utility Manager Module
 * Handles utility functions and performance optimizations
 */
class UtilityManager {
    constructor(labelingTool) {
        this.labelingTool = labelingTool;
    }

    // Performance utility functions
    debounce(func, wait, key = 'default') {
        return (...args) => {
            const existingTimer = this.labelingTool.debounceTimers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }
            
            const timer = setTimeout(() => {
                func.apply(this.labelingTool, args);
                this.labelingTool.debounceTimers.delete(key);
            }, wait);
            
            this.labelingTool.debounceTimers.set(key, timer);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // File utility functions
    async dataURLToBlob(dataURL) {
        const response = await fetch(dataURL);
        return response.blob();
    }

    // Color utility functions
    getNextAutoColor() {
        const colors = ['#2ecc71', '#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
        const usedColors = this.labelingTool.annotations.map(ann => ann.color);
        const availableColors = colors.filter(color => !usedColors.includes(color));
        
        if (availableColors.length > 0) {
            return availableColors[0];
        }
        
        // Eğer tüm renkler kullanılmışsa, rastgele seç
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // String utility functions
    transformLabelName(label) {
        if (!label) return '';
        
        switch (this.labelingTool.labelCaseMode) {
            case 'uppercase':
                return label.toUpperCase();
            case 'lowercase':
                return label.toLowerCase();
            default:
                return label;
        }
    }

    // Validation utility functions
    isValidImageFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
        return validTypes.includes(file.type);
    }

    // DOM utility functions
    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showWarning(message) {
        this.showToast(message, 'warning');
    }

    showInfo(message) {
        this.showToast(message, 'info');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Animasyon için
        setTimeout(() => toast.classList.add('show'), 100);

        // 3 saniye sonra kaldır
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // Math utility functions
    distance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    // Date utility functions
    formatDate(date) {
        return new Date(date).toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Storage utility functions
    saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('LocalStorage kayıt hatası:', error);
            return false;
        }
    }

    loadFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('LocalStorage okuma hatası:', error);
            return null;
        }
    }
}

// Export for use in main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UtilityManager;
} else {
    window.UtilityManager = UtilityManager;
}
