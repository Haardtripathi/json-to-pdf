import axios from "axios";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import path from "path";
import fs from "fs";

interface PDFOptions {
    format?: "a4" | "letter" | "legal";
    orientation?: "portrait" | "landscape";
    fontType?: string;
    fontSize?: number;
    pageNumbering?: boolean;

    images?: { path: string; x: number; y: number; width: number; height: number }[];

}

interface HeaderFooter {
    text?: string;
    align?: "left" | "center" | "right";
    fontSize?: number;
    color?: string | number[];
}

/**
 * ✅ Generate PDF from JSON Data or API URL
 */
export async function generatePDF(
    input: string | object,
    options: PDFOptions = {}
): Promise<string> {
    const {
        format = "a4",
        orientation = "portrait",
        fontType = "times",
        fontSize = 14,
        pageNumbering = true,
        images = [],
    } = options;

    let jsonData: any;
    try {
        if (typeof input === "string") {
            const response = await axios.get(input);
            jsonData = response.data;
        } else {
            jsonData = input;
        }

        jsonData = cleanJSON(jsonData);

        const outputFileName = `report-${Date.now()}.pdf`;
        const outputPath = path.join(process.cwd(), outputFileName);

        const doc = new jsPDF({ unit: "pt", format, orientation });

        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        let y = addHeader(doc, jsonData.header, pageWidth, fontType, fontSize);

        doc.setFont(fontType);
        doc.setFontSize(fontSize);



        for (const key in jsonData) {
            if (["header", "footer"].includes(key)) continue;
            const value = jsonData[key];

            if (typeof value === "string") {
                y = ensureSpacing(doc, y, pageHeight, 30, fontType, fontSize, jsonData);
                doc.setFontSize(fontSize);
                doc.setFont(fontType, "bold");
                doc.text(`${key.toUpperCase()}:`, 50, y);
                y += 20;
                doc.setFont(fontType, "normal");

                const splitText = doc.splitTextToSize(value, pageWidth - 100);
                splitText.forEach((line: string) => {
                    y = ensureSpacing(doc, y, pageHeight, 20, fontType, fontSize, jsonData);
                    doc.text(line, 50, y);
                    y += 20;
                });
                y += 20;
                continue;
            }

            if (Array.isArray(value) && typeof value[0] === "object") {
                const headers = Object.keys(value[0]);
                const estimatedTableHeight = value.length * 25 + 50;

                if (headers.includes("url")) {
                    for (const row of value) {
                        if (row.url) {
                            const imgData = await imageToBase64(row.url); // ✅ Convert to Base64
                            if (imgData) {
                                // Ensure space before adding image
                                y = ensureSpacing(doc, y, pageHeight, row.height || 120, fontType, fontSize, jsonData);

                                // Move image to a new page if needed
                                if (y + (row.height || 100) > pageHeight - 100) {
                                    doc.addPage();
                                    addHeader(doc, jsonData.header, pageWidth, fontType, fontSize);
                                    addFooter(doc, jsonData.footer, pageWidth, pageHeight);
                                    y = 100;
                                }

                                // Add Image
                                const imgX = row.x !== undefined ? row.x : 50;
                                doc.addImage(imgData, "JPEG", imgX, y, row.width || 150, row.height || 100);
                                y += (row.height || 100) + 20; // Move down after image
                            }
                        }
                    }
                    continue;
                }

                // 🛠 Move Table to New Page If No Space
                if (!willFitOnPage(y, estimatedTableHeight, pageHeight)) {
                    doc.addPage();
                    addHeader(doc, jsonData.header, pageWidth, fontType, fontSize);
                    addFooter(doc, jsonData.footer, pageWidth, pageHeight);
                    y = 100;
                }

                autoTable(doc, {
                    startY: y,
                    head: [headers],
                    body: value.map(row => headers.map(header => row[header])),
                    theme: "grid",
                    didDrawPage: () => {
                        addHeader(doc, jsonData.header, pageWidth, fontType, fontSize);
                        addFooter(doc, jsonData.footer, pageWidth, pageHeight);
                    }
                });

                y = (doc as any).lastAutoTable.finalY + 30;
                continue;
            }
        }

        // ✅ Ensure Footer on Page 1
        addFooter(doc, jsonData.footer, pageWidth, pageHeight);



        if (pageNumbering) {
            const totalPages = (doc.internal as any).getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(10);
                doc.text(`Page ${i} of ${totalPages}`, pageWidth - 80, pageHeight - 30);
            }
        }

        doc.save(outputFileName);
        console.log("✅ PDF Created:", outputPath);
        return outputPath;
    } catch (error) {
        console.error("❌ Error generating PDF:", error);
        throw error;
    }
}

/**
 * ✅ Function to Add Header (Clean & Professional)
 */
function addHeader(doc: jsPDF, header: HeaderFooter | undefined, pageWidth: number, fontType: string, fontSize: number): number {
    doc.setFillColor(240, 240, 240);
    doc.rect(0, 0, pageWidth, 70, "F");

    doc.setFont(fontType);
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    doc.text(header?.text || "Comprehensive Business Report - 2025", pageWidth / 2, 40, { align: "center" });

    doc.setLineWidth(1);
    doc.line(50, 65, pageWidth - 50, 65);

    return 90;
}



