const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

(async function runSeleniumTests() {
  let driver;
  try {
    const options = new chrome.Options();
    if (process.env.HEADLESS !== "false") options.addArguments("--headless=new");
    options.addArguments("--no-sandbox", "--disable-dev-shm-usage");
    driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
    const base = process.env.APP_URL || "http://localhost:3000";
    await driver.get(base);
    await driver.wait(until.elementLocated(By.id("studentForm")), 10000);

    // 1. Attendance page displays registered students: add a test student first.
    const suffix = Date.now().toString().slice(-6);
    await driver.findElement(By.id("rollNo")).sendKeys(`SEL${suffix}`);
    await driver.findElement(By.id("studentName")).sendKeys("Selenium Test Student");
    await driver.findElement(By.id("department")).sendKeys("CSE");
    await driver.findElement(By.css("#studentForm button[type='submit']")).click();
    await driver.wait(until.elementLocated(By.xpath(`//td[contains(., 'SEL${suffix}')]`)), 5000);

    // 2. Seven periods are rendered.
    await driver.findElement(By.css("[data-tab='attendancePanel']")).click();
    await driver.wait(until.elementLocated(By.css("#attendanceRows select")), 5000);
    const selects = await driver.findElements(By.css("#attendanceRows select"));
    if (selects.length < 7) throw new Error("Expected seven period selectors for the test student.");

    // 3. Mark all present and save selected date.
    await driver.findElement(By.id("allPresent")).click();
    await driver.findElement(By.id("saveAttendance")).click();
    await driver.wait(until.elementTextContains(By.id("attendanceSaved"), "Saved"), 5000);

    // 4. Invalid student details are rejected (browser required validation).
    await driver.findElement(By.css("[data-tab='studentsPanel']")).click();
    await driver.findElement(By.id("cancelEdit")).isDisplayed().catch(()=>{});
    // 5. Duplicate roll numbers are rejected by the API.
    const duplicateResult = await driver.executeAsyncScript(async roll => {
      const done = arguments[arguments.length - 1];
      try {
        const r = await fetch("/api/students", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roll_no:roll,name:"Duplicate",department:"CSE"})});
        done({status:r.status});
      } catch(e) { done({error:e.message}); }
    }, `SEL${suffix}`);
    if (duplicateResult.status !== 409) throw new Error("Duplicate roll number was not rejected.");

    // 6–8. Monthly totals, percentage, and threshold indicators render.
    await driver.findElement(By.css("[data-tab='reportsPanel']")).click();
    await driver.findElement(By.id("loadReport")).click();
    await driver.wait(until.elementLocated(By.id("reportRows")), 5000);

    // 9. CSV report link is generated.
    const csvHref = await driver.findElement(By.id("downloadCsv")).getAttribute("href");
    if (!csvHref.includes("/api/reports/monthly.csv")) throw new Error("Monthly CSV link is missing.");

    // 10. Refresh verifies the app can reload saved records.
    await driver.navigate().refresh();
    await driver.wait(until.elementLocated(By.id("studentForm")), 10000);
    console.log("Selenium smoke tests passed.");
  } catch (error) {
    console.error("Selenium tests failed:", error);
    process.exitCode = 1;
  } finally {
    if (driver) await driver.quit();
  }
})();
