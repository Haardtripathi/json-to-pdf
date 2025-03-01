import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import copy from "rollup-plugin-copy";

export default {
    input: "src/index.ts",
    output: [
        {
            file: "dist/index.cjs",
            format: "cjs",
            exports: "auto",
            sourcemap: true
        },
        {
            file: "dist/index.mjs",
            format: "es",
            sourcemap: true
        }
    ],
    plugins: [
        resolve(),
        commonjs({ include: "node_modules/**" }), // Ensure jsPDF autoTable works
        typescript(),
        json(),
        copy({
            targets: [{ src: "node_modules/pdfkit/js/data/*", dest: "dist/data" }]
        })
    ],
    external: ["fs", "path", "axios", "jspdf", "jspdf-autotable"]
};