/**
 * ✅ Function to Add Footer (Fixed Page Number Issue)
 */
function addFooter(doc: jsPDF, footer: HeaderFooter | undefined, pageWidth: number, pageHeight: number): void {
    if (!footer) return;

    doc.setFillColor(240, 240, 240);
    doc.rect(0, pageHeight - 60, pageWidth, 60, "F");

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(footer.text || "Generated by JSON-to-PDF Library", pageWidth / 2, pageHeight - 40, { align: "center" });
}

/**
 * ✅ Ensures Tables Never Split Pages
 */
function willFitOnPage(y: number, tableHeight: number, pageHeight: number): boolean {
    return y + tableHeight < pageHeight - 100;
}

/**
 * ✅ Prevent Overlap With Footer & Ensures Better Spacing
 */
function ensureSpacing(
    doc: jsPDF,
    y: number,
    pageHeight: number,
    spaceNeeded: number,
    fontType: string,
    fontSize: number,
    jsonData: any
): number {
    if (y + spaceNeeded > pageHeight - 100) {
        doc.addPage();
        addHeader(doc, jsonData.header, doc.internal.pageSize.width, fontType, fontSize);
        addFooter(doc, jsonData.footer, doc.internal.pageSize.width, doc.internal.pageSize.height);
        return 100; // Reset Y position after header
    }
    return y + spaceNeeded;
}


async function imageToBase64(imageUrl: string): Promise<string | null> {
    try {
        const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
        const base64 = Buffer.from(response.data, "binary").toString("base64");
        return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
        console.error("❌ Failed to load image:", imageUrl, error);
        return null;
    }
}


/**
 * ✅ Function to Clean JSON
 */
function cleanJSON(data: any): any {
    return Array.isArray(data)
        ? data.map(cleanJSON)
        : typeof data === "object" && data !== null
            ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, cleanJSON(v)]))
            : data;
}





// import axios from "axios";
// import { jsPDF } from "jspdf";
// import { autoTable } from "jspdf-autotable";
// import fs from "fs";
// import path from "path";

// interface PDFOptions {
//     format?: "a4" | "letter" | "legal";
//     orientation?: "portrait" | "landscape";
//     fontType?: string;
//     fontSize?: number;
//     theme?: "classic" | "modern" | "corporate" | "minimal";
//     pageNumbering?: boolean;
//     headerStyle?: HeaderFooter;
//     footerStyle?: HeaderFooter;
//     images?: { path: string; x: number; y: number; width: number; height: number }[];
// }

// interface HeaderFooter {
//     text?: string;
//     align?: "left" | "center" | "right";
//     fontSize?: number;
//     color?: string | number[];
// }

// /**
//  * ✅ Convert Image File to Base64
//  */
// function imageToBase64(filePath: string): string | null {
//     try {
//         const imageData = fs.readFileSync(filePath, { encoding: "base64" });
//         const ext = path.extname(filePath).toLowerCase().replace(".", "");
//         if (!["png", "jpg", "jpeg"].includes(ext)) return null;
//         return `data:image/${ext};base64,${imageData}`;
//     } catch (error) {
//         console.error(`❌ Error reading image file: ${filePath}`);
//         return null;
//     }
// }

// /**
//  * ✅ Generate PDF from JSON Data or API URL
//  */
// export async function generatePDF(
//     input: string | object,
//     options: PDFOptions = {}
// ): Promise<string> {
//     const {
//         format = "a4",
//         orientation = "portrait",
//         fontType = "times",
//         fontSize = 14,
//         theme = "classic",
//         pageNumbering = true,
//         headerStyle = {},
//         footerStyle = {},
//         images = [],
//     } = options;

//     let jsonData: any;
//     try {
//         if (typeof input === "string") {
//             const response = await axios.get(input);
//             jsonData = response.data;
//         } else {
//             jsonData = input;
//         }

//         jsonData = cleanJSON(jsonData);

//         const outputFileName = `report-${Date.now()}.pdf`;
//         const outputPath = path.join(process.cwd(), outputFileName);

//         const doc = new jsPDF({ unit: "pt", format, orientation });

//         const pageWidth = doc.internal.pageSize.width;
//         const pageHeight = doc.internal.pageSize.height;

//         let y = addHeader(doc, jsonData.header, pageWidth, fontType, fontSize, theme, headerStyle);

//         doc.setFont(fontType);
//         doc.setFontSize(fontSize);

//         // 🖼️ Add Images (Logos, Watermarks, Embedded Images)
//         images.forEach(img => {
//             const base64Image = imageToBase64(img.path);
//             if (base64Image) {
//                 doc.addImage(base64Image, "PNG", img.x, img.y, img.width, img.height);
//             }
//         });

//         for (const key in jsonData) {
//             if (["header", "footer"].includes(key)) continue;
//             const value = jsonData[key];

