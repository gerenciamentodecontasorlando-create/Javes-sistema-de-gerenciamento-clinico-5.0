(() => {
  const pill = document.getElementById("pwaPill");
  const btnInstall = document.getElementById("btnInstall");
  let deferredPrompt = null;

  function setPill(txt, ok=true){
    if(!pill) return;
    pill.textContent = txt;
    pill.style.borderColor = ok ? "rgba(25,226,140,.6)" : "rgba(248,113,113,.7)";
    pill.style.color = ok ? "#a7f3d0" : "#fecaca";
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try{
        const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
        setPill("PWA: offline ativo ✅", true);

        reg.addEventListener("updatefound", () => {
          setPill("PWA: atualizando…", true);
        });
      }catch(e){
        setPill("PWA: offline não registrado ❌", false);
      }
    });
  } else {
    setPill("PWA: navegador sem SW", false);
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
