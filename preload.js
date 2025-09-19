const { contextBridge, ipcRenderer } = require('electron');

// Electron API'sini güvenli bir şekilde renderer process'e expose et
contextBridge.exposeInMainWorld('electronAPI', {
    // Klasör seçimi
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    
    // Etiketleme uygulamasını aç
    openLabelingApp: () => ipcRenderer.invoke('open-labeling-app'),
    
    // Dashboard'ı aç
    openDashboard: () => ipcRenderer.invoke('open-dashboard'),
    
    // Server durumunu kontrol et
    getServerStatus: () => ipcRenderer.invoke('get-server-status'),
    
    // External link açma
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    
    // Backend başlatma
    startBackend: () => ipcRenderer.invoke('start-backend')
});