//             if (typeof value === "string") {
//                 y = ensureSpacing(doc, y, pageHeight, 15, fontType, fontSize);
//                 doc.setFontSize(fontSize);
//                 doc.setFont(fontType, "bold");
//                 doc.text(`${key.toUpperCase()}:`, 50, y);
//                 y += 16; // Reduced gap
//                 doc.setFont(fontType, "normal");

//                 const splitText = doc.splitTextToSize(value, pageWidth - 100);
//                 splitText.forEach((line: string) => {
//                     y = ensureSpacing(doc, y, pageHeight, 14, fontType, fontSize);
//                     doc.text(line, 50, y);
//                     y += 14;
//                 });
//                 y += 14;
//                 continue;
//             }

//             if (Array.isArray(value) && typeof value[0] === "object") {
//                 const estimatedTableHeight = value.length * 20 + 40;

//                 // 🛠 Move Table & Heading Together if Needed
//                 if (!willFitOnPage(y, estimatedTableHeight, pageHeight)) {
//                     doc.addPage();
//                     y = addHeader(doc, jsonData.header, pageWidth, fontType, fontSize, theme, headerStyle);
//                 }

//                 y = ensureSpacing(doc, y, pageHeight, 30, fontType, fontSize);
//                 doc.setFontSize(fontSize);
//                 doc.setFont(fontType, "bold");
//                 doc.text(`${key.toUpperCase()}:`, 50, y);
//                 y += 20;

//                 const headers = Object.keys(value[0]);
//                 const tableData = value.map((row) => headers.map((header) => row[header]));

//                 autoTable(doc, {
//                     startY: y,
//                     head: [headers],
//                     body: tableData,
//                     theme: theme === "modern" ? "striped" : "grid",
//                     styles: { fontSize: fontSize - 2, cellPadding: 6, textColor: [50, 50, 50] },
//                     headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: "bold" },
//                     margin: { left: 50, right: 50 },
//                     pageBreak: "auto",
//                     didDrawPage: () => {
//                         addHeader(doc, jsonData.header, pageWidth, fontType, fontSize, theme, headerStyle);
//                         addFooter(doc, jsonData.footer, pageWidth, pageHeight, footerStyle);
//                     },
//                 });

//                 y = (doc as any).lastAutoTable.finalY + 20;
//                 continue;
//             }
//         }

//         addFooter(doc, jsonData.footer, pageWidth, pageHeight, footerStyle);

//         // 📄 Add Page Numbers
//         const totalPages = doc.internal.pages.length - 1;
//         for (let i = 1; i <= totalPages; i++) {
//             doc.setPage(i);
//             doc.setFontSize(10);
//             doc.text(`Page ${i} of ${totalPages}`, pageWidth - 80, pageHeight - 30);
//         }

//         doc.save(outputFileName);
//         console.log("✅ PDF Created:", outputPath);
//         return outputPath;
//     } catch (error) {
//         console.error("❌ Error generating PDF:", error);
//         throw error;
//     }
// }


// /**
//  * ✅ Function to Add Header
//  */
// function addHeader(doc: jsPDF, header: HeaderFooter | undefined, pageWidth: number, fontType: string, fontSize: number, theme: string, headerStyle: HeaderFooter): number {
//     if (!header) return 70;

//     doc.setFillColor(230, 230, 230);
//     doc.rect(0, 0, pageWidth, 60, "F");

//     doc.setFont(fontType);
//     doc.setFontSize(fontSize);
//     doc.setTextColor(0, 0, 0);
//     doc.text(header.text || "Report", pageWidth / 2, 40, { align: "center" });

//     return 90;
// }

// /**
//  * ✅ Function to Add Footer
//  */
// function addFooter(doc: jsPDF, footer: HeaderFooter | undefined, pageWidth: number, pageHeight: number, footerStyle: HeaderFooter): void {
//     if (!footer) return;

//     doc.setFillColor(230, 230, 230);
//     doc.rect(0, pageHeight - 50, pageWidth, 50, "F");

//     doc.setFontSize(10);
//     doc.setTextColor(0, 0, 0);
//     doc.text(footer.text || "Generated by JSON-to-PDF Library", pageWidth / 2, pageHeight - 30, { align: "center" });
// }

// /**
//  * ✅ Ensures Tables Never Split Pages
//  */
// function willFitOnPage(y: number, tableHeight: number, pageHeight: number): boolean {
//     return y + tableHeight < pageHeight - 100;
// }

// /**
//  * ✅ Prevent Overlap With Footer & Ensures Better Spacing
//  */
// function ensureSpacing(doc: jsPDF, y: number, pageHeight: number, spaceNeeded: number, fontType: string, fontSize: number): number {
//     if (y + spaceNeeded > pageHeight - 100) {
//         doc.addPage();
//         doc.setFont(fontType);
//         doc.setFontSize(fontSize);
//         return addHeader(doc, { text: "Sales Report" }, doc.internal.pageSize.width, fontType, fontSize, "classic", {});
//     }
//     return y + spaceNeeded;
// }

// /**
//  * ✅ Function to Clean JSON
//  */
// function cleanJSON(data: any): any {
//     return JSON.parse(JSON.stringify(data));
// }

