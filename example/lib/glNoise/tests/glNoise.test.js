import ava from "ava";
import fs from "fs/promises";
import path from "path";
import { loadShadersRaw, loadShaders, loadShadersCSM } from "../build/glNoise.m.node.js";

let files;
let expected;

function getDeps(chunks) {
  let names = [];
  let deps = [];

  chunks.forEach((chunk) => {
    const name = chunk.match(/#name: (.*)\n/);
    const dep = chunk.match(/#deps: (.*)\n/);
    names.push(name ? name[1] : undefined);
    deps.push(dep ? dep[1].split(" ") : []);
  });

  return { names, deps };
}

ava.before(async () => {
  files = (await fs.readdir("src")).filter((file) => path.extname(file).toLowerCase() === ".glsl");
  expected = await Promise.all(files.map(async (f) => (await fs.readFile(path.resolve(`src/${f}`))).toString()));
});

ava("Test file extensions", async (t) => {
  const files = (await fs.readdir("src")).map((f) => {
    if (f !== "glsl.d.ts") {
      return f.split(".")[1];
    }
  });
  const isTrue = files.every((f) => (f ? f === "glsl" : true));
  t.true(isTrue, "File with extension other than .glsl found in 'src' directory");
});

ava("Test loadShadersRaw()", async (t) => {
  const actual = await Promise.all(files.map(async (f) => (await loadShadersRaw([`src/${f}`]))[0]));

  const isTrue = expected.every((f, i) => {
    return f === actual[i];
  });

  t.true(isTrue);
});

ava("Test loadShaders()", async (t) => {
  const basePath = "tests/test.glsl";
  const base = (await fs.readFile(path.resolve(basePath))).toString();

  const actual = await Promise.all(
    files.map(async (f) => {
      const paths = [basePath];
      const _chunks = await loadShadersRaw([`src/${f}`]);
      const { deps } = getDeps(_chunks);
      const chunks = [_chunks];

      if (deps[0].length) {
        deps[0].forEach(async (d) => {
          chunks[0].unshift(...(await loadShadersRaw([`src/${d}.glsl`])));
        });
      }

      return (await loadShaders(paths, chunks))[0];
    })
  );

  const isTrue = expected.every((f, i) => {
    return actual[i].includes(f) && actual[i].includes(base);
  });

  t.true(isTrue);
});

ava("Test loadShadersCSM()", async (t) => {
  const basePath = "tests/test.glsl";
  const base = (await fs.readFile(path.resolve(basePath))).toString();

  const actual = await Promise.all(
    files.map(async (f) => {
      const _chunks = await loadShadersRaw([`src/${f}`]);
      const { deps } = getDeps(_chunks);

      const chunks = _chunks;

      if (deps[0].length) {
        deps[0].forEach(async (d) => {
          const dep = await loadShadersRaw([`src/${d}.glsl`]);
          chunks.unshift(...dep);
        });
      }

      const csm = {
        defines: basePath,
        header: basePath,
        main: basePath,
      };

      return await loadShadersCSM(csm, chunks);
    })
  );

  const isTrue = expected.every((f, i) => {
    return actual[i].header.includes(f) && actual[i].main.includes(base);
  });

  t.true(isTrue);
});
