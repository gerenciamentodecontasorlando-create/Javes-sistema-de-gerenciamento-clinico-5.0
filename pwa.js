(() => {
  const pwaPill = document.getElementById("pwaPill");
  const btnInstall = document.getElementById("btnInstall");
  let deferredPrompt = null;

  function setPill(txt, ok=true){
    if(!pwaPill) return;
    pwaPill.textContent = txt;
    pwaPill.style.borderColor = ok ? "#1f2937" : "#ef4444";
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try{
        const reg = await navigator.serviceWorker.register("./sw.js");
        setPill("PWA: offline ativo ✅", true);

        reg.addEventListener("updatefound", () => {
          setPill("PWA: atualizando…", true);
        });
      }catch(e){
        setPill("PWA: offline não registrado ❌", false);
      }
    });
  } else {
    setPill("PWA: navegador não suporta SW", false);
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
    setPill("PWA: instalado ✅", true);
  });
})();
