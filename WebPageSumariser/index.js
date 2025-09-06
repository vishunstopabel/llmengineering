import dotenv from "dotenv";
import OpenAI from "openai";
import puppeteer from "puppeteer";
import path from "node:path";
import fs from "node:fs";
dotenv.config({
  path: "../.env",
  quiet: true,
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt =
  "You are an assistant that analyzes the contents of a website \
and provides a short summary, ignoring text that might be navigation related. \
Respond in markdown.";

const websiteUrl = process.argv[2];

if (!websiteUrl) {
  console.log("no website link is provided");
  process.exit(1);
} else if (
  !websiteUrl.match(
    /^(https?:\/\/)([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/
  )
) {
  console.log("no proper url");
  process.exit(1);
}

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(websiteUrl, { waitUntil: "networkidle2" });

    const title = await page.title();
    const text = await page.evaluate(() => document.body.innerText);
    await browser.close();

    const cleanText = text.replace(/\s+/g, " ").trim();

    const userPrompt = promptForUser({ title, text: cleanText });
    const message = createMessage(userPrompt);

    const response = await client.responses.create({
      model: "gpt-4o",
      input: message,
    });

    const summary = response.output[0].content[0].text;

    const folderPath = path.join(process.cwd(), "summaries");
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    const filepath = path.join(folderPath, `test.md`);

    fs.writeFileSync(filepath, summary, "utf-8");
    console.log(`a Summary saved at : ${filepath}`);
  } catch (error) {
    console.error(error);
  }
})();

function createMessage(userPrompt) {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

function promptForUser(data) {
  return `You are looking at a website titled "${data.title}". The contents of this website are as follows: \n\n${data.text}\n\nPlease provide a short summary of this website in markdown. If it includes news or announcements, summarize these too.`;
}
