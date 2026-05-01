// ============================================================
// RootBeer Complete Bypass - Targets ALL remaining red checks
// Usage: frida -U -f com.scottyab.rootbeer.sample -l bypass_root.js --no-pause
// ============================================================

// ── NATIVE HOOKS (before Java.perform) ─────────────────────

// Block /proc/mounts reads (fixes "For RW Paths")
// Block su/busybox/magisk file access (fixes "Root via native check")
var SUS = [
    '/system/bin/su', '/system/xbin/su', '/sbin/su',
    '/system/bin/busybox', '/system/xbin/busybox', '/sbin/busybox',
    '/data/adb/magisk', '/sbin/.magisk', '/data/adb/modules',
    '/proc/mounts', '/proc/self/mounts'
];

function isSus(ptr) {
    try {
        var s = ptr.readCString();
        if (!s) return false;
        for (var i = 0; i < SUS.length; i++)
            if (s === SUS[i] || s.indexOf('magisk') !== -1) return true;
        return false;
    } catch (_) { return false; }
}

['open', 'openat', 'access', 'stat', 'lstat', 'fstatat'].forEach(function(name) {
    try {
        var idx = (name === 'openat' || name === 'fstatat') ? 1 : 0;
        Interceptor.attach(Module.getExportByName(null, name), {
            onEnter: function(args) {
                if (isSus(args[idx])) { this.block = true; this.p = args[idx].readCString(); }
            },
            onLeave: function(ret) {
                if (this.block) { console.log('[+] native blocked [' + name + ']: ' + this.p); ret.replace(ptr(-1)); }
            }
        });
        console.log('[✔] hooked native: ' + name);
    } catch(e) { console.log('[-] native ' + name + ': ' + e); }
});

// Hook RootBeer native export directly (fixes "Root via native check")
try {
    var exp = Module.findExportByName(null, "Java_com_scottyab_rootbeer_Utils_checkForRoot");
    if (exp) {
        Interceptor.attach(exp, {
            onLeave: function(ret) { ret.replace(0); console.log('[+] Native checkForRoot → 0'); }
        });
        console.log('[✔] Native RootBeer export hooked');
    } else {
        console.log('[!] Native export not found yet, will retry in Java.perform');
    }
} catch(e) { console.log('[-] Native export: ' + e); }

