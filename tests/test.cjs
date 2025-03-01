const { generatePDF } = require("../dist/index.cjs");

async function test() {
    const outputPath = await generatePDF(require("../sample1.json"), {
        format: "a4",
        orientation: "portrait",
        fontType: "times",
        fontSize: 14,
        pageNumbering: true
    });

    console.log("✅ PDF Created:", outputPath);
}

test();
