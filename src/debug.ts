import { chromium } from "playwright";

async function main() {
  const context = await chromium.launchPersistentContext("auth.json", {
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await context.newPage();

  const response = await page.request.get(
    "https://apply.careers.microsoft.com/api/pcsx/dashboard/applications"
  );

  console.log("Status:", response.status());
  console.log("Headers:", JSON.stringify(Object.fromEntries(response.headers ? Object.entries(response.headers()) : []), null, 2));

  const contentType = response.headers()["content-type"] || "";
  console.log("Content-Type:", contentType);

  const body = await response.text();
  console.log("Body (first 3000 chars):", body.substring(0, 3000));

  await context.close();
}

main().catch(console.error);
