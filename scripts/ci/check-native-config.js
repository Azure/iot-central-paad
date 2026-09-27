const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = require('../../app.json').expo;
const configure = require('../../app.config');

const ci = configure({config: base});
assert.equal(ci.android.package, 'com.iot_pnp.ci');
assert.equal(ci.ios.bundleIdentifier, 'com.microsoft.iotpnp.ci');
assert.deepEqual(ci.ios.associatedDomains, []);
assert.deepEqual(ci.android.intentFilters, []);
assert.deepEqual(ci.ios.entitlements['keychain-access-groups'], [
  'com.microsoft.iotpnp.ci',
]);
assert.equal(ci.ios.appleTeamId, undefined);
const fonts = ci.plugins.find(plugin => plugin[0] === 'expo-font')[1];
assert.equal(fonts.fonts, undefined);
const displayFont = './src/assets/fonts/PAADFraunces-Medium.ttf';
assert.deepEqual(fonts.ios, {fonts: [displayFont]});
assert.deepEqual(
  fonts.android.fonts
    .filter(font => typeof font === 'string')
    .map(font => font.split('/').pop()),
  ci.ios.infoPlist.UIAppFonts,
);
assert.deepEqual(
  fonts.android.fonts.filter(font => typeof font === 'object'),
  [
    {
      fontFamily: 'PAADFraunces-Medium',
      fontDefinitions: [{path: displayFont, weight: 500, style: 'normal'}],
    },
  ],
);
assert.equal(
  ci.extra.headerFontLicense,
  fs.readFileSync('LICENSE.fraunces', 'utf8'),
);
assert.match(ci.extra.headerFontLicense, /SIL OPEN FONT LICENSE Version 1\.1/);
assert.match(ci.extra.headerFontLicense, /Fraunces Project Authors/);
const font = fs.readFileSync(displayFont);
const tables = new Map();
for (let index = 0; index < font.readUInt16BE(4); index += 1) {
  const entry = 12 + index * 16;
  tables.set(
    font.toString('ascii', entry, entry + 4),
    font.readUInt32BE(entry + 8),
  );
}
assert.equal(font.readUInt16BE(tables.get('OS/2') + 4), 500);
assert.equal(tables.has('fvar'), false);
const names = tables.get('name');
const strings = names + font.readUInt16BE(names + 4);
const postscriptNames = [];
for (let index = 0; index < font.readUInt16BE(names + 2); index += 1) {
  const entry = names + 6 + index * 12;
  if (font.readUInt16BE(entry + 6) !== 6) continue;
  const start = strings + font.readUInt16BE(entry + 10);
  const value = Buffer.from(
    font.subarray(start, start + font.readUInt16BE(entry + 8)),
  );
  postscriptNames.push(
    [0, 3].includes(font.readUInt16BE(entry))
      ? value.swap16().toString('utf16le')
      : value.toString('latin1'),
  );
}
assert.ok(postscriptNames.length > 0);
assert.ok(postscriptNames.every(name => name === 'PAADFraunces-Medium'));

delete process.env.CI;
delete process.env.PAAD_VARIANT;
delete process.env.GITHUB_ACTIONS;
delete require.cache[require.resolve('../../app.config')];
const production = require('../../app.config')({config: base});
assert.equal(production.android.package, 'com.iot_pnp');
assert.equal(production.ios.bundleIdentifier, 'com.microsoft.iotpnp');
assert.deepEqual(production.ios.associatedDomains, [
  'applinks:apps.azureiotcentral.com',
]);
assert.equal(
  production.android.intentFilters[0].data.path,
  '/phone-as-device-app-store',
);
assert.equal(production.ios.appleTeamId, undefined);
console.log(
  'Native production ownership and credential-free CI isolation verified.',
);
