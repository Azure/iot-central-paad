const fs = require('node:fs');
const yaml = require('js-yaml');

test('dismisses at most two stacked stock dialogs and never hides PAAD or unrelated ANRs', () => {
  const flow = yaml.loadAll(fs.readFileSync('.maestro/dismiss-quickstep-anr.yaml', 'utf8'));
  const selector = {id: 'android:id/alertTitle', text: "^(Quickstep|System UI) isn't responding$"};
  expect(flow[0].appId).toBe('${APP_ID}');
  expect(flow[1]).toEqual([{
    runFlow: {
      when: {platform: 'Android'},
      commands: [
        {extendedWaitUntil: {
          visible: {id: 'registration-manual|connection-status|android:id/alertTitle'},
          timeout: 60000,
        }},
        {repeat: {
          times: 2,
          commands: [{runFlow: {
            when: {visible: selector},
            commands: [{tapOn: {id: 'android:id/aerr_close'}}],
          }}],
        }},
        {assertNotVisible: selector},
      ],
    },
  }]);
  const title = new RegExp(selector.text);
  for (const name of ['Quickstep', 'System UI']) expect(title.test(`${name} isn't responding`)).toBe(true);
  for (const text of [
    "IoT Plug and Play isn't responding", "Another app isn't responding",
    "Quickstep isn't responding - extra text",
  ]) expect(title.test(text)).toBe(false);
});
