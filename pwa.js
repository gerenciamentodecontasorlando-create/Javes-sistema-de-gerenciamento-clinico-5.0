(() => {
  const statusEl = document.getElementById("pwaStatus");
  const btnInstall = document.getElementById("btnInstall");
  let deferredPrompt = null;

  function setStatus(txt){
    if(statusEl) statusEl.textContent = txt;
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try{
        const reg = await navigator.serviceWorker.register("./sw.js");
        setStatus("PWA: offline ativo ✅");

        reg.addEventListener("updatefound", () => {
          setStatus("PWA: atualizando…");
        });
      }catch(e){
        setStatus("PWA: offline não registrado ❌");
      }
    });
  } else {
    setStatus("PWA: navegador não suporta SW");
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if(btnInstall){
      btnInstall.style.display = "inline-flex";
      btnInstall.onclick = async () => {
        try{
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
        } finally {
          deferredPrompt = null;
          btnInstall.style.display = "none";
        }
      };
    }
  });

  window.addEventListener("appinstalled", () => {
    if(btnInstall) btnInstall.style.display = "none";
    setStatus("PWA: instalado ✅");
  });
})();
