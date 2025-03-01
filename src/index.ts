import { generatePDF as generatePDFFunc } from "./generatePDF";

// CommonJS Export
if (typeof module !== "undefined" && module.exports) {
    module.exports = { generatePDF: generatePDFFunc };
}

// ES Module Export
export const generatePDF = generatePDFFunc;
