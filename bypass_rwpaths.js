// Fix: "For RW Paths" only
// RootBeer reads /proc/mounts via FileInputStream + Scanner
// looking for system paths mounted as rw

Java.perform(function () {

    // Fix 1: Direct method hook
    try {
        var RB = Java.use("com.scottyab.rootbeer.RootBeer");
        RB.checkForRWPaths.overload().implementation = function () {
            console.log("[+] checkForRWPaths() → false");
            return false;
        };
        console.log("[✔] checkForRWPaths hooked");
    } catch(e) { console.log("[-] checkForRWPaths: " + e); }

    // Fix 2: Block FileInputStream on /proc/mounts entirely
    // If the file can't open, mountReader() returns null → checkForRWPaths returns false
    try {
        var FIS = Java.use("java.io.FileInputStream");
        FIS.$init.overload("java.lang.String").implementation = function(path) {
            if (path === "/proc/mounts" || path === "/proc/self/mounts") {
                console.log("[+] FileInputStream blocked: " + path);
                // Return empty stream by opening /dev/null instead
                return this.$init("/dev/null");
            }
            return this.$init(path);
        };
        console.log("[✔] FileInputStream(/proc/mounts) hooked");
    } catch(e) { console.log("[-] FileInputStream: " + e); }

    // Fix 3: Scanner.hasNextLine — return false immediately if reading mounts
    try {
        var Scanner = Java.use("java.util.Scanner");
        Scanner.nextLine.implementation = function () {
            var line = this.nextLine();
            if (line && line.indexOf(" rw") !== -1 && (
                line.indexOf("/system") !== -1 ||
                line.indexOf("/vendor") !== -1 ||
                line.indexOf("/data")   !== -1 ||
                line.indexOf("/sbin")   !== -1)) {
                console.log("[+] Scanner blocked rw: " + line.substring(0, 60));
                return "tmpfs /mnt ro,relatime 0 0";  // return a safe ro line instead
            }
            return line;
        };
        console.log("[✔] Scanner.nextLine hooked");
    } catch(e) { console.log("[-] Scanner: " + e); }

});