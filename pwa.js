(() => {
  const statusEl = document.getElementById("pwaStatus");
  const btnInstall = document.getElementById("btnInstall");
  let deferredPrompt = null;

  const setStatus = (txt)=>{ if(statusEl) statusEl.textContent = txt; };

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try{
        await navigator.serviceWorker.register("./sw.js");
        setStatus("PWA: offline ativo ✅");
      }catch{
        setStatus("PWA: offline não registrado ❌");
      }
    });
  } else {
    setStatus("PWA: sem suporte a SW");
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if(btnInstall){
      btnInstall.style.display = "inline-flex";
      btnInstall.onclick = async () => {
        try{ deferredPrompt.prompt(); await deferredPrompt.userChoice; }
        finally{ deferredPrompt=null; btnInstall.style.display="none"; }
      };
    }
  });

  window.addEventListener("appinstalled", () => {
    if(btnInstall) btnInstall.style.display = "none";
    setStatus("PWA: instalado ✅");
  });
})();
