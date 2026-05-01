// Fix ONLY: 2nd SU Binary check (checkSuExists)
// checkSuExists does: Runtime.exec("which su") then reads output
// If readline() returns non-null → rooted. We must throw on exec, not redirect.

Java.perform(function () {

    // Fix 1: Hook checkSuExists directly
    try {
        var RB = Java.use("com.scottyab.rootbeer.RootBeer");
        RB.checkSuExists.overload().implementation = function () {
            console.log("[+] checkSuExists() → false");
            return false;
        };
        console.log("[✔] checkSuExists hooked");
    } catch(e) { console.log("[-] checkSuExists: " + e); }

    // Fix 2: Make Runtime.exec THROW for which/su — not redirect
    // checkSuExists catches IOException and returns false
    try {
        var Runtime = Java.use("java.lang.Runtime");
        var IOException = Java.use("java.io.IOException");

        Runtime.exec.overload("[Ljava.lang.String;").implementation = function (arr) {
            var js = arr ? Array.from(arr) : [];
            var cmd = js.join(" ").toLowerCase();
            if (cmd.indexOf("which") !== -1 || cmd.indexOf("su") !== -1) {
                console.log("[+] exec[] → IOException: " + cmd);
                throw IOException.$new("Permission denied");
            }
            return this.exec(arr);
        };

        Runtime.exec.overload("java.lang.String").implementation = function (cmd) {
            if ((cmd||"").toLowerCase().indexOf("which") !== -1 ||
                (cmd||"").toLowerCase() === "su") {
                console.log("[+] exec → IOException: " + cmd);
                throw IOException.$new("Permission denied");
            }
            return this.exec(cmd);
        };

        console.log("[✔] Runtime.exec → IOException hooked");
    } catch(e) { console.log("[-] Runtime.exec: " + e); }

    // Fix 3: BufferedReader.readLine overload() — return null for process streams
    try {
        var BR = Java.use("java.io.BufferedReader");
        BR.readLine.overload().implementation = function () {
            var line = this.readLine();
            if (line !== null && (
                line.indexOf("/su") !== -1 ||
                line.indexOf("which") !== -1 ||
                line === "su")) {
                console.log("[+] BR.readLine blocked: " + line);
                return null;
            }
            return line;
        };
        console.log("[✔] BufferedReader.readLine().overload() hooked");
    } catch(e) { console.log("[-] BufferedReader: " + e); }

});