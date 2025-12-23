(() => {
  const pwaPill = document.getElementById("pwaPill");
  const btnInstall = document.getElementById("btnInstall");
  let deferredPrompt = null;

  function setPwa(txt){
    if(pwaPill) pwaPill.textContent = txt;
  }

  // Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try{
        const reg = await navigator.serviceWorker.register("./sw.js");
        setPwa("PWA: offline ativo ✅");

        reg.addEventListener("updatefound", () => setPwa("PWA: atualizando…"));
      }catch(e){
        setPwa("PWA: offline não registrado ❌");
      }
    });
  } else {
    setPwa("PWA: sem suporte");
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
    setPwa("PWA: instalado ✅");
  });
})();
