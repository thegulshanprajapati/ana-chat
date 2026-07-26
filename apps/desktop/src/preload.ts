import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  getTheme: async () => {
    return await ipcRenderer.invoke("get-theme");
  }
});
