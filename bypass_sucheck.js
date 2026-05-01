// Fix: "2nd SU Binary check" only (checkSuExists)
// RootBeer does: Runtime.exec({"which","su"}) → reads output → non-null = rooted

Java.perform(function () {

    // Layer 1: Hook checkSuExists directly
    try {
        var RB = Java.use("com.scottyab.rootbeer.RootBeer");
        RB.checkSuExists.overload().implementation = function () {
            console.log("[+] checkSuExists() → false");
            return false;
        };
        console.log("[✔] checkSuExists hooked");
    } catch(e) { console.log("[-] checkSuExists: " + e); }

    // Layer 2: Make exec("which","su") throw — checkSuExists catches and returns false
    try {
        var Runtime = Java.use("java.lang.Runtime");
        var IOException = Java.use("java.io.IOException");

        Runtime.exec.overload("[Ljava.lang.String;").implementation = function (arr) {
            var js = arr ? Array.from(arr) : [];
            if (js.join(" ").toLowerCase().indexOf("which") !== -1) {
                console.log("[+] exec[which su] → IOException");
                throw IOException.$new("blocked");
            }
            return this.exec(arr);
        };
        console.log("[✔] Runtime.exec[which su] hooked");
    } catch(e) { console.log("[-] Runtime.exec: " + e); }

    // Layer 3: Make InputStream from process return empty
    // In case exec doesn't get blocked, make readLine() return null
    try {
        var BR = Java.use("java.io.BufferedReader");
        BR.readLine.overload().implementation = function () {
            var line = this.readLine();
            if (line !== null && line.trim().indexOf("/su") !== -1) {
                console.log("[+] readLine blocked su path: " + line);
                return null;
            }
            return line;
        };
        console.log("[✔] BufferedReader.readLine hooked");
    } catch(e) { console.log("[-] BufferedReader: " + e); }

});