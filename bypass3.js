// ============================================================
// RootBeer — Fix 3 remaining red checks
// checkSuExists / checkForRWPaths / checkForRootNative
// Usage: frida -U -f com.scottyab.rootbeer.sample -l bypass_3checks.js --no-pause
// ============================================================

Java.perform(function () {

    // Hook runs on class load — covers background thread timing
    Java.use("java.lang.Thread").start.implementation = function () {
        this.start();
        Java.perform(patchRootBeer);
    };

    patchRootBeer();
});

function patchRootBeer() {
    // ── 1. Hook RootBeer methods directly with overload() ────
    try {
        var RB = Java.use("com.scottyab.rootbeer.RootBeer");

        // 2nd SU Binary check
        RB.checkSuExists.overload().implementation = function () {
            console.log("[+] checkSuExists() → false");
            return false;
        };

        // For RW Paths
        RB.checkForRWPaths.overload().implementation = function () {
            console.log("[+] checkForRWPaths() → false");
            return false;
        };

        // Root via native check
        RB.checkForRootNative.overload().implementation = function () {
            console.log("[+] checkForRootNative() → false");
            return false;
        };

        console.log("[✔] RootBeer 3 checks hooked");
    } catch (e) {
        console.log("[-] RootBeer hook: " + e);
    }

    // ── 2. Hook Utils in correct package (util.Utils) ────────
    try {
        var Utils = Java.use("com.scottyab.rootbeer.util.Utils");
        Utils.checkForRoot.implementation = function (paths) {
            console.log("[+] util.Utils.checkForRoot() → false");
            return false;
        };
        console.log("[✔] util.Utils.checkForRoot hooked");
    } catch (e) {
        // Try alternate package
        try {
            var Utils2 = Java.use("com.scottyab.rootbeer.Utils");
            Utils2.checkForRoot.implementation = function (paths) {
                console.log("[+] Utils.checkForRoot() → false");
                return false;
            };
            console.log("[✔] Utils.checkForRoot hooked (alt package)");
        } catch (e2) {
            console.log("[-] Utils: " + e2);
        }
    }

    // ── 3. Scanner hook — intercepts /proc/mounts reading ────
    // RootBeer uses Scanner to read /proc/mounts for RW paths
    try {
        var Scanner = Java.use("java.util.Scanner");
        Scanner.nextLine.implementation = function () {
            var line = this.nextLine();
            if (line && line.indexOf(" rw") !== -1 && (
                line.indexOf("/system") !== -1 ||
                line.indexOf("/vendor") !== -1 ||
                line.indexOf("/data")   !== -1 ||
                line.indexOf("/sbin")   !== -1)) {
                console.log("[+] Scanner.nextLine blocked rw mount");
                return "";
            }
            return line;
        };
        console.log("[✔] Scanner.nextLine hooked");
    } catch (e) {
        console.log("[-] Scanner: " + e);
    }

    // ── 4. Process.waitFor — make "which su" return error ────
    // checkSuExists checks exit code of Runtime.exec("which su")
    try {
        var Process = Java.use("java.lang.Process");
        Process.waitFor.overload().implementation = function () {
            var ret = this.waitFor();
            console.log("[+] Process.waitFor() → 1 (blocked)");
            return 1; // non-zero = command not found
        };
        console.log("[✔] Process.waitFor hooked");
    } catch (e) {
        console.log("[-] Process.waitFor: " + e);
    }
}