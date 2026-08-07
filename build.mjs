import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import swc from "@swc/core";
import { rollup } from "rollup";
import esbuild from "rollup-plugin-esbuild";

const extensions = [".js", ".jsx", ".mjs", ".ts", ".tsx", ".cts", ".mts"];

const plugins = [
    nodeResolve(),
    commonjs(),
    {
        name: "swc",
        async transform(code, id) {
            const extension = extname(id);
            if (!extensions.includes(extension)) return null;

            const isTypeScript = extension.includes("ts");
            const result = await swc.transform(code, {
                filename: id,
                jsc: {
                    externalHelpers: true,
                    parser: {
                        syntax: isTypeScript ? "typescript" : "ecmascript",
                        tsx: isTypeScript ? extension.endsWith("x") : undefined,
                        jsx: !isTypeScript ? extension.endsWith("x") : undefined
                    }
                },
                env: {
                    targets: "defaults",
                    include: ["transform-classes", "transform-arrow-functions"]
                }
            });

            return result.code;
        }
    },
    esbuild({ minify: true })
];

await rm("./dist", { recursive: true, force: true });
await mkdir("./dist", { recursive: true });

for (const pluginFolder of await readdir("./plugins")) {
    const pluginRoot = `./plugins/${pluginFolder}`;
    const manifest = JSON.parse(await readFile(`${pluginRoot}/manifest.json`, "utf8"));
    const outputFolder = `./dist/${pluginFolder}`;
    const outputFile = `${outputFolder}/index.js`;

    await mkdir(outputFolder, { recursive: true });

    const bundle = await rollup({
        input: `${pluginRoot}/${manifest.main}`,
        onwarn: () => {},
        plugins
    });

    await bundle.write({
        file: outputFile,
        globals(id) {
            if (id.startsWith("@vendetta")) return id.substring(1).replaceAll("/", ".");
            if (id === "react") return "window.React";
            return null;
        },
        format: "iife",
        compact: true,
        exports: "named"
    });

    await bundle.close();

    const bundledCode = await readFile(outputFile);
    manifest.hash = createHash("sha256").update(bundledCode).digest("hex");
    manifest.main = "index.js";

    await writeFile(`${outputFolder}/manifest.json`, JSON.stringify(manifest));
    console.log(`built ${manifest.name}`);
}
