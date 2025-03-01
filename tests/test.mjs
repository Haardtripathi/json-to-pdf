import { generatePDF } from "../dist/index.mjs";
import fs from "fs";
import path from "path";

async function test() {
    const jsonFilePath = path.join(process.cwd(), "sample.json");
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8"));

    const outputPath = await generatePDF(jsonData, "letter", "landscape", "courier", 16, true);
    console.log("✅ PDF Created:", outputPath);
}

test();
