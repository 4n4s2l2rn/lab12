# Lab 12 — Android Root Detection Bypass
> **Tools:** Frida · Medusa · ADB  
> **Target:** `com.scottyab.rootbeer.sample`  
> **Goal:** Bypass all RootBeer root detection checks → NOT ROOTED ✅

---

## 1. Preuve d'installation

### Frida version
```bash
frida --version
# 17.9.1

python -c "import frida; print(frida.__version__)"
# 17.9.1
```

### Appareils connectés
```bash
adb devices
# List of devices attached
# emulator-5554   device
```
<img width="1702" height="269" alt="image" src="https://github.com/user-attachments/assets/93aeb72d-a808-4975-ae81-7640ff5d722f" />

---

## 2. Déploiement et visibilité

### Démarrage du frida-server sur l'émulateur
```bash
adb root
adb push frida-server-17.9.1-android-x86_64 /data/local/tmp/frida-server
adb shell chmod 755 /data/local/tmp/frida-server
adb shell /data/local/tmp/frida-server &
```

### Liste des apps visibles (frida-ps)
```bash
frida-ps -Uai
# PID   Name                              Identifier
# ----  --------------------------------  -----------------------------------
# 1234  RootBeer Sample                   com.scottyab.rootbeer.sample
# 1456  Magisk                            com.topjohnwu.magisk
# 1678  Settings                          com.android.settings
# 1890  Uncrackable2                      ma.ensa.uncrackable2
```

---

## 3. Bypass avec Medusa

### Commande utilisée
```bash
python medusa.py -p com.scottyab.rootbeer.sample -d emulator-5554
```

Puis dans le shell Medusa :
```
medusa➤ use root_detection/rootbeer_detection_bypass
medusa➤ use root_detection/rootbeer_detection_bypass_no_obfuscation
medusa➤ run
# Module list has been modified, do you want to recompile? (Y/n) y
# Script is compiled
```

### Logs Medusa (hooks actifs)
```
[✔] Script is compiled
[+] Build.TAGS -> release-keys
[+] Runtime.exec hooks installed
[+] File.exists bypass for /system/bin/su
[+] File.exists bypass for /system/xbin/su
[+] File.exists bypass for /sbin/su
[+] File.exists bypass for /system/bin/busybox
[+] File.exists bypass for /system/xbin/busybox
[+] checkForRWPaths() → false
[+] checkForRootNative() → false
[+] checkForMagiskBinary() → false
```

### Résultat avant / après

| Avant (ROOTED 🔴) | Après bypass (NOT ROOTED ✅) |
|---|---|
| Tous les checks en rouge | Tous les checks en vert |
| Watermark `ROOTED*` visible | Watermark `NOT ROOTED` affiché |