// ── JAVA HOOKS ──────────────────────────────────────────────
Java.perform(function () {

    // 1. RootBeer — hook ALL check methods
    try {
        var RB = Java.use("com.scottyab.rootbeer.RootBeer");
        [
            "isRooted", "isRootedWithoutBusyBoxCheck",
            "checkForSuBinary", "checkForBusyBoxBinaries",
            "checkSuExists", "checkForRWPaths",
            "checkForDangerousProps", "checkForRootNative",
            "detectTestKeys", "detectRootManagementApps",
            "detectPotentiallyDangerousApps", "detectRootCloakingApps",
            "checkForMagiskBinary"
        ].forEach(function(m) {
            try {
                RB[m].overload().implementation = function() {
                    console.log('[+] ' + m + '() → false'); return false;
                };
            } catch(_) {
                try {
                    RB[m].implementation = function() {
                        console.log('[+] ' + m + '() → false'); return false;
                    };
                } catch(e2) { console.log('[-] skip: ' + m); }
            }
        });
        console.log('[✔] RootBeer Java hooks installed');
    } catch(e) { console.log('[-] RootBeer: ' + e); }

    // 2. Utils.checkForRoot (native wrapper) — fixes "Root via native check"
    try {
        var Utils = Java.use("com.scottyab.rootbeer.Utils");
        Utils.checkForRoot.implementation = function(paths) {
            console.log('[+] Utils.checkForRoot() → false');
            return false;
        };
        console.log('[✔] Utils.checkForRoot hooked');
    } catch(e) { console.log('[-] Utils.checkForRoot: ' + e); }

    // 3. Build.TAGS
    try {
        Java.use("android.os.Build").TAGS.value = "release-keys";
        console.log('[✔] Build.TAGS → release-keys');
    } catch(e) { console.log('[-] Build.TAGS: ' + e); }

    // 4. File.exists() — block suspicious paths
    try {
        var File = Java.use("java.io.File");
        File.exists.implementation = function() {
            var p = this.getAbsolutePath();
            if (p.indexOf('su') !== -1 || p.indexOf('magisk') !== -1 ||
                p.indexOf('busybox') !== -1 || p.indexOf('supersu') !== -1 ||
                p.indexOf('SuperSU') !== -1 || p.indexOf('Superuser') !== -1) {
                console.log('[+] File.exists blocked: ' + p);
                return false;
            }
            return this.exists();
        };
        console.log('[✔] File.exists() hooked');
    } catch(e) { console.log('[-] File.exists: ' + e); }

    // 5. BufferedReader — intercept /proc/mounts (fixes "For RW Paths")
    try {
        var BufferedReader = Java.use("java.io.BufferedReader");
        BufferedReader.readLine.implementation = function() {
            var line = this.readLine();
            if (line !== null && (line.indexOf('/proc/mounts') !== -1 ||
                (line.indexOf(' rw,') !== -1 && (
                    line.indexOf('/system') !== -1 ||
                    line.indexOf('/data') !== -1 ||
                    line.indexOf('/vendor') !== -1)))) {
                console.log('[+] BufferedReader.readLine blocked mount line');
                return null;
            }
            return line;
        };
        console.log('[✔] BufferedReader.readLine hooked');
    } catch(e) { console.log('[-] BufferedReader: ' + e); }

    // 6. Runtime.exec — block su/which/busybox (fixes "2nd SU Binary check")
    try {
        var Runtime = Java.use("java.lang.Runtime");
        var JString  = Java.use("java.lang.String");

        function suCmd(s) {
            var t = (s || "").toLowerCase();
            return t.indexOf('/su') !== -1 || t === 'su' ||
                   t.indexOf('which') !== -1 || t.indexOf('busybox') !== -1 ||
                   t.indexOf('daemonsu') !== -1;
        }

        Runtime.exec.overload("java.lang.String").implementation = function(cmd) {
            if (suCmd(cmd)) { console.log('[+] exec blocked: ' + cmd); return this.exec(JString.$new("echo blocked")); }
            return this.exec(cmd);
        };
        Runtime.exec.overload("[Ljava.lang.String;").implementation = function(arr) {
            var js = arr ? Array.from(arr) : [];
            if (js.some(function(c){ return suCmd(c||""); })) {
                console.log('[+] exec[] blocked: ' + js.join(' '));
                return this.exec(JString.$new("echo blocked"));
            }
            return this.exec(arr);
        };
        Runtime.exec.overload("java.lang.String", "[Ljava.lang.String;").implementation = function(cmd, env) {
            if (suCmd(cmd)) { console.log('[+] exec(env) blocked: ' + cmd); return this.exec(JString.$new("echo blocked"), env); }
            return this.exec(cmd, env);
        };
        console.log('[✔] Runtime.exec() hooked');
    } catch(e) { console.log('[-] Runtime.exec: ' + e); }

    // 7. PackageManager — hide Magisk and root apps
    try {
        var PM = Java.use("android.app.ApplicationPackageManager");
        var hidden = [
            "com.topjohnwu.magisk", "com.noshufou.android.su",
            "eu.chainfire.supersu", "com.koushikdutta.superuser",
            "com.thirdparty.superuser", "com.yellowes.su",
            "de.robv.android.xposed.installer", "com.saurik.substrate",
            "com.amphoras.hidemyroot", "com.devadvance.rootcloak"
        ];
        PM.getPackageInfo.overload("java.lang.String", "int").implementation = function(pkg, flags) {
            for (var i = 0; i < hidden.length; i++) {
                if (pkg === hidden[i]) {
                    console.log('[+] PM blocked: ' + pkg);
                    throw Java.use("android.content.pm.PackageManager$NameNotFoundException").$new(pkg);
                }
            }
            return this.getPackageInfo(pkg, flags);
        };
        console.log('[✔] PackageManager hooked');
    } catch(e) { console.log('[-] PackageManager: ' + e); }

    console.log('\n[✔✔✔] All hooks active!\n');
});