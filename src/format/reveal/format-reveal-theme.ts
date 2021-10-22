/*
* format-reveal-theme.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { kTheme } from "../../config/constants.ts";
import {
  Format,
  kTextHighlightingMode,
  Metadata,
  SassLayer,
} from "../../config/types.ts";

import { isFileRef } from "../../core/http.ts";
import { copyMinimal, pathWithForwardSlashes } from "../../core/path.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { compileWithCache } from "../../core/sass.ts";

import { kRevealJsUrl } from "./format-reveal.ts";

export const kRevealLightThemes = [
  "white",
  "beige",
  "sky",
  "serif",
  "simple",
  "solarized",
];

export const kRevealDarkThemes = [
  "black",
  "league",
  "night",
  "blood",
  "moon",
];

export const kRevealThemes = [...kRevealLightThemes, ...kRevealDarkThemes];

export async function revealTheme(format: Format, libDir: string) {
  // metadata override to return
  const metadata: Metadata = {};

  // target revealDir
  const revealDir = join(libDir, "revealjs");

  // copy local version of reveal if we aren't using a remote version
  const revealJsUrl = format.metadata[kRevealJsUrl] as string | undefined;
  const localReveal = (revealJsUrl === undefined) || isFileRef(revealJsUrl);
  if (localReveal) {
    // copy reveal dir
    const revealSrcDir = revealJsUrl ||
      formatResourcePath("revealjs", "reveal");
    copyMinimal(revealSrcDir, revealDir);
    metadata[kRevealJsUrl] = pathWithForwardSlashes(
      revealDir,
    );
  }

  // are we using a reveal base theme? if we are then just return
  // as-is with highlighting mode detected
  const defaultTheme = (format.metadata?.[kTheme] === undefined ||
    format.metadata?.[kTheme] === "default");
  const revealBaseTheme = (!defaultTheme &&
    kRevealThemes.includes(format.metadata?.[kTheme] as string)) ||
    (defaultTheme && !localReveal);
  if (revealBaseTheme) {
    return {
      metadata,
      [kTextHighlightingMode]: revealBaseThemeHighlightingMode(
        format.metadata?.[kTheme],
      ),
    };
  }

  // quarto/custom reveal theme -- first verify we have local reveal
  // (required for sass compilation)
  if (!localReveal) {
    throw new Error(
      "Only built-in reveal themes can be used with a remote revealjs-url",
    );
  }

  // theme is either user provided scss or quarto built-in scss
  let theme = format.metadata?.[kTheme] as string | undefined || "default";
  if (!existsSync(theme)) {
    theme = formatResourcePath("revealjs", join("themes", `${theme}.scss`));
  }
  if (!existsSync(theme)) {
    throw new Error(`Theme file '${theme}' not found`);
  }
  const cssThemeDir = join(revealDir, "css", "theme");
  const cssSourceDir = join(cssThemeDir, "source");
  const cssTemplateDir = join(cssThemeDir, "template");
  const themeScss = Deno.readTextFileSync(theme);
  const scss = await compileWithCache(themeScss, [
    cssSourceDir,
    cssTemplateDir,
  ]);
  Deno.copyFileSync(
    scss,
    join(revealDir, "dist", "theme", "quarto.css"),
  );
  metadata[kTheme] = "quarto";

  // TODO: sniff out highlight mode
  const highlightingMode: "light" | "dark" = "light";

  // return
  return {
    metadata,
    [kTextHighlightingMode]: highlightingMode,
  };
}

function revealBaseThemeHighlightingMode(theme?: unknown) {
  if (theme) {
    const dark = typeof (theme) === "string" &&
      kRevealDarkThemes.includes(theme);
    const highlightingMode: "light" | "dark" = dark ? "dark" : "light";
    return highlightingMode;
  } else {
    return "dark";
  }
}

function revealFrameworkLayer(revealDir: string): SassLayer {
  const readTemplate = (template: string) => {
    return Deno.readTextFileSync(
      join(revealDir, "css", "theme", "template", template),
    );
  };
  return {
    defaults: readTemplate("settings.scss"),
    functions: "",
    mixins: readTemplate("mixins.scss"),
    rules: readTemplate("theme.scss"),
  };
}