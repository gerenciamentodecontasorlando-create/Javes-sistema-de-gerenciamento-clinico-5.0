(() => {
  const pill = document.getElementById("pwaPill");
  const btnInstall = document.getElementById("btnInstall");
  let deferredPrompt = null;

  function set(txt, ok=true){
    if(!pill) return;
    pill.textContent = txt;
    pill.style.borderColor = ok ? "#1f2937" : "rgba(248,113,113,.65)";
  }

  // Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try{
        const reg = await navigator.serviceWorker.register("./sw.js");
        set("PWA: offline ativo ✅", true);

        reg.addEventListener("updatefound", () => {
          set("PWA: atualizando…", true);
        });

        // se houver novo SW, atualiza quando possível
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          set("PWA: atualizado ✅", true);
        });
      }catch(e){
        set("PWA: offline não registrado ❌", false);
      }
    });
  } else {
    set("PWA: navegador não suporta", false);
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
    set("PWA: instalado ✅", true);
  });
})();