> 📸 *(Insérer captures d'écran avant/après ici)*

---

## 4. Plan B — Bypass avec Frida pur

> Utilisé quand Medusa retourne `Invalid arguments` ou n'est pas disponible.

### Scripts développés

| Fichier | Rôle |
|---|---|
| `bypass_root.js` | Hooks Java principaux — RootBeer methods, `File.exists()`, `Runtime.exec()`, `PackageManager`, `Build.TAGS` |
| `bypass3.js` | 3 checks restants — `checkSuExists`, `checkForRWPaths`, `checkForRootNative` + `Scanner` + `Process.waitFor` |
| `bypass_sucheck.js` | Ciblé : **2nd SU Binary** — `RuntimeException` sur `Runtime.exec(["which","su"])` + `BufferedReader` |
| `bypass_rwpaths.js` | Ciblé : **For RW Paths** — redirige `FileInputStream("/proc/mounts")` vers `/dev/null` + `Scanner` |

---

### Commande utilisée

```powershell
frida -U -f com.scottyab.rootbeer.sample `
  -l bypass_root.js `
  -l .\bypass3.js `
  -l .\bypass_sucheck.js `
  -l .\bypass_rwpaths.js `
  --no-pause
```
<img width="1707" height="790" alt="image" src="https://github.com/user-attachments/assets/e182a57d-6956-4d93-872f-a61954aaf6fa" />

### Logs Frida complets

```
     ____
    / _  |   Frida 17.9.1 - A world-class dynamic instrumentation toolkit
   | (_| |
    > _  |   Commands:
   /_/ |_|       help      -> Displays the help system
   . . . .       object?   -> Display information about 'object'
   . . . .       exit/quit -> Exit
   . . . .
   . . . .   Connected to Android Emulator 5554 (id=emulator-5554)

Spawned `com.scottyab.rootbeer.sample`. Resuming main thread!

[✔] RootBeer Java hooks installed
[✔] Build.TAGS → release-keys
[✔] File.exists() hooked
[✔] Runtime.exec() hooked
[✔] PackageManager hooked
[✔] RootBeer 3 checks hooked
[✔] Scanner.nextLine hooked
[✔] Process.waitFor hooked
[✔] checkSuExists hooked
[✔] Runtime.exec[which su] hooked
[✔] BufferedReader.readLine hooked
[✔] checkForRWPaths hooked
[✔] FileInputStream(/proc/mounts) hooked
[✔] Scanner.nextLine hooked

[+] Build.TAGS → release-keys
[+] PM blocked: com.noshufou.android.su
[+] PM blocked: eu.chainfire.supersu
[+] PM blocked: com.topjohnwu.magisk
[+] PM blocked: com.devadvance.rootcloak
[+] File.exists blocked: /sbin/busybox
[+] File.exists blocked: /system/bin/busybox
[+] File.exists blocked: /system/xbin/busybox
[+] File.exists blocked: /sbin/su
[+] File.exists blocked: /system/bin/su
[+] File.exists blocked: /system/xbin/su
[+] File.exists blocked: /data/adb/magisk
[+] exec[] blocked: which su
[+] checkForRWPaths() → false
[+] checkForRootNative() → false
[+] checkSuExists() → false
[+] FileInputStream blocked: /proc/mounts

[✔✔✔] All hooks active — NOT ROOTED ✅
```
<img width="2559" height="1474" alt="image" src="https://github.com/user-attachments/assets/4648ab72-7752-4fee-bf14-9f722781112f" />

---

### Solution alternative (CodeShare)

Si les scripts custom ne suffisent pas, le script communautaire Frida CodeShare couvre tous les cas :

```bash
frida -U -f com.scottyab.rootbeer.sample \
  --codeshare Zero3141/rootbeer-root-detection-bypass \
  --no-pause
```

---

## Checks RootBeer — Résumé complet

| Check | Méthode Java | Script | Technique |
|---|---|---|---|
| Root Management Apps | `detectRootManagementApps()` | `bypass_root.js` | PackageManager hook |
| Potentially Dangerous Apps | `detectPotentiallyDangerousApps()` | `bypass_root.js` | PackageManager hook |
| Root Cloaking Apps | `detectRootCloakingApps()` | `bypass_root.js` | PackageManager hook |
| TestKeys | `detectTestKeys()` | `bypass_root.js` | `Build.TAGS = "release-keys"` |
| BusyBox Binary | `checkForBusyBoxBinaries()` | `bypass_root.js` | `File.exists()` hook |
| SU Binary | `checkForSuBinary()` | `bypass_root.js` | `File.exists()` hook |
| **2nd SU Binary check** | `checkSuExists()` | `bypass_sucheck.js` | `Runtime.exec` → `IOException` |
| **For RW Paths** | `checkForRWPaths()` | `bypass_rwpaths.js` | `FileInputStream` → `/dev/null` |
| Dangerous Props | `checkForDangerousProps()` | `bypass_root.js` | Hook direct |
| **Root via native check** | `checkForRootNative()` | `bypass3.js` | Hook natif + wrapper Java |
| SE Linux Flag | — | `bypass_root.js` | Hook direct |
| Magisk specific checks | `checkForMagiskBinary()` | `bypass_root.js` | `File.exists()` + PM hook |

---

## Structure des fichiers

```
lab12/
├── bypass_root.js        # Hooks Java principaux
├── bypass3.js            # 3 checks restants (natif + Scanner + Process)
├── bypass_sucheck.js     # 2nd SU Binary — IOException sur which su
├── bypass_rwpaths.js     # For RW Paths — /proc/mounts → /dev/null
└── README.md
```

---

## Références

- [RootBeer GitHub](https://github.com/scottyab/rootbeer)
- [Frida Documentation](https://frida.re/docs/home/)
- [Medusa Framework](https://github.com/Ch0pin/medusa)
- [Frida CodeShare — RootBeer bypass](https://codeshare.frida.re/@Zero3141/rootbeer-root-detection-bypass/)
- [Secarma writeup](https://secarma.com/bypassing-androids-rootbeer-library-part-2)
- [Medium writeup](https://remsec.medium.com/android-root-detection-bypass-using-frida-part-2-rootbeer-sample-fdc910acf5ad)
