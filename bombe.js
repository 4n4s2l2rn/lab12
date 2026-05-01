// ============================================================
// RootBeer FINAL Bypass — Single script, no conflicts
// Usage: frida -U -f com.scottyab.rootbeer.sample -l rootbeer_bypass_final.js --no-pause
// ============================================================

Java.perform(function () {

    // ── 1. Hook ALL RootBeer check methods ───────────────────
    try {
        var RB = Java.use("com.scottyab.rootbeer.RootBeer");
        [
            "isRooted",
            "isRootedWithoutBusyBoxCheck",
            "detectRootManagementApps",
            "detectPotentiallyDangerousApps",
            "detectRootCloakingApps",
            "detectTestKeys",
            "checkForSuBinary",
            "checkForBusyBoxBinaries",
            "checkSuExists",
            "checkForRWPaths",
            "checkForDangerousProps",
            "checkForRootNative",
            "checkForMagiskBinary"
        ].forEach(function(m) {
            try {
                RB[m].overload().implementation = function() {
                    console.log("[+] " + m + "() → false");
                    return false;
                };
            } catch(_) {
                try {
                    RB[m].implementation = function() {
                        console.log("[+] " + m + "() → false");
                        return false;
                    };
                } catch(e) { console.log("[-] " + m + ": " + e); }
            }
        });
        console.log("[✔] All RootBeer methods hooked");
    } catch(e) { console.log("[-] RootBeer: " + e); }

    // ── 2. Build.TAGS ─────────────────────────────────────────
    try {
        Java.use("android.os.Build").TAGS.value = "release-keys";
        console.log("[✔] Build.TAGS → release-keys");
    } catch(e) {}

    // ── 3. File.exists() ──────────────────────────────────────
    try {
        var File = Java.use("java.io.File");
        File.exists.implementation = function() {
            var p = this.getAbsolutePath();
            if (p.indexOf("su")      !== -1 ||
                p.indexOf("magisk")  !== -1 ||
                p.indexOf("busybox") !== -1 ||
                p.indexOf("supersu") !== -1) {
                console.log("[+] File.exists blocked: " + p);
                return false;
            }
            return this.exists();
        };
        console.log("[✔] File.exists hooked");
    } catch(e) { console.log("[-] File.exists: " + e); }

    // ── 4. Runtime.exec — throw for su/which commands ─────────
    // checkSuExists catches IOException and returns false
    try {
        var Runtime  = Java.use("java.lang.Runtime");
        var IOException = Java.use("java.io.IOException");

        function isSuCmd(s) {
            var t = (s || "").toLowerCase();
            return t === "su" || t.indexOf("which") !== -1 ||
                   t.indexOf("/su") !== -1 || t.indexOf("daemonsu") !== -1;
        }

        Runtime.exec.overload("java.lang.String").implementation = function(cmd) {
            if (isSuCmd(cmd)) {
                console.log("[+] exec blocked (throw): " + cmd);
                throw IOException.$new("blocked");
            }
            return this.exec(cmd);
        };

        Runtime.exec.overload("[Ljava.lang.String;").implementation = function(arr) {
            var js = arr ? Array.from(arr) : [];
            if (js.some(function(c){ return isSuCmd(c||""); })) {
                console.log("[+] exec[] blocked (throw): " + js.join(" "));
                throw IOException.$new("blocked");
            }
            return this.exec(arr);
        };

        Runtime.exec.overload("java.lang.String", "[Ljava.lang.String;").implementation = function(cmd, env) {
            if (isSuCmd(cmd)) {
                console.log("[+] exec(env) blocked (throw): " + cmd);
                throw IOException.$new("blocked");
            }
            return this.exec(cmd, env);
        };

        console.log("[✔] Runtime.exec hooked");
    } catch(e) { console.log("[-] Runtime.exec: " + e); }

    // ── 5. Scanner — hide /proc/mounts rw lines ───────────────
    try {
        var Scanner = Java.use("java.util.Scanner");
        Scanner.nextLine.implementation = function() {
            var line = this.nextLine();
            if (line && line.indexOf(" rw") !== -1 && (
                line.indexOf("/system") !== -1 ||
                line.indexOf("/vendor") !== -1 ||
                line.indexOf("/data")   !== -1 ||
                line.indexOf("/sbin")   !== -1)) {
                console.log("[+] Scanner blocked rw mount");
                return "";
            }
            return line;
        };
        console.log("[✔] Scanner.nextLine hooked");
    } catch(e) { console.log("[-] Scanner: " + e); }

    // ── 6. PackageManager — hide root apps ────────────────────
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
                    console.log("[+] PM blocked: " + pkg);
                    throw Java.use("android.content.pm.PackageManager$NameNotFoundException").$new(pkg);
                }
            }
            return this.getPackageInfo(pkg, flags);
        };
        console.log("[✔] PackageManager hooked");
    } catch(e) { console.log("[-] PackageManager: " + e); }

    console.log("\n[✔✔✔] All hooks active!\n");
});