(() => {
  const statusEl = document.getElementById("pwaStatus");
  const btnInstall = document.getElementById("btnInstall");
  let deferredPrompt = null;

  function setStatus(txt, ok=true){
    if(!statusEl) return;
    statusEl.textContent = txt;
    statusEl.classList.toggle("ok", !!ok);
    statusEl.classList.toggle("bad", !ok);
  }

  // Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try{
        const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
        setStatus("PWA: offline ativo ✅", true);

        reg.addEventListener("updatefound", () => {
          setStatus("PWA: atualizando…", true);
        });

      }catch(e){
        console.error(e);
        setStatus("PWA: offline não registrado ❌", false);
      }
    });
  } else {
    setStatus("PWA: navegador não suporta SW", false);
  }

  // Install prompt
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
    setStatus("PWA: instalado ✅", true);
  });
})();
