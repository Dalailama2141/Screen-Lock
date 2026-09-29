/**
 * Metro transformer that adds native support for `.scss` / `.sass` style files.
 *
 * Why this exists: Expo's default Metro config only turns `.scss` into a real
 * module on the **web** platform. On Android/iOS it returns an *empty* module
 * (see `@expo/metro-config/.../transform-worker.js` -> "If the platform is not
 * web, then return an empty module"), so `import styles from './x.scss'`
 * resolves to `undefined` and none of the styles apply.
 *
 * This transformer compiles SCSS with `sass` and converts the resulting CSS into
 * a plain JavaScript object of React Native style objects, then hands the module
 * to Expo's own transform so the rest of the pipeline (Babel, minification,
 * caching) is byte-for-byte identical to a normal JS module. Every non-SCSS
 * file is delegated straight to Expo's transform untouched.
 *
 * Style values are authored as React Native camelCase properties with unitless
 * numbers (e.g. `paddingTop: 12`), which the converter below preserves as-is.
 */

const path = require('path');
const sass = require('sass');
const expoWorker = require('@expo/metro-config/build/transform-worker/transform-worker.js');

const SCSS_PATTERN = /\.(s?css|sass)$/;

function parseValue(raw) {
  const value = raw.trim();
  if (value === '') return undefined;

  // Quoted strings -> plain strings (e.g. "'100%'" -> "100%").
  if (/^(['"]).*\1$/.test(value)) return value.slice(1, -1);

  // Strip px and turn into a number (e.g. "12px" -> 12, "-1.5px" -> -1.5).
  if (/^-?\d+(\.\d+)?px$/.test(value)) return parseFloat(value);

  // Plain numbers stay numbers (e.g. "0.5" -> 0.5, "1" -> 1).
  if (/^-?\d+(\.\d+)?$/.test(value)) return parseFloat(value);

  return value;
}

function cssToStyleObject(css) {
  const result = {};
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Only flat top-level class rules are supported (the RN style subset we use).
  const classPattern = /\.(-?[_a-zA-Z][\w-]*)\s*\{([^}]*)\}/g;
  let match;
  while ((match = classPattern.exec(cleaned)) !== null) {
    const className = match[1];
    const body = match[2];
    const style = {};

    for (const declaration of body.split(';')) {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex === -1) continue;
      const property = declaration.slice(0, separatorIndex).trim();
      if (!property) continue;
      const value = parseValue(declaration.slice(separatorIndex + 1));
      if (value !== undefined) style[property] = value;
    }

    if (Object.keys(style).length > 0) result[className] = style;
  }

  return result;
}

function compileScssToStyleObject(filename, source) {
  const syntax = filename.endsWith('.sass') ? 'indented' : 'scss';
  const compiled = sass.compileString(source, {
    syntax,
    loadPaths: [path.dirname(filename)],
    url: new URL(`file://${filename.replace(/\\/g, '/')}`),
  });
  return cssToStyleObject(compiled.css);
}

async function transform(config, projectRoot, filename, data, options) {
  const isStyleFile = SCSS_PATTERN.test(filename) && options.platform !== 'web';

  if (isStyleFile) {
    if (process.env.SG_SCSS_DEBUG) {
      console.log('[scss-transformer] compiling', filename, 'platform=', options.platform, 'type=', options.type);
    }
    const styleObject = compileScssToStyleObject(filename, data.toString('utf8'));
    const moduleSource = `module.exports = ${JSON.stringify(styleObject)};`;
    // Hand the compiled JS to Expo under a .js filename so it runs the normal
    // module (babel) path. Re-using the .scss name would make Expo treat it as a
    // CSS "asset" and return an empty module.
    const jsFilename = filename.replace(SCSS_PATTERN, '.js');
    return expoWorker.transform(config, projectRoot, jsFilename, Buffer.from(moduleSource), {
      ...options,
      type: 'module',
    });
  }

  return expoWorker.transform(config, projectRoot, filename, data, options);
}

module.exports = {
  transform,
  getCacheKey(config) {
    // Delegate to Expo's cache key and add our sass version so a sass upgrade
    // invalidates previously compiled styles.
    const expoKey = expoWorker.getCacheKey(config);
    let sassVersion = 'unknown';
    try {
      sassVersion = require('sass/package.json').version;
    } catch (_) {
      sassVersion = 'unknown';
    }
    return `${expoKey}|native-scss-transformer|sass-${sassVersion}`;
  },
  getTransformOptions: expoWorker.getTransformOptions,
  collectDependenciesForShaking: expoWorker.collectDependenciesForShaking,
};
