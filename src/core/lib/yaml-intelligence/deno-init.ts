/*
* deno-init.ts
*
* code to initialize yaml intelligence setup on deno, currently for the test suite
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { resourcePath } from "../../resources.ts";

import { Semaphore } from "../semaphore.ts";

//@ts-ignore
import { TreeSitter, setWasmBinaryFile } from "../external/tree-sitter-deno.js";

import { initAutomation } from "./yaml-intelligence.ts";
import { QuartoJsonSchemas, setSchemas } from "./schema-utils.ts";
import { setTreeSitter } from "./parsing.ts";

let _init = false;
const hasInit = new Semaphore(0);
export async function init()
{
  if (_init) {
    await hasInit.runExclusive(() => {});
    return;
  }
  _init = true;

  setSchemas(JSON.parse(
    Deno.readTextFileSync(resourcePath("editor/tools/yaml/quarto-json-schemas.json"))
  ) as QuartoJsonSchemas);

  setWasmBinaryFile(Deno.readFileSync(resourcePath("editor/tools/yaml/tree-sitter.wasm")));

  //@ts-ignore
  const treeSitter: any = TreeSitter;
  await treeSitter.init();

  const parser = new treeSitter();
  const language = await treeSitter.Language.load(resourcePath("editor/tools/yaml/tree-sitter-yaml.wasm"));
  parser.setLanguage(language);
  
  setTreeSitter(parser);
  
  // in Deno, this just needs to be any valid URL. We'll never actually use it.
  await initAutomation("https://example.com/"); 
  hasInit.release();
}